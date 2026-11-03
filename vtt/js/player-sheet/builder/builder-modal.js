/**
 * Character Builder Wizard - Master Modal Coordinator
 * Shell markup, step navigation, state management, candidates engine, and Save & Apply commit.
 */

import { getMod, getClassHitDie, getProfBonus } from '../calc/stats.js';
import { calculateCharacterSpellSlots } from '../calc/spell-slots.js';
import { extractTextFromEntries, normalizeSkill } from '../vtt-sheet-rolls.js';
import {
    POINT_BUY_COSTS,
    getPointBuySpent,
    extractCatalogRacialBonuses,
    getEffectiveRacialBonuses,
    getFeatAndAsiBonuses,
    getEffectiveStats,
    getBaseScores,
    extractGrantedSpells,
    calculateEffectiveSpeed,
    parseEquipmentTextToData
} from './builder-state.js';
import { renderStep1 } from './step1-identity.js';
import { renderStep2 } from './step2-abilities.js';
import { renderStep3 } from './step3-proficiencies.js';
import { renderStep4 } from './step4-features.js';
import { renderStep5, MARTIAL_WEAPONS, SIMPLE_WEAPONS } from './step5-equipment.js';
import { renderStepSpells, renderStep6 } from './step6-spells.js';
import { renderStepFeats, renderStep7 } from './step7-feats.js';
import { renderStep8 } from './step8-review.js';

export const STANDARD_WEAPONS = {
    dagger: { dmg1: '1d4', dmgType: 'piercing', properties: ['finesse', 'light', 'thrown'] },
    longsword: { dmg1: '1d8', dmg2: '1d10', dmgType: 'slashing', properties: ['versatile'] },
    shortsword: { dmg1: '1d6', dmgType: 'piercing', properties: ['finesse', 'light'] },
    greatsword: { dmg1: '2d6', dmgType: 'slashing', properties: ['heavy', 'two-handed'] },
    halberd: { dmg1: '1d10', dmgType: 'slashing', properties: ['heavy', 'reach', 'two-handed'] },
    glaive: { dmg1: '1d10', dmgType: 'slashing', properties: ['heavy', 'reach', 'two-handed'] },
    greataxe: { dmg1: '1d12', dmgType: 'slashing', properties: ['heavy', 'two-handed'] },
    battleaxe: { dmg1: '1d8', dmg2: '1d10', dmgType: 'slashing', properties: ['versatile'] },
    rapier: { dmg1: '1d8', dmgType: 'piercing', properties: ['finesse'] },
    scimitar: { dmg1: '1d6', dmgType: 'slashing', properties: ['finesse', 'light'] },
    maul: { dmg1: '2d6', dmgType: 'bludgeoning', properties: ['heavy', 'two-handed'] },
    warhammer: { dmg1: '1d8', dmg2: '1d10', dmgType: 'bludgeoning', properties: ['versatile'] },
    mace: { dmg1: '1d6', dmgType: 'bludgeoning', properties: [] },
    handaxe: { dmg1: '1d6', dmgType: 'slashing', properties: ['light', 'thrown'] },
    javelin: { dmg1: '1d6', dmgType: 'piercing', properties: ['thrown'] },
    spear: { dmg1: '1d6', dmg2: '1d8', dmgType: 'piercing', properties: ['thrown', 'versatile'] },
    quarterstaff: { dmg1: '1d6', dmg2: '1d8', dmgType: 'bludgeoning', properties: ['versatile'] },
    shortbow: { dmg1: '1d6', dmgType: 'piercing', rawType: 'R', properties: ['ammunition', 'two-handed'] },
    longbow: { dmg1: '1d8', dmgType: 'piercing', rawType: 'R', properties: ['ammunition', 'heavy', 'two-handed'] },
    'light crossbow': {
        dmg1: '1d8',
        dmgType: 'piercing',
        rawType: 'R',
        properties: ['ammunition', 'loading', 'two-handed']
    },
    'heavy crossbow': {
        dmg1: '1d10',
        dmgType: 'piercing',
        rawType: 'R',
        properties: ['ammunition', 'heavy', 'loading', 'two-handed']
    },
    'hand crossbow': { dmg1: '1d6', dmgType: 'piercing', rawType: 'R', properties: ['ammunition', 'light', 'loading'] }
};

export function ensureCharacterBuilderModalExists() {
    if (document.getElementById('pc-character-builder-modal')) return;

    const container = document.createElement('div');
    container.innerHTML = `
        <div id="pc-character-builder-overlay" class="vtt-sheet-submodal-overlay vtt-hidden" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.78); backdrop-filter:blur(6px); z-index:3010;"></div>
        <div id="pc-character-builder-modal" class="vtt-sheet-submodal vtt-hidden glassmorphism" style="position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); z-index:3015; width:94vw; max-width:1160px; height:88vh; max-height:900px; display:flex; flex-direction:column; border-radius:12px; overflow:hidden; box-shadow:0 16px 48px rgba(0,0,0,0.85), 0 0 20px rgba(212,175,55,0.25);">
            <!-- Header -->
            <div style="padding:12px 20px; border-bottom:1px solid var(--color-border-subtle); display:flex; justify-content:space-between; align-items:center; background:rgba(10,14,24,0.95); flex-shrink:0;">
                <div style="display:flex; align-items:center; gap:12px;">
                    <i class="fa-solid fa-wand-magic-sparkles text-gradient-gold" style="font-size:1.35rem;"></i>
                    <div>
                        <div style="display:flex; align-items:center; gap:10px;">
                            <h3 style="margin:0; color:var(--color-gold-base); font-size:1.15rem; font-family:var(--font-heading);">Character Builder & Level Up Wizard</h3>
                            <span id="pc-builder-audit-badge" class="badge" style="background:rgba(46,204,113,0.15); border:1px solid rgba(46,204,113,0.4); color:#2ecc71; font-size:0.75rem; padding:2px 8px; border-radius:4px;">Wizard Active</span>
                        </div>
                        <div id="pc-builder-char-summary" style="font-size:0.8rem; color:var(--color-text-secondary); margin-top:2px;">
                            Loading character builder...
                        </div>
                    </div>
                </div>
                <button id="pc-builder-close-btn" style="background:transparent; border:none; color:var(--color-text-muted); cursor:pointer; font-size:1.3rem; padding:4px;" title="Close"><i class="fa-solid fa-xmark"></i></button>
            </div>

            <!-- Top Step Navigation Bar (8 Steps) -->
            <div class="pc-builder-step-nav" id="pc-builder-step-nav"></div>

            <!-- Step Body Area -->
            <div id="pc-builder-body" class="scroll-styled" style="flex:1; overflow-y:auto; padding:18px 22px; display:flex; flex-direction:column; gap:16px;">
            </div>

            <!-- Bottom Footer Navigation -->
            <div style="padding:12px 20px; border-top:1px solid var(--color-border-subtle); display:flex; justify-content:space-between; align-items:center; background:rgba(10,14,24,0.95); flex-shrink:0;">
                <div id="pc-builder-footer-counts" style="font-size:0.82rem; color:var(--color-text-secondary); display:flex; align-items:center; gap:8px;">
                    Step 1 of 8 &bull; 0 Abilities, 0 Items, 0 Spells
                </div>
                <div style="display:flex; gap:10px; align-items:center;">
                    <button id="pc-builder-cancel-btn" class="btn btn-secondary btn-sm">Cancel</button>
                    <button id="pc-wizard-back-btn" class="btn btn-secondary btn-sm" style="display:inline-flex; align-items:center; gap:6px;">
                        <i class="fa-solid fa-chevron-left"></i> Back
                    </button>
                    <button id="pc-wizard-next-btn" class="btn btn-secondary btn-sm" style="display:inline-flex; align-items:center; gap:6px;">
                        Next <i class="fa-solid fa-chevron-right"></i>
                    </button>
                    <button id="pc-builder-apply-btn" class="btn btn-primary btn-sm" style="display:inline-flex; align-items:center; gap:8px; font-weight:600; box-shadow:0 0 14px rgba(212,175,55,0.35);">
                        <i class="fa-solid fa-check-double"></i> Save & Apply
                    </button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(container);
}

export async function openCharacterBuilderModal(char, options = {}) {
    if (!char) return;
    ensureCharacterBuilderModalExists();

    const {
        ensureBuilderCache = () => Promise.resolve({}),
        getDisabledSources = () => Promise.resolve(new Set()),
        isSourceAllowed = () => true,
        saveAndEmit = () => {},
        renderSheetData = () => {},
        evaluateAbilityMaxUses = () => 0,
        getCharIs2024 = () => false,
        vtt = window.vtt || {}
    } = options;

    const modal = document.getElementById('pc-character-builder-modal');
    const overlay = document.getElementById('pc-character-builder-overlay');
    const bodyEl = document.getElementById('pc-builder-body');
    const summaryEl = document.getElementById('pc-builder-char-summary');
    const countsEl = document.getElementById('pc-builder-footer-counts');
    const closeBtn = document.getElementById('pc-builder-close-btn');
    const cancelBtn = document.getElementById('pc-builder-cancel-btn');
    const applyBtn = document.getElementById('pc-builder-apply-btn');
    const backBtn = document.getElementById('pc-wizard-back-btn');
    const nextBtn = document.getElementById('pc-wizard-next-btn');

    if (!modal || !overlay || !bodyEl) return;

    modal.classList.remove('vtt-hidden');
    overlay.classList.remove('vtt-hidden');
    applyBtn.disabled = false;
    applyBtn.innerHTML = '<i class="fa-solid fa-check-double"></i> Save & Apply';

    bodyEl.innerHTML = `
        <div style="text-align:center; padding:40px 20px; color:var(--color-text-muted);">
            <i class="fa-solid fa-spinner fa-spin" style="font-size:2.2rem; color:var(--color-gold-base); margin-bottom:14px;"></i>
            <div style="font-size:1.05rem; font-weight:600; color:var(--color-gold-light);">Loading Character Builder Wizard...</div>
            <div style="font-size:0.85rem; margin-top:6px;">Auditing Species, Classes, Ability Scores, Equipment, Spells & Features</div>
        </div>
    `;

    // 1. Ensure compendium caches
    const builderCache = await ensureBuilderCache();
    const disabledSources = await getDisabledSources();

    // 2. Wizard Step Navigation Definition
    const STEPS = [
        { id: 1, title: 'Identity & Classes', shortTitle: '1. Identity', icon: 'fa-user' },
        { id: 2, title: 'Ability Scores & ASI', shortTitle: '2. Abilities', icon: 'fa-dice-d20' },
        { id: 3, title: 'Proficiencies & Skills', shortTitle: '3. Proficiencies', icon: 'fa-award' },
        { id: 4, title: 'Features & Customizations', shortTitle: '4. Features', icon: 'fa-hat-wizard' },
        { id: 5, title: 'Equipment & Gear', shortTitle: '5. Equipment', icon: 'fa-shield-halved' },
        { id: 6, title: 'Feats & ASIs', shortTitle: '6. Feats / ASIs', icon: 'fa-trophy' },
        { id: 7, title: 'Spells & Magic', shortTitle: '7. Spells', icon: 'fa-wand-magic-sparkles' },
        { id: 8, title: 'Review HP & AC', shortTitle: '8. HP & AC', icon: 'fa-heart-pulse' }
    ];

    let currentStep = 1;

    // 3. Working State Model Initialization
    const workingChar = {
        name: char.name || 'New Hero',
        race: char.race || '',
        subrace: char.subrace || '',
        isCustomRace: false,
        customRaceText: '',
        isCustomSubrace: false,
        customSubraceText: '',
        background: char.background || '',
        isCustomBackground: false,
        customBackgroundText: '',
        classes:
            Array.isArray(char.classes) && char.classes.length > 0
                ? JSON.parse(JSON.stringify(char.classes))
                : [
                      {
                          name: char.class || 'Fighter',
                          subclass: '',
                          level: char.level || 1,
                          isCustomClass: false,
                          customClassText: '',
                          isCustomSubclass: false,
                          customSubclassText: ''
                      }
                  ],
        speed: {
            walk: parseInt(char.speed?.walk ?? (char.speed || 30)) || 30,
            climb: parseInt(char.speed?.climb) || 0,
            fly: parseInt(char.speed?.fly) || 0,
            burrow: parseInt(char.speed?.burrow) || 0
        },
        senses: {
            darkvision: parseInt(char.senses?.darkvision) || 0,
            devilSight: parseInt(char.senses?.devilSight) || 0,
            blindsight: parseInt(char.senses?.blindsight) || 0,
            truesight: parseInt(char.senses?.truesight) || 0
        },
        bio: {
            age: char.bio?.age || '',
            height: char.bio?.height || '',
            weight: char.bio?.weight || '',
            backstory: char.bio?.backstory || '',
            notes: char.bio?.notes || ''
        },
        statMethod: char.statMethod || (char.pointBuyScores ? 'pointbuy' : char.baseStats ? 'manual' : 'standard'),
        baseStats: char.baseStats
            ? { ...char.baseStats }
            : char.stats
              ? { ...char.stats }
              : { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
        standardArrayAssignments: char.standardArrayAssignments
            ? { ...char.standardArrayAssignments }
            : { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
        pointBuyScores: char.pointBuyScores
            ? { ...char.pointBuyScores }
            : { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 },
        rolledScores:
            Array.isArray(char.rolledScores) && char.rolledScores.length === 6
                ? JSON.parse(JSON.stringify(char.rolledScores))
                : [
                      { id: 0, rolls: [4, 5, 3, 2], val: 12, assignedStat: 'str' },
                      { id: 1, rolls: [5, 4, 4, 1], val: 13, assignedStat: 'dex' },
                      { id: 2, rolls: [6, 5, 3, 2], val: 14, assignedStat: 'con' },
                      { id: 3, rolls: [3, 4, 3, 1], val: 10, assignedStat: 'int' },
                      { id: 4, rolls: [6, 6, 3, 2], val: 15, assignedStat: 'wis' },
                      { id: 5, rolls: [2, 3, 3, 1], val: 8, assignedStat: 'cha' }
                  ],
        manualScores: char.manualScores
            ? { ...char.manualScores }
            : char.baseStats
              ? { ...char.baseStats }
              : char.stats
                ? { ...char.stats }
                : { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
        racialAsiMode: char.racialAsiMode || 'catalog',
        tashasMode: char.tashasMode || 'plus2plus1',
        tashasPlus2: char.tashasPlus2 || 'str',
        tashasPlus1: char.tashasPlus1 || 'con',
        tashasPlus1_1: char.tashasPlus1_1 || 'str',
        tashasPlus1_2: char.tashasPlus1_2 || 'con',
        tashasPlus1_3: char.tashasPlus1_3 || 'wis',
        bgAsiMode: char.bgAsiMode || 'plus2plus1',
        bgAsiPlus2: char.bgAsiPlus2 || 'str',
        bgAsiPlus1: char.bgAsiPlus1 || 'con',
        bgAsiPlus1_1: char.bgAsiPlus1_1 || 'str',
        bgAsiPlus1_2: char.bgAsiPlus1_2 || 'con',
        bgAsiPlus1_3: char.bgAsiPlus1_3 || 'wis',
        customRacialBonuses: char.customRacialBonuses
            ? { ...char.customRacialBonuses }
            : { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
        racialChoices: { ...(char.racialChoices || {}) },
        expertise: { ...(char.expertise || {}) },
        featureSubChoices: { ...(char.featureSubChoices || {}) },
        customFeatures: [],
        useStartingWealth: false,
        startingGoldAmount: 0,
        autoWeaponMacros: true,
        _manualSpeedCustomized: false
    };

    // Helper: Automatically create attack macro for weapons
    function generateWeaponMacro(targetChar, item, catalogItem) {
        if (!targetChar || !item) return;
        const itemLow = (item.name || '').toLowerCase().trim();
        const stdKey = Object.keys(STANDARD_WEAPONS).find((k) => itemLow.includes(k));
        const stdData = stdKey ? STANDARD_WEAPONS[stdKey] : null;

        const cat =
            catalogItem && Object.keys(catalogItem).length > 1
                ? catalogItem
                : stdData
                  ? { ...stdData }
                  : catalogItem || {};

        const isWeapon = !!(
            cat.macroTemplate ||
            cat.isWeapon ||
            cat.dmg1 ||
            cat.weaponCategory ||
            cat.rawType === 'M' ||
            cat.rawType === 'R' ||
            item.rawType === 'M' ||
            item.rawType === 'R' ||
            (cat.type && cat.type.toLowerCase().includes('weapon')) ||
            (item.type && item.type.toLowerCase().includes('weapon')) ||
            stdData
        );
        if (!isWeapon) return;

        if (stdData) {
            if (!cat.dmg1) cat.dmg1 = stdData.dmg1;
            if (!cat.dmg2 && stdData.dmg2) cat.dmg2 = stdData.dmg2;
            if (!cat.dmgType) cat.dmgType = stdData.dmgType;
            if (!cat.properties || cat.properties.length === 0) cat.properties = stdData.properties;
        }

        if (!targetChar.macros) targetChar.macros = [];
        if (!targetChar.macroCategories) targetChar.macroCategories = [];
        let weapCat = targetChar.macroCategories.find((c) => c.name.toLowerCase() === 'weapons');
        if (!weapCat) {
            weapCat = { id: 'cat_weapons', name: 'Weapons', collapsed: false };
            targetChar.macroCategories.unshift(weapCat);
        }

        const existing = targetChar.macros.find(
            (m) => (m.name || '').toLowerCase().trim() === item.name.toLowerCase().trim()
        );
        if (existing) return;

        const tmpl = cat.macroTemplate || {};
        const rawProps = Array.isArray(cat.properties) ? cat.properties : [];
        const props = rawProps.map((p) => (typeof p === 'string' ? p.toLowerCase() : ''));
        const isFinesse = tmpl.isFinesse !== undefined ? tmpl.isFinesse : props.some((p) => p.includes('finesse'));
        const isRanged =
            tmpl.isRanged !== undefined
                ? tmpl.isRanged
                : cat.rawType === 'R' ||
                  item.rawType === 'R' ||
                  (cat.type || '').toLowerCase().includes('ranged') ||
                  props.some((p) => p.includes('ammunition'));

        const stats = getEffectiveStats(workingChar, matchedBaseRace, matchedSubrace, asiTiers, racialChoiceDefs);
        const strVal = parseInt(stats.str) || 10;
        const dexVal = parseInt(stats.dex) || 10;
        let chosenStat = 'str';
        if (isRanged) chosenStat = 'dex';
        else if (isFinesse) chosenStat = dexVal >= strVal ? 'dex' : 'str';
        else if (tmpl.attackStat && tmpl.attackStat !== 'auto') chosenStat = tmpl.attackStat;

        let bonusVal = tmpl.attackExtra !== undefined ? tmpl.attackExtra : 0;
        if (!bonusVal && cat.bonusWeapon) {
            bonusVal = parseInt(cat.bonusWeapon) || 0;
        } else if (!bonusVal) {
            const match = item.name.match(/\+(\d+)/);
            if (match) bonusVal = parseInt(match[1]) || 0;
        }

        const rangeVal = tmpl.range || (isRanged ? '80/320 ft' : '5 ft');
        const targetVal = tmpl.target || '1 target';

        const dmgRows =
            tmpl.damageRows && tmpl.damageRows.length > 0
                ? tmpl.damageRows.map((r, rIdx) => ({
                      id: 'dmg_' + Date.now() + '_' + rIdx,
                      formula: r.formula,
                      stat: r.stat === 'auto' ? chosenStat : r.stat || '',
                      extra: r.extra !== undefined ? r.extra : rIdx === 0 ? bonusVal : 0,
                      type: r.type || '',
                      label: r.label || ''
                  }))
                : [
                      {
                          id: 'dmg_' + Date.now(),
                          formula: cat.dmg1 || '1d6',
                          stat: chosenStat,
                          extra: bonusVal,
                          type: cat.dmgType ? cat.dmgType.charAt(0).toUpperCase() + cat.dmgType.slice(1) : 'Slashing',
                          label: ''
                      }
                  ];

        let descNote = item.description || (Array.isArray(cat.entries) ? cat.entries.join('\n') : '');
        const versatileVal = tmpl.versatile || cat.dmg2;
        if (versatileVal) {
            descNote += (descNote ? '\n\n' : '') + `*Versatile:* Two-handed attack deals ${versatileVal} damage.`;
        }

        const isMagic = !!(tmpl.isMagic !== undefined
            ? tmpl.isMagic
            : cat.isMagic || cat.bonusWeapon || (item.name && /\+\d+/.test(item.name)));
        const isSilvered = !!(tmpl.isSilvered !== undefined
            ? tmpl.isSilvered
            : cat.isSilvered || (item.name && /silver/i.test(item.name)));
        const isAdamantine = !!(tmpl.isAdamantine !== undefined
            ? tmpl.isAdamantine
            : cat.isAdamantine || (item.name && /adamant/i.test(item.name)));

        targetChar.macros.push({
            id: 'mac_' + Date.now() + Math.random().toString(36).substr(2, 5),
            name: item.name,
            categoryId: weapCat.id,
            description: descNote,
            range: rangeVal,
            target: targetVal,
            attackStat: chosenStat,
            attackProf: true,
            attackExtra: bonusVal,
            critRange: 20,
            attackBonus: '',
            saveAbility: '',
            saveDcStat: 'none',
            saveDcExtra: 0,
            saveDcCustom: null,
            isMagic,
            isSilvered,
            isAdamantine,
            damage: dmgRows
        });
    }

    const racialChoiceDefs = [];

    async function loadFullClassData(className) {
        if (!className) return null;
        const raw = className
            .toLowerCase()
            .replace(/\s*\[.*?\]$/, '')
            .trim();
        builderCache.fullClasses = builderCache.fullClasses || {};
        if (builderCache.fullClasses[raw]) return builderCache.fullClasses[raw];
        const file = builderCache?.classIndex ? builderCache.classIndex[raw] || null : null;
        if (!file) {
            const customCls = (builderCache?.classes || []).find((c) => (c.name || '').toLowerCase() === raw);
            if (customCls) {
                const synthesized = {
                    class: [customCls],
                    classFeature: customCls.classFeatures || [],
                    subclass: customCls.subclasses || [],
                    subclassFeature: (customCls.subclasses || []).flatMap((s) =>
                        (s.subclassFeatures || s.features || []).map((sf) => ({
                            ...sf,
                            subclass: s.name,
                            subclassSource: s.source || customCls.source
                        }))
                    )
                };
                builderCache.fullClasses[raw] = synthesized;
                return synthesized;
            }
            return null;
        }
        try {
            const resp = await fetch(`data/class/${file}`);
            if (!resp.ok) return null;
            const data = await resp.json();
            builderCache.fullClasses[raw] = data;
            return data;
        } catch (e) {
            console.warn(`[CharacterBuilder] Failed to load class file for ${className}:`, e);
            return null;
        }
    }

    // Deduplication Sets
    const existingAbilities = new Set((char.abilityCards || []).map((a) => (a.name || '').toLowerCase().trim()));
    const existingEquip = new Set((char.equipment || []).map((e) => (e.name || '').toLowerCase().trim()));
    const existingSpells = new Set();
    const userSelectedSpellMap = new Map();
    if (char.spells && typeof char.spells === 'object') {
        Object.values(char.spells).forEach((lvlList) => {
            if (Array.isArray(lvlList)) {
                lvlList.forEach((s) => {
                    if (s && s.name) {
                        const lowName = s.name.toLowerCase().trim();
                        existingSpells.add(lowName);
                        userSelectedSpellMap.set(lowName, true);
                    }
                });
            }
        });
    }

    // Catalog candidate structures
    let matchedBaseRace = null;
    let matchedSubrace = null;
    let matchedBg = null;
    let candidateRacialTraits = [];
    let candidateBgFeatures = [];
    let candidateBgItems = [];
    let candidateBgSkills = [];
    let candidateClassFeatures = [];
    let classEquipChoiceSets = [];
    let classFixedItems = [];
    let candidateProficiencies = [];
    let availableClassSkills = [];
    let selectedClassSkills = new Set();
    let classSkillLimit = 2;
    let optFeatureSections = [];
    let candidateInnateSpells = [];
    let candidateBgExpandedSpells = [];
    let classSpellSections = [];
    let asiTiers = Array.isArray(char.builderFeatSelections)
        ? JSON.parse(JSON.stringify(char.builderFeatSelections))
        : [];
    let allCandidateAbilities = [];

    const allArmorOptions = [{ id: 'none', name: 'Unarmored Defense / No Armor (10 + DEX)', type: 'None', baseAc: 10 }];

    const builderState = {
        hpMode: 'average',
        calculatedHp: 10,
        hpRolls: [],
        hpBreakdown: {
            base: 10,
            tough: 0,
            dwarvenToughness: 0,
            draconicResilience: 0,
            totalBonus: 0
        },
        hpChatBroadcast: true,
        calculatedAc: 10,
        activeArmorId: 'none',
        shieldEnabled: false,
        acFormulaText: '10 + DEX',
        hpManualOverride: char.hpManualOverride || null,
        acManualOverride: char.acManualOverride || null
    };

    // Recompute candidates whenever Identity (Species, Background, Classes, Levels) changes
    async function recomputeCandidates() {
        const classes = workingChar.classes;
        const primaryCls = classes[0] || { name: 'Fighter', subclass: '', level: 1 };
        const totalLevel = classes.reduce((sum, c) => sum + (parseInt(c.level) || 1), 0);

        // 1. Match Race & Subrace
        const rawRaceName = (workingChar.race || '')
            .replace(/\s*\[.*?\]$/, '')
            .replace(/\s*\([^)]*\).*$/, '')
            .trim()
            .toLowerCase();
        const rawSubraceName = (workingChar.subrace || '')
            .replace(/\s*\[.*?\]$/, '')
            .replace(/\s*\([^)]*\).*$/, '')
            .trim()
            .toLowerCase();

        matchedBaseRace =
            builderCache?.races?.find((r) => {
                const rBase = (r.raceName || r.name || '')
                    .replace(/\s*\[.*?\]$/, '')
                    .replace(/\s*\([^)]*\).*$/, '')
                    .trim()
                    .toLowerCase();
                return rBase === rawRaceName && !r.subraceName;
            }) || builderCache?.races?.find((r) => (r.name || '').toLowerCase() === rawRaceName);

        matchedSubrace = null;
        if (rawSubraceName && builderCache?.races) {
            matchedSubrace = builderCache.races.find((r) => {
                const rBase = (r.raceName || r.name || '')
                    .replace(/\s*\[.*?\]$/, '')
                    .replace(/\s*\([^)]*\).*$/, '')
                    .trim()
                    .toLowerCase();
                const sName = (
                    r.subraceName ||
                    (r.name && r.name.includes('(') ? r.name.match(/\(([^)]+)\)/)?.[1] : '') ||
                    ''
                ).toLowerCase();
                return (
                    (rBase === rawRaceName || !rawRaceName) &&
                    (sName === rawSubraceName || sName.includes(rawSubraceName) || rawSubraceName.includes(sName))
                );
            });
        }

        // Racial traits
        candidateRacialTraits = [];
        const seenTraits = new Set();
        [matchedBaseRace, matchedSubrace].filter(Boolean).forEach((rObj) => {
            if (Array.isArray(rObj.traits)) {
                rObj.traits.forEach((t) => {
                    const tName = t.name || '';
                    if (seenTraits.has(tName.toLowerCase().trim())) return;
                    seenTraits.add(tName.toLowerCase().trim());
                    candidateRacialTraits.push({
                        id: t.id || 'trait_' + Math.random().toString(36).substr(2, 6),
                        name: tName,
                        source: rObj.source || 'PHB',
                        actionType: t.actionType || 'passive',
                        description: t.description || (Array.isArray(t.rawEntries) ? t.rawEntries.join('\n') : ''),
                        formula: t.formula || '',
                        formulaConfig: t.formulaConfig || null,
                        hasCounter: !!t.hasCounter,
                        usesMax: t.usesMax || null,
                        resetType: t.resetType || 'short',
                        category: `${rObj.name} Traits`,
                        type: 'race',
                        checked: !existingAbilities.has(tName.toLowerCase().trim())
                    });
                });
            }
        });

        // Update default speeds & senses
        const effectiveSpeed = calculateEffectiveSpeed(workingChar, matchedBaseRace, matchedSubrace, asiTiers);
        if (!workingChar._manualSpeedCustomized) {
            workingChar.speed.walk = effectiveSpeed.walk;
            workingChar.speed.climb = effectiveSpeed.climb;
            workingChar.speed.fly = effectiveSpeed.fly;
            workingChar.speed.burrow = effectiveSpeed.burrow;
        }
        if (matchedSubrace?.senses?.darkvision || matchedBaseRace?.senses?.darkvision) {
            workingChar.senses.darkvision = Math.max(
                workingChar.senses.darkvision,
                matchedSubrace?.senses?.darkvision || matchedBaseRace?.senses?.darkvision || 0
            );
        }

        // 2. Match Background
        const rawBgName = (workingChar.background || '')
            .replace(/\s*\[.*?\]$/, '')
            .trim()
            .toLowerCase();
        const reqBgSrc = (workingChar.backgroundSource || '').toUpperCase();
        matchedBg =
            builderCache?.bgs?.find(
                (b) =>
                    ((b.name && b.name.toLowerCase() === rawBgName) || (b.id && b.id.toLowerCase() === rawBgName)) &&
                    (!reqBgSrc || (b.source || 'PHB').toUpperCase() === reqBgSrc)
            ) ||
            builderCache?.bgs?.find(
                (b) =>
                    (b.name && b.name.toLowerCase() === rawBgName) ||
                    (b.id && b.id.toLowerCase() === rawBgName) ||
                    (rawBgName && b.name && rawBgName.includes(b.name.toLowerCase()))
            );

        candidateBgFeatures = [];
        candidateBgItems = [];
        candidateBgSkills = [];

        if (matchedBg) {
            if (Array.isArray(matchedBg.features) && matchedBg.features.length > 0) {
                matchedBg.features.forEach((f) => {
                    candidateBgFeatures.push({
                        id: 'bg_feat_' + Math.random().toString(36).substr(2, 6),
                        name: f.name || `Feature: ${matchedBg.name}`,
                        source: matchedBg.source || 'PHB',
                        actionType: 'passive',
                        description: f.description || '',
                        category: 'Background Features',
                        type: 'background',
                        checked: !existingAbilities.has((f.name || '').toLowerCase().trim())
                    });
                });
            } else if (matchedBg.description) {
                candidateBgFeatures.push({
                    id: 'bg_feat_' + Math.random().toString(36).substr(2, 6),
                    name: `Feature: ${matchedBg.name}`,
                    source: matchedBg.source || 'PHB',
                    actionType: 'passive',
                    description: matchedBg.description,
                    category: 'Background Features',
                    type: 'background',
                    checked: !existingAbilities.has(`feature: ${matchedBg.name}`.toLowerCase())
                });
            }

            if (matchedBg.skillsData) {
                if (Array.isArray(matchedBg.skillsData.fixed)) {
                    matchedBg.skillsData.fixed.forEach((s) => {
                        const norm = normalizeSkill(s);
                        if (norm && !candidateBgSkills.includes(norm)) candidateBgSkills.push(norm);
                    });
                }
            } else if (matchedBg.skills) {
                matchedBg.skills.split(',').forEach((s) => {
                    const norm = normalizeSkill(s);
                    if (norm && !candidateBgSkills.includes(norm)) candidateBgSkills.push(norm);
                });
            }

            let hasBgEquipItems = false;
            if (matchedBg.equipmentData) {
                if (
                    Array.isArray(matchedBg.equipmentData.fixedItems) &&
                    matchedBg.equipmentData.fixedItems.length > 0
                ) {
                    matchedBg.equipmentData.fixedItems.forEach((it) => {
                        hasBgEquipItems = true;
                        candidateBgItems.push({
                            id: 'bg_it_' + Math.random().toString(36).substr(2, 6),
                            name: it.name || 'Item',
                            qty: parseInt(it.quantity) || 1,
                            weight: parseFloat(it.weight) || 0,
                            type: 'Gear',
                            source: 'Background',
                            checked: !existingEquip.has((it.name || '').toLowerCase().trim())
                        });
                    });
                }
                if (matchedBg.equipmentData.fixedGold) {
                    const bgGold = parseInt(matchedBg.equipmentData.fixedGold) || 0;
                    if (bgGold > 0) {
                        hasBgEquipItems = true;
                        candidateBgItems.push({
                            id: 'bg_gold_' + Math.random().toString(36).substr(2, 6),
                            name: `${bgGold} GP (Starting Gold)`,
                            qty: 1,
                            weight: parseFloat((bgGold * 0.02).toFixed(2)),
                            type: 'Currency',
                            source: 'Background',
                            isGold: true,
                            goldAmount: bgGold,
                            checked: (parseInt(char.currency?.gp) || 0) === 0
                        });
                    }
                }
            }

            // Fallback for custom backgrounds with string/array equipment but no populated equipmentData
            const rawBgEquip = matchedBg.equipment || matchedBg.startingEquipment;
            if (!hasBgEquipItems && rawBgEquip) {
                const parsedBgEq = parseEquipmentTextToData(rawBgEquip);
                if (Array.isArray(parsedBgEq.fixedItems)) {
                    parsedBgEq.fixedItems.forEach((it) => {
                        candidateBgItems.push({
                            id: 'bg_it_' + Math.random().toString(36).substr(2, 6),
                            name: it.name || 'Item',
                            qty: parseInt(it.quantity) || 1,
                            weight: parseFloat(it.weight) || 0,
                            type: 'Gear',
                            source: 'Background',
                            checked: !existingEquip.has((it.name || '').toLowerCase().trim())
                        });
                    });
                }
                if (parsedBgEq.fixedGold > 0) {
                    const bgGold = parsedBgEq.fixedGold;
                    candidateBgItems.push({
                        id: 'bg_gold_' + Math.random().toString(36).substr(2, 6),
                        name: `${bgGold} GP (Starting Gold)`,
                        qty: 1,
                        weight: parseFloat((bgGold * 0.02).toFixed(2)),
                        type: 'Currency',
                        source: 'Background',
                        isGold: true,
                        goldAmount: bgGold,
                        checked: (parseInt(char.currency?.gp) || 0) === 0
                    });
                }
            }
        }

        // 3. Class Features, Starting Gear & Proficiencies
        candidateClassFeatures = [];
        classEquipChoiceSets = [];
        classFixedItems = [];
        candidateProficiencies = [];
        availableClassSkills = [];

        // Primary class saves & skills
        const rawPrimary = (primaryCls.name || '')
            .toLowerCase()
            .replace(/\s*\[.*?\]$/, '')
            .trim();
        const primaryFullData = await loadFullClassData(primaryCls.name);
        const matchedPrimaryCls =
            primaryFullData?.class?.[0] ||
            builderCache?.classes?.find((c) => (c.name || '').toLowerCase() === rawPrimary);

        if (matchedPrimaryCls) {
            const primarySaves = Array.isArray(matchedPrimaryCls.proficiency) ? matchedPrimaryCls.proficiency : [];
            ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach((stat) => {
                const isSave = primarySaves.map((s) => s.toLowerCase()).includes(stat);
                candidateProficiencies.push({
                    id: 'save_' + stat,
                    type: 'save',
                    stat: stat,
                    label: stat.toUpperCase() + ' Save',
                    checked: isSave || !!char.saves?.[stat]
                });
            });

            const startingProfs = matchedPrimaryCls.startingProficiencies || {};
            const armorProfs = startingProfs.armor || matchedPrimaryCls.armorProficiencies || [];
            ['Light Armor', 'Medium Armor', 'Heavy Armor', 'Shields'].forEach((arm) => {
                const hasArm = armorProfs.some(
                    (p) =>
                        typeof p === 'string' &&
                        (p.toLowerCase().includes(arm.toLowerCase()) || arm.toLowerCase().includes(p.toLowerCase()))
                );
                candidateProficiencies.push({
                    id: 'armor_' + arm.replace(/\W+/g, '_').toLowerCase(),
                    type: 'armor',
                    label: arm,
                    checked: hasArm || (char.proficiencies?.armor || '').toLowerCase().includes(arm.toLowerCase())
                });
            });

            const weaponProfs = startingProfs.weapons || matchedPrimaryCls.weaponProficiencies || [];
            ['Simple Weapons', 'Martial Weapons'].forEach((wp) => {
                const hasWp = weaponProfs.some(
                    (p) =>
                        typeof p === 'string' &&
                        (p.toLowerCase().includes(wp.toLowerCase()) || wp.toLowerCase().includes(p.toLowerCase()))
                );
                candidateProficiencies.push({
                    id: 'weapon_' + wp.replace(/\W+/g, '_').toLowerCase(),
                    type: 'weapon',
                    label: wp,
                    checked: hasWp || (char.proficiencies?.weapons || '').toLowerCase().includes(wp.toLowerCase())
                });
            });

            if (startingProfs.skills) {
                const skArr = Array.isArray(startingProfs.skills) ? startingProfs.skills : [startingProfs.skills];
                const skData = skArr[0] || {};
                classSkillLimit = skData.choose?.count || 2;
                availableClassSkills = (skData.choose?.from || []).map((s) => normalizeSkill(s)).filter(Boolean);
            } else {
                classSkillLimit = 2;
                availableClassSkills = [
                    'Athletics',
                    'Acrobatics',
                    'Stealth',
                    'Perception',
                    'Survival',
                    'Insight',
                    'Persuasion'
                ];
            }

            if (char.skills && typeof char.skills === 'object' && !Array.isArray(char.skills)) {
                Object.keys(char.skills).forEach((sk) => {
                    if (char.skills[sk] && availableClassSkills.includes(sk)) {
                        selectedClassSkills.add(sk);
                    }
                });
            } else if (Array.isArray(char.skills)) {
                char.skills.forEach((sk) => {
                    const sName = typeof sk === 'string' ? sk : sk.name;
                    if (sName && availableClassSkills.includes(sName)) {
                        selectedClassSkills.add(sName);
                    }
                });
            }

            const startEquipData =
                primaryFullData?.class?.[0]?.startingEquipment || matchedPrimaryCls.startingEquipment;
            if (startEquipData?.default) {
                startEquipData.default.forEach((eqStr, eqIdx) => {
                    const cleaned = extractTextFromEntries(eqStr);
                    if (cleaned.startsWith('(a)')) {
                        const rawOptions = cleaned
                            .split(/\s*\([a-z]\)\s*/)
                            .map((s) => s.trim())
                            .filter(Boolean);
                        const options = rawOptions.map((opt, idx) => {
                            const key = String.fromCharCode(97 + idx);
                            const cleanLabel = opt
                                .replace(/\s+or$/i, '')
                                .replace(/\s+and$/i, '')
                                .trim();
                            return { key, label: cleanLabel, raw: opt };
                        });
                        const firstOpt = options[0]?.label || '';
                        const isMartial = firstOpt.toLowerCase().includes('martial weapon');
                        const isSimple = firstOpt.toLowerCase().includes('simple weapon');
                        classEquipChoiceSets.push({
                            id: 'eq_choice_' + eqIdx,
                            title: `Choice ${eqIdx + 1}`,
                            selectedOption: 'a',
                            selectedWeapon: isMartial ? 'Longsword' : isSimple ? 'Quarterstaff' : '',
                            options
                        });
                    } else {
                        const parts = cleaned
                            .split(/,\s*(?:and\s+)?|\s+and\s+/i)
                            .map((s) => s.trim())
                            .filter(Boolean);
                        parts.forEach((p, pIdx) => {
                            let qty = 1;
                            let name = p;
                            const numMatch = name.match(/^(one|two|three|four|five|\d+)\s+(.*)/i);
                            if (numMatch) {
                                const wordToNum = { one: 1, two: 2, three: 3, four: 4, five: 5 };
                                qty = wordToNum[numMatch[1].toLowerCase()] || parseInt(numMatch[1]) || 1;
                                name = numMatch[2];
                            }
                            name = name
                                .replace(/^A\s+/i, '')
                                .replace(/^An\s+/i, '')
                                .replace(/^The\s+/i, '')
                                .replace(/\s+or$/i, '')
                                .trim();
                            if (name.toLowerCase() === 'daggers') name = 'Dagger';
                            if (name.toLowerCase() === 'handaxes') name = 'Handaxe';
                            const cleanCapital = name.replace(/\b\w/g, (l) => l.toUpperCase());

                            if (cleanCapital) {
                                const low = cleanCapital.toLowerCase();
                                const isArmor =
                                    low.includes('armor') ||
                                    low.includes('mail') ||
                                    low.includes('leather') ||
                                    low.includes('plate');
                                const isShield = low.includes('shield');
                                classFixedItems.push({
                                    id: 'eq_fixed_' + eqIdx + '_' + pIdx,
                                    name: cleanCapital,
                                    qty: qty,
                                    type: isArmor ? 'Armor' : isShield ? 'Shield' : 'Gear',
                                    isArmor: isArmor,
                                    checked: true
                                });
                            }
                        });
                    }
                });
            }
        }

        // Class Features per class
        for (let cIdx = 0; cIdx < classes.length; cIdx++) {
            const c = classes[cIdx];
            const subC = (c.subclass || '')
                .toLowerCase()
                .replace(/\s*\[.*?\]$/, '')
                .trim();
            const curLvl = parseInt(c.level) || 1;
            const clsSource = (c.source || 'PHB').toUpperCase();

            const fullData = await loadFullClassData(c.name);
            const seenFeatNames = new Set();

            if (fullData) {
                if (Array.isArray(fullData.classFeature)) {
                    fullData.classFeature.forEach((cf) => {
                        const featSource = (cf.source || fullData.class?.[0]?.source || 'PHB').toUpperCase();
                        if (!isSourceAllowed(featSource, cf.name, disabledSources)) return;
                        if (clsSource === 'PHB') {
                            if (featSource === 'XPHB' || featSource.startsWith('XUA')) return;
                        } else if (clsSource === 'XPHB') {
                            if (featSource === 'PHB') return;
                        }

                        const lvl = cf.level || 1;
                        if (lvl <= curLvl) {
                            const fName = cf.name || 'Class Feature';
                            const key = fName.toLowerCase().trim();
                            if (seenFeatNames.has(key)) return;
                            seenFeatNames.add(key);

                            candidateClassFeatures.push({
                                id: 'cf_' + cIdx + '_' + fName.replace(/\W+/g, '_').toLowerCase(),
                                name: fName,
                                level: lvl,
                                className: c.name,
                                isSubclass: false,
                                source: cf.source || fullData.class?.[0]?.source || 'PHB',
                                actionType: cf.actionType || 'passive',
                                description: extractTextFromEntries(cf.entries) || cf.description || '',
                                category: `${c.name} Features`,
                                type: 'class',
                                hasCounter: !!cf.hasCounter,
                                usesMax: cf.usesMax || null,
                                resetType: cf.resetType || 'short',
                                formula: cf.formula || '',
                                formulaConfig: cf.formulaConfig || null,
                                checked: !existingAbilities.has(key)
                            });
                        }
                    });
                }

                if (subC && Array.isArray(fullData.subclassFeature)) {
                    const isTotemBarbarian = (c.name || '').toLowerCase() === 'barbarian' && subC.includes('totem');
                    const totemAnimals = ['Bear', 'Eagle', 'Elk', 'Tiger', 'Wolf'];

                    fullData.subclassFeature.forEach((scf) => {
                        const scfSource = (scf.source || 'PHB').toUpperCase();
                        if (!isSourceAllowed(scfSource, scf.name, disabledSources)) return;
                        if (clsSource === 'PHB') {
                            if (scfSource === 'XPHB' || scfSource.startsWith('XUA')) return;
                        } else if (clsSource === 'XPHB') {
                            if (scfSource === 'PHB') return;
                        }

                        // Filter out individual animal features for Totem Barbarian; they are grouped under Totem Spirit / Aspect / Attunement
                        if (isTotemBarbarian && totemAnimals.includes(scf.name)) {
                            return;
                        }

                        const scName = (scf.subclassShortName || scf.subclassName || '').toLowerCase();
                        if (scName && (subC.includes(scName) || scName.includes(subC))) {
                            const lvl = scf.level || 1;
                            if (lvl <= curLvl) {
                                const fName = scf.name || 'Subclass Feature';
                                const key = fName.toLowerCase().trim();
                                if (seenFeatNames.has(key)) return;
                                seenFeatNames.add(key);

                                const featId = 'scf_' + cIdx + '_' + fName.replace(/\W+/g, '_').toLowerCase();
                                let subOptions = null;
                                let subOptionChoice = null;
                                const baseDesc = extractTextFromEntries(scf.entries) || scf.description || '';
                                let fullDesc = baseDesc;

                                if (
                                    isTotemBarbarian &&
                                    ['totem spirit', 'aspect of the beast', 'totemic attunement'].includes(key)
                                ) {
                                    const animalOptions = fullData.subclassFeature
                                        .filter(
                                            (sf) =>
                                                (sf.subclassShortName || '').toLowerCase() === 'totem warrior' &&
                                                sf.level === lvl &&
                                                totemAnimals.includes(sf.name)
                                        )
                                        .map((sf) => ({
                                            name: sf.name,
                                            description: extractTextFromEntries(sf.entries) || sf.description || ''
                                        }));
                                    if (animalOptions.length > 0) {
                                        subOptions = animalOptions;
                                        subOptionChoice =
                                            workingChar.featureSubChoices?.[featId] || animalOptions[0].name;
                                        const chosenAnimal =
                                            animalOptions.find((a) => a.name === subOptionChoice) || animalOptions[0];
                                        fullDesc =
                                            baseDesc + '\n\n**' + chosenAnimal.name + ':** ' + chosenAnimal.description;
                                    }
                                }

                                candidateClassFeatures.push({
                                    id: featId,
                                    name: fName,
                                    level: lvl,
                                    className: c.name,
                                    subclassName: scf.subclassShortName || c.subclass,
                                    isSubclass: true,
                                    source: scf.source || 'PHB',
                                    actionType: scf.actionType || 'passive',
                                    baseDescription: baseDesc,
                                    description: fullDesc,
                                    subOptions: subOptions,
                                    subOptionChoice: subOptionChoice,
                                    category: `${c.subclass || scf.subclassShortName} Features`,
                                    type: 'subclass',
                                    hasCounter: !!scf.hasCounter,
                                    usesMax: scf.usesMax || null,
                                    resetType: scf.resetType || 'short',
                                    formula: scf.formula || '',
                                    formulaConfig: scf.formulaConfig || null,
                                    checked: !existingAbilities.has(key)
                                });
                            }
                        }
                    });
                }
            }
        }

        // Optional Features
        optFeatureSections = [];
        classes.forEach((c, cIdx) => {
            const rawC = (c.name || '')
                .toLowerCase()
                .replace(/\s*\[.*?\]$/, '')
                .trim();
            const curLvl = parseInt(c.level) || 1;
            const isPaladin = rawC === 'paladin';
            const isFighter = rawC === 'fighter';
            const isRanger = rawC === 'ranger';
            const isBard = rawC === 'bard';
            const isChampion = (c.subclass || '').toLowerCase().includes('champion');
            const isRuneKnight = (c.subclass || '').toLowerCase().includes('rune knight');

            const matches = (builderCache?.optionalFeatures || []).filter((of) => {
                const fTypes = of.featureType || [];
                let matchCls = (of.classPrereq || '').toLowerCase() === rawC;
                if (!matchCls) {
                    if (isPaladin && fTypes.includes('FS:P')) matchCls = true;
                    if (isFighter && fTypes.includes('FS:F')) matchCls = true;
                    if (isRanger && fTypes.includes('FS:R')) matchCls = true;
                    if (isBard && fTypes.includes('FS:B')) matchCls = true;
                    if (isChampion && fTypes.includes('FS:C')) matchCls = true;
                    if (isFighter && isRuneKnight && fTypes.includes('RN')) matchCls = true;
                }
                if (!matchCls) return false;
                const reqLvl = parseInt(of.levelPrereq) || 1;
                if (reqLvl > curLvl) return false;
                if (of.subclassPrereq) {
                    const requiredSub = of.subclassPrereq.toLowerCase().trim();
                    const currentSub = (c.subclass || '').toLowerCase().trim();
                    if (!currentSub || (!currentSub.includes(requiredSub) && !requiredSub.includes(currentSub))) {
                        return false;
                    }
                }
                return true;
            });

            // Deduplicate options by name
            const uniqueMatches = [];
            const seenOpt = new Set();
            for (const of of matches) {
                const optKey = (of.name || '').toLowerCase().trim();
                if (!seenOpt.has(optKey)) {
                    seenOpt.add(optKey);
                    uniqueMatches.push(of);
                }
            }

            if (uniqueMatches.length > 0) {
                optFeatureSections.push({
                    className: c.name,
                    classIdx: cIdx,
                    features: uniqueMatches.map((of) => ({
                        id: 'opt_' + cIdx + '_' + of.name.replace(/\W+/g, '_').toLowerCase(),
                        name: of.name,
                        category: `${c.name} Specializations`,
                        actionType: of.actionType || 'passive',
                        description: extractTextFromEntries(of.entries) || of.description || '',
                        prerequisite: of.prerequisite || '',
                        checked: existingAbilities.has(of.name.toLowerCase().trim()),
                        formula: of.formula || '',
                        formulaConfig: of.formulaConfig || null,
                        hasCounter: !!of.hasCounter,
                        usesMax: of.usesMax || null,
                        resetType: of.resetType || 'short'
                    }))
                });
            }
        });

        // 4. Feats / ASI Milestones & 2024 Origin Feat Detection
        const previousTiersMap = new Map((asiTiers || []).map((t) => [t.id, t]));
        const newAsiTiers = [];

        // Check if matched background grants a feat
        let bgFeatName = '';
        let bgFeatSpellClass = '';
        let bgFeatCollege = '';
        if (matchedBg) {
            // 1. Check matchedBg.feats first
            if (Array.isArray(matchedBg.feats) && matchedBg.feats.length > 0) {
                for (const fItem of matchedBg.feats) {
                    if (typeof fItem === 'object') {
                        const rawKey = Object.keys(fItem)[0] || '';
                        if (rawKey) {
                            const [fNamePart, fOptPart] = rawKey.split(';');
                            const cleanF = (fNamePart || '').replace(/\|.*$/, '').trim();
                            if (cleanF) {
                                bgFeatName = cleanF;
                                if (fOptPart) {
                                    const optClean = fOptPart.replace(/\|.*$/, '').trim().toLowerCase();
                                    if (/cleric|druid|wizard|sorcerer|warlock|bard/.test(optClean)) {
                                        bgFeatSpellClass = optClean;
                                    }
                                }
                                break;
                            }
                        }
                    }
                }
            }

            // 2. Check features array
            if (!bgFeatName && Array.isArray(matchedBg.features)) {
                for (const f of matchedBg.features) {
                    const fNameStr = f.name || '';
                    const fDescStr = f.description || '';
                    if (/feat/i.test(fNameStr)) {
                        bgFeatName = fNameStr
                            .replace(/^bonus feat:\s*/i, '')
                            .replace(/^feat:\s*/i, '')
                            .trim();
                        break;
                    }
                    const mGain = fDescStr.match(/gain the\s+([A-Za-z\s'\-]+?)\s+feat/i);
                    if (mGain) {
                        bgFeatName = mGain[1].trim();
                        break;
                    }
                }
            }

            // 3. Check description text
            if (!bgFeatName && matchedBg.description) {
                const mFeat = matchedBg.description.match(/\*\*Feat:\*\*\s*([^\n\r]+)/i);
                if (mFeat) {
                    bgFeatName = mFeat[1].trim();
                } else {
                    const mGain = matchedBg.description.match(/gain the\s+([A-Za-z\s'\-]+?)\s+feat/i);
                    if (mGain) bgFeatName = mGain[1].trim();
                }
            }

            // Identify college or spell class from background name
            const bgLower = (matchedBg.name || '').toLowerCase();
            if (bgLower.includes('lorehold')) bgFeatCollege = 'lorehold';
            else if (bgLower.includes('prismari')) bgFeatCollege = 'prismari';
            else if (bgLower.includes('quandrix')) bgFeatCollege = 'quandrix';
            else if (bgLower.includes('silverquill')) bgFeatCollege = 'silverquill';
            else if (bgLower.includes('witherbloom')) bgFeatCollege = 'witherbloom';

            if (bgFeatName) {
                if (/cleric/i.test(bgFeatName)) bgFeatSpellClass = 'cleric';
                else if (/druid/i.test(bgFeatName)) bgFeatSpellClass = 'druid';
                else if (/wizard/i.test(bgFeatName)) bgFeatSpellClass = 'wizard';
                else if (/sorcerer/i.test(bgFeatName)) bgFeatSpellClass = 'sorcerer';
                else if (/warlock/i.test(bgFeatName)) bgFeatSpellClass = 'warlock';
                else if (/bard/i.test(bgFeatName)) bgFeatSpellClass = 'bard';
            }
        }

        const is2024Char = typeof getCharIs2024 === 'function' ? getCharIs2024(workingChar) : false;
        const isVariantHuman = (workingChar.race || '').toLowerCase().includes('variant human');
        const hasBgFeat =
            matchedBg &&
            Boolean(bgFeatName) &&
            (is2024Char ||
                (Array.isArray(matchedBg.feats) && matchedBg.feats.length > 0) ||
                matchedBg.source === 'XPHB' ||
                /strixhaven|dragonlance|planescape/i.test(matchedBg.source || '') ||
                (matchedBg.entries && JSON.stringify(matchedBg.entries).includes('Origin Feat')));

        if (hasBgFeat) {
            const originId = 'origin_feat_background';
            const prev = previousTiersMap.get(originId) || previousTiersMap.get('origin_feat_lvl1');

            // Resolve default feat ID from background if player hasn't picked one yet
            let defaultFeatId = prev?.selectedFeatId || '';
            let defaultSubChoices = prev?.featSubChoices ? { ...prev.featSubChoices } : {};
            if (!defaultFeatId && bgFeatName) {
                const cleanBgFeat = bgFeatName
                    .replace(/\s*\(.*?\)/, '')
                    .replace(/\s*-.*$/, '')
                    .replace(/\|.*$/, '')
                    .trim()
                    .toLowerCase();
                const matchedF = (builderCache?.feats || []).find(
                    (f) =>
                        (f.name || '').toLowerCase() === cleanBgFeat ||
                        (f.name || '').toLowerCase().startsWith(cleanBgFeat)
                );
                if (matchedF) {
                    defaultFeatId = matchedF.id || matchedF.name.replace(/\W+/g, '_').toLowerCase();
                }
            }
            if (bgFeatSpellClass && !defaultSubChoices.spellClass) {
                defaultSubChoices.spellClass = bgFeatSpellClass;
            }
            if (bgFeatCollege && !defaultSubChoices.college) {
                defaultSubChoices.college = bgFeatCollege;
            }

            newAsiTiers.push({
                id: originId,
                className: matchedBg.name + ' Background',
                level: 1,
                choice: 'feat',
                isOrigin: true,
                selectedFeatId: defaultFeatId,
                featSubChoices: defaultSubChoices,
                halfFeatStat: prev?.halfFeatStat || ''
            });
        }

        const isHumanVersatile =
            (is2024Char && (workingChar.race || '').toLowerCase().includes('human')) || isVariantHuman;
        if (isHumanVersatile) {
            const humanOriginId = 'origin_feat_human';
            const prev = previousTiersMap.get(humanOriginId);
            newAsiTiers.push({
                id: humanOriginId,
                className: 'Human Versatile Species',
                level: 1,
                choice: 'feat',
                isOrigin: true,
                selectedFeatId: prev?.selectedFeatId || '',
                featSubChoices: prev?.featSubChoices || {},
                halfFeatStat: prev?.halfFeatStat || ''
            });
        }

        classes.forEach((c, cIdx) => {
            const rawC = (c.name || '')
                .toLowerCase()
                .replace(/\s*\[.*?\]$/, '')
                .trim();
            const curLvl = parseInt(c.level) || 1;
            const milestones = [4, 8, 12, 16, 19];
            if (rawC === 'fighter') milestones.push(6, 14);
            if (rawC === 'rogue') milestones.push(10);
            milestones.sort((a, b) => a - b);

            milestones.forEach((m) => {
                if (curLvl >= m) {
                    const tierId = `asi_${cIdx}_${m}`;
                    const prev = previousTiersMap.get(tierId);
                    if (prev) {
                        newAsiTiers.push({
                            ...prev,
                            className: c.name,
                            level: m
                        });
                    } else {
                        newAsiTiers.push({
                            id: tierId,
                            className: c.name,
                            level: m,
                            choice: 'unselected',
                            asiMode: 'plus2',
                            stat1: '',
                            stat2: '',
                            selectedFeatId: '',
                            featSubChoices: {}
                        });
                    }
                }
            });
        });
        asiTiers = newAsiTiers;
        workingChar.builderFeatSelections = newAsiTiers;

        // Recalculate effective speeds now that asiTiers are synchronized
        const postFeatSpeed = calculateEffectiveSpeed(workingChar, matchedBaseRace, matchedSubrace, asiTiers);
        if (!workingChar._manualSpeedCustomized) {
            workingChar.speed.walk = postFeatSpeed.walk;
            workingChar.speed.climb = postFeatSpeed.climb;
            workingChar.speed.swim = postFeatSpeed.swim || 0;
            workingChar.speed.fly = postFeatSpeed.fly;
            workingChar.speed.burrow = postFeatSpeed.burrow;
        }

        // 5. Spells Catalog query
        let spellList =
            Array.isArray(builderCache?.spells) && builderCache.spells.length > 0 ? builderCache.spells : [];
        if (spellList.length === 0) {
            try {
                let spRes = await fetch('/data/spells-catalog.json?v=' + Date.now()).catch(() => null);
                if (!spRes || !spRes.ok)
                    spRes = await fetch('data/spells-catalog.json?v=' + Date.now()).catch(() => null);
                if (spRes && spRes.ok) spellList = await spRes.json();
            } catch (e) {}
        }

        if (builderCache && (!builderCache.spells || builderCache.spells.length === 0)) {
            builderCache.spells = spellList;
        }

        candidateInnateSpells = extractGrantedSpells(matchedBaseRace, matchedSubrace, matchedBg, totalLevel, spellList);

        // 5a. Extract Subclass Additional Spells (e.g. Paladin Oaths, Cleric Domains, etc.)
        for (const c of classes) {
            const fullData = await loadFullClassData(c.name);
            if (c.subclass && fullData && Array.isArray(fullData.subclass)) {
                const subClean = (c.subclass || '')
                    .toLowerCase()
                    .replace(/\s*\[.*?\]$/, '')
                    .trim();
                const scObj = fullData.subclass.find((s) => {
                    const sName = (s.name || '').toLowerCase().trim();
                    return sName === subClean || sName.includes(subClean) || subClean.includes(sName);
                });
                if (scObj && Array.isArray(scObj.additionalSpells)) {
                    const curLvl = parseInt(c.level) || 1;
                    scObj.additionalSpells.forEach((as) => {
                        const spellSets = as.prepared || as.known || {};
                        Object.entries(spellSets).forEach(([lvlKey, spellNames]) => {
                            const unlockLvl = parseInt(lvlKey) || 1;
                            if (unlockLvl <= curLvl && Array.isArray(spellNames)) {
                                spellNames.forEach((rawSpName) => {
                                    let str = typeof rawSpName === 'string' ? rawSpName : rawSpName.name || '';
                                    const matchSpellTag = str.match(/\{@spell\s+([^|}]+)/i);
                                    if (matchSpellTag) {
                                        str = matchSpellTag[1];
                                    }
                                    const cleanName = str
                                        .replace(/\{@\w+\s+([^|}]+)[^}]*\}/gi, '$1')
                                        .replace(/#c\d*/i, '')
                                        .replace(/\|[a-z0-9_]+/gi, '')
                                        .replace(/[{}]/g, '')
                                        .trim();
                                    if (!cleanName) return;
                                    const spKey = cleanName.toLowerCase();
                                    const spObj = spellList.find((s) => (s.name || '').toLowerCase() === spKey);
                                    const existsInInnate = candidateInnateSpells.some(
                                        (isp) => (isp.name || '').toLowerCase() === spKey
                                    );
                                    if (!existsInInnate) {
                                        candidateInnateSpells.push({
                                            id: 'sp_subclass_' + cleanName.replace(/\W+/g, '_'),
                                            name: spObj ? spObj.name : cleanName,
                                            source: spObj ? spObj.source || '' : '',
                                            level: spObj ? parseInt(spObj.level) || 0 : 1,
                                            school: spObj ? spObj.school || '' : '',
                                            time: spObj ? spObj.castingTime || spObj.time || '1 action' : '1 action',
                                            range: spObj ? spObj.range || 'Self' : 'Self',
                                            duration: spObj ? spObj.duration || 'Instantaneous' : 'Instantaneous',
                                            description: spObj
                                                ? spObj.descriptionMarkdown || spObj.description || ''
                                                : '',
                                            originName: c.subclass,
                                            checked: true,
                                            isCantrip: (spObj ? parseInt(spObj.level) || 0 : 1) === 0,
                                            isSubclassSpell: true
                                        });
                                    }
                                });
                            }
                        });
                    });
                }
            }
        }

        // 5b. Extract Background Guild & College Expanded Spells
        candidateBgExpandedSpells = [];
        if (matchedBg && matchedBg.additionalSpells) {
            const addSp = Array.isArray(matchedBg.additionalSpells)
                ? matchedBg.additionalSpells
                : [matchedBg.additionalSpells];
            addSp.forEach((as) => {
                if (as && as.expanded && typeof as.expanded === 'object') {
                    Object.entries(as.expanded).forEach(([slotKey, spellNames]) => {
                        const sLvl = parseInt(slotKey.replace(/^s/, '')) || 0;
                        if (Array.isArray(spellNames)) {
                            spellNames.forEach((rawSpName) => {
                                let str = typeof rawSpName === 'string' ? rawSpName : rawSpName.name || '';
                                const matchSpellTag = str.match(/\{@spell\s+([^|}]+)/i);
                                if (matchSpellTag) {
                                    str = matchSpellTag[1];
                                }
                                const cleanName = str
                                    .replace(/\{@\w+\s+([^|}]+)[^}]*\}/gi, '$1')
                                    .replace(/#c\d*/i, '')
                                    .replace(/\|[a-z0-9_]+/gi, '')
                                    .replace(/[{}]/g, '')
                                    .trim();
                                if (!cleanName) return;
                                const spKey = cleanName.toLowerCase();
                                const spObj = spellList.find((s) => (s.name || '').toLowerCase() === spKey);
                                const isChecked = userSelectedSpellMap.has(spKey)
                                    ? !!userSelectedSpellMap.get(spKey)
                                    : existingSpells.has(spKey) || true;

                                candidateBgExpandedSpells.push({
                                    id: 'sp_bg_' + cleanName.replace(/\W+/g, '_'),
                                    name: spObj ? spObj.name : cleanName,
                                    source: spObj ? spObj.source || '' : '',
                                    level: sLvl,
                                    school: spObj ? spObj.school || '' : '',
                                    time: spObj ? spObj.castingTime || spObj.time || '1 action' : '1 action',
                                    range: spObj ? spObj.range || 'Self' : 'Self',
                                    duration: spObj ? spObj.duration || 'Instantaneous' : 'Instantaneous',
                                    description: spObj ? spObj.descriptionMarkdown || spObj.description || '' : '',
                                    originName: matchedBg.name,
                                    checked: isChecked,
                                    isCantrip: sLvl === 0
                                });
                            });
                        }
                    });
                }
            });
        }

        if (Array.isArray(classSpellSections)) {
            classSpellSections.forEach((sec) => {
                (sec.spells || []).forEach((sp) => {
                    if (sp && sp.name) {
                        userSelectedSpellMap.set(sp.name.toLowerCase().trim(), !!sp.checked);
                    }
                });
            });
        }
        classSpellSections = [];
        classes.forEach((c, cIdx) => {
            const raw = (c.name || '')
                .toLowerCase()
                .replace(/\s*\[.*?\]$/, '')
                .trim();
            const sub = (c.subclass || '').toLowerCase();
            const l = parseInt(c.level) || 1;

            let isCaster = false;
            let maxSlot = 0;
            let maxCantrips = 0;
            let maxSpells = 0;
            let casterClass = raw;

            if (raw === 'wizard') {
                isCaster = true;
                maxSlot = Math.min(9, Math.ceil(l / 2));
                maxCantrips = l >= 10 ? 5 : l >= 4 ? 4 : 3;
                const intMod = getMod(
                    getEffectiveStats(workingChar, matchedBaseRace, matchedSubrace, asiTiers, racialChoiceDefs).int
                );
                maxSpells = Math.max(1, intMod + l);
            } else if (raw === 'cleric' || raw === 'druid') {
                isCaster = true;
                maxSlot = Math.min(9, Math.ceil(l / 2));
                maxCantrips = l >= 10 ? 5 : l >= 4 ? 4 : 3;
                const wisMod = getMod(
                    getEffectiveStats(workingChar, matchedBaseRace, matchedSubrace, asiTiers, racialChoiceDefs).wis
                );
                maxSpells = Math.max(1, wisMod + l);
            } else if (raw === 'sorcerer') {
                isCaster = true;
                maxSlot = Math.min(9, Math.ceil(l / 2));
                maxCantrips = l >= 10 ? 6 : l >= 4 ? 5 : 4;
                const known = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 12, 13, 13, 14, 14, 15, 15, 15, 15];
                maxSpells = known[l - 1] || 2;
            } else if (raw === 'bard') {
                isCaster = true;
                maxSlot = Math.min(9, Math.ceil(l / 2));
                maxCantrips = l >= 10 ? 4 : l >= 4 ? 3 : 2;
                const known = [4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 15, 16, 16, 17, 17, 18, 18, 19, 22];
                maxSpells = known[l - 1] || 4;
            } else if (raw === 'warlock') {
                isCaster = true;
                maxSlot = l >= 9 ? 5 : Math.ceil(l / 2);
                maxCantrips = l >= 10 ? 4 : l >= 4 ? 3 : 2;
                const known = [2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15];
                maxSpells = known[l - 1] || 2;
            } else if (raw === 'paladin' || raw === 'ranger') {
                if (l >= 2) {
                    isCaster = true;
                    maxSlot = Math.min(5, Math.ceil(l / 4));
                    maxCantrips = 0;
                    if (raw === 'paladin') {
                        const chaMod = getMod(
                            getEffectiveStats(workingChar, matchedBaseRace, matchedSubrace, asiTiers, racialChoiceDefs)
                                .cha
                        );
                        maxSpells = Math.max(1, chaMod + Math.floor(l / 2));
                    } else {
                        const known = [0, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11];
                        maxSpells = known[l - 1] || Math.max(1, Math.floor(l / 2));
                    }
                }
            } else if (raw === 'artificer') {
                isCaster = true;
                maxSlot = Math.min(5, Math.ceil(l / 4));
                maxCantrips = l >= 10 ? 4 : 2;
                const intMod = getMod(
                    getEffectiveStats(workingChar, matchedBaseRace, matchedSubrace, asiTiers, racialChoiceDefs).int
                );
                maxSpells = Math.max(1, intMod + Math.floor(l / 2));
            } else if (sub.includes('eldritch knight') || sub.includes('arcane trickster')) {
                if (l >= 3) {
                    isCaster = true;
                    casterClass = 'wizard';
                    maxSlot = Math.min(4, Math.ceil((l - 2) / 4));
                    maxCantrips = sub.includes('arcane trickster') ? (l >= 10 ? 4 : 3) : l >= 10 ? 3 : 2;
                    const third = [0, 0, 3, 4, 4, 4, 5, 6, 6, 7, 8, 8, 9, 10, 10, 11, 11, 11, 12, 13];
                    maxSpells = third[l - 1] || 3;
                }
            }

            if (isCaster && spellList.length > 0) {
                const isPreparedFullList = ['paladin', 'artificer', 'cleric', 'druid'].includes(raw);
                const matchedSpells = spellList
                    .filter((sp) => {
                        const spLvl = parseInt(sp.level) || 0;
                        if (spLvl > maxSlot) return false;
                        const isBgExpanded = candidateBgExpandedSpells.some(
                            (bsp) => (bsp.name || '').toLowerCase() === (sp.name || '').toLowerCase()
                        );
                        if (isBgExpanded) return true;
                        if (!Array.isArray(sp.classes)) return false;
                        return sp.classes.some(
                            (cn) => cn.toLowerCase() === casterClass || cn.toLowerCase().includes(casterClass)
                        );
                    })
                    .map((sp) => {
                        const spKey = (sp.name || '').toLowerCase().trim();
                        const sLvl = parseInt(sp.level) || 0;
                        return {
                            id: 'sp_' + sp.name.replace(/\W+/g, '_') + '_' + cIdx,
                            name: sp.name,
                            source: sp.source || '',
                            level: sLvl,
                            school: sp.school || '',
                            time: sp.castingTime || sp.time || '1 action',
                            range: sp.range || '',
                            duration: sp.duration || '',
                            description: sp.descriptionMarkdown || sp.description || '',
                            className: c.name,
                            classIdx: cIdx,
                            checked: userSelectedSpellMap.has(spKey)
                                ? !!userSelectedSpellMap.get(spKey)
                                : existingSpells.has(spKey),
                            isCantrip: sLvl === 0
                        };
                    });

                classSpellSections.push({
                    classIdx: cIdx,
                    className: c.name,
                    maxSlot,
                    maxCantrips,
                    maxSpells,
                    spells: matchedSpells,
                    searchFilter: '',
                    levelFilter: 'all',
                    schoolFilter: 'all'
                });
            }
        });

        allCandidateAbilities = [
            ...candidateRacialTraits,
            ...candidateBgFeatures,
            ...candidateClassFeatures,
            ...optFeatureSections.flatMap((s) => s.features),
            ...workingChar.customFeatures
        ];

        refreshArmorOptionsFromCandidates();
        runHpCalculation();
        runAcCalculation();
        updateTopSummary();
        updateCountsDisplay();
    }

    function refreshArmorOptionsFromCandidates() {
        allArmorOptions.length = 1;
        const stats = getEffectiveStats(workingChar, matchedBaseRace, matchedSubrace, asiTiers, racialChoiceDefs);
        const dexMod = getMod(stats.dex);
        const conMod = getMod(stats.con);
        const wisMod = getMod(stats.wis);
        const chaMod = getMod(stats.cha);

        const raceStr = `${workingChar.race || ''} ${workingChar.subrace || ''}`.toLowerCase();
        const is2024Char = typeof getCharIs2024 === 'function' ? getCharIs2024(workingChar) : false;
        const hasBarb = workingChar.classes.some((c) => (c.name || '').toLowerCase().includes('barbarian'));
        const hasMonk = workingChar.classes.some((c) => (c.name || '').toLowerCase().includes('monk'));

        const allSelectedFeats = [
            ...(workingChar.feats || []).map((f) => (typeof f === 'string' ? f : f.name || '')),
            ...Object.values(builderState.selectedFeatChoices || {}),
            ...Object.values(builderState.selectedFeatCustomOptions || {})
        ].filter(Boolean);

        const hasDragonHide = allSelectedFeats.some((f) =>
            (typeof f === 'string' ? f : f.name || '').toLowerCase().includes('dragon hide')
        );
        const hasDraconicSorcerer = workingChar.classes.some((c) =>
            (c.subclass || '').toLowerCase().includes('draconic')
        );

        // 2024 College of Dance Bard (Level 3+)
        const danceBardClass = workingChar.classes.find(
            (c) =>
                (c.name || '').toLowerCase().includes('bard') &&
                (c.subclass || '').toLowerCase().includes('dance') &&
                (parseInt(c.level) || 1) >= 3
        );

        const hasTortle = raceStr.includes('tortle');
        const hasLizardfolk = raceStr.includes('lizardfolk');
        const hasLocathah = raceStr.includes('locathah');
        const hasLoxodon = raceStr.includes('loxodon');
        const hasAutognome = raceStr.includes('autognome');
        const hasThriKreen = raceStr.includes('thri-kreen') || raceStr.includes('thrikreen');

        if (hasBarb) {
            allArmorOptions.push({
                id: 'barbarian',
                name: `Barbarian Unarmored Defense (10 + DEX [${dexMod}] + CON [${conMod}])`,
                type: 'Special',
                baseAc: 10 + dexMod + conMod
            });
        }
        if (hasMonk) {
            allArmorOptions.push({
                id: 'monk',
                name: `Monk Unarmored Defense (10 + DEX [${dexMod}] + WIS [${wisMod}])`,
                type: 'Special',
                baseAc: 10 + dexMod + wisMod
            });
        }
        if (hasDraconicSorcerer) {
            if (is2024Char) {
                // 2024 XPHB Draconic Resilience: 10 + DEX + CHA
                allArmorOptions.push({
                    id: 'draconic',
                    name: `Draconic Resilience (10 + DEX [${dexMod}] + CHA [${chaMod}])`,
                    type: 'Special',
                    baseAc: 10 + dexMod + chaMod
                });
            } else {
                // 2014 PHB Draconic Resilience: 13 + DEX
                allArmorOptions.push({
                    id: 'draconic',
                    name: `Draconic Resilience (13 + DEX [${dexMod}])`,
                    type: 'Special',
                    baseAc: 13 + dexMod
                });
            }
        } else if (hasDragonHide) {
            allArmorOptions.push({
                id: 'draconic',
                name: `Dragon Hide (13 + DEX [${dexMod}])`,
                type: 'Special',
                baseAc: 13 + dexMod
            });
        }
        if (danceBardClass) {
            allArmorOptions.push({
                id: 'dance_bard',
                name: `Dance Bard Unarmored Defense (10 + DEX [${dexMod}] + CHA [${chaMod}])`,
                type: 'Special',
                baseAc: 10 + dexMod + chaMod,
                noShield: true
            });
        }
        if (hasTortle) {
            allArmorOptions.push({
                id: 'tortle',
                name: 'Tortle Natural Armor (17 Flat)',
                type: 'Special',
                baseAc: 17,
                noDex: true
            });
        }
        if (hasLizardfolk) {
            allArmorOptions.push({
                id: 'lizardfolk',
                name: `Lizardfolk Natural Armor (13 + DEX [${dexMod}])`,
                type: 'Special',
                baseAc: 13 + dexMod
            });
        }
        if (hasLocathah) {
            allArmorOptions.push({
                id: 'locathah',
                name: `Locathah Natural Armor (12 + DEX [${dexMod}])`,
                type: 'Special',
                baseAc: 12 + dexMod
            });
        }
        if (hasLoxodon) {
            allArmorOptions.push({
                id: 'loxodon',
                name: `Loxodon Natural Armor (12 + CON [${conMod}])`,
                type: 'Special',
                baseAc: 12 + conMod
            });
        }
        if (hasAutognome) {
            allArmorOptions.push({
                id: 'autognome',
                name: `Autognome Armored Casing (13 + DEX [${dexMod}])`,
                type: 'Special',
                baseAc: 13 + dexMod
            });
        }
        if (hasThriKreen) {
            allArmorOptions.push({
                id: 'thrikreen',
                name: `Thri-Kreen Chameleon Carapace (13 + DEX [${dexMod}])`,
                type: 'Special',
                baseAc: 13 + dexMod
            });
        }

        (char.equipment || []).forEach((eq) => {
            const nameLow = (eq.name || '').toLowerCase();
            const isEqArmor =
                eq.isArmor ||
                ['HA', 'MA', 'LA'].includes((eq.rawType || '').toUpperCase()) ||
                eq.type === 'Armor' ||
                nameLow.includes('armor') ||
                nameLow.includes('mail') ||
                nameLow.includes('plate') ||
                nameLow.includes('leather');
            if (isEqArmor) {
                if (
                    !allArmorOptions.some(
                        (a) =>
                            a.name.toLowerCase() === eq.name.toLowerCase() ||
                            a.name.toLowerCase().startsWith(eq.name.toLowerCase())
                    )
                ) {
                    let rawType = eq.rawType;
                    if (!rawType) {
                        if (
                            nameLow.includes('chain mail') ||
                            nameLow.includes('splint') ||
                            nameLow.includes('plate') ||
                            nameLow.includes('ring mail')
                        )
                            rawType = 'HA';
                        else if (
                            nameLow.includes('chain shirt') ||
                            nameLow.includes('scale mail') ||
                            nameLow.includes('breastplate') ||
                            nameLow.includes('half plate') ||
                            nameLow.includes('hide armor')
                        )
                            rawType = 'MA';
                        else if (nameLow.includes('leather') || nameLow.includes('padded')) rawType = 'LA';
                        else rawType = 'MA';
                    }
                    allArmorOptions.push({
                        id: eq.id || 'inv_' + eq.name,
                        name: `${eq.name} [${eq.type || 'Armor'}]`,
                        rawType: rawType,
                        baseAc: parseInt(eq.ac) || (rawType === 'HA' ? 16 : 14),
                        bonusAc: parseInt(eq.bonusAc) || 0
                    });
                }
            }
        });

        classFixedItems.forEach((fit) => {
            if (
                fit.checked &&
                (fit.isArmor ||
                    fit.type === 'Armor' ||
                    (fit.name || '').toLowerCase().includes('armor') ||
                    (fit.name || '').toLowerCase().includes('mail') ||
                    (fit.name || '').toLowerCase().includes('leather'))
            ) {
                const clean = fit.name.trim();
                const cleanLow = clean.toLowerCase();
                const catItem = (builderCache?.items || []).find((it) => (it.name || '').toLowerCase() === cleanLow);
                const rawType =
                    cleanLow.includes('leather') || cleanLow.includes('padded')
                        ? 'LA'
                        : cleanLow.includes('chain mail') ||
                            cleanLow.includes('plate') ||
                            cleanLow.includes('splint') ||
                            cleanLow.includes('ring mail')
                          ? 'HA'
                          : catItem?.rawType || 'MA';
                const baseAc = catItem?.ac || (rawType === 'LA' ? 11 : rawType === 'HA' ? 16 : 14);
                if (!allArmorOptions.some((a) => a.name.toLowerCase().includes(cleanLow))) {
                    allArmorOptions.push({
                        id: 'cand_' + clean.replace(/\W+/g, '_').toLowerCase(),
                        name: `${clean} [Armor]`,
                        rawType,
                        baseAc,
                        bonusAc: 0
                    });
                }
            }
        });

        classEquipChoiceSets.forEach((cs) => {
            const opt = cs.options.find((o) => o.key === cs.selectedOption) || cs.options[0];
            if (opt && opt.label) {
                const low = opt.label.toLowerCase();
                if (low.includes('armor') || low.includes('mail') || low.includes('plate') || low.includes('leather')) {
                    const items = opt.label.split(/,\s*(?:and\s+)?|\s+and\s+/i);
                    items.forEach((itName) => {
                        const clean = itName
                            .replace(/^A\s+/i, '')
                            .replace(/^An\s+/i, '')
                            .replace(/\s+or$/i, '')
                            .trim();
                        const cleanLow = clean.toLowerCase();
                        if (
                            cleanLow.includes('armor') ||
                            cleanLow.includes('mail') ||
                            cleanLow.includes('plate') ||
                            cleanLow.includes('leather')
                        ) {
                            const catItem = (builderCache?.items || []).find(
                                (it) => (it.name || '').toLowerCase() === cleanLow
                            );
                            const rawType =
                                cleanLow.includes('leather') || cleanLow.includes('padded')
                                    ? 'LA'
                                    : cleanLow.includes('chain mail') ||
                                        cleanLow.includes('plate') ||
                                        cleanLow.includes('splint') ||
                                        cleanLow.includes('ring mail')
                                      ? 'HA'
                                      : catItem?.rawType || 'MA';
                            const baseAc = catItem?.ac || (rawType === 'LA' ? 11 : rawType === 'HA' ? 16 : 14);
                            if (!allArmorOptions.some((a) => a.name.toLowerCase().includes(cleanLow))) {
                                allArmorOptions.push({
                                    id: 'cand_' + clean.replace(/\W+/g, '_').toLowerCase(),
                                    name: `${clean.replace(/\b\w/g, (l) => l.toUpperCase())} [Armor]`,
                                    rawType,
                                    baseAc,
                                    bonusAc: 0
                                });
                            }
                        }
                    });
                }
            }
        });

        if (builderState.activeArmorId === 'none' && allArmorOptions.length > 1) {
            builderState.activeArmorId = allArmorOptions[allArmorOptions.length - 1].id;
        }

        const hasShieldChoice =
            classFixedItems.some((f) => f.checked && (f.name || '').toLowerCase().includes('shield')) ||
            classEquipChoiceSets.some((cs) => {
                const opt = cs.options.find((o) => o.key === cs.selectedOption);
                return opt && opt.label && opt.label.toLowerCase().includes('shield');
            });
        if (hasShieldChoice) {
            builderState.shieldEnabled = true;
        }

        if (builderState.activeArmorId === 'none') {
            const specialOpts = allArmorOptions.filter((a) => a.type === 'Special');
            if (specialOpts.length > 0) {
                specialOpts.sort((a, b) => b.baseAc - a.baseAc);
                if (specialOpts[0].baseAc > 10 + dexMod) {
                    builderState.activeArmorId = specialOpts[0].id;
                }
            }
        }
    }

    function runHpCalculation() {
        const stats = getEffectiveStats(workingChar, matchedBaseRace, matchedSubrace, asiTiers, racialChoiceDefs);
        const conMod = getMod(stats.con);
        let total = 0;
        const rolls = [];

        workingChar.classes.forEach((c, cIdx) => {
            const hd = parseInt(getClassHitDie(c.name).replace('d', '')) || 8;
            const lvl = parseInt(c.level) || 1;
            const avg = Math.floor(hd / 2) + 1;

            for (let i = 1; i <= lvl; i++) {
                const isFirstLevel = cIdx === 0 && i === 1;
                let roll = avg;
                if (isFirstLevel) {
                    roll = hd;
                } else {
                    if (builderState.hpMode === 'max') roll = hd;
                    else if (builderState.hpMode === 'average') roll = avg;
                    else if (builderState.hpMode === 'roll') roll = Math.floor(Math.random() * hd) + 1;
                    else if (builderState.hpMode === 'roll_avg_min')
                        roll = Math.max(avg, Math.floor(Math.random() * hd) + 1);
                }
                const subTot = Math.max(1, roll + conMod);
                total += subTot;
                rolls.push({
                    level: i,
                    className: c.name,
                    hd,
                    val: roll,
                    con: conMod,
                    total: subTot,
                    isMax: isFirstLevel
                });
            }
        });

        const totalLvl = workingChar.classes.reduce((sum, c) => sum + (parseInt(c.level) || 1), 0);
        const is2024Char = typeof getCharIs2024 === 'function' ? getCharIs2024(workingChar) : false;
        const raceStr = `${workingChar.race || ''} ${workingChar.subrace || ''}`.toLowerCase();

        const hpBreakdown = {
            base: total,
            tough: 0,
            dwarvenToughness: 0,
            draconicResilience: 0,
            totalBonus: 0
        };

        // 1. Tough Feat: +2 HP per character level
        const allSelectedFeats = [
            ...(workingChar.feats || []).map((f) => (typeof f === 'string' ? f : f.name || '')),
            ...Object.values(builderState.selectedFeatChoices || {}),
            ...Object.values(builderState.selectedFeatCustomOptions || {})
        ].filter(Boolean);
        if (Array.isArray(asiTiers)) {
            asiTiers.forEach((tier) => {
                if (tier.choice === 'feat' && tier.selectedFeatId) {
                    const featObj = (builderCache?.feats || []).find(
                        (f) =>
                            (f.id || f.name) === tier.selectedFeatId ||
                            (f.name || '').toLowerCase() === tier.selectedFeatId.toLowerCase()
                    );
                    allSelectedFeats.push(featObj ? featObj.name : tier.selectedFeatId);
                }
            });
        }
        const hasTough = allSelectedFeats.some((f) =>
            (typeof f === 'string' ? f : f.name || '').toLowerCase().includes('tough')
        );
        if (hasTough) {
            hpBreakdown.tough = 2 * totalLvl;
        }

        // 2. Dwarven Toughness:
        // 2024: all Dwarves get +1 HP per level
        // 2014: Hill Dwarf gets +1 HP per level
        const hasDwarfToughness = is2024Char
            ? raceStr.includes('dwarf')
            : raceStr.includes('hill dwarf') || (raceStr.includes('dwarf') && raceStr.includes('hill'));
        if (hasDwarfToughness) {
            hpBreakdown.dwarvenToughness = 1 * totalLvl;
        }

        // 3. Draconic Sorcerer (Draconic Resilience): +1 HP per Sorcerer level
        const sorcClass = workingChar.classes.find(
            (c) =>
                (c.name || '').toLowerCase().includes('sorcerer') &&
                (c.subclass || '').toLowerCase().includes('draconic')
        );
        if (sorcClass) {
            const sorcLvl = parseInt(sorcClass.level) || 1;
            hpBreakdown.draconicResilience = 1 * sorcLvl;
        }

        hpBreakdown.totalBonus = hpBreakdown.tough + hpBreakdown.dwarvenToughness + hpBreakdown.draconicResilience;
        builderState.hpBreakdown = hpBreakdown;

        if (builderState.hpManualOverride && parseInt(builderState.hpManualOverride) > 0) {
            builderState.calculatedHp = parseInt(builderState.hpManualOverride);
        } else {
            builderState.calculatedHp = Math.max(1, total + hpBreakdown.totalBonus);
        }
        builderState.hpRolls = rolls;
    }

    function runAcCalculation() {
        if (builderState.acManualOverride && parseInt(builderState.acManualOverride) > 0) {
            builderState.calculatedAc = parseInt(builderState.acManualOverride);
            builderState.acFormulaText = `Manual Override (${builderState.calculatedAc})`;
            return;
        }

        const stats = getEffectiveStats(workingChar, matchedBaseRace, matchedSubrace, asiTiers, racialChoiceDefs);
        const dexMod = getMod(stats.dex);
        const chosen = allArmorOptions.find((a) => a.id === builderState.activeArmorId) || allArmorOptions[0];

        let base = 10;
        let formula = '10 (Base)';
        if (chosen.id === 'none') {
            base = 10 + dexMod;
            formula = `10 + DEX [${dexMod >= 0 ? '+' : ''}${dexMod}]`;
        } else if (chosen.type === 'Special') {
            base = chosen.baseAc;
            formula = chosen.name;
        } else {
            let rawT = (chosen.rawType || '').toUpperCase();
            const chosenNameLow = (chosen.name || '').toLowerCase();
            if (!rawT || rawT === 'NONE') {
                if (
                    chosenNameLow.includes('chain mail') ||
                    chosenNameLow.includes('plate') ||
                    chosenNameLow.includes('splint') ||
                    chosenNameLow.includes('ring mail')
                )
                    rawT = 'HA';
                else if (chosenNameLow.includes('leather') || chosenNameLow.includes('padded')) rawT = 'LA';
                else rawT = 'MA';
            }

            let dexCap = 0;
            if (rawT === 'HA') {
                dexCap = 0;
                base = (chosen.baseAc || 16) + (chosen.bonusAc || 0);
                formula = `${chosen.name} (${chosen.baseAc}${chosen.bonusAc ? ` + ${chosen.bonusAc}` : ''})`;
            } else if (rawT === 'MA') {
                dexCap = Math.min(2, dexMod);
                base = (chosen.baseAc || 14) + dexCap + (chosen.bonusAc || 0);
                formula = `${chosen.name} (${chosen.baseAc} + DEX cap [${dexCap}]${chosen.bonusAc ? ` + ${chosen.bonusAc}` : ''})`;
            } else {
                dexCap = dexMod;
                base = (chosen.baseAc || 11) + dexCap + (chosen.bonusAc || 0);
                formula = `${chosen.name} (${chosen.baseAc} + DEX [${dexMod >= 0 ? '+' : ''}${dexMod}]${chosen.bonusAc ? ` + ${chosen.bonusAc}` : ''})`;
            }
        }

        let shieldVal = 0;
        if (builderState.shieldEnabled && chosen.id !== 'monk' && !chosen.noShield && chosen.id !== 'dance_bard') {
            shieldVal = 2;
            formula += ' + Shield (+2)';
        }

        let defenseBonus = 0;
        const hasDefenseFightingStyle = (() => {
            const subVals = Object.values(workingChar.featureSubChoices || {});
            if (subVals.some((v) => typeof v === 'string' && v.toLowerCase() === 'defense')) return true;
            if (
                candidateClassFeatures &&
                candidateClassFeatures.some(
                    (f) => f.checked !== false && f.subOptionChoice && f.subOptionChoice.toLowerCase() === 'defense'
                )
            )
                return true;
            const featCustomVals = Object.values(builderState.selectedFeatCustomOptions || {});
            if (featCustomVals.some((opt) => opt && opt.fightingStyle && opt.fightingStyle.toLowerCase() === 'defense'))
                return true;
            if (
                (workingChar.features || []).some((f) => {
                    const n = (typeof f === 'string' ? f : f.name || '').toLowerCase();
                    return n.includes('defense') && (n.includes('fighting style') || n.includes('fighting initiate'));
                })
            )
                return true;
            if (
                (workingChar.customFeatures || []).some((f) => {
                    const n = (f.name || '').toLowerCase();
                    return n.includes('defense');
                })
            )
                return true;
            return false;
        })();

        if (hasDefenseFightingStyle && chosen.type !== 'Special' && chosen.id !== 'none') {
            defenseBonus = 1;
            formula += ' + Defense Fighting Style (+1)';
        }

        let warforgedBonus = 0;
        const raceStr = `${workingChar.race || ''} ${workingChar.subrace || ''}`.toLowerCase();
        if (raceStr.includes('warforged')) {
            warforgedBonus = 1;
            formula += ' + Warforged Integrated Protection (+1)';
        }

        builderState.calculatedAc = base + shieldVal + defenseBonus + warforgedBonus;
        builderState.acFormulaText = formula;
    }

    function updateTopSummary() {
        if (!summaryEl) return;
        const totalLvl = workingChar.classes.reduce((sum, c) => sum + (parseInt(c.level) || 1), 0);
        const raceStr = [workingChar.race, workingChar.subrace].filter(Boolean).join(' - ') || 'Unknown Species';
        const classStr = workingChar.classes
            .map((c) => `${c.name}${c.subclass ? ' (' + c.subclass + ')' : ''} ${c.level || 1}`)
            .join(' / ');
        const bgStr = workingChar.background ? ` &bull; ${workingChar.background}` : '';
        summaryEl.innerHTML = `<strong>${workingChar.name}</strong> &bull; Level ${totalLvl} &bull; ${raceStr} &bull; ${classStr}${bgStr}`;
    }

    function updateCountsDisplay() {
        if (!countsEl) return;
        const checkedFeats = allCandidateAbilities.filter((a) => a.checked).length;
        const checkedFixedEq = classFixedItems.filter((f) => f.checked).length;
        const checkedBgEq = candidateBgItems.filter((i) => i.checked).length;
        const totalEquip =
            checkedFixedEq + checkedBgEq + (workingChar.useStartingWealth ? 1 : classEquipChoiceSets.length);
        const checkedSpells =
            classSpellSections.reduce((sum, s) => sum + s.spells.filter((sp) => sp.checked).length, 0) +
            candidateInnateSpells.length;

        countsEl.innerHTML = `Step ${currentStep} of ${STEPS.length} &bull; <strong>${checkedFeats}</strong> Abilities &bull; <strong>${totalEquip}</strong> Items &bull; <strong>${checkedSpells}</strong> Spells`;
        backBtn.disabled = currentStep === 1;
        nextBtn.disabled = currentStep === STEPS.length;
    }

    function renderStepNav() {
        const navEl = document.getElementById('pc-builder-step-nav');
        if (!navEl) return;
        navEl.innerHTML = STEPS.map(
            (s) => `
            <button type="button" class="pc-builder-tab ${s.id === currentStep ? 'active' : ''} ${s.id < currentStep ? 'completed' : ''}" data-step="${s.id}">
                <span class="step-idx">${s.id < currentStep ? '<i class="fa-solid fa-check" style="font-size:0.6rem;"></i>' : s.id}</span>
                <i class="fa-solid ${s.icon}" style="font-size:0.8rem; opacity:0.85;"></i>
                <span>${s.shortTitle}</span>
            </button>
        `
        ).join('');

        navEl.querySelectorAll('.pc-builder-tab').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const st = parseInt(btn.dataset.step) || 1;
                await goToStep(st);
            });
        });
    }

    async function goToStep(step) {
        await harvestCurrentStepInputs();
        currentStep = Math.max(1, Math.min(STEPS.length, step));
        renderStepNav();
        updateCountsDisplay();
        renderCurrentStep();
    }

    async function harvestCurrentStepInputs() {
        if (currentStep === 1) {
            const rSel = document.getElementById('pc-wizard-race');
            if (rSel) {
                if (rSel.value === '__custom__') {
                    workingChar.isCustomRace = true;
                    workingChar.customRaceText =
                        document.getElementById('pc-wizard-custom-race')?.value.trim() || 'Custom Species';
                    workingChar.race = workingChar.customRaceText;
                } else {
                    workingChar.isCustomRace = false;
                    workingChar.race = rSel.value;
                }
            }

            const sSel = document.getElementById('pc-wizard-subrace');
            if (sSel) {
                if (sSel.value === '__custom__') {
                    workingChar.isCustomSubrace = true;
                    workingChar.customSubraceText =
                        document.getElementById('pc-wizard-custom-subrace')?.value.trim() || '';
                    workingChar.subrace = workingChar.customSubraceText;
                } else {
                    workingChar.isCustomSubrace = false;
                    workingChar.subrace = sSel.value;
                }
            }

            const bgSel = document.getElementById('pc-wizard-bg');
            if (bgSel) {
                if (bgSel.value === '__custom__') {
                    workingChar.isCustomBackground = true;
                    workingChar.customBackgroundText =
                        document.getElementById('pc-wizard-custom-bg')?.value.trim() || 'Custom Background';
                    workingChar.background = workingChar.customBackgroundText;
                } else {
                    workingChar.isCustomBackground = false;
                    const [bName, bSrc] = bgSel.value.split('::');
                    workingChar.background = bName || bgSel.value;
                    if (bSrc) workingChar.backgroundSource = bSrc;
                }
            }

            workingChar.classes.forEach((cls, i) => {
                const sel = document.querySelector(`.pc-wiz-cls-sel[data-idx="${i}"]`);
                const custCls = document.querySelector(`.pc-wiz-custom-cls-input[data-idx="${i}"]`);
                const subSel = document.querySelector(`.pc-wiz-subclass-sel[data-idx="${i}"]`);
                const custSub = document.querySelector(`.pc-wiz-custom-subclass-input[data-idx="${i}"]`);
                const legacySub = document.querySelector(`.pc-wiz-subclass-input[data-idx="${i}"]`);
                const lvlInput = document.querySelector(`.pc-wiz-cls-lvl[data-idx="${i}"]`);

                if (sel) {
                    if (sel.value === '__custom__') {
                        cls.isCustomClass = true;
                        cls.customClassText = custCls?.value.trim() || cls.customClassText || 'Custom Class';
                        cls.name = cls.customClassText;
                        cls.source = 'Custom';
                    } else {
                        cls.isCustomClass = false;
                        const [cName, cSrc] = sel.value.split('::');
                        cls.name = cName || sel.value;
                        if (cSrc) cls.source = cSrc;
                    }
                }

                if (subSel) {
                    if (subSel.value === '__custom__') {
                        cls.isCustomSubclass = true;
                        cls.customSubclassText = custSub?.value.trim() || cls.customSubclassText || '';
                        cls.subclass = cls.customSubclassText;
                    } else {
                        cls.isCustomSubclass = false;
                        cls.subclass = subSel.value;
                    }
                } else if (legacySub) {
                    cls.subclass = legacySub.value.trim();
                }

                if (lvlInput) {
                    cls.level = Math.max(1, Math.min(20, parseInt(lvlInput.value) || 1));
                }
            });

            const spdWalk = document.getElementById('pc-wiz-spd-walk');
            if (spdWalk) workingChar.speed.walk = parseInt(spdWalk.value) || 30;
            const spdClimb = document.getElementById('pc-wiz-spd-climb');
            if (spdClimb) workingChar.speed.climb = parseInt(spdClimb.value) || 0;
            const spdFly = document.getElementById('pc-wiz-spd-fly');
            if (spdFly) workingChar.speed.fly = parseInt(spdFly.value) || 0;
            const spdBurrow = document.getElementById('pc-wiz-spd-burrow');
            if (spdBurrow) workingChar.speed.burrow = parseInt(spdBurrow.value) || 0;

            const snsDark = document.getElementById('pc-wiz-sns-darkvision');
            if (snsDark) workingChar.senses.darkvision = parseInt(snsDark.value) || 0;
            const snsDevil = document.getElementById('pc-wiz-sns-devilsight');
            if (snsDevil) workingChar.senses.devilSight = parseInt(snsDevil.value) || 0;
            const snsBlind = document.getElementById('pc-wiz-sns-blindsight');
            if (snsBlind) workingChar.senses.blindsight = parseInt(snsBlind.value) || 0;
            const snsTrue = document.getElementById('pc-wiz-sns-truesight');
            if (snsTrue) workingChar.senses.truesight = parseInt(snsTrue.value) || 0;

            const bioAge = document.getElementById('pc-wiz-bio-age');
            if (bioAge) workingChar.bio.age = bioAge.value.trim();
            const bioHt = document.getElementById('pc-wiz-bio-height');
            if (bioHt) workingChar.bio.height = bioHt.value.trim();
            const bioWt = document.getElementById('pc-wiz-bio-weight');
            if (bioWt) workingChar.bio.weight = bioWt.value.trim();
            const bioBack = document.getElementById('pc-wiz-bio-backstory');
            if (bioBack) workingChar.bio.backstory = bioBack.value.trim();
            const bioNotes = document.getElementById('pc-wiz-bio-notes');
            if (bioNotes) workingChar.bio.notes = bioNotes.value.trim();

            await recomputeCandidates();
        } else if (currentStep === 2) {
            ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach((s) => {
                const manInp = document.getElementById(`pc-man-stat-${s}`);
                if (manInp) workingChar.manualScores[s] = parseInt(manInp.value) || 10;
            });
            await recomputeCandidates();
        } else if (currentStep === 3) {
            workingChar.expertise = workingChar.expertise || {};
            document.querySelectorAll('.pc-wiz-expertise-chk').forEach((chk) => {
                const sk = chk.dataset.skill;
                if (sk) {
                    if (chk.checked) workingChar.expertise[sk] = true;
                    else delete workingChar.expertise[sk];
                }
            });
        } else if (currentStep === 5) {
            const goldInput = document.getElementById('pc-wiz-starting-gold');
            if (goldInput) workingChar.startingGoldAmount = parseInt(goldInput.value) || 0;
        } else if (currentStep === 6) {
            if (Array.isArray(asiTiers)) {
                asiTiers.forEach((tier, tIdx) => {
                    const choiceBtnActive = document.querySelector(
                        `.pc-wiz-tier-choice.btn-primary[data-tidx="${tIdx}"]`
                    );
                    if (choiceBtnActive && choiceBtnActive.dataset.choice) {
                        tier.choice = choiceBtnActive.dataset.choice;
                    }

                    const asiModeRadio = document.querySelector(`input[name="asi_mode_${tIdx}"]:checked`);
                    if (asiModeRadio) tier.asiMode = asiModeRadio.value;

                    const selFeat = document.querySelector(`.pc-tier-feat-sel[data-tidx="${tIdx}"]`);
                    if (selFeat && selFeat.value !== undefined) tier.selectedFeatId = selFeat.value;

                    const halfStatSel = document.querySelector(`.pc-tier-feat-halfstat-sel[data-tidx="${tIdx}"]`);
                    if (halfStatSel) {
                        tier.halfFeatStat = halfStatSel.value;
                        tier.featSubChoices = tier.featSubChoices || {};
                        tier.featSubChoices.halfFeatStat = halfStatSel.value;
                    }

                    const stat1Sel = document.querySelector(`.pc-wiz-tier-stat1[data-tidx="${tIdx}"]`);
                    if (stat1Sel) tier.stat1 = stat1Sel.value;

                    const stat2Sel = document.querySelector(`.pc-wiz-tier-stat2[data-tidx="${tIdx}"]`);
                    if (stat2Sel) tier.stat2 = stat2Sel.value;

                    tier.featSubChoices = tier.featSubChoices || {};
                    document.querySelectorAll(`.pc-tier-feat-subchoice-sel[data-tidx="${tIdx}"]`).forEach((subSel) => {
                        const field = subSel.dataset.field;
                        if (field) tier.featSubChoices[field] = subSel.value;
                    });
                    document.querySelectorAll(`.pc-tier-feat-spell-sel[data-tidx="${tIdx}"]`).forEach((subSel) => {
                        const field = subSel.dataset.field;
                        if (field) tier.featSubChoices[field] = subSel.value;
                    });

                    const spellClassSel = document.querySelector(`.pc-tier-feat-spellclass-sel[data-tidx="${tIdx}"]`);
                    if (spellClassSel) tier.featSubChoices.spellClass = spellClassSel.value;

                    const collegeSel = document.querySelector(`.pc-tier-feat-college-sel[data-tidx="${tIdx}"]`);
                    if (collegeSel) tier.featSubChoices.college = collegeSel.value;

                    const moonSel = document.querySelector(`.pc-tier-feat-moon-sel[data-tidx="${tIdx}"]`);
                    if (moonSel) tier.featSubChoices.moon = moonSel.value;

                    const planeSel = document.querySelector(`.pc-tier-feat-plane-sel[data-tidx="${tIdx}"]`);
                    if (planeSel) tier.featSubChoices.plane = planeSel.value;

                    const abilitySel = document.querySelector(`.pc-tier-feat-ability-sel[data-tidx="${tIdx}"]`);
                    if (abilitySel) tier.featSubChoices.abilityScore = abilitySel.value;
                });
                workingChar.builderFeatSelections = [...asiTiers];
                await recomputeCandidates();
            }
        } else if (currentStep === 7) {
            document.querySelectorAll('.pc-wiz-spell-chk').forEach((chk) => {
                const secIdx = parseInt(chk.dataset.sec);
                const spId = chk.dataset.spellId;
                const sec = classSpellSections[secIdx];
                if (sec) {
                    const sp = sec.spells.find((x) => x.id === spId);
                    if (sp) {
                        sp.checked = chk.checked;
                        if (sp.name) userSelectedSpellMap.set(sp.name.toLowerCase().trim(), chk.checked);
                    }
                }
            });
            document.querySelectorAll('.pc-wiz-bg-spell-chk').forEach((chk) => {
                const idx = parseInt(chk.dataset.idx);
                const sp = candidateBgExpandedSpells[idx];
                if (sp) {
                    sp.checked = chk.checked;
                    if (sp.name) userSelectedSpellMap.set(sp.name.toLowerCase().trim(), chk.checked);
                }
            });
        }
    }

    function renderCurrentStep() {
        bodyEl.scrollTop = 0;
        const ctx = {
            bodyEl,
            builderCache,
            disabledSources,
            isSourceAllowed,
            workingChar,
            recomputeCandidates,
            harvestCurrentStepInputs,
            getEffectiveStats: () =>
                getEffectiveStats(workingChar, matchedBaseRace, matchedSubrace, asiTiers, racialChoiceDefs),
            getEffectiveRacialBonuses: () =>
                getEffectiveRacialBonuses(workingChar, matchedBaseRace, matchedSubrace, racialChoiceDefs),
            getFeatAndAsiBonuses: () => getFeatAndAsiBonuses(asiTiers),
            getPointBuySpent,
            POINT_BUY_COSTS,
            racialChoiceDefs,
            candidateProficiencies,
            candidateBgSkills,
            availableClassSkills,
            selectedClassSkills,
            classSkillLimit,
            classExpertiseLimit: (() => {
                let limit = 0;
                (workingChar.classes || []).forEach((c) => {
                    const raw = (c.name || '').toLowerCase().trim();
                    const lvl = parseInt(c.level) || 1;
                    if (raw === 'rogue') {
                        if (lvl >= 1) limit += 2;
                        if (lvl >= 6) limit += 2;
                    } else if (raw === 'bard') {
                        if (lvl >= 3) limit += 2;
                        if (lvl >= 10) limit += 2;
                    } else if (raw === 'ranger') {
                        if (lvl >= 1) limit += 1;
                    }
                });
                return limit;
            })(),
            updateCountsDisplay,
            candidateClassFeatures,
            candidateRacialTraits,
            candidateBgFeatures,
            optFeatureSections,
            allCandidateAbilities,
            classEquipChoiceSets,
            classFixedItems,
            candidateBgItems,
            MARTIAL_WEAPONS,
            SIMPLE_WEAPONS,
            candidateInnateSpells,
            candidateBgExpandedSpells,
            classSpellSections,
            userSelectedSpellMap,
            asiTiers,
            builderState,
            refreshArmorOptionsFromCandidates,
            runHpCalculation,
            runAcCalculation,
            allArmorOptions,
            getMod
        };

        if (currentStep === 1) renderStep1(ctx);
        else if (currentStep === 2) renderStep2(ctx);
        else if (currentStep === 3) renderStep3(ctx);
        else if (currentStep === 4) renderStep4(ctx);
        else if (currentStep === 5) renderStep5(ctx);
        else if (currentStep === 6) renderStepFeats(ctx);
        else if (currentStep === 7) renderStepSpells(ctx);
        else if (currentStep === 8) renderStep8(ctx);
    }

    // Navigation Controls
    backBtn.onclick = async () => {
        if (currentStep > 1) await goToStep(currentStep - 1);
    };

    nextBtn.onclick = async () => {
        if (currentStep < STEPS.length) await goToStep(currentStep + 1);
    };

    const closeModal = () => {
        modal.classList.add('vtt-hidden');
        overlay.classList.add('vtt-hidden');
        applyBtn.disabled = false;
    };

    closeBtn.onclick = closeModal;
    cancelBtn.onclick = closeModal;
    overlay.onclick = closeModal;

    // SAVE & APPLY EXECUTION
    applyBtn.onclick = async () => {
        try {
            await harvestCurrentStepInputs();
            applyBtn.disabled = true;
            applyBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving Character...';

            char.abilityCategories = char.abilityCategories || [];
            char.abilityCards = char.abilityCards || [];
            char.equipment = char.equipment || [];
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
                          level9: []
                      };
            [
                'cantrip',
                'level1',
                'level2',
                'level3',
                'level4',
                'level5',
                'level6',
                'level7',
                'level8',
                'level9'
            ].forEach((k) => {
                char.spells[k] = char.spells[k] || [];
            });

            // 1. Commit Identity & Multiclassing
            char.race = workingChar.race;
            char.subrace = workingChar.subrace;
            char.background = workingChar.background;
            char.classes = JSON.parse(JSON.stringify(workingChar.classes));
            char.class = char.classes[0]?.name || 'Fighter';
            char.level = char.classes.reduce((sum, c) => sum + (parseInt(c.level) || 1), 0);

            // 2. Commit Speeds & Senses
            const effectiveSpeed = calculateEffectiveSpeed(workingChar, matchedBaseRace, matchedSubrace, asiTiers);
            char.speed = {
                walk: effectiveSpeed.walk || 30,
                climb: effectiveSpeed.climb || 0,
                swim: effectiveSpeed.swim || 0,
                fly: effectiveSpeed.fly || 0,
                burrow: effectiveSpeed.burrow || 0
            };
            char.senses = { ...workingChar.senses };
            char.tokenSight = Math.max(
                parseInt(char.senses.darkvision) || 0,
                parseInt(char.senses.devilSight) || 0,
                parseInt(char.senses.blindsight) || 0,
                parseInt(char.senses.truesight) || 0
            );

            // 3. Commit Bio
            char.bio = { ...workingChar.bio };

            // 4. Commit Ability Scores & Derived Stats
            char.statMethod = workingChar.statMethod;
            char.pointBuyScores = { ...workingChar.pointBuyScores };
            char.standardArrayAssignments = { ...workingChar.standardArrayAssignments };
            char.manualScores = { ...workingChar.manualScores };
            char.rolledScores = Array.isArray(workingChar.rolledScores)
                ? JSON.parse(JSON.stringify(workingChar.rolledScores))
                : [];
            char.racialAsiMode = workingChar.racialAsiMode;
            char.tashasMode = workingChar.tashasMode;
            char.tashasPlus2 = workingChar.tashasPlus2;
            char.tashasPlus1 = workingChar.tashasPlus1;
            char.tashasPlus1_1 = workingChar.tashasPlus1_1;
            char.tashasPlus1_2 = workingChar.tashasPlus1_2;
            char.tashasPlus1_3 = workingChar.tashasPlus1_3;
            char.bgAsiMode = workingChar.bgAsiMode;
            char.bgAsiPlus2 = workingChar.bgAsiPlus2;
            char.bgAsiPlus1 = workingChar.bgAsiPlus1;
            char.bgAsiPlus1_1 = workingChar.bgAsiPlus1_1;
            char.bgAsiPlus1_2 = workingChar.bgAsiPlus1_2;
            char.bgAsiPlus1_3 = workingChar.bgAsiPlus1_3;
            char.customRacialBonuses = { ...workingChar.customRacialBonuses };
            char.builderFeatSelections = Array.isArray(asiTiers) ? JSON.parse(JSON.stringify(asiTiers)) : [];

            char.baseStats = getBaseScores(workingChar);
            char.racialChoices = { ...workingChar.racialChoices };
            char.racialBonusStats = getEffectiveRacialBonuses(
                workingChar,
                matchedBaseRace,
                matchedSubrace,
                racialChoiceDefs
            );
            char.stats = getEffectiveStats(workingChar, matchedBaseRace, matchedSubrace, asiTiers, racialChoiceDefs);

            // 4b. Commit Saving Throws, Skills & Proficiencies
            char.saves = char.saves || {};
            ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach((stat) => {
                const saveCand = candidateProficiencies.find((p) => p.type === 'save' && p.stat === stat);
                if (saveCand) {
                    char.saves[stat] = saveCand.checked;
                }
            });

            char.skills = char.skills || {};
            availableClassSkills.forEach((s) => {
                char.skills[s] = selectedClassSkills.has(s);
            });
            selectedClassSkills.forEach((s) => {
                char.skills[s] = true;
            });
            candidateBgSkills.forEach((s) => {
                char.skills[s] = true;
            });
            char.expertise = { ...(workingChar.expertise || {}) };

            char.proficiencies = char.proficiencies || { languages: '', weapons: '', armor: '', tools: '' };
            const checkedArmor = candidateProficiencies
                .filter((p) => p.type === 'armor' && p.checked)
                .map((p) => p.label);
            if (checkedArmor.length > 0) {
                char.proficiencies.armor = checkedArmor.join(', ');
            }
            const checkedWeapons = candidateProficiencies
                .filter((p) => p.type === 'weapon' && p.checked)
                .map((p) => p.label);
            if (checkedWeapons.length > 0) {
                char.proficiencies.weapons = checkedWeapons.join(', ');
            }
            char.proficiencies.savingThrows = candidateProficiencies
                .filter((p) => p.type === 'save' && p.checked)
                .map((p) => p.stat);

            // 5. Commit HP and AC
            char.hpManualOverride = builderState.hpManualOverride || null;
            char.acManualOverride = builderState.acManualOverride || null;
            const oldHp = char.hpMax || 0;
            char.hpMax = Math.max(1, builderState.calculatedHp || parseInt(char.hpMax) || 10);
            if (
                char.hpCurrent === undefined ||
                char.hpCurrent === null ||
                char.hpCurrent === oldHp ||
                char.hpCurrent === 0
            ) {
                char.hpCurrent = char.hpMax;
            } else if (char.hpMax > oldHp) {
                char.hpCurrent = Math.min(char.hpMax, (parseInt(char.hpCurrent) || 0) + (char.hpMax - oldHp));
            }
            char.ac = builderState.calculatedAc || parseInt(char.ac) || 10;

            // 6. Import Checked Features & Traits
            const checkedFeatures = allCandidateAbilities.filter((a) => a.checked);
            checkedFeatures.forEach((ab) => {
                let catName = ab.category || 'Imported Features';
                let existingCat = char.abilityCategories.find((c) => c.name.toLowerCase() === catName.toLowerCase());
                let catId = existingCat ? existingCat.id : null;
                if (!catId) {
                    catId = 'cat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
                    char.abilityCategories.push({ id: catId, name: catName, collapsed: false });
                }

                const resolvedMax = ab.hasCounter ? evaluateAbilityMaxUses(ab.usesMax, char) : 0;
                let cardName = ab.name;
                if (
                    ab.subOptions &&
                    ab.subOptionChoice &&
                    !cardName.toLowerCase().includes(ab.subOptionChoice.toLowerCase())
                ) {
                    cardName = `${ab.name} (${ab.subOptionChoice})`;
                }
                char.abilityCards.push({
                    id: 'ab_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                    name: cardName,
                    actionType: ab.actionType || 'passive',
                    categoryId: catId,
                    description: ab.description || '',
                    formula: ab.formula || '',
                    formulaConfig: ab.formulaConfig || null,
                    customFields: [],
                    hasCounter: !!ab.hasCounter,
                    usesCurrent: resolvedMax,
                    usesMax: resolvedMax,
                    resetType: ab.resetType || 'short'
                });
            });

            // 6b. Import Selected Milestone Feats
            if (Array.isArray(asiTiers)) {
                asiTiers.forEach((t) => {
                    if (t.choice === 'feat' && t.selectedFeatId) {
                        const featObj = (builderCache?.feats || []).find(
                            (f) =>
                                (f.id || f.name) === t.selectedFeatId ||
                                (f.name || '').toLowerCase() === t.selectedFeatId.toLowerCase()
                        );
                        if (featObj) {
                            let fName = featObj.name;
                            const sub = t.featSubChoices || {};
                            let subCardTitle = '';
                            let subDesc = '';

                            if (fName.toLowerCase().includes('fighting initiate') && sub.fightingStyle) {
                                fName = `Feat: Fighting Initiate (${sub.fightingStyle})`;
                                subCardTitle = `Fighting Style: ${sub.fightingStyle}`;
                                subDesc = `You adopt a particular style of fighting as your specialty: ${sub.fightingStyle}.`;
                            } else if (fName.toLowerCase().includes('eldritch adept') && sub.invocation) {
                                fName = `Feat: Eldritch Adept (${sub.invocation})`;
                                subCardTitle = `Eldritch Invocation: ${sub.invocation}`;
                                subDesc = `In your study of occult lore, you have unearned an eldritch invocation: ${sub.invocation}.`;
                            } else if (
                                fName.toLowerCase().includes('metamagic adept') &&
                                (sub.metamagic1 || sub.metamagic2)
                            ) {
                                const metamagics = [sub.metamagic1, sub.metamagic2].filter(Boolean);
                                fName = `Feat: Metamagic Adept (${metamagics.join(', ')})`;
                                subCardTitle = `Metamagic: ${metamagics.join(' & ')}`;
                                subDesc = `You have learned how to exert your will on your spells with Metamagic. Options: ${metamagics.join(', ')}.`;
                            } else if (fName.toLowerCase().includes('elemental adept') && sub.elementalType) {
                                fName = `Feat: Elemental Adept (${sub.elementalType})`;
                                subDesc = `Spells you cast ignore resistance to damage of ${sub.elementalType}. In addition, when you roll damage for a spell you cast that deals ${sub.elementalType} damage, you can treat any 1 on a damage die as a 2.`;
                            } else if (/strixhaven initiate/i.test(fName)) {
                                const college = sub.college || 'lorehold';
                                const collegeName = college.charAt(0).toUpperCase() + college.slice(1);
                                fName = `Feat: Strixhaven Initiate (${collegeName})`;
                                subCardTitle = `College: ${collegeName}`;
                                subDesc = `You have studied magic associated with ${collegeName} College at Strixhaven University.`;
                            } else if (/initiate of high sorcery/i.test(fName) && sub.moon) {
                                const moonName = sub.moon.charAt(0).toUpperCase() + sub.moon.slice(1);
                                fName = `Feat: Initiate of High Sorcery (${moonName})`;
                                subCardTitle = `Order of High Sorcery: ${moonName}`;
                                subDesc = `You follow the traditions of the ${moonName} moon of Krynn.`;
                            } else if (/scion of the outer planes/i.test(fName) && sub.plane) {
                                const planeName = sub.plane.charAt(0).toUpperCase() + sub.plane.slice(1);
                                fName = `Feat: Scion of the Outer Planes (${planeName})`;
                                subCardTitle = `Planar Alignment: ${planeName}`;
                                subDesc = `You have an innate connection to a ${planeName} plane of the multiverse.`;
                            } else if (/strike of the giants/i.test(fName)) {
                                const strikeName = sub.giantStrike || 'Cloud Strike';
                                const strikeInfo = {
                                    'Cloud Strike': { formula: '1d4', dmgType: 'thunder' },
                                    'Fire Strike': { formula: '1d10', dmgType: 'fire' },
                                    'Frost Strike': { formula: '1d6', dmgType: 'cold' },
                                    'Hill Strike': { formula: '1d6', dmgType: 'damage' },
                                    'Stone Strike': { formula: '1d6', dmgType: 'force' },
                                    'Storm Strike': { formula: '1d6', dmgType: 'lightning' }
                                }[strikeName] || { formula: '1d4', dmgType: 'thunder' };

                                fName = `Feat: Strike of the Giants (${strikeName})`;
                                subCardTitle = strikeName;
                                subDesc = featObj.description || '';
                                featObj.formula = strikeInfo.formula;
                                featObj.hasCounter = true;
                                featObj.usesMax = 'PB';
                                featObj.resetType = 'long';
                            } else if (/skill expert/i.test(fName)) {
                                if (sub.skillProf) {
                                    char.skills[sub.skillProf] = true;
                                }
                                if (sub.skillExp) {
                                    char.expertise[sub.skillExp] = true;
                                }
                            } else if (/skilled/i.test(fName) && !/expert/i.test(fName)) {
                                [sub.skillTool1, sub.skillTool2, sub.skillTool3].filter(Boolean).forEach((item) => {
                                    if (
                                        item.includes("'s") ||
                                        item.includes('Tools') ||
                                        item.includes('Kit') ||
                                        item.includes('Supplies') ||
                                        item.includes('Utensils')
                                    ) {
                                        const curTools = char.proficiencies.tools
                                            ? char.proficiencies.tools.split(', ').map((s) => s.trim())
                                            : [];
                                        if (!curTools.includes(item)) curTools.push(item);
                                        char.proficiencies.tools = curTools.join(', ');
                                    } else {
                                        char.skills[item] = true;
                                    }
                                });
                            } else if (/prodigy/i.test(fName)) {
                                if (sub.skill1) char.skills[sub.skill1] = true;
                                if (sub.tool1) {
                                    const curTools = char.proficiencies.tools
                                        ? char.proficiencies.tools.split(', ').map((s) => s.trim())
                                        : [];
                                    if (!curTools.includes(sub.tool1)) curTools.push(sub.tool1);
                                    char.proficiencies.tools = curTools.join(', ');
                                }
                                if (sub.lang1) {
                                    const curLangs = char.proficiencies.languages
                                        ? char.proficiencies.languages.split(', ').map((s) => s.trim())
                                        : [];
                                    if (!curLangs.includes(sub.lang1)) curLangs.push(sub.lang1);
                                    char.proficiencies.languages = curLangs.join(', ');
                                }
                                if (sub.skillExp) char.expertise[sub.skillExp] = true;
                            }

                            let featCat = char.abilityCategories.find((c) => c.name.toLowerCase() === 'feats');
                            let catId = featCat ? featCat.id : null;
                            if (!catId) {
                                catId = 'cat_feats_' + Date.now();
                                char.abilityCategories.push({ id: catId, name: 'Feats', collapsed: false });
                            }

                            const alreadyHas = (char.abilityCards || []).some(
                                (a) => (a.name || '').toLowerCase() === fName.toLowerCase()
                            );
                            if (!alreadyHas) {
                                const resolvedMax = featObj.hasCounter
                                    ? evaluateAbilityMaxUses(featObj.usesMax, char)
                                    : 0;
                                char.abilityCards.push({
                                    id: 'ab_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                                    name: fName,
                                    actionType: featObj.actionType || 'passive',
                                    categoryId: catId,
                                    description: featObj.description || '',
                                    formula: featObj.formula || '',
                                    formulaConfig: featObj.formulaConfig || null,
                                    customFields: [],
                                    hasCounter: !!featObj.hasCounter,
                                    usesCurrent: resolvedMax,
                                    usesMax: resolvedMax,
                                    resetType: featObj.resetType || 'short'
                                });
                            }

                            if (
                                subCardTitle &&
                                !(char.abilityCards || []).some(
                                    (a) => (a.name || '').toLowerCase() === subCardTitle.toLowerCase()
                                )
                            ) {
                                char.abilityCards.push({
                                    id: 'ab_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                                    name: subCardTitle,
                                    actionType: 'passive',
                                    categoryId: catId,
                                    description: subDesc || featObj.description || '',
                                    formula: '',
                                    formulaConfig: null,
                                    customFields: [],
                                    hasCounter: false,
                                    usesCurrent: 0,
                                    usesMax: 0,
                                    resetType: 'short'
                                });
                            }

                            const spellsToImport = [];
                            if (/fey[- ]touched/i.test(fName)) {
                                spellsToImport.push({ name: 'Misty Step', level: 2 });
                                if (sub.spell1) spellsToImport.push({ name: sub.spell1, level: 1 });
                            } else if (/shadow[- ]touched/i.test(fName)) {
                                spellsToImport.push({ name: 'Invisibility', level: 2 });
                                if (sub.spell1) spellsToImport.push({ name: sub.spell1, level: 1 });
                            } else if (
                                /magic initiate/i.test(fName) ||
                                /strixhaven initiate/i.test(fName) ||
                                /initiate of high sorcery/i.test(fName)
                            ) {
                                if (sub.cantrip1) spellsToImport.push({ name: sub.cantrip1, level: 0 });
                                if (sub.cantrip2) spellsToImport.push({ name: sub.cantrip2, level: 0 });
                                if (sub.spell1) spellsToImport.push({ name: sub.spell1, level: 1 });
                            } else if (/artificer initiate/i.test(fName)) {
                                if (sub.cantrip1) spellsToImport.push({ name: sub.cantrip1, level: 0 });
                                if (sub.spell1) spellsToImport.push({ name: sub.spell1, level: 1 });
                            } else if (/spell sniper/i.test(fName) || /scion of the outer planes/i.test(fName)) {
                                if (sub.cantrip1) spellsToImport.push({ name: sub.cantrip1, level: 0 });
                            } else if (/rune shaper/i.test(fName)) {
                                spellsToImport.push({ name: 'Comprehend Languages', level: 1 });
                                if (sub.spell1) spellsToImport.push({ name: sub.spell1, level: 1 });
                                if (sub.spell2) spellsToImport.push({ name: sub.spell2, level: 1 });
                            }

                            spellsToImport.forEach((spReq) => {
                                const spObj = (builderCache?.spells || []).find(
                                    (s) => s.name.toLowerCase() === spReq.name.toLowerCase()
                                );
                                const sLvl = spObj ? spObj.level : spReq.level;
                                const sKey = sLvl === 0 ? 'cantrip' : 'level' + sLvl;
                                char.spells[sKey] = char.spells[sKey] || [];
                                if (!char.spells[sKey].some((s) => s.name.toLowerCase() === spReq.name.toLowerCase())) {
                                    char.spells[sKey].push({
                                        id: 'sp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                                        name: spObj ? spObj.name : spReq.name,
                                        source: spObj ? spObj.source || '' : '',
                                        level: sLvl,
                                        school: spObj ? spObj.school || '' : '',
                                        time: spObj ? spObj.castingTime || spObj.time || '1 action' : '1 action',
                                        range: spObj ? spObj.range || 'Self' : 'Self',
                                        duration: spObj ? spObj.duration || 'Instantaneous' : 'Instantaneous',
                                        description: spObj
                                            ? spObj.descriptionMarkdown || spObj.descriptionHtml || ''
                                            : '',
                                        prepared: true
                                    });
                                }
                            });
                        }
                    }
                });
            }

            // 6c. Seed Sheet Automation Toggles (Alert, Observant, GWM, Sharpshooter, Fighting Styles, Initiative Bonuses)
            char.skillToggles = Array.isArray(char.skillToggles) ? char.skillToggles : [];
            char.attackSettings = char.attackSettings || { atkMod: 0, toggles: [] };
            char.attackSettings.toggles = Array.isArray(char.attackSettings.toggles) ? char.attackSettings.toggles : [];

            const allSelectedFeatNames = [
                ...(workingChar.feats || []).map((f) => (typeof f === 'string' ? f : f.name || '')),
                ...Object.values(builderState.selectedFeatChoices || {}),
                ...Object.values(builderState.selectedFeatCustomOptions || {})
            ];
            if (Array.isArray(asiTiers)) {
                asiTiers.forEach((tier) => {
                    if (tier.choice === 'feat' && tier.selectedFeatId) {
                        const featObj = (builderCache?.feats || []).find(
                            (f) =>
                                (f.id || f.name) === tier.selectedFeatId ||
                                (f.name || '').toLowerCase() === tier.selectedFeatId.toLowerCase()
                        );
                        allSelectedFeatNames.push(featObj ? featObj.name : tier.selectedFeatId);
                    }
                });
            }

            char.feats = char.feats || [];
            allSelectedFeatNames.forEach((fName) => {
                if (
                    fName &&
                    !char.feats.some(
                        (f) => (typeof f === 'string' ? f : f.name || '').toLowerCase() === fName.toLowerCase()
                    )
                ) {
                    char.feats.push(fName);
                }
            });

            const hasFeatMatch = (term) =>
                allSelectedFeatNames.some((f) => (f || '').toLowerCase().includes(term.toLowerCase()));

            // Alert: +5 Initiative
            if (hasFeatMatch('alert')) {
                if (
                    !char.skillToggles.some(
                        (t) => t.id === 'tog_alert' || (t.name || '').toLowerCase().includes('alert')
                    )
                ) {
                    char.skillToggles.push({
                        id: 'tog_alert',
                        name: 'Alert (+5 Initiative)',
                        target: 'initiative',
                        formula: '+5',
                        enabled: true
                    });
                }
            }

            // Observant: +5 Passive Perception & +5 Passive Investigation
            if (hasFeatMatch('observant')) {
                if (!char.skillToggles.some((t) => t.id === 'tog_observant_perc')) {
                    char.skillToggles.push({
                        id: 'tog_observant_perc',
                        name: 'Observant (+5 Passive Perception)',
                        target: 'passive_perception',
                        formula: '+5',
                        enabled: true
                    });
                }
                if (!char.skillToggles.some((t) => t.id === 'tog_observant_inv')) {
                    char.skillToggles.push({
                        id: 'tog_observant_inv',
                        name: 'Observant (+5 Passive Investigation)',
                        target: 'passive_investigation',
                        formula: '+5',
                        enabled: true
                    });
                }
            }

            // Great Weapon Master: -5 Atk / +10 Dmg
            if (hasFeatMatch('great weapon master')) {
                if (!char.attackSettings.toggles.some((t) => t.id === 'tog_gwm_atk')) {
                    char.attackSettings.toggles.push({
                        id: 'tog_gwm_atk',
                        name: 'GWM (-5 Attack)',
                        target: 'atk',
                        formula: '-5',
                        enabled: false
                    });
                }
                if (!char.attackSettings.toggles.some((t) => t.id === 'tog_gwm_dmg')) {
                    char.attackSettings.toggles.push({
                        id: 'tog_gwm_dmg',
                        name: 'GWM (+10 Damage)',
                        target: 'dmg',
                        formula: '+10',
                        enabled: false
                    });
                }
            }

            // Sharpshooter: -5 Atk / +10 Dmg
            if (hasFeatMatch('sharpshooter')) {
                if (!char.attackSettings.toggles.some((t) => t.id === 'tog_ss_atk')) {
                    char.attackSettings.toggles.push({
                        id: 'tog_ss_atk',
                        name: 'Sharpshooter (-5 Attack)',
                        target: 'atk',
                        formula: '-5',
                        enabled: false
                    });
                }
                if (!char.attackSettings.toggles.some((t) => t.id === 'tog_ss_dmg')) {
                    char.attackSettings.toggles.push({
                        id: 'tog_ss_dmg',
                        name: 'Sharpshooter (+10 Damage)',
                        target: 'dmg',
                        formula: '+10',
                        enabled: false
                    });
                }
            }

            // Fighting Styles (Dueling, Archery, Blind Fighting)
            const allAbCardNames = (char.abilityCards || []).map((a) => (a.name || '').toLowerCase());
            const hasStyle = (name) => allAbCardNames.some((c) => c.includes(name.toLowerCase()));

            if (hasStyle('dueling')) {
                if (!char.attackSettings.toggles.some((t) => t.id === 'tog_dueling')) {
                    char.attackSettings.toggles.push({
                        id: 'tog_dueling',
                        name: 'Dueling (+2 Melee Damage)',
                        target: 'dmg',
                        formula: '+2',
                        enabled: true
                    });
                }
            }
            if (hasStyle('archery')) {
                if (!char.attackSettings.toggles.some((t) => t.id === 'tog_archery')) {
                    char.attackSettings.toggles.push({
                        id: 'tog_archery',
                        name: 'Archery (+2 Ranged Attack)',
                        target: 'atk',
                        formula: '+2',
                        enabled: true
                    });
                }
            }
            if (hasStyle('blind fighting')) {
                char.senses = char.senses || {};
                char.senses.blindsight = Math.max(parseInt(char.senses.blindsight) || 0, 10);
            }
            if (hasStyle("devil's sight") || hasStyle('eyes of the dark')) {
                char.senses = char.senses || {};
                char.senses.darkvision = Math.max(parseInt(char.senses.darkvision) || 0, 120);
            }

            // Class Initiative Bonuses
            const pb = getProfBonus(char.level);
            (char.classes || []).forEach((c) => {
                const cName = (c.name || '').toLowerCase();
                const sub = (c.subclass || '').toLowerCase();
                const lvl = parseInt(c.level) || 1;

                // Swashbuckler (Rogue lvl >= 3): Rakish Audacity (+CHA)
                if (cName.includes('rogue') && sub.includes('swashbuckler') && lvl >= 3) {
                    const chaMod = getMod(char.stats?.cha || 10);
                    if (!char.skillToggles.some((t) => t.id === 'tog_rakish_audacity')) {
                        char.skillToggles.push({
                            id: 'tog_rakish_audacity',
                            name: 'Rakish Audacity (+CHA Initiative)',
                            target: 'initiative',
                            formula: (chaMod >= 0 ? '+' : '') + chaMod,
                            enabled: true
                        });
                    }
                }
                // Gloom Stalker (Ranger lvl >= 3): Dread Ambusher (+WIS)
                if (cName.includes('ranger') && sub.includes('gloom') && lvl >= 3) {
                    const wisMod = getMod(char.stats?.wis || 10);
                    if (!char.skillToggles.some((t) => t.id === 'tog_dread_ambusher')) {
                        char.skillToggles.push({
                            id: 'tog_dread_ambusher',
                            name: 'Dread Ambusher (+WIS Initiative)',
                            target: 'initiative',
                            formula: (wisMod >= 0 ? '+' : '') + wisMod,
                            enabled: true
                        });
                    }
                }
                // War Magic (Wizard lvl >= 2): Tactical Wit (+INT)
                if (cName.includes('wizard') && sub.includes('war') && lvl >= 2) {
                    const intMod = getMod(char.stats?.int || 10);
                    if (!char.skillToggles.some((t) => t.id === 'tog_tactical_wit')) {
                        char.skillToggles.push({
                            id: 'tog_tactical_wit',
                            name: 'Tactical Wit (+INT Initiative)',
                            target: 'initiative',
                            formula: (intMod >= 0 ? '+' : '') + intMod,
                            enabled: true
                        });
                    }
                }
                // Chronurgy (Wizard lvl >= 2): Temporal Awareness (+INT)
                if (cName.includes('wizard') && sub.includes('chronurgy') && lvl >= 2) {
                    const intMod = getMod(char.stats?.int || 10);
                    if (!char.skillToggles.some((t) => t.id === 'tog_temporal_awareness')) {
                        char.skillToggles.push({
                            id: 'tog_temporal_awareness',
                            name: 'Temporal Awareness (+INT Initiative)',
                            target: 'initiative',
                            formula: (intMod >= 0 ? '+' : '') + intMod,
                            enabled: true
                        });
                    }
                }
                // Bard (lvl >= 2): Jack of All Trades (+Half PB)
                if (cName.includes('bard') && lvl >= 2) {
                    const halfPb = Math.floor(pb / 2);
                    if (!char.skillToggles.some((t) => t.id === 'tog_jack_of_all_trades')) {
                        char.skillToggles.push({
                            id: 'tog_jack_of_all_trades',
                            name: 'Jack of All Trades (+Half PB Initiative)',
                            target: 'initiative',
                            formula: '+' + halfPb,
                            enabled: true
                        });
                    }
                }
                // Champion (Fighter lvl >= 7): Remarkable Athlete (+Half PB)
                if (cName.includes('fighter') && sub.includes('champion') && lvl >= 7) {
                    const halfPb = Math.ceil(pb / 2);
                    if (!char.skillToggles.some((t) => t.id === 'tog_remarkable_athlete')) {
                        char.skillToggles.push({
                            id: 'tog_remarkable_athlete',
                            name: 'Remarkable Athlete (+Half PB Initiative)',
                            target: 'initiative',
                            formula: '+' + halfPb,
                            enabled: true
                        });
                    }
                }
            });

            // 7. Import Equipment & Gold
            char.containers = char.containers || [];
            if (!char.containers.some((c) => c.id === 'cnt_backpack')) {
                char.containers.push({
                    id: 'cnt_backpack',
                    name: 'Backpack',
                    icon: 'fa-box-archive',
                    weightRule: 'standard',
                    customWeight: 5,
                    collapsed: false
                });
            }
            if (!char.containers.some((c) => c.id === 'cnt_belt')) {
                char.containers.push({
                    id: 'cnt_belt',
                    name: 'Belt / Sheath',
                    icon: 'fa-shield',
                    weightRule: 'standard',
                    customWeight: 0,
                    collapsed: false
                });
            }

            function importCleanEquipmentItem(rawName, explicitQty = null, explicitType = null) {
                if (!rawName) return;
                const rawLower = rawName.toLowerCase();
                const goldMatch =
                    rawName.match(/starting gold\s*\((\d+)\s*gp\)/i) ||
                    rawName.match(/(\d+)\s*gp/i) ||
                    rawName.match(/(\d+)\s*gold pieces?/i) ||
                    (explicitType === 'Currency' && rawName.match(/(\d+)/));
                if (
                    goldMatch ||
                    rawLower.includes('starting gold') ||
                    (explicitType === 'Currency' && rawLower.includes('gp'))
                ) {
                    const goldAmt = goldMatch ? parseInt(goldMatch[1]) : explicitQty || 1;
                    char.currency = char.currency || { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };
                    char.currency.gp = (parseInt(char.currency.gp) || 0) + (goldAmt || 0);
                    return;
                }

                let clean = rawName
                    .replace(/^\([a-z0-9]+\)\s*/i, '')
                    .replace(/\s+or\s*$/i, '')
                    .replace(/\s+and\s*$/i, '')
                    .replace(/^[Aa]n?\s+/, '')
                    .replace(/\|[a-z0-9_]+/gi, '')
                    .trim();

                let qty = explicitQty;
                const qtyMatch = clean.match(/^(\d+)\s+(.+)$/);
                if (qtyMatch) {
                    if (qty === null) qty = parseInt(qtyMatch[1]) || 1;
                    clean = qtyMatch[2].trim();
                } else if (clean.toLowerCase().startsWith('two ')) {
                    if (qty === null) qty = 2;
                    clean = clean.slice(4).trim();
                } else if (clean.toLowerCase().startsWith('three ')) {
                    if (qty === null) qty = 3;
                    clean = clean.slice(6).trim();
                }
                if (qty === null || isNaN(qty) || qty < 1) qty = 1;

                if (clean.toLowerCase() === 'daggers') clean = 'Dagger';
                if (clean.toLowerCase() === 'javelins') clean = 'Javelin';
                if (clean.toLowerCase() === 'handaxes') clean = 'Handaxe';

                const itemsList = builderCache?.items || [];
                const cleanLower = clean.toLowerCase();
                const cleanAlpha = cleanLower.replace(/[^a-z0-9]/g, '');

                const match = itemsList.find((it) => {
                    const itLower = (it.name || '').toLowerCase();
                    return itLower === cleanLower || itLower.replace(/[^a-z0-9]/g, '') === cleanAlpha;
                });

                let name = match ? match.name : clean.replace(/\b\w/g, (l) => l.toUpperCase());
                let type = match && match.type ? match.type : explicitType || null;
                let rawType = match ? match.rawType : null;
                let weight = match && match.weight !== null && match.weight !== undefined ? match.weight : 0;
                let isArmor = match ? !!match.isArmor : explicitType === 'Armor' || explicitType === 'Shield';
                let isWeapon = match ? !!match.isWeapon : explicitType === 'Weapon';
                let ac = match && match.ac ? match.ac : null;
                let bonusAc = match && match.bonusAc ? match.bonusAc : null;
                let desc = match ? match.descriptionMarkdown || match.descriptionHtml || '' : '';

                const nameLower = name.toLowerCase();
                if (
                    !isArmor &&
                    (nameLower.includes('armor') ||
                        nameLower.includes('mail') ||
                        nameLower.includes('plate') ||
                        nameLower.includes('leather'))
                ) {
                    isArmor = true;
                }
                if (!rawType) {
                    if (
                        nameLower.includes('chain mail') ||
                        nameLower.includes('plate') ||
                        nameLower.includes('splint') ||
                        nameLower.includes('ring mail')
                    )
                        rawType = 'HA';
                    else if (
                        nameLower.includes('chain shirt') ||
                        nameLower.includes('scale mail') ||
                        nameLower.includes('breastplate') ||
                        nameLower.includes('half plate') ||
                        nameLower.includes('hide')
                    )
                        rawType = 'MA';
                    else if (nameLower.includes('leather') || nameLower.includes('padded')) rawType = 'LA';
                    else if (nameLower.includes('shield')) rawType = 'S';
                }
                if (!ac) {
                    if (nameLower.includes('leather armor') || nameLower.includes('padded armor')) {
                        ac = 11;
                        if (!weight) weight = 10;
                        if (!type) type = 'Light Armor';
                    } else if (nameLower.includes('studded leather') || nameLower.includes('hide armor')) {
                        ac = 12;
                        if (!weight) weight = 13;
                        if (!type) type = 'Light Armor';
                    } else if (nameLower.includes('chain shirt')) {
                        ac = 13;
                        if (!weight) weight = 20;
                        if (!type) type = 'Medium Armor';
                    } else if (
                        nameLower.includes('scale mail') ||
                        nameLower.includes('breastplate') ||
                        nameLower.includes('ring mail')
                    ) {
                        ac = 14;
                        if (!weight) weight = 45;
                        if (!type) type = 'Medium Armor';
                    } else if (nameLower.includes('half plate')) {
                        ac = 15;
                        if (!weight) weight = 40;
                        if (!type) type = 'Medium Armor';
                    } else if (nameLower.includes('chain mail')) {
                        ac = 16;
                        if (!weight) weight = 55;
                        if (!type) type = 'Heavy Armor';
                    } else if (nameLower.includes('splint')) {
                        ac = 17;
                        if (!weight) weight = 60;
                        if (!type) type = 'Heavy Armor';
                    } else if (nameLower.includes('plate armor') || nameLower === 'plate') {
                        ac = 18;
                        if (!weight) weight = 65;
                        if (!type) type = 'Heavy Armor';
                    }
                }
                if (!type) {
                    if (isArmor) type = 'Armor';
                    else if (nameLower.includes('shield')) type = 'Shield';
                    else if (
                        isWeapon ||
                        nameLower.includes('sword') ||
                        nameLower.includes('dagger') ||
                        nameLower.includes('axe') ||
                        nameLower.includes('mace') ||
                        nameLower.includes('hammer') ||
                        nameLower.includes('bow') ||
                        nameLower.includes('crossbow') ||
                        nameLower.includes('spear') ||
                        nameLower.includes('staff') ||
                        nameLower.includes('glaive') ||
                        nameLower.includes('halberd') ||
                        nameLower.includes('pike') ||
                        nameLower.includes('rapier') ||
                        nameLower.includes('scimitar')
                    ) {
                        type = 'Weapon';
                        isWeapon = true;
                    } else {
                        type = 'Gear';
                    }
                }

                let containerId = null;
                let equipped = false;
                if (isArmor || type.toLowerCase().includes('armor') || type.toLowerCase().includes('shield')) {
                    containerId = null;
                    equipped = true;
                } else if (
                    isWeapon ||
                    type.toLowerCase().includes('weapon') ||
                    nameLower.includes('focus') ||
                    nameLower.includes('symbol') ||
                    nameLower.includes('component pouch')
                ) {
                    containerId = 'cnt_belt';
                    equipped = true;
                } else {
                    containerId = 'cnt_backpack';
                    equipped = false;
                }

                const newEq = {
                    id: 'eq_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                    name: name,
                    qty: qty,
                    weight: weight,
                    type: type,
                    rawType: rawType,
                    ac: ac,
                    bonusAc: bonusAc,
                    isArmor: isArmor,
                    isWeapon: isWeapon,
                    containerId: containerId,
                    equipped: equipped,
                    description: desc
                };
                char.equipment.push(newEq);

                if (workingChar.autoWeaponMacros && (isWeapon || newEq.type.toLowerCase().includes('weapon'))) {
                    generateWeaponMacro(char, newEq, match || { name: name });
                }
            }

            if (workingChar.useStartingWealth) {
                char.currency = char.currency || { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };
                char.currency.gp = (parseInt(char.currency.gp) || 0) + workingChar.startingGoldAmount;
            } else {
                const checkedItems = candidateBgItems.filter((i) => i.checked);
                checkedItems.forEach((it) => {
                    if (it.isGold || it.type === 'Currency') {
                        char.currency = char.currency || { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };
                        char.currency.gp = (parseInt(char.currency.gp) || 0) + (it.goldAmount || it.qty || 0);
                    } else {
                        importCleanEquipmentItem(it.name, it.qty, it.type);
                    }
                });

                classEquipChoiceSets.forEach((cs) => {
                    const chosenOpt = cs.options.find((o) => o.key === cs.selectedOption) || cs.options[0];
                    if (chosenOpt && chosenOpt.label) {
                        let labelText = chosenOpt.label;
                        const isDual = /two\s+(martial|simple)\s+weapons/i.test(labelText);
                        if (isDual) {
                            const isMartial = /martial/i.test(labelText);
                            const defW = isMartial ? 'Longsword' : 'Shortsword';
                            const w1 = cs.selectedWeapon1 || defW;
                            const w2 = cs.selectedWeapon2 || defW;
                            importCleanEquipmentItem(w1);
                            importCleanEquipmentItem(w2);
                            return;
                        }
                        if (cs.selectedWeapon) {
                            labelText = labelText
                                .replace(/any martial weapon/i, cs.selectedWeapon)
                                .replace(/any simple weapon/i, cs.selectedWeapon)
                                .replace(/a martial weapon/i, cs.selectedWeapon)
                                .replace(/a simple weapon/i, cs.selectedWeapon);
                        }
                        const labelItems = labelText
                            .split(/,\s*(?:and\s+)?|\s+and\s+/i)
                            .map((s) => s.trim())
                            .filter(Boolean);
                        labelItems.forEach((itName) => {
                            importCleanEquipmentItem(itName);
                        });
                    }
                });

                classFixedItems
                    .filter((f) => f.checked)
                    .forEach((fit) => {
                        let itemName = fit.name;
                        if (
                            fit.selectedWeapon &&
                            (itemName.toLowerCase().includes('simple weapon') ||
                                itemName.toLowerCase().includes('martial weapon'))
                        ) {
                            itemName = fit.selectedWeapon;
                        }
                        importCleanEquipmentItem(itemName, fit.qty, fit.type);
                    });
            }

            // 8a. Import Candidate Innate Spells
            (candidateInnateSpells || []).forEach((isp) => {
                const sName = isp.name || isp.spell?.name;
                if (!sName) return;
                const sLvl =
                    isp.level !== undefined && isp.level !== null
                        ? parseInt(isp.level)
                        : parseInt(isp.spell?.level) || 0;
                const key = sLvl === 0 ? 'cantrip' : 'level' + sLvl;
                char.spells[key] = char.spells[key] || [];
                const exists = char.spells[key].some(
                    (existing) => (existing.name || '').toLowerCase() === sName.toLowerCase()
                );
                if (!exists) {
                    char.spells[key].push({
                        id: 'sp_innate_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                        name: sName,
                        source: isp.source || isp.spell?.source || '',
                        level: sLvl,
                        school: isp.school || isp.spell?.school || '',
                        time: isp.time || isp.spell?.castingTime || isp.spell?.time || '1 action',
                        range: isp.range || isp.spell?.range || 'Self',
                        duration: isp.duration || isp.spell?.duration || 'Instantaneous',
                        description: isp.description || isp.spell?.descriptionMarkdown || isp.spell?.description || '',
                        prepared: true,
                        innate: true,
                        origin: isp.originName || isp.sourceLabel || isp.source || 'Innate'
                    });
                }
            });

            // 8b. Import Selected Class Spells
            classSpellSections.forEach((sec) => {
                sec.spells
                    .filter((s) => s && s.checked && s.name)
                    .forEach((sp) => {
                        const spLvl = parseInt(sp.level) || 0;
                        const key = spLvl === 0 ? 'cantrip' : 'level' + spLvl;
                        char.spells[key] = char.spells[key] || [];
                        const exists = char.spells[key].some(
                            (existing) => (existing.name || '').toLowerCase() === sp.name.toLowerCase()
                        );
                        if (!exists) {
                            char.spells[key].push({
                                id: 'sp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                                name: sp.name,
                                source: sp.source || '',
                                level: spLvl,
                                school: sp.school || '',
                                time: sp.time || sp.castingTime || '1 action',
                                range: sp.range || 'Self',
                                duration: sp.duration || 'Instantaneous',
                                description: sp.description || '',
                                prepared: spLvl === 0 || sec.isDivinePrepared
                            });
                        }
                    });
            });

            // 8c. Import Selected Background Guild & College Spells
            (candidateBgExpandedSpells || [])
                .filter((s) => s && s.checked && s.name)
                .forEach((sp) => {
                    const spLvl = parseInt(sp.level) || 0;
                    const key = spLvl === 0 ? 'cantrip' : 'level' + spLvl;
                    char.spells[key] = char.spells[key] || [];
                    const exists = char.spells[key].some(
                        (existing) => (existing.name || '').toLowerCase() === sp.name.toLowerCase()
                    );
                    if (!exists) {
                        char.spells[key].push({
                            id: 'sp_bg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                            name: sp.name,
                            source: sp.source || '',
                            level: spLvl,
                            school: sp.school || '',
                            time: sp.time || sp.castingTime || '1 action',
                            range: sp.range || 'Self',
                            duration: sp.duration || 'Instantaneous',
                            description: sp.description || '',
                            prepared: true,
                            origin: sp.originName || 'Background'
                        });
                    }
                });

            // 8d. Automatically calculate & seed 5e/2024 Multiclass & Pact Magic spell slots
            const is2024 = typeof getCharIs2024 === 'function' ? getCharIs2024(char) : false;
            const slotData = calculateCharacterSpellSlots(char.classes, is2024, char.spellSlots);
            char.spellSlots = slotData.spellSlots;

            // 9. Broadcast HP to party chat if enabled
            if (builderState.hpChatBroadcast && vtt.socket) {
                const chatMsg = `🎲 **${char.name || 'Character'}** updated character build: **${char.classes.map((c) => c.name + ' ' + c.level).join('/')}** &bull; **HP: ${char.hpMax}** &bull; **AC: ${char.ac}**`;
                vtt.socket.emit('chat:msg', { text: chatMsg });
            }

            saveAndEmit(char);
            renderSheetData(char);
            closeModal();

            if (typeof window.showToast === 'function') {
                window.showToast(`Character "${char.name}" build applied successfully!`);
            }
        } catch (err) {
            console.error('Error applying character build:', err);
            applyBtn.disabled = false;
            applyBtn.innerHTML = '<i class="fa-solid fa-check-double"></i> Save & Apply';
            if (typeof window.showToast === 'function') {
                window.showToast(`Error saving character: ${err.message}`, 'error');
            } else {
                alert(`Error saving character: ${err.message}`);
            }
        }
    };

    // Initial setup and render Step 1
    await recomputeCandidates();
    renderStepNav();
    await goToStep(1);
}
