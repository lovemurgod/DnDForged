// ForgeDVTT Player Sheet Module
import { VTTDiceParser } from './vtt-dice-parser.js';
import {
    cleanId,
    resolveCharClassLevel,
    injectDiceChips,
    simulateRoll,
    evaluateAbilityFormula,
    evaluateAbilityMaxUses,
    extractTextFromEntries,
    getFeatureDescriptionText,
    detectFeatureCounter,
    getFeatureKey
} from './player-sheet/vtt-sheet-rolls.js';
import {
    ALL_SKILLS,
    STANDARD_TOOLS,
    SKILL_NAMES_MASTER,
    ensureAssignPlayersModalExists,
    openAssignPlayersModal as openAssignPlayersModalExt,
    closeAssignPlayersModal,
    saveAssignPlayers as saveAssignPlayersExt,
    getMacroModalSnapshot
} from './player-sheet/vtt-sheet-modals.js';
import {
    normalizeSkill,
    normalizeTool,
    expandToolOptions,
    ensureBackgroundImportModalExists as ensureBackgroundImportModalExistsExt,
    promptBackgroundImportModal as promptBackgroundImportModalExt,
    switchModalTab,
    getSuggestedCategoryName,
    populateOptFeatureTypeDropdown
} from './player-sheet/vtt-sheet-importers.js';
import {
    getTotalStat,
    getMod,
    getProfBonus,
    getClassHitDie,
    evaluateAttackRoll as evaluateAttackRollCalc,
    evaluateSaveDc as evaluateSaveDcCalc,
    evaluateDamageRolls as evaluateDamageRollsCalc,
    calculateEffectiveHp,
    calculateEffectiveAc
} from './player-sheet/calc/stats.js';
import {
    calculateCharacterSpellSlots,
    calculateEffectiveCasterLevel,
    getWarlockPactSlots
} from './player-sheet/calc/spell-slots.js';
import {
    getContainerContentsWeight,
    getContainerEffectiveWeight as getContainerEffectiveWeightCalc,
    getContainerCapacityStatus,
    calculateCharacterTotalWeight,
    calculateEncumbrance
} from './player-sheet/calc/containers.js';
import {
    applyShortRest as applyShortRestCalc,
    applyLongRest as applyLongRestCalc
} from './player-sheet/calc/rest-recovery.js';
import {
    ensureCharacterBuilderModalExists as ensureCharacterBuilderModalExistsExt,
    openCharacterBuilderModal as openCharacterBuilderModalExt
} from './player-sheet/builder/builder-modal.js';
import {
    ensureItemModalsExist as ensureItemModalsExistExt,
    openItemModal as openItemModalExt,
    openCustomItemModal as openCustomItemModalExt,
    invalidateItemCache as invalidateItemCacheExt,
    getItemCache,
    setItemCache
} from './player-sheet/items/index.js';
import {
    ensureBagModalExists as ensureBagModalExistsExt,
    openBagModal as openBagModalExt,
    bindBagContainerEvents as bindBagContainerEventsExt,
    ensurePlayerTokenEditModalExists as ensurePlayerTokenEditModalExistsExt,
    openPlayerTokenEditModal as openPlayerTokenEditModalExt,
    getPlayerActiveTokenUrl,
    updateTokenPortrait,
    ensureSaveSettingsModalExists as ensureSaveSettingsModalExistsExt,
    openSaveSettingsModal as openSaveSettingsModalExt,
    renderSaveTogglesList as renderSaveTogglesListExt,
    ensureSkillSettingsModalExists as ensureSkillSettingsModalExistsExt,
    openSkillSettingsModal as openSkillSettingsModalExt,
    renderSkillTogglesList as renderSkillTogglesListExt,
    ensureToolSettingsModalExists as ensureToolSettingsModalExistsExt,
    openToolSettingsModal as openToolSettingsModalExt,
    ensureHpSettingsModalExists as ensureHpSettingsModalExistsExt,
    openHpSettingsModal as openHpSettingsModalExt,
    renderHpTogglesList as renderHpTogglesListExt,
    ensureAcSettingsModalExists as ensureAcSettingsModalExistsExt,
    openAcSettingsModal as openAcSettingsModalExt,
    renderAcTogglesList as renderAcTogglesListExt
} from './player-sheet/modals/index.js';
import { renderEquipRowHtml, renderEquipmentHtml, wireInventoryEvents } from './player-sheet/vtt-sheet-inventory.js';
import {
    SPELL_LEVELS,
    renderSpellsHtml,
    wireSpellsEvents,
    getActiveSpellTab,
    setActiveSpellTab,
    getSpellMetaStrings,
    cleanSpellHtml,
    promptUpcastLevel,
    findPlayerSpell,
    getCharIs2024,
    getUpcastedDamage
} from './player-sheet/vtt-sheet-spells-tab.js';
import {
    cleanProficiencyString,
    sanitizeProficienciesText,
    renderPrimaryBioCardHtml,
    renderOtherProficienciesHtml,
    renderAbilityCardsHtml,
    renderAbilityRowHtml,
    formatAbilityCardDescription,
    renderAbilityFields,
    harvestBioData,
    wireBioEvents,
    wireAbilityCardsEvents
} from './player-sheet/vtt-sheet-bio-features.js';

export {
    getTotalStat,
    getMod,
    getProfBonus,
    getClassHitDie,
    calculateCharacterSpellSlots,
    calculateEffectiveCasterLevel,
    getWarlockPactSlots,
    getContainerContentsWeight,
    getContainerCapacityStatus,
    calculateCharacterTotalWeight,
    calculateEncumbrance,
    applyShortRestCalc as applyShortRest,
    applyLongRestCalc as applyLongRest,
    renderEquipRowHtml,
    renderEquipmentHtml,
    wireInventoryEvents,
    SPELL_LEVELS,
    renderSpellsHtml,
    wireSpellsEvents,
    getActiveSpellTab,
    setActiveSpellTab,
    getSpellMetaStrings,
    cleanSpellHtml,
    promptUpcastLevel,
    findPlayerSpell,
    getCharIs2024,
    getUpcastedDamage,
    cleanProficiencyString,
    sanitizeProficienciesText,
    renderPrimaryBioCardHtml,
    renderOtherProficienciesHtml,
    renderAbilityCardsHtml,
    renderAbilityRowHtml,
    formatAbilityCardDescription,
    renderAbilityFields,
    harvestBioData,
    wireBioEvents,
    wireAbilityCardsEvents
};

export function initVttPlayerSheet(vtt) {
    let populateBuildDropdowns = null;
    let updateSubraceDropdown = null;
    const panel = document.getElementById('player-sheet-panel');
    const minimizeBtn = document.getElementById('player-sheet-minimize-btn');
    const contentEl = document.getElementById('player-sheet-content');
    const activeSheetEl = document.getElementById('player-sheet-active');
    const placeholderEl = document.getElementById('player-sheet-placeholder');
    const tabCharacters = document.getElementById('tab-characters');
    const charListEl = document.getElementById('character-list');
    const btnCharAdd = document.getElementById('btn-char-add');

    if (!panel || !minimizeBtn || !contentEl) {
        console.warn('[PlayerSheet] Panel elements not found in DOM.');
    }

    if (panel) {
        // Restore saved panel width if previously stored
        const savedWidth = localStorage.getItem('vtt_ps_panel_width');
        if (savedWidth) {
            const parsed = parseInt(savedWidth, 10);
            if (!isNaN(parsed) && parsed >= 360) {
                panel.style.setProperty('--ps-panel-width', `${parsed}px`);
            }
        }

        let resizeHandle = panel.querySelector('.ps-resize-handle');
        if (!resizeHandle) {
            resizeHandle = document.createElement('div');
            resizeHandle.className = 'ps-resize-handle';
            resizeHandle.title = 'Drag border to resize player sheet (double-click to reset)';
            panel.appendChild(resizeHandle);
        }

        let isResizing = false;
        let startX = 0;
        let startWidth = 450;

        resizeHandle.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) return;
            isResizing = true;
            startX = e.clientX;
            const currentComputed = panel.getBoundingClientRect().width;
            startWidth = currentComputed || 450;
            panel.classList.add('is-resizing');
            resizeHandle.setPointerCapture(e.pointerId);
            e.preventDefault();
            e.stopPropagation();
        });

        resizeHandle.addEventListener('pointermove', (e) => {
            if (!isResizing) return;
            const deltaX = e.clientX - startX;
            let newWidth = startWidth + deltaX;
            const maxWidth = Math.min(window.innerWidth * 0.85, 1200);
            newWidth = Math.max(360, Math.min(newWidth, maxWidth));
            panel.style.setProperty('--ps-panel-width', `${Math.round(newWidth)}px`);
            if (window.VTT?.sheetDock?.updatePosition) {
                window.VTT.sheetDock.updatePosition();
            }
        });

        const stopResizing = (e) => {
            if (!isResizing) return;
            isResizing = false;
            panel.classList.remove('is-resizing');
            try {
                if (resizeHandle.hasPointerCapture(e.pointerId)) {
                    resizeHandle.releasePointerCapture(e.pointerId);
                }
            } catch (err) {}
            const currentComputed = Math.round(panel.getBoundingClientRect().width);
            if (currentComputed >= 360) {
                localStorage.setItem('vtt_ps_panel_width', currentComputed);
            }
            if (window.VTT?.sheetDock?.updatePosition) {
                window.VTT.sheetDock.updatePosition();
            }
        };

        resizeHandle.addEventListener('pointerup', stopResizing);
        resizeHandle.addEventListener('pointercancel', stopResizing);

        resizeHandle.addEventListener('dblclick', (e) => {
            e.preventDefault();
            e.stopPropagation();
            panel.style.setProperty('--ps-panel-width', '450px');
            localStorage.removeItem('vtt_ps_panel_width');
            if (window.VTT?.sheetDock?.updatePosition) {
                window.VTT.sheetDock.updatePosition();
            }
        });
    }

    let isMinimized = false;
    let currentChar = null;
    let spellCache = null;
    let builderCache = null;
    let activeSpellTab = 'cantrip';

    function getDisplaySourceBadge(source) {
        if (!source) return '';
        const s = String(source).toUpperCase().trim();
        if (s === 'PHB') return 'PHB';
        if (s === 'XPHB') return 'XPHB';
        if (s === 'XDMG') return 'XDMG';
        if (s === 'XMM') return 'XMM';
        if (s.startsWith('UA') || s.startsWith('XUA')) return 'UA';
        if (s.includes('PUGILIST')) return 'PUG24';
        if (s.includes('GRIMHOLLOW') || s.includes('GH')) return 'GH';
        if (s.includes('HUMBLEWOOD') || s.includes('HW')) return 'HW';
        if (s.includes('DRAKKENHEIM') || s.includes('DOD')) return 'DoD';
        if (s.includes('TALDOREI')) return 'CR';
        if (s.includes('FLEE') || s.includes('MCDM') || s.includes('ILLRIGGER')) return 'MCDM';
        if (s.includes('KOBOLD') || s.includes('TOB')) return 'KP';
        if (s.includes('GRIFFON')) return 'TGS';
        if (s.includes('VALDA') || s.includes('GUNSLINGER')) return 'VSoS';
        if (s.includes('LOTR')) return 'LotR';
        if (s.includes('CROOKEDMOON')) return 'CM';
        return s.length > 6 ? s.slice(0, 5) : s;
    }

    const GENERIC_EQUIPMENT_OPTIONS = {
        weaponMartial: [
            'Battleaxe',
            'Flail',
            'Glaive',
            'Greataxe',
            'Greatsword',
            'Halberd',
            'Lance',
            'Longsword',
            'Maul',
            'Morningstar',
            'Pike',
            'Rapier',
            'Scimitar',
            'Shortsword',
            'Trident',
            'War Pick',
            'Warhammer',
            'Whip',
            'Blowgun',
            'Hand Crossbow',
            'Heavy Crossbow',
            'Longbow',
            'Net'
        ],
        weaponMartialMelee: [
            'Battleaxe',
            'Flail',
            'Glaive',
            'Greataxe',
            'Greatsword',
            'Halberd',
            'Lance',
            'Longsword',
            'Maul',
            'Morningstar',
            'Pike',
            'Rapier',
            'Scimitar',
            'Shortsword',
            'Trident',
            'War Pick',
            'Warhammer',
            'Whip'
        ],
        weaponSimple: [
            'Club',
            'Dagger',
            'Greatclub',
            'Handaxe',
            'Javelin',
            'Light Hammer',
            'Mace',
            'Quarterstaff',
            'Sickle',
            'Spear',
            'Light Crossbow',
            'Dart',
            'Shortbow',
            'Sling'
        ],
        weaponSimpleMelee: [
            'Club',
            'Dagger',
            'Greatclub',
            'Handaxe',
            'Javelin',
            'Light Hammer',
            'Mace',
            'Quarterstaff',
            'Sickle',
            'Spear'
        ],
        focusHoly: ['Amulet', 'Emblem', 'Reliquary'],
        focusArcane: ['Crystal', 'Orb', 'Rod', 'Staff', 'Wand'],
        focusDruidic: ['Sprig of Mistletoe', 'Totem', 'Wooden Staff', 'Yew Wand'],
        instrumentMusical: [
            'Bagpipes',
            'Drum',
            'Dulcimer',
            'Flute',
            'Lute',
            'Lyre',
            'Horn',
            'Pan Flute',
            'Shawm',
            'Viol'
        ],
        gamingSet: ['Dice Set', 'Dragonchess Set', 'Playing Card Set', 'Three-Dragon Ante Set'],
        artisanTools: [
            "Alchemist's Supplies",
            "Brewer's Supplies",
            "Calligrapher's Supplies",
            "Carpenter's Tools",
            "Cartographer's Tools",
            "Cobbler's Tools",
            "Cook's Utensils",
            "Glassblower's Tools",
            "Jeweler's Tools",
            "Leatherworker's Tools",
            "Mason's Tools",
            "Painter's Supplies",
            "Potter's Tools",
            "Smith's Tools",
            "Tinker's Tools",
            "Weaver's Tools",
            "Woodcarver's Tools"
        ]
    };

    async function fetchCatalogJson(primaryUrl, fallbackUrl, compendiumEndpoint, defaultVal = []) {
        try {
            const res = await fetch(primaryUrl);
            if (res.ok) return await res.json();
        } catch (e) {}
        if (fallbackUrl) {
            try {
                const res = await fetch(fallbackUrl);
                if (res.ok) return await res.json();
            } catch (e) {}
        }
        if (compendiumEndpoint) {
            try {
                const res = await fetch(compendiumEndpoint);
                if (res.ok) return await res.json();
            } catch (e) {}
        }
        return defaultVal;
    }

    let disabledSourcesCache = null;
    async function getDisabledSources() {
        if (disabledSourcesCache !== null) return disabledSourcesCache;
        try {
            const campId = window.VTT?.campaignId || window.VTT?.campaignState?.id || '';
            const res = await fetch(
                `/api/sources/disabled${campId ? '?campaignId=' + encodeURIComponent(campId) : ''}`
            );
            if (res.ok) {
                const data = await res.json();
                disabledSourcesCache = new Set((data.disabledSources || []).map((s) => String(s).toUpperCase()));
                return disabledSourcesCache;
            }
        } catch (e) {}
        disabledSourcesCache = new Set();
        return disabledSourcesCache;
    }

    function isSourceAllowed(src, name = '', disabledSources = null) {
        if (!src) return true;
        const upSrc = String(src).toUpperCase();
        const ds =
            disabledSources instanceof Set
                ? disabledSources
                : disabledSourcesCache instanceof Set
                  ? disabledSourcesCache
                  : null;
        if (ds) {
            if (ds.has(upSrc)) return false;
            if (ds.has('UA')) {
                if (upSrc.startsWith('UA') || upSrc.startsWith('XUA') || (name && name.includes('(UA)'))) return false;
            }
        }
        return true;
    }

    let builderPromise = null;
    function ensureBuilderCache() {
        if (builderCache && builderCache.races && builderCache.races.length > 0 && disabledSourcesCache !== null)
            return Promise.resolve(builderCache);
        if (builderPromise) return builderPromise;
        builderPromise = Promise.all([
            fetchCatalogJson(
                '/data/races-catalog.json',
                'data/races-catalog.json',
                '/api/compendium/races/catalog',
                []
            ),
            fetchCatalogJson(
                '/data/backgrounds-catalog.json',
                'data/backgrounds-catalog.json',
                '/api/compendium/backgrounds/catalog',
                []
            ),
            fetchCatalogJson(
                '/data/classes-catalog.json',
                'data/classes-catalog.json',
                '/api/compendium/classes/catalog',
                []
            ),
            fetchCatalogJson('/data/class/index.json', 'data/class/index.json', null, {}),
            fetchCatalogJson(
                '/data/feats-catalog.json',
                'data/feats-catalog.json',
                '/api/compendium/feats/catalog',
                []
            ),
            fetchCatalogJson(
                '/data/optionalfeatures-catalog.json',
                'data/optionalfeatures-catalog.json',
                '/api/compendium/optionalfeatures/catalog',
                []
            ),
            fetchCatalogJson('/data/items-catalog.json', 'data/items-catalog.json', '/api/items/catalog', []),
            fetchCatalogJson(
                '/data/spells-catalog.json',
                'data/spells-catalog.json',
                '/api/compendium/spells/catalog',
                []
            ),
            getDisabledSources()
        ])
            .then(([raceData, bgData, classCatalog, classIndex, featsData, optFeaturesData, itemsData, spellsData]) => {
                builderCache = {
                    races: Array.isArray(raceData) ? raceData : raceData?.race || [],
                    bgs: Array.isArray(bgData) ? bgData : bgData?.background || [],
                    classes: Array.isArray(classCatalog) ? classCatalog : null,
                    classIndex: classIndex || {},
                    feats: Array.isArray(featsData) ? featsData : featsData?.feat || [],
                    optionalFeatures: Array.isArray(optFeaturesData) ? optFeaturesData : [],
                    items: Array.isArray(itemsData) ? itemsData : itemsData?.item || [],
                    spells: Array.isArray(spellsData) ? spellsData : spellsData?.spell || []
                };
                return builderCache;
            })
            .catch((err) => {
                console.error('[PlayerSheet] Failed loading builderCache:', err);
                builderCache = {
                    races: [],
                    bgs: [],
                    classes: null,
                    classIndex: {},
                    feats: [],
                    optionalFeatures: [],
                    items: [],
                    spells: []
                };
                return builderCache;
            });
        return builderPromise;
    }

    function getClassHitDie(className) {
        if (!className) return 'd8';
        const name = className
            .replace(/\s*\[.*?\]$/, '')
            .toLowerCase()
            .trim();
        const standardHitDice = {
            artificer: 'd8',
            barbarian: 'd12',
            bard: 'd8',
            cleric: 'd8',
            druid: 'd8',
            fighter: 'd10',
            monk: 'd8',
            paladin: 'd10',
            ranger: 'd10',
            rogue: 'd8',
            sorcerer: 'd6',
            warlock: 'd8',
            wizard: 'd6',
            'blood hunter': 'd10',
            pugilist: 'd10',
            gunslinger: 'd8',
            illrigger: 'd10',
            psion: 'd6',
            scholar: 'd8',
            warden: 'd10',
            captain: 'd8',
            messenger: 'd8',
            tamer: 'd8',
            'monster hunter': 'd10',
            'treasure hunter': 'd8',
            mystic: 'd8'
        };
        if (standardHitDice[name]) return standardHitDice[name];
        if (builderCache && Array.isArray(builderCache.classes)) {
            const matched = builderCache.classes.find((cls) => cls.name.toLowerCase() === name);
            if (matched && matched.hitDie) return matched.hitDie;
        }
        return 'd8';
    }

    function injectDiceChips(html) {
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

    function getSpellMetaStrings(sp, slKey) {
        if (window.VTTSpellManager && window.VTTSpellManager.getSpellMetaStrings) {
            return window.VTTSpellManager.getSpellMetaStrings(sp, slKey);
        }
        if (!sp || typeof sp !== 'object') return {};

        let school = sp.school || '';
        let levelVal = sp.level !== undefined ? sp.level : '';
        let level = '';
        if (levelVal !== undefined && levelVal !== null && levelVal !== '') {
            let levelNum = Number(levelVal);
            if (!isNaN(levelNum)) {
                level = levelNum === 0 ? 'Cantrip' : `Level ${levelNum}`;
            } else {
                level = String(levelVal);
            }
        } else if (slKey) {
            if (slKey === 'cantrip') level = 'Cantrip';
            else if (typeof slKey === 'string' && slKey.startsWith('level')) {
                const num = slKey.replace('level', '');
                level = `Level ${num}`;
            } else {
                level = String(slKey);
            }
        }

        let time = sp.castingTime || '';
        let range = sp.range || '';
        let components = sp.components || '';
        let duration = sp.duration || '';

        return { school, level, time, range, components, duration };
    }

    function cleanSpellHtml(html) {
        if (!html) return '';
        let cleaned = html;
        cleaned = cleaned.replace(/<div class="spell-meta"[^>]*>[\s\S]*?<\/div>/gi, '');
        return cleaned.trim();
    }

    function renderAndInjectSpell(spellName, containerEl, fallbackDesc, sp, slKey) {
        if (window.VTTSpellManager && window.VTTSpellManager.renderAndInjectSpell) {
            return window.VTTSpellManager.renderAndInjectSpell(spellName, containerEl, fallbackDesc, sp, slKey);
        }
        let metaHtml = '';
        let meta = getSpellMetaStrings(sp || { name: spellName }, slKey);
        let level = meta.level || (sp?.level !== undefined ? (sp.level === 0 ? 'Cantrips' : sp.level) : '');
        let school = meta.school || sp?.school || '';
        let time = meta.time || sp?.castingTime || '';
        let range = meta.range || sp?.range || '';
        let components = meta.components || sp?.components || '';
        let duration = meta.duration || sp?.duration || '';

        metaHtml = '<div class="spell-meta" style="margin-bottom: 8px;">';
        if (level !== undefined && level !== '')
            metaHtml += `<div><i class="fa-solid fa-layer-group" style="width: 16px; text-align: center; margin-right: 4px;" title="Level"></i> <strong>Level:</strong> ${level}</div>`;
        if (school)
            metaHtml += `<div><i class="fa-solid fa-graduation-cap" style="width: 16px; text-align: center; margin-right: 4px;" title="School"></i> <strong>School:</strong> ${school}</div>`;
        if (time)
            metaHtml += `<div><i class="fa-solid fa-clock" style="width: 16px; text-align: center; margin-right: 4px;" title="Casting Time"></i> <strong>Casting Time:</strong> ${time}</div>`;
        if (range)
            metaHtml += `<div><i class="fa-solid fa-ruler" style="width: 16px; text-align: center; margin-right: 4px;" title="Range"></i> <strong>Range:</strong> ${range}</div>`;
        if (components)
            metaHtml += `<div><i class="fa-solid fa-hand-sparkles" style="width: 16px; text-align: center; margin-right: 4px;" title="Components"></i> <strong>Components:</strong> ${components}</div>`;
        if (duration)
            metaHtml += `<div><i class="fa-solid fa-stopwatch" style="width: 16px; text-align: center; margin-right: 4px;" title="Duration"></i> <strong>Duration:</strong> ${duration}</div>`;
        metaHtml += '</div>';

        let rawBody = sp?.description || fallbackDesc || '';
        if (typeof injectDiceChips === 'function') {
            rawBody = injectDiceChips(rawBody);
        }

        if (!rawBody && !metaHtml) {
            containerEl.innerHTML = fallbackDesc
                ? `<div>${fallbackDesc.replace(/\n/g, '<br>')}</div>`
                : `<em>Could not find full text for ${spellName}</em>`;
        } else {
            containerEl.innerHTML = metaHtml + rawBody;
        }
    }

    function promptUpcastLevel(baseLvl, callback) {
        const modal = document.getElementById('modal-spell-upcast-prompt');
        const select = document.getElementById('upcast-prompt-level');
        select.innerHTML = '';
        for (let i = baseLvl; i <= 9; i++) {
            select.innerHTML += `<option value="${i}">${i}${i === 1 ? 'st' : i === 2 ? 'nd' : i === 3 ? 'rd' : 'th'} Level${i === baseLvl ? ' (Base)' : ''}</option>`;
        }
        modal.classList.remove('vtt-hidden');

        const handleCast = () => {
            cleanup();
            callback(parseInt(select.value));
        };
        const handleCancel = () => {
            cleanup();
            callback(null);
        };
        const cleanup = () => {
            modal.classList.add('vtt-hidden');
            document.getElementById('upcast-prompt-cast').removeEventListener('click', handleCast);
            document.getElementById('upcast-prompt-cancel').removeEventListener('click', handleCancel);
        };

        document.getElementById('upcast-prompt-cast').addEventListener('click', handleCast);
        document.getElementById('upcast-prompt-cancel').addEventListener('click', handleCancel);
    }

    // Global keyboard modifier tracking (Shift = Advantage, Ctrl = Disadvantage)
    if (typeof window !== 'undefined' && !window._vttKeyTrackerBound) {
        window._vttKeyTrackerBound = true;
        let shiftDown = false;
        let ctrlDown = false;
        window.addEventListener(
            'keydown',
            (e) => {
                if (e.shiftKey || e.key === 'Shift') shiftDown = true;
                if (e.ctrlKey || e.key === 'Control') ctrlDown = true;
            },
            true
        );
        window.addEventListener(
            'keyup',
            (e) => {
                if (!e.shiftKey && e.key === 'Shift') shiftDown = false;
                if (!e.ctrlKey && e.key === 'Control') ctrlDown = false;
            },
            true
        );
        window.addEventListener('blur', () => {
            shiftDown = false;
            ctrlDown = false;
        });
        window.VTT_isShiftPressed = () => shiftDown;
        window.VTT_isCtrlPressed = () => ctrlDown;
    }

    window.vttPlayerSheetAPI = {
        getSpellCache: () =>
            spellCache || (window.VTTSpellManager?.getSpellCache ? window.VTTSpellManager.getSpellCache() : null),
        setSpellCache: (cache) => {
            spellCache = cache;
        },
        invalidateItemCache: () => {
            invalidateItemCacheExt();
        },
        invalidateBuilderCache: () => {
            builderCache = null;
            builderPromise = null;
            if (document.getElementById('pc-race') && typeof ensureBuilderCache === 'function') {
                ensureBuilderCache().then(() => {
                    const raceSel = document.getElementById('pc-race');
                    if (raceSel && typeof populateBuildDropdowns === 'function') populateBuildDropdowns();
                });
            }
        },
        getSpellMetaStrings: (sp) => getSpellMetaStrings(sp),
        simulateRoll: (formula, crit, optEvent) => simulateRoll(formula, crit, optEvent),
        parseSpellToMacro: (spData, newSpell) => window.VTTSpellManager?.parseSpellToMacro(spData, newSpell),
        renderAndInjectSpell: (spellName, containerEl, fallbackDesc, spData) =>
            renderAndInjectSpell(spellName, containerEl, fallbackDesc, spData),
        renderSpellRowHtml: (sp, slKey, idx, isAllTab) => {
            if (window.VTTSpellManager && window.VTTSpellManager.renderSpellRowHtml) {
                return window.VTTSpellManager.renderSpellRowHtml(sp, slKey, idx, {
                    allowEdit: true,
                    isAllTab,
                    classPrefix: 'pc-spell-'
                });
            }
            if (!sp) return '';
            const spName = typeof sp === 'string' ? sp.replace(/{@spell ([^|}]+).*?}/, '$1') : sp?.name || 'Unknown';
            const isPrepared = typeof sp === 'object' && sp !== null ? sp.prepared !== false : true;
            const opacity = !isPrepared && slKey !== 'cantrip' && slKey !== 'legacy' ? 'opacity: 0.6;' : '';
            let badges = '';
            const spText =
                typeof sp === 'object' && sp !== null ? JSON.stringify(sp).toLowerCase() : String(spName).toLowerCase();
            let isConcentration = typeof sp === 'object' && sp !== null ? sp.concentration : undefined;
            let isRitual = typeof sp === 'object' && sp !== null ? sp.ritual : undefined;

            if (isConcentration === undefined) {
                isConcentration = !!(
                    (typeof sp === 'object' && sp !== null && sp.concentration) ||
                    (typeof sp === 'object' &&
                        sp !== null &&
                        typeof sp.duration === 'string' &&
                        sp.duration.toLowerCase().includes('concentration')) ||
                    (typeof sp === 'object' &&
                        sp !== null &&
                        Array.isArray(sp.duration) &&
                        sp.duration.some((d) => d.concentration)) ||
                    spText.includes('concentration')
                );
            }
            if (isRitual === undefined) {
                isRitual = !!(
                    (typeof sp === 'object' && sp !== null && sp.ritual) ||
                    (typeof sp === 'object' && sp !== null && sp.meta && sp.meta.ritual) ||
                    (typeof sp === 'object' &&
                        sp !== null &&
                        typeof sp.components === 'string' &&
                        sp.components.toLowerCase().includes('r')) ||
                    spText.includes('ritual')
                );
            }

            if (isConcentration) {
                badges += `<span class="badge badge-c" style="background:#f44336; color:#fff; border-radius:4px; padding:2px 4px; font-size:0.6rem; margin-left:4px;" title="Concentration">C</span>`;
            }
            if (isRitual) {
                badges += `<span class="badge badge-r" style="background:#2196f3; color:#fff; border-radius:4px; padding:2px 4px; font-size:0.6rem; margin-left:4px;" title="Ritual">R</span>`;
            }

            const attrName = spName.toLowerCase().replace(/"/g, '&quot;');

            return `
                <div class="spell-row cs-spell-item glass-flat" data-spell-name="${attrName}" data-level="${slKey}" data-idx="${idx}" data-prepared="${isPrepared}" draggable="true" style="padding:8px; display:flex; flex-direction:column; gap:4px; transition: border-color 0.15s, box-shadow 0.15s, opacity 0.15s; ${opacity}">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div style="display:flex; align-items:center; gap:6px;">
                            <div class="pc-spell-drag-handle" data-level="${slKey}" data-idx="${idx}" title="Click and drag to reorder spell" style="cursor:grab; padding:2px 6px 2px 2px; opacity:0.6; display:flex; align-items:center; user-select:none; transition:opacity 0.15s, color 0.15s;" onmouseover="if(!this.dataset.disabled){this.style.opacity='1'; this.style.color='var(--color-gold-base)';}" onmouseout="if(!this.dataset.disabled){this.style.opacity='0.6'; this.style.color='inherit';}">
                                <i class="fa-solid fa-grip-vertical" style="font-size:0.85rem;"></i>
                            </div>
                            <div class="pc-spell-prep-toggle" data-level="${slKey}" data-idx="${idx}" style="cursor: pointer; color: var(--color-gold-base); font-size: 0.8rem; display: ${slKey === 'cantrip' || slKey === 'legacy' ? 'none' : 'block'};">
                                <i class="${isPrepared ? 'fa-solid' : 'fa-regular'} fa-circle"></i>
                            </div>
                            <div class="pc-spell-expand-btn" title="Expand Details" style="cursor: pointer; color: var(--color-text-muted); font-size: 0.7rem;">
                                <i class="fa-solid fa-scroll"></i>
                                <i class="fa-solid fa-chevron-right" style="transition:transform 0.2s;"></i>
                            </div>
                            <div style="display:flex; align-items:center; gap:6px;">
                                <div class="pc-spell-post-chat" data-level="${slKey}" data-idx="${idx}" style="cursor:pointer;" title="Ping description to chat">
                                    <i class="fa-solid fa-comment-dots text-gradient-gold"></i>
                                </div>
                                <div class="pc-spell-ping-macro" data-level="${slKey}" data-idx="${idx}" style="cursor:pointer; font-weight:600; color:var(--color-text-primary);" title="Roll Spell">
                                    <span class="pc-spell-name">${spName}</span>${badges}
                                </div>
                            </div>
                        </div>
                        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                            <button class="btn btn-xxs btn-secondary pc-spell-edit" data-level="${slKey}" data-idx="${idx}"><i class="fa-solid fa-pen"></i></button>
                        </div>
                    </div>
                    <div class="pc-spell-details" style="display: none; margin-top:8px; padding-top:8px; border-top:1px solid rgba(255,255,255,0.1); font-size:0.8rem;">
                        <div class="pc-spell-desc"><em>Loading spell details...</em></div>
                    </div>
                </div>
            `;
        }
    };

    function showVttPrompt(title, defaultValue, callback) {
        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100vw';
        overlay.style.height = '100vh';
        overlay.style.backgroundColor = 'rgba(0,0,0,0.6)';
        overlay.style.zIndex = '10000';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';

        const box = document.createElement('div');
        box.style.backgroundColor = '#1e1e1e';
        box.style.border = '1px solid var(--color-border-subtle, #444)';
        box.style.borderRadius = '8px';
        box.style.padding = '20px';
        box.style.width = '300px';
        box.style.boxShadow = '0 4px 12px rgba(0,0,0,0.5)';
        box.style.display = 'flex';
        box.style.flexDirection = 'column';
        box.style.gap = '15px';

        const titleEl = document.createElement('h3');
        titleEl.textContent = title;
        titleEl.style.margin = '0';
        titleEl.style.color = 'var(--color-gold-base, #ffd700)';

        const input = document.createElement('input');
        input.type = 'text';
        input.value = defaultValue || '';
        input.style.width = '100%';
        input.style.padding = '8px';
        input.style.backgroundColor = 'rgba(0,0,0,0.3)';
        input.style.border = '1px solid var(--color-border-subtle, #444)';
        input.style.color = '#fff';
        input.style.borderRadius = '4px';

        const btnRow = document.createElement('div');
        btnRow.style.display = 'flex';
        btnRow.style.justifyContent = 'flex-end';
        btnRow.style.gap = '10px';

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.className = 'btn btn-secondary btn-sm';

        const okBtn = document.createElement('button');
        okBtn.textContent = 'OK';
        okBtn.className = 'btn btn-primary btn-sm';

        btnRow.appendChild(cancelBtn);
        btnRow.appendChild(okBtn);

        box.appendChild(titleEl);
        box.appendChild(input);
        box.appendChild(btnRow);
        overlay.appendChild(box);
        document.body.appendChild(overlay);

        input.focus();
        input.select();

        const cleanup = () => {
            document.body.removeChild(overlay);
        };

        const submit = () => {
            cleanup();
            callback(input.value);
        };

        okBtn.addEventListener('click', submit);
        cancelBtn.addEventListener('click', () => {
            cleanup();
            callback(null);
        });

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                cleanup();
                callback(null);
            }
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') submit();
            if (e.key === 'Escape') {
                cleanup();
                callback(null);
            }
        });
    }

    function openAssignPlayersModal(char) {
        openAssignPlayersModalExt(char, vtt, (updatedChar) => saveAndEmit(updatedChar));
    }

    function cleanId(str) {
        return (str || '')
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '');
    }

    function resolveCharClassLevel(char, targetClassName) {
        if (!char || !char.classes || !Array.isArray(char.classes)) return 0;
        const target = (targetClassName || '')
            .replace(/\s*\[.*?\]$/, '')
            .trim()
            .toLowerCase();
        const c = char.classes.find((cl) => {
            const raw = (cl.name || '')
                .replace(/\s*\[.*?\]$/, '')
                .trim()
                .toLowerCase();
            return raw === target || (cl.name || '').trim().toLowerCase() === target;
        });
        return c ? parseInt(c.level) || 1 : 0;
    }

    function evaluateAbilityFormula(formula, formulaConfig, char) {
        if (!char) return formula || '';

        if (formulaConfig && typeof formulaConfig === 'object') {
            const base = (formulaConfig.baseDice || '').trim();
            const sc = formulaConfig.scalingMod || 'none';
            const extra = parseInt(formulaConfig.extraBonus) || 0;
            let modVal = 0;
            let hasMod = false;

            if (sc === 'classLevel') {
                const cls = formulaConfig.modClass || char.classes?.[0]?.name || '';
                modVal = resolveCharClassLevel(char, cls);
                hasMod = true;
            } else if (sc === 'level') {
                modVal = char.level || (char.classes || []).reduce((acc, c) => acc + (parseInt(c.level) || 0), 0) || 1;
                hasMod = true;
            } else if (sc === 'PB') {
                const lvl =
                    char.level || (char.classes || []).reduce((acc, c) => acc + (parseInt(c.level) || 0), 0) || 1;
                modVal = Math.ceil(lvl / 4) + 1;
                hasMod = true;
            } else if (['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'].includes(sc)) {
                const statKey = sc.toLowerCase();
                modVal = char.statMods && char.statMods[statKey] !== undefined ? parseInt(char.statMods[statKey]) : 0;
                hasMod = true;
            }

            let result = base;
            if (hasMod) {
                const sign = modVal >= 0 ? '+' : '';
                result = result ? `${result}${sign}${modVal}` : `${modVal}`;
            }
            if (extra !== 0) {
                const sign = extra >= 0 ? '+' : '';
                result = result ? `${result}${sign}${extra}` : `${extra}`;
            }
            return result.replace(/\s+/g, '').replace(/\+\+/g, '+').replace(/\+-/g, '-');
        }

        if (!formula || typeof formula !== 'string') return '';

        let resolved = formula;
        resolved = resolved.replace(/@classes\.([a-zA-Z0-9_-]+)\.level/gi, (m, cName) => {
            return String(resolveCharClassLevel(char, cName));
        });
        resolved = resolved.replace(/@level/gi, () => {
            const lvl = char.level || (char.classes || []).reduce((acc, c) => acc + (parseInt(c.level) || 0), 0) || 1;
            return String(lvl);
        });
        resolved = resolved.replace(/@pb/gi, () => {
            const lvl = char.level || (char.classes || []).reduce((acc, c) => acc + (parseInt(c.level) || 0), 0) || 1;
            return String(Math.ceil(lvl / 4) + 1);
        });
        resolved = resolved.replace(/@(str|dex|con|int|wis|cha)/gi, (m, statKey) => {
            const k = statKey.toLowerCase();
            return String(char.statMods && char.statMods[k] !== undefined ? parseInt(char.statMods[k]) : 0);
        });

        return resolved.replace(/\s+/g, '').replace(/\+\+/g, '+').replace(/\+-/g, '-');
    }

    function evaluateAbilityMaxUses(usesMax, char) {
        if (!usesMax) return 0;
        if (typeof usesMax === 'number') return usesMax;
        const s = String(usesMax).trim().toUpperCase();
        if (s === 'PB') {
            const lvl = char.level || (char.classes || []).reduce((acc, c) => acc + (parseInt(c.level) || 0), 0) || 1;
            return Math.ceil(lvl / 4) + 1;
        }
        if (['CHA', 'WIS', 'INT', 'CON', 'DEX', 'STR'].includes(s)) {
            const modKey = s.toLowerCase();
            return Math.max(
                1,
                char.statMods && char.statMods[modKey] !== undefined ? parseInt(char.statMods[modKey]) : 1
            );
        }
        const parsed = parseInt(s);
        return !isNaN(parsed) ? parsed : 1;
    }

    function populateScalingModDropdown(char, selectedVal) {
        const sel = document.getElementById('modal-ability-scaling-mod');
        if (!sel) return;
        let opts = `
            <option value="none">None (+0)</option>
            <option value="level">Character Level (@level)</option>
        `;
        (char.classes || []).forEach((c) => {
            if (c.name) {
                const clean = cleanId(c.name);
                opts += `<option value="classLevel:${c.name}">${c.name} Level (@classes.${clean}.level)</option>`;
            }
        });
        opts += `
            <option value="PB">Proficiency Bonus (@pb)</option>
            <option value="STR">STR Mod (@str)</option>
            <option value="DEX">DEX Mod (@dex)</option>
            <option value="CON">CON Mod (@con)</option>
            <option value="INT">INT Mod (@int)</option>
            <option value="WIS">WIS Mod (@wis)</option>
            <option value="CHA">CHA Mod (@cha)</option>
        `;
        sel.innerHTML = opts;
        if (selectedVal) sel.value = selectedVal;
    }

    function updateFormulaBuilderOutputs(char) {
        const base = (document.getElementById('modal-ability-base-dice')?.value || '').trim();
        const sc = document.getElementById('modal-ability-scaling-mod')?.value || 'none';
        const extra = parseInt(document.getElementById('modal-ability-extra-bonus')?.value) || 0;

        let fmla = base;
        let modClass = '';
        let scalingMod = sc;

        if (sc.startsWith('classLevel:')) {
            modClass = sc.replace('classLevel:', '');
            scalingMod = 'classLevel';
            const clean = cleanId(modClass);
            if (fmla) fmla += ` + @classes.${clean}.level`;
            else fmla = `@classes.${clean}.level`;
        } else if (sc === 'level') {
            if (fmla) fmla += ` + @level`;
            else fmla = `@level`;
        } else if (sc === 'PB') {
            if (fmla) fmla += ` + @pb`;
            else fmla = `@pb`;
        } else if (['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'].includes(sc)) {
            if (fmla) fmla += ` + @${sc.toLowerCase()}`;
            else fmla = `@${sc.toLowerCase()}`;
        }

        if (extra !== 0) {
            if (fmla) fmla += extra > 0 ? ` + ${extra}` : ` - ${Math.abs(extra)}`;
            else fmla = String(extra);
        }

        const formulaInput = document.getElementById('modal-ability-formula');
        if (formulaInput) formulaInput.value = fmla;

        const cfg = { baseDice: base, scalingMod, modClass, extraBonus: extra };
        const evalFormula = evaluateAbilityFormula(fmla, cfg, char);
        const previewEl = document.getElementById('modal-ability-formula-preview');
        if (previewEl) previewEl.innerText = evalFormula || 'None';
    }

    function extractTextFromEntries(entries) {
        if (!entries) return '';
        if (typeof entries === 'string') {
            return entries.replace(/\{@([a-z]+)\s+([^}]+)\}/gi, (match, tag, content) => {
                const parts = content.split('|');
                const t = tag.toLowerCase();
                if (t === 'dice' || t === 'damage') return parts[0];
                if (t === 'filter') return parts[0];
                if (t === 'item') {
                    if (parts.length >= 3 && parts[2] && !parts[2].includes('=')) return parts[2];
                    return parts[0];
                }
                if (parts.length >= 3 && parts[2] && !parts[2].includes('=')) return parts[2];
                return parts[0];
            });
        }
        if (Array.isArray(entries)) {
            return entries
                .map((e) => extractTextFromEntries(e))
                .filter(Boolean)
                .join('\n\n');
        }
        if (typeof entries === 'object') {
            if (entries.type === 'list') {
                return (entries.items || []).map((i) => '- ' + extractTextFromEntries(i)).join('\n');
            }
            if (entries.entries) {
                let text = entries.name ? `**${entries.name}**\n` : '';
                return text + extractTextFromEntries(entries.entries);
            }
            if (entries.items) {
                return extractTextFromEntries(entries.items);
            }
            if (entries.type === 'table') {
                return '[Table omitted from description]';
            }
        }
        return '';
    }

    function cleanProficiencyString(raw, isWeapon = false) {
        if (!raw) return '';
        let str = String(raw).trim();
        str = str
            .replace(/\{@([a-z]+)\s+([^}]+)\}/gi, (match, tag, content) => {
                const parts = content.split('|');
                if (parts.length >= 3 && parts[2]) return parts[2];
                return parts[0];
            })
            .trim();
        if (!str) return '';
        const lower = str.toLowerCase();
        if (isWeapon) {
            if (lower === 'simple' || lower === 'martial') {
                return (lower === 'simple' ? 'Simple' : 'Martial') + ' Weapons';
            }
            if (lower.endsWith(' weapons') && !lower.startsWith('simple') && !lower.startsWith('martial')) {
                str = str.replace(/\s+weapons$/i, '').trim();
            }
            return str.replace(/\b[a-z]/g, (c) => c.toUpperCase());
        }
        return str.replace(/\b[a-z]/g, (c) => c.toUpperCase());
    }

    function sanitizeProficienciesText(text, isWeapon = false) {
        if (!text) return '';
        const cleaned = extractTextFromEntries(String(text));
        const parts = cleaned
            .split(',')
            .map((p) => cleanProficiencyString(p, isWeapon))
            .filter(Boolean);
        return Array.from(new Set(parts)).join(', ');
    }

    function getFeatureDescriptionText(f) {
        if (!f) return '';
        if (f.description) return f.description.trim();
        let desc = extractTextFromEntries(f.rawEntries || f.entries).trim();
        if (!desc && f.entriesHtml) {
            desc = f.entriesHtml
                .replace(/<br\s*\/?>/gi, '\n')
                .replace(/<\/p>/gi, '\n\n')
                .replace(/<li>/gi, '- ')
                .replace(/<\/li>/gi, '\n')
                .replace(
                    /<div class="compendium-subentry">(?:<div class="compendium-subentry">)?<strong>(.*?)<\/strong>/gi,
                    '\n**$1**\n'
                )
                .replace(/<[^>]+>/g, '')
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'")
                .replace(/\n{3,}/g, '\n\n')
                .trim();
        }
        return desc;
    }

    function detectFeatureCounter(f, desc, char) {
        let hasCounter = f.hasCounter || false;
        let usesMax = f.usesMax || null;
        let resetType = f.resetType || 'short';

        if (!hasCounter) {
            const plain = ((f.name || '') + ' ' + (desc || '')).toLowerCase();
            const restMatch = plain.match(
                /(?:can(?:\'t|not))\s+(?:use\s+(?:it|this\s+feature)|do\s+so)\s+again\s+until\s+you\s+finish\s+a\s+(short\s+(?:or\s+long|and\s+long)|short|long)\s+rest/i
            );
            if (restMatch) {
                hasCounter = true;
                usesMax = 1;
                resetType = restMatch[1].includes('short') ? 'short' : 'long';
            } else if (plain.includes('action surge') || plain.includes('second wind')) {
                hasCounter = true;
                usesMax = 1;
                resetType = 'short';
            } else if (plain.includes('bardic inspiration')) {
                hasCounter = true;
                usesMax = 'CHA';
                resetType = 'long';
            } else if (plain.includes('rage') && (f.className === 'Barbarian' || plain.includes('barbarian'))) {
                hasCounter = true;
                usesMax = 2;
                resetType = 'long';
            } else if (plain.includes('moxie points') || (f.name && f.name.toLowerCase() === 'moxie')) {
                hasCounter = true;
                const pug = (char?.classes || []).find((c) => (c.name || '').toLowerCase() === 'pugilist');
                usesMax = pug ? parseInt(pug.level) || 1 : char?.level || 1;
                resetType = 'short';
            } else if (
                plain.includes('ki points') ||
                plain.includes('focus points') ||
                (f.name && (f.name.toLowerCase() === 'ki' || f.name.toLowerCase() === "monk's focus"))
            ) {
                hasCounter = true;
                const mnk = (char?.classes || []).find((c) => (c.name || '').toLowerCase() === 'monk');
                usesMax = mnk ? parseInt(mnk.level) || 1 : char?.level || 1;
                resetType = 'short';
            } else if (plain.includes('sorcery points') || (f.name && f.name.toLowerCase() === 'font of magic')) {
                hasCounter = true;
                const src = (char?.classes || []).find((c) => (c.name || '').toLowerCase() === 'sorcerer');
                usesMax = src ? parseInt(src.level) || 2 : char?.level || 2;
                resetType = 'long';
            } else if (plain.includes('grit points') || (f.name && f.name.toLowerCase().includes('grit'))) {
                hasCounter = true;
                usesMax = 'WIS';
                resetType = 'short';
            } else if (
                plain.match(
                    /(?:finish|complete) a (?:short or long|short) rest before you can use (?:it|this (?:feature|trait|action)) again/
                )
            ) {
                hasCounter = true;
                usesMax = 1;
                resetType = 'short';
            } else if (
                plain.match(
                    /(?:finish|complete) a long rest before you can use (?:it|this (?:feature|trait|action)) again/
                )
            ) {
                hasCounter = true;
                usesMax = 1;
                resetType = 'long';
            } else if (plain.match(/proficiency bonus.*?regain/)) {
                hasCounter = true;
                usesMax = 'PB';
                resetType = plain.includes('short rest') ? 'short' : 'long';
            }
        }

        return { hasCounter, usesMax, resetType };
    }

    let availableFeatures = [];
    let currentImportData = [];
    let currentCategory = 'class';
    let pendingImportFeatures = [];
    let selectedImportFeatures = new Map();

    function getFeatureKey(f) {
        if (!f) return '';
        if (f.id) return f.id;
        return `${currentCategory}_${f.name}_${f.source || ''}_${f.level || ''}_${f.subclassShortName || ''}`;
    }

    function switchModalTab(tabId) {
        document.querySelectorAll('#tab-btn-manual, #tab-btn-import').forEach((b) => b.classList.remove('active'));
        document.getElementById('modal-tab-manual')?.classList.add('vtt-hidden');
        document.getElementById('modal-tab-import')?.classList.add('vtt-hidden');

        document.getElementById(`tab-btn-${tabId}`)?.classList.add('active');
        document.getElementById(`modal-tab-${tabId}`)?.classList.remove('vtt-hidden');
    }

    function getSuggestedCategoryName(features) {
        if (currentCategory === 'class') {
            const classSel = document.getElementById('import-class-sel');
            const className = classSel ? classSel.value : '';
            const subSel = document.getElementById('import-subclass-sel');
            const subName =
                subSel && subSel.value && subSel.value !== '__base__'
                    ? subSel.options[subSel.selectedIndex]?.text.split('[')[0].trim()
                    : '';

            if (features && features.length === 1 && features[0].subclassShortName) {
                return `Subclass - ${subName || features[0].subclassShortName}`;
            }
            if (subName) {
                return `Subclass - ${subName}`;
            }
            return className ? `Class - ${className}` : 'Class Features';
        }
        if (currentCategory === 'feat') return 'Feats';
        if (currentCategory === 'race') {
            return features && features.length === 1 ? `Species - ${features[0].name}` : 'Species Traits';
        }
        if (currentCategory === 'background') {
            return features && features.length === 1 ? `Background - ${features[0].name}` : 'Background Features';
        }
        if (currentCategory === 'charoption') return 'Character Options';
        if (currentCategory === 'optionalfeature') {
            if (features && features.length > 0) {
                const first = features[0];
                const cat = first.featureCategory || first.featureTypeName;
                if (cat && cat !== 'Optional Feature') {
                    if (cat.endsWith('y')) return cat.slice(0, -1) + 'ies';
                    if (!cat.endsWith('s')) return cat + 's';
                    return cat;
                }
            }
            return 'Optional Features';
        }
        return 'Special Features';
    }

    function updateImportBatchButton() {
        const count = selectedImportFeatures.size;
        const countEl = document.getElementById('import-selected-count');
        const btn = document.getElementById('btn-import-batch');
        if (countEl) countEl.innerText = count;
        if (btn) btn.disabled = count === 0;

        const listEl = document.getElementById('import-feature-list');
        const selectAll = document.getElementById('import-select-all');
        const allChks = listEl ? listEl.querySelectorAll('.import-feature-chk') : [];
        const checkedVisible = listEl ? listEl.querySelectorAll('.import-feature-chk:checked') : [];
        if (selectAll) {
            selectAll.checked = allChks.length > 0 && checkedVisible.length === allChks.length;
        }
    }

    function populateOptFeatureTypeDropdown(data) {
        const sel = document.getElementById('import-optfeat-type-sel');
        if (!sel) return;
        const typeCounts = new Map();
        (data || []).forEach((f) => {
            const cat = f.featureCategory || f.featureTypeName || 'Other';
            typeCounts.set(cat, (typeCounts.get(cat) || 0) + 1);
        });

        let opts = '<option value="">-- All Feature Types --</option>';
        const sortedTypes = Array.from(typeCounts.keys()).sort((a, b) => a.localeCompare(b));
        sortedTypes.forEach((t) => {
            opts += `<option value="${t}">${t} (${typeCounts.get(t)})</option>`;
        });
        sel.innerHTML = opts;
        sel.value = '';
    }

    function promptImportDestinationCategory(features, defaultCatName) {
        pendingImportFeatures = features || [];
        if (pendingImportFeatures.length === 0) return;

        const char = currentChar;
        const modal = document.getElementById('pc-ability-import-cat-modal');
        const overlay = document.getElementById('pc-ability-import-cat-overlay');
        const sel = document.getElementById('import-cat-select');
        const summaryEl = document.getElementById('import-cat-modal-summary');
        const newNameInput = document.getElementById('import-cat-new-name');

        if (!modal || !sel) return;

        if (summaryEl) {
            summaryEl.innerText = `Importing ${pendingImportFeatures.length} item${pendingImportFeatures.length > 1 ? 's' : ''} to character.`;
        }

        let opts = '';
        const suggested = defaultCatName || 'Class Features';
        opts += `<option value="__new__" selected>✨ Create New: "${suggested}"</option>`;

        if (char && char.abilityCategories && char.abilityCategories.length > 0) {
            char.abilityCategories.forEach((cat) => {
                opts += `<option value="${cat.id}">📁 ${cat.name}</option>`;
            });
        }
        opts += `<option value="__uncategorized__">Uncategorized</option>`;

        sel.innerHTML = opts;
        if (newNameInput) {
            newNameInput.value = suggested;
            newNameInput.style.display = 'block';
        }

        modal.classList.remove('vtt-hidden');
        overlay.classList.remove('vtt-hidden');
    }

    async function populateManualTabWithFeature(f) {
        const rawName = f.name || '';
        const badge = getDisplaySourceBadge(f.source);
        const tag = badge ? ` [${badge}]` : f.source ? ` [${f.source}]` : '';
        const displayName = badge && !rawName.includes('[') && !rawName.includes(badge) ? `${rawName}${tag}` : rawName;
        document.getElementById('modal-ability-name').value = displayName;
        let desc = getFeatureDescriptionText(f);
        if (!desc && f.traits && f.traits.length > 0) {
            desc = f.traits.map((t) => `**${t.name}**: ${t.description}`).join('\n\n');
        }
        if (!desc && f.source && f.id) {
            let cType =
                currentCategory === 'feat'
                    ? 'feats'
                    : currentCategory === 'race'
                      ? 'races'
                      : currentCategory === 'background'
                        ? 'backgrounds'
                        : currentCategory === 'optionalfeature'
                          ? 'optionalfeatures'
                          : '';
            if (cType) {
                try {
                    const res = await fetch(
                        `/api/compendium/${cType}/${encodeURIComponent(f.source)}/${encodeURIComponent(f.id)}`
                    );
                    if (res.ok) {
                        const full = await res.json();
                        desc =
                            full.descriptionHtml ||
                            full.description ||
                            extractTextFromEntries(full.rawEntries || full.entries).trim();
                    }
                } catch (err) {}
            }
        }
        document.getElementById('modal-ability-desc').value = desc;

        // Action type
        const actSel = document.getElementById('modal-ability-action-type');
        if (actSel) {
            let actionType = f.actionType || 'passive';
            if (!f.actionType) {
                const plain = ((f.name || '') + ' ' + desc).toLowerCase();
                if (plain.includes('bonus action')) actionType = 'bonus';
                else if (plain.includes('reaction')) actionType = 'reaction';
                else if (plain.includes('as an action') || plain.includes('action to')) actionType = 'action';
            }
            actSel.value = actionType;
        }

        // Formula & builder
        const char = currentChar;
        let baseDice = '';
        let scalingMod = 'none';
        let extraBonus = 0;
        let formulaStr = f.formula || '';

        if (f.formulaConfig) {
            baseDice = f.formulaConfig.baseDice || '';
            scalingMod = f.formulaConfig.modClass
                ? `classLevel:${f.formulaConfig.modClass}`
                : f.formulaConfig.scalingMod || 'none';
            extraBonus = f.formulaConfig.extraBonus || 0;
        }

        populateScalingModDropdown(char, scalingMod);
        if (document.getElementById('modal-ability-base-dice'))
            document.getElementById('modal-ability-base-dice').value = baseDice;
        if (document.getElementById('modal-ability-extra-bonus'))
            document.getElementById('modal-ability-extra-bonus').value = extraBonus;
        if (document.getElementById('modal-ability-formula'))
            document.getElementById('modal-ability-formula').value = formulaStr;

        if (char) {
            const evalFormula = evaluateAbilityFormula(formulaStr, f.formulaConfig, char);
            const previewEl = document.getElementById('modal-ability-formula-preview');
            if (previewEl) previewEl.innerText = evalFormula || 'None';
        }

        // Active resource counter
        const counterInfo = detectFeatureCounter(f, desc, char);
        let hasCounter = counterInfo.hasCounter;
        let usesMax = counterInfo.usesMax;
        let resetType = counterInfo.resetType;

        const counterCheckbox = document.getElementById('modal-ability-has-counter');
        const usesContainer = document.getElementById('modal-ability-uses-container');
        const usesMaxInput = document.getElementById('modal-ability-uses-max');
        const usesCurrentInput = document.getElementById('modal-ability-uses-current');
        const resetSelect = document.getElementById('modal-ability-reset-type');

        if (hasCounter && counterCheckbox) {
            counterCheckbox.checked = true;
            if (usesContainer) usesContainer.style.display = 'flex';
            const resolvedMax = evaluateAbilityMaxUses(usesMax, char);
            if (usesMaxInput) usesMaxInput.value = resolvedMax;
            if (usesCurrentInput) usesCurrentInput.value = resolvedMax;
            if (resetSelect) resetSelect.value = resetType || 'short';
        } else if (counterCheckbox) {
            counterCheckbox.checked = false;
            if (usesContainer) usesContainer.style.display = 'none';
            if (usesMaxInput) usesMaxInput.value = 0;
            if (usesCurrentInput) usesCurrentInput.value = 0;
        }

        switchModalTab('manual');
    }

    function renderImportFeatureList() {
        const listEl = document.getElementById('import-feature-list');
        if (!listEl) return;
        const search = (document.getElementById('import-search')?.value || '').toLowerCase().trim();
        const subSel = document.getElementById('import-subclass-sel')?.value || '';
        const activeEdition = window.activeImportEditionFilter || 'all';

        if (currentImportData.length === 0 && currentCategory === 'class') {
            listEl.innerHTML =
                '<div style="text-align:center; color:var(--color-text-muted); font-size:0.8rem; margin-top:20px;">Select a class to browse features</div>';
            updateImportBatchButton();
            return;
        }

        availableFeatures = [];

        currentImportData.forEach((f) => {
            if (currentCategory === 'class') {
                if (subSel === '__base__') {
                    if (f.subclassShortName) return;
                } else if (subSel) {
                    if (f.subclassShortName !== subSel) return;
                }
            }
            if (currentCategory === 'optionalfeature') {
                const optType = document.getElementById('import-optfeat-type-sel')?.value || '';
                if (optType) {
                    const matchesCategory =
                        f.featureCategory === optType ||
                        f.featureTypeName === optType ||
                        (f.featureType && f.featureType.includes(optType));
                    if (!matchesCategory) return;
                }
            }
            if (activeEdition !== 'all') {
                const src = (f.source || '').toUpperCase();
                if (
                    activeEdition === 'phb' &&
                    (src === 'XPHB' || src === 'XDMG' || src === 'XMM' || src.startsWith('XUA'))
                )
                    return;
                if (activeEdition === 'xphb' && src === 'PHB') return;
            }
            if (!isSourceAllowed(f.source, f.name, disabledSourcesCache)) return;
            availableFeatures.push(f);
        });

        let html = '';
        availableFeatures.forEach((f, idx) => {
            const rawName = f.name || '';
            const badge = getDisplaySourceBadge(f.source);
            const tag = badge ? ` [${badge}]` : f.source ? ` [${f.source}]` : '';
            const displayName =
                badge && !rawName.includes('[') && !rawName.includes(badge) ? `${rawName}${tag}` : rawName;
            if (search && !displayName.toLowerCase().includes(search) && !rawName.toLowerCase().includes(search))
                return;

            const fKey = getFeatureKey(f);
            const isChecked = selectedImportFeatures.has(fKey) ? 'checked' : '';

            const source = f.source ? `[${f.source}]` : '';
            const isSubclass = f.subclassShortName
                ? `<span style="color:#d4af37; font-weight:600;">[${f.subclassShortName}]</span> `
                : '';
            let levelText = f.level !== undefined ? `Lvl ${f.level} • ` : '';

            // Feature Type badge if optional feature
            let optTypeBadge = '';
            if (f.featureTypeName) {
                optTypeBadge = `<span style="font-size:0.65rem; background:rgba(155,89,182,0.25); color:#af7ac5; border:1px solid rgba(155,89,182,0.4); padding:1px 5px; border-radius:3px;">${f.featureTypeName}</span>`;
            }

            // Action badge
            let actionBadge = '';
            const act = f.actionType || '';
            if (act === 'bonus') {
                actionBadge = `<span style="font-size:0.65rem; background:rgba(230,126,34,0.25); color:#e67e22; border:1px solid rgba(230,126,34,0.4); padding:1px 5px; border-radius:3px;">Bonus</span>`;
            } else if (act === 'reaction') {
                actionBadge = `<span style="font-size:0.65rem; background:rgba(155,89,182,0.25); color:#9b59b6; border:1px solid rgba(155,89,182,0.4); padding:1px 5px; border-radius:3px;">Reaction</span>`;
            } else if (act === 'action') {
                actionBadge = `<span style="font-size:0.65rem; background:rgba(52,152,219,0.25); color:#3498db; border:1px solid rgba(52,152,219,0.4); padding:1px 5px; border-radius:3px;">Action</span>`;
            }

            // Formula badge
            let formulaBadge = '';
            if (f.formula) {
                formulaBadge = `<span style="font-size:0.65rem; background:rgba(212,175,55,0.2); color:#d4af37; border:1px solid rgba(212,175,55,0.4); padding:1px 5px; border-radius:3px; display:inline-flex; align-items:center; gap:2px;"><i class="fa-solid fa-dice-d20" style="font-size:0.6rem;"></i> ${f.formula}</span>`;
            }

            // Counter badge
            let counterBadge = '';
            if (f.hasCounter) {
                const rTxt = f.resetType === 'short' ? 'SR' : 'LR';
                const uMax = f.usesMax || 1;
                counterBadge = `<span style="font-size:0.65rem; background:rgba(46,204,113,0.2); color:#2ecc71; border:1px solid rgba(46,204,113,0.4); padding:1px 5px; border-radius:3px;">${uMax}/${rTxt}</span>`;
            }

            // Traits badge if species
            let traitsBadge = '';
            if (f.traits && f.traits.length > 0) {
                traitsBadge = `<span style="font-size:0.65rem; background:rgba(41,128,185,0.2); color:#5dade2; border:1px solid rgba(41,128,185,0.4); padding:1px 5px; border-radius:3px;"><i class="fa-solid fa-dna" style="font-size:0.6rem;"></i> ${f.traits.length} Traits</span>`;
            }

            let prereqText = f.prerequisite && f.prerequisite !== 'None' ? `Prereq: ${f.prerequisite} • ` : '';

            // Prerequisite validation against current character
            let prereqBadge = '';
            if (currentChar && (f.classPrereq || f.levelPrereq || (f.level && currentCategory === 'class'))) {
                const curClasses =
                    currentChar.classes && currentChar.classes.length > 0
                        ? currentChar.classes
                        : [{ name: currentChar.class || '', level: currentChar.level || 1 }];
                const totalCharLevel = curClasses.reduce((sum, c) => sum + (parseInt(c.level) || 1), 0);
                let meetsPrereq = true;

                if (f.classPrereq) {
                    const matchedClass = curClasses.find((c) =>
                        (c.name || '').toLowerCase().includes(f.classPrereq.toLowerCase())
                    );
                    if (!matchedClass) {
                        meetsPrereq = false;
                    } else if (f.levelPrereq && (parseInt(matchedClass.level) || 1) < f.levelPrereq) {
                        meetsPrereq = false;
                    }
                } else if (f.levelPrereq && totalCharLevel < f.levelPrereq) {
                    meetsPrereq = false;
                } else if (currentCategory === 'class' && f.level && totalCharLevel < f.level) {
                    meetsPrereq = false;
                }

                if (!meetsPrereq) {
                    prereqBadge = `<span style="font-size:0.65rem; background:rgba(231,76,60,0.2); color:#e74c3c; border:1px solid rgba(231,76,60,0.4); padding:1px 5px; border-radius:3px;" title="Prerequisites not yet met by character"><i class="fa-solid fa-triangle-exclamation"></i> Prereq Unmet</span>`;
                }
            }

            html += `
                <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.3); padding:6px 8px; border-radius:4px; gap:8px; border:1px solid rgba(255,255,255,0.04);">
                    <div style="display:flex; align-items:center; gap:8px; flex:1; min-width:0;">
                        <input type="checkbox" class="import-feature-chk" data-idx="${idx}" data-key="${fKey}" ${isChecked} style="cursor:pointer; flex-shrink:0;">
                        <div style="display:flex; flex-direction:column; overflow:hidden;">
                            <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                                <span style="font-size:0.85rem; font-weight:bold; color:var(--color-text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${displayName}</span>
                                ${optTypeBadge}
                                ${prereqBadge}
                                ${actionBadge}
                                ${formulaBadge}
                                ${counterBadge}
                                ${traitsBadge}
                            </div>
                            <span style="font-size:0.7rem; color:var(--color-text-muted);">${levelText}${isSubclass}${prereqText}${source}</span>
                        </div>
                    </div>
                    <div style="display:flex; align-items:center; gap:4px; flex-shrink:0;">
                        <button class="btn btn-xxs btn-primary btn-import-feature-quick" data-idx="${idx}" title="Quick Import to Category" style="display:inline-flex; align-items:center; justify-content:center; width:22px; height:22px; padding:0;"><i class="fa-solid fa-plus"></i></button>
                        <button class="btn btn-xxs btn-secondary btn-import-feature-exec" data-idx="${idx}" title="Edit before importing"><i class="fa-solid fa-pen-to-square" style="font-size:0.7rem;"></i></button>
                    </div>
                </div>
            `;
        });

        if (!html) {
            html =
                '<div style="text-align:center; color:var(--color-text-muted); font-size:0.8rem; margin-top:20px;">No features found</div>';
        }

        listEl.innerHTML = html;
        updateImportBatchButton();

        // Checkbox changes - update selectedImportFeatures Map
        listEl.querySelectorAll('.import-feature-chk').forEach((chk) => {
            chk.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.idx);
                const f = availableFeatures[idx];
                if (f) {
                    const key = e.target.dataset.key || getFeatureKey(f);
                    if (e.target.checked) {
                        selectedImportFeatures.set(key, f);
                    } else {
                        selectedImportFeatures.delete(key);
                    }
                }
                updateImportBatchButton();
            });
        });

        // 1-Click quick import
        listEl.querySelectorAll('.btn-import-feature-quick').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.currentTarget.dataset.idx);
                const f = availableFeatures[idx];
                if (!f) return;
                if (currentCategory === 'background' || f.skillsData || f.toolsData || f.equipmentData) {
                    promptBackgroundImportModal(f, currentChar);
                    return;
                }
                const defaultCat = getSuggestedCategoryName([f]);
                promptImportDestinationCategory([f], defaultCat);
            });
        });

        // Edit before importing
        listEl.querySelectorAll('.btn-import-feature-exec').forEach((btn) => {
            btn.addEventListener('click', async (e) => {
                const idx = e.currentTarget.dataset.idx;
                const f = availableFeatures[idx];
                if (!f) return;
                if (currentCategory === 'background' || f.skillsData || f.toolsData || f.equipmentData) {
                    promptBackgroundImportModal(f, currentChar);
                    return;
                }
                populateManualTabWithFeature(f);
            });
        });
    }

    function initializeImportTab() {
        const classSel = document.getElementById('import-class-sel');
        if (!classSel || classSel.options.length > 1) return;
        if (!builderCache) {
            ensureBuilderCache().then(() => initializeImportTab());
            return;
        }

        let opts = '<option value="">-- Select Class --</option>';
        if (builderCache.classes && Array.isArray(builderCache.classes)) {
            const classMap = new Map();
            builderCache.classes.forEach((c) => {
                if (!isSourceAllowed(c.source, c.name, disabledSourcesCache)) return;
                const badge = getDisplaySourceBadge(c.source);
                const tag = badge ? ` [${badge}]` : c.source ? ` [${c.source}]` : '';
                const fullName = `${c.name}${tag}`;
                if (!classMap.has(fullName)) {
                    classMap.set(fullName, { ...c, fullName, tag });
                }
            });
            Array.from(classMap.values())
                .sort((a, b) => a.fullName.localeCompare(b.fullName))
                .forEach((c) => {
                    opts += `<option value="${c.fullName}" data-id="${c.id}" data-name="${c.name}" data-source="${c.source}">${c.fullName}</option>`;
                });
        } else if (builderCache.classIndex) {
            Object.keys(builderCache.classIndex).forEach((cKey) => {
                const name = cKey.charAt(0).toUpperCase() + cKey.slice(1);
                opts += `<option value="${name}">${name}</option>`;
            });
        }
        classSel.innerHTML = opts;

        classSel.addEventListener('change', async () => {
            const selectedOpt = classSel.options[classSel.selectedIndex];
            const classId = selectedOpt?.dataset?.id;
            const classSource = selectedOpt?.dataset?.source;
            const rawClassName = selectedOpt?.dataset?.name || classSel.value.replace(/\s*\[.*?\]$/, '').trim();
            const fullClassName = classSel.value;
            const subSel = document.getElementById('import-subclass-sel');
            if (!fullClassName) {
                currentImportData = [];
                subSel.innerHTML = '<option value="">-- All Subclasses --</option>';
                subSel.disabled = true;
                renderImportFeatureList();
                return;
            }

            currentImportData = [];

            if (builderCache && Array.isArray(builderCache.classes)) {
                let matchedClass = null;
                if (classId) {
                    matchedClass = builderCache.classes.find((c) => c.id === classId);
                }
                if (!matchedClass && classSource) {
                    matchedClass = builderCache.classes.find(
                        (c) =>
                            c.name.toLowerCase() === rawClassName.toLowerCase() &&
                            (c.source || '').toLowerCase() === classSource.toLowerCase()
                    );
                }
                if (!matchedClass) {
                    matchedClass = builderCache.classes.find(
                        (c) => c.name.toLowerCase() === rawClassName.toLowerCase()
                    );
                }
                if (matchedClass) {
                    try {
                        const res = await fetch(
                            `/api/compendium/classes/${encodeURIComponent(matchedClass.source)}/${encodeURIComponent(matchedClass.id)}`
                        );
                        if (res.ok) {
                            const full = await res.json();
                            if (full.features) {
                                full.features.forEach((f) => {
                                    f.className = rawClassName;
                                    f.classFullName = fullClassName;
                                    currentImportData.push(f);
                                });
                            }
                            if (full.subclasses) {
                                full.subclasses.forEach((sc) => {
                                    (sc.features || []).forEach((f) => {
                                        f.className = rawClassName;
                                        f.classFullName = fullClassName;
                                        f.subclassShortName = sc.shortName;
                                        f.subclassName = sc.name;
                                        f.subclassSource = sc.source;
                                        currentImportData.push(f);
                                    });
                                });
                            }

                            let subOpts = '<option value="">-- All Subclasses --</option>';
                            subOpts += '<option value="__base__">[Base Class Features Only]</option>';
                            if (full.subclasses) {
                                full.subclasses.forEach((sc) => {
                                    if (!isSourceAllowed(sc.source, sc.name, disabledSourcesCache)) return;
                                    const badge = getDisplaySourceBadge(sc.source);
                                    const tag = badge ? ` [${badge}]` : '';
                                    subOpts += `<option value="${sc.shortName}">${sc.name}${tag}</option>`;
                                });
                            }
                            subSel.innerHTML = subOpts;
                            subSel.disabled = false;
                            renderImportFeatureList();
                            return;
                        }
                    } catch (e) {}
                }
            }

            const file = builderCache?.classIndex ? builderCache.classIndex[rawClassName.toLowerCase()] : null;
            if (!file) {
                renderImportFeatureList();
                return;
            }

            fetch(`data/class/${file}`)
                .then((r) => r.json())
                .then((data) => {
                    currentImportData = [];
                    if (data.classFeature) {
                        data.classFeature.forEach((f) => {
                            f.className = rawClassName;
                            currentImportData.push(f);
                        });
                    }
                    if (data.subclassFeature) {
                        data.subclassFeature.forEach((f) => {
                            f.className = rawClassName;
                            currentImportData.push(f);
                        });
                    }

                    let subOpts = '<option value="">-- All Subclasses --</option>';
                    subOpts += '<option value="__base__">[Base Class Features Only]</option>';
                    if (data.subclass) {
                        const seen = new Set();
                        data.subclass.forEach((sc) => {
                            if (!isSourceAllowed(sc.source, sc.name, disabledSourcesCache)) return;
                            if (!seen.has(sc.shortName)) {
                                seen.add(sc.shortName);
                                subOpts += `<option value="${sc.shortName}">${sc.name} [${sc.source}]</option>`;
                            }
                        });
                    }
                    subSel.innerHTML = subOpts;
                    subSel.disabled = false;
                    renderImportFeatureList();
                })
                .catch(() => {});
        });
    }

    function ensureAbilityModalsExist() {
        if (document.getElementById('pc-ability-modal')) return;

        const container = document.createElement('div');
        container.innerHTML = `
            <div id="pc-ability-overlay" class="vtt-sheet-submodal-overlay vtt-hidden"></div>
            <div id="pc-ability-modal" class="vtt-sheet-submodal vtt-hidden" style="width:480px; padding:16px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                    <h3 style="margin:0; color:var(--color-gold-base);"><i class="fa-solid fa-address-card"></i> Ability Card</h3>
                    <div style="display:flex; gap:8px;">
                        <button class="btn btn-sm btn-secondary active" id="tab-btn-manual" style="border-radius:4px;">Manual Entry</button>
                        <button class="btn btn-sm btn-secondary" id="tab-btn-import" style="border-radius:4px;"><i class="fa-solid fa-cloud-arrow-down"></i> Import Features</button>
                    </div>
                </div>
                
                <input type="hidden" id="modal-ability-idx" value="-1">
                
                <!-- MANUAL ENTRY TAB -->
                <div id="modal-tab-manual">
                    <div style="display:flex; gap:8px; margin-bottom:8px;">
                        <div class="form-group" style="flex:2;">
                            <label>Name</label>
                            <input type="text" id="modal-ability-name" style="width:100%;">
                        </div>
                        <div class="form-group" style="flex:1;">
                            <label>Action Economy</label>
                            <select id="modal-ability-action-type" style="width:100%; padding:4px; font-size:0.8rem; background:rgba(0,0,0,0.3); color:var(--color-text-primary); border:1px solid var(--color-border-subtle); border-radius:4px;">
                                <option value="passive">Passive</option>
                                <option value="action">Action</option>
                                <option value="bonus">Bonus Action</option>
                                <option value="reaction">Reaction</option>
                                <option value="special">Special</option>
                            </select>
                        </div>
                    </div>

                    <div class="form-group" style="margin-bottom:8px;">
                        <label>Category</label>
                        <select id="modal-ability-category" style="width:100%; padding:4px; font-size:0.8rem;">
                            <option value="">Uncategorized</option>
                        </select>
                    </div>

                    <div class="form-group" style="margin-bottom:8px;">
                        <label>Description</label>
                        <textarea id="modal-ability-desc" placeholder="Details of the ability..." style="width:100%; min-height:56px; resize:vertical; background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); padding:6px 8px; font-family:var(--font-primary); font-size:0.8rem; border-radius:4px; line-height:1.4;"></textarea>
                    </div>

                    <!-- FORMULA BUILDER SECTION -->
                    <div style="background:rgba(255,255,255,0.03); border:1px solid var(--color-border-subtle); border-radius:6px; padding:8px; margin-bottom:8px;">
                        <label style="font-weight:600; color:var(--color-gold-base); font-size:0.8rem; margin-bottom:6px; display:block;">
                            <i class="fa-solid fa-dice-d20"></i> Dice Formula Builder
                        </label>
                        <div style="display:flex; gap:6px; margin-bottom:6px;">
                            <div style="flex:1;">
                                <label style="font-size:0.7rem; color:var(--color-text-muted);">Base Dice</label>
                                <input type="text" id="modal-ability-base-dice" placeholder="e.g. 1d10, 2d6" style="width:100%; padding:4px; font-size:0.8rem; background:rgba(0,0,0,0.3); color:var(--color-text-primary); border:1px solid var(--color-border-subtle); border-radius:4px;">
                            </div>
                            <div style="flex:1.6;">
                                <label style="font-size:0.7rem; color:var(--color-text-muted);">Scaling Modifier</label>
                                <select id="modal-ability-scaling-mod" style="width:100%; padding:4px; font-size:0.8rem; background:rgba(0,0,0,0.3); color:var(--color-text-primary); border:1px solid var(--color-border-subtle); border-radius:4px;">
                                    <option value="none">None (+0)</option>
                                    <option value="level">Character Level (@level)</option>
                                    <option value="PB">Proficiency Bonus (@pb)</option>
                                    <option value="STR">STR Mod (@str)</option>
                                    <option value="DEX">DEX Mod (@dex)</option>
                                    <option value="CON">CON Mod (@con)</option>
                                    <option value="INT">INT Mod (@int)</option>
                                    <option value="WIS">WIS Mod (@wis)</option>
                                    <option value="CHA">CHA Mod (@cha)</option>
                                </select>
                            </div>
                            <div style="flex:0.8;">
                                <label style="font-size:0.7rem; color:var(--color-text-muted);">Extra Bonus</label>
                                <input type="number" id="modal-ability-extra-bonus" value="0" style="width:100%; padding:4px; font-size:0.8rem; text-align:center; background:rgba(0,0,0,0.3); color:var(--color-text-primary); border:1px solid var(--color-border-subtle); border-radius:4px;">
                            </div>
                        </div>
                        <div style="display:flex; gap:8px; align-items:flex-end;">
                            <div style="flex:1;">
                                <label style="font-size:0.7rem; color:var(--color-text-muted);">Formula String</label>
                                <input type="text" id="modal-ability-formula" placeholder="e.g. 1d10 + @classes.fighter.level" style="width:100%; padding:4px; font-size:0.8rem; background:rgba(0,0,0,0.3); color:var(--color-text-primary); border:1px solid var(--color-border-subtle); border-radius:4px;">
                            </div>
                            <div style="background:rgba(0,0,0,0.4); border:1px solid rgba(255,255,255,0.08); padding:4px 8px; border-radius:4px; min-width:110px; text-align:center;">
                                <span style="font-size:0.65rem; color:var(--color-text-muted); display:block;">Live Evaluation</span>
                                <span id="modal-ability-formula-preview" style="font-size:0.82rem; font-family:monospace; color:var(--color-gold-base); font-weight:bold;">None</span>
                            </div>
                        </div>
                    </div>

                    <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
                        <input type="checkbox" id="modal-ability-has-counter">
                        <label for="modal-ability-has-counter" style="margin:0; cursor:pointer; font-size:0.8rem;">Enable Resource Counter</label>
                    </div>

                    <div id="modal-ability-uses-container" style="display:flex; gap:8px; margin-bottom:8px; display:none;">
                        <div class="form-group" style="flex:1;">
                            <label>Current Uses</label>
                            <input type="number" id="modal-ability-uses-current" value="0" min="0" style="width:100%; padding:4px; font-size:0.8rem; text-align:center;">
                        </div>
                        <div class="form-group" style="flex:1;">
                            <label>Max Uses</label>
                            <input type="number" id="modal-ability-uses-max" value="0" min="0" style="width:100%; padding:4px; font-size:0.8rem; text-align:center;">
                        </div>
                        <div class="form-group" style="flex:1.2;">
                            <label>Reset On</label>
                            <select id="modal-ability-reset-type" style="width:100%; padding:4px; font-size:0.8rem; height:29px; background:rgba(0,0,0,0.3); color:var(--color-text-primary); border:1px solid var(--color-border-subtle); border-radius:4px;">
                                <option value="long">Long Rest</option>
                                <option value="short">Short Rest</option>
                                <option value="none">None / Manual</option>
                            </select>
                        </div>
                    </div>
                    
                    <div style="border-top:1px solid var(--color-border-subtle); padding-top:10px; margin-bottom:12px;">
                        <label style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                            Custom Fields
                            <button class="btn btn-xxs btn-secondary" id="modal-ability-add-field"><i class="fa-solid fa-plus"></i> Add Field</button>
                        </label>
                        <div id="modal-ability-fields-list" style="display:flex; flex-direction:column; gap:8px;"></div>
                    </div>

                    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:16px;">
                        <button class="btn btn-danger btn-sm" id="modal-ability-delete"><i class="fa-solid fa-trash"></i> Delete Card</button>
                        <div style="display:flex; gap:8px;">
                            <button class="btn btn-secondary btn-sm" id="modal-ability-cancel">Cancel</button>
                            <button class="btn btn-primary btn-sm" id="modal-ability-save"><i class="fa-solid fa-floppy-disk"></i> Save Card</button>
                        </div>
                    </div>
                </div>

                <!-- IMPORT FEATURE TAB -->
                <div id="modal-tab-import" class="vtt-hidden" style="display:flex; flex-direction:column; gap:8px;">
                    <div>
                        <select id="import-category-sel" style="width:100%; padding:4px; font-size:0.8rem; background:#2a2a2a; color:var(--color-text-primary); border:1px solid var(--color-border-subtle); border-radius:4px; margin-bottom:4px;">
                            <option value="class">Class Features</option>
                            <option value="feat">Feats</option>
                            <option value="race">Species</option>
                            <option value="background">Backgrounds</option>
                            <option value="charoption">Character Creation Options</option>
                            <option value="optionalfeature">Optional Features</option>
                        </select>
                    </div>
                    <div id="import-class-filters" style="display:flex; gap:8px;">
                        <select id="import-class-sel" style="flex:1; padding:4px; font-size:0.8rem; background:#2a2a2a; color:var(--color-text-primary); border:1px solid var(--color-border-subtle); border-radius:4px;">
                            <option value="">-- Loading Classes... --</option>
                        </select>
                        <select id="import-subclass-sel" style="flex:1; padding:4px; font-size:0.8rem; background:#2a2a2a; color:var(--color-text-primary); border:1px solid var(--color-border-subtle); border-radius:4px;" disabled>
                            <option value="">-- All Subclasses --</option>
                        </select>
                    </div>
                    <div id="import-optfeat-filters" style="display:none; gap:8px;">
                        <select id="import-optfeat-type-sel" style="flex:1; padding:4px; font-size:0.8rem; background:#2a2a2a; color:var(--color-text-primary); border:1px solid var(--color-border-subtle); border-radius:4px;">
                            <option value="">-- All Feature Types --</option>
                        </select>
                    </div>
                    <div style="display:flex; gap:6px; align-items:center;">
                        <input type="text" id="import-search" placeholder="Search features..." style="flex:1; padding:4px; font-size:0.8rem; background:#2a2a2a; color:var(--color-text-primary); border:1px solid var(--color-border-subtle); border-radius:4px;">
                        <div class="btn-group" id="import-edition-filter-group" style="display:inline-flex; border-radius:4px; overflow:hidden; border:1px solid var(--color-border-subtle); flex-shrink:0;">
                            <button type="button" class="btn btn-xxs import-filter-edition active" data-edition="all" style="padding:4px 8px; font-size:0.75rem; background:var(--color-gold-base); color:#000; font-weight:bold;">All</button>
                            <button type="button" class="btn btn-xxs import-filter-edition" data-edition="phb" style="padding:4px 8px; font-size:0.75rem; background:#2a2a2a; color:var(--color-text-secondary);">PHB</button>
                            <button type="button" class="btn btn-xxs import-filter-edition" data-edition="xphb" style="padding:4px 8px; font-size:0.75rem; background:#2a2a2a; color:var(--color-text-secondary);">XPHB</button>
                        </div>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.25); padding:6px 10px; border-radius:4px; border:1px solid rgba(255,255,255,0.05);">
                        <div style="display:flex; align-items:center; gap:6px;">
                            <input type="checkbox" id="import-select-all" style="cursor:pointer;">
                            <label for="import-select-all" style="margin:0; font-size:0.75rem; cursor:pointer; color:var(--color-text-muted);">Select All</label>
                        </div>
                        <button class="btn btn-xs btn-primary" id="btn-import-batch" disabled style="display:inline-flex; align-items:center; gap:4px;"><i class="fa-solid fa-file-import"></i> Import Selected (<span id="import-selected-count">0</span>)</button>
                    </div>
                    <div id="import-feature-list" style="flex:1; min-height:220px; max-height:320px; overflow-y:auto; background:rgba(0,0,0,0.2); border:1px solid var(--color-border-subtle); border-radius:4px; padding:8px; display:flex; flex-direction:column; gap:4px;">
                        <div style="text-align:center; color:var(--color-text-muted); font-size:0.8rem; margin-top:20px;">Select a class to browse features</div>
                    </div>
                </div>
            </div>

            <!-- IMPORT DESTINATION CATEGORY PROMPT MODAL -->
            <div id="pc-ability-import-cat-overlay" class="vtt-sheet-submodal-overlay vtt-sheet-submodal-high vtt-hidden"></div>
            <div id="pc-ability-import-cat-modal" class="vtt-sheet-submodal vtt-sheet-submodal-high vtt-hidden" style="width:380px; padding:16px;">
                <h4 style="margin:0; color:var(--color-gold-base); font-size:0.95rem; display:flex; align-items:center; gap:6px;"><i class="fa-solid fa-folder-tree"></i> Import Destination Category</h4>
                <div style="font-size:0.8rem; color:var(--color-text-secondary);" id="import-cat-modal-summary">Importing features to character.</div>
                <div class="form-group" style="display:flex; flex-direction:column; gap:4px;">
                    <label style="font-size:0.75rem; color:var(--color-text-muted);">Choose Category:</label>
                    <select id="import-cat-select" style="width:100%; padding:6px; font-size:0.82rem; background:#181818; color:var(--color-text-primary); border:1px solid var(--color-border-subtle); border-radius:4px;">
                    </select>
                    <input type="text" id="import-cat-new-name" placeholder="Enter new category name..." style="width:100%; padding:6px; font-size:0.82rem; background:#181818; color:var(--color-text-primary); border:1px solid var(--color-border-subtle); border-radius:4px; display:none; margin-top:4px;">
                </div>
                <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:4px;">
                    <button class="btn btn-secondary btn-sm" id="btn-import-cat-cancel">Cancel</button>
                    <button class="btn btn-primary btn-sm" id="btn-import-cat-confirm"><i class="fa-solid fa-check"></i> Import</button>
                </div>
            </div>
        `;
        document.body.appendChild(container);
        setupAbilityModalListeners();
    }

    function setupAbilityModalListeners() {
        document.getElementById('modal-ability-add-field')?.addEventListener('click', () => {
            const list = document.getElementById('modal-ability-fields-list');
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.gap = '8px';
            row.className = 'modal-ability-field-row';
            row.innerHTML = `
                <input type="text" class="ab-field-label" placeholder="Label" style="flex:1; padding:4px; font-size:0.8rem;">
                <input type="text" class="ab-field-entry" placeholder="Entry" style="flex:2; padding:4px; font-size:0.8rem;">
                <button class="btn btn-xxs btn-danger btn-ab-field-remove"><i class="fa-solid fa-trash"></i></button>
            `;
            row.querySelector('.btn-ab-field-remove').addEventListener('click', () => row.remove());
            list.appendChild(row);
        });

        // Formula builder change listeners
        ['modal-ability-base-dice', 'modal-ability-scaling-mod', 'modal-ability-extra-bonus'].forEach((id) => {
            document.getElementById(id)?.addEventListener('input', () => {
                if (currentChar) updateFormulaBuilderOutputs(currentChar);
            });
            document.getElementById(id)?.addEventListener('change', () => {
                if (currentChar) updateFormulaBuilderOutputs(currentChar);
            });
        });

        document.getElementById('modal-ability-formula')?.addEventListener('input', () => {
            if (currentChar) {
                const raw = document.getElementById('modal-ability-formula').value.trim();
                const evalFormula = evaluateAbilityFormula(raw, null, currentChar);
                const previewEl = document.getElementById('modal-ability-formula-preview');
                if (previewEl) previewEl.innerText = evalFormula || 'None';
            }
        });

        document.getElementById('modal-ability-has-counter')?.addEventListener('change', (e) => {
            const container = document.getElementById('modal-ability-uses-container');
            if (e.target.checked) {
                container.style.display = 'flex';
            } else {
                container.style.display = 'none';
            }
        });

        document.getElementById('modal-ability-save')?.addEventListener('click', () => {
            const char = currentChar;
            if (!char) return;
            const idx = parseInt(document.getElementById('modal-ability-idx').value);
            const name = document.getElementById('modal-ability-name').value.trim();
            if (!name) return alert('Ability Name is required.');
            const actionType = document.getElementById('modal-ability-action-type')?.value || 'passive';
            const categoryId = document.getElementById('modal-ability-category')?.value || null;
            const description = document.getElementById('modal-ability-desc').value.trim();

            const baseDice = (document.getElementById('modal-ability-base-dice')?.value || '').trim();
            const sc = document.getElementById('modal-ability-scaling-mod')?.value || 'none';
            let modClass = '';
            let scalingMod = sc;
            if (sc.startsWith('classLevel:')) {
                modClass = sc.replace('classLevel:', '');
                scalingMod = 'classLevel';
            }
            const extraBonus = parseInt(document.getElementById('modal-ability-extra-bonus')?.value) || 0;
            const formula = document.getElementById('modal-ability-formula').value.trim();
            const formulaConfig =
                baseDice || scalingMod !== 'none' || extraBonus !== 0
                    ? {
                          baseDice,
                          scalingMod,
                          modClass,
                          extraBonus
                      }
                    : null;

            const hasCounter = document.getElementById('modal-ability-has-counter').checked;
            const usesCurrent = parseInt(document.getElementById('modal-ability-uses-current').value) || 0;
            const usesMax = parseInt(document.getElementById('modal-ability-uses-max').value) || 0;
            const resetType = document.getElementById('modal-ability-reset-type')?.value || 'long';

            const customFields = [];
            document.querySelectorAll('.modal-ability-field-row').forEach((row) => {
                const label = row.querySelector('.ab-field-label').value.trim();
                const entry = row.querySelector('.ab-field-entry').value.trim();
                if (label || entry) customFields.push({ label, entry });
            });

            const ab = {
                id:
                    idx >= 0 && char.abilityCards && char.abilityCards[idx]
                        ? char.abilityCards[idx].id
                        : 'ab_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                name,
                actionType,
                categoryId,
                description,
                formula,
                formulaConfig,
                customFields,
                hasCounter,
                usesCurrent,
                usesMax,
                resetType
            };

            if (idx >= 0 && char.abilityCards && char.abilityCards[idx]) {
                char.abilityCards[idx] = ab;
            } else {
                if (!char.abilityCards) char.abilityCards = [];
                char.abilityCards.push(ab);
            }

            document.getElementById('pc-ability-modal').classList.add('vtt-hidden');
            document.getElementById('pc-ability-overlay').classList.add('vtt-hidden');
            saveAndEmit(char);
            renderSheetData(char);
        });

        document.getElementById('modal-ability-delete')?.addEventListener('click', () => {
            const char = currentChar;
            if (!char) return;
            const idx = parseInt(document.getElementById('modal-ability-idx').value);
            if (idx >= 0 && char.abilityCards && char.abilityCards[idx]) {
                if (confirm('Are you sure you want to delete this ability card?')) {
                    char.abilityCards.splice(idx, 1);
                    document.getElementById('pc-ability-modal').classList.add('vtt-hidden');
                    document.getElementById('pc-ability-overlay').classList.add('vtt-hidden');
                    saveAndEmit(char);
                    renderSheetData(char);
                }
            } else {
                document.getElementById('pc-ability-modal').classList.add('vtt-hidden');
                document.getElementById('pc-ability-overlay').classList.add('vtt-hidden');
            }
        });

        document.getElementById('modal-ability-cancel')?.addEventListener('click', () => {
            selectedImportFeatures.clear();
            updateImportBatchButton();
            document.getElementById('pc-ability-modal').classList.add('vtt-hidden');
            document.getElementById('pc-ability-overlay').classList.add('vtt-hidden');
        });

        document.getElementById('pc-ability-overlay')?.addEventListener('click', () => {
            selectedImportFeatures.clear();
            updateImportBatchButton();
            document.getElementById('pc-ability-modal').classList.add('vtt-hidden');
            document.getElementById('pc-ability-overlay').classList.add('vtt-hidden');
        });

        // Tab switching
        document.getElementById('tab-btn-manual')?.addEventListener('click', () => switchModalTab('manual'));
        document.getElementById('tab-btn-import')?.addEventListener('click', () => switchModalTab('import'));

        // Import filters
        document.getElementById('import-search')?.addEventListener('input', renderImportFeatureList);
        document.getElementById('import-subclass-sel')?.addEventListener('change', renderImportFeatureList);
        document.getElementById('import-optfeat-type-sel')?.addEventListener('change', renderImportFeatureList);

        document.getElementById('import-category-sel')?.addEventListener('change', (e) => {
            currentCategory = e.target.value;
            selectedImportFeatures.clear();
            updateImportBatchButton();
            const classFilters = document.getElementById('import-class-filters');
            const optfeatFilters = document.getElementById('import-optfeat-filters');
            currentImportData = [];
            const searchInput = document.getElementById('import-search');
            if (searchInput) searchInput.value = '';

            if (currentCategory === 'class') {
                if (classFilters) classFilters.style.display = 'flex';
                if (optfeatFilters) optfeatFilters.style.display = 'none';
                const classSel = document.getElementById('import-class-sel');
                if (classSel) classSel.value = '';
                const subSel = document.getElementById('import-subclass-sel');
                if (subSel) {
                    subSel.innerHTML = '<option value="">-- All Subclasses --</option>';
                    subSel.disabled = true;
                }
                renderImportFeatureList();
            } else {
                if (classFilters) classFilters.style.display = 'none';
                if (optfeatFilters)
                    optfeatFilters.style.display = currentCategory === 'optionalfeature' ? 'flex' : 'none';
                let file = '';
                let key = '';
                let fallback = '';
                if (currentCategory === 'feat') {
                    file = 'data/feats-catalog.json';
                    key = 'feat';
                    fallback = 'data/feats.json';
                }
                if (currentCategory === 'race') {
                    file = 'data/races-catalog.json';
                    key = 'race';
                    fallback = 'data/races.json';
                }
                if (currentCategory === 'background') {
                    file = 'data/backgrounds-catalog.json';
                    key = 'background';
                    fallback = 'data/backgrounds.json';
                }
                if (currentCategory === 'charoption') {
                    file = 'data/charcreationoptions.json';
                    key = 'charoption';
                }
                if (currentCategory === 'optionalfeature') {
                    file = '/api/compendium/optionalfeatures/catalog';
                    key = 'optionalfeature';
                    fallback = 'data/optionalfeatures-catalog.json';
                }

                const listEl = document.getElementById('import-feature-list');
                if (listEl)
                    listEl.innerHTML =
                        '<div style="text-align:center; color:var(--color-text-muted); font-size:0.8rem; margin-top:20px;">Loading...</div>';

                fetch(file)
                    .then((r) => {
                        if (!r.ok) throw new Error('Not found');
                        return r.json();
                    })
                    .then((data) => {
                        currentImportData = Array.isArray(data) ? data : data[key] || [];
                        if (currentCategory === 'optionalfeature') {
                            populateOptFeatureTypeDropdown(currentImportData);
                        }
                        renderImportFeatureList();
                    })
                    .catch(() => {
                        if (fallback) {
                            fetch(fallback)
                                .then((r) => r.json())
                                .then((data) => {
                                    currentImportData = Array.isArray(data) ? data : data[key] || [];
                                    if (currentCategory === 'optionalfeature') {
                                        populateOptFeatureTypeDropdown(currentImportData);
                                    }
                                    renderImportFeatureList();
                                })
                                .catch(() => {
                                    if (listEl)
                                        listEl.innerHTML =
                                            '<div style="text-align:center; color:var(--color-error); font-size:0.8rem; margin-top:20px;">Failed to load data</div>';
                                });
                        } else {
                            if (listEl)
                                listEl.innerHTML =
                                    '<div style="text-align:center; color:var(--color-error); font-size:0.8rem; margin-top:20px;">Failed to load data</div>';
                        }
                    });
            }
        });

        // Edition filter buttons & search listener in Import tab
        document.querySelectorAll('.import-filter-edition').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.import-filter-edition').forEach((b) => {
                    b.classList.remove('active');
                    b.style.background = '#2a2a2a';
                    b.style.color = 'var(--color-text-secondary)';
                    b.style.fontWeight = 'normal';
                });
                const t = e.currentTarget;
                t.classList.add('active');
                t.style.background = 'var(--color-gold-base)';
                t.style.color = '#000';
                t.style.fontWeight = 'bold';
                window.activeImportEditionFilter = t.dataset.edition || 'all';
                renderImportFeatureList();
            });
        });

        document.getElementById('import-search')?.addEventListener('input', () => {
            renderImportFeatureList();
        });

        // Batch selection
        document.getElementById('import-select-all')?.addEventListener('change', (e) => {
            const listEl = document.getElementById('import-feature-list');
            if (!listEl) return;
            const chks = listEl.querySelectorAll('.import-feature-chk');
            chks.forEach((chk) => {
                chk.checked = e.target.checked;
                const idx = parseInt(chk.dataset.idx);
                const f = availableFeatures[idx];
                if (f) {
                    const key = chk.dataset.key || getFeatureKey(f);
                    if (e.target.checked) {
                        selectedImportFeatures.set(key, f);
                    } else {
                        selectedImportFeatures.delete(key);
                    }
                }
            });
            updateImportBatchButton();
        });

        document.getElementById('btn-import-batch')?.addEventListener('click', () => {
            const selectedFeatures = Array.from(selectedImportFeatures.values());
            if (selectedFeatures.length === 0) return;
            if (
                selectedFeatures.length === 1 &&
                (currentCategory === 'background' ||
                    selectedFeatures[0].skillsData ||
                    selectedFeatures[0].toolsData ||
                    selectedFeatures[0].equipmentData)
            ) {
                promptBackgroundImportModal(selectedFeatures[0], currentChar);
                return;
            }
            const defaultCat = getSuggestedCategoryName(selectedFeatures);
            promptImportDestinationCategory(selectedFeatures, defaultCat);
        });

        // Category modal listeners
        document.getElementById('import-cat-select')?.addEventListener('change', (e) => {
            const newNameInput = document.getElementById('import-cat-new-name');
            if (newNameInput) {
                newNameInput.style.display = e.target.value === '__new__' ? 'block' : 'none';
                if (e.target.value === '__new__') newNameInput.focus();
            }
        });

        document.getElementById('btn-import-cat-cancel')?.addEventListener('click', () => {
            selectedImportFeatures.clear();
            updateImportBatchButton();
            document.getElementById('pc-ability-import-cat-modal').classList.add('vtt-hidden');
            document.getElementById('pc-ability-import-cat-overlay').classList.add('vtt-hidden');
        });

        document.getElementById('pc-ability-import-cat-overlay')?.addEventListener('click', () => {
            selectedImportFeatures.clear();
            updateImportBatchButton();
            document.getElementById('pc-ability-import-cat-modal').classList.add('vtt-hidden');
            document.getElementById('pc-ability-import-cat-overlay').classList.add('vtt-hidden');
        });

        document.getElementById('btn-import-cat-confirm')?.addEventListener('click', () => {
            const char = currentChar;
            if (!char || pendingImportFeatures.length === 0) return;

            const sel = document.getElementById('import-cat-select');
            const newNameInput = document.getElementById('import-cat-new-name');
            const selVal = sel ? sel.value : '__uncategorized__';

            let targetCatId = null;
            if (selVal === '__new__') {
                const catName = (newNameInput ? newNameInput.value.trim() : '') || 'Imported Features';
                if (!char.abilityCategories) char.abilityCategories = [];
                let existing = char.abilityCategories.find((c) => c.name.toLowerCase() === catName.toLowerCase());
                if (existing) {
                    targetCatId = existing.id;
                } else {
                    targetCatId = 'cat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
                    char.abilityCategories.push({
                        id: targetCatId,
                        name: catName,
                        collapsed: false
                    });
                }
            } else if (selVal !== '__uncategorized__') {
                targetCatId = selVal;
            }

            if (!char.abilityCards) char.abilityCards = [];

            pendingImportFeatures.forEach((f, i) => {
                // If item is a Species with pre-unpacked traits in database, unpack into separate cards
                if (Array.isArray(f.traits) && f.traits.length > 0) {
                    if (f.speeds) {
                        char.speed = {
                            walk: f.speeds.walk !== undefined ? f.speeds.walk : 30,
                            fly: f.speeds.fly || 0,
                            swim: f.speeds.swim || 0,
                            climb: f.speeds.climb || 0,
                            burrow: f.speeds.burrow || 0
                        };
                    }
                    if (f.senses) {
                        char.senses = {
                            darkvision: f.senses.darkvision || 0,
                            blindsight: f.senses.blindsight || 0,
                            truesight: f.senses.truesight || 0,
                            devilSight: f.senses.devilSight || 0
                        };
                    }
                    if (f.size) char.size = f.size;
                    char.race = f.name;

                    f.traits.forEach((t, ti) => {
                        const desc = (t.description || '').trim();
                        const actionType = t.actionType || 'passive';
                        const hasCounter = t.hasCounter || false;
                        const usesMax = t.usesMax || null;
                        const resetType = t.resetType || 'short';
                        const resolvedMax = hasCounter ? evaluateAbilityMaxUses(usesMax, char) : 0;
                        const formula = t.formula || '';
                        const formulaConfig = t.formulaConfig || null;

                        char.abilityCards.push({
                            id: 'ab_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4) + '_' + i + '_' + ti,
                            name: t.name || `${f.name} Trait`,
                            actionType,
                            categoryId: targetCatId,
                            description: desc,
                            formula,
                            formulaConfig,
                            customFields: [],
                            hasCounter,
                            usesCurrent: resolvedMax,
                            usesMax: resolvedMax,
                            resetType
                        });
                    });
                } else if (f.skillsData || f.toolsData || f.equipmentData) {
                    // Background imported via multi-batch category prompt
                    char.background = char.background || f.name;
                    const appliedSkills = [];
                    if (f.skillsData && f.skillsData.fixed) {
                        char.skills = char.skills || {};
                        f.skillsData.fixed.forEach((s) => {
                            const norm = normalizeSkill(s);
                            if (norm) {
                                char.skills[norm] = true;
                                appliedSkills.push(norm);
                            }
                        });
                    }
                    const appliedTools = [];
                    if (f.toolsData && f.toolsData.fixed) {
                        char.tools = char.tools || {};
                        f.toolsData.fixed.forEach((t) => {
                            const norm = normalizeTool(t);
                            if (norm) {
                                const defTool = STANDARD_TOOLS.find(
                                    (st) => st.name.toLowerCase() === norm.toLowerCase()
                                );
                                const ab = defTool ? defTool.ability : 'dex';
                                char.tools[norm] = {
                                    ability: ab,
                                    show: true,
                                    prof: true,
                                    exp: false,
                                    mod: '0',
                                    custom: !defTool
                                };
                                appliedTools.push(norm);
                            }
                        });
                    }
                    const appliedItems = [];
                    let addedGold = 0;
                    if (f.equipmentData) {
                        char.equipment = Array.isArray(char.equipment) ? char.equipment : [];
                        char.currency = char.currency || { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };
                        if (f.equipmentData.fixedGold) {
                            addedGold = f.equipmentData.fixedGold;
                            char.currency.gp = (char.currency.gp || 0) + addedGold;
                        }
                        if (Array.isArray(f.equipmentData.fixedItems)) {
                            f.equipmentData.fixedItems.forEach((it) => {
                                const itemName = it.name ? it.name.trim() : 'Item';
                                const itemQty = parseInt(it.quantity) || 1;
                                char.equipment.push({
                                    id: 'eq_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                                    name: itemName.charAt(0).toUpperCase() + itemName.slice(1),
                                    qty: itemQty,
                                    weight: parseFloat(it.weight) || 0,
                                    containerId: null,
                                    description: ''
                                });
                                appliedItems.push(itemQty > 1 ? `${itemQty}x ${itemName}` : itemName);
                            });
                        }
                    }

                    // Card 1: Feature cards
                    const bgFeatures =
                        Array.isArray(f.features) && f.features.length > 0
                            ? f.features
                            : [{ name: `Feature: ${f.name}`, description: f.description || '' }];
                    bgFeatures.forEach((feat, fi) => {
                        char.abilityCards.push({
                            id: 'ab_bg_feat_' + Date.now() + '_' + i + '_' + fi,
                            name: feat.name || `Feature: ${f.name}`,
                            actionType: 'passive',
                            categoryId: targetCatId,
                            description: feat.description || '',
                            formula: '',
                            formulaConfig: null,
                            customFields: [],
                            hasCounter: false,
                            usesCurrent: 0,
                            usesMax: 0,
                            resetType: 'none'
                        });
                    });

                    // Card 2: Summary card
                    let summaryDesc = `**Background:** ${f.name} [${f.source || 'PHB'}]\n\n`;
                    summaryDesc += `**Skill Proficiencies:** ${appliedSkills.length > 0 ? appliedSkills.join(', ') : 'None'}\n`;
                    summaryDesc += `**Tool Proficiencies:** ${appliedTools.length > 0 ? appliedTools.join(', ') : 'None'}\n`;
                    if (f.languages) summaryDesc += `**Languages:** ${f.languages}\n`;
                    summaryDesc += `**Starting Equipment:** ${appliedItems.length > 0 ? appliedItems.join(', ') : 'None'} (${addedGold} gp)\n\n`;
                    if (f.description) {
                        const cleanDesc = f.description
                            .replace(/^#+\s+/gm, '')
                            .trim()
                            .slice(0, 500);
                        summaryDesc += cleanDesc + (f.description.length > 500 ? '...' : '');
                    }

                    char.abilityCards.push({
                        id: 'ab_bg_summary_' + Date.now() + '_' + i,
                        name: `Background: ${f.name}`,
                        actionType: 'passive',
                        categoryId: targetCatId,
                        description: summaryDesc,
                        formula: '',
                        formulaConfig: null,
                        customFields: [],
                        hasCounter: false,
                        usesCurrent: 0,
                        usesMax: 0,
                        resetType: 'none'
                    });
                } else {
                    // Regular single feature / feat / background
                    let desc = getFeatureDescriptionText(f);

                    const counterInfo = detectFeatureCounter(f, desc, char);
                    let hasCounter = counterInfo.hasCounter;
                    let usesMax = counterInfo.usesMax;
                    let resetType = counterInfo.resetType;

                    let resolvedMax = 0;
                    let resolvedCurrent = 0;
                    if (hasCounter) {
                        resolvedMax = evaluateAbilityMaxUses(usesMax, char);
                        resolvedCurrent = resolvedMax;
                    }

                    let actionType = f.actionType || 'passive';
                    if (!f.actionType) {
                        const plain = ((f.name || '') + ' ' + desc).toLowerCase();
                        if (plain.includes('bonus action')) actionType = 'bonus';
                        else if (plain.includes('reaction')) actionType = 'reaction';
                        else if (plain.includes('as an action') || plain.includes('action to')) actionType = 'action';
                    }

                    let formula = f.formula || '';
                    let formulaConfig = f.formulaConfig || null;

                    // Handle Half-Feat Ability Score Increases & Saving Throws
                    if (f.isHalfFeat && f.abilityBonus) {
                        let statKey = '';
                        const chooseList = f.abilityBonus.chooseFrom || f.abilityBonus.choose;
                        if (Array.isArray(chooseList) && chooseList.length > 0) {
                            statKey = chooseList[0];
                        } else if (f.abilityBonus.fixed) {
                            statKey = Object.keys(f.abilityBonus.fixed)[0];
                        }
                        if (statKey) {
                            char.stats = char.stats || { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
                            char.stats[statKey] = (parseInt(char.stats[statKey]) || 10) + 1;
                            if (f.linkedSaveProficiency) {
                                char.saves = char.saves || {};
                                char.saves[f.linkedSaveProficiency] = true;
                            }
                        }
                    }

                    const rawName = f.name || 'Untitled Ability';
                    const badge = getDisplaySourceBadge(f.source);
                    const tag = badge ? ` [${badge}]` : f.source ? ` [${f.source}]` : '';
                    const cardName =
                        badge && !rawName.includes('[') && !rawName.includes(badge) ? `${rawName}${tag}` : rawName;

                    char.abilityCards.push({
                        id: 'ab_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4) + '_' + i,
                        name: cardName,
                        actionType,
                        categoryId: targetCatId,
                        description: desc,
                        formula,
                        formulaConfig,
                        customFields: [],
                        hasCounter,
                        usesCurrent: resolvedCurrent,
                        usesMax: resolvedMax,
                        resetType
                    });
                }
            });

            selectedImportFeatures.clear();
            updateImportBatchButton();

            document.getElementById('pc-ability-import-cat-modal').classList.add('vtt-hidden');
            document.getElementById('pc-ability-import-cat-overlay').classList.add('vtt-hidden');
            document.getElementById('pc-ability-modal').classList.add('vtt-hidden');
            document.getElementById('pc-ability-overlay').classList.add('vtt-hidden');

            pendingImportFeatures = [];
            saveAndEmit(char);
            renderSheetData(char);
        });
    }

    // Leftover sets removed

    // Save toggles managed via player-sheet/modals/settings-modal.js

    let modalDamageRows = [];
    let _initialMacroSnapshot = '';

    function updateMacroModalVisibility() {
        const atkStat = document.getElementById('modal-macro-atk-stat')?.value || 'none';
        const atkCustomContainer = document.getElementById('modal-macro-atk-custom-container');
        if (atkCustomContainer) {
            if (atkStat === 'custom') {
                atkCustomContainer.classList.remove('vtt-hidden');
            } else {
                atkCustomContainer.classList.add('vtt-hidden');
            }
        }

        const dcStat = document.getElementById('modal-macro-save-dc-stat')?.value || 'none';
        const dcCustomContainer = document.getElementById('modal-macro-save-dc-custom-container');
        const dcExtraContainer = document.getElementById('modal-macro-save-dc-extra-container');
        if (dcCustomContainer && dcExtraContainer) {
            if (dcStat === 'custom') {
                dcCustomContainer.classList.remove('vtt-hidden');
                dcExtraContainer.classList.add('vtt-hidden');
            } else {
                dcCustomContainer.classList.add('vtt-hidden');
                dcExtraContainer.classList.remove('vtt-hidden');
            }
        }
    }

    function renderModalDamage() {
        const list = document.getElementById('modal-macro-dmg-list');
        if (!list) return;
        const dmgTypes = [
            'Slashing',
            'Piercing',
            'Bludgeoning',
            'Fire',
            'Cold',
            'Lightning',
            'Thunder',
            'Poison',
            'Acid',
            'Necrotic',
            'Radiant',
            'Force',
            'Psychic',
            'Healing'
        ];
        list.innerHTML = modalDamageRows
            .map((d, i) => {
                const rawMod =
                    d.custom !== undefined && d.custom !== ''
                        ? d.custom
                        : d.extra && parseInt(d.extra)
                          ? parseInt(d.extra) > 0
                              ? '+' + d.extra
                              : String(d.extra)
                          : '';
                return `
            <div style="display:flex; flex-direction:column; gap:4px; padding:6px; background:rgba(0,0,0,0.25); border:1px solid rgba(255,255,255,0.06); border-radius:4px; margin-bottom:6px;">
                <div style="display:flex; gap:4px; align-items:center;">
                    <input type="text" class="modal-dmg-formula" data-idx="${i}" value="${d.formula || d.dice || ''}" placeholder="1d8" title="Base Dice Formula (e.g. 1d8)" style="width:26%; padding:4px; font-size:0.8rem;">
                    <select class="modal-dmg-stat" data-idx="${i}" title="Ability Modifier" style="width:23%; padding:4px; font-size:0.8rem;">
                        <option value="">+ None</option>
                        <option value="str" ${d.stat === 'str' ? 'selected' : ''}>+ STR</option>
                        <option value="dex" ${d.stat === 'dex' ? 'selected' : ''}>+ DEX</option>
                        <option value="con" ${d.stat === 'con' ? 'selected' : ''}>+ CON</option>
                        <option value="int" ${d.stat === 'int' ? 'selected' : ''}>+ INT</option>
                        <option value="wis" ${d.stat === 'wis' ? 'selected' : ''}>+ WIS</option>
                        <option value="cha" ${d.stat === 'cha' ? 'selected' : ''}>+ CHA</option>
                    </select>
                    <input type="text" class="modal-dmg-mod" data-idx="${i}" value="${rawMod}" placeholder="+Mod" title="Custom Modifier (e.g. +2, -1, +1d4)" style="width:20%; padding:4px; font-size:0.8rem; text-align:center;">
                    <select class="modal-dmg-type" data-idx="${i}" title="Damage Type" style="width:27%; padding:4px; font-size:0.8rem;">
                        ${dmgTypes.map((t) => `<option value="${t}" ${(d.type || '').toLowerCase() === t.toLowerCase() ? 'selected' : ''}>${t}</option>`).join('')}
                    </select>
                    <button class="btn btn-xxs btn-danger modal-dmg-del" data-idx="${i}" title="Remove Damage Row" style="flex-shrink:0;"><i class="fa-solid fa-trash"></i></button>
                </div>
                <div>
                    <input type="text" class="modal-dmg-label" data-idx="${i}" value="${d.label || ''}" placeholder="Label (optional, e.g. vs Undead, Sneak Attack)" title="Damage Label" style="width:100%; padding:3px 6px; font-size:0.75rem; background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.06); border-radius:3px; color:var(--color-text-secondary);">
                </div>
            </div>
        `;
            })
            .join('');

        document.querySelectorAll('.modal-dmg-formula').forEach((el) => {
            el.addEventListener('input', (e) => {
                if (modalDamageRows[e.target.dataset.idx])
                    modalDamageRows[e.target.dataset.idx].formula = e.target.value;
            });
            el.addEventListener('change', (e) => {
                if (modalDamageRows[e.target.dataset.idx])
                    modalDamageRows[e.target.dataset.idx].formula = e.target.value;
            });
        });
        document.querySelectorAll('.modal-dmg-stat').forEach((el) =>
            el.addEventListener('change', (e) => {
                if (modalDamageRows[e.target.dataset.idx]) modalDamageRows[e.target.dataset.idx].stat = e.target.value;
            })
        );
        document.querySelectorAll('.modal-dmg-mod').forEach((el) => {
            el.addEventListener('input', (e) => {
                const row = modalDamageRows[e.target.dataset.idx];
                if (row) {
                    row.custom = e.target.value;
                    const parsed = parseInt(e.target.value);
                    row.extra = !isNaN(parsed) ? parsed : 0;
                }
            });
            el.addEventListener('change', (e) => {
                const row = modalDamageRows[e.target.dataset.idx];
                if (row) {
                    row.custom = e.target.value;
                    const parsed = parseInt(e.target.value);
                    row.extra = !isNaN(parsed) ? parsed : 0;
                }
            });
        });
        document.querySelectorAll('.modal-dmg-type').forEach((el) =>
            el.addEventListener('change', (e) => {
                if (modalDamageRows[e.target.dataset.idx]) modalDamageRows[e.target.dataset.idx].type = e.target.value;
            })
        );
        document.querySelectorAll('.modal-dmg-label').forEach((el) => {
            el.addEventListener('input', (e) => {
                if (modalDamageRows[e.target.dataset.idx]) modalDamageRows[e.target.dataset.idx].label = e.target.value;
            });
            el.addEventListener('change', (e) => {
                if (modalDamageRows[e.target.dataset.idx]) modalDamageRows[e.target.dataset.idx].label = e.target.value;
            });
        });
        document.querySelectorAll('.modal-dmg-del').forEach((el) =>
            el.addEventListener('click', (e) => {
                modalDamageRows.splice(e.currentTarget.dataset.idx, 1);
                renderModalDamage();
            })
        );
    }

    function getMacroModalSnapshot() {
        const m = document.getElementById('pc-macro-modal');
        if (!m) return '';
        const inputs = Array.from(
            m.querySelectorAll('input:not([type="button"]):not([type="submit"]):not([type="reset"]), select, textarea')
        ).map((el) => {
            if (el.type === 'checkbox') return el.checked;
            return el.value;
        });
        return JSON.stringify(inputs);
    }

    function ensureMacroModalExists() {
        if (document.getElementById('pc-macro-modal')) return;

        const container = document.createElement('div');
        container.id = 'pc-macro-modal-container';
        container.innerHTML = `
            <div id="pc-macro-overlay" class="vtt-sheet-submodal-overlay vtt-hidden" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); z-index:3000;"></div>
            <div id="pc-macro-modal" class="vtt-sheet-submodal vtt-hidden" style="position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); background:#1e1e1e; border:1px solid var(--color-border-subtle); padding:16px; border-radius:8px; z-index:3010; width:450px; max-width:94vw; max-height:85vh; overflow-y:auto; box-shadow:0 4px 16px rgba(0,0,0,0.6);">
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--color-border-subtle); padding-bottom:10px; margin-bottom:12px;">
                    <h3 style="margin:0; color:var(--color-gold-base); font-size:1.05rem;" id="modal-macro-title"><i class="fa-solid fa-dice-d20"></i> Edit Macro</h3>
                    <button id="modal-macro-close-btn" style="background:transparent; border:none; color:var(--color-text-muted); cursor:pointer; font-size:1.2rem;"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <input type="hidden" id="modal-macro-idx" value="-1">
                <div class="form-group" style="margin-bottom:8px;">
                    <label>Name</label>
                    <input type="text" id="modal-macro-name" style="width:100%;">
                </div>
                <div class="form-group" style="margin-bottom:8px;">
                    <label>Category</label>
                    <select id="modal-macro-category" style="width:100%; padding:4px; font-size:0.8rem;">
                        <option value="">Uncategorized</option>
                    </select>
                </div>
                <div class="form-group" style="margin-bottom:8px;">
                    <label>Description <span style="font-size:0.7rem; color:var(--color-text-muted); font-weight:400;">(Optional — shown at top of ping card)</span></label>
                    <textarea id="modal-macro-desc" placeholder="Flavor text, weapon range, special notes..." style="width:100%; min-height:56px; resize:vertical; background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); padding:6px 8px; font-family:var(--font-primary); font-size:0.8rem; border-radius:4px; line-height:1.4;"></textarea>
                </div>
                <div style="display:flex; gap:8px; margin-bottom:8px;">
                    <div class="form-group" style="flex:1;">
                        <label>Range</label>
                        <input type="text" id="modal-macro-range" placeholder="e.g. 60 ft, 5 ft, Self" style="width:100%; padding:4px; font-size:0.8rem;">
                    </div>
                    <div class="form-group" style="flex:1;">
                        <label>Target</label>
                        <input type="text" id="modal-macro-target" placeholder="e.g. 1 creature" style="width:100%; padding:4px; font-size:0.8rem;">
                    </div>
                </div>
                <div style="border-top:1px solid var(--color-border-subtle); padding-top:10px; margin-bottom:12px;">
                    <h4 style="margin:0 0 8px 0; color:var(--color-gold-base); font-size:0.85rem; font-family:var(--font-heading);">Attack Configuration</h4>
                    <div style="display:flex; gap:8px; align-items:center; margin-bottom:8px;">
                        <div class="form-group" style="flex:1.5;">
                            <label style="font-size:0.7rem;">Attack Stat</label>
                            <select id="modal-macro-atk-stat" style="width:100%; padding:4px; font-size:0.8rem;">
                                <option value="none">None (No Attack)</option>
                                <option value="str">STR</option>
                                <option value="dex">DEX</option>
                                <option value="con">CON</option>
                                <option value="int">INT</option>
                                <option value="wis">WIS</option>
                                <option value="cha">CHA</option>
                                <option value="custom">Custom</option>
                            </select>
                        </div>
                        <div class="form-group" style="flex:1; display:flex; flex-direction:column; align-items:center;">
                            <label style="font-size:0.7rem; margin-bottom:4px;">Add Prof</label>
                            <input type="checkbox" id="modal-macro-atk-prof" style="cursor:pointer; width:16px; height:16px;">
                        </div>
                        <div class="form-group" style="flex:1;">
                            <label style="font-size:0.7rem;">Extra Mod</label>
                            <input type="number" id="modal-macro-atk-extra" value="0" style="width:100%; text-align:center; padding:4px; font-size:0.8rem;">
                        </div>
                        <div class="form-group" style="flex:1;">
                            <label style="font-size:0.7rem;">Crit Range</label>
                            <input type="number" id="modal-macro-crit-range" value="20" min="2" max="20" style="width:100%; text-align:center; padding:4px; font-size:0.8rem;">
                        </div>
                    </div>
                    <div class="form-group" id="modal-macro-atk-custom-container" style="margin-bottom:8px;">
                        <label style="font-size:0.7rem;">Custom Attack Formula / Bonus</label>
                        <input type="text" id="modal-macro-atk" placeholder="e.g. +5 or 1d20+5" style="width:100%; padding:4px; font-size:0.8rem;">
                    </div>
                    <div style="display:flex; gap:12px; align-items:center; margin-bottom:8px; padding:6px 8px; background:rgba(0,0,0,0.25); border:1px solid rgba(255,255,255,0.06); border-radius:4px;">
                        <span style="font-size:0.75rem; color:var(--color-gold-light); font-weight:600;">Attack Bypasses:</span>
                        <label style="font-size:0.75rem; display:flex; align-items:center; gap:4px; cursor:pointer;" title="Attack counts as magical for overcoming damage resistance">
                            <input type="checkbox" id="modal-macro-is-magic" style="cursor:pointer;"> Magical
                        </label>
                        <label style="font-size:0.75rem; display:flex; align-items:center; gap:4px; cursor:pointer;" title="Attack is made with a silvered weapon">
                            <input type="checkbox" id="modal-macro-is-silvered" style="cursor:pointer;"> Silvered
                        </label>
                        <label style="font-size:0.75rem; display:flex; align-items:center; gap:4px; cursor:pointer;" title="Attack is made with an adamantine weapon">
                            <input type="checkbox" id="modal-macro-is-adamantine" style="cursor:pointer;"> Adamantine
                        </label>
                    </div>
                </div>

                <div style="border-top:1px solid var(--color-border-subtle); padding-top:10px; margin-bottom:12px;">
                    <h4 style="margin:0 0 8px 0; color:var(--color-gold-base); font-size:0.85rem; font-family:var(--font-heading);">Save DC Configuration</h4>
                    <div style="display:flex; gap:8px; margin-bottom:8px;">
                        <div class="form-group" style="flex:1.5;">
                            <label style="font-size:0.7rem;">Target Save Stat</label>
                            <select id="modal-macro-save-ab" style="width:100%; padding:4px; font-size:0.8rem;">
                                <option value="">None (No Save)</option>
                                <option value="STR">STR</option>
                                <option value="DEX">DEX</option>
                                <option value="CON">CON</option>
                                <option value="INT">INT</option>
                                <option value="WIS">WIS</option>
                                <option value="CHA">CHA</option>
                            </select>
                        </div>
                        <div class="form-group" style="flex:1.5;">
                            <label style="font-size:0.7rem;">DC Ability Stat</label>
                            <select id="modal-macro-save-dc-stat" style="width:100%; padding:4px; font-size:0.8rem;">
                                <option value="none">Default (Sheet Stat)</option>
                                <option value="str">STR</option>
                                <option value="dex">DEX</option>
                                <option value="con">CON</option>
                                <option value="int">INT</option>
                                <option value="wis">WIS</option>
                                <option value="cha">CHA</option>
                                <option value="custom">Custom DC</option>
                            </select>
                        </div>
                    </div>
                    <div style="display:flex; gap:8px; align-items:center; margin-bottom:4px;">
                        <div class="form-group" style="flex:1;" id="modal-macro-save-dc-extra-container">
                            <label style="font-size:0.7rem;">Extra DC Mod</label>
                            <input type="number" id="modal-macro-save-dc-extra" value="0" style="width:100%; text-align:center; padding:4px; font-size:0.8rem;">
                        </div>
                        <div class="form-group" style="flex:1;" id="modal-macro-save-dc-custom-container">
                            <label style="font-size:0.7rem;">Custom DC Value</label>
                            <input type="number" id="modal-macro-save-dc" placeholder="15" style="width:100%; text-align:center; padding:4px; font-size:0.8rem;">
                        </div>
                    </div>
                </div>
                <div class="form-group" style="margin-bottom:12px;">
                    <label style="display:flex; justify-content:space-between; align-items:center;">
                        Damage Rolls 
                        <button class="btn btn-xxs btn-secondary" id="modal-macro-add-dmg"><i class="fa-solid fa-plus"></i> Add Damage</button>
                    </label>
                    <div id="modal-macro-dmg-list" style="display:flex; flex-direction:column; gap:4px; margin-top:8px;"></div>
                </div>
                <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:16px;">
                    <button class="btn btn-secondary btn-sm" id="modal-macro-cancel">Cancel</button>
                    <button class="btn btn-primary btn-sm" id="modal-macro-save"><i class="fa-solid fa-floppy-disk"></i> Save Macro</button>
                </div>
            </div>
        `;
        document.body.appendChild(container);
        setupMacroModalListeners();
    }

    function setupMacroModalListeners() {
        document.getElementById('modal-macro-close-btn')?.addEventListener('click', () => closeMacroModal(false));
        document.getElementById('modal-macro-cancel')?.addEventListener('click', () => closeMacroModal(false));
        document.getElementById('pc-macro-overlay')?.addEventListener('click', () => closeMacroModal(false));

        document.getElementById('modal-macro-atk-stat')?.addEventListener('change', updateMacroModalVisibility);
        document.getElementById('modal-macro-save-dc-stat')?.addEventListener('change', updateMacroModalVisibility);

        document.getElementById('modal-macro-add-dmg')?.addEventListener('click', () => {
            modalDamageRows.push({
                id: 'dmg_' + Date.now(),
                formula: '1d8',
                stat: '',
                extra: 0,
                custom: '',
                type: 'Slashing',
                label: ''
            });
            renderModalDamage();
        });

        document.getElementById('modal-macro-save')?.addEventListener('click', () => {
            const activeChar = currentChar;
            if (!activeChar) return;
            const idx = parseInt(document.getElementById('modal-macro-idx')?.value);
            const name = (document.getElementById('modal-macro-name')?.value || '').trim();
            if (!name) {
                alert('Macro / Attack Name is required.');
                document.getElementById('modal-macro-name')?.focus();
                return;
            }

            const atkStat = document.getElementById('modal-macro-atk-stat')?.value || 'none';
            const dcStat = document.getElementById('modal-macro-save-dc-stat')?.value || 'none';

            // Synchronously harvest live DOM values for damage rows
            const updatedDamageRows = [];
            document.querySelectorAll('#modal-macro-dmg-list > div').forEach((rowEl, i) => {
                const formulaInp = rowEl.querySelector('.modal-dmg-formula');
                const statSel = rowEl.querySelector('.modal-dmg-stat');
                const modInp = rowEl.querySelector('.modal-dmg-mod');
                const typeSel = rowEl.querySelector('.modal-dmg-type');
                const labelInp = rowEl.querySelector('.modal-dmg-label');
                const prev = modalDamageRows[i] || {};
                const rawMod = modInp
                    ? modInp.value.trim()
                    : prev.custom !== undefined
                      ? prev.custom
                      : prev.extra
                        ? String(prev.extra)
                        : '';
                const parsedExtra = parseInt(rawMod);
                updatedDamageRows.push({
                    id: prev.id || 'dmg_' + Date.now() + '_' + i,
                    formula: formulaInp ? formulaInp.value.trim() : prev.formula || prev.dice || '',
                    stat: statSel ? statSel.value : prev.stat || '',
                    extra: !isNaN(parsedExtra) ? parsedExtra : prev.extra !== undefined ? prev.extra : 0,
                    custom: rawMod,
                    type: typeSel ? typeSel.value : prev.type || '',
                    label: labelInp ? labelInp.value.trim() : prev.label || ''
                });
            });

            if (!activeChar.macros) activeChar.macros = [];
            const existing = idx >= 0 && activeChar.macros && activeChar.macros[idx] ? activeChar.macros[idx] : {};

            const m = {
                ...existing,
                id: existing.id || 'mac_' + Date.now() + Math.random().toString(36).substr(2, 5),
                name,
                categoryId: document.getElementById('modal-macro-category')?.value || null,
                description: (document.getElementById('modal-macro-desc')?.value || '').trim(),
                range: (document.getElementById('modal-macro-range')?.value || '').trim(),
                target: (document.getElementById('modal-macro-target')?.value || '').trim(),

                // Attack configuration
                attackStat: atkStat,
                attackProf: document.getElementById('modal-macro-atk-prof')?.checked || false,
                attackExtra: parseInt(document.getElementById('modal-macro-atk-extra')?.value) || 0,
                critRange: parseInt(document.getElementById('modal-macro-crit-range')?.value) || 20,
                attackBonus: (document.getElementById('modal-macro-atk')?.value || '').trim(),
                isMagic: document.getElementById('modal-macro-is-magic')?.checked || false,
                isSilvered: document.getElementById('modal-macro-is-silvered')?.checked || false,
                isAdamantine: document.getElementById('modal-macro-is-adamantine')?.checked || false,

                // Save configuration
                saveAbility: document.getElementById('modal-macro-save-ab')?.value || '',
                saveDcStat: dcStat,
                saveDcExtra: parseInt(document.getElementById('modal-macro-save-dc-extra')?.value) || 0,
                saveDcCustom: document.getElementById('modal-macro-save-dc')?.value
                    ? parseInt(document.getElementById('modal-macro-save-dc').value)
                    : null,

                damage: updatedDamageRows.length ? updatedDamageRows : modalDamageRows
            };

            if (idx >= 0 && activeChar.macros[idx]) {
                activeChar.macros[idx] = m;
            } else {
                activeChar.macros.push(m);
            }

            closeMacroModal(true);
            saveAndEmit(activeChar);
            renderSheetData(activeChar);
        });
    }

    function openMacroModal(idx = -1) {
        ensureMacroModalExists();
        const char = currentChar;
        if (!char) return;
        document.getElementById('pc-macro-modal').classList.remove('vtt-hidden');
        document.getElementById('pc-macro-overlay').classList.remove('vtt-hidden');
        document.getElementById('modal-macro-idx').value = idx;

        const titleEl = document.getElementById('modal-macro-title');

        if (idx >= 0 && char.macros && char.macros[idx]) {
            if (titleEl) titleEl.innerHTML = '<i class="fa-solid fa-dice-d20"></i> Edit Macro';
            const m = char.macros[idx];
            document.getElementById('modal-macro-name').value = m.name || '';
            const catSel = document.getElementById('modal-macro-category');
            if (catSel) {
                catSel.innerHTML =
                    '<option value="">Uncategorized</option>' +
                    (char.macroCategories || []).map((c) => `<option value="${c.id}">📁 ${c.name}</option>`).join('');
                catSel.value = m.categoryId || '';
            }
            document.getElementById('modal-macro-desc').value = m.description || '';
            document.getElementById('modal-macro-range').value = m.range || '';
            document.getElementById('modal-macro-target').value = m.target || '';

            // Attack logic with legacy fallback
            let atkStat = m.attackStat;
            if (!atkStat && m.attackBonus) {
                atkStat = 'custom';
            } else if (!atkStat) {
                atkStat = 'none';
            }

            document.getElementById('modal-macro-atk-stat').value = atkStat;
            document.getElementById('modal-macro-atk-prof').checked = m.attackProf || false;
            document.getElementById('modal-macro-atk-extra').value = m.attackExtra !== undefined ? m.attackExtra : 0;
            document.getElementById('modal-macro-crit-range').value = m.critRange || 20;
            document.getElementById('modal-macro-atk').value = m.attackBonus || '';
            document.getElementById('modal-macro-is-magic').checked = !!m.isMagic;
            document.getElementById('modal-macro-is-silvered').checked = !!m.isSilvered;
            document.getElementById('modal-macro-is-adamantine').checked = !!m.isAdamantine;

            // Save logic with legacy fallback
            document.getElementById('modal-macro-save-ab').value = m.saveAbility || '';

            let dcStat = m.saveDcStat;
            if (!dcStat && m.saveDcBase) {
                dcStat = 'custom';
            } else if (!dcStat) {
                dcStat = 'none';
            }

            document.getElementById('modal-macro-save-dc-stat').value = dcStat;
            document.getElementById('modal-macro-save-dc-extra').value =
                m.saveDcExtra !== undefined ? m.saveDcExtra : 0;
            document.getElementById('modal-macro-save-dc').value =
                m.saveDcCustom !== undefined ? m.saveDcCustom : m.saveDcBase || '';

            modalDamageRows = m.damage ? JSON.parse(JSON.stringify(m.damage)) : [];
            modalDamageRows.forEach((r) => {
                if (!r.formula && r.dice) r.formula = r.dice;
                if (r.custom === undefined)
                    r.custom =
                        r.extra !== undefined && r.extra !== 0 ? (r.extra > 0 ? '+' + r.extra : String(r.extra)) : '';
                if (r.label === undefined) r.label = '';
            });
        } else {
            if (titleEl) titleEl.innerHTML = '<i class="fa-solid fa-plus"></i> Add Macro / Attack';
            document.getElementById('modal-macro-name').value = '';
            const catSel = document.getElementById('modal-macro-category');
            if (catSel) {
                catSel.innerHTML =
                    '<option value="">Uncategorized</option>' +
                    (char.macroCategories || []).map((c) => `<option value="${c.id}">📁 ${c.name}</option>`).join('');
                catSel.value = '';
            }
            document.getElementById('modal-macro-desc').value = '';
            document.getElementById('modal-macro-range').value = '';
            document.getElementById('modal-macro-target').value = '';

            document.getElementById('modal-macro-atk-stat').value = 'none';
            document.getElementById('modal-macro-atk-prof').checked = false;
            document.getElementById('modal-macro-atk-extra').value = 0;
            document.getElementById('modal-macro-crit-range').value = 20;
            document.getElementById('modal-macro-atk').value = '';
            document.getElementById('modal-macro-is-magic').checked = false;
            document.getElementById('modal-macro-is-silvered').checked = false;
            document.getElementById('modal-macro-is-adamantine').checked = false;

            document.getElementById('modal-macro-save-ab').value = '';
            document.getElementById('modal-macro-save-dc-stat').value = 'none';
            document.getElementById('modal-macro-save-dc-extra').value = 0;
            document.getElementById('modal-macro-save-dc').value = '';

            modalDamageRows = [];
        }
        updateMacroModalVisibility();
        renderModalDamage();
        _initialMacroSnapshot = getMacroModalSnapshot();
        const modalEl = document.getElementById('pc-macro-modal');
        if (modalEl) modalEl._initialModalSnapshot = _initialMacroSnapshot;
    }

    function closeMacroModal(force = false) {
        if (!force && _initialMacroSnapshot && getMacroModalSnapshot() !== _initialMacroSnapshot) {
            if (!confirm('Discard unsaved changes?')) {
                return;
            }
        }
        const modalEl = document.getElementById('pc-macro-modal');
        modalEl?.classList.add('vtt-hidden');
        document.getElementById('pc-macro-overlay')?.classList.add('vtt-hidden');
        _initialMacroSnapshot = '';
        if (modalEl) modalEl._initialModalSnapshot = '';
    }

    // Stat & Save settings modal managed via player-sheet/modals/settings-modal.js

    function ensureBackgroundImportModalExists() {
        ensureBackgroundImportModalExistsExt();
    }

    function promptBackgroundImportModal(bgData, char, onCancel, onApplied) {
        promptBackgroundImportModalExt(bgData, char, onCancel, (choices) => {
            applyBackgroundToCharacter(char, bgData, choices);
            if (onApplied) onApplied();
        });
    }

    function applyBackgroundToCharacter(char, bgData, choices) {
        if (!char || !bgData) return;

        const badge = getDisplaySourceBadge(bgData.source);
        const srcTag = badge ? ` [${badge}]` : bgData.source ? ` [${bgData.source}]` : '';
        char.background = `${bgData.name}${srcTag}`;

        // 1. Skills
        char.skills = char.skills || {};
        const appliedSkills = [];
        (choices.skills || []).forEach((s) => {
            const norm = normalizeSkill(s);
            if (norm) {
                char.skills[norm] = true;
                appliedSkills.push(norm);
            }
        });

        // 2. Tools
        char.tools = char.tools || {};
        const appliedTools = [];
        (choices.tools || []).forEach((t) => {
            const norm = normalizeTool(t);
            if (norm) {
                const defTool = STANDARD_TOOLS.find((st) => st.name.toLowerCase() === norm.toLowerCase());
                const ab = defTool ? defTool.ability : 'dex';
                char.tools[norm] = {
                    ability: ab,
                    show: true,
                    prof: true,
                    exp: false,
                    mod: '0',
                    custom: !defTool
                };
                appliedTools.push(norm);
            }
        });

        // 3. Equipment & Currency
        char.equipment = Array.isArray(char.equipment) ? char.equipment : [];
        char.currency = char.currency || { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };

        const addedGold = parseInt(choices.gold) || 0;
        if (choices.invHandling === 'replace') {
            char.equipment = [];
            char.currency.gp = addedGold;
        } else {
            char.currency.gp = (char.currency.gp || 0) + addedGold;
        }

        const appliedItems = [];
        (choices.items || []).forEach((it) => {
            const itemName = it.name ? it.name.trim() : 'Item';
            const itemQty = parseInt(it.quantity) || 1;
            const itemWeight = parseFloat(it.weight) || 0;
            char.equipment.push({
                id: 'eq_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                name: itemName.charAt(0).toUpperCase() + itemName.slice(1),
                qty: itemQty,
                weight: itemWeight,
                containerId: null,
                description: ''
            });
            appliedItems.push(itemQty > 1 ? `${itemQty}x ${itemName}` : itemName);
        });

        // 4. Ability Cards
        if (choices.createCards) {
            char.abilityCategories = char.abilityCategories || [];
            char.abilityCards = char.abilityCards || [];

            let bgCat = char.abilityCategories.find(
                (c) => c.name.toLowerCase() === 'background features' || c.name.toLowerCase() === 'background'
            );
            if (!bgCat) {
                bgCat = {
                    id: 'cat_bg_' + Date.now(),
                    name: 'Background Features',
                    collapsed: false
                };
                char.abilityCategories.push(bgCat);
            }

            // Card 1: Background Feature(s)
            const features =
                Array.isArray(bgData.features) && bgData.features.length > 0
                    ? bgData.features
                    : [{ name: `Feature: ${bgData.name}`, description: bgData.description || '' }];

            features.forEach((feat, fi) => {
                char.abilityCards.push({
                    id: 'ab_bg_feat_' + Date.now() + '_' + fi,
                    name: feat.name || `Feature: ${bgData.name}`,
                    actionType: 'passive',
                    categoryId: bgCat.id,
                    description: feat.description || '',
                    formula: '',
                    formulaConfig: null,
                    customFields: [],
                    hasCounter: false,
                    usesCurrent: 0,
                    usesMax: 0,
                    resetType: 'none'
                });
            });

            // Card 2: Background Details & Proficiencies Summary
            let summaryDesc = `**Background:** ${bgData.name} [${bgData.source || 'PHB'}]\n\n`;
            summaryDesc += `**Skill Proficiencies:** ${appliedSkills.length > 0 ? appliedSkills.join(', ') : 'None'}\n`;
            summaryDesc += `**Tool Proficiencies:** ${appliedTools.length > 0 ? appliedTools.join(', ') : 'None'}\n`;
            if (bgData.languages) summaryDesc += `**Languages:** ${bgData.languages}\n`;
            summaryDesc += `**Starting Equipment:** ${appliedItems.length > 0 ? appliedItems.join(', ') : 'None'} (${addedGold} gp)\n\n`;
            if (bgData.description) {
                const cleanDesc = bgData.description
                    .replace(/^#+\s+/gm, '')
                    .trim()
                    .slice(0, 500);
                summaryDesc += cleanDesc + (bgData.description.length > 500 ? '...' : '');
            }

            char.abilityCards.push({
                id: 'ab_bg_summary_' + Date.now(),
                name: `Background: ${bgData.name}`,
                actionType: 'passive',
                categoryId: bgCat.id,
                description: summaryDesc,
                formula: '',
                formulaConfig: null,
                customFields: [],
                hasCounter: false,
                usesCurrent: 0,
                usesMax: 0,
                resetType: 'none'
            });
        }

        saveAndEmit(char);
        renderSheetData(char);
    }

    // ─── Character Builder & Level Up Assistant ──────────────────────────────
    function ensureCharacterBuilderModalExists() {
        return ensureCharacterBuilderModalExistsExt();
    }

    async function openCharacterBuilderModal(char) {
        return openCharacterBuilderModalExt(char, {
            ensureBuilderCache,
            getDisabledSources,
            isSourceAllowed,
            saveAndEmit,
            renderSheetData,
            evaluateAbilityMaxUses,
            getCharIs2024: (c) => (typeof getCharIs2024 === 'function' ? getCharIs2024(c) : false),
            vtt
        });
    }

    // Skill, tool, and player token edit modals managed via player-sheet/modals/index.js

    function getModalOptions() {
        return {
            getCurrentChar: () => currentChar,
            saveAndEmit: (c) => saveAndEmit(c),
            renderSheetData: (c) => renderSheetData(c),
            getDisplaySourceBadge: (s) => (typeof getDisplaySourceBadge === 'function' ? getDisplaySourceBadge(s) : s)
        };
    }

    function ensureSaveSettingsModalExists() {
        return ensureSaveSettingsModalExistsExt(getModalOptions());
    }

    function renderSaveTogglesList() {
        return renderSaveTogglesListExt(currentChar, getModalOptions());
    }

    function ensureSkillSettingsModalExists() {
        return ensureSkillSettingsModalExistsExt(getModalOptions());
    }

    function renderSkillTogglesList() {
        return renderSkillTogglesListExt(currentChar, getModalOptions());
    }

    function ensureToolSettingsModalExists() {
        return ensureToolSettingsModalExistsExt(getModalOptions());
    }

    function ensureHpSettingsModalExists() {
        return ensureHpSettingsModalExistsExt(getModalOptions());
    }

    function renderHpTogglesList() {
        return renderHpTogglesListExt(currentChar, getModalOptions());
    }

    function ensureAcSettingsModalExists() {
        return ensureAcSettingsModalExistsExt(getModalOptions());
    }

    function renderAcTogglesList() {
        return renderAcTogglesListExt(currentChar, getModalOptions());
    }

    function ensurePlayerTokenEditModalExists() {
        return ensurePlayerTokenEditModalExistsExt(getModalOptions());
    }

    function ensureBagModalExists() {
        return ensureBagModalExistsExt(getModalOptions());
    }

    function openBagModal(bagId = null) {
        return openBagModalExt(bagId, getModalOptions());
    }

    function getItemCompendiumOptions() {
        return getModalOptions();
    }

    function ensureItemModalsExist() {
        return ensureItemModalsExistExt(getItemCompendiumOptions());
    }

    window.openItemModal = function () {
        return openItemModalExt(getItemCompendiumOptions());
    };

    window.openCustomItemModal = function (editIdx = null) {
        return openCustomItemModalExt(editIdx, getItemCompendiumOptions());
    };
    // ─── Panel open / minimize / expand ──────────────────────────────────────
    function openPanel() {
        if (window.VTT && window.VTT.creatureSheet && typeof window.VTT.creatureSheet.minimizePanel === 'function') {
            window.VTT.creatureSheet.minimizePanel();
            const creaturePanel = document.getElementById('creature-sheet-panel');
            if (creaturePanel) creaturePanel.style.zIndex = '50';
        }
        panel.style.zIndex = '55';
        panel.classList.add('open');
        panel.classList.remove('minimized');
        isMinimized = false;
        minimizeBtn.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';
        minimizeBtn.title = 'Minimize Player Sheet';
        if (window.VTT?.mobileAdapter?.syncPlayerSheetTopbar) {
            window.VTT.mobileAdapter.syncPlayerSheetTopbar();
        }
    }

    function minimizePanel() {
        panel.classList.remove('open');
        panel.classList.add('minimized');
        isMinimized = true;
        minimizeBtn.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
        minimizeBtn.title = 'Expand Player Sheet';
    }

    minimizeBtn.addEventListener('click', () => {
        if (isMinimized) {
            openPanel();
        } else {
            minimizePanel();
        }
    });

    // ─── Inner Tabs ────────────────────────────────────────────────────────
    const psTabBtns = document.querySelectorAll('.ps-tab-btn');
    const psTabContents = document.querySelectorAll('.ps-tab-content');

    psTabBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
            const target = btn.dataset.tab;

            psTabBtns.forEach((t) => {
                t.classList.remove('active');
                t.style.borderBottomColor = 'transparent';
                t.style.color = 'var(--color-text-secondary)';
            });
            psTabContents.forEach((c) => c.classList.add('vtt-hidden'));

            btn.classList.add('active');
            btn.style.borderBottomColor = 'var(--color-gold-base)';
            btn.style.color = 'var(--color-gold-light)';

            const targetEl = document.getElementById(target);
            if (targetEl) targetEl.classList.remove('vtt-hidden');
        });
    });

    // ─── Right Sidebar Character List ────────────────────────────────────────
    function renderCharacterList() {
        if (!charListEl) return;
        if (!vtt.campaignState || !vtt.campaignState.characters) return;
        let chars = Object.values(vtt.campaignState.characters);

        if (vtt.role !== 'GM') {
            chars = chars.filter(
                (c) =>
                    c.assignedPlayers && (c.assignedPlayers.includes(vtt.username) || c.assignedPlayers.includes('*'))
            );
        }

        const pcs = chars.filter((c) => !c.isCompanion && !c.isCustomNpc);
        const companions = chars.filter((c) => c.isCompanion && !c.isCustomNpc);

        if (chars.length === 0) {
            charListEl.innerHTML = '<div class="init-empty-state">No characters yet. Click "New" to create one.</div>';
            return;
        }

        let html = '';

        if (pcs.length > 0) {
            if (companions.length > 0) {
                html += `<div style="font-family:var(--font-heading); font-size:0.8rem; color:var(--color-text-muted); margin:4px 0 4px 8px; text-transform:uppercase; letter-spacing:1px;">Player Characters</div>`;
            }
            html += pcs
                .map(
                    (c) => `
                <div class="init-row char-row" data-id="${c.id}" draggable="true" style="cursor:pointer; display:flex; flex-direction:column; align-items:flex-start; padding:12px; gap:6px;">
                    <div style="display:flex; justify-content:space-between; width:100%; align-items:center;">
                        <span class="init-name" style="font-size:1.05rem;">${c.name}</span>
                        <div style="display:flex; align-items:center; gap:6px;">
                            <button class="btn-mobile-spawn-token btn-char-spawn" data-id="${c.id}" title="Spawn on Map"><i class="fa-solid fa-plus pointer-events-none"></i></button>
                            <button class="btn btn-xxs btn-danger btn-char-delete" data-id="${c.id}" title="Delete Character"><i class="fa-solid fa-trash pointer-events-none"></i></button>
                        </div>
                    </div>
                    <div style="font-size:0.75rem; color:var(--color-text-secondary);">${c.class || 'Unknown Class'} ${c.level ? `Lv${c.level}` : ''} | ${c.race || 'Unknown Species'}</div>
                    <div style="display:flex; gap:12px; font-size:0.75rem; margin-top:4px; font-family:var(--font-code);">
                        <span style="color:var(--color-gold-light);"><i class="fa-solid fa-heart"></i> ${c.hpCurrent}/${c.hpMax}</span>
                        <span style="color:var(--color-text-muted);"><i class="fa-solid fa-shield"></i> AC ${c.ac || 10}</span>
                    </div>
                </div>
            `
                )
                .join('');
        }

        if (companions.length > 0) {
            companions.forEach((c) => {
                if (!c.tokenImages || c.tokenImages.length === 0) {
                    const m = c.monsterData || {};
                    let tokenUrl = m.tokenImg || m.tokenUrl || m.imgUrl;
                    if (!tokenUrl && typeof window.Renderer !== 'undefined' && window.Renderer.monster?.getTokenUrl) {
                        try {
                            tokenUrl = window.Renderer.monster.getTokenUrl(m);
                        } catch (e) {}
                    }
                    if (!tokenUrl && (m.source || m.name)) {
                        const cleanName =
                            typeof window.Parser !== 'undefined'
                                ? window.Parser.nameToTokenName(m.name)
                                : (m.name || '').replace(/"/g, '').trim();
                        const source = m.source || 'MM';
                        tokenUrl = `img/bestiary/tokens/${source}/${cleanName}.webp`;
                    }
                    if (tokenUrl) {
                        c.tokenImages = [{ url: tokenUrl, name: 'Default Token', isDefault: true }];
                        c.activeTokenIndex = 0;
                        if (vtt.socket) vtt.socket.emit('character:update', { character: c });
                    }
                }
            });

            if (pcs.length > 0) {
                html += `<div style="font-family:var(--font-heading); font-size:0.8rem; color:var(--color-text-muted); margin:12px 0 4px 8px; text-transform:uppercase; letter-spacing:1px;">Player Companions</div>`;
            }
            html += companions
                .map(
                    (c) => `
                <div class="init-row char-row" data-id="${c.id}" data-is-companion="true" draggable="true" style="cursor:pointer; display:flex; flex-direction:column; align-items:flex-start; padding:12px; gap:6px; border-left:3px solid var(--color-gold-base);">
                    <div style="display:flex; justify-content:space-between; width:100%; align-items:center;">
                        <span class="init-name" style="font-size:1.05rem;"><i class="fa-solid fa-paw" style="margin-right:4px; font-size:0.8rem;"></i> ${c.name}</span>
                        <div style="display:flex; align-items:center; gap:6px;">
                            <button class="btn-mobile-spawn-token btn-char-spawn" data-id="${c.id}" title="Spawn on Map"><i class="fa-solid fa-plus pointer-events-none"></i></button>
                            <button class="btn btn-xxs btn-danger btn-char-delete" data-id="${c.id}" title="Delete Companion"><i class="fa-solid fa-trash pointer-events-none"></i></button>
                        </div>
                    </div>
                    <div style="font-size:0.75rem; color:var(--color-text-secondary);">Owned by: ${c.assignedPlayers && c.assignedPlayers.length > 0 ? (c.assignedPlayers.includes('*') ? 'All Players' : c.assignedPlayers.join(', ')) : 'None'}</div>
                    <div style="display:flex; gap:12px; font-size:0.75rem; margin-top:4px; font-family:var(--font-code);">
                        <span style="color:var(--color-gold-light);"><i class="fa-solid fa-heart"></i> ${c.hpCurrent}/${c.hpMax}</span>
                        <span style="color:var(--color-text-muted);"><i class="fa-solid fa-shield"></i> AC ${c.ac || 10}</span>
                    </div>
                </div>
            `
                )
                .join('');
        }

        charListEl.innerHTML = html;

        charListEl.querySelectorAll('.char-row').forEach((row) => {
            row.addEventListener('dragstart', (e) => {
                const id = row.dataset.id;
                const c = vtt.campaignState.characters[id];
                if (!c) {
                    e.preventDefault();
                    return;
                }

                // Check permissions: Must be GM or an assigned player
                if (
                    vtt.role !== 'GM' &&
                    (!c.assignedPlayers ||
                        !(c.assignedPlayers.includes(vtt.username) || c.assignedPlayers.includes('*')))
                ) {
                    e.preventDefault();
                    return;
                }

                let size = 1;
                let img = null; // Do not bundle base64 images into dataTransfer, resolve on drop

                if (c.isCompanion && c.monsterData) {
                    // Extract size from bestiary
                    const rawSz = c.monsterData.size
                        ? Array.isArray(c.monsterData.size)
                            ? c.monsterData.size[0]
                            : c.monsterData.size
                        : 'M';
                    const sz = String(rawSz).trim().charAt(0).toUpperCase();
                    switch (sz) {
                        case 'T':
                            size = 0.5;
                            break;
                        case 'S':
                            size = 1;
                            break;
                        case 'M':
                            size = 1;
                            break;
                        case 'L':
                            size = 2;
                            break;
                        case 'H':
                            size = 3;
                            break;
                        case 'G':
                            size = 4;
                            break;
                        default:
                            size = 1;
                            break;
                    }
                }

                const payload = JSON.stringify({
                    type: 'player',
                    name: c.name,
                    hp: c.hpCurrent || 0,
                    maxHp: c.hpMax || 0,
                    tempHp: c.tempHp || 0,
                    size: c.tokenSize !== undefined ? c.tokenSize : size,
                    customWidth: c.tokenCustomWidth,
                    customHeight: c.tokenCustomHeight,
                    img: img, // Will be null for PCs, resolved by vtt-data-bridge.js
                    characterId: c.id,
                    isCompanion: !!c.isCompanion,
                    isPlayer: !c.isCompanion && !c.isCustomNpc,
                    sightRange:
                        c.tokenSight !== undefined && c.tokenSight > 0
                            ? c.tokenSight
                            : c.monsterData
                              ? window.parseMonsterVision
                                  ? window.parseMonsterVision(c.monsterData)
                                  : 5
                              : 5
                });
                e.dataTransfer.setData('application/json', payload);
                e.dataTransfer.setData('text/plain', payload);
                e.dataTransfer.effectAllowed = 'copy';
            });

            row.addEventListener('click', (e) => {
                if (e.target.closest('.btn-char-delete') || e.target.closest('.btn-char-spawn')) return;
                const id = row.dataset.id;
                openSheet(id);
            });
        });

        charListEl.querySelectorAll('.btn-char-spawn').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                if (window.VTT?.spawnCharacterAtCenter) {
                    window.VTT.spawnCharacterAtCenter(id);
                }
            });
        });

        charListEl.querySelectorAll('.btn-char-delete').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                const char = vtt.campaignState?.characters?.[id];
                const entityName = char?.name
                    ? `"${char.name}"`
                    : char?.isCompanion
                      ? 'this companion'
                      : 'this character';
                if (confirm(`Delete ${entityName} forever?`)) {
                    // Optimistically delete from local state and update UI immediately
                    if (vtt.campaignState?.characters && vtt.campaignState.characters[id]) {
                        delete vtt.campaignState.characters[id];
                        renderCharacterList();
                    }
                    if (currentChar && currentChar.id === id) {
                        closeSheet();
                    }
                    if (vtt.creatureSheet && typeof vtt.creatureSheet.getLinkedCharacterId === 'function') {
                        if (vtt.creatureSheet.getLinkedCharacterId() === id) {
                            if (typeof vtt.creatureSheet.resetSheet === 'function') {
                                vtt.creatureSheet.resetSheet();
                            } else if (typeof vtt.creatureSheet.minimizePanel === 'function') {
                                vtt.creatureSheet.minimizePanel();
                            }
                        }
                    }
                    if (vtt.socket) {
                        vtt.socket.emit('character:delete', { id });
                    }
                }
            });
        });
    }

    const btnCharAddCompanion = document.getElementById('btn-char-add-companion');

    if (btnCharAddCompanion) {
        btnCharAddCompanion.addEventListener('click', async () => {
            // We need a modal to select a monster, then an owner.
            try {
                let catRes = await fetch('/api/bestiary/catalog');
                if (!catRes.ok) catRes = await fetch('/data/bestiary-catalog.json');
                if (!catRes.ok) throw new Error('Could not load bestiary catalog');
                const monsters = await catRes.json();

                // create a temporary modal
                const modalOverlay = document.createElement('div');
                modalOverlay.className = 'vtt-sheet-submodal-overlay';
                modalOverlay.style.cssText =
                    'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); z-index:3000;';

                const modal = document.createElement('div');
                modal.className = 'vtt-sheet-submodal glassmorphism';
                modal.style.cssText =
                    'position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); z-index:3010; width:min(500px, 92vw); max-height:80vh; display:flex; flex-direction:column; padding:16px; border-radius:8px; border:1px solid var(--color-border-subtle);';

                modal.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                        <h3 style="margin:0; color:var(--color-gold-base);"><i class="fa-solid fa-paw"></i> Add Player Companion</h3>
                        <button id="comp-modal-close" class="btn btn-icon btn-secondary"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                    <div class="form-group">
                        <label>Search Bestiary</label>
                        <input type="text" id="comp-search" placeholder="Search monsters (e.g., Wolf)...">
                    </div>
                    <div id="comp-list" class="scroll-styled" style="flex:1; border:1px solid var(--color-border-subtle); background:rgba(0,0,0,0.2); overflow-y:auto; padding:4px; min-height:200px;"></div>
                `;

                document.body.appendChild(modalOverlay);
                document.body.appendChild(modal);

                const listEl = modal.querySelector('#comp-list');
                const searchInput = modal.querySelector('#comp-search');

                const renderList = (query) => {
                    listEl.innerHTML = '';
                    const q = query.toLowerCase().trim();
                    const filtered = monsters
                        .filter((m) => {
                            const nameMatch = m.name.toLowerCase().includes(q);
                            const crStr = m.cr
                                ? (typeof m.cr === 'object' ? String(m.cr.cr) : String(m.cr)).toLowerCase()
                                : '0';
                            const crMatch =
                                crStr === q ||
                                crStr.includes(q) ||
                                `cr ${crStr}`.includes(query) ||
                                `cr${crStr}`.includes(q);
                            return nameMatch || crMatch;
                        })
                        .slice(0, 50);
                    filtered.forEach((m) => {
                        const row = document.createElement('div');
                        row.style.cssText =
                            'padding:8px; border-bottom:1px solid var(--color-border-subtle); cursor:pointer; display:flex; justify-content:space-between; align-items:center;';
                        const spellBadge = m.hasSpellcasting
                            ? `<span style="color:var(--color-gold-base); margin-left:4px;" title="Spellcaster"><i class="fa-solid fa-wand-magic-sparkles"></i></span>`
                            : '';
                        row.innerHTML = `<span><strong>${m.name}</strong>${spellBadge} <span style="font-size:0.75em; color:var(--color-text-muted);">[${m.source || 'Unknown'} ${m.edition || ''}]</span></span> <span style="color:var(--color-text-muted);">CR ${m.cr ? m.cr.cr || m.cr : '0'}</span>`;
                        row.addEventListener('click', () => {
                            selectOwnerForCompanion(m);
                            closeModal();
                        });
                        row.onmouseover = () => (row.style.background = 'rgba(255,255,255,0.1)');
                        row.onmouseout = () => (row.style.background = 'transparent');
                        listEl.appendChild(row);
                    });
                };

                const closeModal = () => {
                    modalOverlay.remove();
                    modal.remove();
                };

                modal.querySelector('#comp-modal-close').addEventListener('click', closeModal);
                modalOverlay.addEventListener('click', closeModal);
                searchInput.addEventListener('input', (e) => renderList(e.target.value));
                renderList('');

                const selectOwnerForCompanion = (monster) => {
                    const knownPlayers =
                        vtt.campaignState && vtt.campaignState.knownPlayers ? vtt.campaignState.knownPlayers : [];
                    const allowedUsers =
                        vtt.campaignState && vtt.campaignState.allowedUsers ? vtt.campaignState.allowedUsers : [];
                    const allPotentialPlayers = [...new Set([...knownPlayers, ...allowedUsers])];

                    const ownerOverlay = document.createElement('div');
                    ownerOverlay.className = 'vtt-sheet-submodal-overlay vtt-sheet-submodal-high';
                    ownerOverlay.style.cssText =
                        'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); z-index:3020;';
                    const ownerModal = document.createElement('div');
                    ownerModal.className = 'vtt-sheet-submodal vtt-sheet-submodal-high glassmorphism';
                    ownerModal.style.cssText =
                        'position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); z-index:3025; width:min(400px, 92vw); padding:16px; border-radius:8px; border:1px solid var(--color-border-subtle);';

                    let optionsHtml = '<option value="*">All Players</option>';
                    optionsHtml += allPotentialPlayers.map((p) => `<option value="${p}">${p}</option>`).join('');

                    ownerModal.innerHTML = `
                        <h4 style="margin-top:0; color:var(--color-gold-base);">Assign Owner for ${monster.name}</h4>
                        <div class="form-group">
                            <label>Select Player</label>
                            <select id="comp-owner-sel">${optionsHtml}</select>
                        </div>
                        <div class="form-group">
                            <label>Custom Nickname (Optional)</label>
                            <input type="text" id="comp-nickname" placeholder="${monster.name}">
                        </div>
                        <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:16px;">
                            <button id="comp-owner-cancel" class="btn btn-secondary btn-sm">Cancel</button>
                            <button id="comp-owner-save" class="btn btn-primary btn-sm"><i class="fa-solid fa-plus"></i> Create Companion</button>
                        </div>
                    `;

                    document.body.appendChild(ownerOverlay);
                    document.body.appendChild(ownerModal);

                    const closeOwnerModal = () => {
                        ownerOverlay.remove();
                        ownerModal.remove();
                    };

                    ownerModal.querySelector('#comp-owner-cancel').addEventListener('click', closeOwnerModal);
                    ownerOverlay.addEventListener('click', closeOwnerModal);
                    ownerModal.querySelector('#comp-owner-save').addEventListener('click', async () => {
                        const owner = ownerModal.querySelector('#comp-owner-sel').value;
                        const nickname = ownerModal.querySelector('#comp-nickname').value.trim() || monster.name;

                        let hp = 20;
                        if (typeof monster.hp === 'number') hp = monster.hp;
                        else if (monster.hp && monster.hp.average) hp = monster.hp.average;

                        // Hydrate full normalized creature data
                        let fullMonster = null;
                        if (window.fetchFullCreature) {
                            fullMonster = await window.fetchFullCreature(monster.source, monster.id || monster.name);
                        } else {
                            try {
                                const r = await fetch(
                                    `/api/creature/${encodeURIComponent(monster.source)}/${encodeURIComponent(monster.id || monster.name)}`
                                );
                                if (r.ok) fullMonster = await r.json();
                            } catch (err) {}
                            if (!fullMonster) {
                                try {
                                    let partRes = await fetch(
                                        `/data/bestiary-normalized/bestiary-${monster.source.toLowerCase()}.json`
                                    );
                                    if (!partRes.ok)
                                        partRes = await fetch(
                                            `/vtt/data/bestiary-normalized/bestiary-${monster.source.toLowerCase()}.json`
                                        );
                                    if (partRes.ok) {
                                        const partition = await partRes.json();
                                        const clean = (monster.id || monster.name).toLowerCase();
                                        fullMonster = partition.find(
                                            (m) => m.id?.toLowerCase() === clean || m.name?.toLowerCase() === clean
                                        );
                                    }
                                } catch (err) {}
                            }
                        }
                        const finalMonsterData = fullMonster
                            ? JSON.parse(JSON.stringify(fullMonster))
                            : JSON.parse(JSON.stringify(monster));
                        if (nickname) {
                            finalMonsterData.name = nickname;
                        }

                        let defaultToken =
                            finalMonsterData.tokenImg || finalMonsterData.tokenUrl || finalMonsterData.imgUrl;
                        if (
                            !defaultToken &&
                            typeof window.Renderer !== 'undefined' &&
                            window.Renderer.monster?.getTokenUrl
                        ) {
                            try {
                                defaultToken = window.Renderer.monster.getTokenUrl(finalMonsterData);
                            } catch (e) {}
                        }
                        if (!defaultToken && (finalMonsterData.source || finalMonsterData.name)) {
                            const cleanName =
                                typeof window.Parser !== 'undefined'
                                    ? window.Parser.nameToTokenName(finalMonsterData.name)
                                    : (finalMonsterData.name || '').replace(/"/g, '').trim();
                            const source = finalMonsterData.source || 'MM';
                            defaultToken = `img/bestiary/tokens/${source}/${cleanName}.webp`;
                        }
                        const initialTokens = defaultToken
                            ? [{ url: defaultToken, name: 'Default Token', isDefault: true }]
                            : [];

                        const newComp = {
                            id: 'comp_' + Date.now(),
                            name: nickname,
                            isCompanion: true,
                            assignedPlayers: owner ? [owner] : [],
                            monsterData: finalMonsterData,
                            tokenSight: window.parseMonsterVision ? window.parseMonsterVision(finalMonsterData) : 5,
                            hpMax: hp,
                            hpCurrent: hp,
                            tempHp: 0,
                            ac: monster.ac
                                ? Array.isArray(monster.ac)
                                    ? monster.ac[0].ac || monster.ac[0]
                                    : typeof monster.ac === 'object'
                                      ? monster.ac.ac
                                      : monster.ac
                                : 10,
                            tokenImages: initialTokens,
                            activeTokenIndex: 0
                        };

                        vtt.socket.emit('character:update', { character: newComp });
                        closeOwnerModal();
                    });
                };
            } catch (e) {
                console.error('Error loading bestiary for companion:', e);
                alert('Could not load bestiary data.');
            }
        });
    }

    if (btnCharAdd) {
        btnCharAdd.addEventListener('click', () => {
            const assigned = vtt.role !== 'GM' && vtt.username ? [vtt.username] : [];
            const newChar = {
                id: 'char_' + Date.now(),
                name: 'New Character',
                class: 'Fighter',
                level: 1,
                race: 'Human',
                background: 'Acolyte',
                stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
                hpMax: 10,
                hpCurrent: 10,
                tempHp: 0,
                ac: 10,
                speed: 30,
                equipment: [],
                spells: {
                    cantrip: [],
                    level1: [],
                    level2: [],
                    level3: [],
                    level4: [],
                    level5: [],
                    level6: [],
                    level7: [],
                    level8: [],
                    level9: [],
                    legacy: []
                },
                bio: { height: '', age: '', weight: '', backstory: '', notes: '' },
                attackSettings: { atkMod: 0, toggles: [] },
                saveSettings: { saveMod: 0, toggles: [] },
                skillSettings: { toggles: [] },
                abilityCards: [],
                abilityCategories: [],
                macros: [],
                macroCategories: [],
                toHit: '',
                dcAbility: 'INT',
                skills: {},
                expertise: {},
                tools: {},
                tokenImages: [],
                activeTokenIndex: 0,
                assignedPlayers: assigned,
                isPlayer: true
            };
            vtt.socket.emit('character:update', { character: newChar });

            // Optimistic update
            if (!vtt.campaignState.characters) vtt.campaignState.characters = {};
            vtt.campaignState.characters[newChar.id] = newChar;
            renderCharacterList();
            openSheet(newChar.id);
        });
    }

    // ─── Builder Automation & rendering ──────────────────────────────────────
    function getTotalStat(char, ab) {
        const base = parseInt(char.stats && char.stats[ab]) || 10;
        const mod = parseInt(char.statMods && char.statMods[ab]) || 0;
        return base + mod;
    }

    function getMod(score) {
        return Math.floor(((parseInt(score) || 10) - 10) / 2);
    }

    function getProfBonus(level) {
        const l = parseInt(level) || 1;
        return Math.ceil(l / 4) + 1;
    }

    function recalculateDerived(char) {
        // Very basic automation for HP and AC if they aren't manually overridden heavily.
        // Actually, we'll just leave this as a manual stat manager with auto modifiers for now to keep it playable.
        // True 5etools JSON reading is massive, so we do base 5e math based on inputs.
        const conMod = getMod(getTotalStat(char, 'con'));
        const dexMod = getMod(getTotalStat(char, 'dex'));

        // This is a placeholder for derived logic. In a full builder we'd read class hit dice.
        // But for this baseline, we'll rely on the user to punch in their max HP or we give a rough estimate.
    }

    function openSheet(id) {
        if (!vtt.campaignState || !vtt.campaignState.characters) return;
        const char = vtt.campaignState.characters[id];
        if (!char) return;

        if (
            vtt.role !== 'GM' &&
            (!char.assignedPlayers ||
                !(char.assignedPlayers.includes(vtt.username) || char.assignedPlayers.includes('*')))
        ) {
            return; // Not assigned to this player
        }

        // Check if this player sheet is already open in a popped-out tab/window
        const sheetKey = window.SheetWindowManager ? window.SheetWindowManager.getSheetKey('player', id) : null;
        if (
            !vtt.isStandaloneSheet &&
            sheetKey &&
            window.SheetWindowManager &&
            window.SheetWindowManager.isSheetPoppedOut(sheetKey)
        ) {
            window.SheetWindowManager.focusPoppedOut(sheetKey);
            return;
        }

        if ((char.isCompanion || char.isCustomNpc || char.monsterData) && vtt.creatureSheet) {
            if (vtt.sheetDock && !vtt.sheetDock._internalCall) {
                vtt.sheetDock.openSheet({
                    type: 'creature',
                    monsterData: char.monsterData,
                    characterId: char.id,
                    name: char.name,
                    avatar: char.avatar || char.tokenImage,
                    isCompanion: char.isCompanion,
                    isCustomNpc: char.isCustomNpc,
                    isGeneric: char.isGeneric
                });
                return;
            }
            vtt.creatureSheet.openSheet(char.monsterData, null, char.id);
            return;
        }

        if (vtt.sheetDock && !vtt.sheetDock._internalCall) {
            vtt.sheetDock.openSheet({
                type: 'player',
                id: char.id,
                name: char.name,
                avatar: char.avatar || char.tokenImage
            });
            return;
        }

        currentChar = char;
        placeholderEl.classList.add('vtt-hidden');
        activeSheetEl.classList.remove('vtt-hidden');

        ensureBuilderCache();

        try {
            renderSheetData(char);
        } catch (err) {
            console.error('[PlayerSheet] Error rendering sheet data for', char.id, err);
        }
        openPanel();
    }

    function closeSheet() {
        currentChar = null;
        placeholderEl.classList.remove('vtt-hidden');
        activeSheetEl.classList.add('vtt-hidden');
        minimizePanel();
    }

    let renderDebounceTimer = null;
    function debouncedRenderSheetData(char) {
        if (renderDebounceTimer) clearTimeout(renderDebounceTimer);
        renderDebounceTimer = setTimeout(() => {
            if (char) renderSheetData(char);
        }, 300);
    }

    function ensureCategoryModalExists() {
        if (document.getElementById('pc-category-modal')) return;

        const modalHtml = `
            <div id="pc-category-overlay" class="vtt-sheet-submodal-overlay vtt-hidden" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); z-index:3000;"></div>
            <div id="pc-category-modal" class="vtt-sheet-submodal vtt-hidden" style="position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); background:#1e1e1e; border:1px solid var(--color-border-subtle); border-radius:8px; z-index:3010; width:380px; max-width:92vw; padding:16px; box-shadow:0 4px 16px rgba(0,0,0,0.6);">
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--color-border-subtle); padding-bottom:10px; margin-bottom:12px;">
                    <h3 style="margin:0; color:var(--color-gold-base); font-size:1.05rem;" id="modal-cat-title"><i class="fa-solid fa-folder-plus"></i> Add Category</h3>
                    <button id="modal-cat-close" style="background:transparent; border:none; color:var(--color-text-muted); cursor:pointer; font-size:1.2rem;"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <input type="hidden" id="modal-cat-type" value="macro">
                <input type="hidden" id="modal-cat-id" value="">
                <div class="form-group" style="margin-bottom:16px;">
                    <label style="font-size:0.8rem; font-weight:600; margin-bottom:6px; display:block; color:var(--color-text-primary);">Category Name</label>
                    <input type="text" id="modal-cat-name" placeholder="e.g. Melee Attacks, Class Features, Feats" style="width:100%; padding:6px; font-size:0.85rem; background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                </div>
                <div style="display:flex; justify-content:flex-end; gap:8px; border-top:1px solid var(--color-border-subtle); padding-top:12px;">
                    <button id="modal-cat-cancel" class="btn btn-secondary btn-xs">Cancel</button>
                    <button id="modal-cat-save" class="btn btn-primary btn-xs">Save Category</button>
                </div>
            </div>
        `;
        const div = document.createElement('div');
        div.innerHTML = modalHtml;
        document.body.appendChild(div);

        const closeCatModal = () => {
            document.getElementById('pc-category-modal').classList.add('vtt-hidden');
            document.getElementById('pc-category-overlay').classList.add('vtt-hidden');
        };

        document.getElementById('modal-cat-close').addEventListener('click', closeCatModal);
        document.getElementById('modal-cat-cancel').addEventListener('click', closeCatModal);
        document.getElementById('pc-category-overlay').addEventListener('click', closeCatModal);

        document.getElementById('modal-cat-name').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                document.getElementById('modal-cat-save').click();
            }
        });

        document.getElementById('modal-cat-save').addEventListener('click', () => {
            const char = currentChar;
            if (!char) return;
            const type = document.getElementById('modal-cat-type').value;
            const id = document.getElementById('modal-cat-id').value;
            const name = document.getElementById('modal-cat-name').value.trim();
            if (!name) return alert('Category name is required.');

            if (type === 'macro') {
                char.macroCategories = char.macroCategories || [];
                if (id) {
                    const cat = char.macroCategories.find((c) => c.id === id);
                    if (cat) cat.name = name;
                } else {
                    char.macroCategories.push({
                        id: 'mcat_' + Date.now() + Math.random().toString(36).substr(2, 4),
                        name,
                        collapsed: false
                    });
                }
            } else if (type === 'ability') {
                char.abilityCategories = char.abilityCategories || [];
                if (id) {
                    const cat = char.abilityCategories.find((c) => c.id === id);
                    if (cat) cat.name = name;
                } else {
                    char.abilityCategories.push({
                        id: 'acat_' + Date.now() + Math.random().toString(36).substr(2, 4),
                        name,
                        collapsed: false
                    });
                }
            }
            closeCatModal();
            saveAndEmit(char);
            renderSheetData(char);
        });
    }

    function openCategoryModal(type = 'macro', catId = null) {
        const char = currentChar;
        if (!char) return;
        ensureCategoryModalExists();
        const modal = document.getElementById('pc-category-modal');
        const overlay = document.getElementById('pc-category-overlay');
        const titleEl = document.getElementById('modal-cat-title');
        const typeInp = document.getElementById('modal-cat-type');
        const idInp = document.getElementById('modal-cat-id');
        const nameInp = document.getElementById('modal-cat-name');

        typeInp.value = type;
        idInp.value = catId || '';

        const list = type === 'macro' ? char.macroCategories || [] : char.abilityCategories || [];
        const catName = catId ? list.find((c) => c.id === catId)?.name || '' : '';

        if (catId) {
            titleEl.innerHTML = `<i class="fa-solid fa-pen"></i> Edit Category`;
            nameInp.value = catName;
        } else {
            const typeLabel = type === 'macro' ? 'Attack' : 'Ability';
            titleEl.innerHTML = `<i class="fa-solid fa-folder-plus"></i> Create ${typeLabel} Category`;
            nameInp.value = '';
        }

        modal.classList.remove('vtt-hidden');
        overlay.classList.remove('vtt-hidden');
        setTimeout(() => nameInp.focus(), 50);
    }

    function ensureCategoryDeleteModalExists() {
        if (document.getElementById('pc-category-delete-modal')) return;

        const modalHtml = `
            <div id="pc-category-delete-overlay" class="vtt-sheet-submodal-overlay vtt-sheet-submodal-high vtt-hidden" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); z-index:3020;"></div>
            <div id="pc-category-delete-modal" class="vtt-sheet-submodal vtt-sheet-submodal-high vtt-hidden" style="position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); background:#1e1e1e; border:1px solid var(--color-border-subtle); border-radius:8px; z-index:3025; width:380px; max-width:92vw; padding:16px; box-shadow:0 4px 16px rgba(0,0,0,0.6);">
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--color-border-subtle); padding-bottom:10px; margin-bottom:12px;">
                    <h3 style="margin:0; color:#f44336; font-size:1.05rem;"><i class="fa-solid fa-trash"></i> Delete Category</h3>
                    <button id="modal-cat-del-close" style="background:transparent; border:none; color:var(--color-text-muted); cursor:pointer; font-size:1.2rem;"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <input type="hidden" id="modal-cat-del-type" value="macro">
                <input type="hidden" id="modal-cat-del-id" value="">
                <p style="font-size:0.85rem; color:var(--color-text-secondary); line-height:1.4; margin-bottom:16px;" id="modal-cat-del-msg">Are you sure you want to delete this category?</p>
                <div style="display:flex; justify-content:flex-end; gap:8px; border-top:1px solid var(--color-border-subtle); padding-top:12px;">
                    <button id="modal-cat-del-cancel" class="btn btn-secondary btn-xs">Cancel</button>
                    <button id="modal-cat-del-confirm" class="btn btn-danger btn-xs"><i class="fa-solid fa-trash"></i> Delete Category</button>
                </div>
            </div>
        `;
        const div = document.createElement('div');
        div.innerHTML = modalHtml;
        document.body.appendChild(div);

        const closeDelModal = () => {
            document.getElementById('pc-category-delete-modal').classList.add('vtt-hidden');
            document.getElementById('pc-category-delete-overlay').classList.add('vtt-hidden');
        };

        document.getElementById('modal-cat-del-close').addEventListener('click', closeDelModal);
        document.getElementById('modal-cat-del-cancel').addEventListener('click', closeDelModal);
        document.getElementById('pc-category-delete-overlay').addEventListener('click', closeDelModal);

        document.getElementById('modal-cat-del-confirm').addEventListener('click', () => {
            const char = currentChar;
            if (!char) return;
            const type = document.getElementById('modal-cat-del-type').value;
            const id = document.getElementById('modal-cat-del-id').value;

            if (type === 'macro') {
                (char.macros || [])
                    .filter((m) => m.categoryId === id)
                    .forEach((m) => {
                        m.categoryId = null;
                    });
                char.macroCategories = (char.macroCategories || []).filter((c) => c.id !== id);
            } else if (type === 'ability') {
                (char.abilityCards || [])
                    .filter((card) => card.categoryId === id)
                    .forEach((card) => {
                        card.categoryId = null;
                    });
                char.abilityCategories = (char.abilityCategories || []).filter((c) => c.id !== id);
            }

            closeDelModal();
            saveAndEmit(char);
            renderSheetData(char);
        });
    }

    function openCategoryDeleteModal(type, catId) {
        const char = currentChar;
        if (!char) return;
        ensureCategoryDeleteModalExists();
        const modal = document.getElementById('pc-category-delete-modal');
        const overlay = document.getElementById('pc-category-delete-overlay');
        const typeInp = document.getElementById('modal-cat-del-type');
        const idInp = document.getElementById('modal-cat-del-id');
        const msgEl = document.getElementById('modal-cat-del-msg');

        typeInp.value = type;
        idInp.value = catId;

        const list = type === 'macro' ? char.macroCategories || [] : char.abilityCategories || [];
        const cat = list.find((c) => c.id === catId);
        const catName = cat ? cat.name : 'this category';

        msgEl.innerHTML = `Are you sure you want to delete <b>"${catName}"</b>?<br><br><span style="font-size:0.8rem; color:var(--color-text-muted);">Contained items will return to <i>Uncategorized</i>.</span>`;

        modal.classList.remove('vtt-hidden');
        overlay.classList.remove('vtt-hidden');
    }

    const sheetCtx = {
        vtt,
        getCurrentChar: () => currentChar,
        saveAndEmit,
        renderSheetData,
        debouncedRenderSheetData,
        getModalOptions: () => getModalOptions(),
        openBagModal: (bagId) => openBagModal(bagId),
        openItemModal: (idx) => (window.openItemModal ? window.openItemModal(idx) : null),
        openCustomItemModal: (idx) => (window.openCustomItemModal ? window.openCustomItemModal(idx) : null),
        openSpellModal: (level, idx, c, cb, opts) => {
            const openFn = (window.VTTSpellManager && window.VTTSpellManager.openModal) || window.openSpellModal;
            if (openFn) openFn(level, idx, c, cb, opts);
        },
        renderSpellRowHtml: (sp, level, idx, isAllTab) =>
            window.vttPlayerSheetAPI.renderSpellRowHtml(sp, level, idx, isAllTab),
        promptUpcastLevel,
        simulateRoll,
        evaluateAbilityFormula,
        openCategoryModal: (type, id) => openCategoryModal(type, id),
        openCategoryDeleteModal: (type, id) => openCategoryDeleteModal(type, id),
        populateScalingModDropdown: (c, s) => populateScalingModDropdown(c, s),
        renderAbilityFields: (f) => renderAbilityFields(f),
        initializeImportTab: () => initializeImportTab(),
        getActiveSpellTab: () => activeSpellTab,
        setActiveSpellTab: (lvl) => {
            activeSpellTab = lvl;
        }
    };

    function renderSheetData(char) {
        if (!char) return;
        currentChar = char;

        if (window.VTTSpellManager) {
            if (typeof window.VTTSpellManager.init === 'function') {
                window.VTTSpellManager.init({
                    currentChar: currentChar,
                    saveAndEmit: saveAndEmit,
                    renderSheetData: renderSheetData,
                    spellCache: spellCache
                });
            }
            if (typeof window.VTTSpellManager.ensureSpellModalsExist === 'function') {
                window.VTTSpellManager.ensureSpellModalsExist();
            }
        }
        ensureAbilityModalsExist();
        ensureItemModalsExist();
        ensureMacroModalExists();
        ensureSaveSettingsModalExists();
        ensureSkillSettingsModalExists();
        ensureToolSettingsModalExists();
        ensurePlayerTokenEditModalExists();
        char.attackSettings = char.attackSettings || { atkMod: 0, toggles: [] };
        char.attackSettings.toggles = char.attackSettings.toggles || [];
        char.saveSettings = char.saveSettings || { saveMod: 0, toggles: [] };
        char.saveSettings.toggles = char.saveSettings.toggles || [];
        char.skillSettings = char.skillSettings || { toggles: [] };
        char.skillSettings.toggles = char.skillSettings.toggles || [];
        const prof = getProfBonus(char.level);

        const calculatedAtkBonus = (m) => {
            let baseAtkMod = char.attackSettings?.atkMod || 0;
            if (char.attackSettings?.toggles) {
                char.attackSettings.toggles
                    .filter((t) => t.enabled)
                    .forEach((t) => {
                        if (t.target === 'atk' || t.target === 'both') {
                            if (!t.formula.includes('d')) {
                                baseAtkMod += parseInt(t.formula) || 0;
                            }
                        }
                    });
            }

            const atkStat = m.attackStat || 'none';
            if (atkStat === 'custom') {
                return m.attackBonus || '';
            }
            if (atkStat === 'none') {
                return m.attackBonus || '';
            }
            const statScore = getTotalStat(char, atkStat.toLowerCase()) || 10;
            const statMod = getMod(statScore);
            const pr = m.attackProf ? prof : 0;
            const extra = m.attackExtra !== undefined ? parseInt(m.attackExtra) : 0;
            const total = statMod + pr + extra + baseAtkMod;
            return (total >= 0 ? '+' : '') + total;
        };

        const calculatedSaveDc = (m) => {
            const dcStat = m.saveDcStat || 'none';
            if (dcStat === 'custom') {
                return m.saveDcCustom !== undefined && m.saveDcCustom !== null
                    ? m.saveDcCustom
                    : m.saveDcBase || 8 + prof + getMod(getTotalStat(char, (char.dcAbility || 'INT').toLowerCase()));
            }
            const pr = prof;
            let statMod = 0;
            if (dcStat === 'none') {
                statMod = getMod(getTotalStat(char, (char.dcAbility || 'INT').toLowerCase()) || 10);
            } else {
                statMod = getMod(getTotalStat(char, dcStat.toLowerCase()) || 10);
            }
            const extra = m.saveDcExtra !== undefined ? parseInt(m.saveDcExtra) : 0;
            return 8 + pr + statMod + extra;
        };

        char.equipment = Array.isArray(char.equipment)
            ? char.equipment
            : [{ id: 'eq_legacy', name: 'Legacy Equipment', qty: 1, description: char.equipment || '' }];

        if (!char.classes) {
            char.classes = [{ name: char.class || '', subclass: '', level: char.level || 1 }];
        }

        if (!char.subrace && char.race && char.race.includes('(')) {
            const parenMatch = char.race.match(/^([^(]+)\s*\(([^)]+)\)(.*)$/);
            if (parenMatch) {
                char.race = parenMatch[1].trim();
                char.subrace = parenMatch[2].replace(/^variant;\s*/i, '').trim();
            }
        }
        if (char.subrace) {
            char.subrace = char.subrace.replace(/^variant;\s*/i, '').trim();
        }

        if (typeof char.speed === 'number' || typeof char.speed === 'string') {
            char.speed = { walk: parseInt(char.speed) || 30, climb: 0, fly: 0, burrow: 0 };
        } else if (!char.speed) {
            char.speed = { walk: 30, climb: 0, fly: 0, burrow: 0 };
        }

        char.senses = char.senses || { darkvision: 0, devilSight: 0, blindsight: 0, truesight: 0 };
        const maxSpecialVision = Math.max(
            parseInt(char.senses.darkvision) || 0,
            parseInt(char.senses.devilSight) || 0,
            parseInt(char.senses.blindsight) || 0,
            parseInt(char.senses.truesight) || 0
        );
        if (char.tokenSight === undefined) {
            if (char.isCompanion && char.monsterData) {
                char.tokenSight = window.parseMonsterVision ? window.parseMonsterVision(char.monsterData) : 5;
            } else {
                char.tokenSight = maxSpecialVision > 0 ? maxSpecialVision : 60;
            }
        }

        char.spells =
            typeof char.spells === 'object' && char.spells !== null && !Array.isArray(char.spells)
                ? char.spells
                : {
                      cantrip: [],
                      level1: [],
                      level2: [],
                      level3: [],
                      level4: [],
                      level5: [],
                      level6: [],
                      level7: [],
                      level8: [],
                      level9: [],
                      legacy: [{ id: 'sp_legacy', name: 'Legacy Spells', description: char.spells || '' }]
                  };
        for (let i = 1; i <= 9; i++) {
            if (Array.isArray(char.spells[String(i)]) && char.spells[String(i)].length > 0) {
                const targetKey = 'level' + i;
                char.spells[targetKey] = char.spells[targetKey] || [];
                char.spells[String(i)].forEach((sp) => {
                    if (
                        !char.spells[targetKey].some(
                            (s) => (s.name || '').toLowerCase() === (sp.name || '').toLowerCase()
                        )
                    ) {
                        char.spells[targetKey].push(sp);
                    }
                });
                delete char.spells[String(i)];
            }
        }
        if (char.proficiencies) {
            ['languages', 'weapons', 'armor', 'tools'].forEach((type) => {
                if (char.proficiencies[type] && char.proficiencies[type].includes('{@')) {
                    char.proficiencies[type] = sanitizeProficienciesText(char.proficiencies[type], type === 'weapons');
                }
            });
        }
        char.bio = char.bio || { height: '', age: '', weight: '', backstory: '', notes: char.info || '' };
        char.abilityCards = char.abilityCards || [];
        char.abilityCategories = char.abilityCategories || [];
        char.abilityCards.forEach((c) => {
            if (c.categoryId === undefined) c.categoryId = null;
        });
        char.macros = char.macros || [];
        char.macroCategories = char.macroCategories || [];
        char.macros.forEach((m) => {
            if (m.categoryId === undefined) m.categoryId = null;
        });
        char.spellSlots = char.spellSlots || {
            level1: { current: 0, max: 0 },
            level2: { current: 0, max: 0 },
            level3: { current: 0, max: 0 },
            level4: { current: 0, max: 0 },
            level5: { current: 0, max: 0 },
            level6: { current: 0, max: 0 },
            level7: { current: 0, max: 0 },
            level8: { current: 0, max: 0 },
            level9: { current: 0, max: 0 }
        };
        char.macros = char.macros.map((m) => {
            if (m.damage !== undefined && !Array.isArray(m.damage)) {
                return {
                    id: m.id || 'mac_' + Date.now(),
                    name: m.name || '',
                    attackBonus: m.bonus || '',
                    saveAbility: '',
                    saveDcBase: '',
                    damage: m.damage ? [{ id: 'dmg_' + Date.now(), formula: m.damage, type: '' }] : []
                };
            }
            return m;
        });
        char.toHit = char.toHit || '';
        char.dcAbility = char.dcAbility || 'INT';
        char.spellAbility = char.spellAbility || 'INT';
        char.skills = char.skills || {};
        char.expertise = char.expertise || {};
        char.tools = char.tools || {};
        char.saves = char.saves || {};
        char.statMods = char.statMods || { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
        char.deathSaves = char.deathSaves || { successes: 0, failures: 0 };
        char.globalSaveMod = char.globalSaveMod || 0;
        char.saveMods = char.saveMods || { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
        char.saveToggles = char.saveToggles || [];
        char.globalAbilityMod = char.globalAbilityMod || '0';
        char.skillMods = char.skillMods || {};
        char.skillToggles = char.skillToggles || [];
        char.hpToggles = char.hpToggles || [];
        char.acToggles = char.acToggles || [];
        if (char.baseHpMax === undefined || char.baseHpMax === null) {
            char.baseHpMax = parseInt(char.hpMax) || 10;
        }
        if (char.baseAc === undefined || char.baseAc === null) {
            char.baseAc = parseInt(char.ac) || 10;
        }
        char.tokenImages = Array.isArray(char.tokenImages)
            ? char.tokenImages
            : char.tokenImages
              ? [char.tokenImages]
              : [];
        if (
            typeof char.activeTokenIndex !== 'number' ||
            char.activeTokenIndex < 0 ||
            (char.tokenImages.length > 0 && char.activeTokenIndex >= char.tokenImages.length)
        ) {
            char.activeTokenIndex = 0;
        }
        char.proficiencies = char.proficiencies || { languages: '', weapons: '', armor: '' };
        char.inspiration = !!char.inspiration;
        char.heroPoints = typeof char.heroPoints === 'number' ? char.heroPoints : parseInt(char.heroPoints) || 0;

        const activeImageUrl = getPlayerActiveTokenUrl(char);

        const hdMax = {};
        if (char.classes && char.classes.length > 0) {
            char.classes.forEach((c) => {
                const hd = getClassHitDie(c.name);
                hdMax[hd] = (hdMax[hd] || 0) + (parseInt(c.level) || 1);
            });
        } else {
            hdMax['d8'] = char.level || 1;
        }

        char.hitDiceSpent = char.hitDiceSpent || {};

        let hdHtml =
            '<div class="cs-hp-row" style="display:flex; align-items:center; justify-content:flex-start; gap:16px; flex-wrap:wrap; background:rgba(0,0,0,0.1); border-top:1px solid rgba(255,255,255,0.03);">';
        hdHtml +=
            '<div class="cs-hp-label" style="margin-right:8px; margin-bottom:0;"><i class="fa-solid fa-dice-d20"></i> Hit Dice</div>';
        Object.keys(hdMax)
            .sort()
            .forEach((hd) => {
                const max = hdMax[hd];
                const spent = char.hitDiceSpent[hd] || 0;
                const remaining = Math.max(0, max - spent);

                hdHtml +=
                    '<div style="display:flex; align-items:center; gap:6px; background:rgba(0,0,0,0.2); padding:4px 8px; border-radius:8px; border:1px solid rgba(255,255,255,0.05);">';
                hdHtml +=
                    '<div style="font-family:var(--font-heading); font-size:0.8rem; color:var(--color-gold-light); font-weight:bold;">' +
                    hd.toUpperCase() +
                    '</div>';
                hdHtml +=
                    '<div style="font-family:var(--font-code); font-size:0.85rem; color:var(--color-text-secondary);">' +
                    remaining +
                    '/' +
                    max +
                    '</div>';
                hdHtml +=
                    '<button class="pc-roll-hd btn btn-xs btn-primary" data-hd="' +
                    hd +
                    '" data-rem="' +
                    remaining +
                    '" ' +
                    (remaining <= 0 ? 'disabled' : '') +
                    ' style="padding:2px 6px; font-size:0.7rem;"><i class="fa-solid fa-dice"></i></button>';
                hdHtml +=
                    '<button class="pc-reset-hd btn btn-xs btn-secondary" data-hd="' +
                    hd +
                    '" style="padding:2px 6px; font-size:0.7rem;" title="Reset 1 spent"><i class="fa-solid fa-rotate-left"></i></button>';
                hdHtml += '</div>';
            });
        hdHtml += '</div>';

        let restHtml =
            '<div style="display:flex; align-items:center; justify-content:flex-start; gap:12px; padding:6px 12px; background:rgba(0,0,0,0.15); border-top:1px solid rgba(255,255,255,0.06); border-bottom:1px solid rgba(255,255,255,0.06); margin-top:8px; border-radius:4px; width:100%;">';
        restHtml +=
            '<span style="font-family:var(--font-heading); font-size:0.75rem; color:var(--color-gold-base); text-transform:uppercase; letter-spacing:0.5px; font-weight:700; margin-right:4px; display:flex; align-items:center; gap:6px;"><i class="fa-solid fa-campground"></i> Rests</span>';
        restHtml +=
            '<button class="btn btn-xs btn-secondary" id="pc-short-rest-btn" style="padding:3px 10px; font-size:0.75rem; display:inline-flex; align-items:center; gap:6px;" title="Restore Short Rest Abilities"><i class="fa-solid fa-mug-hot"></i> Short Rest</button>';
        restHtml +=
            '<button class="btn btn-xs btn-primary" id="pc-long-rest-btn" style="padding:3px 10px; font-size:0.75rem; display:inline-flex; align-items:center; gap:6px;" title="Restore all Abilities, HP, Spell Slots & regain half Hit Dice"><i class="fa-solid fa-bed"></i> Long Rest</button>';
        restHtml += '</div>';

        const cleanUrl = activeImageUrl.split('?')[0].toLowerCase();
        const isVideo = cleanUrl.match(/\.(mp4|webm|ogg)$/i);
        const isYoutube = cleanUrl.includes('youtube.com') || cleanUrl.includes('youtu.be');

        let mediaHtml = '';
        if (isVideo) {
            mediaHtml = `<video src="${activeImageUrl}" draggable="false" autoplay loop muted playsinline style="width: 100%; height: 100%; object-fit: cover;"></video>`;
        } else if (isYoutube) {
            let ytUrl = activeImageUrl;
            const ytMatch = activeImageUrl.match(
                /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i
            );
            if (ytMatch) {
                const videoId = ytMatch[1];
                ytUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&loop=1&controls=0&disablekb=1&fs=0&modestbranding=1&playsinline=1&playlist=${videoId}`;
            }
            mediaHtml = `<iframe src="${ytUrl}" draggable="false" frameborder="0" style="width: 100%; height: 100%; pointer-events:none;"></iframe>`;
        } else {
            mediaHtml = `<img src="${activeImageUrl}" draggable="false" style="width: 100%; height: 100%; object-fit: cover;">`;
        }

        const classSummaryText =
            char.classes && char.classes.length > 0
                ? char.classes.map((c) => `${c.name}${c.subclass ? ` (${c.subclass})` : ''} Lv ${c.level}`).join(' / ')
                : char.class || 'Level 1';
        const raceSummaryText = `${char.race || 'Species'}${char.subrace ? ` (${char.subrace})` : ''}`;
        const bgSummaryText = char.background || 'Background';

        const primaryHtml = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <div style="display:flex; align-items:center; gap:12px; width:100%;">
                    <div id="pc-token-portrait" draggable="true" title="Manage / Drag to spawn Token" style="width: 48px; height: 48px; border-radius: 50%; overflow: hidden; border: 2px solid var(--color-gold-base); cursor: pointer; flex-shrink: 0; box-shadow: 0 2px 8px rgba(0,0,0,0.5);">
                        ${mediaHtml}
                    </div>
                    <div style="flex:1; min-width:0;">
                        <input type="text" id="pc-name" value="${char.name}" style="font-size:1.35rem; font-family:var(--font-heading); font-weight:700; width:100%; background:transparent; border:none; border-bottom:1px solid var(--color-border-subtle); padding:2px 0;">
                        <div style="font-size:0.8rem; color:var(--color-text-secondary); margin-top:2px; display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                            <span style="color:var(--color-gold-light);"><i class="fa-solid fa-shield"></i> ${classSummaryText}</span>
                            <span style="opacity:0.4;">&bull;</span>
                            <span style="color:#80cbc4;"><i class="fa-solid fa-dna"></i> ${raceSummaryText}</span>
                            <span style="opacity:0.4;">&bull;</span>
                            <span style="color:#ce93d8;"><i class="fa-solid fa-scroll"></i> ${bgSummaryText}</span>
                        </div>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:4px; align-items:center; justify-content:center; flex-shrink:0;">
                        <button class="btn btn-secondary btn-xs" id="pc-open-character-builder-btn" style="width:24px; height:24px; padding:0; display:flex; align-items:center; justify-content:center; border-color:rgba(212,175,55,0.4); color:var(--color-gold-light);" title="Character Builder & Level Up Wizard">
                            <i class="fa-solid fa-wand-magic-sparkles" style="color:var(--color-gold-base); font-size:0.75rem;"></i>
                        </button>
                        ${vtt.role === 'GM' ? '<button class="btn btn-secondary btn-xs" id="pc-assign-players-btn" style="width:24px; height:24px; padding:0; display:flex; align-items:center; justify-content:center;" title="Assign Players to this Sheet"><i class="fa-solid fa-users" style="font-size:0.75rem;"></i></button>' : ''}
                        ${!vtt.isStandaloneSheet ? '<button class="btn btn-secondary btn-xs pc-popout-btn" id="pc-btn-popout" style="width:24px; height:24px; padding:0; display:flex; align-items:center; justify-content:center;" title="Open Sheet in New Tab"><i class="fa-solid fa-arrow-up-right-from-square" style="font-size:0.75rem;"></i></button>' : ''}
                    </div>
                </div>
            </div>
            
            <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:16px;">
                <div class="cs-stat-pill pc-inspiration-pill ${char.inspiration ? 'active' : ''}" id="pc-inspiration-toggle" style="cursor:pointer; user-select:none; flex:1; display:flex; align-items:center; justify-content:center; gap:8px; height:36px; padding:6px 12px; border-radius:20px; font-size:0.9rem; font-family:var(--font-heading); ${char.inspiration ? 'border:1.5px solid var(--color-gold-base); background:rgba(212,175,55,0.25); color:var(--color-gold-light); box-shadow:0 0 12px rgba(212,175,55,0.4);' : 'background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.1); opacity:0.8;'}" title="Toggle DM Inspiration">
                    <i class="fa-solid fa-dice-d20" style="font-size:1.05rem; ${char.inspiration ? 'color:var(--color-gold-light); text-shadow:0 0 8px var(--color-gold-base);' : 'color:var(--color-text-muted);'}"></i>
                    <span style="font-weight:600; font-size:0.9rem; letter-spacing:0.5px;">Inspired</span>
                </div>
                <div class="cs-stat-pill" style="flex:1; display:flex; align-items:center; justify-content:center; gap:8px; height:36px; padding:6px 12px; border-radius:20px; font-size:0.9rem; font-family:var(--font-heading); background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.1);" title="Hero Points">
                    <i class="fa-solid fa-shield-heart" style="font-size:1.05rem; color:var(--color-gold-base);"></i>
                    <span style="font-size:0.9rem; font-weight:600; letter-spacing:0.5px;">Hero Pts</span>
                    <div style="display:flex; align-items:center; gap:4px; margin-left:auto;">
                        <button class="cs-hp-btn" id="pc-hero-minus" style="padding:0; height:22px; width:22px; font-size:0.85rem; display:flex; align-items:center; justify-content:center;" title="Spend Hero Point">−</button>
                        <input type="text" inputmode="numeric" pattern="[0-9]*" id="pc-hero-points-input" value="${char.heroPoints || 0}" style="width:26px; background:transparent; border:none; color:var(--color-gold-light); text-align:center; font-family:var(--font-heading); font-size:1rem; font-weight:bold; padding:0;">
                        <button class="cs-hp-btn" id="pc-hero-plus" style="padding:0; height:22px; width:22px; font-size:0.85rem; display:flex; align-items:center; justify-content:center;" title="Add Hero Point">+</button>
                    </div>
                </div>
            </div>
            
            <div class="cs-hp-container" style="margin-bottom:16px;">
                <div style="display: flex; gap: 4px; margin-bottom: 8px; align-items: center;">
                    <div class="cs-hp-bar-wrap" style="flex: 1; height: 10px; background: rgba(0,0,0,0.3); border-radius: 4px; overflow: hidden;">
                        <div class="cs-hp-bar-fill" id="pc-hp-bar" style="height: 100%; background-color: var(--color-success-base, #4caf50); width: ${char.hpMax > 0 ? Math.round((char.hpCurrent / char.hpMax) * 100) : 100}%"></div>
                    </div>
                    ${
                        char.tempHp > 0
                            ? `
                    <div class="cs-hp-bar-wrap" style="flex: 0 0 20%; height: 10px; background: rgba(0,0,0,0.3); border-radius: 4px; overflow: hidden;" title="Temp HP">
                        <div class="cs-hp-bar-fill cs-temp-hp-bar-fill" id="pc-temp-hp-bar" style="height: 100%; background-color: var(--color-temphp-base, #2196f3); width: 100%;"></div>
                    </div>`
                            : ''
                    }
                </div>
                <div class="cs-hp-row" style="display:flex; align-items:center; justify-content:space-between; gap:16px;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <div class="cs-hp-label" style="font-size:0.85rem; font-weight:600; margin-bottom:0; display:flex; align-items:center; gap:6px;">
                            <button class="btn btn-xs pc-hp-settings-btn" style="background:transparent; border:none; color:var(--color-text-muted); cursor:pointer; padding:0;" title="Configure HP Settings & Toggles"><i class="fa-solid fa-cog"></i></button>
                            <i class="fa-solid fa-heart" style="color:#e53935; font-size:0.95rem;"></i> HP
                        </div>
                        <div class="cs-hp-controls" style="margin-bottom:0;">
                            <button class="cs-hp-btn" id="pc-hp-minus" title="Damage">−</button>
                            <div class="cs-hp-display" style="display:flex; align-items:center;">
                                <input type="text" inputmode="numeric" pattern="[0-9]*" id="pc-hp-current-input" value="${char.hpCurrent}" style="width:32px; background:transparent; border:none; color:var(--color-text-primary); text-align:right; font-family:var(--font-heading); font-size:1rem; font-weight:700; padding:0;">
                                <span class="cs-hp-divider" style="margin:0 2px;">/</span>
                                <span id="pc-hp-max" style="font-size:1rem; font-weight:700;">${char.hpMax}</span>
                            </div>
                            <button class="cs-hp-btn" id="pc-hp-plus" title="Heal">+</button>
                        </div>
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <div class="cs-hp-label" style="font-size:0.85rem; font-weight:600; margin-bottom:0; display:flex; align-items:center; gap:4px;">
                            <i class="fa-solid fa-shield" style="color:#2196f3; font-size:0.95rem;"></i> Temp
                        </div>
                        <div class="cs-hp-controls" style="margin-bottom:0;">
                            <button class="cs-hp-btn" id="pc-temp-hp-minus" title="Reduce Temp HP">−</button>
                            <div class="cs-hp-display" style="display:flex; align-items:center; justify-content:center;">
                                <input type="text" inputmode="numeric" pattern="[0-9]*" id="pc-temp-hp-current" value="${char.tempHp || 0}" style="width:32px; background:transparent; border:none; color:var(--color-text-primary); text-align:center; font-family:var(--font-heading); font-size:1rem; font-weight:700; padding:0;">
                            </div>
                            <button class="cs-hp-btn" id="pc-temp-hp-plus" title="Add Temp HP">+</button>
                        </div>
                    </div>
                </div>
                ${
                    char.hpToggles && char.hpToggles.length > 0
                        ? `
                <div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:8px;">
                    ${char.hpToggles
                        .map(
                            (t, i) => `
                        <button class="btn btn-xxs btn-secondary pc-hp-quick-toggle" data-idx="${i}" style="border-radius:12px; padding:2px 8px; font-size:0.75rem; background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle);" title="Toggle ${t.name}">
                            <i class="fa-solid fa-circle" style="color:${t.enabled ? '#4caf50' : '#f44336'}; font-size:0.5rem; margin-right:4px;"></i> ${t.name}
                        </button>
                    `
                        )
                        .join('')}
                </div>`
                        : ''
                }
                ${hdHtml}
                ${restHtml}
            </div>

            <div class="cs-core-stats" style="margin-bottom:16px; display:flex; justify-content:space-between; align-items:center; flex-wrap:nowrap; gap:12px;">
                <div style="flex-shrink:0; display:flex; flex-direction:column; gap:6px;">
                    <div style="display:flex; align-items:center; gap:6px;">
                        <div class="cs-stat-pill" style="font-size:1.5rem; padding:8px 16px; border:2px solid var(--color-gold-base);"><i class="fa-solid fa-shield-halved"></i><span style="font-weight:bold;">AC ${char.ac}</span></div>
                        <button class="btn btn-xs pc-ac-settings-btn" style="background:transparent; border:none; color:var(--color-text-muted); cursor:pointer; padding:2px;" title="Configure AC Settings & Toggles"><i class="fa-solid fa-cog"></i></button>
                    </div>
                    ${
                        char.acToggles && char.acToggles.length > 0
                            ? `
                    <div style="display:flex; flex-wrap:wrap; gap:4px; max-width:240px;">
                        ${char.acToggles
                            .map(
                                (t, i) => `
                            <button class="btn btn-xxs btn-secondary pc-ac-quick-toggle" data-idx="${i}" style="border-radius:12px; padding:2px 8px; font-size:0.75rem; background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle);" title="Toggle ${t.name}">
                                <i class="fa-solid fa-circle" style="color:${t.enabled ? '#4caf50' : '#f44336'}; font-size:0.5rem; margin-right:4px;"></i> ${t.name}
                            </button>
                        `
                            )
                            .join('')}
                    </div>`
                            : ''
                    }
                </div>
                <div style="display:flex; flex-wrap:wrap; gap:8px; justify-content:flex-end; align-items:center; flex:1; min-width:0;">
                    ${Object.entries(char.speed)
                        .filter(([k, v]) => v > 0)
                        .map(([k, v]) => {
                            const icons = {
                                walk: 'fa-shoe-prints',
                                climb: 'fa-mountain',
                                fly: 'fa-feather-pointed',
                                burrow: 'fa-trowel'
                            };
                            return (
                                '<div class="cs-stat-pill"><i class="fa-solid ' +
                                (icons[k] || 'fa-shoe-prints') +
                                '"></i><span>' +
                                k.charAt(0).toUpperCase() +
                                k.slice(1) +
                                ' ' +
                                v +
                                ' ft</span></div>'
                            );
                        })
                        .join('')}
                    <div class="cs-stat-pill"><i class="fa-solid fa-star"></i><span>Prof +${prof}</span></div>
                </div>
            </div>

            <!-- Reverted Ability Grid to full width -->
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                <div style="display:flex; align-items:center; gap:8px;">
                    <button class="btn btn-xs pc-save-settings-btn" style="background:transparent; border:none; color:var(--color-text-muted); cursor:pointer; padding:0;" title="Configure Save Mods & Toggles"><i class="fa-solid fa-cog"></i></button>
                    <h4 style="margin:0; color:var(--color-gold-base); font-family:var(--font-heading);">Stats and Saves</h4>
                </div>
            </div>
            <div class="cs-ability-grid" style="margin-bottom: ${char.saveToggles && char.saveToggles.length > 0 ? '12px' : '24px'};">
                ${['str', 'dex', 'con', 'int', 'wis', 'cha']
                    .map((ab) => {
                        const score = getTotalStat(char, ab) || 10;
                        const mod = getMod(score);
                        const modStr = mod >= 0 ? '+' + mod : mod;
                        return `
                        <div class="cs-ability-cell" data-ab="${ab}" data-mod="${mod}">
                            <span class="cs-ability-label">${ab.toUpperCase()}</span>
                            <span class="cs-ability-score">${score}</span>
                            <span class="cs-ability-mod">${modStr}</span>
                            <div class="cs-ability-actions" style="margin-top:4px;">
                                <span class="cs-ability-action-btn pc-roll-check" data-ab="${ab}" data-mod="${mod}" title="Roll Check">Check</span>
                                <div style="display:flex; align-items:center; gap:2px; justify-content:center; background:rgba(0,0,0,0.2); border-radius:3px; padding-left:4px;">
                                    <span class="cs-ability-action-btn pc-roll-save" data-ab="${ab}" data-mod="${mod}" title="Roll Save" style="background:none; border-radius:3px; padding: 2px 8px;">Save</span>
                                </div>
                            </div>
                        </div>
                    `;
                    })
                    .join('')}
            </div>

            ${
                char.saveToggles && char.saveToggles.length > 0
                    ? `
            <div style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:24px;">
                ${char.saveToggles
                    .map(
                        (t, i) => `
                    <button class="btn btn-xxs btn-secondary pc-save-quick-toggle" data-idx="${i}" style="border-radius:12px; padding:2px 8px; font-size:0.75rem; background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle);">
                        <i class="fa-solid fa-circle" style="color:${t.enabled ? '#4caf50' : '#f44336'}; font-size:0.5rem; margin-right:4px;"></i> ${t.name}
                    </button>
                `
                    )
                    .join('')}
            </div>`
                    : ''
            }

            <div style="display:block;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <button class="btn btn-xs pc-skill-settings-btn" style="background:transparent; border:none; color:var(--color-text-muted); cursor:pointer; padding:0;" title="Configure Skill Mods & Toggles"><i class="fa-solid fa-cog"></i></button>
                        <h4 style="margin:0; color:var(--color-gold-base); font-family:var(--font-heading);">Skill Checks</h4>
                    </div>
                    <button class="btn btn-xs btn-primary pc-roll-init" title="Roll Initiative"><i class="fa-solid fa-dice-d20"></i> Initiative</button>
                </div>
                ${(() => {
                    const calcPass = (sName, abKey) => {
                        const bMod = getMod(getTotalStat(char, abKey) || 10);
                        const isP = !!(char.skills && char.skills[sName]);
                        const isE = !!(char.expertise && char.expertise[sName]);
                        let score = 10 + bMod + (isP ? prof : 0) + (isE ? prof : 0);
                        score += parseInt(char.passiveSkillMods?.[sName]) || 0;
                        if (char.skillToggles && Array.isArray(char.skillToggles)) {
                            char.skillToggles
                                .filter((t) => t.enabled)
                                .forEach((t) => {
                                    const tgt = (t.target || '').toLowerCase();
                                    const sLow = sName.toLowerCase();
                                    if (tgt === 'passive_all' || tgt === `passive_${sLow}`) {
                                        score += parseInt(t.formula) || 0;
                                    }
                                });
                        }
                        return score;
                    };
                    return `
                        <div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:12px; font-size:0.75rem;">
                            <div style="background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle); border-radius:12px; padding:2px 10px; display:inline-flex; align-items:center; gap:6px;">
                                <span style="color:var(--color-text-muted);">Passive Perception:</span>
                                <strong style="color:var(--color-gold-light); font-size:0.85rem; font-family:var(--font-code);">${calcPass('Perception', 'wis')}</strong>
                            </div>
                            <div style="background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle); border-radius:12px; padding:2px 10px; display:inline-flex; align-items:center; gap:6px;">
                                <span style="color:var(--color-text-muted);">Passive Investigation:</span>
                                <strong style="color:var(--color-gold-light); font-size:0.85rem; font-family:var(--font-code);">${calcPass('Investigation', 'int')}</strong>
                            </div>
                            <div style="background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle); border-radius:12px; padding:2px 10px; display:inline-flex; align-items:center; gap:6px;">
                                <span style="color:var(--color-text-muted);">Passive Insight:</span>
                                <strong style="color:var(--color-gold-light); font-size:0.85rem; font-family:var(--font-code);">${calcPass('Insight', 'wis')}</strong>
                            </div>
                        </div>
                    `;
                })()}
                <div id="pc-skills-list" style="display:grid; grid-template-columns: 1fr 1fr; gap:4px; margin-bottom: 24px;">
                    ${[
                        { name: 'Acrobatics', ability: 'dex' },
                        { name: 'Animal Handling', ability: 'wis' },
                        { name: 'Arcana', ability: 'int' },
                        { name: 'Athletics', ability: 'str' },
                        { name: 'Deception', ability: 'cha' },
                        { name: 'History', ability: 'int' },
                        { name: 'Insight', ability: 'wis' },
                        { name: 'Intimidation', ability: 'cha' },
                        { name: 'Investigation', ability: 'int' },
                        { name: 'Medicine', ability: 'wis' },
                        { name: 'Nature', ability: 'int' },
                        { name: 'Perception', ability: 'wis' },
                        { name: 'Performance', ability: 'cha' },
                        { name: 'Persuasion', ability: 'cha' },
                        { name: 'Religion', ability: 'int' },
                        { name: 'Sleight of Hand', ability: 'dex' },
                        { name: 'Stealth', ability: 'dex' },
                        { name: 'Survival', ability: 'wis' }
                    ]
                        .map((skill) => {
                            const isProf = char.skills[skill.name];
                            const isExp = char.expertise[skill.name];
                            const baseMod = getMod(getTotalStat(char, skill.ability) || 10);
                            const totalMod = baseMod + (isProf ? prof : 0) + (isExp ? prof : 0);
                            let modStr = totalMod >= 0 ? '+' + totalMod : totalMod;
                            const customMod = char.skillMods[skill.name] || '0';
                            if (customMod !== '0') {
                                if (customMod.includes('d')) {
                                    modStr +=
                                        customMod.startsWith('+') || customMod.startsWith('-')
                                            ? customMod
                                            : '+' + customMod;
                                } else {
                                    const m = parseInt(customMod) || 0;
                                    const newMod = totalMod + m;
                                    modStr = newMod >= 0 ? '+' + newMod : newMod;
                                }
                            }

                            let totalAtkData = totalMod;
                            if (customMod !== '0') {
                                totalAtkData = customMod.includes('d')
                                    ? totalMod +
                                      (customMod.startsWith('+') || customMod.startsWith('-')
                                          ? customMod
                                          : '+' + customMod)
                                    : totalMod + parseInt(customMod);
                            }

                            return `
                            <div class="skill-row glass-flat" style="display:flex; justify-content:space-between; align-items:center; padding:4px 8px; font-size:0.85rem;">
                                <div style="display:flex; align-items:center; gap:8px;">
                                    ${isExp ? '<i class="fa-solid fa-star" style="color:var(--color-gold-base); font-size:0.7rem;" title="Expertise"></i>' : isProf ? '<i class="fa-solid fa-star-half-stroke" style="color:var(--color-gold-base); font-size:0.7rem;" title="Proficient"></i>' : '<i class="fa-regular fa-star" style="color:var(--color-text-muted); font-size:0.7rem;" title="No Proficiency"></i>'}
                                    <span class="pc-skill-roll" data-skill="${skill.name}" data-mod="${totalAtkData}" style="cursor:pointer; font-weight:500;" title="Roll ${skill.name}">
                                        ${skill.name} <span style="color:var(--color-text-muted); font-size:0.7rem;">(${skill.ability.toUpperCase()})</span>
                                    </span>
                                </div>
                                <div style="font-family:var(--font-code); color:var(--color-gold-light); font-weight:600;">${modStr}</div>
                            </div>
                        `;
                        })
                        .join('')}
                </div>

            ${
                char.skillToggles && char.skillToggles.length > 0
                    ? `
            <div style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:24px;">
                ${char.skillToggles
                    .map(
                        (t, i) => `
                    <button class="btn btn-xxs btn-secondary pc-skill-quick-toggle" data-idx="${i}" style="border-radius:12px; padding:2px 8px; font-size:0.75rem; background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle);">
                        <i class="fa-solid fa-circle" style="color:${t.enabled ? '#4caf50' : '#f44336'}; font-size:0.5rem; margin-right:4px;"></i> ${t.name}
                    </button>
                `
                    )
                    .join('')}
            </div>`
                    : ''
            }

            <div style="display:block; margin-top:12px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <button class="btn btn-xs pc-tool-settings-btn" style="background:transparent; border:none; color:var(--color-text-muted); cursor:pointer; padding:0;" title="Configure Tool Proficiencies & Mods"><i class="fa-solid fa-cog"></i></button>
                        <h4 style="margin:0; color:var(--color-gold-base); font-family:var(--font-heading);">Tool Checks</h4>
                    </div>
                </div>
                <div id="pc-tools-list" style="display:grid; grid-template-columns: 1fr 1fr; gap:4px; margin-bottom: 24px;">
                    ${Object.entries(char.tools || {})
                        .filter(([k, v]) => v.show)
                        .map(([toolName, tool]) => {
                            const isProf = tool.prof;
                            const isExp = tool.exp;
                            const baseMod = getMod(getTotalStat(char, tool.ability) || 10);
                            const totalMod = baseMod + (isProf ? prof : 0) + (isExp ? prof : 0);
                            let modStr = totalMod >= 0 ? '+' + totalMod : totalMod;
                            const customMod = tool.mod || '0';
                            if (customMod !== '0') {
                                if (customMod.includes('d')) {
                                    modStr +=
                                        customMod.startsWith('+') || customMod.startsWith('-')
                                            ? customMod
                                            : '+' + customMod;
                                } else {
                                    const m = parseInt(customMod) || 0;
                                    const newMod = totalMod + m;
                                    modStr = newMod >= 0 ? '+' + newMod : newMod;
                                }
                            }

                            let totalAtkData = totalMod;
                            if (customMod !== '0') {
                                totalAtkData = customMod.includes('d')
                                    ? totalMod +
                                      (customMod.startsWith('+') || customMod.startsWith('-')
                                          ? customMod
                                          : '+' + customMod)
                                    : totalMod + parseInt(customMod);
                            }

                            return `
                            <div class="skill-row glass-flat" style="display:flex; justify-content:space-between; align-items:center; padding:4px 8px; font-size:0.85rem;">
                                <div style="display:flex; align-items:center; gap:8px;">
                                    ${isExp ? '<i class="fa-solid fa-star" style="color:var(--color-gold-base); font-size:0.7rem;" title="Expertise"></i>' : isProf ? '<i class="fa-solid fa-star-half-stroke" style="color:var(--color-gold-base); font-size:0.7rem;" title="Proficient"></i>' : '<i class="fa-regular fa-star" style="color:var(--color-text-muted); font-size:0.7rem;" title="No Proficiency"></i>'}
                                    <span class="pc-tool-roll" data-tool="${toolName}" data-mod="${totalAtkData}" style="cursor:pointer; font-weight:500;" title="Roll ${toolName}">
                                        ${toolName} <span style="color:var(--color-text-muted); font-size:0.7rem;">(${tool.ability.toUpperCase()})</span>
                                    </span>
                                </div>
                                <div style="font-family:var(--font-code); color:var(--color-gold-light); font-weight:600;">${modStr}</div>
                            </div>
                        `;
                        })
                        .join('')}
                </div>
            </div>

            </div>

                    </div>
                </div>

                ${renderOtherProficienciesHtml(char)}

                <div style="display:flex; justify-content:center; align-items:center; margin-top:24px; margin-bottom:12px; gap: 16px; background: rgba(0,0,0,0.2); padding: 12px; border-radius: 8px; border: 1px solid var(--color-border-subtle);">
                    <div style="display:flex; gap:4px; align-items:center;">
                        <span style="font-size:0.75rem; color:var(--color-text-muted); margin-right:4px; font-family:var(--font-heading);">FAILURES</span>
                        <input type="checkbox" class="pc-ds-failure" data-idx="3" ${char.deathSaves.failures >= 3 ? 'checked' : ''} style="cursor:pointer; width:16px; height:16px; accent-color: #f44336;">
                        <input type="checkbox" class="pc-ds-failure" data-idx="2" ${char.deathSaves.failures >= 2 ? 'checked' : ''} style="cursor:pointer; width:16px; height:16px; accent-color: #f44336;">
                        <input type="checkbox" class="pc-ds-failure" data-idx="1" ${char.deathSaves.failures >= 1 ? 'checked' : ''} style="cursor:pointer; width:16px; height:16px; accent-color: #f44336;">
                    </div>
                    <button id="pc-roll-death-save" class="btn btn-danger" style="border-radius:50%; width:48px; height:48px; display:flex; justify-content:center; align-items:center; box-shadow:0 0 10px rgba(244, 67, 54, 0.5);" title="Roll Death Save">
                        <i class="fa-solid fa-skull" style="font-size:1.5rem;"></i>
                    </button>
                    <div style="display:flex; gap:4px; align-items:center;">
                        <input type="checkbox" class="pc-ds-success" data-idx="1" ${char.deathSaves.successes >= 1 ? 'checked' : ''} style="cursor:pointer; width:16px; height:16px; accent-color: #4caf50;">
                        <input type="checkbox" class="pc-ds-success" data-idx="2" ${char.deathSaves.successes >= 2 ? 'checked' : ''} style="cursor:pointer; width:16px; height:16px; accent-color: #4caf50;">
                        <input type="checkbox" class="pc-ds-success" data-idx="3" ${char.deathSaves.successes >= 3 ? 'checked' : ''} style="cursor:pointer; width:16px; height:16px; accent-color: #4caf50;">
                        <span style="font-size:0.75rem; color:var(--color-text-muted); margin-left:4px; font-family:var(--font-heading);">SUCCESSES</span>
                    </div>
                </div>

                ${renderPrimaryBioCardHtml(char)}
        `;
        document.getElementById('ps-primary').innerHTML = primaryHtml;
        updateTokenPortrait(activeImageUrl);

        // Builder Trigger Button on Primary Tab
        document.getElementById('pc-open-character-builder-btn')?.addEventListener('click', () => {
            openCharacterBuilderModal(currentChar);
        });

        document.querySelectorAll('.pc-roll-hd').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                const hd = e.currentTarget.dataset.hd;
                const rem = parseInt(e.currentTarget.dataset.rem);
                if (rem > 0) {
                    char.hitDiceSpent[hd] = (char.hitDiceSpent[hd] || 0) + 1;
                    const conMod = getMod(getTotalStat(char, 'con'));
                    const conStr = conMod >= 0 ? '+' + conMod : '' + conMod;
                    const formula = '1' + hd + conStr;
                    vtt.socket.emit('chat:msg', {
                        text: `[${char.name || 'Player'}: Hit Dice] rolls **${formula}**`,
                        roll: simulateRoll(formula)
                    });
                    saveAndEmit(char);
                    renderSheetData(char);
                }
            });
        });
        document.querySelectorAll('.pc-reset-hd').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                const hd = e.currentTarget.dataset.hd;
                if (char.hitDiceSpent[hd] && char.hitDiceSpent[hd] > 0) {
                    char.hitDiceSpent[hd]--;
                    saveAndEmit(char);
                    renderSheetData(char);
                }
            });
        });

        // Short Rest Execution
        document.getElementById('pc-short-rest-btn')?.addEventListener('click', () => {
            let restoredAbilities = [];
            if (char.abilityCards && Array.isArray(char.abilityCards)) {
                char.abilityCards.forEach((ab) => {
                    if (ab.hasCounter && ab.resetType === 'short') {
                        if (ab.usesCurrent !== ab.usesMax) {
                            ab.usesCurrent = ab.usesMax || 0;
                            restoredAbilities.push(ab.name);
                        }
                    }
                });
            }

            // Warlock Pact Magic Slot Recovery on Short Rest
            const classesList =
                char.classes && char.classes.length > 0
                    ? char.classes
                    : [{ name: char.class || '', level: char.level || 1 }];

            const validClasses = classesList.filter((c) => (c.name || '').trim() !== '');
            const warlockClass = validClasses.find((c) => (c.name || '').trim().toLowerCase() === 'warlock');

            if (warlockClass && char.spellSlots) {
                const isPureWarlock = validClasses.length === 1;
                let slotsRestored = false;

                if (isPureWarlock) {
                    // Pure Warlock: Restore all active spell slot levels
                    Object.keys(char.spellSlots).forEach((lvl) => {
                        if (char.spellSlots[lvl] && char.spellSlots[lvl].max > 0) {
                            if (char.spellSlots[lvl].current < char.spellSlots[lvl].max) {
                                slotsRestored = true;
                                char.spellSlots[lvl].current = char.spellSlots[lvl].max;
                            }
                        }
                    });
                } else {
                    // Multiclassed Warlock: Restore up to Pact Magic slots for the Warlock level
                    const wLvl = parseInt(warlockClass.level) || 1;
                    let slotLevelNum = 1;
                    let slotCount = 1;
                    if (wLvl >= 17) {
                        slotLevelNum = 5;
                        slotCount = 4;
                    } else if (wLvl >= 11) {
                        slotLevelNum = 5;
                        slotCount = 3;
                    } else if (wLvl >= 9) {
                        slotLevelNum = 5;
                        slotCount = 2;
                    } else if (wLvl >= 7) {
                        slotLevelNum = 4;
                        slotCount = 2;
                    } else if (wLvl >= 5) {
                        slotLevelNum = 3;
                        slotCount = 2;
                    } else if (wLvl >= 3) {
                        slotLevelNum = 2;
                        slotCount = 2;
                    } else if (wLvl >= 2) {
                        slotLevelNum = 1;
                        slotCount = 2;
                    } else {
                        slotLevelNum = 1;
                        slotCount = 1;
                    }

                    const targetLevelKey = `level${slotLevelNum}`;
                    if (char.spellSlots[targetLevelKey]) {
                        const cur = char.spellSlots[targetLevelKey].current || 0;
                        const max = char.spellSlots[targetLevelKey].max || 0;
                        const newCur = Math.min(max, cur + slotCount);
                        if (newCur > cur) {
                            char.spellSlots[targetLevelKey].current = newCur;
                            slotsRestored = true;
                        }
                    }
                }

                if (slotsRestored) {
                    restoredAbilities.push('Pact Spell Slots');
                }
            }

            let msgText = `☕ **${char.name || 'Player'}** completed a **Short Rest**.`;
            if (restoredAbilities.length > 0) {
                msgText += ` Restored resources: ${restoredAbilities.join(', ')}.`;
            } else {
                msgText += ` No Short Rest resources required resetting.`;
            }

            vtt.socket.emit('chat:msg', { text: msgText });
            saveAndEmit(char);
            renderSheetData(char);
        });

        // Long Rest Execution
        document.getElementById('pc-long-rest-btn')?.addEventListener('click', () => {
            let restoredAbilities = [];

            // 1. Restore abilities (short + long rest)
            if (char.abilityCards && Array.isArray(char.abilityCards)) {
                char.abilityCards.forEach((ab) => {
                    if (ab.hasCounter && ab.resetType !== 'none') {
                        if (ab.usesCurrent !== ab.usesMax) {
                            ab.usesCurrent = ab.usesMax || 0;
                            restoredAbilities.push(ab.name);
                        }
                    }
                });
            }

            // 2. Full HP restoration
            char.hpCurrent = char.hpMax || 0;

            // 3. Spell slots restoration
            let spellSlotsRestored = false;
            if (char.spellSlots) {
                Object.keys(char.spellSlots).forEach((lvl) => {
                    if (char.spellSlots[lvl] && char.spellSlots[lvl].max > 0) {
                        if (char.spellSlots[lvl].current < char.spellSlots[lvl].max) {
                            spellSlotsRestored = true;
                        }
                        char.spellSlots[lvl].current = char.spellSlots[lvl].max;
                    }
                });
            }

            // 4. Hit Dice recovery (half total HD rounded down, min 1 if spent > 0)
            const hdMax = {};
            let totalHitDice = 0;
            if (char.classes && char.classes.length > 0) {
                char.classes.forEach((c) => {
                    const hd = getClassHitDie(c.name);
                    const count = parseInt(c.level) || 1;
                    hdMax[hd] = (hdMax[hd] || 0) + count;
                    totalHitDice += count;
                });
            } else {
                const count = char.level || 1;
                hdMax['d8'] = count;
                totalHitDice = count;
            }

            char.hitDiceSpent = char.hitDiceSpent || {};
            let totalSpent = 0;
            Object.keys(char.hitDiceSpent).forEach((hd) => {
                totalSpent += char.hitDiceSpent[hd] || 0;
            });

            let regainedHdCount = 0;
            if (totalSpent > 0) {
                let hdToRecover = Math.max(1, Math.floor(totalHitDice / 2));
                hdToRecover = Math.min(hdToRecover, totalSpent);
                regainedHdCount = hdToRecover;

                // Priority to largest die types first (d12 > d10 > d8 > d6)
                const dieRank = { d12: 12, d10: 10, d8: 8, d6: 6 };
                const sortedHdTypes = Object.keys(char.hitDiceSpent).sort((a, b) => {
                    const valA = dieRank[a] || 8;
                    const valB = dieRank[b] || 8;
                    return valB - valA;
                });

                for (const hd of sortedHdTypes) {
                    while (hdToRecover > 0 && char.hitDiceSpent[hd] > 0) {
                        char.hitDiceSpent[hd]--;
                        hdToRecover--;
                    }
                }
            }

            let msgText = `🌙 **${char.name || 'Player'}** completed a **Long Rest**. Fully restored HP (${char.hpCurrent}/${char.hpMax})`;
            if (regainedHdCount > 0) {
                msgText += `, regained ${regainedHdCount} Hit ${regainedHdCount === 1 ? 'Die' : 'Dice'}`;
            }
            if (spellSlotsRestored) {
                msgText += `, restored Spell Slots`;
            }
            if (restoredAbilities.length > 0) {
                msgText += `, and restored abilities: ${restoredAbilities.join(', ')}`;
            }
            msgText += `.`;

            vtt.socket.emit('chat:msg', { text: msgText });
            saveAndEmit(char);
            renderSheetData(char);
        });

        const buildHtml = `
            <div style="margin-bottom:16px;">
                <h4 style="margin:0 0 8px 0; color:var(--color-gold-base); font-family:var(--font-heading);">Classes</h4>
                <div id="pc-classes-container" style="display:flex; flex-direction:column; gap:8px;">
                    ${char.classes
                        .map(
                            (cls, i) => `
                        <div class="glass-flat" style="padding:8px; display:flex; gap:8px; align-items:flex-end;">
                            <div class="form-group" style="flex:2;">
                                <label>Class</label>
                                <select class="pc-class-sel" data-idx="${i}" data-val="${cls.name}" style="width:100%;">
                                    <option value="${cls.name}">${cls.name || 'Select Class'}</option>
                                </select>
                            </div>
                            <div class="form-group" style="flex:2;">
                                <label>Subclass</label>
                                <select class="pc-subclass-sel" data-idx="${i}" data-val="${cls.subclass}" style="width:100%;">
                                    <option value="${cls.subclass}">${cls.subclass || 'None'}</option>
                                </select>
                            </div>
                            <div class="form-group" style="flex:1;">
                                <label>Level</label>
                                <input type="number" class="pc-class-level" data-idx="${i}" value="${cls.level}" min="1" max="20" style="width:100%;">
                            </div>
                            <button class="btn btn-danger btn-sm pc-class-del" data-idx="${i}" ${char.classes.length === 1 ? 'disabled' : ''}><i class="fa-solid fa-trash"></i></button>
                        </div>
                    `
                        )
                        .join('')}
                </div>
                <button id="pc-add-class" class="btn btn-secondary btn-xs" style="margin-top:8px;"><i class="fa-solid fa-plus"></i> Add Class</button>
            </div>
            
            <div style="display:flex; gap:12px; margin-bottom:12px; flex-wrap:wrap;">
                <div class="form-group" style="flex:2; min-width:140px;">
                    <label>Species / Race</label>
                    <select id="pc-race" data-val="${char.race || ''}" style="width:100%;">
                        <option value="${char.race || ''}">${char.race || 'Select Species'}</option>
                    </select>
                </div>
                <div class="form-group" style="flex:2; min-width:140px;">
                    <label>Subrace / Lineage</label>
                    <select id="pc-subrace" data-val="${char.subrace || ''}" style="width:100%;">
                        <option value="${char.subrace || ''}">${char.subrace || 'None'}</option>
                    </select>
                </div>
                <div class="form-group" style="flex:2; min-width:140px;">
                    <label>Background</label>
                    <select id="pc-background" data-val="${char.background || ''}" style="width:100%;">
                        <option value="${char.background || ''}">${char.background || 'Select Background'}</option>
                    </select>
                </div>
            </div>
            
            <div style="display:flex; gap:12px; margin-bottom:16px; flex-wrap:wrap;">
                <div class="form-group" style="flex:1; min-width:80px;">
                    <label>Max HP</label>
                    <input type="number" id="pc-hpMax" value="${char.hpMax}" style="width:100%;">
                </div>
                <div class="form-group" style="flex:1; min-width:80px;">
                    <label>Armor Class</label>
                    <input type="number" id="pc-ac" value="${char.ac}" style="width:100%;">
                </div>
            </div>

            <h4 style="margin:0 0 8px 0; color:var(--color-gold-base); font-family:var(--font-heading);">Movement Speeds (ft)</h4>
            <div style="display:flex; gap:8px; margin-bottom:16px; flex-wrap:wrap;">
                <div class="form-group" style="flex:1; min-width:80px;">
                    <label>Walk</label>
                    <input type="number" id="pc-speed-walk" value="${char.speed.walk}" style="width:100%;">
                </div>
                <div class="form-group" style="flex:1; min-width:80px;">
                    <label>Climb</label>
                    <input type="number" id="pc-speed-climb" value="${char.speed.climb}" style="width:100%;">
                </div>
                <div class="form-group" style="flex:1; min-width:80px;">
                    <label>Fly</label>
                    <input type="number" id="pc-speed-fly" value="${char.speed.fly}" style="width:100%;">
                </div>
                <div class="form-group" style="flex:1; min-width:80px;">
                    <label>Burrow</label>
                    <input type="number" id="pc-speed-burrow" value="${char.speed.burrow}" style="width:100%;">
                </div>
            </div>
            
            <h4 style="margin:0 0 8px 0; color:var(--color-gold-base); font-family:var(--font-heading);">Vision (ft)</h4>
            <div style="display:flex; gap:8px; margin-bottom:16px; flex-wrap:wrap;">
                <div class="form-group" style="flex:1; min-width:80px;">
                    <label>Darkvision</label>
                    <input type="number" id="pc-sense-darkvision" value="${char.senses.darkvision}" style="width:100%;">
                </div>
                <div class="form-group" style="flex:1; min-width:80px;">
                    <label>Devil's Sight</label>
                    <input type="number" id="pc-sense-devilsight" value="${char.senses.devilSight}" style="width:100%;">
                </div>
                <div class="form-group" style="flex:1; min-width:80px;">
                    <label>Blindsight</label>
                    <input type="number" id="pc-sense-blindsight" value="${char.senses.blindsight}" style="width:100%;">
                </div>
                <div class="form-group" style="flex:1; min-width:80px;">
                    <label>Truesight</label>
                    <input type="number" id="pc-sense-truesight" value="${char.senses.truesight}" style="width:100%;">
                </div>
            </div>
            
            <h4 style="margin:0 0 8px 0; color:var(--color-gold-base); font-family:var(--font-heading);">Character Info</h4>
            <div style="display:flex; gap:12px; margin-bottom:12px; flex-wrap:wrap;">
                <div class="form-group" style="flex:1; min-width:70px;">
                    <label>Age</label>
                    <input type="text" id="pc-bio-age" value="${char.bio.age}" style="width:100%;">
                </div>
                <div class="form-group" style="flex:1; min-width:70px;">
                    <label>Height (ft)</label>
                    <input type="text" id="pc-bio-height" value="${char.bio.height}" style="width:100%;">
                </div>
                <div class="form-group" style="flex:1; min-width:70px;">
                    <label>Weight (lbs)</label>
                    <input type="text" id="pc-bio-weight" value="${char.bio.weight}" style="width:100%;">
                </div>
            </div>
            <div class="form-group" style="margin-bottom:12px;">
                <label>Backstory</label>
                <textarea id="pc-bio-backstory" class="scroll-styled" style="height:120px; resize:vertical; background:rgba(0,0,0,0.35); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); padding:10px 14px; border-radius:6px; font-family:var(--font-primary); font-size:0.9rem; line-height:1.5;">${char.bio.backstory}</textarea>
            </div>
            <div class="form-group">
                <label>Other Notes</label>
                <textarea id="pc-bio-notes" class="scroll-styled" style="height:120px; resize:vertical; background:rgba(0,0,0,0.35); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); padding:10px 14px; border-radius:6px; font-family:var(--font-primary); font-size:0.9rem; line-height:1.5;">${char.bio.notes}</textarea>
            </div>
            <div style="display:flex; gap:12px; margin-top:16px; margin-bottom:24px;">
                <button id="pc-build-tab-open-builder-btn" type="button" class="btn btn-primary" style="flex:1; padding:10px 16px; font-weight:600; display:inline-flex; align-items:center; justify-content:center; gap:8px; box-shadow:0 0 14px rgba(212,175,55,0.35);">
                    <i class="fa-solid fa-wand-magic-sparkles"></i> Build / Level Up
                </button>
                <button id="pc-save-build" type="button" class="btn btn-secondary" style="flex:1; padding:10px 16px; font-weight:600; display:inline-flex; align-items:center; justify-content:center; gap:8px;">
                    <i class="fa-solid fa-floppy-disk"></i> Save Edits
                </button>
            </div>
        `;
        const psBuildEl = document.getElementById('ps-build');
        if (psBuildEl) psBuildEl.innerHTML = buildHtml;

        async function loadSubclassesForClass(className, selectEl) {
            if (!className) {
                selectEl.innerHTML = '<option value="">None</option>';
                return;
            }
            const currentSubclass = selectEl.dataset.val;
            const rawClassName = className
                .replace(/\s*\[.*?\]$/, '')
                .trim()
                .toLowerCase();
            const disabledSources = await getDisabledSources();

            if (builderCache && Array.isArray(builderCache.classes)) {
                const matchedClasses = builderCache.classes.filter((c) => c.name.toLowerCase() === rawClassName);
                if (matchedClasses.length > 0) {
                    let opts = '<option value="">None</option>';
                    const allSubclasses = [];
                    const seen = new Set();
                    matchedClasses.forEach((cls) => {
                        (cls.subclasses || []).forEach((sc) => {
                            if (disabledSources.has(String(sc.source || cls.source || 'PHB').toUpperCase())) return;
                            const badge = getDisplaySourceBadge(sc.source);
                            const tag = badge ? ` [${badge}]` : sc.source ? ` [${sc.source}]` : '';
                            const fullSubName = `${sc.name}${tag}`;
                            const subKey = `${sc.name.toLowerCase()}|${(sc.source || '').toLowerCase()}`;
                            if (!seen.has(subKey)) {
                                seen.add(subKey);
                                allSubclasses.push({
                                    ...sc,
                                    fullSubName,
                                    badge,
                                    tag
                                });
                            }
                        });
                    });
                    allSubclasses.sort((a, b) => a.fullSubName.localeCompare(b.fullSubName));
                    allSubclasses.forEach((sc) => {
                        const isSel = sc.fullSubName === currentSubclass || sc.name === currentSubclass;
                        opts += `<option value="${sc.fullSubName}" data-name="${sc.name}" data-source="${sc.source}" ${isSel ? 'selected' : ''}>${sc.fullSubName}</option>`;
                    });
                    selectEl.innerHTML = opts;
                    return;
                }
            }

            const file = builderCache?.classIndex ? builderCache.classIndex[rawClassName] : null;
            if (!file) {
                selectEl.innerHTML = '<option value="">None</option>';
                return;
            }

            fetch(`data/class/${file}`)
                .then((r) => r.json())
                .then((data) => {
                    if (data && data.subclass) {
                        let opts = '<option value="">None</option>';
                        const seen = new Set();
                        const list = [];
                        data.subclass.forEach((sc) => {
                            if (disabledSources.has(String(sc.source || 'PHB').toUpperCase())) return;
                            const badge = getDisplaySourceBadge(sc.source);
                            const tag = badge ? ` [${badge}]` : sc.source ? ` [${sc.source}]` : '';
                            const fullSubName = `${sc.name}${tag}`;
                            const subKey = `${sc.name.toLowerCase()}|${(sc.source || '').toLowerCase()}`;
                            if (!seen.has(subKey)) {
                                seen.add(subKey);
                                list.push({ ...sc, fullSubName });
                            }
                        });
                        list.sort((a, b) => a.fullSubName.localeCompare(b.fullSubName));
                        list.forEach((sc) => {
                            const isSel = sc.fullSubName === currentSubclass || sc.name === currentSubclass;
                            opts += `<option value="${sc.fullSubName}" ${isSel ? 'selected' : ''}>${sc.fullSubName}</option>`;
                        });
                        selectEl.innerHTML = opts;
                    }
                })
                .catch(() => {});
        }

        updateSubraceDropdown = async function updateSubraceDropdown(
            selectedBaseRace,
            currentSubraceVal = '',
            disabledSources = null
        ) {
            const subSel = document.getElementById('pc-subrace');
            if (!subSel) return;
            if (!builderCache || !builderCache.races || builderCache.races.length === 0) {
                await ensureBuilderCache();
            }
            if (!builderCache || !builderCache.races) return;
            if (!disabledSources) {
                disabledSources = await getDisabledSources();
            }

            const cleanBase = (selectedBaseRace || '')
                .replace(/\s*\[.*?\]$/, '')
                .replace(/\s*\([^)]*\).*$/, '')
                .trim()
                .toLowerCase();
            if (!cleanBase) {
                subSel.innerHTML = '<option value="">None / Not Applicable</option>';
                subSel.disabled = true;
                subSel.value = '';
                return;
            }
            const matchingSubraces = [];
            const seenSub = new Set();
            builderCache.races.forEach((r) => {
                if (
                    disabledSources &&
                    disabledSources.has &&
                    disabledSources.has(String(r.source || 'PHB').toUpperCase())
                )
                    return;
                const rawRName = r.raceName || r.name || '';
                const rBase = rawRName
                    .replace(/\s*\[.*?\]$/, '')
                    .replace(/\s*\([^)]*\).*$/, '')
                    .trim()
                    .toLowerCase();
                if (rBase === cleanBase) {
                    let sub = r.subraceName;
                    if (!sub && r.name && r.name.includes('(')) {
                        sub = r.name.match(/\(([^)]+)\)/)?.[1];
                    }
                    if (!sub && r.raceName && r.raceName.includes('(')) {
                        sub = r.raceName.match(/\(([^)]+)\)/)?.[1];
                    }
                    if (sub) {
                        sub = sub.replace(/^variant;\s*/i, '').trim();
                        const badge = getDisplaySourceBadge(r.source);
                        const tag = badge ? ` [${badge}]` : r.source ? ` [${r.source}]` : '';
                        const fullSub = `${sub}${tag}`;
                        if (!seenSub.has(fullSub)) {
                            seenSub.add(fullSub);
                            matchingSubraces.push({ name: sub, fullSub, source: r.source });
                        }
                    }
                }
            });

            if (matchingSubraces.length === 0) {
                subSel.innerHTML = '<option value="">None / Not Applicable</option>';
                subSel.disabled = true;
                subSel.value = '';
            } else {
                subSel.disabled = false;
                let opts = '<option value="">None / Standard</option>';
                matchingSubraces.sort((a, b) => a.fullSub.localeCompare(b.fullSub));
                matchingSubraces.forEach((s) => {
                    const isSel =
                        s.fullSub === currentSubraceVal ||
                        s.name === currentSubraceVal ||
                        (currentSubraceVal && currentSubraceVal.startsWith(s.name));
                    opts += `<option value="${s.fullSub}" ${isSel ? 'selected' : ''}>${s.fullSub}</option>`;
                });
                subSel.innerHTML = opts;
                if (currentSubraceVal) {
                    const matched = matchingSubraces.find(
                        (s) =>
                            s.fullSub === currentSubraceVal ||
                            s.name === currentSubraceVal ||
                            (currentSubraceVal && currentSubraceVal.startsWith(s.name))
                    );
                    if (matched) subSel.value = matched.fullSub;
                    else subSel.value = '';
                } else {
                    subSel.value = '';
                }
            }
        };

        populateBuildDropdowns = async function populateBuildDropdowns() {
            if (!builderCache || !builderCache.races || builderCache.races.length === 0) {
                await ensureBuilderCache();
            }
            if (!builderCache) return;
            const disabledSources = await getDisabledSources();

            const raceSel = document.getElementById('pc-race');
            const subSel = document.getElementById('pc-subrace');
            if (raceSel) {
                const currentRace = raceSel.dataset.val || char.race || '';
                let opts = '<option value="">Select Species</option>';
                const seenRaces = new Set();
                const baseRacesList = [];

                builderCache.races.forEach((r) => {
                    if (
                        disabledSources &&
                        disabledSources.has &&
                        disabledSources.has(String(r.source || 'PHB').toUpperCase())
                    )
                        return;
                    const raw = r.raceName || r.name || '';
                    const baseName = raw
                        .replace(/\s*\[.*?\]$/, '')
                        .replace(/\s*\([^)]*\).*$/, '')
                        .trim();
                    if (!baseName || seenRaces.has(baseName.toLowerCase())) return;
                    seenRaces.add(baseName.toLowerCase());
                    baseRacesList.push({ name: baseName, source: r.source });
                });

                baseRacesList.sort((a, b) => a.name.localeCompare(b.name));
                baseRacesList.forEach((r) => {
                    const isSel = r.name === currentRace || (currentRace && currentRace.startsWith(r.name));
                    opts += `<option value="${r.name}" ${isSel ? 'selected' : ''}>${r.name}</option>`;
                });
                raceSel.innerHTML = opts;

                // Populate Subrace dropdown based on current selected species
                const currentSub = subSel?.dataset.val || char.subrace || '';
                await updateSubraceDropdown(raceSel.value, currentSub, disabledSources);
            }

            const bgSel = document.getElementById('pc-background');
            if (bgSel) {
                const currentBg = bgSel.dataset.val || char.background || '';
                let opts = '<option value="">Select Background</option>';
                const seenBgs = new Set();
                const filteredBgs = [];
                builderCache.bgs.forEach((b) => {
                    if (disabledSources.has(String(b.source || 'PHB').toUpperCase())) return;
                    const badge = getDisplaySourceBadge(b.source);
                    const srcTag = badge ? ` [${badge}]` : b.source ? ` [${b.source}]` : '';
                    const fullVal = `${b.name}${srcTag}`;
                    if (seenBgs.has(fullVal)) return;
                    seenBgs.add(fullVal);
                    filteredBgs.push({ name: b.name, fullVal, source: b.source, id: b.id });
                });
                filteredBgs.sort((a, b) => a.fullVal.localeCompare(b.fullVal));
                filteredBgs.forEach((b) => {
                    const isSel = b.fullVal === currentBg || b.name === currentBg || (b.id && b.id === currentBg);
                    opts += `<option value="${b.fullVal}" data-id="${b.id || ''}" data-name="${b.name}" data-source="${b.source || ''}" ${isSel ? 'selected' : ''}>${b.fullVal}</option>`;
                });
                bgSel.innerHTML = opts;
            }

            const currentClassNames = char.classes.map((c) => c.name);
            document.querySelectorAll('.pc-class-sel').forEach((sel) => {
                const currentCls = sel.dataset.val;
                let opts = '<option value="">Select Class</option>';
                if (builderCache.classes && Array.isArray(builderCache.classes)) {
                    const classMap = new Map();
                    builderCache.classes.forEach((c) => {
                        if (disabledSources.has(String(c.source || 'PHB').toUpperCase())) return;
                        const badge = getDisplaySourceBadge(c.source);
                        const tag = badge ? ` [${badge}]` : c.source ? ` [${c.source}]` : '';
                        const fullName = `${c.name}${tag}`;
                        if (!classMap.has(fullName)) {
                            classMap.set(fullName, { ...c, fullName });
                        }
                    });
                    const sortedClasses = Array.from(classMap.values()).sort((a, b) =>
                        a.fullName.localeCompare(b.fullName)
                    );
                    sortedClasses.forEach((c) => {
                        const fullName = c.fullName;
                        const isSel =
                            fullName === currentCls ||
                            c.name === currentCls ||
                            (currentCls && currentCls.startsWith(c.name) && currentCls.includes(c.source));
                        const disabled =
                            currentClassNames.includes(fullName) && fullName !== currentCls ? 'disabled' : '';
                        opts += `<option value="${fullName}" data-name="${c.name}" data-source="${c.source}" data-id="${c.id}" ${isSel ? 'selected' : ''} ${disabled}>${fullName}</option>`;
                    });
                } else if (builderCache.classIndex) {
                    Object.keys(builderCache.classIndex).forEach((cKey) => {
                        const name = cKey.charAt(0).toUpperCase() + cKey.slice(1);
                        const disabled = currentClassNames.includes(name) && name !== currentCls ? 'disabled' : '';
                        opts += `<option value="${name}" ${name === currentCls ? 'selected' : ''} ${disabled}>${name}</option>`;
                    });
                }
                sel.innerHTML = opts;
            });

            document.querySelectorAll('.pc-subclass-sel').forEach((sel) => {
                const idx = sel.dataset.idx;
                const clsInput = document.querySelector(`.pc-class-sel[data-idx="${idx}"]`);
                const clsVal = clsInput ? clsInput.value : '';
                if (clsVal) {
                    loadSubclassesForClass(clsVal, sel);
                }
            });
        };

        ensureBuilderCache().then(() => {
            populateBuildDropdowns();
        });

        document.getElementById('ps-equipment').innerHTML = renderEquipmentHtml(char, sheetCtx);
        document.getElementById('ps-spells').innerHTML = renderSpellsHtml(char, sheetCtx);

        const renderMacroRowHtml = (m, i) => `
            <div class="macro-row glass-flat" data-idx="${i}" data-category-id="${m.categoryId || ''}" draggable="true" style="padding:8px; display:flex; flex-direction:column; gap:6px; transition: border-color 0.15s, box-shadow 0.15s, opacity 0.15s;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div style="display:flex; align-items:center; gap:6px; flex:1; min-width:0;">
                        <div class="pc-macro-drag-handle" data-idx="${i}" title="Click and drag to move/reorder macro" style="cursor:grab; opacity:0.6; padding-right:4px; display:flex; align-items:center; user-select:none; transition:opacity 0.15s, color 0.15s;" onmouseover="this.style.opacity='1'; this.style.color='var(--color-gold-base)';" onmouseout="this.style.opacity='0.6'; this.style.color='inherit';">
                            <i class="fa-solid fa-grip-vertical" style="font-size:0.9rem;"></i>
                        </div>
                        <button class="btn pc-macro-roll-all" data-idx="${i}" title="Roll all: ${m.name}" style="font-weight:600; color:var(--color-text-primary); background:transparent; border:none; padding:0; cursor:pointer; display:flex; align-items:center; gap:6px; font-size:0.875rem; font-family:inherit; transition:color 0.15s ease; text-overflow:ellipsis; overflow:hidden; white-space:nowrap;" onmouseover="this.style.color='var(--color-gold-light)'" onmouseout="this.style.color='var(--color-text-primary)'"><i class="fa-solid fa-dice-d20 text-gradient-gold"></i> ${m.name}</button>
                    </div>
                    <div style="display:flex; gap:6px; align-items:center; flex-shrink:0;">
                        <button class="btn btn-xxs btn-secondary pc-macro-edit" data-idx="${i}"><i class="fa-solid fa-pen"></i></button>
                        <button class="btn btn-xxs btn-danger pc-macro-del" data-idx="${i}"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
                ${
                    m.range || m.target
                        ? `
                <div style="display:flex; gap:10px; font-size:0.7rem; color:var(--color-text-muted); margin-top:-2px; margin-bottom:2px; padding:0 2px;">
                    ${m.range ? `<span><i class="fa-solid fa-location-crosshairs" style="color:var(--color-gold-base); font-size:0.65rem; margin-right:4px;"></i>${m.range}</span>` : ''}
                    ${m.target ? `<span><i class="fa-solid fa-bullseye" style="color:var(--color-gold-base); font-size:0.65rem; margin-right:4px;"></i>${m.target}</span>` : ''}
                </div>`
                        : ''
                }
                ${
                    m.description
                        ? `
                <div style="display:flex; align-items:center; gap:6px; background:rgba(0,0,0,0.2); border-radius:4px; padding:4px 6px;">
                    <span style="font-size:0.72rem; color:var(--color-text-muted); font-style:italic; flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${m.description}</span>
                    <button class="btn btn-xxs btn-secondary pc-macro-desc-ping" data-idx="${i}" title="Ping description to chat" style="flex-shrink:0;"><i class="fa-solid fa-comment-dots"></i></button>
                </div>`
                        : ''
                }
                <div style="display:flex; gap:4px; flex-wrap:wrap; align-items:center; justify-content:space-between;">
                    <div style="display:flex; gap:4px; flex-wrap:wrap;">
                        ${(m.attackStat && m.attackStat !== 'none') || m.attackBonus ? `<button class="btn btn-xxs btn-primary pc-macro-attack" data-idx="${i}">⚔️ Attack (${calculatedAtkBonus(m)})</button>` : ''}
                        ${m.saveAbility ? `<button class="btn btn-xxs btn-secondary pc-macro-save" data-idx="${i}">🛡️ DC ${calculatedSaveDc(m)} ${m.saveAbility}</button>` : ''}
                        ${
                            m.damage && m.damage.length
                                ? (function () {
                                      const desc = m.damage
                                          .map((d) => {
                                              const f = d.formula || d.dice || '';
                                              const mod =
                                                  d.custom && d.custom.trim()
                                                      ? d.custom.trim().startsWith('+') ||
                                                        d.custom.trim().startsWith('-')
                                                          ? d.custom.trim()
                                                          : '+' + d.custom.trim()
                                                      : d.extra && parseInt(d.extra)
                                                        ? parseInt(d.extra) > 0
                                                            ? '+' + d.extra
                                                            : String(d.extra)
                                                        : '';
                                              const t = d.type || '';
                                              const lbl = d.label ? ` (${d.label})` : '';
                                              return `${f}${mod ? ' ' + mod : ''} ${t}${lbl}`.trim();
                                          })
                                          .join(', ');
                                      return `<button class="btn btn-xxs btn-danger pc-macro-damage" data-idx="${i}" title="${desc.replace(/"/g, '&quot;')}">💥 Damage</button>`;
                                  })()
                                : ''
                        }
                    </div>
                    <div style="display:flex; align-items:center; gap:4px; margin-left:auto;">
                        <span style="font-size:0.7rem; color:var(--color-text-muted);"><i class="fa-solid fa-folder" style="color:var(--color-gold-base); font-size:0.65rem;"></i></span>
                        <select class="pc-macro-cat-select" data-idx="${i}" title="Move to Category" style="background:rgba(0,0,0,0.5); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); font-size:0.7rem; border-radius:4px; padding:1px 4px; max-width:120px;">
                            <option value="" ${!m.categoryId ? 'selected' : ''}>Uncategorized</option>
                            ${(char.macroCategories || [])
                                .map(
                                    (c) => `
                                <option value="${c.id}" ${m.categoryId === c.id ? 'selected' : ''}>📁 ${c.name}</option>
                            `
                                )
                                .join('')}
                        </select>
                    </div>
                </div>
            </div>
        `;

        const formatAbilityCardDescription = (card) => {
            if (!card) return '';
            let raw = (card.description || '').trim();
            if (!raw && (!card.customFields || card.customFields.length === 0)) {
                return '<i style="opacity:0.6;">No description provided.</i>';
            }

            // Escape HTML entities to prevent malformed tags
            let safe = raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

            // Standard clean markdown formatting:
            // Bold **text**
            safe = safe.replace(
                /\*\*(.+?)\*\*/g,
                '<strong style="color:var(--color-gold-light); font-weight:600;">$1</strong>'
            );
            // Italic *text*
            safe = safe.replace(/(^|[^*])\*(?!\*)([^*]+)\*/g, '$1<em>$2</em>');

            // Handle newlines: normalize \r\n to \n
            safe = safe.replace(/\r\n/g, '\n');

            // Handle bullet items (e.g. "- Item" or "* Item" at start of line)
            safe = safe.replace(/^[ \t]*[-*][ \t]+(.+)$/gm, '&bull; $1');

            // Convert consecutive newlines to double break, single newline to single break
            safe = safe.replace(/\n\n+/g, '<br><br>').replace(/\n/g, '<br>');

            // Append custom fields matching chat-card format
            if (Array.isArray(card.customFields) && card.customFields.length > 0) {
                const fieldsHtml = card.customFields
                    .map((f) => {
                        const l = (f.label || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                        const e = (f.entry || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                        return `<strong style="color:var(--color-gold-light); font-weight:600;">${l}:</strong> ${e}`;
                    })
                    .join('<br>');

                if (safe) {
                    safe += `<br><br>${fieldsHtml}`;
                } else {
                    safe = fieldsHtml;
                }
            }

            return safe;
        };

        const renderAbilityRowHtml = (card, i) => {
            const actionPill =
                card.actionType && card.actionType !== 'passive'
                    ? card.actionType === 'bonus'
                        ? `<span class="badge" style="background:#d97706; color:#fff; font-size:0.65rem; padding:1px 5px; border-radius:3px; font-weight:600; text-transform:uppercase;">Bonus</span>`
                        : card.actionType === 'reaction'
                          ? `<span class="badge" style="background:#2563eb; color:#fff; font-size:0.65rem; padding:1px 5px; border-radius:3px; font-weight:600; text-transform:uppercase;">Reaction</span>`
                          : card.actionType === 'action'
                            ? `<span class="badge" style="background:#16a34a; color:#fff; font-size:0.65rem; padding:1px 5px; border-radius:3px; font-weight:600; text-transform:uppercase;">Action</span>`
                            : `<span class="badge" style="background:#9333ea; color:#fff; font-size:0.65rem; padding:1px 5px; border-radius:3px; font-weight:600; text-transform:uppercase;">${card.actionType}</span>`
                    : '';

            const evalFormula = evaluateAbilityFormula(card.formula, card.formulaConfig, char);
            const rollChipHtml = evalFormula
                ? `
                <button class="btn btn-xxs btn-secondary pc-ability-roll-chip" data-idx="${i}" data-formula="${evalFormula}" data-name="${card.name}" title="Click to Roll: ${evalFormula}" style="font-family:monospace; border-color:var(--color-gold-base); font-size:0.75rem; padding:2px 6px; display:inline-flex; align-items:center; gap:4px;">
                    <i class="fa-solid fa-dice-d20 text-gradient-gold"></i> ${evalFormula}
                </button>
            `
                : '';

            return `
            <div class="ability-row glass-flat" data-idx="${i}" data-category-id="${card.categoryId || ''}" draggable="true" style="padding:8px; display:flex; flex-direction:column; gap:4px; transition: border-color 0.15s, box-shadow 0.15s, opacity 0.15s;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                        <div class="pc-ability-drag-handle" data-idx="${i}" title="Click and drag to move/reorder ability card" style="cursor:grab; opacity:0.6; padding-right:4px; display:flex; align-items:center; user-select:none; transition:opacity 0.15s, color 0.15s;" onmouseover="this.style.opacity='1'; this.style.color='var(--color-gold-base)';" onmouseout="this.style.opacity='0.6'; this.style.color='inherit';">
                            <i class="fa-solid fa-grip-vertical" style="font-size:0.9rem;"></i>
                        </div>
                        <i class="fa-solid fa-chevron-right pc-ability-expand" data-idx="${i}" style="transition:transform 0.2s; cursor:pointer; font-size:0.7rem; color:var(--color-text-muted);"></i>
                        <div class="pc-ability-ping" data-idx="${i}" title="Ping description to chat" style="cursor:pointer; font-weight:600; color:var(--color-text-primary); display:flex; align-items:center; gap:6px;">
                            <i class="fa-solid fa-comment-dots text-gradient-gold"></i> ${card.name}
                            ${actionPill}
                        </div>
                    </div>
                    <div style="display:flex; gap:6px; align-items:center;">
                        ${rollChipHtml}
                        ${
                            card.hasCounter
                                ? `
                        <div style="display:flex; align-items:center; gap:4px;">
                            <button class="btn btn-xxs btn-secondary pc-ability-uses-minus" data-idx="${i}">-</button>
                            <span style="font-size:0.8rem; font-family:monospace; min-width:24px; text-align:center;">${card.usesCurrent || 0} / ${card.usesMax || 0}</span>
                            <button class="btn btn-xxs btn-secondary pc-ability-uses-plus" data-idx="${i}">+</button>
                            <span style="font-size:0.65rem; color:var(--color-text-muted); opacity:0.8; margin-left:2px;" title="Resets on ${card.resetType === 'short' ? 'Short Rest' : card.resetType === 'none' ? 'Manual' : 'Long Rest'}">[${card.resetType === 'short' ? 'SR' : card.resetType === 'none' ? 'Man' : 'LR'}]</span>
                        </div>
                        `
                                : ''
                        }
                        <button class="btn btn-xxs btn-secondary pc-ability-edit" data-idx="${i}"><i class="fa-solid fa-pen"></i></button>
                        <button class="btn btn-xxs btn-danger pc-ability-del" data-idx="${i}"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
                <div class="pc-ability-details" id="pc-ability-details-${i}" style="display:none; font-size:0.85rem; margin-top:6px; border-top:1px solid rgba(255,255,255,0.08); padding:8px 10px; background:rgba(0,0,0,0.2); border-radius:4px; line-height:1.5; color:var(--color-text-secondary); word-break:break-word;">
                    <div class="pc-ability-desc-content" style="white-space:normal;">${formatAbilityCardDescription(card)}</div>
                    <div style="display:flex; justify-content:flex-end; align-items:center; margin-top:8px; padding-top:6px; border-top:1px solid rgba(255,255,255,0.06);">
                        <div style="display:flex; align-items:center; gap:6px;">
                            <span style="font-size:0.72rem; color:var(--color-text-muted);"><i class="fa-solid fa-folder" style="color:var(--color-gold-base);"></i> Category:</span>
                            <select class="pc-ability-cat-select" data-idx="${i}" title="Move to Category" style="background:rgba(0,0,0,0.5); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); font-size:0.75rem; border-radius:4px; padding:2px 6px; max-width:140px;">
                                <option value="" ${!card.categoryId ? 'selected' : ''}>Uncategorized</option>
                                ${(char.abilityCategories || [])
                                    .map(
                                        (c) => `
                                    <option value="${c.id}" ${card.categoryId === c.id ? 'selected' : ''}>📁 ${c.name}</option>
                                `
                                    )
                                    .join('')}
                            </select>
                        </div>
                    </div>
                </div>
            </div>
            `;
        };

        let infoHtml = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                    <h4 style="margin:0; color:var(--color-gold-base); font-family:var(--font-heading);"><i class="fa-solid fa-burst"></i> Attacks & Macros</h4>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <button id="btn-create-macro-cat" class="btn btn-secondary btn-xs"><i class="fa-solid fa-folder-plus"></i> Category</button>
                        <button id="btn-add-macro" class="btn btn-secondary btn-xs"><i class="fa-solid fa-plus"></i> Add Attack</button>
                        <button class="btn btn-xxs btn-secondary pc-attack-settings-btn" title="Attack Settings"><i class="fa-solid fa-cog"></i></button>
                    </div>
                </div>
                ${
                    char.attackSettings?.toggles && char.attackSettings.toggles.length > 0
                        ? `
                <div style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:8px;">
                    ${char.attackSettings.toggles
                        .map(
                            (t, i) => `
                        <button class="btn btn-xxs btn-secondary pc-attack-quick-toggle" data-idx="${i}" style="border-radius:12px; padding:2px 8px; font-size:0.75rem; background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle);">
                            <i class="fa-solid fa-circle" style="color:${t.enabled ? '#4caf50' : '#f44336'}; font-size:0.5rem; margin-right:4px;"></i> ${t.name}
                        </button>
                    `
                        )
                        .join('')}
                </div>`
                        : ''
                }
                
                <div id="pc-macros-list" style="display:flex; flex-direction:column; gap:8px; margin-bottom:16px;">
                    ${(function () {
                        let html = '';
                        (char.macroCategories || []).forEach((c, cIdx) => {
                            const cItems = char.macros
                                .map((m, i) => ({ m, i }))
                                .filter(({ m }) => m.categoryId === c.id);
                            html += `
                                <div class="pc-macro-cat-card glass-flat" data-category-id="${c.id}" data-category-idx="${cIdx}" draggable="true" style="border:1px solid var(--color-border-subtle); border-radius:8px; margin-bottom:4px; overflow:hidden; transition:border-color 0.15s, box-shadow 0.15s;">
                                    <div class="pc-macro-cat-header" data-category-id="${c.id}" style="padding:8px 12px; background:rgba(0,0,0,0.25); display:flex; justify-content:space-between; align-items:center; cursor:pointer; user-select:none;">
                                        <div style="display:flex; align-items:center; gap:8px; flex:1; min-width:0;">
                                            <div class="pc-macro-cat-drag-handle" data-category-idx="${cIdx}" title="Click and drag to reorder category" style="cursor:grab; opacity:0.5; padding-right:4px;" onmouseover="this.style.opacity='1'; this.style.color='var(--color-gold-base)';" onmouseout="this.style.opacity='0.5'; this.style.color='inherit';" onclick="event.stopPropagation();">
                                                <i class="fa-solid fa-grip-vertical"></i>
                                            </div>
                                            <i class="fa-solid fa-folder text-gradient-gold" style="font-size:0.95rem; flex-shrink:0;"></i>
                                            <i class="fa-solid fa-chevron-right text-gradient-gold pc-macro-cat-chevron" data-category-id="${c.id}" style="font-size:0.75rem; flex-shrink:0; transition:transform 0.2s; transform:${c.collapsed ? 'rotate(0deg)' : 'rotate(90deg)'};"></i>
                                            <span style="font-weight:700; font-size:0.875rem; color:var(--color-text-primary); text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">${c.name}</span>
                                            <span style="font-size:0.75rem; color:var(--color-text-muted); background:rgba(255,255,255,0.08); padding:2px 8px; border-radius:12px;">${cItems.length} item${cItems.length !== 1 ? 's' : ''}</span>
                                        </div>
                                        <div style="display:flex; gap:6px; align-items:center; flex-shrink:0;" onclick="event.stopPropagation();">
                                            <button class="btn btn-xxs btn-secondary pc-macro-cat-edit" data-category-id="${c.id}" title="Edit Category"><i class="fa-solid fa-pen"></i></button>
                                            <button class="btn btn-xxs btn-danger pc-macro-cat-del" data-category-id="${c.id}" title="Delete Category"><i class="fa-solid fa-trash"></i></button>
                                        </div>
                                    </div>
                                    <div class="pc-macro-cat-contents ${c.collapsed ? 'vtt-hidden' : ''}" data-category-id="${c.id}" style="padding:8px; border-top:1px solid rgba(255,255,255,0.05); display:flex; flex-direction:column; gap:8px; border-left:3px solid var(--color-gold-base); background:rgba(0,0,0,0.15);">
                                        ${cItems.map(({ m, i }) => renderMacroRowHtml(m, i)).join('')}
                                        ${cItems.length === 0 ? `<div style="font-size:0.8rem; color:var(--color-text-muted); padding:8px; text-align:center; font-style:italic;">Drag items here or drop onto header to move into this category.</div>` : ''}
                                    </div>
                                </div>
                            `;
                        });

                        const uncatMacros = char.macros.map((m, i) => ({ m, i })).filter(({ m }) => !m.categoryId);
                        html += `
                            <div class="pc-macro-cat-card glass-flat" data-category-id="" style="border:1px solid var(--color-border-subtle); border-radius:8px; margin-bottom:4px; overflow:hidden;">
                                <div class="pc-macro-cat-header pc-main-macro-header" data-category-id="" style="padding:8px 12px; background:rgba(0,0,0,0.2); display:flex; justify-content:space-between; align-items:center; cursor:pointer; user-select:none;">
                                    <div style="display:flex; align-items:center; gap:8px; flex:1; min-width:0;">
                                        <i class="fa-solid fa-burst text-gradient-gold" style="font-size:0.95rem; flex-shrink:0;"></i>
                                        <span style="font-weight:700; font-size:0.875rem; color:var(--color-gold-light);">Uncategorized Attacks / Macros</span>
                                        <span style="font-size:0.75rem; color:var(--color-text-muted); background:rgba(255,255,255,0.08); padding:2px 8px; border-radius:12px;">${uncatMacros.length} item${uncatMacros.length !== 1 ? 's' : ''}</span>
                                    </div>
                                </div>
                                <div class="pc-macro-cat-contents" data-category-id="" style="padding:8px; border-top:1px solid rgba(255,255,255,0.05); display:flex; flex-direction:column; gap:8px;">
                                    ${uncatMacros.map(({ m, i }) => renderMacroRowHtml(m, i)).join('')}
                                    ${uncatMacros.length === 0 && (char.macroCategories || []).length > 0 ? `<div style="font-size:0.8rem; color:var(--color-text-muted); padding:8px; text-align:center; font-style:italic;">All macros are organized into categories.</div>` : ''}
                                    ${char.macros.length === 0 ? `<div style="font-size:0.8rem; color:var(--color-text-muted); padding:8px; text-align:center;">No macros added yet.</div>` : ''}
                                </div>
                            </div>
                        `;
                        return html;
                    })()}
                </div>

            ${renderAbilityCardsHtml(char, sheetCtx)}
        `;
        document.getElementById('ps-info').innerHTML = infoHtml;

        wireSheetEvents(char);
    }

    function wireSheetEvents(char) {
        wireBioEvents(char, sheetCtx);
        wireInventoryEvents(char, sheetCtx);
        wireSpellsEvents(char, sheetCtx);
        wireAbilityCardsEvents(char, sheetCtx);

        const nameInput = document.getElementById('pc-name');
        if (nameInput) {
            nameInput.addEventListener('change', () => {
                char.name = nameInput.value.trim();
                saveAndEmit(char);
            });
        }

        const assignBtn = document.getElementById('pc-assign-players-btn');
        if (assignBtn) {
            assignBtn.addEventListener('click', () => {
                openAssignPlayersModal(char);
            });
        }

        const popoutBtn = document.getElementById('pc-btn-popout');
        if (popoutBtn) {
            popoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (window.SheetWindowManager && currentChar) {
                    window.SheetWindowManager.openPopout({
                        type: 'player',
                        id: currentChar.id,
                        name: currentChar.name
                    });
                    minimizePanel();
                }
            });
        }

        document.getElementById('pc-hp-current-input')?.addEventListener('change', (e) => {
            char.hpCurrent = parseInt(e.target.value) || 0;
            saveAndEmit(char);
            debouncedRenderSheetData(char);
        });
        document.getElementById('pc-temp-hp-current')?.addEventListener('change', (e) => {
            char.tempHp = parseInt(e.target.value) || 0;
            saveAndEmit(char);
        });

        const inspirationToggle = document.getElementById('pc-inspiration-toggle');
        if (inspirationToggle) {
            inspirationToggle.addEventListener('click', () => {
                char.inspiration = !char.inspiration;
                saveAndEmit(char);
                renderSheetData(char);
            });
        }

        const heroInput = document.getElementById('pc-hero-points-input');
        if (heroInput) {
            heroInput.addEventListener('change', (e) => {
                const val = Math.max(0, parseInt(e.target.value) || 0);
                char.heroPoints = val;
                saveAndEmit(char);
                renderSheetData(char);
            });
        }

        document.querySelector('.pc-roll-init')?.addEventListener('click', (e) => {
            const dexScore = getTotalStat(char, 'dex') || 10;
            const dexMod = getMod(dexScore);
            let toggleFormulaStr = '';
            if (char.skillToggles) {
                char.skillToggles
                    .filter((t) => t.enabled)
                    .forEach((t) => {
                        if (t.target === 'all' || t.target === 'initiative') {
                            const cleanT =
                                t.formula.startsWith('+') || t.formula.startsWith('-') ? t.formula : '+' + t.formula;
                            toggleFormulaStr += `${cleanT}[${t.name || 'Toggle'}]`;
                        }
                    });
            }
            const globalMod = char.globalAbilityMod || '0';
            let formula = '1d20';
            if (dexMod !== 0) {
                formula += `${dexMod >= 0 ? '+' : ''}${dexMod}[DEX]`;
            }
            if (globalMod !== '0') {
                const cleanG = globalMod.startsWith('+') || globalMod.startsWith('-') ? globalMod : '+' + globalMod;
                formula += `${cleanG}[Global]`;
            }
            formula += toggleFormulaStr;

            const rollData = simulateRoll(formula, 20, e);

            let isTiebreaker = true;
            if (window.VTT?.campaignState?.settings?.initDexTiebreaker !== undefined) {
                isTiebreaker = !!window.VTT.campaignState.settings.initDexTiebreaker;
            } else if (window.VTT?.canvasEngine?.getCampaignSettings) {
                isTiebreaker = window.VTT.canvasEngine.getCampaignSettings().initDexTiebreaker !== false;
            }

            if (isTiebreaker && rollData && typeof rollData.total === 'number') {
                const dexTiebreaker = Math.round(dexScore) / 100;
                rollData.total = Math.round((rollData.total + dexTiebreaker) * 100) / 100;
            }

            vtt.socket.emit('chat:msg', {
                text: `[${char.name}] rolls **Initiative**`,
                roll: rollData
            });

            // Automatically link or auto-spawn token on canvas and register to Initiative tracker
            if (window.VTT && window.VTT.chatEngine) {
                const canvasEngine = window.VTT.canvasEngine;
                let linkedToken = null;

                if (canvasEngine) {
                    const tokens = canvasEngine.getTokens ? canvasEngine.getTokens() : {};
                    const selectedIds = canvasEngine.getSelectedTokenIds ? canvasEngine.getSelectedTokenIds() : [];

                    // 1. Check if an active selected token belongs to this character
                    for (const id of selectedIds) {
                        const t = tokens[id];
                        if (t && (t.characterId === char.id || (t.isPlayer && t.name === char.name))) {
                            linkedToken = t;
                            break;
                        }
                    }

                    // 2. If not selected, check if any token on the canvas belongs to this character
                    if (!linkedToken) {
                        for (const id in tokens) {
                            const t = tokens[id];
                            if (t && (t.characterId === char.id || (t.isPlayer && t.name === char.name))) {
                                linkedToken = t;
                                break;
                            }
                        }
                    }

                    // 3. If still no token exists on the canvas, auto-spawn one at canvas viewport center
                    if (!linkedToken && canvasEngine.addToken) {
                        let spawnX = 200;
                        let spawnY = 200;
                        if (canvasEngine.getCanvasMouseCoords) {
                            const center = canvasEngine.getCanvasMouseCoords({
                                clientX: window.innerWidth / 2,
                                clientY: window.innerHeight / 2
                            });
                            if (center && Number.isFinite(center.x) && Number.isFinite(center.y)) {
                                spawnX = Math.round(center.x);
                                spawnY = Math.round(center.y);
                            }
                        }

                        const activeImg = char.tokenImage || char.avatar || char.img || 'favicon.svg';
                        const newToken = {
                            id: 'token_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
                            name: char.name,
                            characterId: char.id,
                            isPlayer: true,
                            layer: 'token',
                            x: spawnX,
                            y: spawnY,
                            hp: char.hpCurrent !== undefined ? char.hpCurrent : char.hp?.current || 10,
                            maxHp: char.hpMax !== undefined ? char.hpMax : char.hp?.max || 10,
                            tempHp: char.tempHp || 0,
                            size: char.tokenSize || 1,
                            sightRange: char.tokenSight !== undefined ? char.tokenSight : 60,
                            img: activeImg
                        };

                        canvasEngine.addToken(newToken);
                        linkedToken = newToken;
                    }
                }

                // Register into initiative roster
                const tokenId = linkedToken ? linkedToken.id : null;
                const tokenImg = linkedToken ? linkedToken.img : char.tokenImage || char.avatar || char.img || null;
                window.VTT.chatEngine.addToInitiative(char.name, rollData.total, tokenId, tokenImg);
            }
        });

        document.getElementById('pc-roll-death-save')?.addEventListener('click', (e) => {
            vtt.socket.emit('chat:msg', {
                text: `[${char.name}] rolls **Death Save**`,
                roll: simulateRoll('1d20', 20, e)
            });
        });

        document.querySelectorAll('.pc-ds-success').forEach((cb) => {
            cb.addEventListener('change', (e) => {
                char.deathSaves = char.deathSaves || { successes: 0, failures: 0 };
                const idx = parseInt(e.currentTarget.dataset.idx);
                const isChecked = e.currentTarget.checked;
                // Treat checkboxes as an exact value: the highest checked index
                if (isChecked) {
                    char.deathSaves.successes = Math.max(char.deathSaves.successes, idx);
                } else {
                    char.deathSaves.successes = idx - 1;
                }
                saveAndEmit(char);
                renderSheetData(char);
            });
        });

        document.querySelectorAll('.pc-ds-failure').forEach((cb) => {
            cb.addEventListener('change', (e) => {
                char.deathSaves = char.deathSaves || { successes: 0, failures: 0 };
                const idx = parseInt(e.currentTarget.dataset.idx);
                const isChecked = e.currentTarget.checked;
                if (isChecked) {
                    char.deathSaves.failures = Math.max(char.deathSaves.failures, idx);
                } else {
                    char.deathSaves.failures = idx - 1;
                }
                saveAndEmit(char);
                renderSheetData(char);
            });
        });

        document.querySelectorAll('.pc-roll-check').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                const ab = e.currentTarget.dataset.ab;
                const mod = parseInt(e.currentTarget.dataset.mod);
                let formula = '1d20';
                if (mod !== 0) {
                    formula += `${mod >= 0 ? '+' : ''}${mod}[${ab.toUpperCase()}]`;
                }
                const globalMod = char.globalAbilityMod || '0';
                if (globalMod !== '0') {
                    const cleanG = globalMod.startsWith('+') || globalMod.startsWith('-') ? globalMod : '+' + globalMod;
                    formula += `${cleanG}[Global]`;
                }
                vtt.socket.emit('chat:msg', {
                    text: `[${char.name}: ${ab.toUpperCase()} Check] rolls **Ability Check**`,
                    roll: simulateRoll(formula, 20, e)
                });
            });
        });

        document.querySelectorAll('.pc-roll-save').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                const ab = e.currentTarget.dataset.ab;
                const isProf = char.saves[ab];
                const baseMod = parseInt(e.currentTarget.dataset.mod);
                const globalMod = char.globalSaveMod || 0;
                const customMod = (char.saveMods && char.saveMods[ab]) || 0;
                const pb = getProfBonus(char.level);

                let formula = '1d20';
                if (baseMod !== 0) {
                    formula += `${baseMod >= 0 ? '+' : ''}${baseMod}[${ab.toUpperCase()}]`;
                }
                if (isProf && pb) {
                    formula += `+${pb}[PB]`;
                }
                if (customMod) {
                    formula += `${customMod >= 0 ? '+' : ''}${customMod}[Custom]`;
                }
                if (globalMod) {
                    formula += `${globalMod >= 0 ? '+' : ''}${globalMod}[Global]`;
                }

                if (char.saveToggles) {
                    char.saveToggles
                        .filter((t) => t.enabled)
                        .forEach((t) => {
                            if (t.target === 'all' || t.target === ab) {
                                const cleanT =
                                    t.formula.startsWith('+') || t.formula.startsWith('-')
                                        ? t.formula
                                        : '+' + t.formula;
                                formula += `${cleanT}[${t.name || 'Toggle'}]`;
                            }
                        });
                }

                vtt.socket.emit('chat:msg', {
                    text: `[${char.name}: ${ab.toUpperCase()} Save] rolls **Saving Throw**`,
                    roll: simulateRoll(formula, 20, e)
                });
            });
        });

        document.querySelector('.pc-hp-settings-btn')?.addEventListener('click', () => {
            openHpSettingsModalExt(char, getModalOptions());
        });

        document.querySelectorAll('.pc-hp-quick-toggle').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.currentTarget.dataset.idx);
                if (char.hpToggles && char.hpToggles[idx]) {
                    char.hpToggles[idx].enabled = !char.hpToggles[idx].enabled;
                    calculateEffectiveHp(char);
                    saveAndEmit(char);
                    renderSheetData(char);
                }
            });
        });

        document.querySelector('.pc-ac-settings-btn')?.addEventListener('click', () => {
            openAcSettingsModalExt(char, getModalOptions());
        });

        document.querySelectorAll('.pc-ac-quick-toggle').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.currentTarget.dataset.idx);
                if (char.acToggles && char.acToggles[idx]) {
                    char.acToggles[idx].enabled = !char.acToggles[idx].enabled;
                    calculateEffectiveAc(char);
                    saveAndEmit(char);
                    renderSheetData(char);
                }
            });
        });

        document.querySelector('.pc-save-settings-btn')?.addEventListener('click', () => {
            openSaveSettingsModalExt(char, getModalOptions());
        });

        document.querySelectorAll('.pc-save-quick-toggle').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.currentTarget.dataset.idx);
                if (char.saveToggles && char.saveToggles[idx]) {
                    char.saveToggles[idx].enabled = !char.saveToggles[idx].enabled;
                    saveAndEmit(char);
                    renderSheetData(char);
                }
            });
        });

        document.querySelector('.pc-skill-settings-btn')?.addEventListener('click', () => {
            openSkillSettingsModalExt(char, getModalOptions());
        });

        document.querySelectorAll('.pc-skill-quick-toggle').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.currentTarget.dataset.idx);
                if (char.skillToggles && char.skillToggles[idx]) {
                    char.skillToggles[idx].enabled = !char.skillToggles[idx].enabled;
                    saveAndEmit(char);
                    renderSheetData(char);
                }
            });
        });

        document.querySelectorAll('.pc-skill-roll').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                const skill = e.currentTarget.dataset.skill;
                const skillObj = ALL_SKILLS.find((s) => s.name === skill);
                const ab = skillObj ? skillObj.ability : 'dex';

                const baseMod = getMod(getTotalStat(char, ab) || 10);
                const isProf = char.skills[skill];
                const isExp = char.expertise[skill];
                const profBonus = getProfBonus(char.level);

                let formula = '1d20';
                if (baseMod !== 0) {
                    formula += `${baseMod >= 0 ? '+' : ''}${baseMod}[${ab.toUpperCase()}]`;
                }
                if (isProf && profBonus) {
                    formula += `+${profBonus}[PB]`;
                }
                if (isExp && profBonus) {
                    formula += `+${profBonus}[EXP]`;
                }

                const customMod = char.skillMods[skill] || '0';
                if (customMod !== '0') {
                    const cleanC = customMod.startsWith('+') || customMod.startsWith('-') ? customMod : '+' + customMod;
                    formula += `${cleanC}[Custom]`;
                }

                const globalMod = char.globalAbilityMod || '0';
                if (globalMod !== '0') {
                    const cleanG = globalMod.startsWith('+') || globalMod.startsWith('-') ? globalMod : '+' + globalMod;
                    formula += `${cleanG}[Global]`;
                }

                if (char.skillToggles) {
                    char.skillToggles
                        .filter((t) => t.enabled)
                        .forEach((t) => {
                            if (t.target === 'all' || t.target === skill) {
                                const cleanT =
                                    t.formula.startsWith('+') || t.formula.startsWith('-')
                                        ? t.formula
                                        : '+' + t.formula;
                                formula += `${cleanT}[${t.name || 'Toggle'}]`;
                            }
                        });
                }

                vtt.socket.emit('chat:msg', {
                    text: `[${char.name}: ${skill}] rolls **Skill Check**`,
                    roll: simulateRoll(formula, 20, e)
                });
            });
        });

        document.querySelector('.pc-tool-settings-btn')?.addEventListener('click', () => {
            openToolSettingsModalExt(char, getModalOptions());
        });

        document.querySelectorAll('.pc-tool-roll').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                const toolName = e.currentTarget.dataset.tool;
                const toolData = char.tools[toolName];
                if (!toolData) return;

                const ab = toolData.ability || 'dex';
                const baseMod = getMod(getTotalStat(char, ab) || 10);
                const isProf = toolData.prof;
                const isExp = toolData.exp;
                const profBonus = getProfBonus(char.level);

                let formula = '1d20';
                if (baseMod !== 0) formula += `${baseMod >= 0 ? '+' : ''}${baseMod}[${ab.toUpperCase()}]`;
                if (isProf && profBonus) formula += `+${profBonus}[PB]`;
                if (isExp && profBonus) formula += `+${profBonus}[EXP]`;

                const customMod = toolData.mod || '0';
                if (customMod !== '0') {
                    const cleanC = customMod.startsWith('+') || customMod.startsWith('-') ? customMod : '+' + customMod;
                    formula += `${cleanC}[Custom]`;
                }

                const globalMod = char.globalAbilityMod || '0';
                if (globalMod !== '0') {
                    const cleanG = globalMod.startsWith('+') || globalMod.startsWith('-') ? globalMod : '+' + globalMod;
                    formula += `${cleanG}[Global]`;
                }

                if (char.skillToggles) {
                    char.skillToggles
                        .filter((t) => t.enabled)
                        .forEach((t) => {
                            if (t.target === 'all') {
                                const cleanT =
                                    t.formula.startsWith('+') || t.formula.startsWith('-')
                                        ? t.formula
                                        : '+' + t.formula;
                                formula += `${cleanT}[${t.name || 'Toggle'}]`;
                            }
                        });
                }

                vtt.socket.emit('chat:msg', {
                    text: `[${char.name || 'Player'}: ${toolName} Check] rolls **Tool Check**`,
                    roll: simulateRoll(formula)
                });
            });
        });

        document.getElementById('pc-dcAbility')?.addEventListener('change', (e) => {
            char.dcAbility = e.target.value;
            saveAndEmit(char);
            renderSheetData(char);
        });
        document.getElementById('pc-spellAbility')?.addEventListener('change', (e) => {
            char.spellAbility = e.target.value;
            saveAndEmit(char);
            renderSheetData(char);
        });

        document.getElementById('btn-add-macro')?.addEventListener('click', () => openMacroModal(-1));
        document
            .querySelectorAll('.pc-macro-edit')
            .forEach((btn) =>
                btn.addEventListener('click', (e) => openMacroModal(parseInt(e.currentTarget.dataset.idx)))
            );
        document.querySelectorAll('.pc-macro-del').forEach((btn) =>
            btn.addEventListener('click', (e) => {
                if (confirm('Delete this macro?')) {
                    char.macros.splice(parseInt(e.currentTarget.dataset.idx), 1);
                    saveAndEmit(char);
                    renderSheetData(char);
                }
            })
        );

        // Macro Category Management
        document.getElementById('btn-create-macro-cat')?.addEventListener('click', () => openCategoryModal('macro'));

        document.querySelectorAll('.pc-macro-cat-edit').forEach((btn) =>
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                openCategoryModal('macro', e.currentTarget.dataset.categoryId);
            })
        );

        document.querySelectorAll('.pc-macro-cat-del').forEach((btn) =>
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                openCategoryDeleteModal('macro', e.currentTarget.dataset.categoryId);
            })
        );

        document.querySelectorAll('.pc-macro-cat-header').forEach((hdr) =>
            hdr.addEventListener('click', (e) => {
                const cId = e.currentTarget.dataset.categoryId;
                if (!cId) return;
                const cat = (char.macroCategories || []).find((c) => c.id === cId);
                if (cat) {
                    cat.collapsed = !cat.collapsed;
                    saveAndEmit(char);
                    renderSheetData(char);
                }
            })
        );

        document.querySelectorAll('.pc-macro-cat-select').forEach((sel) =>
            sel.addEventListener('change', (e) => {
                const idx = parseInt(e.currentTarget.dataset.idx);
                const newCatId = e.currentTarget.value || null;
                if (char.macros && char.macros[idx]) {
                    char.macros[idx].categoryId = newCatId;
                    saveAndEmit(char);
                    renderSheetData(char);
                }
            })
        );

        document.querySelectorAll('.pc-macro-desc-ping').forEach((btn) =>
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const m = char.macros[e.currentTarget.dataset.idx];
                if (!m || !m.description) return;
                vtt.socket.emit('chat:msg', {
                    abilityCard: {
                        creatureName: char.name,
                        abilityName: m.name,
                        range: m.range || '',
                        target: m.target || '',
                        text: `<div style="font-size:0.85rem; line-height:1.5; padding:4px 0;">${m.description}</div>`
                    }
                });
            })
        );
        function evaluateAttackRoll(m, isSpell = false, optEvent = null) {
            let globalAtkMod = parseInt(isSpell ? char.spellSettings?.atkMod || 0 : char.attackSettings?.atkMod || 0);
            let atkFormula = '';

            const toggles = isSpell ? char.spellSettings?.toggles : char.attackSettings?.toggles;
            if (toggles) {
                toggles
                    .filter((t) => t.enabled)
                    .forEach((t) => {
                        if (t.target === 'atk' || t.target === 'both') {
                            let f = t.formula;
                            let cleanF = f.startsWith('+') || f.startsWith('-') ? f : '+' + f;
                            atkFormula += `${cleanF}[${t.name || 'Toggle'}]`;
                        }
                    });
            }

            let atkStat = m.attackStat || 'none';
            if (atkStat === 'spell') {
                atkStat = char.spellSettings?.ability || char.spellAbility || 'INT';
            }

            if (atkStat === 'custom') {
                const raw = (m.attackBonus || '').trim();
                const formula = raw.includes('d')
                    ? raw
                    : `1d20${raw.startsWith('+') || raw.startsWith('-') ? raw : '+' + raw}`;
                return simulateRoll(
                    formula +
                        (globalAtkMod ? (globalAtkMod >= 0 ? '+' : '') + globalAtkMod + '[Global]' : '') +
                        atkFormula,
                    m.critRange || 20,
                    optEvent
                );
            }
            if (atkStat === 'none') {
                if (m.attackBonus) {
                    const hasAttack = m.attackBonus.includes('d');
                    const formula = hasAttack
                        ? m.attackBonus
                        : `1d20${m.attackBonus.startsWith('+') || m.attackBonus.startsWith('-') ? m.attackBonus : '+' + m.attackBonus}`;
                    return simulateRoll(
                        formula +
                            (globalAtkMod ? (globalAtkMod >= 0 ? '+' : '') + globalAtkMod + '[Global]' : '') +
                            atkFormula,
                        m.critRange || 20,
                        optEvent
                    );
                }
                return null;
            }

            const prof = getProfBonus(char.level);
            const statScore = getTotalStat(char, atkStat.toLowerCase()) || 10;
            const statMod = getMod(statScore);
            const addProf = m.attackProf;
            const extra = m.attackExtra !== undefined ? parseInt(m.attackExtra) : 0;

            let formula = '1d20';

            if (statMod !== 0) {
                formula += `${statMod >= 0 ? '+' : ''}${statMod}[${atkStat.toUpperCase()}]`;
            }
            if (addProf) {
                formula += `+${prof}[Prof]`;
            }
            if (extra !== 0) {
                formula += `${extra >= 0 ? '+' : ''}${extra}`;
            }
            if (globalAtkMod !== 0) {
                formula += `${globalAtkMod >= 0 ? '+' : ''}${globalAtkMod}[Global]`;
            }
            formula += atkFormula;

            const rollResult = simulateRoll(formula, m.critRange || 20, optEvent);
            return rollResult;
        }

        function evaluateSaveDc(m, isSpell = false) {
            if (!m.saveAbility) return null;
            let dcStat = m.saveDcStat || 'none';
            if (dcStat === 'spell') {
                dcStat = char.spellSettings?.ability || char.spellAbility || 'INT';
            }
            const prof = getProfBonus(char.level);

            if (dcStat === 'custom') {
                const dc =
                    m.saveDcCustom !== undefined && m.saveDcCustom !== null
                        ? parseInt(m.saveDcCustom)
                        : parseInt(m.saveDcBase) || 10;
                return { ability: m.saveAbility, dc };
            }

            let statMod = 0;
            if (dcStat === 'none') {
                if (m.saveDcBase) {
                    return { ability: m.saveAbility, dc: parseInt(m.saveDcBase) };
                }
                statMod = getMod(getTotalStat(char, (char.dcAbility || 'INT').toLowerCase()) || 10);
            } else {
                statMod = getMod(getTotalStat(char, dcStat.toLowerCase()) || 10);
            }

            let globalDcMod = parseInt(isSpell ? char.spellSettings?.dcMod || 0 : char.attackSettings?.dcMod || 0);
            const toggles = isSpell ? char.spellSettings?.toggles : char.attackSettings?.toggles;
            if (toggles) {
                toggles
                    .filter((t) => t.enabled)
                    .forEach((t) => {
                        if (t.target === 'dc' || t.target === 'both') {
                            globalDcMod += parseInt(t.formula) || 0;
                        }
                    });
            }

            const extra = m.saveDcExtra !== undefined ? parseInt(m.saveDcExtra) : 0;
            const dc = 8 + prof + statMod + extra + globalDcMod;
            return { ability: m.saveAbility, dc };
        }

        function evaluateDamageRolls(m, isSpell = false, isCrit = false, optEvent = null) {
            if (!m.damage || !m.damage.length) return [];

            let globalDmgMod = parseInt(isSpell ? char.spellSettings?.dmgMod || 0 : char.attackSettings?.dmgMod || 0);
            let dmgFormula = '';
            let typedToggles = [];

            const toggles = isSpell ? char.spellSettings?.toggles : char.attackSettings?.toggles;

            if (toggles) {
                toggles
                    .filter((t) => t.enabled)
                    .forEach((t) => {
                        if (t.target === 'dmg' || t.target === 'both') {
                            if (t.dmgType && t.dmgType !== '') {
                                typedToggles.push(t);
                            } else {
                                let f = t.formula;
                                let cleanF = f.startsWith('+') || f.startsWith('-') ? f : '+' + f;
                                dmgFormula += `${cleanF}[${t.name || 'Toggle'}]`;
                            }
                        }
                    });
            }

            let results = m.damage.map((d) => {
                let formula = (d.formula || d.dice || '').trim();
                let statMod = 0;

                let statKey = (d.stat || '').replace(/^\+/, '').trim().toLowerCase();
                if (statKey === 'auto') {
                    statKey = (m.attackStat || 'str').toLowerCase();
                }
                if (statKey && statKey !== 'none') {
                    if (statKey === 'spell') {
                        statKey = (char.spellSettings?.ability || char.spellcastingAbility || 'int').toLowerCase();
                    }
                    const score = getTotalStat(char, statKey) || 10;
                    statMod = getMod(score);
                }

                let rollFormula = formula;
                if (statMod !== 0) {
                    rollFormula += `${statMod >= 0 ? '+' : ''}${statMod}[${(statKey || 'STAT').toUpperCase()}]`;
                }
                if (d.custom && d.custom.trim() !== '') {
                    let c = d.custom.trim();
                    let cleanC = c.startsWith('+') || c.startsWith('-') ? c : '+' + c;
                    rollFormula += `${cleanC}[Custom]`;
                } else if (d.extra && parseInt(d.extra)) {
                    const ex = parseInt(d.extra);
                    rollFormula += `${ex >= 0 ? '+' : ''}${ex}[Bonus]`;
                }
                if (globalDmgMod !== 0) {
                    rollFormula += `${globalDmgMod >= 0 ? '+' : ''}${globalDmgMod}[Global]`;
                }
                rollFormula += dmgFormula;

                if (isCrit) {
                    rollFormula = rollFormula.replace(
                        /(\d+)\s*[dD]\s*(\d+)/g,
                        (match, count, faces) => `${parseInt(count) * 2}d${faces}`
                    );
                }
                const r = simulateRoll(rollFormula, 20, optEvent);
                return {
                    formula: d.formula || d.dice || formula,
                    type: d.type || '',
                    roll: r,
                    label: d.label || '',
                    isMagic: !!m.isMagic,
                    isSilvered: !!m.isSilvered,
                    isAdamantine: !!m.isAdamantine,
                    isSpell: !!isSpell
                };
            });

            typedToggles.forEach((t) => {
                let cleanF = t.formula.startsWith('+') || t.formula.startsWith('-') ? t.formula : '+' + t.formula;
                let rollFormula = `${cleanF}[${t.name || 'Toggle'}]`;
                // Because cleanF usually starts with + or -, and formula typically shouldn't start with a sign alone,
                // we'll let simulateRoll handle it. simulateRoll handles leading signs gracefully.
                if (isCrit) {
                    rollFormula = rollFormula.replace(
                        /(\d+)\s*[dD]\s*(\d+)/g,
                        (match, count, faces) => `${parseInt(count) * 2}d${faces}`
                    );
                }
                const r = simulateRoll(rollFormula, 20, optEvent);
                results.push({
                    formula: cleanF,
                    type: t.dmgType,
                    roll: r,
                    isMagic: !!m.isMagic,
                    isSilvered: !!m.isSilvered,
                    isAdamantine: !!m.isAdamantine,
                    isSpell: !!isSpell
                });
            });

            return results;
        }

        document.querySelectorAll('.pc-macro-attack').forEach((btn) =>
            btn.addEventListener('click', (e) => {
                const m = char.macros[e.currentTarget.dataset.idx];
                if (!m) return;
                let r = evaluateAttackRoll(m, false, e);
                if (!r) {
                    r = simulateRoll('1d20', m.critRange || 20, e);
                }
                if (r) {
                    vtt.socket.emit('chat:msg', {
                        macroCard: {
                            charName: char.name,
                            macroName: m.name,
                            description: m.description || '',
                            range: m.range || '',
                            target: m.target || '',
                            atkRoll: r
                        }
                    });
                }
            })
        );

        document.querySelectorAll('.pc-macro-save').forEach((btn) =>
            btn.addEventListener('click', (e) => {
                const m = char.macros[e.currentTarget.dataset.idx];
                if (!m) return;
                const saveInfo = evaluateSaveDc(m);
                if (saveInfo) {
                    vtt.socket.emit('chat:msg', {
                        macroCard: {
                            charName: char.name,
                            macroName: m.name,
                            description: m.description || '',
                            range: m.range || '',
                            target: m.target || '',
                            saveInfo
                        }
                    });
                }
            })
        );

        document.querySelectorAll('.pc-macro-damage').forEach((btn) =>
            btn.addEventListener('click', (e) => {
                const m = char.macros[e.currentTarget.dataset.idx];
                if (!m) return;
                let dmgRolls = evaluateDamageRolls(m, false, false, e);
                if (!dmgRolls.length && m.damageFormula) {
                    dmgRolls = [
                        {
                            formula: m.damageFormula,
                            type: m.damageType || 'Damage',
                            roll: simulateRoll(m.damageFormula, 20, e),
                            isMagic: !!m.isMagic,
                            isSilvered: !!m.isSilvered,
                            isAdamantine: !!m.isAdamantine,
                            isSpell: false
                        }
                    ];
                }
                if (!dmgRolls.length) return;

                vtt.socket.emit('chat:msg', {
                    macroCard: {
                        charName: char.name,
                        macroName: m.name,
                        description: m.description || '',
                        range: m.range || '',
                        target: m.target || '',
                        dmgRolls
                    }
                });
            })
        );

        document.querySelectorAll('.pc-macro-roll-all').forEach((btn) =>
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const m = char.macros[e.currentTarget.dataset.idx];
                if (!m) return;

                let atkRoll = evaluateAttackRoll(m, false, e);
                const saveInfo = evaluateSaveDc(m);
                let isCrit = atkRoll && atkRoll.isCritSuccess;
                let dmgRolls = evaluateDamageRolls(m, false, isCrit, e);
                if (!dmgRolls.length && m.damageFormula) {
                    dmgRolls = [
                        {
                            formula: m.damageFormula,
                            type: m.damageType || 'Damage',
                            roll: simulateRoll(m.damageFormula, 20, e),
                            isMagic: !!m.isMagic,
                            isSilvered: !!m.isSilvered,
                            isAdamantine: !!m.isAdamantine,
                            isSpell: false
                        }
                    ];
                }

                vtt.socket.emit('chat:msg', {
                    macroCard: {
                        charName: char.name,
                        macroName: m.name,
                        description: m.description || '',
                        range: m.range || '',
                        target: m.target || '',
                        atkRoll,
                        saveInfo,
                        dmgRolls
                    }
                });
            })
        );

        // Macro Drag-and-Drop Variables
        let macroDragHandlePressed = false;
        let macroDraggedIdx = null;
        let macroCatDragHandlePressed = false;
        let macroCatDraggedIdx = null;

        const clearAllDropIndicators = () => {
            document
                .querySelectorAll(
                    '#pc-macros-list .macro-row, #pc-macros-list .pc-macro-cat-header, #pc-macros-list .pc-macro-cat-card'
                )
                .forEach((el) => {
                    el.style.borderTop = '';
                    el.style.borderBottom = '';
                    el.style.boxShadow = '';
                    el.style.opacity = '';
                    el.style.outline = '';
                    el.style.background = '';
                });
        };

        document.querySelectorAll('.pc-macro-drag-handle').forEach((handle) => {
            handle.addEventListener('mousedown', () => {
                macroDragHandlePressed = true;
            });
        });
        document.querySelectorAll('.pc-macro-cat-drag-handle').forEach((handle) => {
            handle.addEventListener('mousedown', () => {
                macroCatDragHandlePressed = true;
            });
        });

        window.addEventListener('mouseup', () => {
            macroDragHandlePressed = false;
            macroCatDragHandlePressed = false;
        });

        // 5. Macro Row & Macro Category Drag-and-Drop
        document.querySelectorAll('#pc-macros-list .macro-row').forEach((row) => {
            row.addEventListener('dragstart', (e) => {
                if (!macroDragHandlePressed) {
                    e.preventDefault();
                    return;
                }
                macroDraggedIdx = parseInt(row.dataset.idx);
                e.dataTransfer.setData('text/plain', `macro_${macroDraggedIdx}`);
                e.dataTransfer.effectAllowed = 'move';
                setTimeout(() => {
                    row.style.opacity = '0.4';
                }, 0);
            });

            row.addEventListener('dragover', (e) => {
                if (macroDraggedIdx === null || macroDraggedIdx === undefined) return;
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = 'move';

                const rect = row.getBoundingClientRect();
                const midY = rect.top + rect.height / 2;
                clearAllDropIndicators();
                const draggedRow = document.querySelector(`#pc-macros-list .macro-row[data-idx="${macroDraggedIdx}"]`);
                if (draggedRow) draggedRow.style.opacity = '0.4';

                if (e.clientY < midY) {
                    row.style.borderTop = '2px solid var(--color-gold-base)';
                    row.style.boxShadow = '0 -4px 8px -2px rgba(212, 175, 55, 0.6)';
                } else {
                    row.style.borderBottom = '2px solid var(--color-gold-base)';
                    row.style.boxShadow = '0 4px 8px -2px rgba(212, 175, 55, 0.6)';
                }
            });

            row.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                clearAllDropIndicators();

                const fromIdx = macroDraggedIdx;
                const targetIdx = parseInt(row.dataset.idx);
                const targetCategoryId = row.dataset.categoryId || null;
                macroDraggedIdx = null;
                macroDragHandlePressed = false;

                if (isNaN(fromIdx) || isNaN(targetIdx) || fromIdx === targetIdx) return;

                const rect = row.getBoundingClientRect();
                const midY = rect.top + rect.height / 2;
                let insertAt = targetIdx;
                if (e.clientY >= midY) {
                    insertAt = targetIdx + 1;
                }
                if (fromIdx < insertAt) {
                    insertAt--;
                }

                const [movedItem] = char.macros.splice(fromIdx, 1);
                movedItem.categoryId = targetCategoryId;
                char.macros.splice(insertAt, 0, movedItem);
                saveAndEmit(char);
                renderSheetData(char);
            });

            row.addEventListener('dragend', () => {
                macroDraggedIdx = null;
                macroDragHandlePressed = false;
                clearAllDropIndicators();
            });
        });

        document.querySelectorAll('#pc-macros-list .pc-macro-cat-header').forEach((hdr) => {
            hdr.addEventListener('dragover', (e) => {
                if (macroDraggedIdx === null || macroDraggedIdx === undefined) return;
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = 'move';
                clearAllDropIndicators();
                const draggedRow = document.querySelector(`#pc-macros-list .macro-row[data-idx="${macroDraggedIdx}"]`);
                if (draggedRow) draggedRow.style.opacity = '0.4';

                hdr.style.outline = '2px dashed var(--color-gold-base)';
                hdr.style.background = 'rgba(212, 175, 55, 0.15)';
            });

            hdr.addEventListener('drop', (e) => {
                if (macroDraggedIdx === null || macroDraggedIdx === undefined) return;
                e.preventDefault();
                e.stopPropagation();
                clearAllDropIndicators();

                const fromIdx = macroDraggedIdx;
                const targetCategoryId = hdr.dataset.categoryId || null;
                macroDraggedIdx = null;
                macroDragHandlePressed = false;

                if (!isNaN(fromIdx) && char.macros[fromIdx]) {
                    char.macros[fromIdx].categoryId = targetCategoryId;
                    saveAndEmit(char);
                    renderSheetData(char);
                }
            });
        });

        document.querySelectorAll('#pc-macros-list .pc-macro-cat-card[data-category-idx]').forEach((card) => {
            card.addEventListener('dragstart', (e) => {
                if (!macroCatDragHandlePressed) return;
                macroCatDraggedIdx = parseInt(card.dataset.categoryIdx);
                e.dataTransfer.setData('text/plain', 'mcat_' + macroCatDraggedIdx);
                e.dataTransfer.effectAllowed = 'move';
                setTimeout(() => {
                    card.style.opacity = '0.4';
                }, 0);
            });

            card.addEventListener('dragover', (e) => {
                if (macroCatDraggedIdx === null || macroCatDraggedIdx === undefined) return;
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = 'move';

                const rect = card.getBoundingClientRect();
                const midY = rect.top + rect.height / 2;
                clearAllDropIndicators();
                const draggedCard = document.querySelector(
                    `#pc-macros-list .pc-macro-cat-card[data-category-idx="${macroCatDraggedIdx}"]`
                );
                if (draggedCard) draggedCard.style.opacity = '0.4';

                if (e.clientY < midY) {
                    card.style.borderTop = '2px solid var(--color-gold-base)';
                } else {
                    card.style.borderBottom = '2px solid var(--color-gold-base)';
                }
            });

            card.addEventListener('drop', (e) => {
                if (macroCatDraggedIdx === null || macroCatDraggedIdx === undefined) return;
                e.preventDefault();
                e.stopPropagation();
                clearAllDropIndicators();

                const fromIdx = macroCatDraggedIdx;
                const targetIdx = parseInt(card.dataset.categoryIdx);
                macroCatDraggedIdx = null;
                macroCatDragHandlePressed = false;

                if (isNaN(fromIdx) || isNaN(targetIdx) || fromIdx === targetIdx) return;

                const rect = card.getBoundingClientRect();
                const midY = rect.top + rect.height / 2;
                let insertAt = targetIdx;
                if (e.clientY >= midY) {
                    insertAt = targetIdx + 1;
                }
                if (fromIdx < insertAt) {
                    insertAt--;
                }

                const [movedContainer] = char.macroCategories.splice(fromIdx, 1);
                char.macroCategories.splice(insertAt, 0, movedContainer);
                saveAndEmit(char);
                renderSheetData(char);
            });

            card.addEventListener('dragend', () => {
                macroCatDraggedIdx = null;
                macroCatDragHandlePressed = false;
                clearAllDropIndicators();
            });
        });

        function harvestBuildTab() {
            // Harvest Primary tab Bio fields if present
            harvestBioData(char);

            // If legacy build tab inputs exist in DOM, safely harvest them
            const classSels = document.querySelectorAll('.pc-class-sel');
            if (classSels.length > 0) {
                const newClasses = [];
                classSels.forEach((sel) => {
                    const idx = sel.dataset.idx;
                    const clsName = sel.value;
                    const subName = document.querySelector(`.pc-subclass-sel[data-idx="${idx}"]`)?.value || '';
                    const lvl = parseInt(document.querySelector(`.pc-class-level[data-idx="${idx}"]`)?.value) || 1;
                    if (clsName) {
                        newClasses.push({ name: clsName, subclass: subName, level: lvl });
                    }
                });
                if (newClasses.length > 0) {
                    char.classes = newClasses;
                    char.class = char.classes[0].name;
                    char.level = char.classes.reduce((acc, c) => acc + c.level, 0);
                }
            }

            if (document.getElementById('pc-race')) char.race = document.getElementById('pc-race').value;
            if (document.getElementById('pc-subrace')) char.subrace = document.getElementById('pc-subrace').value;
            if (document.getElementById('pc-background'))
                char.background = document.getElementById('pc-background').value;
            if (document.getElementById('pc-hpMax'))
                char.hpMax = parseInt(document.getElementById('pc-hpMax').value) || char.hpMax;
            if (document.getElementById('pc-ac')) char.ac = parseInt(document.getElementById('pc-ac').value) || char.ac;
            if (document.getElementById('pc-speed-walk')) {
                char.speed = {
                    walk: parseInt(document.getElementById('pc-speed-walk').value) || 0,
                    climb: parseInt(document.getElementById('pc-speed-climb')?.value) || 0,
                    fly: parseInt(document.getElementById('pc-speed-fly')?.value) || 0,
                    burrow: parseInt(document.getElementById('pc-speed-burrow')?.value) || 0
                };
            }
            if (document.getElementById('pc-sense-darkvision')) {
                char.senses = {
                    darkvision: parseInt(document.getElementById('pc-sense-darkvision').value) || 0,
                    devilSight: parseInt(document.getElementById('pc-sense-devilsight')?.value) || 0,
                    blindsight: parseInt(document.getElementById('pc-sense-blindsight')?.value) || 0,
                    truesight: parseInt(document.getElementById('pc-sense-truesight')?.value) || 0
                };
                char.tokenSight = Math.max(
                    char.senses.darkvision,
                    char.senses.devilSight,
                    char.senses.blindsight,
                    char.senses.truesight
                );
            }

            if (char.hpCurrent > char.hpMax) char.hpCurrent = char.hpMax;
        }

        document.getElementById('pc-save-build')?.addEventListener('click', () => {
            harvestBuildTab();
            saveAndEmit(char);
            renderSheetData(char);
            if (typeof window.showToast === 'function') {
                window.showToast('Character edits saved successfully.');
            }
        });

        document.querySelectorAll('#pc-open-character-builder-btn, #pc-build-tab-open-builder-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                harvestBuildTab();
                openCharacterBuilderModal(currentChar);
            });
        });

        document.getElementById('pc-race')?.addEventListener('change', async (e) => {
            char.race = e.target.value || '';
            char.subrace = '';
            const subSel = document.getElementById('pc-subrace');
            if (subSel) subSel.value = '';
            const disabledSources = await getDisabledSources();
            await updateSubraceDropdown(char.race, '', disabledSources);
            harvestBuildTab();
            saveAndEmit(char);
        });

        document.getElementById('pc-subrace')?.addEventListener('change', (e) => {
            char.subrace = e.target.value || '';
            harvestBuildTab();
            saveAndEmit(char);
        });

        document.getElementById('pc-background')?.addEventListener('change', (e) => {
            char.background = e.target.value || '';
            harvestBuildTab();
            saveAndEmit(char);
        });

        ['pc-sense-darkvision', 'pc-sense-devilsight', 'pc-sense-blindsight', 'pc-sense-truesight'].forEach((id) => {
            document.getElementById(id)?.addEventListener('change', () => {
                harvestBuildTab();
                saveAndEmit(char);
            });
        });

        document.getElementById('pc-add-class')?.addEventListener('click', () => {
            harvestBuildTab();
            const currentClassNames = char.classes.map((c) => c.name);
            let availableClasses = [];
            if (builderCache && Array.isArray(builderCache.classes)) {
                const seen = new Set();
                builderCache.classes.forEach((c) => {
                    const badge = getDisplaySourceBadge(c.source);
                    const tag = badge ? ` [${badge}]` : c.source ? ` [${c.source}]` : '';
                    const fullName = `${c.name}${tag}`;
                    if (!seen.has(fullName)) {
                        seen.add(fullName);
                        availableClasses.push(fullName);
                    }
                });
            } else if (builderCache?.classIndex) {
                availableClasses = Object.keys(builderCache.classIndex).map(
                    (k) => k.charAt(0).toUpperCase() + k.slice(1)
                );
            }
            const unusedClass = availableClasses.find((c) => !currentClassNames.includes(c)) || '';
            char.classes.push({ name: unusedClass, subclass: '', level: 1 });
            saveAndEmit(char);
            renderSheetData(char);
        });

        document.querySelectorAll('.pc-class-del').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                harvestBuildTab();
                const idx = e.currentTarget.dataset.idx;
                char.classes.splice(idx, 1);
                saveAndEmit(char);
                renderSheetData(char);
            });
        });

        document.querySelectorAll('.pc-class-sel').forEach((sel) => {
            sel.addEventListener('change', (e) => {
                harvestBuildTab();
                const idx = e.target.dataset.idx;
                if (char.classes && char.classes[idx]) {
                    char.classes[idx].subclass = ''; // Reset subclass
                }
                saveAndEmit(char);
                renderSheetData(char);
            });
        });

        document.querySelectorAll('.pc-subclass-sel').forEach((sel) => {
            sel.addEventListener('change', () => {
                harvestBuildTab();
                saveAndEmit(char);
            });
        });
    }

    function saveAndEmit(char) {
        if (!vtt.campaignState.characters) vtt.campaignState.characters = {};
        if (char.isPlayer === undefined && !char.isCompanion && !char.isCustomNpc) {
            char.isPlayer = true;
        }
        vtt.campaignState.characters[char.id] = char;
        vtt.socket.emit('character:update', { character: char });
        renderCharacterList();
        syncCharHpToTokens(char);
    }

    // Push character HP/TempHP to any linked tokens on the current map
    function syncCharHpToTokens(char) {
        const canvasEngine = window.VTT?.canvasEngine;
        if (!canvasEngine) return;

        const tokens = canvasEngine.getTokens();
        let changed = false;
        const updatedTokens = [];
        const triggerDamageFX = canvasEngine.triggerDamageFXAnimation;
        const triggerHealingFX = canvasEngine.triggerHealingFXAnimation;
        const getTokenDims = canvasEngine.getTokenDrawDimensions || (() => ({ drawW: 50, drawH: 50 }));
        const currentMapId = canvasEngine.getCurrentMapId ? canvasEngine.getCurrentMapId() : null;

        Object.values(tokens).forEach((token) => {
            if (token.characterId === char.id) {
                const prevHp = Number(token.hp);
                const prevTempHp = Number(token.tempHp || 0);

                const newHp = Number(char.hpCurrent ?? char.hp ?? token.hp);
                const newMaxHp = Number(char.hpMax ?? token.maxHp);
                const newTempHp = Number(char.tempHp ?? 0);

                token.hp = newHp;
                token.maxHp = newMaxHp;
                token.tempHp = newTempHp;
                token.ac = char.ac ?? token.ac;
                if (char.tokenSight !== undefined) {
                    token.sightRange = char.tokenSight;
                }
                updatedTokens.push(token);
                changed = true;

                // Detect HP Delta if previous HP was valid
                if (!isNaN(prevHp) && !isNaN(newHp) && newHp !== prevHp) {
                    const deltaHp = newHp - prevHp;
                    const dims = getTokenDims(token);
                    const tx = token.x + (dims.drawW || 50) / 2;
                    const ty = token.y + (dims.drawH || 50) / 2;
                    const r = Math.max(dims.drawW || 50, dims.drawH || 50) / 2;

                    if (deltaHp < 0) {
                        const dmg = Math.abs(deltaHp);
                        if (typeof triggerDamageFX === 'function') {
                            triggerDamageFX(tx, ty, r, ['untyped'], { amount: dmg, tokenId: token.id });
                        }
                        if (vtt?.socket) {
                            vtt.socket.emit('tokens:damage_fx', {
                                mapId: currentMapId,
                                tokenIds: [token.id],
                                damageTypes: ['untyped'],
                                amount: dmg
                            });
                        }
                    } else if (deltaHp > 0) {
                        if (typeof triggerHealingFX === 'function') {
                            triggerHealingFX(tx, ty, r, deltaHp, { tokenId: token.id });
                        }
                        if (vtt?.socket) {
                            vtt.socket.emit('tokens:heal_fx', {
                                mapId: currentMapId,
                                tokenIds: [token.id],
                                amount: deltaHp
                            });
                        }
                    }
                }

                // Detect Temp HP Delta
                if (!isNaN(prevTempHp) && !isNaN(newTempHp) && newTempHp > prevTempHp) {
                    const deltaTemp = newTempHp - prevTempHp;
                    const dims = getTokenDims(token);
                    const tx = token.x + (dims.drawW || 50) / 2;
                    const ty = token.y + (dims.drawH || 50) / 2;
                    const r = Math.max(dims.drawW || 50, dims.drawH || 50) / 2;

                    if (typeof triggerHealingFX === 'function') {
                        triggerHealingFX(tx, ty, r, deltaTemp, { tokenId: token.id, isTempHp: true });
                    }
                    if (vtt?.socket) {
                        vtt.socket.emit('tokens:heal_fx', {
                            mapId: currentMapId,
                            tokenIds: [token.id],
                            amount: deltaTemp,
                            isTempHp: true
                        });
                    }
                }
            }
        });

        if (changed) {
            const currentMapId = canvasEngine.getCurrentMapId();
            if (currentMapId) {
                updatedTokens.forEach((t) => {
                    vtt.socket.emit('token:update', { mapId: currentMapId, token: t });
                });
            }
            canvasEngine.renderAll();
        }
    }

    // Live update of character sheet HP when damage/healing occurs on map canvas
    function syncLiveHp(charId, hpCurrent, hpMax, tempHp) {
        if (!currentChar || currentChar.id !== charId) return;
        currentChar.hpCurrent = hpCurrent;
        if (hpMax !== undefined) currentChar.hpMax = hpMax;
        if (tempHp !== undefined) currentChar.tempHp = tempHp;

        const hpInput = document.getElementById('pc-hp-current-input');
        if (hpInput && document.activeElement !== hpInput) {
            hpInput.value = hpCurrent;
        }

        const hpBar = document.getElementById('pc-hp-bar');
        if (hpBar && currentChar.hpMax > 0) {
            hpBar.style.width = `${Math.round((hpCurrent / currentChar.hpMax) * 100)}%`;
        }

        const tempInput = document.getElementById('pc-temp-hp-current');
        if (tempInput && document.activeElement !== tempInput) {
            tempInput.value = tempHp || 0;
        }

        if (window.VTT?.mobileAdapter?.syncPlayerSheetTopbar) {
            window.VTT.mobileAdapter.syncPlayerSheetTopbar();
        }
    }

    // ─── Socket listeners for multiplayer sync ────────────────────────────────
    if (vtt.socket) {
        vtt.socket.on('character:updated', (data) => {
            if (!vtt.campaignState.characters) vtt.campaignState.characters = {};
            vtt.campaignState.characters[data.character.id] = data.character;
            renderCharacterList();

            if (currentChar && currentChar.id === data.character.id && data.origin !== vtt.socket.id) {
                if (
                    vtt.role !== 'GM' &&
                    (!data.character.assignedPlayers ||
                        !(
                            data.character.assignedPlayers.includes(vtt.username) ||
                            data.character.assignedPlayers.includes('*')
                        ))
                ) {
                    closeSheet();
                } else {
                    currentChar = data.character;
                    renderSheetData(currentChar);
                }
            }
        });

        vtt.socket.on('character:deleted', (data) => {
            if (vtt.campaignState.characters && vtt.campaignState.characters[data.id]) {
                delete vtt.campaignState.characters[data.id];
                renderCharacterList();
            }
            if (currentChar && currentChar.id === data.id) {
                closeSheet();
            }
            if (vtt.creatureSheet && typeof vtt.creatureSheet.getLinkedCharacterId === 'function') {
                if (vtt.creatureSheet.getLinkedCharacterId() === data.id) {
                    if (typeof vtt.creatureSheet.resetSheet === 'function') {
                        vtt.creatureSheet.resetSheet();
                    } else if (typeof vtt.creatureSheet.minimizePanel === 'function') {
                        vtt.creatureSheet.minimizePanel();
                    }
                }
            }
        });

        // HP Buttons Event Delegation
        document.addEventListener('click', (e) => {
            if (!currentChar) return;
            if (e.target.closest('#pc-hp-minus')) {
                showVttPrompt('Damage amount:', '1', (val) => {
                    if (val === null) return;
                    const dmg = parseInt(val || '1');
                    if (!isNaN(dmg)) {
                        currentChar.hpCurrent = Math.max(0, currentChar.hpCurrent - dmg);
                        saveAndEmit(currentChar);
                        debouncedRenderSheetData(currentChar);
                    }
                });
            } else if (e.target.closest('#pc-hp-plus')) {
                showVttPrompt('Heal amount:', '1', (val) => {
                    if (val === null) return;
                    const heal = parseInt(val || '1');
                    if (!isNaN(heal)) {
                        currentChar.hpCurrent = Math.min(currentChar.hpMax, currentChar.hpCurrent + heal);
                        saveAndEmit(currentChar);
                        debouncedRenderSheetData(currentChar);
                    }
                });
            } else if (e.target.closest('#pc-temp-hp-minus')) {
                showVttPrompt('Reduce Temp HP by:', '1', (val) => {
                    if (val === null) return;
                    const dmg = parseInt(val || '1');
                    if (!isNaN(dmg)) {
                        currentChar.tempHp = Math.max(0, (currentChar.tempHp || 0) - dmg);
                        saveAndEmit(currentChar);
                        debouncedRenderSheetData(currentChar);
                    }
                });
            } else if (e.target.closest('#pc-temp-hp-plus')) {
                showVttPrompt('Add Temp HP:', '1', (val) => {
                    if (val === null) return;
                    const add = parseInt(val || '1');
                    if (!isNaN(add)) {
                        currentChar.tempHp = (currentChar.tempHp || 0) + add;
                        saveAndEmit(currentChar);
                        debouncedRenderSheetData(currentChar);
                    }
                });
            } else if (e.target.closest('#pc-hero-minus')) {
                if (currentChar) {
                    currentChar.heroPoints = Math.max(0, (currentChar.heroPoints || 0) - 1);
                    saveAndEmit(currentChar);
                    renderSheetData(currentChar);
                }
            } else if (e.target.closest('#pc-hero-plus')) {
                if (currentChar) {
                    currentChar.heroPoints = (currentChar.heroPoints || 0) + 1;
                    saveAndEmit(currentChar);
                    renderSheetData(currentChar);
                }
            }
        });

        // Initial render on boot
        vtt.socket.on('campaign:state-sync', (camp) => {
            if (camp.characters) renderCharacterList();
        });
    }

    contentEl.addEventListener('click', (e) => {
        const dcBtn = e.target.closest('.pc-spell-dc-btn');
        if (dcBtn) {
            e.preventDefault();
            const dcVal = dcBtn.dataset.dc;
            const ability = dcBtn.dataset.ability;
            vtt.socket.emit('chat:msg', {
                text: `[${currentChar?.name || 'Player'}] pings Spell DC`,
                abilityCard: {
                    creatureName: currentChar?.name || 'Player',
                    abilityName: 'Spell Save DC',
                    text: `<div style="font-size:1.5em; text-align:center; padding: 10px;"><strong>DC ${dcVal}</strong></div>`
                }
            });
            e.stopPropagation();
            return;
        }

        const atkBtn = e.target.closest('.pc-spell-atk-btn');
        if (atkBtn) {
            e.preventDefault();
            const atkVal = atkBtn.dataset.atk;
            const bonusFormula = `1d20${atkVal.startsWith('+') || atkVal.startsWith('-') ? atkVal : '+' + atkVal}`;
            vtt.socket.emit('chat:msg', {
                text: `[${currentChar?.name || 'Player'}] rolls **Spell Attack**`,
                roll: simulateRoll(bonusFormula)
            });
            e.stopPropagation();
            return;
        }

        const chip = e.target.closest('.dice-chip');
        if (chip) {
            const formula = chip.dataset.formula;
            if (chip.classList.contains('dc-chip')) {
                const dcVal = chip.dataset.dc;
                vtt.socket.emit('chat:msg', {
                    text: `[${currentChar?.name || 'Player'}] pings DC ${dcVal}`,
                    abilityCard: {
                        creatureName: currentChar?.name || 'Player',
                        text: `<div style="text-align: center; font-size: 1.8em; margin: 12px 0; color: var(--color-gold-base); font-weight: bold;">DC ${dcVal}</div>`
                    }
                });
            } else if (formula) {
                vtt.socket.emit('chat:msg', {
                    text: `[${currentChar?.name || 'Player'}] rolls **${formula}**`,
                    roll: simulateRoll(formula)
                });
            }
            e.stopPropagation();
            return;
        }

        const quickToggleBtn = e.target.closest('.pc-spell-quick-toggle');
        if (quickToggleBtn) {
            e.preventDefault();
            if (currentChar && currentChar.spellSettings && currentChar.spellSettings.toggles) {
                const idx = quickToggleBtn.dataset.idx;
                currentChar.spellSettings.toggles[idx].enabled = !currentChar.spellSettings.toggles[idx].enabled;
                saveAndEmit(currentChar);
                renderSheetData(currentChar);
            }
            e.stopPropagation();
            return;
        }

        const attackQuickToggleBtn = e.target.closest('.pc-attack-quick-toggle');
        if (attackQuickToggleBtn) {
            e.preventDefault();
            if (currentChar && currentChar.attackSettings && currentChar.attackSettings.toggles) {
                const idx = attackQuickToggleBtn.dataset.idx;
                currentChar.attackSettings.toggles[idx].enabled = !currentChar.attackSettings.toggles[idx].enabled;
                saveAndEmit(currentChar);
                renderSheetData(currentChar);
            }
            e.stopPropagation();
            return;
        }

        const attackSettingsBtn = e.target.closest('.pc-attack-settings-btn');
        if (attackSettingsBtn) {
            e.preventDefault();
            if (currentChar && currentChar.attackSettings) {
                document.getElementById('modal-attack-settings-atk').value = currentChar.attackSettings.atkMod || 0;
                document.getElementById('modal-attack-settings-dmg').value = currentChar.attackSettings.dmgMod || 0;
                document.getElementById('modal-attack-settings-dc').value = currentChar.attackSettings.dcMod || 0;
                window.VTTSpellManager?.renderAttackTogglesList();

                document.getElementById('modal-attack-toggle-form')?.classList.add('vtt-hidden');
                document.getElementById('btn-add-attack-toggle')?.classList.remove('vtt-hidden');

                document.getElementById('pc-attack-settings-modal').classList.remove('vtt-hidden');
                document.getElementById('pc-spell-overlay').classList.remove('vtt-hidden');
            }
            e.stopPropagation();
            return;
        }

        const settingsBtn = e.target.closest('.pc-spell-settings-btn');
        if (settingsBtn) {
            e.preventDefault();
            if (currentChar && currentChar.spellSettings) {
                document.getElementById('modal-settings-ability').value =
                    currentChar.spellSettings.ability || currentChar.spellAbility || 'INT';
                document.getElementById('modal-settings-atk').value = currentChar.spellSettings.atkMod || 0;
                document.getElementById('modal-settings-dc').value = currentChar.spellSettings.dcMod || 0;
                document.getElementById('modal-settings-dmg').value = currentChar.spellSettings.dmgMod || 0;
                window.VTTSpellManager?.renderTogglesList();

                // Hide any nested forms and reset toggle editor state
                document.getElementById('modal-toggle-form')?.classList.add('vtt-hidden');
                document.getElementById('btn-add-toggle')?.classList.remove('vtt-hidden');

                document.getElementById('pc-spell-settings-modal').classList.remove('vtt-hidden');
                document.getElementById('pc-spell-overlay').classList.remove('vtt-hidden');
            }
            e.stopPropagation();
            return;
        }

        const tokenPortrait = e.target.closest('#pc-token-portrait');
        if (tokenPortrait) {
            e.preventDefault();
            if (currentChar) {
                openPlayerTokenEditModalExt(currentChar, getModalOptions());
            }
            e.stopPropagation();
            return;
        }
    });

    contentEl.addEventListener('dragstart', (e) => {
        const tokenPortrait = e.target.closest('#pc-token-portrait');
        if (tokenPortrait && currentChar) {
            const activeImageUrl = getPlayerActiveTokenUrl(currentChar);
            const auras = (currentChar.tokenAuras || []).map((a) => {
                const { isExpanded, ...clean } = a;
                return clean;
            });

            const payload = JSON.stringify({
                type: 'player',
                name: currentChar.name,
                hp: currentChar.hpCurrent,
                maxHp: currentChar.hpMax,
                tempHp: currentChar.tempHp || 0,
                size: currentChar.tokenSize || 1,
                sightRange: currentChar.tokenSight !== undefined ? currentChar.tokenSight : 60,
                img: activeImageUrl,
                characterId: currentChar.id,
                auras: auras,
                lightEnabled: currentChar.tokenLightEnabled,
                lightBright: currentChar.tokenLightBright,
                lightDim: currentChar.tokenLightDim,
                lightColor: currentChar.tokenLightColor,
                fxOverlayEnabled: currentChar.fxOverlayEnabled,
                fxOverlayOpacity: currentChar.fxOverlayOpacity,
                fxOverlayColor: currentChar.fxOverlayColor,
                fxVignetteEnabled: currentChar.fxVignetteEnabled,
                fxVignetteOpacity: currentChar.fxVignetteOpacity,
                fxVignetteColor: currentChar.fxVignetteColor,
                fxShadowEnabled: currentChar.fxShadowEnabled,
                fxShadowBlur: currentChar.fxShadowBlur,
                fxShadowOffset: currentChar.fxShadowOffset,
                fxShadowColor: currentChar.fxShadowColor,
                fxShadowOpacity: currentChar.fxShadowOpacity
            });
            e.dataTransfer.setData('application/json', payload);
            e.dataTransfer.setData('text/plain', payload);
            e.dataTransfer.effectAllowed = 'copy';
        }
    });

    // Global Escape Key Listener for Player Sheet Sub-Modals
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' || e.keyCode === 27) {
            // High priority / nested submodals first
            const highModals = [
                { modal: 'pc-custom-item-modal', overlay: 'pc-item-overlay' },
                { modal: 'pc-item-automation-modal', overlay: 'pc-item-automation-overlay' },
                { modal: 'pc-category-delete-modal', overlay: 'pc-category-delete-overlay' },
                { modal: 'pc-ability-import-cat-modal', overlay: 'pc-ability-overlay' },
                { modal: 'pc-bg-import-modal', overlay: 'pc-bg-import-overlay' },
                { modal: 'modal-pc-token-edit', overlay: 'modal-pc-token-edit-overlay' }
            ];
            for (const item of highModals) {
                const m = document.getElementById(item.modal);
                if (m && !m.classList.contains('vtt-hidden')) {
                    if (m._initialModalSnapshot !== undefined) {
                        const curSnapshot = JSON.stringify(
                            Array.from(
                                m.querySelectorAll(
                                    'input:not([type="button"]):not([type="submit"]):not([type="reset"]), select, textarea'
                                )
                            ).map((el) => (el.type === 'checkbox' ? el.checked : el.value))
                        );
                        if (curSnapshot !== m._initialModalSnapshot) {
                            if (!confirm('Discard unsaved changes?')) {
                                e.stopPropagation();
                                return;
                            }
                        }
                    }
                    m.classList.add('vtt-hidden');
                    if (item.overlay) {
                        if (item.modal === 'pc-custom-item-modal') {
                            const parent = document.getElementById('pc-item-modal');
                            if (!parent || parent.classList.contains('vtt-hidden')) {
                                document.getElementById(item.overlay)?.classList.add('vtt-hidden');
                            }
                        } else {
                            document.getElementById(item.overlay)?.classList.add('vtt-hidden');
                        }
                    }
                    e.stopPropagation();
                    return;
                }
            }

            // Standard sub-modals next
            const standardModals = [
                { modal: 'pc-item-modal', overlay: 'pc-item-overlay' },
                { modal: 'pc-macro-modal', overlay: 'pc-macro-overlay' },
                { modal: 'pc-category-modal', overlay: 'pc-category-overlay' },
                { modal: 'pc-bag-modal', overlay: 'pc-bag-overlay' },
                { modal: 'pc-ability-modal', overlay: 'pc-ability-overlay' },
                { modal: 'pc-hp-settings-modal', overlay: 'pc-hp-settings-overlay' },
                { modal: 'pc-ac-settings-modal', overlay: 'pc-ac-settings-overlay' },
                { modal: 'pc-save-settings-modal', overlay: 'pc-save-settings-overlay' },
                { modal: 'pc-skill-settings-modal', overlay: 'pc-skill-settings-overlay' },
                { modal: 'pc-tool-settings-modal', overlay: 'pc-tool-settings-overlay' },
                { modal: 'pc-assign-players-modal', overlay: 'pc-assign-players-overlay' }
            ];
            for (const item of standardModals) {
                const m = document.getElementById(item.modal);
                if (m && !m.classList.contains('vtt-hidden')) {
                    if (item.modal === 'pc-macro-modal') {
                        closeMacroModal(false);
                        if (m.classList.contains('vtt-hidden')) {
                            e.stopPropagation();
                            return;
                        }
                        e.stopPropagation();
                        return;
                    }
                    if (m._initialModalSnapshot !== undefined) {
                        const curSnapshot = JSON.stringify(
                            Array.from(
                                m.querySelectorAll(
                                    'input:not([type="button"]):not([type="submit"]):not([type="reset"]), select, textarea'
                                )
                            ).map((el) => (el.type === 'checkbox' ? el.checked : el.value))
                        );
                        if (curSnapshot !== m._initialModalSnapshot) {
                            if (!confirm('Discard unsaved changes?')) {
                                e.stopPropagation();
                                return;
                            }
                        }
                    }
                    m.classList.add('vtt-hidden');
                    if (item.overlay) {
                        document.getElementById(item.overlay)?.classList.add('vtt-hidden');
                    }
                    e.stopPropagation();
                    return;
                }
            }
        }
    });

    // Initial render
    renderCharacterList();

    // ─── Public API ───────────────────────────────────────────────────────────
    return {
        openSheet,
        openPanel,
        minimizePanel,
        closeSheet,
        getCurrentChar: () => currentChar,
        syncLiveHp
    };
}
