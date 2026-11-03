/**
 * Character Builder Wizard - Step 6: Feats & ASIs
 * Supports 2024 Origin Feats (Background & Human Versatile) and Class Milestones.
 * Rich sub-choice selections for Strixhaven Initiate, Magic Initiate, Fey-Touched,
 * Shadow-Touched, Artificer Initiate, Spell Sniper, and setting origin feats.
 */

export const STRIXHAVEN_COLLEGES = {
    lorehold: {
        name: 'Lorehold College',
        cantrips: ['Light', 'Sacred Flame', 'Thaumaturgy'],
        classes: ['cleric', 'wizard']
    },
    prismari: {
        name: 'Prismari College',
        cantrips: ['Fire Bolt', 'Prestidigitation', 'Ray of Frost'],
        classes: ['bard', 'sorcerer']
    },
    quandrix: {
        name: 'Quandrix College',
        cantrips: ['Druidcraft', 'Guidance', 'Mage Hand'],
        classes: ['druid', 'wizard']
    },
    silverquill: {
        name: 'Silverquill College',
        cantrips: ['Sacred Flame', 'Thaumaturgy', 'Vicious Mockery'],
        classes: ['bard', 'cleric']
    },
    witherbloom: {
        name: 'Witherbloom College',
        cantrips: ['Chill Touch', 'Druidcraft', 'Spare the Dying'],
        classes: ['druid', 'wizard']
    }
};

export const HIGH_SORCERY_MOONS = {
    nuitari: {
        name: 'Nuitari (Black Robes)',
        cantrips: ['Chill Touch', 'Ray of Sickness', 'Toll the Dead'],
        schools: ['necromancy', 'enchantment']
    },
    lunitari: {
        name: 'Lunitari (Red Robes)',
        cantrips: ['Dancing Lights', 'Minor Illusion', 'Prestidigitation'],
        schools: ['illusion', 'transmutation']
    },
    solinari: {
        name: 'Solinari (White Robes)',
        cantrips: ['Light', 'Message', 'Sacred Flame'],
        schools: ['abjuration', 'divination']
    }
};

export const RUNE_SHAPER_SPELLS = [
    'Armor of Agathys',
    'Command',
    'Disguise Self',
    'Entangle',
    'Fog Cloud',
    'Guiding Bolt',
    'Longstrider',
    'Speak with Animals'
];

export const OUTER_PLANES = {
    lawful: { name: 'Lawful Outer Plane (Mechanus/Celestia)', cantrip: 'Guidance', resistance: 'Force' },
    chaotic: { name: 'Chaotic Outer Plane (Limbo/Abyss)', cantrip: 'Minor Illusion', resistance: 'Poison' },
    evil: { name: 'Evil Outer Plane (Nine Hells/Hades)', cantrip: 'Chill Touch', resistance: 'Necrotic' },
    good: { name: 'Good Outer Plane (Elysium/Arborea)', cantrip: 'Sacred Flame', resistance: 'Radiant' },
    neutral: { name: 'Neutral Outer Plane (The Outlands)', cantrip: 'Mage Hand', resistance: 'Psychic' }
};

export const GIANT_STRIKES = {
    'Cloud Strike': {
        damage: '1d4',
        type: 'thunder',
        save: 'Wisdom',
        desc: 'Target takes an extra 1d4 thunder damage and must succeed on a WIS save or you become invisible to it until the start of your next turn.'
    },
    'Fire Strike': { damage: '1d10', type: 'fire', save: null, desc: 'Target takes an extra 1d10 fire damage.' },
    'Frost Strike': {
        damage: '1d6',
        type: 'cold',
        save: 'Constitution',
        desc: 'Target takes an extra 1d6 cold damage and must succeed on a CON save or its speed is reduced to 0 until the start of your next turn.'
    },
    'Hill Strike': {
        damage: '1d6',
        type: 'weapon',
        save: 'Strength',
        desc: "Target takes an extra 1d6 damage of the weapon's type and must succeed on a STR save or have the prone condition."
    },
    'Stone Strike': {
        damage: '1d6',
        type: 'force',
        save: 'Strength',
        desc: 'Target takes an extra 1d6 force damage and must succeed on a STR save or be pushed 10 feet from you in a straight line.'
    },
    'Storm Strike': {
        damage: '1d6',
        type: 'lightning',
        save: 'Constitution',
        desc: 'Target takes an extra 1d6 lightning damage and must succeed on a CON save or have disadvantage on attack rolls until the start of your next turn.'
    }
};

export const STANDARD_5E_SKILLS = [
    'Acrobatics',
    'Animal Handling',
    'Arcana',
    'Athletics',
    'Deception',
    'History',
    'Insight',
    'Intimidation',
    'Investigation',
    'Medicine',
    'Nature',
    'Perception',
    'Performance',
    'Persuasion',
    'Religion',
    'Sleight of Hand',
    'Stealth',
    'Survival'
];

export const STANDARD_5E_TOOLS = [
    "Thieves' Tools",
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
    "Woodcarver's Tools",
    'Disguise Kit',
    'Forgery Kit',
    'Herbalism Kit',
    "Navigator's Tools",
    "Poisoner's Kit"
];

export const STANDARD_5E_LANGUAGES = [
    'Common',
    'Dwarvish',
    'Elvish',
    'Giant',
    'Gnomish',
    'Goblin',
    'Halfling',
    'Orc',
    'Abyssal',
    'Celestial',
    'Draconic',
    'Deep Speech',
    'Infernal',
    'Primordial',
    'Sylvan',
    'Undercommon'
];

export function renderStep7(ctx) {
    const {
        bodyEl,
        asiTiers,
        builderCache,
        disabledSources,
        isSourceAllowed,
        recomputeCandidates,
        updateCountsDisplay
    } = ctx;
    const rawFeats = (builderCache?.feats || [])
        .filter((f) => isSourceAllowed(f.source, f.name, disabledSources))
        .sort((a, b) => a.name.localeCompare(b.name));
    const statList = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

    bodyEl.innerHTML = `
        ${
            asiTiers.length === 0
                ? `
            <div class="builder-section-box" style="text-align:center; padding:30px 20px;">
                <i class="fa-solid fa-trophy" style="font-size:2rem; color:var(--color-gold-base); margin-bottom:12px; opacity:0.6;"></i>
                <h4 style="color:var(--color-gold-light); margin:0 0 6px 0;">No Milestone ASIs / Feats Unlocked Yet</h4>
                <div style="font-size:0.85rem; color:var(--color-text-muted); max-width:480px; margin:0 auto;">
                    Ability Score Improvements and Feats unlock at class milestones (e.g., Level 4, 8, 12, 16, 19) or from Background Origin Feats. You can level up in Step 1 or select a background that grants a bonus feat to unlock them.
                </div>
            </div>
        `
                : `
            <div style="display:flex; flex-direction:column; gap:12px;">
                ${asiTiers
                    .map((tier, tIdx) => {
                        const isOrigin = !!tier.isOrigin;
                        const eligibleFeats = isOrigin
                            ? rawFeats.filter((f) => {
                                  const nameLow = (f.name || '').toLowerCase();
                                  const isKnownOrigin = [
                                      'alert',
                                      'crafter',
                                      'healer',
                                      'lucky',
                                      'magic initiate',
                                      'musician',
                                      'savage attacker',
                                      'skilled',
                                      'tavern brawler',
                                      'tough',
                                      'strixhaven initiate',
                                      'strike of the giants',
                                      'rune shaper',
                                      'scion of the outer planes',
                                      'squire of solamnia',
                                      'initiate of high sorcery'
                                  ].some((n) => nameLow.startsWith(n));
                                  const hasOriginTag =
                                      f.category === 'Origin' ||
                                      (f.entries && JSON.stringify(f.entries).toLowerCase().includes('origin feat'));
                                  return isKnownOrigin || hasOriginTag;
                              })
                            : rawFeats;

                        return `
                    <div class="builder-section-box" style="${isOrigin ? 'border-left:3px solid #059669;' : ''}">
                        <div class="builder-section-header">
                            <div style="display:flex; align-items:center; gap:8px;">
                                <i class="fa-solid ${isOrigin ? 'fa-sparkles text-gradient-gold' : 'fa-award text-gradient-gold'}"></i>
                                <strong style="font-size:0.95rem; color:var(--color-gold-base);">${tier.className} ${tier.level ? `(Level ${tier.level})` : ''}</strong>
                                ${isOrigin ? `<span class="badge" style="background:#059669; color:#fff; font-size:0.7rem; padding:2px 8px; border-radius:4px;">Origin Feat</span>` : ''}
                            </div>
                            ${
                                !isOrigin
                                    ? `
                                <div style="display:flex; gap:6px;">
                                    <button type="button" class="btn ${tier.choice === 'asi' ? 'btn-primary' : 'btn-secondary'} btn-xxs pc-wiz-tier-choice" data-tidx="${tIdx}" data-choice="asi">Ability Score (+2/+1+1)</button>
                                    <button type="button" class="btn ${tier.choice === 'feat' ? 'btn-primary' : 'btn-secondary'} btn-xxs pc-wiz-tier-choice" data-tidx="${tIdx}" data-choice="feat">Select a Feat</button>
                                </div>
                            `
                                    : ''
                            }
                        </div>

                        ${
                            tier.choice === 'asi' && !isOrigin
                                ? `
                            <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap; background:rgba(0,0,0,0.25); padding:8px 12px; border-radius:6px;">
                                <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
                                    <input type="radio" name="asi_mode_${tIdx}" class="pc-wiz-tier-asimode" data-tidx="${tIdx}" value="plus2" ${tier.asiMode === 'plus2' ? 'checked' : ''}>
                                    <span style="font-size:0.85rem; color:var(--color-text-primary);">+2 to One Stat</span>
                                </label>
                                <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
                                    <input type="radio" name="asi_mode_${tIdx}" class="pc-wiz-tier-asimode" data-tidx="${tIdx}" value="plus1plus1" ${tier.asiMode === 'plus1plus1' ? 'checked' : ''}>
                                    <span style="font-size:0.85rem; color:var(--color-text-primary);">+1 to Two Stats</span>
                                </label>
                            </div>
                            <div style="display:flex; gap:12px; margin-top:10px; flex-wrap:wrap;">
                                <div style="flex:1; min-width:140px;">
                                    <label style="font-size:0.75rem; color:var(--color-text-muted);">${tier.asiMode === 'plus2' ? 'Add +2 To:' : 'First +1 Stat:'}</label>
                                    <select class="pc-wiz-tier-stat1" data-tidx="${tIdx}" style="width:100%; padding:6px; font-size:0.85rem; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                                        <option value="" ${!tier.stat1 ? 'selected' : ''}>-- Choose Stat --</option>
                                        ${statList.map((st) => `<option value="${st}" ${tier.stat1 === st ? 'selected' : ''}>${st.toUpperCase()}</option>`).join('')}
                                    </select>
                                </div>
                                ${
                                    tier.asiMode === 'plus1plus1'
                                        ? `
                                    <div style="flex:1; min-width:140px;">
                                        <label style="font-size:0.75rem; color:var(--color-text-muted);">Second +1 Stat:</label>
                                        <select class="pc-wiz-tier-stat2" data-tidx="${tIdx}" style="width:100%; padding:6px; font-size:0.85rem; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                                            <option value="" ${!tier.stat2 ? 'selected' : ''}>-- Choose Stat --</option>
                                            ${statList.map((st) => `<option value="${st}" ${tier.stat2 === st ? 'selected' : ''}>${st.toUpperCase()}</option>`).join('')}
                                        </select>
                                    </div>
                                `
                                        : ''
                                }
                            </div>
                        `
                                : tier.choice === 'unselected' && !isOrigin
                                  ? `
                            <div style="padding:10px 14px; background:rgba(0,0,0,0.2); border:1px dashed var(--color-border-subtle); border-radius:6px; font-size:0.85rem; color:var(--color-text-muted); text-align:center;">
                                <i class="fa-solid fa-circle-question" style="color:var(--color-gold-base); margin-right:6px;"></i> Please choose whether to increase <strong>Ability Scores</strong> or select a <strong>Feat</strong> using the buttons above.
                            </div>
                        `
                                  : `
                            <!-- Feat Selector -->
                            <div style="display:flex; flex-direction:column; gap:8px;">
                                <select class="pc-tier-feat-sel" data-tidx="${tIdx}" style="width:100%; padding:8px 10px; font-size:0.85rem; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                                    <option value="">-- Choose Feat --</option>
                                    ${eligibleFeats
                                        .map((f) => {
                                            const fId = f.id || f.name.replace(/\W+/g, '_').toLowerCase();
                                            return `<option value="${fId}" ${tier.selectedFeatId === fId ? 'selected' : ''}>${f.name} [${f.source || 'PHB'}]</option>`;
                                        })
                                        .join('')}
                                </select>

                                ${
                                    tier.selectedFeatId
                                        ? (function () {
                                              const matchedFeat = rawFeats.find(
                                                  (f) =>
                                                      (f.id || f.name.replace(/\W+/g, '_').toLowerCase()) ===
                                                      tier.selectedFeatId
                                              );
                                              if (!matchedFeat) return '';
                                              const featNameLow = matchedFeat.name.toLowerCase();

                                              let subChoiceHtml = '';

                                              // Half-Feat Stat Selection
                                              const isHalfFeat =
                                                  matchedFeat.isHalfFeat ||
                                                  matchedFeat.abilityBonus ||
                                                  /touched|telekinetic|telepathic|resilient/i.test(featNameLow);
                                              if (isHalfFeat) {
                                                  let allowedStats = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
                                                  const chooseList =
                                                      matchedFeat.abilityBonus?.chooseFrom ||
                                                      matchedFeat.abilityBonus?.choose;
                                                  if (Array.isArray(chooseList) && chooseList.length > 0) {
                                                      allowedStats = chooseList;
                                                  } else if (
                                                      /fey[- ]touched|shadow[- ]touched|telekinetic|telepathic/i.test(
                                                          featNameLow
                                                      )
                                                  ) {
                                                      allowedStats = ['int', 'wis', 'cha'];
                                                  }
                                                  const curHalfStat =
                                                      tier.halfFeatStat ||
                                                      tier.featSubChoices?.halfFeatStat ||
                                                      allowedStats[0] ||
                                                      'str';
                                                  if (!tier.halfFeatStat) tier.halfFeatStat = curHalfStat;
                                                  tier.featSubChoices = tier.featSubChoices || {};
                                                  tier.featSubChoices.halfFeatStat = curHalfStat;

                                                  subChoiceHtml += `
                                                    <div style="background:rgba(212,175,55,0.08); border:1px solid rgba(212,175,55,0.25); padding:8px 10px; border-radius:6px; margin-top:6px; display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                                                        <span class="badge" style="background:var(--color-gold-base); color:#000; font-size:0.7rem; font-weight:700;"><i class="fa-solid fa-arrow-up"></i> Half-Feat (+1 Stat)</span>
                                                        <span style="font-size:0.78rem; color:var(--color-gold-light);">Ability Score to increase:</span>
                                                        <select class="pc-tier-feat-halfstat-sel" data-tidx="${tIdx}" style="padding:3px 8px; font-size:0.8rem; background:#1e1e1e; color:#fff; border:1px solid var(--color-border-subtle); border-radius:4px;">
                                                            ${allowedStats.map((st) => `<option value="${st}" ${curHalfStat === st ? 'selected' : ''}>${st.toUpperCase()} (+1)</option>`).join('')}
                                                        </select>
                                                    </div>
                                                `;
                                              }

                                              // 1. Magic Initiate Sub-Choice
                                              if (/magic initiate/i.test(featNameLow)) {
                                                  const spellClass = tier.featSubChoices?.spellClass || 'wizard';
                                                  const cantrips = (builderCache?.spells || []).filter(
                                                      (s) =>
                                                          parseInt(s.level) === 0 &&
                                                          (s.classes || []).some((cl) =>
                                                              cl.toLowerCase().includes(spellClass)
                                                          )
                                                  );
                                                  const lvl1Spells = (builderCache?.spells || []).filter(
                                                      (s) =>
                                                          parseInt(s.level) === 1 &&
                                                          (s.classes || []).some((cl) =>
                                                              cl.toLowerCase().includes(spellClass)
                                                          )
                                                  );
                                                  const curAbility =
                                                      tier.featSubChoices?.abilityScore ||
                                                      (spellClass === 'cleric' || spellClass === 'druid'
                                                          ? 'wis'
                                                          : spellClass === 'wizard'
                                                            ? 'int'
                                                            : 'cha');
                                                  tier.featSubChoices = tier.featSubChoices || {};
                                                  if (!tier.featSubChoices.abilityScore)
                                                      tier.featSubChoices.abilityScore = curAbility;

                                                  subChoiceHtml += `
                                            <div style="background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle); padding:10px; border-radius:6px; margin-top:6px; display:flex; flex-direction:column; gap:8px;">
                                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                                    <strong style="color:var(--color-gold-light); font-size:0.8rem;"><i class="fa-solid fa-wand-sparkles"></i> Magic Initiate Spell Selections:</strong>
                                                    <span class="badge" style="background:#2563eb; color:#fff; font-size:0.7rem; padding:2px 6px;">2 Cantrips + 1 1st-Level</span>
                                                </div>
                                                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:8px;">
                                                    <div>
                                                        <label style="font-size:0.75rem; color:var(--color-text-muted);">Spellcasting Class:</label>
                                                        <select class="pc-tier-feat-spellclass-sel" data-tidx="${tIdx}" style="width:100%; padding:4px; font-size:0.8rem; background:#1e1e1e; color:#fff; border:1px solid var(--color-border-subtle); border-radius:4px;">
                                                            <option value="wizard" ${spellClass === 'wizard' ? 'selected' : ''}>Wizard (INT)</option>
                                                            <option value="cleric" ${spellClass === 'cleric' ? 'selected' : ''}>Cleric (WIS)</option>
                                                            <option value="druid" ${spellClass === 'druid' ? 'selected' : ''}>Druid (WIS)</option>
                                                            <option value="sorcerer" ${spellClass === 'sorcerer' ? 'selected' : ''}>Sorcerer (CHA)</option>
                                                            <option value="warlock" ${spellClass === 'warlock' ? 'selected' : ''}>Warlock (CHA)</option>
                                                            <option value="bard" ${spellClass === 'bard' ? 'selected' : ''}>Bard (CHA)</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label style="font-size:0.75rem; color:var(--color-text-muted);">Spellcasting Ability:</label>
                                                        <select class="pc-tier-feat-ability-sel" data-tidx="${tIdx}" style="width:100%; padding:4px; font-size:0.8rem; background:#1e1e1e; color:#fff; border:1px solid var(--color-border-subtle); border-radius:4px;">
                                                            <option value="int" ${curAbility === 'int' ? 'selected' : ''}>Intelligence (INT)</option>
                                                            <option value="wis" ${curAbility === 'wis' ? 'selected' : ''}>Wisdom (WIS)</option>
                                                            <option value="cha" ${curAbility === 'cha' ? 'selected' : ''}>Charisma (CHA)</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label style="font-size:0.75rem; color:var(--color-text-muted);">Cantrip 1:</label>
                                                        <select class="pc-tier-feat-spell-sel" data-tidx="${tIdx}" data-field="cantrip1" style="width:100%; padding:4px; font-size:0.8rem; background:#1e1e1e; color:#fff; border:1px solid var(--color-border-subtle); border-radius:4px;">
                                                            <option value="">-- Choose Cantrip --</option>
                                                            ${cantrips.map((s) => `<option value="${s.name}" ${tier.featSubChoices?.cantrip1 === s.name ? 'selected' : ''}>${s.name}</option>`).join('')}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label style="font-size:0.75rem; color:var(--color-text-muted);">Cantrip 2:</label>
                                                        <select class="pc-tier-feat-spell-sel" data-tidx="${tIdx}" data-field="cantrip2" style="width:100%; padding:4px; font-size:0.8rem; background:#1e1e1e; color:#fff; border:1px solid var(--color-border-subtle); border-radius:4px;">
                                                            <option value="">-- Choose Cantrip --</option>
                                                            ${cantrips.map((s) => `<option value="${s.name}" ${tier.featSubChoices?.cantrip2 === s.name ? 'selected' : ''}>${s.name}</option>`).join('')}
                                                        </select>
                                                    </div>
                                                    <div style="grid-column:1 / -1;">
                                                        <label style="font-size:0.75rem; color:var(--color-text-muted);">1st Level Spell:</label>
                                                        <select class="pc-tier-feat-spell-sel" data-tidx="${tIdx}" data-field="spell1" style="width:100%; padding:4px; font-size:0.8rem; background:#1e1e1e; color:#fff; border:1px solid var(--color-border-subtle); border-radius:4px;">
                                                            <option value="">-- Choose 1st Level Spell --</option>
                                                            ${lvl1Spells.map((s) => `<option value="${s.name}" ${tier.featSubChoices?.spell1 === s.name ? 'selected' : ''}>${s.name}</option>`).join('')}
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>
                                        `;
                                              }
                                              // 2. Strixhaven Initiate Sub-Choice
                                              else if (/strixhaven initiate/i.test(featNameLow)) {
                                                  // Detect if locked/recommended by background (e.g. Lorehold Student)
                                                  let defaultCol = 'lorehold';
                                                  const bgNameLow = (tier.className || '').toLowerCase();
                                                  if (bgNameLow.includes('prismari')) defaultCol = 'prismari';
                                                  else if (bgNameLow.includes('quandrix')) defaultCol = 'quandrix';
                                                  else if (bgNameLow.includes('silverquill'))
                                                      defaultCol = 'silverquill';
                                                  else if (bgNameLow.includes('witherbloom'))
                                                      defaultCol = 'witherbloom';

                                                  const curCol = tier.featSubChoices?.college || defaultCol;
                                                  tier.featSubChoices = tier.featSubChoices || {};
                                                  tier.featSubChoices.college = curCol;

                                                  const colData =
                                                      STRIXHAVEN_COLLEGES[curCol] || STRIXHAVEN_COLLEGES.lorehold;
                                                  const eligibleCantrips = colData.cantrips;
                                                  const eligibleClasses = colData.classes;

                                                  const lvl1Spells = (builderCache?.spells || []).filter(
                                                      (s) =>
                                                          parseInt(s.level) === 1 &&
                                                          (s.classes || []).some((cl) =>
                                                              eligibleClasses.includes(cl.toLowerCase())
                                                          )
                                                  );

                                                  const curAbility = tier.featSubChoices?.abilityScore || 'int';
                                                  tier.featSubChoices.abilityScore = curAbility;

                                                  subChoiceHtml += `
                                            <div style="background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle); padding:10px; border-radius:6px; margin-top:6px; display:flex; flex-direction:column; gap:8px;">
                                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                                    <strong style="color:var(--color-gold-light); font-size:0.8rem;"><i class="fa-solid fa-graduation-cap"></i> Strixhaven Initiate Spell Selections:</strong>
                                                    <span class="badge" style="background:#7c3aed; color:#fff; font-size:0.7rem; padding:2px 6px;">2 Cantrips + 1 1st-Level</span>
                                                </div>
                                                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:8px;">
                                                    <div>
                                                        <label style="font-size:0.75rem; color:var(--color-text-muted);">College:</label>
                                                        <select class="pc-tier-feat-college-sel" data-tidx="${tIdx}" style="width:100%; padding:4px; font-size:0.8rem; background:#1e1e1e; color:#fff; border:1px solid var(--color-border-subtle); border-radius:4px;">
                                                            <option value="lorehold" ${curCol === 'lorehold' ? 'selected' : ''}>Lorehold College</option>
                                                            <option value="prismari" ${curCol === 'prismari' ? 'selected' : ''}>Prismari College</option>
                                                            <option value="quandrix" ${curCol === 'quandrix' ? 'selected' : ''}>Quandrix College</option>
                                                            <option value="silverquill" ${curCol === 'silverquill' ? 'selected' : ''}>Silverquill College</option>
                                                            <option value="witherbloom" ${curCol === 'witherbloom' ? 'selected' : ''}>Witherbloom College</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label style="font-size:0.75rem; color:var(--color-text-muted);">Spellcasting Ability:</label>
                                                        <select class="pc-tier-feat-ability-sel" data-tidx="${tIdx}" style="width:100%; padding:4px; font-size:0.8rem; background:#1e1e1e; color:#fff; border:1px solid var(--color-border-subtle); border-radius:4px;">
                                                            <option value="int" ${curAbility === 'int' ? 'selected' : ''}>Intelligence (INT)</option>
                                                            <option value="wis" ${curAbility === 'wis' ? 'selected' : ''}>Wisdom (WIS)</option>
                                                            <option value="cha" ${curAbility === 'cha' ? 'selected' : ''}>Charisma (CHA)</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label style="font-size:0.75rem; color:var(--color-text-muted);">Cantrip 1:</label>
                                                        <select class="pc-tier-feat-spell-sel" data-tidx="${tIdx}" data-field="cantrip1" style="width:100%; padding:4px; font-size:0.8rem; background:#1e1e1e; color:#fff; border:1px solid var(--color-border-subtle); border-radius:4px;">
                                                            <option value="">-- Choose Cantrip --</option>
                                                            ${eligibleCantrips.map((s) => `<option value="${s}" ${tier.featSubChoices?.cantrip1 === s ? 'selected' : ''}>${s}</option>`).join('')}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label style="font-size:0.75rem; color:var(--color-text-muted);">Cantrip 2:</label>
                                                        <select class="pc-tier-feat-spell-sel" data-tidx="${tIdx}" data-field="cantrip2" style="width:100%; padding:4px; font-size:0.8rem; background:#1e1e1e; color:#fff; border:1px solid var(--color-border-subtle); border-radius:4px;">
                                                            <option value="">-- Choose Cantrip --</option>
                                                            ${eligibleCantrips.map((s) => `<option value="${s}" ${tier.featSubChoices?.cantrip2 === s ? 'selected' : ''}>${s}</option>`).join('')}
                                                        </select>
                                                    </div>
                                                    <div style="grid-column:1 / -1;">
                                                        <label style="font-size:0.75rem; color:var(--color-text-muted);">1st Level Spell (${eligibleClasses.join(' / ').toUpperCase()}):</label>
                                                        <select class="pc-tier-feat-spell-sel" data-tidx="${tIdx}" data-field="spell1" style="width:100%; padding:4px; font-size:0.8rem; background:#1e1e1e; color:#fff; border:1px solid var(--color-border-subtle); border-radius:4px;">
                                                            <option value="">-- Choose 1st Level Spell --</option>
                                                            ${lvl1Spells.map((s) => `<option value="${s.name}" ${tier.featSubChoices?.spell1 === s.name ? 'selected' : ''}>${s.name}</option>`).join('')}
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>
                                        `;
                                              }
                                              // 3. Fey-Touched Sub-Choice
                                              else if (/fey[- ]touched/i.test(featNameLow)) {
                                                  const divEnchSpells = (builderCache?.spells || []).filter(
                                                      (s) =>
                                                          parseInt(s.level) === 1 &&
                                                          (s.school === 'Divination' ||
                                                              s.school === 'Enchantment' ||
                                                              (s.school || '').toLowerCase().startsWith('div') ||
                                                              (s.school || '').toLowerCase().startsWith('enc'))
                                                  );
                                                  subChoiceHtml += `
                                            <div style="background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle); padding:10px; border-radius:6px; margin-top:6px; display:flex; flex-direction:column; gap:8px;">
                                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                                    <strong style="color:var(--color-gold-light); font-size:0.8rem;"><i class="fa-solid fa-sparkles"></i> Fey-Touched Granted Spells:</strong>
                                                    <span class="badge" style="background:#059669; color:#fff; font-size:0.7rem; padding:2px 6px;">Misty Step Auto-Learned</span>
                                                </div>
                                                <div>
                                                    <label style="font-size:0.75rem; color:var(--color-text-muted);">Choose 1st-Level Divination or Enchantment Spell:</label>
                                                    <select class="pc-tier-feat-spell-sel" data-tidx="${tIdx}" data-field="spell1" style="width:100%; padding:6px; font-size:0.8rem; background:#1e1e1e; color:#fff; border:1px solid var(--color-border-subtle); border-radius:4px;">
                                                        <option value="">-- Choose 1st Level Divination / Enchantment Spell --</option>
                                                        ${divEnchSpells.map((s) => `<option value="${s.name}" ${tier.featSubChoices?.spell1 === s.name ? 'selected' : ''}>${s.name} [${s.school}]</option>`).join('')}
                                                    </select>
                                                </div>
                                            </div>
                                        `;
                                              }
                                              // 4. Shadow-Touched Sub-Choice
                                              else if (/shadow[- ]touched/i.test(featNameLow)) {
                                                  const illNecSpells = (builderCache?.spells || []).filter(
                                                      (s) =>
                                                          parseInt(s.level) === 1 &&
                                                          (s.school === 'Illusion' ||
                                                              s.school === 'Necromancy' ||
                                                              (s.school || '').toLowerCase().startsWith('ill') ||
                                                              (s.school || '').toLowerCase().startsWith('nec'))
                                                  );
                                                  subChoiceHtml += `
                                            <div style="background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle); padding:10px; border-radius:6px; margin-top:6px; display:flex; flex-direction:column; gap:8px;">
                                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                                    <strong style="color:var(--color-gold-light); font-size:0.8rem;"><i class="fa-solid fa-moon"></i> Shadow-Touched Granted Spells:</strong>
                                                    <span class="badge" style="background:#7c3aed; color:#fff; font-size:0.7rem; padding:2px 6px;">Invisibility Auto-Learned</span>
                                                </div>
                                                <div>
                                                    <label style="font-size:0.75rem; color:var(--color-text-muted);">Choose 1st-Level Illusion or Necromancy Spell:</label>
                                                    <select class="pc-tier-feat-spell-sel" data-tidx="${tIdx}" data-field="spell1" style="width:100%; padding:6px; font-size:0.8rem; background:#1e1e1e; color:#fff; border:1px solid var(--color-border-subtle); border-radius:4px;">
                                                        <option value="">-- Choose 1st Level Illusion / Necromancy Spell --</option>
                                                        ${illNecSpells.map((s) => `<option value="${s.name}" ${tier.featSubChoices?.spell1 === s.name ? 'selected' : ''}>${s.name} [${s.school}]</option>`).join('')}
                                                    </select>
                                                </div>
                                            </div>
                                        `;
                                              }
                                              // 5. Artificer Initiate Sub-Choice
                                              else if (/artificer initiate/i.test(featNameLow)) {
                                                  const artCantrips = (builderCache?.spells || []).filter(
                                                      (s) =>
                                                          parseInt(s.level) === 0 &&
                                                          (s.classes || []).some((c) =>
                                                              c.toLowerCase().includes('artificer')
                                                          )
                                                  );
                                                  const artLvl1 = (builderCache?.spells || []).filter(
                                                      (s) =>
                                                          parseInt(s.level) === 1 &&
                                                          (s.classes || []).some((c) =>
                                                              c.toLowerCase().includes('artificer')
                                                          )
                                                  );
                                                  subChoiceHtml += `
                                            <div style="background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle); padding:10px; border-radius:6px; margin-top:6px; display:flex; flex-direction:column; gap:8px;">
                                                <strong style="color:var(--color-gold-light); font-size:0.8rem;"><i class="fa-solid fa-wrench"></i> Artificer Initiate Spell Selections:</strong>
                                                <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                                                    <div>
                                                        <label style="font-size:0.75rem; color:var(--color-text-muted);">Artificer Cantrip:</label>
                                                        <select class="pc-tier-feat-spell-sel" data-tidx="${tIdx}" data-field="cantrip1" style="width:100%; padding:4px; font-size:0.8rem; background:#1e1e1e; color:#fff; border:1px solid var(--color-border-subtle); border-radius:4px;">
                                                            <option value="">-- Choose Cantrip --</option>
                                                            ${artCantrips.map((s) => `<option value="${s.name}" ${tier.featSubChoices?.cantrip1 === s.name ? 'selected' : ''}>${s.name}</option>`).join('')}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label style="font-size:0.75rem; color:var(--color-text-muted);">Artificer 1st-Level Spell:</label>
                                                        <select class="pc-tier-feat-spell-sel" data-tidx="${tIdx}" data-field="spell1" style="width:100%; padding:4px; font-size:0.8rem; background:#1e1e1e; color:#fff; border:1px solid var(--color-border-subtle); border-radius:4px;">
                                                            <option value="">-- Choose 1st-Level Spell --</option>
                                                            ${artLvl1.map((s) => `<option value="${s.name}" ${tier.featSubChoices?.spell1 === s.name ? 'selected' : ''}>${s.name}</option>`).join('')}
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>
                                        `;
                                              }
                                              // 6. Spell Sniper Sub-Choice
                                              else if (/spell sniper/i.test(featNameLow)) {
                                                  const attackCantrips = (builderCache?.spells || []).filter(
                                                      (s) =>
                                                          parseInt(s.level) === 0 &&
                                                          (s.attackStat === 'spell' ||
                                                              (s.damageList && s.damageList.length > 0))
                                                  );
                                                  subChoiceHtml += `
                                            <div style="background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle); padding:10px; border-radius:6px; margin-top:6px; display:flex; flex-direction:column; gap:8px;">
                                                <strong style="color:var(--color-gold-light); font-size:0.8rem;"><i class="fa-solid fa-crosshairs"></i> Spell Sniper Attack Cantrip:</strong>
                                                <div>
                                                    <label style="font-size:0.75rem; color:var(--color-text-muted);">Choose Attack Cantrip:</label>
                                                    <select class="pc-tier-feat-spell-sel" data-tidx="${tIdx}" data-field="cantrip1" style="width:100%; padding:6px; font-size:0.8rem; background:#1e1e1e; color:#fff; border:1px solid var(--color-border-subtle); border-radius:4px;">
                                                        <option value="">-- Choose Attack Cantrip --</option>
                                                        ${attackCantrips.map((s) => `<option value="${s.name}" ${tier.featSubChoices?.cantrip1 === s.name ? 'selected' : ''}>${s.name}</option>`).join('')}
                                                    </select>
                                                </div>
                                            </div>
                                        `;
                                              }
                                              // 7. Initiate of High Sorcery
                                              else if (/initiate of high sorcery/i.test(featNameLow)) {
                                                  const curMoon = tier.featSubChoices?.moon || 'solinari';
                                                  tier.featSubChoices = tier.featSubChoices || {};
                                                  tier.featSubChoices.moon = curMoon;
                                                  const moonData =
                                                      HIGH_SORCERY_MOONS[curMoon] || HIGH_SORCERY_MOONS.solinari;
                                                  const moonSpells = (builderCache?.spells || []).filter(
                                                      (s) =>
                                                          parseInt(s.level) === 1 &&
                                                          moonData.schools.some((sc) =>
                                                              (s.school || '').toLowerCase().startsWith(sc)
                                                          )
                                                  );
                                                  subChoiceHtml += `
                                            <div style="background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle); padding:10px; border-radius:6px; margin-top:6px; display:flex; flex-direction:column; gap:8px;">
                                                <strong style="color:var(--color-gold-light); font-size:0.8rem;"><i class="fa-solid fa-moon"></i> High Sorcery Order & Spells:</strong>
                                                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:8px;">
                                                    <div>
                                                        <label style="font-size:0.75rem; color:var(--color-text-muted);">Robes / Moon:</label>
                                                        <select class="pc-tier-feat-moon-sel" data-tidx="${tIdx}" style="width:100%; padding:4px; font-size:0.8rem; background:#1e1e1e; color:#fff; border:1px solid var(--color-border-subtle); border-radius:4px;">
                                                            <option value="solinari" ${curMoon === 'solinari' ? 'selected' : ''}>Solinari (White Robes)</option>
                                                            <option value="lunitari" ${curMoon === 'lunitari' ? 'selected' : ''}>Lunitari (Red Robes)</option>
                                                            <option value="nuitari" ${curMoon === 'nuitari' ? 'selected' : ''}>Nuitari (Black Robes)</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label style="font-size:0.75rem; color:var(--color-text-muted);">Cantrip 1:</label>
                                                        <select class="pc-tier-feat-spell-sel" data-tidx="${tIdx}" data-field="cantrip1" style="width:100%; padding:4px; font-size:0.8rem; background:#1e1e1e; color:#fff; border:1px solid var(--color-border-subtle); border-radius:4px;">
                                                            <option value="">-- Choose Cantrip --</option>
                                                            ${moonData.cantrips.map((s) => `<option value="${s}" ${tier.featSubChoices?.cantrip1 === s ? 'selected' : ''}>${s}</option>`).join('')}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label style="font-size:0.75rem; color:var(--color-text-muted);">Cantrip 2:</label>
                                                        <select class="pc-tier-feat-spell-sel" data-tidx="${tIdx}" data-field="cantrip2" style="width:100%; padding:4px; font-size:0.8rem; background:#1e1e1e; color:#fff; border:1px solid var(--color-border-subtle); border-radius:4px;">
                                                            <option value="">-- Choose Cantrip --</option>
                                                            ${moonData.cantrips.map((s) => `<option value="${s}" ${tier.featSubChoices?.cantrip2 === s ? 'selected' : ''}>${s}</option>`).join('')}
                                                        </select>
                                                    </div>
                                                    <div style="grid-column:1 / -1;">
                                                        <label style="font-size:0.75rem; color:var(--color-text-muted);">1st-Level Spell (${moonData.schools.join(' / ').toUpperCase()}):</label>
                                                        <select class="pc-tier-feat-spell-sel" data-tidx="${tIdx}" data-field="spell1" style="width:100%; padding:4px; font-size:0.8rem; background:#1e1e1e; color:#fff; border:1px solid var(--color-border-subtle); border-radius:4px;">
                                                            <option value="">-- Choose 1st Level Spell --</option>
                                                            ${moonSpells.map((s) => `<option value="${s.name}" ${tier.featSubChoices?.spell1 === s.name ? 'selected' : ''}>${s.name}</option>`).join('')}
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>
                                        `;
                                              }
                                              // 8. Rune Shaper
                                              else if (/rune shaper/i.test(featNameLow)) {
                                                  subChoiceHtml += `
                                            <div style="background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle); padding:10px; border-radius:6px; margin-top:6px; display:flex; flex-direction:column; gap:8px;">
                                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                                    <strong style="color:var(--color-gold-light); font-size:0.8rem;"><i class="fa-solid fa-gem"></i> Rune Shaper Runes:</strong>
                                                    <span class="badge" style="background:#0284c7; color:#fff; font-size:0.7rem; padding:2px 6px;">Comprehend Languages Auto-Learned</span>
                                                </div>
                                                <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                                                    <div>
                                                        <label style="font-size:0.75rem; color:var(--color-text-muted);">Rune Spell 1:</label>
                                                        <select class="pc-tier-feat-spell-sel" data-tidx="${tIdx}" data-field="spell1" style="width:100%; padding:4px; font-size:0.8rem; background:#1e1e1e; color:#fff; border:1px solid var(--color-border-subtle); border-radius:4px;">
                                                            <option value="">-- Choose Rune Spell --</option>
                                                            ${RUNE_SHAPER_SPELLS.map((s) => `<option value="${s}" ${tier.featSubChoices?.spell1 === s ? 'selected' : ''}>${s}</option>`).join('')}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label style="font-size:0.75rem; color:var(--color-text-muted);">Rune Spell 2:</label>
                                                        <select class="pc-tier-feat-spell-sel" data-tidx="${tIdx}" data-field="spell2" style="width:100%; padding:4px; font-size:0.8rem; background:#1e1e1e; color:#fff; border:1px solid var(--color-border-subtle); border-radius:4px;">
                                                            <option value="">-- Choose Rune Spell --</option>
                                                            ${RUNE_SHAPER_SPELLS.map((s) => `<option value="${s}" ${tier.featSubChoices?.spell2 === s ? 'selected' : ''}>${s}</option>`).join('')}
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>
                                        `;
                                              }
                                              // 9. Scion of the Outer Planes
                                              else if (/scion of the outer planes/i.test(featNameLow)) {
                                                  const curPlane = tier.featSubChoices?.plane || 'neutral';
                                                  tier.featSubChoices = tier.featSubChoices || {};
                                                  tier.featSubChoices.plane = curPlane;
                                                  const planeData = OUTER_PLANES[curPlane] || OUTER_PLANES.neutral;
                                                  tier.featSubChoices.cantrip1 = planeData.cantrip;

                                                  subChoiceHtml += `
                                            <div style="background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle); padding:10px; border-radius:6px; margin-top:6px; display:flex; flex-direction:column; gap:8px;">
                                                <strong style="color:var(--color-gold-light); font-size:0.8rem;"><i class="fa-solid fa-ring"></i> Planar Alignment & Innate Magic:</strong>
                                                <div style="display:grid; grid-template-columns:1fr; gap:8px;">
                                                    <div>
                                                        <label style="font-size:0.75rem; color:var(--color-text-muted);">Plane Alignment:</label>
                                                        <select class="pc-tier-feat-plane-sel" data-tidx="${tIdx}" style="width:100%; padding:4px; font-size:0.8rem; background:#1e1e1e; color:#fff; border:1px solid var(--color-border-subtle); border-radius:4px;">
                                                            ${Object.entries(OUTER_PLANES)
                                                                .map(
                                                                    ([pk, pv]) =>
                                                                        `<option value="${pk}" ${curPlane === pk ? 'selected' : ''}>${pv.name} (${pv.cantrip} / ${pv.resistance} Res)</option>`
                                                                )
                                                                .join('')}
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>
                                        `;
                                              }
                                              // 10. Strike of the Giants
                                              else if (/strike of the giants/i.test(featNameLow)) {
                                                  const curStrike = tier.featSubChoices?.giantStrike || 'Cloud Strike';
                                                  tier.featSubChoices = tier.featSubChoices || {};
                                                  tier.featSubChoices.giantStrike = curStrike;
                                                  const strikeInfo =
                                                      GIANT_STRIKES[curStrike] || GIANT_STRIKES['Cloud Strike'];

                                                  subChoiceHtml += `
                                            <div style="background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle); padding:10px; border-radius:6px; margin-top:6px; display:flex; flex-direction:column; gap:8px;">
                                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                                    <strong style="color:var(--color-gold-light); font-size:0.8rem;"><i class="fa-solid fa-hand-fist"></i> Giant Strike Benefit:</strong>
                                                    <span class="badge" style="background:#b45309; color:#fff; font-size:0.7rem; padding:2px 6px;">PB Uses / Long Rest</span>
                                                </div>
                                                <div>
                                                    <label style="font-size:0.75rem; color:var(--color-text-muted);">Chosen Strike:</label>
                                                    <select class="pc-tier-feat-subchoice-sel" data-tidx="${tIdx}" data-field="giantStrike" style="width:100%; padding:4px; font-size:0.8rem; background:#1e1e1e; color:#fff; border:1px solid var(--color-border-subtle); border-radius:4px;">
                                                        ${Object.keys(GIANT_STRIKES)
                                                            .map(
                                                                (sk) =>
                                                                    `<option value="${sk}" ${curStrike === sk ? 'selected' : ''}>${sk} (+${GIANT_STRIKES[sk].damage} ${GIANT_STRIKES[sk].type})</option>`
                                                            )
                                                            .join('')}
                                                    </select>
                                                </div>
                                                <div style="font-size:0.75rem; color:var(--color-text-secondary); line-height:1.35; padding:6px 8px; background:rgba(0,0,0,0.25); border-radius:4px;">
                                                    ${strikeInfo.desc}
                                                </div>
                                            </div>
                                        `;
                                              }
                                              // 11. Skill Expert
                                              else if (/skill expert/i.test(featNameLow)) {
                                                  const curSkillProf =
                                                      tier.featSubChoices?.skillProf || STANDARD_5E_SKILLS[0];
                                                  const curSkillExp =
                                                      tier.featSubChoices?.skillExp || STANDARD_5E_SKILLS[1];
                                                  tier.featSubChoices = tier.featSubChoices || {};
                                                  if (!tier.featSubChoices.skillProf)
                                                      tier.featSubChoices.skillProf = curSkillProf;
                                                  if (!tier.featSubChoices.skillExp)
                                                      tier.featSubChoices.skillExp = curSkillExp;

                                                  subChoiceHtml += `
                                            <div style="background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle); padding:10px; border-radius:6px; margin-top:6px; display:flex; flex-direction:column; gap:8px;">
                                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                                    <strong style="color:var(--color-gold-light); font-size:0.8rem;"><i class="fa-solid fa-graduation-cap"></i> Skill Expert Proficiencies:</strong>
                                                    <span class="badge" style="background:#059669; color:#fff; font-size:0.7rem; padding:2px 6px;">1 Proficiency + 1 Expertise</span>
                                                </div>
                                                <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                                                    <div>
                                                        <label style="font-size:0.75rem; color:var(--color-text-muted);">Gain Skill Proficiency:</label>
                                                        <select class="pc-tier-feat-subchoice-sel" data-tidx="${tIdx}" data-field="skillProf" style="width:100%; padding:4px; font-size:0.8rem; background:#1e1e1e; color:#fff; border:1px solid var(--color-border-subtle); border-radius:4px;">
                                                            ${STANDARD_5E_SKILLS.map((sk) => `<option value="${sk}" ${curSkillProf === sk ? 'selected' : ''}>${sk}</option>`).join('')}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label style="font-size:0.75rem; color:var(--color-text-muted);">Gain Skill Expertise:</label>
                                                        <select class="pc-tier-feat-subchoice-sel" data-tidx="${tIdx}" data-field="skillExp" style="width:100%; padding:4px; font-size:0.8rem; background:#1e1e1e; color:#fff; border:1px solid var(--color-border-subtle); border-radius:4px;">
                                                            ${STANDARD_5E_SKILLS.map((sk) => `<option value="${sk}" ${curSkillExp === sk ? 'selected' : ''}>${sk} (Expertise)</option>`).join('')}
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>
                                        `;
                                              }
                                              // 12. Skilled
                                              else if (/skilled/i.test(featNameLow) && !/expert/i.test(featNameLow)) {
                                                  const curP1 =
                                                      tier.featSubChoices?.skillTool1 || STANDARD_5E_SKILLS[0];
                                                  const curP2 =
                                                      tier.featSubChoices?.skillTool2 || STANDARD_5E_SKILLS[1];
                                                  const curP3 =
                                                      tier.featSubChoices?.skillTool3 || STANDARD_5E_SKILLS[2];
                                                  tier.featSubChoices = tier.featSubChoices || {};
                                                  if (!tier.featSubChoices.skillTool1)
                                                      tier.featSubChoices.skillTool1 = curP1;
                                                  if (!tier.featSubChoices.skillTool2)
                                                      tier.featSubChoices.skillTool2 = curP2;
                                                  if (!tier.featSubChoices.skillTool3)
                                                      tier.featSubChoices.skillTool3 = curP3;

                                                  const allSkillToolOptions = [
                                                      ...STANDARD_5E_SKILLS.map((s) => ({ group: 'Skills', val: s })),
                                                      ...STANDARD_5E_TOOLS.map((t) => ({ group: 'Tools', val: t }))
                                                  ];

                                                  subChoiceHtml += `
                                            <div style="background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle); padding:10px; border-radius:6px; margin-top:6px; display:flex; flex-direction:column; gap:8px;">
                                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                                    <strong style="color:var(--color-gold-light); font-size:0.8rem;"><i class="fa-solid fa-award"></i> Skilled Proficiencies:</strong>
                                                    <span class="badge" style="background:#059669; color:#fff; font-size:0.7rem; padding:2px 6px;">Choose 3 Skills or Tools</span>
                                                </div>
                                                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(130px, 1fr)); gap:8px;">
                                                    <div>
                                                        <label style="font-size:0.75rem; color:var(--color-text-muted);">Proficiency 1:</label>
                                                        <select class="pc-tier-feat-subchoice-sel" data-tidx="${tIdx}" data-field="skillTool1" style="width:100%; padding:4px; font-size:0.8rem; background:#1e1e1e; color:#fff; border:1px solid var(--color-border-subtle); border-radius:4px;">
                                                            ${allSkillToolOptions.map((o) => `<option value="${o.val}" ${curP1 === o.val ? 'selected' : ''}>[${o.group}] ${o.val}</option>`).join('')}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label style="font-size:0.75rem; color:var(--color-text-muted);">Proficiency 2:</label>
                                                        <select class="pc-tier-feat-subchoice-sel" data-tidx="${tIdx}" data-field="skillTool2" style="width:100%; padding:4px; font-size:0.8rem; background:#1e1e1e; color:#fff; border:1px solid var(--color-border-subtle); border-radius:4px;">
                                                            ${allSkillToolOptions.map((o) => `<option value="${o.val}" ${curP2 === o.val ? 'selected' : ''}>[${o.group}] ${o.val}</option>`).join('')}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label style="font-size:0.75rem; color:var(--color-text-muted);">Proficiency 3:</label>
                                                        <select class="pc-tier-feat-subchoice-sel" data-tidx="${tIdx}" data-field="skillTool3" style="width:100%; padding:4px; font-size:0.8rem; background:#1e1e1e; color:#fff; border:1px solid var(--color-border-subtle); border-radius:4px;">
                                                            ${allSkillToolOptions.map((o) => `<option value="${o.val}" ${curP3 === o.val ? 'selected' : ''}>[${o.group}] ${o.val}</option>`).join('')}
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>
                                        `;
                                              }
                                              // 13. Prodigy
                                              else if (/prodigy/i.test(featNameLow)) {
                                                  const curSkill = tier.featSubChoices?.skill1 || STANDARD_5E_SKILLS[0];
                                                  const curTool = tier.featSubChoices?.tool1 || STANDARD_5E_TOOLS[0];
                                                  const curLang =
                                                      tier.featSubChoices?.lang1 || STANDARD_5E_LANGUAGES[0];
                                                  const curExp = tier.featSubChoices?.skillExp || STANDARD_5E_SKILLS[1];
                                                  tier.featSubChoices = tier.featSubChoices || {};
                                                  if (!tier.featSubChoices.skill1)
                                                      tier.featSubChoices.skill1 = curSkill;
                                                  if (!tier.featSubChoices.tool1) tier.featSubChoices.tool1 = curTool;
                                                  if (!tier.featSubChoices.lang1) tier.featSubChoices.lang1 = curLang;
                                                  if (!tier.featSubChoices.skillExp)
                                                      tier.featSubChoices.skillExp = curExp;

                                                  subChoiceHtml += `
                                            <div style="background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle); padding:10px; border-radius:6px; margin-top:6px; display:flex; flex-direction:column; gap:8px;">
                                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                                    <strong style="color:var(--color-gold-light); font-size:0.8rem;"><i class="fa-solid fa-star"></i> Prodigy Selections:</strong>
                                                    <span class="badge" style="background:#7c3aed; color:#fff; font-size:0.7rem; padding:2px 6px;">Skill, Tool, Language & Expertise</span>
                                                </div>
                                                <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                                                    <div>
                                                        <label style="font-size:0.75rem; color:var(--color-text-muted);">Skill Proficiency:</label>
                                                        <select class="pc-tier-feat-subchoice-sel" data-tidx="${tIdx}" data-field="skill1" style="width:100%; padding:4px; font-size:0.8rem; background:#1e1e1e; color:#fff; border:1px solid var(--color-border-subtle); border-radius:4px;">
                                                            ${STANDARD_5E_SKILLS.map((s) => `<option value="${s}" ${curSkill === s ? 'selected' : ''}>${s}</option>`).join('')}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label style="font-size:0.75rem; color:var(--color-text-muted);">Tool Proficiency:</label>
                                                        <select class="pc-tier-feat-subchoice-sel" data-tidx="${tIdx}" data-field="tool1" style="width:100%; padding:4px; font-size:0.8rem; background:#1e1e1e; color:#fff; border:1px solid var(--color-border-subtle); border-radius:4px;">
                                                            ${STANDARD_5E_TOOLS.map((t) => `<option value="${t}" ${curTool === t ? 'selected' : ''}>${t}</option>`).join('')}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label style="font-size:0.75rem; color:var(--color-text-muted);">Language:</label>
                                                        <select class="pc-tier-feat-subchoice-sel" data-tidx="${tIdx}" data-field="lang1" style="width:100%; padding:4px; font-size:0.8rem; background:#1e1e1e; color:#fff; border:1px solid var(--color-border-subtle); border-radius:4px;">
                                                            ${STANDARD_5E_LANGUAGES.map((l) => `<option value="${l}" ${curLang === l ? 'selected' : ''}>${l}</option>`).join('')}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label style="font-size:0.75rem; color:var(--color-text-muted);">Skill Expertise:</label>
                                                        <select class="pc-tier-feat-subchoice-sel" data-tidx="${tIdx}" data-field="skillExp" style="width:100%; padding:4px; font-size:0.8rem; background:#1e1e1e; color:#fff; border:1px solid var(--color-border-subtle); border-radius:4px;">
                                                            ${STANDARD_5E_SKILLS.map((s) => `<option value="${s}" ${curExp === s ? 'selected' : ''}>${s} (Expertise)</option>`).join('')}
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>
                                        `;
                                              }

                                              return `
                                        <div style="background:rgba(0,0,0,0.2); border:1px solid var(--color-border-subtle); padding:10px 12px; border-radius:6px; font-size:0.8rem; line-height:1.45; color:var(--color-text-secondary); max-height:140px; overflow-y:auto;" class="scroll-styled">
                                            <strong style="color:var(--color-gold-light);">${matchedFeat.name}:</strong> ${matchedFeat.description || (Array.isArray(matchedFeat.entries) ? matchedFeat.entries.join(' ') : 'No description.')}
                                        </div>
                                        ${subChoiceHtml}
                                    `;
                                          })()
                                        : ''
                                }
                            </div>
                        `
                        }
                    </div>
                `;
                    })
                    .join('')}
            </div>
        `
        }
    `;

    // Event Wireups
    bodyEl.querySelectorAll('.pc-wiz-tier-choice').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            const tIdx = parseInt(e.target.dataset.tidx);
            const choice = e.target.dataset.choice;
            if (asiTiers[tIdx]) {
                asiTiers[tIdx].choice = choice;
                if (choice === 'asi') {
                    asiTiers[tIdx].asiMode = asiTiers[tIdx].asiMode || 'plus2';
                    asiTiers[tIdx].stat1 = asiTiers[tIdx].stat1 || 'str';
                }
                recomputeCandidates().then(() => renderStep7(ctx));
            }
        });
    });

    bodyEl.querySelectorAll('.pc-wiz-tier-asimode').forEach((radio) => {
        radio.addEventListener('change', (e) => {
            const tIdx = parseInt(e.target.dataset.tidx);
            if (asiTiers[tIdx]) {
                asiTiers[tIdx].asiMode = e.target.value;
                recomputeCandidates().then(() => renderStep7(ctx));
            }
        });
    });

    bodyEl.querySelectorAll('.pc-wiz-tier-stat1').forEach((sel) => {
        sel.addEventListener('change', (e) => {
            const tIdx = parseInt(e.target.dataset.tidx);
            if (asiTiers[tIdx]) {
                asiTiers[tIdx].stat1 = e.target.value;
                recomputeCandidates().then(() => updateCountsDisplay());
            }
        });
    });

    bodyEl.querySelectorAll('.pc-wiz-tier-stat2').forEach((sel) => {
        sel.addEventListener('change', (e) => {
            const tIdx = parseInt(e.target.dataset.tidx);
            if (asiTiers[tIdx]) {
                asiTiers[tIdx].stat2 = e.target.value;
                recomputeCandidates().then(() => updateCountsDisplay());
            }
        });
    });

    bodyEl.querySelectorAll('.pc-tier-feat-spellclass-sel').forEach((sel) => {
        sel.addEventListener('change', (e) => {
            const tIdx = parseInt(e.target.dataset.tidx);
            if (asiTiers[tIdx]) {
                asiTiers[tIdx].featSubChoices = asiTiers[tIdx].featSubChoices || {};
                asiTiers[tIdx].featSubChoices.spellClass = e.target.value;
                asiTiers[tIdx].featSubChoices.cantrip1 = '';
                asiTiers[tIdx].featSubChoices.cantrip2 = '';
                asiTiers[tIdx].featSubChoices.spell1 = '';
                renderStep7(ctx);
            }
        });
    });

    bodyEl.querySelectorAll('.pc-tier-feat-college-sel').forEach((sel) => {
        sel.addEventListener('change', (e) => {
            const tIdx = parseInt(e.target.dataset.tidx);
            if (asiTiers[tIdx]) {
                asiTiers[tIdx].featSubChoices = asiTiers[tIdx].featSubChoices || {};
                asiTiers[tIdx].featSubChoices.college = e.target.value;
                asiTiers[tIdx].featSubChoices.cantrip1 = '';
                asiTiers[tIdx].featSubChoices.cantrip2 = '';
                asiTiers[tIdx].featSubChoices.spell1 = '';
                renderStep7(ctx);
            }
        });
    });

    bodyEl.querySelectorAll('.pc-tier-feat-moon-sel').forEach((sel) => {
        sel.addEventListener('change', (e) => {
            const tIdx = parseInt(e.target.dataset.tidx);
            if (asiTiers[tIdx]) {
                asiTiers[tIdx].featSubChoices = asiTiers[tIdx].featSubChoices || {};
                asiTiers[tIdx].featSubChoices.moon = e.target.value;
                asiTiers[tIdx].featSubChoices.cantrip1 = '';
                asiTiers[tIdx].featSubChoices.cantrip2 = '';
                asiTiers[tIdx].featSubChoices.spell1 = '';
                renderStep7(ctx);
            }
        });
    });

    bodyEl.querySelectorAll('.pc-tier-feat-plane-sel').forEach((sel) => {
        sel.addEventListener('change', (e) => {
            const tIdx = parseInt(e.target.dataset.tidx);
            if (asiTiers[tIdx]) {
                asiTiers[tIdx].featSubChoices = asiTiers[tIdx].featSubChoices || {};
                asiTiers[tIdx].featSubChoices.plane = e.target.value;
                const pData = OUTER_PLANES[e.target.value] || OUTER_PLANES.neutral;
                asiTiers[tIdx].featSubChoices.cantrip1 = pData.cantrip;
                renderStep7(ctx);
            }
        });
    });

    bodyEl.querySelectorAll('.pc-tier-feat-ability-sel').forEach((sel) => {
        sel.addEventListener('change', (e) => {
            const tIdx = parseInt(e.target.dataset.tidx);
            if (asiTiers[tIdx]) {
                asiTiers[tIdx].featSubChoices = asiTiers[tIdx].featSubChoices || {};
                asiTiers[tIdx].featSubChoices.abilityScore = e.target.value;
            }
        });
    });

    bodyEl.querySelectorAll('.pc-tier-feat-halfstat-sel').forEach((sel) => {
        sel.addEventListener('change', (e) => {
            const tIdx = parseInt(e.target.dataset.tidx);
            if (asiTiers[tIdx]) {
                asiTiers[tIdx].halfFeatStat = e.target.value;
                asiTiers[tIdx].featSubChoices = asiTiers[tIdx].featSubChoices || {};
                asiTiers[tIdx].featSubChoices.halfFeatStat = e.target.value;
                recomputeCandidates().then(() => updateCountsDisplay());
            }
        });
    });

    bodyEl.querySelectorAll('.pc-tier-feat-spell-sel').forEach((sel) => {
        sel.addEventListener('change', (e) => {
            const tIdx = parseInt(e.target.dataset.tidx);
            const field = e.target.dataset.field;
            if (asiTiers[tIdx]) {
                asiTiers[tIdx].featSubChoices = asiTiers[tIdx].featSubChoices || {};
                asiTiers[tIdx].featSubChoices[field] = e.target.value;
            }
        });
    });

    bodyEl.querySelectorAll('.pc-tier-feat-subchoice-sel').forEach((sel) => {
        sel.addEventListener('change', (e) => {
            const tIdx = parseInt(e.target.dataset.tidx);
            const field = e.target.dataset.field;
            if (asiTiers[tIdx]) {
                asiTiers[tIdx].featSubChoices = asiTiers[tIdx].featSubChoices || {};
                asiTiers[tIdx].featSubChoices[field] = e.target.value;
                if (field === 'giantStrike') {
                    renderStep7(ctx);
                }
            }
        });
    });

    bodyEl.querySelectorAll('.pc-tier-feat-sel').forEach((sel) => {
        sel.addEventListener('change', (e) => {
            const tIdx = parseInt(e.target.dataset.tidx);
            if (asiTiers[tIdx]) {
                asiTiers[tIdx].selectedFeatId = e.target.value;
                asiTiers[tIdx].featSubChoices = {};
                recomputeCandidates().then(() => renderStep7(ctx));
            }
        });
    });
}

export const renderStepFeats = renderStep7;
export const renderStep6 = renderStep7;
