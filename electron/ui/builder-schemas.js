/**
 * Builder Schemas & Form <-> JSON Mappers for DnDForged Homebrew Studio
 */

export { VTTEntryResolver } from '../../vtt/js/vtt-entry-resolver.js';

export const BUILDER_CATEGORIES = [
  { id: 'bestiary', name: 'Bestiary', icon: '🐉', singular: 'Monster / NPC' },
  { id: 'spells', name: 'Spells', icon: '✨', singular: 'Spell' },
  { id: 'items', name: 'Items', icon: '⚔️', singular: 'Item' },
  { id: 'classes', name: 'Classes', icon: '🛡️', singular: 'Class / Subclass' },
  { id: 'races', name: 'Races', icon: '🧝', singular: 'Race / Lineage' },
  { id: 'feats', name: 'Feats', icon: '📜', singular: 'Feat' },
  { id: 'backgrounds', name: 'Backgrounds', icon: '🎭', singular: 'Background' },
  { id: 'adventures', name: 'Adventures', icon: '📖', singular: 'Chapter / Note' }
];

export const ABILITY_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

export function calcAbilityModifier(score) {
  const num = parseInt(score, 10);
  if (isNaN(num)) return '+0';
  const mod = Math.floor((num - 10) / 2);
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

export function toCommaSeparatedString(val) {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (Array.isArray(val)) {
    return val.map(v => (typeof v === 'string' ? v : (v.sensesString || v.name || v.special || JSON.stringify(v)))).join(', ');
  }
  if (typeof val === 'object') {
    if (val.sensesString) return val.sensesString;
    if (val.special) return val.special;
    return Object.values(val).filter(v => typeof v === 'string').join(', ');
  }
  return String(val);
}

export function toCleanStringArray(val) {
  if (!val) return undefined;
  if (Array.isArray(val)) return val.map(v => (typeof v === 'string' ? v : (v.sensesString || v.name || String(v))));
  if (typeof val === 'string') {
    const parts = val.split(',').map(s => s.trim()).filter(Boolean);
    return parts.length > 0 ? parts : undefined;
  }
  if (typeof val === 'object') {
    if (val.sensesString) return [val.sensesString];
    const vals = Object.values(val).filter(v => typeof v === 'string');
    return vals.length > 0 ? vals : undefined;
  }
  return [String(val)];
}

export function flatten5eEntries(entries) {
  if (!entries) return '';
  if (typeof entries === 'string') return entries;
  if (typeof entries === 'number') return String(entries);
  if (Array.isArray(entries)) {
    return entries.map(flatten5eEntries).filter(Boolean).join('\n\n');
  }
  if (typeof entries === 'object') {
    if (entries.type === 'list' && Array.isArray(entries.items)) {
      return entries.items.map(i => `• ${flatten5eEntries(i)}`).join('\n');
    }
    if (entries.type === 'table' && Array.isArray(entries.rows)) {
      const header = Array.isArray(entries.colLabels) ? entries.colLabels.join(' | ') + '\n' : '';
      const rows = entries.rows.map(r => Array.isArray(r) ? r.map(flatten5eEntries).join(' | ') : flatten5eEntries(r)).join('\n');
      return (entries.caption ? `**${entries.caption}**\n` : '') + header + rows;
    }
    if (entries.entries) {
      const title = entries.name ? `**${entries.name}.** ` : '';
      return title + flatten5eEntries(entries.entries);
    }
    if (entries.text) return entries.text;
    if (entries.descriptionHtml) return entries.descriptionHtml.replace(/<[^>]*>/g, '');
    return JSON.stringify(entries);
  }
  return String(entries);
}

export function createBlankEntity(category, sourceCode = 'MYBREW') {
  const code = (sourceCode || 'MYBREW').toUpperCase();

  switch (category) {
    case 'bestiary':
      return {
        id: `creature_${Date.now()}_${code.toLowerCase()}`,
        name: 'New Creature',
        source: code,
        size: 'Medium',
        sizeCategory: 'M',
        type: 'Humanoid',
        subtype: '',
        alignment: 'unaligned',
        ac: 12,
        acCondition: '',
        hpAvg: 22,
        hpFormula: '4d8 + 4',
        speedWalk: 30,
        speedFly: 0,
        speedSwim: 0,
        speedClimb: 0,
        speedBurrow: 0,
        canHover: false,
        str: 10,
        dex: 10,
        con: 10,
        int: 10,
        wis: 10,
        cha: 10,
        cr: '1/4',
        passivePerception: 10,
        senses: 'darkvision 60 ft.',
        languages: 'Common',
        tokenUrl: '',
        resistances: '',
        immunities: '',
        conditionImmunities: '',
        traits: [
          { name: 'Keen Sight', text: 'The creature has advantage on Wisdom (Perception) checks that rely on sight.' }
        ],
        actions: [
          { name: 'Shortsword', text: '{@atk mw} {@hit 4} to hit, reach 5 ft., one target. {@h}5 ({@damage 1d6 + 2}) piercing damage.' }
        ],
        reactions: [],
        legendaryActions: []
      };

    case 'spells':
      return {
        id: `spell_${Date.now()}_${code.toLowerCase()}`,
        name: 'New Spell',
        source: code,
        level: 1,
        school: 'Evocation',
        castingTimeNum: 1,
        castingTimeUnit: 'action',
        rangeType: 'feet',
        rangeDistance: 60,
        componentV: true,
        componentS: true,
        componentM: false,
        materialsText: '',
        durationUnit: 'instant',
        durationAmount: 1,
        isConcentration: false,
        savingThrow: 'DEX',
        damageFormula: '2d6',
        damageType: 'Fire',
        upcastBonus: '1d6',
        classes: ['Wizard', 'Sorcerer'],
        description: 'A bright burst of flame erupts at a point you choose within range, dealing {@damage 2d6} fire damage to creatures in the area.',
        higherLevelsDesc: 'When you cast this spell using a spell slot of 2nd level or higher, the damage increases by 1d6 for each slot level above 1st.'
      };

    case 'items':
      return {
        id: `item_${Date.now()}_${code.toLowerCase()}`,
        name: 'New Magic Item',
        source: code,
        itemType: 'Weapon',
        rarity: 'uncommon',
        reqAttune: true,
        attuneDetails: '',
        damageDice: '1d8',
        damageType: 'Slashing',
        weaponProperties: 'Versatile',
        bonusHitDmg: 1,
        baseAc: 0,
        acBonus: 0,
        maxDexBonus: '',
        charges: 0,
        rechargeText: '',
        valueGp: 250,
        weightLbs: 3,
        description: 'A finely forged blade humming with latent arcane energy. You gain a +1 bonus to attack and damage rolls made with this weapon.'
      };

    case 'classes':
      return {
        id: `class_${Date.now()}_${code.toLowerCase()}`,
        name: 'New Class',
        source: code,
        hitDie: 'd8',
        primaryAbility: 'DEX',
        savingThrows: ['DEX', 'INT'],
        armorProf: 'Light armor',
        weaponProf: 'Simple weapons, shortswords',
        toolProf: "Thieves' tools",
        skillChoicesCount: 2,
        skillChoices: 'Acrobatics, Stealth, Investigation, Perception',
        subclassUnlockLevel: 3,
        levels: {
          1: [{ name: 'Core Training', text: 'You gain fundamental mastery of your class archetype.' }],
          2: [{ name: 'Tactical Surge', text: 'Once per short rest, you can take an additional action on your turn.' }],
          3: [{ name: 'Archetype Specialization', text: 'You choose a specialized path from your archetype choices.' }]
        },
        subclasses: [
          {
            name: 'Exemplar',
            shortName: 'Exemplar',
            source: code,
            features: [
              { level: 3, name: 'Exemplar Prowess', text: 'Your attacks score a critical hit on a roll of 19 or 20.' }
            ]
          }
        ]
      };

    case 'races':
      return {
        id: `race_${Date.now()}_${code.toLowerCase()}`,
        name: 'New Race',
        source: code,
        size: 'Medium',
        speedWalk: 30,
        speedFly: 0,
        speedSwim: 0,
        strMod: 0,
        dexMod: 2,
        conMod: 0,
        intMod: 1,
        wisMod: 0,
        chaMod: 0,
        languages: 'Common, Elvish',
        darkvision: 60,
        traits: [
          { name: 'Ancestral Ward', text: 'You have advantage on saving throws against being charmed.' }
        ]
      };

    case 'feats':
      return {
        id: `feat_${Date.now()}_${code.toLowerCase()}`,
        name: 'New Feat',
        source: code,
        prerequisite: 'Level 4+',
        description: 'You have mastered a specialized discipline of combat or adventuring.',
        benefits: [
          'Increase your Strength or Dexterity score by 1, to a maximum of 20.',
          'You gain proficiency in one skill or tool of your choice.'
        ]
      };

    case 'backgrounds':
      return {
        id: `background_${Date.now()}_${code.toLowerCase()}`,
        name: 'New Background',
        source: code,
        skills: 'Athletics, Survival',
        tools: 'Vehicles (land)',
        languages: 'One language of your choice',
        equipment: "A set of traveler's clothes, hunting trap, and a pouch containing 10 gp.",
        featureName: 'Wilderness Lore',
        featureDesc: 'You have an innate sense for finding shelter, food, and fresh water in uncharted territories.'
      };

    case 'adventures':
    default:
      return {
        id: `entry_${Date.now()}_${code.toLowerCase()}`,
        name: 'New Entry',
        source: code,
        description: 'Lore details, quest overview, or adventure content.'
      };
  }
}

/**
 * Convert visual form model into schema-compliant 5eTools JSON
 */
export function entityToJson(category, entity) {
  const code = (entity.source || 'MYBREW').toUpperCase();

  switch (category) {
    case 'bestiary': {
      const hpVal = parseInt(entity.hpAvg, 10) || 10;
      const acVal = parseInt(entity.ac, 10) || 10;
      return {
        id: entity.id || `creature_${(entity.name || 'creature').toLowerCase().replace(/[^a-z0-9]/g, '_')}_${code.toLowerCase()}`,
        name: entity.name || 'New Creature',
        source: code,
        size: [entity.sizeCategory || (entity.size ? entity.size[0].toUpperCase() : 'M')],
        type: entity.subtype ? { type: entity.type || 'humanoid', tags: [entity.subtype] } : (entity.type || 'humanoid'),
        alignment: entity.alignment ? entity.alignment.split(' ') : ['U'],
        ac: entity.acCondition ? [{ ac: acVal, condition: entity.acCondition }] : [acVal],
        hp: {
          average: hpVal,
          formula: entity.hpFormula || `${Math.max(1, Math.floor(hpVal / 4.5))}d8`
        },
        speed: {
          walk: parseInt(entity.speedWalk, 10) || 30,
          ...(entity.speedFly ? { fly: parseInt(entity.speedFly, 10), canHover: !!entity.canHover } : {}),
          ...(entity.speedSwim ? { swim: parseInt(entity.speedSwim, 10) } : {}),
          ...(entity.speedClimb ? { climb: parseInt(entity.speedClimb, 10) } : {}),
          ...(entity.speedBurrow ? { burrow: parseInt(entity.speedBurrow, 10) } : {})
        },
        str: parseInt(entity.str, 10) || 10,
        dex: parseInt(entity.dex, 10) || 10,
        con: parseInt(entity.con, 10) || 10,
        int: parseInt(entity.int, 10) || 10,
        wis: parseInt(entity.wis, 10) || 10,
        cha: parseInt(entity.cha, 10) || 10,
        cr: String(entity.cr || '1/4'),
        senses: toCleanStringArray(entity.senses),
        languages: toCleanStringArray(entity.languages) || ['Common'],
        tokenUrl: entity.tokenUrl || undefined,
        resist: toCleanStringArray(entity.resistances),
        immune: toCleanStringArray(entity.immunities),
        conditionImmune: toCleanStringArray(entity.conditionImmunities),
        trait: (entity.traits || []).filter(t => t.name && t.text).map(t => ({
          name: t.name,
          entries: Array.isArray(t.text) ? t.text : [t.text]
        })),
        action: (entity.actions || []).filter(a => a.name && a.text).map(a => ({
          name: a.name,
          entries: Array.isArray(a.text) ? a.text : [a.text]
        })),
        reaction: (entity.reactions || []).filter(r => r.name && r.text).map(r => ({
          name: r.name,
          entries: Array.isArray(r.text) ? r.text : [r.text]
        })),
        legendary: (entity.legendaryActions || []).filter(l => l.name && (l.text || l.entries)).map(l => ({
          name: l.name,
          entries: Array.isArray(l.text || l.entries) ? (l.text || l.entries) : [l.text || l.entries]
        })),
        bonusAction: (entity.bonusActions || []).filter(b => b.name && (b.text || b.entries)).map(b => ({
          name: b.name,
          entries: Array.isArray(b.text || b.entries) ? (b.text || b.entries) : [b.text || b.entries]
        })),
        lairActions: entity.lairActions?.length ? entity.lairActions : (entity._raw?.lairActions || undefined),
        lairHeader: entity.lairHeader || entity._raw?.lairHeader || undefined,
        lairActionsDesc: entity.lairActionsDesc || entity._raw?.lairActionsDesc || undefined,
        regionalEffects: entity.regionalEffects?.length ? entity.regionalEffects : (entity._raw?.regionalEffects || undefined),
        regionalEffectsHtml: entity.regionalEffectsHtml || entity._raw?.regionalEffectsHtml || undefined,
        variants: entity.variants?.length ? entity.variants : (entity._raw?.variants || undefined),
        mythicActions: entity.mythicActions?.length ? entity.mythicActions : (entity._raw?.mythicActions || undefined),
        spellcasting: entity.spellcasting?.length ? entity.spellcasting : (entity._raw?.spellcasting || undefined)
      };
    }

    case 'spells': {
      const lvl = parseInt(entity.level, 10) || 0;
      const timeUnit = entity.castingTimeUnit || 'action';
      const timeNum = parseInt(entity.castingTimeNum, 10) || 1;
      const schoolChar = (entity.school || 'E').charAt(0).toUpperCase();

      const componentsObj = {
        v: !!entity.componentV,
        s: !!entity.componentS
      };
      if (entity.componentM) {
        componentsObj.m = entity.materialsText ? entity.materialsText : true;
      }

      const durationArr = [];
      if (entity.durationUnit === 'instant') {
        durationArr.push({ type: 'instant' });
      } else {
        durationArr.push({
          type: 'timed',
          duration: {
            type: entity.durationUnit || 'minute',
            amount: parseInt(entity.durationAmount, 10) || 1
          },
          concentration: !!entity.isConcentration
        });
      }

      const rangeObj = {
        type: entity.rangeType || 'feet',
        distance: {
          type: entity.rangeType === 'feet' || entity.rangeType === 'miles' ? entity.rangeType : 'feet',
          amount: parseInt(entity.rangeDistance, 10) || 60
        }
      };

      const entries = [entity.description || 'Spell description.'];
      const higher = entity.higherLevelsDesc ? [{
        type: 'entries',
        name: 'At Higher Levels',
        entries: [entity.higherLevelsDesc]
      }] : undefined;

      return {
        id: entity.id || `spell_${(entity.name || 'spell').toLowerCase().replace(/[^a-z0-9]/g, '_')}_${code.toLowerCase()}`,
        name: entity.name || 'New Spell',
        source: code,
        level: lvl,
        school: schoolChar,
        time: [{ number: timeNum, unit: timeUnit }],
        range: rangeObj,
        components: componentsObj,
        duration: durationArr,
        entries,
        entriesHigherLevel: higher,
        classes: {
          fromClassList: Array.isArray(entity.classes) ? entity.classes.map(c => ({ name: typeof c === 'string' ? c : c.name, source: 'PHB' })) : []
        },
        subclasses: entity.subclasses || entity._raw?.subclasses || undefined,
        descriptionHtml: entity.descriptionHtml || entity._raw?.descriptionHtml || undefined,
        higherLevelHtml: entity.higherLevelHtml || entity._raw?.higherLevelHtml || undefined,
        damageList: entity.damageList || entity._raw?.damageList || undefined,
        saveAbility: entity.saveAbility || entity._raw?.saveAbility || undefined,
        damageInflict: entity.damageType ? [entity.damageType.toLowerCase()] : undefined,
        savingThrow: entity.savingThrow ? [entity.savingThrow.toLowerCase()] : undefined
      };
    }

    case 'items': {
      return {
        id: entity.id || `item_${(entity.name || 'item').toLowerCase().replace(/[^a-z0-9]/g, '_')}_${code.toLowerCase()}`,
        name: entity.name || 'New Magic Item',
        source: code,
        type: entity.itemType || entity.type || 'W',
        rarity: entity.rarity || 'uncommon',
        reqAttune: !!entity.reqAttune ? (entity.attuneDetails || true) : undefined,
        bonusWeapon: entity.bonusHitDmg ? `+${entity.bonusHitDmg}` : undefined,
        dmg1: entity.dmg1 || entity.damageDice || undefined,
        dmg2: entity.dmg2 || undefined,
        dmgType: entity.dmgType || (entity.damageType ? entity.damageType.charAt(0).toLowerCase() : undefined),
        properties: entity.properties || (entity.weaponProperties ? entity.weaponProperties.split(',').map(s => s.trim()) : undefined),
        ac: entity.ac || (entity.baseAc ? parseInt(entity.baseAc, 10) : undefined),
        bonusAc: entity.acBonus ? `+${entity.acBonus}` : undefined,
        value: entity.value || (entity.valueGp ? `${entity.valueGp} gp` : undefined),
        weight: entity.weight || (entity.weightLbs ? parseFloat(entity.weightLbs) : undefined),
        charges: entity.charges ? parseInt(entity.charges, 10) : undefined,
        recharge: entity.rechargeText || undefined,
        descriptionHtml: entity.descriptionHtml || entity._raw?.descriptionHtml || undefined,
        descriptionMarkdown: entity.descriptionMarkdown || entity._raw?.descriptionMarkdown || undefined,
        entries: [entity.description || 'Item description.']
      };
    }

    case 'classes': {
      const clsObj = {
        id: entity.id || `class_${(entity.name || 'class').toLowerCase().replace(/[^a-z0-9]/g, '_')}_${code.toLowerCase()}`,
        name: entity.name || 'New Class',
        source: code,
        hd: {
          number: 1,
          faces: parseInt(String(entity.hitDie || 'd8').replace('d', ''), 10) || 8
        },
        proficiency: (entity.savingThrows || []).map(s => s.toLowerCase()),
        startingProficiencies: {
          armor: entity.armorProf ? [entity.armorProf] : [],
          weapons: entity.weaponProf ? [entity.weaponProf] : [],
          tools: entity.toolProf ? [entity.toolProf] : [],
          skills: [
            {
              choose: {
                from: typeof entity.skillChoices === 'string' ? entity.skillChoices.split(',').map(s => s.trim().toLowerCase()) : ['athletics'],
                count: entity.skillChoicesCount || 2
              }
            }
          ]
        },
        classTableGroups: [
          {
            colLabels: ['Level', 'Proficiency Bonus', 'Features'],
            rows: Array.from({ length: 20 }, (_, idx) => {
              const lvl = idx + 1;
              const pb = `+${Math.floor((lvl - 1) / 4) + 2}`;
              const features = (entity.levels?.[lvl] || []).map(f => f.name).join(', ') || '—';
              return [lvl, pb, features];
            })
          }
        ],
        classFeatures: []
      };

      // Compile level features
      if (entity.levels) {
        for (const [lvl, featList] of Object.entries(entity.levels)) {
          for (const f of featList) {
            clsObj.classFeatures.push({
              name: f.name,
              level: parseInt(lvl, 10),
              entries: [f.text]
            });
          }
        }
      }

      // Add subclasses if present
      if (Array.isArray(entity.subclasses) && entity.subclasses.length > 0) {
        clsObj.subclasses = entity.subclasses.map(sub => ({
          name: sub.name,
          shortName: sub.shortName || sub.name,
          source: code,
          subclassFeatures: (sub.features || []).map(sf => ({
            name: sf.name,
            level: sf.level || 3,
            entries: [sf.text]
          }))
        }));
      }

      return clsObj;
    }

    case 'races': {
      return {
        id: entity.id || `race_${(entity.name || 'race').toLowerCase().replace(/[^a-z0-9]/g, '_')}_${code.toLowerCase()}`,
        name: entity.name || 'New Race',
        source: code,
        size: [entity.size ? entity.size.charAt(0).toUpperCase() : 'M'],
        speed: {
          walk: parseInt(entity.speedWalk, 10) || 30,
          ...(entity.speedFly ? { fly: parseInt(entity.speedFly, 10) } : {}),
          ...(entity.speedSwim ? { swim: parseInt(entity.speedSwim, 10) } : {})
        },
        ability: [
          {
            ...(entity.strMod ? { str: entity.strMod } : {}),
            ...(entity.dexMod ? { dex: entity.dexMod } : {}),
            ...(entity.conMod ? { con: entity.conMod } : {}),
            ...(entity.intMod ? { int: entity.intMod } : {}),
            ...(entity.wisMod ? { wis: entity.wisMod } : {}),
            ...(entity.chaMod ? { cha: entity.chaMod } : {})
          }
        ],
        darkvision: entity.darkvision ? parseInt(entity.darkvision, 10) : undefined,
        languageTags: entity.languages ? entity.languages.split(',').map(l => l.trim()) : ['Common'],
        entries: (entity.traits || []).map(t => ({
          name: t.name,
          type: 'entries',
          entries: [t.text]
        }))
      };
    }

    case 'feats': {
      return {
        id: entity.id || `feat_${(entity.name || 'feat').toLowerCase().replace(/[^a-z0-9]/g, '_')}_${code.toLowerCase()}`,
        name: entity.name || 'New Feat',
        source: code,
        prerequisite: entity.prerequisite ? [{ other: entity.prerequisite }] : undefined,
        entries: [
          entity.description || '',
          ...(entity.benefits || []).map(b => `• ${b}`)
        ]
      };
    }

    case 'backgrounds': {
      return {
        id: entity.id || `background_${(entity.name || 'background').toLowerCase().replace(/[^a-z0-9]/g, '_')}_${code.toLowerCase()}`,
        name: entity.name || 'New Background',
        source: code,
        skillProficiencies: entity.skills ? entity.skills.split(',').map(s => s.trim().toLowerCase()) : [],
        languageProficiencies: entity.languages ? [{ any: 1 }] : [],
        startingEquipment: entity.equipment ? [{ special: entity.equipment }] : [],
        entries: [
          {
            name: entity.featureName || 'Feature',
            type: 'entries',
            entries: [entity.featureDesc || '']
          }
        ]
      };
    }

    case 'adventures':
    default: {
      return {
        id: entity.id || `adventure_${(entity.name || 'adventure').toLowerCase().replace(/[^a-z0-9]/g, '_')}_${code.toLowerCase()}`,
        name: entity.name || 'New Entry',
        source: code,
        entries: [entity.description || '']
      };
    }
  }
}

/**
 * Extract visual form model from an existing 5eTools JSON object
 */
export function jsonToEntity(category, raw) {
  if (!raw) return createBlankEntity(category);

  switch (category) {
    case 'bestiary': {
      const walkSpeed = typeof raw.speed === 'object' ? (raw.speed.walk || 30) : (raw.speed || 30);
      const flySpeed = typeof raw.speed === 'object' ? (raw.speed.fly || 0) : 0;
      const swimSpeed = typeof raw.speed === 'object' ? (raw.speed.swim || 0) : 0;
      const climbSpeed = typeof raw.speed === 'object' ? (raw.speed.climb || 0) : 0;
      const burrowSpeed = typeof raw.speed === 'object' ? (raw.speed.burrow || 0) : 0;

      const acVal = raw.primaryAc !== undefined
        ? raw.primaryAc
        : (Array.isArray(raw.ac)
          ? (typeof raw.ac[0] === 'object' ? (raw.ac[0]?.ac || raw.ac[0]?.value || 10) : raw.ac[0])
          : (raw.ac || 10));
      const acCond = raw.acCondition || (Array.isArray(raw.ac) && raw.ac[0]?.condition ? raw.ac[0].condition : '');

      const mapEntries = (rawItems) => {
        if (!Array.isArray(rawItems)) return [];
        return rawItems.map(item => ({
          name: item.name || '',
          text: flatten5eEntries(item.entries || item.text || item.descriptionHtml || item),
          entries: item.entries,
          descriptionHtml: item.descriptionHtml
        }));
      };

      const traits = mapEntries(raw.traits || raw.trait);
      const actions = mapEntries(raw.actions || raw.action);
      const reactions = mapEntries(raw.reactions || raw.reaction);
      const bonusActions = mapEntries(raw.bonusActions || raw.bonusAction);
      const legendaryActions = mapEntries(raw.legendaryActions?.entries || raw.legendaryActions || raw.legendary);

      return {
        _raw: raw,
        id: raw.id || `creature_${Date.now()}`,
        name: raw.name || '',
        source: raw.source || 'MYBREW',
        size: Array.isArray(raw.size) ? raw.size[0] : (raw.size || 'M'),
        sizeCategory: Array.isArray(raw.size) ? raw.size[0] : (raw.sizeCategory || 'M'),
        type: typeof raw.type === 'object' ? raw.type.type : (raw.type || 'humanoid'),
        subtype: typeof raw.type === 'object' && raw.type.tags ? raw.type.tags.join(', ') : (raw.subtype || ''),
        alignment: Array.isArray(raw.alignment) ? raw.alignment.join(' ') : (raw.alignment || ''),
        ac: acVal,
        primaryAc: acVal,
        acCondition: acCond,
        hpAvg: raw.hp?.average || (typeof raw.hp === 'number' ? raw.hp : 10),
        hpFormula: raw.hp?.formula || '',
        speedWalk: walkSpeed,
        speedFly: flySpeed,
        speedSwim: swimSpeed,
        speedClimb: climbSpeed,
        speedBurrow: burrowSpeed,
        canHover: raw.speed?.canHover || false,
        str: raw.str || 10,
        dex: raw.dex || 10,
        con: raw.con || 10,
        int: raw.int || 10,
        wis: raw.wis || 10,
        cha: raw.cha || 10,
        cr: raw.cr !== undefined ? String(raw.cr) : '1/4',
        crNumeric: raw.crNumeric !== undefined ? raw.crNumeric : 0.25,
        senses: toCommaSeparatedString(raw.senses),
        languages: toCommaSeparatedString(raw.languages) || 'Common',
        tokenUrl: raw.tokenUrl || raw.tokenImg || '',
        resistances: toCommaSeparatedString(raw.resist),
        immunities: toCommaSeparatedString(raw.immune),
        conditionImmunities: toCommaSeparatedString(raw.conditionImmune),
        traits,
        actions,
        bonusActions,
        reactions,
        legendaryActions,
        legendaryActionsDesc: raw.legendaryActions?.description || raw.legendaryActionsDesc || '',
        legendaryCount: raw.legendaryActions?.count || raw.legendaryCount || 3,
        lairActions: raw.lairActions || [],
        lairHeader: raw.lairHeader || '',
        lairActionsDesc: raw.lairActionsDesc || '',
        regionalEffects: raw.regionalEffects || [],
        regionalEffectsHtml: raw.regionalEffectsHtml || '',
        mythicActions: raw.mythicActions || [],
        variants: raw.variants || [],
        spellcasting: raw.spellcasting || [],
        saves: raw.saves || raw.save || {},
        skills: raw.skills || raw.skill || {}
      };
    }

    case 'spells': {
      const timeObj = Array.isArray(raw.time) ? raw.time[0] : (raw.time || { number: 1, unit: 'action' });
      const compObj = raw.components || {};
      const durObj = Array.isArray(raw.duration) ? raw.duration[0] : (raw.duration || { type: 'instant' });

      let descText = flatten5eEntries(raw.entries);
      let upcastText = flatten5eEntries(raw.entriesHigherLevel);

      return {
        _raw: raw,
        id: raw.id || `spell_${Date.now()}`,
        name: raw.name || '',
        source: raw.source || 'MYBREW',
        level: raw.level ?? 1,
        school: raw.school || 'Evocation',
        castingTime: raw.castingTime || `${timeObj.number || 1} ${timeObj.unit || 'action'}`,
        castingTimeNum: timeObj.number || 1,
        castingTimeUnit: timeObj.unit || 'action',
        range: typeof raw.range === 'string' ? raw.range : `${raw.range?.distance?.amount || 60} ${raw.range?.type || 'feet'}`,
        rangeType: raw.range?.type || 'feet',
        rangeDistance: raw.range?.distance?.amount || 60,
        components: typeof raw.components === 'string' ? raw.components : '',
        componentV: typeof raw.components === 'string' ? raw.components.includes('V') : !!compObj.v,
        componentS: typeof raw.components === 'string' ? raw.components.includes('S') : !!compObj.s,
        componentM: typeof raw.components === 'string' ? raw.components.includes('M') : !!compObj.m,
        materialsText: typeof raw.components === 'string' && raw.components.includes('(') ? raw.components.slice(raw.components.indexOf('(') + 1, -1) : (typeof compObj.m === 'string' ? compObj.m : ''),
        duration: typeof raw.duration === 'string' ? raw.duration : '',
        durationUnit: durObj.duration?.type || durObj.type || 'instant',
        durationAmount: durObj.duration?.amount || 1,
        isConcentration: raw.concentration !== undefined ? !!raw.concentration : !!durObj.concentration,
        concentration: raw.concentration !== undefined ? !!raw.concentration : !!durObj.concentration,
        ritual: !!raw.ritual,
        saveAbility: raw.saveAbility || (Array.isArray(raw.savingThrow) ? raw.savingThrow[0]?.toUpperCase() : ''),
        savingThrow: raw.saveAbility || (Array.isArray(raw.savingThrow) ? raw.savingThrow[0]?.toUpperCase() : ''),
        damageList: raw.damageList || (raw.damageFormula ? [{ formula: raw.damageFormula, type: raw.damageType || 'force' }] : []),
        damageFormula: raw.damageList?.[0]?.formula || '',
        damageType: raw.damageList?.[0]?.type || '',
        upcastBonus: raw.upcastBonus || '',
        classes: Array.isArray(raw.classes) ? raw.classes : (raw.classes?.fromClassList ? raw.classes.fromClassList.map(c => c.name) : []),
        subclasses: raw.subclasses || [],
        descriptionHtml: raw.descriptionHtml || '',
        higherLevelHtml: raw.higherLevelHtml || '',
        description: descText || (raw.descriptionHtml ? raw.descriptionHtml.replace(/<[^>]*>/g, '') : ''),
        higherLevelsDesc: upcastText || (raw.higherLevelHtml ? raw.higherLevelHtml.replace(/<[^>]*>/g, '') : '')
      };
    }

    case 'items': {
      let descText = flatten5eEntries(raw.entries);

      return {
        _raw: raw,
        id: raw.id || `item_${Date.now()}`,
        name: raw.name || '',
        source: raw.source || 'MYBREW',
        type: raw.type || raw.rawType || 'Item',
        itemType: raw.type || raw.rawType || 'Weapon',
        rarity: raw.rarity || 'uncommon',
        reqAttune: !!raw.reqAttune,
        attuneDetails: typeof raw.reqAttune === 'string' ? raw.reqAttune : '',
        dmg1: raw.dmg1 || '',
        dmg2: raw.dmg2 || '',
        dmgType: raw.dmgType || '',
        damageDice: raw.dmg1 || '',
        properties: raw.properties || (Array.isArray(raw.property) ? raw.property : []),
        weaponProperties: Array.isArray(raw.properties || raw.property) ? (raw.properties || raw.property).join(', ') : '',
        bonusHitDmg: raw.bonusWeapon ? parseInt(raw.bonusWeapon.replace('+', ''), 10) : 0,
        ac: raw.ac || 0,
        baseAc: raw.ac || 0,
        acBonus: raw.bonusAc ? parseInt(raw.bonusAc.replace('+', ''), 10) : 0,
        charges: raw.charges || 0,
        rechargeText: raw.recharge || '',
        value: raw.value || '',
        valueGp: typeof raw.value === 'string' ? (parseFloat(raw.value) || 0) : (raw.value ? raw.value / 100 : 0),
        weight: raw.weight || 0,
        weightLbs: raw.weight || 0,
        descriptionHtml: raw.descriptionHtml || '',
        descriptionMarkdown: raw.descriptionMarkdown || '',
        description: descText || (raw.descriptionHtml ? raw.descriptionHtml.replace(/<[^>]*>/g, '') : '')
      };
    }

    case 'classes': {
      const levelsMap = {};
      if (Array.isArray(raw.features)) {
        for (const feat of raw.features) {
          const lvl = feat.level || 1;
          if (!levelsMap[lvl]) levelsMap[lvl] = [];
          levelsMap[lvl].push({
            name: feat.name || '',
            text: feat.entriesHtml || flatten5eEntries(feat.entries || feat.rawEntries || '')
          });
        }
      } else if (Array.isArray(raw.classFeatures)) {
        for (const feat of raw.classFeatures) {
          const lvl = feat.level || 1;
          if (!levelsMap[lvl]) levelsMap[lvl] = [];
          levelsMap[lvl].push({
            name: feat.name || '',
            text: flatten5eEntries(feat.entries || feat.text || '')
          });
        }
      }

      return {
        _raw: raw,
        id: raw.id || `class_${Date.now()}`,
        name: raw.name || '',
        source: raw.source || 'MYBREW',
        isSubclass: !!raw.isSubclass,
        className: raw.className || '',
        classSource: raw.classSource || '',
        hitDie: raw.hitDie || (raw.hd?.faces ? `d${raw.hd.faces}` : 'd8'),
        primaryAbility: raw.primaryAbility || 'DEX',
        savingThrows: Array.isArray(raw.proficiency) ? raw.proficiency.map(p => p.toUpperCase()) : ['DEX', 'INT'],
        armorProf: raw.startingProficiencies?.armor ? raw.startingProficiencies.armor.join(', ') : '',
        weaponProf: raw.startingProficiencies?.weapons ? raw.startingProficiencies.weapons.join(', ') : '',
        toolProf: raw.startingProficiencies?.tools ? raw.startingProficiencies.tools.join(', ') : '',
        skillChoicesCount: raw.startingProficiencies?.skills?.[0]?.choose?.count || 2,
        skillChoices: raw.startingProficiencies?.skills?.[0]?.choose?.from ? raw.startingProficiencies.skills[0].choose.from.join(', ') : '',
        levels: levelsMap,
        features: raw.features || [],
        subclasses: (raw.subclasses || []).map(s => ({
          id: s.id,
          name: s.name || '',
          shortName: s.shortName || s.name || '',
          source: s.source || raw.source || 'MYBREW',
          features: (s.features || s.subclassFeatures || []).map(sf => ({
            name: sf.name || '',
            level: sf.level || 3,
            text: sf.entriesHtml || flatten5eEntries(sf.entries || sf.text || '')
          }))
        }))
      };
    }

    case 'races': {
      const abObj = Array.isArray(raw.ability) ? raw.ability[0] : (raw.ability || {});
      const traits = (raw.entries || raw.traits || []).map(e => ({
        name: e.name || '',
        text: flatten5eEntries(e.entries || e.text || e)
      }));

      return {
        _raw: raw,
        id: raw.id || `race_${Date.now()}`,
        name: raw.name || '',
        source: raw.source || 'MYBREW',
        size: Array.isArray(raw.size) ? raw.size[0] : (raw.size || 'Medium'),
        speedWalk: raw.speed?.walk || (typeof raw.speed === 'number' ? raw.speed : 30),
        speedFly: raw.speed?.fly || 0,
        speedSwim: raw.speed?.swim || 0,
        strMod: abObj.str || 0,
        dexMod: abObj.dex || 0,
        conMod: abObj.con || 0,
        intMod: abObj.int || 0,
        wisMod: abObj.wis || 0,
        chaMod: abObj.cha || 0,
        languages: Array.isArray(raw.languageTags) ? raw.languageTags.join(', ') : 'Common',
        darkvision: raw.darkvision || 0,
        traits
      };
    }

    case 'feats': {
      const prereq = typeof raw.prerequisite === 'string' ? raw.prerequisite : (raw.prerequisite?.[0]?.other || '');
      let description = '';
      let benefits = [];
      if (Array.isArray(raw.entries)) {
        description = raw.entries.filter(e => typeof e === 'string' && !e.startsWith('•')).join('\n\n');
        benefits = raw.entries.filter(e => typeof e === 'string' && e.startsWith('•')).map(e => e.replace(/^•\s*/, ''));
        if (!description && !benefits.length) {
          description = flatten5eEntries(raw.entries);
        }
      }

      return {
        _raw: raw,
        id: raw.id || `feat_${Date.now()}`,
        name: raw.name || '',
        source: raw.source || 'MYBREW',
        prerequisite: prereq,
        prerequisiteText: prereq,
        featureTypeName: raw.featureTypeName || raw.categoryKey || '',
        isOptionalFeature: !!raw.isOptionalFeature,
        descriptionHtml: raw.descriptionHtml || raw.entriesHtml || '',
        description: raw.description || description || (raw.descriptionHtml ? raw.descriptionHtml.replace(/<[^>]*>/g, '') : ''),
        benefits: benefits.length > 0 ? benefits : []
      };
    }

    case 'backgrounds': {
      const featEntry = (raw.entries || []).find(e => e.name);
      return {
        _raw: raw,
        id: raw.id || `background_${Date.now()}`,
        name: raw.name || '',
        source: raw.source || 'MYBREW',
        skills: raw.skills || (Array.isArray(raw.skillProficiencies) ? raw.skillProficiencies.join(', ') : ''),
        tools: raw.tools || '',
        languages: raw.languages || 'One language',
        equipment: raw.equipment || (raw.startingEquipment?.[0]?.special || ''),
        equipmentData: raw.equipmentData || null,
        features: raw.features || [],
        feats: raw.feats || [],
        ability: raw.ability || null,
        descriptionHtml: raw.descriptionHtml || raw.entriesHtml || '',
        featureName: featEntry?.name || raw.features?.[0]?.name || 'Background Feature',
        featureDesc: featEntry?.entries ? featEntry.entries.join('\n\n') : (raw.features?.[0]?.description || '')
      };
    }

    case 'adventures':
    default: {
      return {
        id: raw.id || `entry_${Date.now()}`,
        name: raw.name || '',
        source: raw.source || 'MYBREW',
        description: Array.isArray(raw.entries) ? raw.entries.join('\n\n') : (raw.entries || '')
      };
    }
  }
}

// =========================================================================
// 5E CHALLENGE RATING BENCHMARKS & AUTO-MATH UTILITIES
// =========================================================================
export const CR_BENCHMARKS = {
  '0': { ac: 10, hp: 4, hd: '1d6', atk: 2, dmg: 1, dc: 10, pb: 2 },
  '1/8': { ac: 12, hp: 9, hd: '2d8', atk: 3, dmg: 3, dc: 11, pb: 2 },
  '1/4': { ac: 12, hp: 16, hd: '3d8+3', atk: 3, dmg: 5, dc: 11, pb: 2 },
  '1/2': { ac: 13, hp: 24, hd: '4d8+6', atk: 4, dmg: 8, dc: 12, pb: 2 },
  '1': { ac: 13, hp: 33, hd: '6d8+6', atk: 4, dmg: 10, dc: 12, pb: 2 },
  '2': { ac: 13, hp: 45, hd: '7d8+14', atk: 4, dmg: 15, dc: 13, pb: 2 },
  '3': { ac: 14, hp: 58, hd: '9d8+18', atk: 5, dmg: 20, dc: 13, pb: 2 },
  '4': { ac: 14, hp: 72, hd: '11d8+22', atk: 5, dmg: 25, dc: 14, pb: 2 },
  '5': { ac: 15, hp: 93, hd: '11d10+33', atk: 6, dmg: 30, dc: 14, pb: 3 },
  '6': { ac: 15, hp: 110, hd: '13d10+39', atk: 6, dmg: 35, dc: 15, pb: 3 },
  '7': { ac: 15, hp: 125, hd: '14d10+42', atk: 6, dmg: 40, dc: 15, pb: 3 },
  '8': { ac: 16, hp: 140, hd: '16d10+48', atk: 7, dmg: 45, dc: 16, pb: 3 },
  '9': { ac: 16, hp: 155, hd: '17d10+51', atk: 7, dmg: 50, dc: 16, pb: 4 },
  '10': { ac: 17, hp: 175, hd: '19d10+57', atk: 7, dmg: 58, dc: 16, pb: 4 },
  '12': { ac: 17, hp: 205, hd: '22d10+66', atk: 8, dmg: 70, dc: 17, pb: 4 },
  '15': { ac: 18, hp: 260, hd: '24d12+96', atk: 9, dmg: 90, dc: 18, pb: 5 },
  '20': { ac: 19, hp: 350, hd: '28d12+168', atk: 10, dmg: 130, dc: 19, pb: 6 }
};

export function getProfBonusByCR(cr) {
  let crVal = 0;
  if (typeof cr === 'string') {
    if (cr.includes('/')) {
      const parts = cr.split('/');
      crVal = parseFloat(parts[0]) / parseFloat(parts[1]);
    } else {
      crVal = parseFloat(cr) || 0;
    }
  } else {
    crVal = Number(cr) || 0;
  }

  if (crVal <= 4) return 2;
  if (crVal <= 8) return 3;
  if (crVal <= 12) return 4;
  if (crVal <= 16) return 5;
  if (crVal <= 20) return 6;
  if (crVal <= 24) return 7;
  if (crVal <= 28) return 8;
  return 9;
}

export function calcAverageHp(formula, conScore = 10) {
  if (!formula || typeof formula !== 'string') return 10;
  const match = formula.trim().match(/^(\d+)d(\d+)(?:\s*([\+\-])\s*(\d+))?$/i);
  if (!match) return 10;
  const count = parseInt(match[1], 10) || 1;
  const die = parseInt(match[2], 10) || 8;
  const sign = match[3] || '+';
  let bonus = match[4] ? parseInt(match[4], 10) : 0;
  if (sign === '-') bonus = -bonus;

  const avgDie = (die + 1) / 2;
  return Math.max(1, Math.floor(count * avgDie + bonus));
}

export function autoTagText(text) {
  if (!text) return '';
  let res = String(text);
  // Auto-convert damage dice
  res = res.replace(/(\()?(\d+d\d+(?:\s*[\+\-]\s*\d+)?)(\))?\s+(fire|cold|lightning|acid|poison|radiant|necrotic|force|psychic|thunder|slashing|piercing|bludgeoning)\s+damage\b/gi, (m, p1, dice, p2, type) => {
    return p1 && p2 ? `({@damage ${dice}}) ${type} damage` : `{@damage ${dice}} ${type} damage`;
  });
  // Auto-convert DC saves
  res = res.replace(/\b(?:DC|dc)\s*(\d+)\s*(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma|Str|Dex|Con|Int|Wis|Cha)?\b/gi, '{@dc $1} $2');
  // Auto-convert plain attack bonuses
  res = res.replace(/\+([0-9]+)\s+to\s+hit\b/gi, '{@hit $1} to hit');
  return res;
}

// =========================================================================
// MONSTER ARCHETYPE TEMPLATES
// =========================================================================
export const ARCHETYPE_TEMPLATES = [
  { id: 'brute', name: 'Brute', icon: '🔨', desc: 'High HP, crushing strength, and devastating melee attacks.' },
  { id: 'skirmisher', name: 'Skirmisher', icon: '🏹', desc: 'Agile hit-and-run striker with high Dexterity and evasive cunning.' },
  { id: 'spellcaster', name: 'Spellcaster', icon: '🔮', desc: 'Magical artillery with reactive shielding and elemental spells.' },
  { id: 'minion', name: 'Minion (Horde)', icon: '💀', desc: '1 HP cannon fodder with flat damage and swarming pack tactics.' },
  { id: 'boss', name: 'Solo / Boss', icon: '👑', desc: 'Apex adversary with Legendary Resistances, Legendary Actions, and multi-attack.' }
];

function formatDamageDice(avg) {
  if (avg <= 3) return '1d6';
  if (avg <= 5) return '1d6 + 2';
  if (avg <= 8) return '1d8 + 4';
  if (avg <= 10) return '1d10 + 5';
  if (avg <= 15) return '2d8 + 6';
  if (avg <= 20) return '2d10 + 9';
  if (avg <= 25) return '3d8 + 11';
  if (avg <= 35) return '4d10 + 13';
  if (avg <= 50) return '5d10 + 22';
  if (avg <= 70) return '7d10 + 31';
  if (avg <= 90) return '8d12 + 38';
  return '12d12 + 52';
}

export function createEntityFromArchetype({ archetypeId = 'brute', cr = '1', name = '', type = 'Humanoid', size = 'Medium', sourceCode = 'MYBREW' } = {}) {
  const code = (sourceCode || 'MYBREW').toUpperCase();
  const benchmark = CR_BENCHMARKS[cr] || CR_BENCHMARKS['1'];
  const pb = benchmark.pb || 2;

  const entity = {
    id: `creature_${Date.now()}_${code.toLowerCase()}`,
    name: name || '',
    source: code,
    size: size || 'Medium',
    type: type || 'Humanoid',
    alignment: 'unaligned',
    cr: cr,
    ac: benchmark.ac,
    acCondition: '',
    hpAvg: benchmark.hp,
    hpFormula: benchmark.hd,
    speedWalk: 30,
    speedFly: 0,
    speedSwim: 0,
    speedClimb: 0,
    speedBurrow: 0,
    str: 10,
    dex: 10,
    con: 10,
    int: 10,
    wis: 10,
    cha: 10,
    senses: 'darkvision 60 ft., passive Perception 10',
    languages: 'Common',
    traits: [],
    actions: [],
    reactions: [],
    legendaryActions: []
  };

  const scaleScores = (baseScores) => {
    const bonus = Math.floor(pb - 2) * 2;
    return {
      str: Math.min(30, baseScores.str + bonus),
      dex: Math.min(30, baseScores.dex + bonus),
      con: Math.min(30, baseScores.con + bonus),
      int: baseScores.int,
      wis: baseScores.wis,
      cha: baseScores.cha
    };
  };

  switch (archetypeId) {
    case 'brute': {
      if (!name) entity.name = 'Ironclad Brute';
      entity.ac = Math.max(10, benchmark.ac - 1);
      entity.acCondition = 'natural armor';
      entity.hpAvg = Math.round(benchmark.hp * 1.25);
      entity.hpFormula = `${Math.max(2, Math.round(entity.hpAvg / 7.5))}d8 + ${Math.round(entity.hpAvg * 0.3)}`;
      const sc = scaleScores({ str: 16, dex: 10, con: 16, int: 8, wis: 10, cha: 8 });
      Object.assign(entity, sc);
      entity.traits.push({
        name: 'Brute',
        text: 'A melee weapon deals one extra die of its damage when the creature hits with it (included in the attack).'
      });
      entity.actions.push({
        name: 'Multiattack',
        text: 'The creature makes two melee attacks.'
      });
      entity.actions.push({
        name: 'Heavy Slam',
        text: `{@atk mw} {@hit ${benchmark.atk}} to hit, reach 5 ft., one target. {@h}${benchmark.dmg} ({@damage ${formatDamageDice(benchmark.dmg)}}) bludgeoning damage.`
      });
      break;
    }

    case 'skirmisher': {
      if (!name) entity.name = 'Shadow Skirmisher';
      entity.ac = benchmark.ac + 1;
      entity.acCondition = 'leather armor';
      entity.hpAvg = Math.max(5, Math.round(benchmark.hp * 0.85));
      entity.hpFormula = `${Math.max(2, Math.round(entity.hpAvg / 5.5))}d8 + ${Math.round(entity.hpAvg * 0.2)}`;
      entity.speedWalk = 40;
      entity.speedClimb = 30;
      const sc = scaleScores({ str: 10, dex: 16, con: 12, int: 10, wis: 14, cha: 10 });
      Object.assign(entity, sc);
      entity.traits.push({
        name: 'Nimble Escape',
        text: 'The creature can take the Disengage or Hide action as a bonus action on each of its turns.'
      });
      entity.actions.push({
        name: 'Twin Daggers',
        text: `{@atk mw,rw} {@hit ${benchmark.atk}} to hit, reach 5 ft. or range 20/60 ft., one target. {@h}${benchmark.dmg} ({@damage ${formatDamageDice(benchmark.dmg)}}) piercing damage.`
      });
      break;
    }

    case 'spellcaster': {
      if (!name) entity.name = 'Arcane Spellweaver';
      entity.ac = Math.max(10, benchmark.ac - 1);
      entity.acCondition = 'mage armor';
      entity.hpAvg = Math.max(5, Math.round(benchmark.hp * 0.75));
      entity.hpFormula = `${Math.max(2, Math.round(entity.hpAvg / 5.5))}d8 + ${Math.round(entity.hpAvg * 0.15)}`;
      const sc = scaleScores({ str: 8, dex: 14, con: 12, int: 16, wis: 14, cha: 12 });
      Object.assign(entity, sc);
      entity.reactions.push({
        name: 'Arcane Shield (1/Day)',
        text: 'When hit by an attack, the spellcaster adds +5 to its AC against that attack, potentially causing it to miss.'
      });
      entity.actions.push({
        name: 'Arcane Bolt',
        text: `{@atk rs} {@hit ${benchmark.atk}} to hit, range 120 ft., one target. {@h}${benchmark.dmg} ({@damage ${formatDamageDice(benchmark.dmg)}}) force damage.`
      });
      entity.actions.push({
        name: 'Elemental Burst (Recharge 5-6)',
        text: `Each creature in a 20-ft. sphere must make a {@dc ${benchmark.dc}} Dexterity saving throw, taking ${Math.round(benchmark.dmg * 1.5)} ({@damage ${formatDamageDice(Math.round(benchmark.dmg * 1.5))}}) fire damage on a failed save, or half as much on a successful one.`
      });
      break;
    }

    case 'minion': {
      if (!name) entity.name = 'Horde Minion';
      entity.ac = benchmark.ac;
      entity.hpAvg = 1;
      entity.hpFormula = '1';
      const sc = scaleScores({ str: 12, dex: 14, con: 10, int: 8, wis: 10, cha: 8 });
      Object.assign(entity, sc);
      entity.traits.push({
        name: 'Minion',
        text: 'If the minion takes damage from an attack or as the result of a failed saving throw, their hit points are reduced to 0. If the minion takes damage from any other effect, they take no damage.'
      });
      entity.traits.push({
        name: 'Pack Tactics',
        text: 'The minion has advantage on an attack roll against a creature if at least one of the minion\'s allies is within 5 ft. of the creature and the ally isn\'t incapacitated.'
      });
      entity.actions.push({
        name: 'Vicious Strike',
        text: `{@atk mw} {@hit ${benchmark.atk}} to hit, reach 5 ft., one target. {@h}${Math.max(2, Math.round(benchmark.dmg * 0.4))} slashing damage.`
      });
      break;
    }

    case 'boss': {
      if (!name) entity.name = 'Apex Sovereign';
      entity.ac = benchmark.ac + 2;
      entity.acCondition = 'plate armor';
      entity.hpAvg = Math.round(benchmark.hp * 1.5);
      entity.hpFormula = `${Math.max(3, Math.round(entity.hpAvg / 8.5))}d10 + ${Math.round(entity.hpAvg * 0.35)}`;
      const sc = scaleScores({ str: 18, dex: 12, con: 18, int: 14, wis: 14, cha: 16 });
      Object.assign(entity, sc);
      entity.traits.push({
        name: 'Legendary Resistance (3/Day)',
        text: 'If the creature fails a saving throw, it can choose to succeed instead.'
      });
      entity.actions.push({
        name: 'Multiattack',
        text: 'The creature makes two melee attacks and one crushing blow.'
      });
      entity.actions.push({
        name: 'Dominating Strike',
        text: `{@atk mw} {@hit ${benchmark.atk + 1}} to hit, reach 10 ft., one target. {@h}${benchmark.dmg} ({@damage ${formatDamageDice(benchmark.dmg)}}) bludgeoning damage.`
      });
      entity.legendaryActions.push({
        name: 'Detect',
        text: 'The creature makes a Wisdom (Perception) check.'
      });
      entity.legendaryActions.push({
        name: 'Tail Swipe',
        text: `{@atk mw} {@hit ${benchmark.atk}} to hit, reach 10 ft., one target. {@h}${Math.round(benchmark.dmg * 0.6)} bludgeoning damage.`
      });
      entity.legendaryActions.push({
        name: 'Commanding Roar (Costs 2 Actions)',
        text: `Each hostile creature within 30 ft. must succeed on a {@dc ${benchmark.dc}} Wisdom saving throw or become frightened until the end of its next turn.`
      });
      break;
    }
  }

  return entity;
}

// =========================================================================
// PLAINTEXT STATBLOCK PARSER (Monsters, Spells, Items)
// =========================================================================
export function parsePlaintextStatblock(rawText, defaultCategory = 'bestiary', sourceCode = 'MYBREW') {
  if (!rawText || !rawText.trim()) return null;
  const text = rawText.trim();
  const code = (sourceCode || 'MYBREW').toUpperCase();

  // Category auto-detection
  let category = defaultCategory;
  if (/(\d+)(st|nd|rd|th)[ -]level\s+(abjuration|conjuration|divination|enchantment|evocation|illusion|necromancy|transmutation)/i.test(text) ||
      /(abjuration|conjuration|divination|enchantment|evocation|illusion|necromancy|transmutation)\s+cantrip/i.test(text) ||
      /Casting Time\s*:/i.test(text)) {
    category = 'spells';
  } else if (/Wondrous\s+Item/i.test(text) ||
             /Armor\s+\([^\)]+\)/i.test(text) ||
             /(common|uncommon|rare|very\s+rare|legendary|artifact)\s*\(/i.test(text) ||
             /requires\s+attunement/i.test(text)) {
    category = 'items';
  }

  if (category === 'spells') {
    return { category: 'spells', entity: parsePlaintextSpell(text, code) };
  }
  if (category === 'items') {
    return { category: 'items', entity: parsePlaintextItem(text, code) };
  }
  return { category: 'bestiary', entity: parsePlaintextBestiary(text, code) };
}

function parsePlaintextBestiary(text, code) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;

  const entity = {
    id: `creature_${Date.now()}_${code.toLowerCase()}`,
    name: lines[0].replace(/^#+\s*/, '').replace(/^\*\*|\*\*$/g, ''),
    source: code,
    size: 'Medium',
    type: 'Humanoid',
    alignment: 'unaligned',
    cr: '1',
    ac: 10,
    acCondition: '',
    hpAvg: 10,
    hpFormula: '2d8 + 2',
    speedWalk: 30,
    speedFly: 0,
    speedSwim: 0,
    speedClimb: 0,
    speedBurrow: 0,
    str: 10,
    dex: 10,
    con: 10,
    int: 10,
    wis: 10,
    cha: 10,
    senses: '',
    languages: 'Common',
    resistances: '',
    immunities: '',
    conditionImmunities: '',
    traits: [],
    actions: [],
    reactions: [],
    legendaryActions: []
  };

  let currentSection = 'traits';

  for (let i = 1; i < Math.min(4, lines.length); i++) {
    const metaMatch = lines[i].match(/^(Tiny|Small|Medium|Large|Huge|Gargantuan)\s+([^,]+)(?:,\s*(.+))?$/i);
    if (metaMatch) {
      entity.size = metaMatch[1];
      entity.type = metaMatch[2];
      entity.alignment = metaMatch[3] || 'unaligned';
      break;
    }
  }

  const acMatch = text.match(/(?:Armor Class|AC)\s*:?\s*(\d+)(?:\s*\(([^)]+)\))?/i);
  if (acMatch) {
    entity.ac = parseInt(acMatch[1], 10);
    if (acMatch[2]) entity.acCondition = acMatch[2].trim();
  }

  const hpMatch = text.match(/(?:Hit Points|HP)\s*:?\s*(\d+)(?:\s*\(([^)]+)\))?/i);
  if (hpMatch) {
    entity.hpAvg = parseInt(hpMatch[1], 10);
    if (hpMatch[2]) entity.hpFormula = hpMatch[2].trim();
  }

  const spdMatch = text.match(/Speed\s*:?\s*([^\n\r]+)/i);
  if (spdMatch) {
    const sStr = spdMatch[1];
    const walk = sStr.match(/(\d+)\s*ft/);
    if (walk) entity.speedWalk = parseInt(walk[1], 10);
    const fly = sStr.match(/fly\s*(\d+)\s*ft/i);
    if (fly) entity.speedFly = parseInt(fly[1], 10);
    const swim = sStr.match(/swim\s*(\d+)\s*ft/i);
    if (swim) entity.speedSwim = parseInt(swim[1], 10);
    const climb = sStr.match(/climb\s*(\d+)\s*ft/i);
    if (climb) entity.speedClimb = parseInt(climb[1], 10);
    const burrow = sStr.match(/burrow\s*(\d+)\s*ft/i);
    if (burrow) entity.speedBurrow = parseInt(burrow[1], 10);
  }

  // Parse abilities: Table or Inline
  const tableMatch = text.match(/\bSTR\s+DEX\s+CON\s+INT\s+WIS\s+CHA\b/i);
  if (tableMatch) {
    const afterTable = text.slice(tableMatch.index + tableMatch[0].length);
    const numberLineMatch = afterTable.match(/^\s*([^\r\n]+)/);
    if (numberLineMatch) {
      const scores = [];
      const scoreRegex = /(\d+)(?:\s*\([+\-]?\d+\))?/g;
      let sm;
      while ((sm = scoreRegex.exec(numberLineMatch[1])) !== null && scores.length < 6) {
        scores.push(parseInt(sm[1], 10));
      }
      if (scores.length === 6) {
        entity.str = scores[0];
        entity.dex = scores[1];
        entity.con = scores[2];
        entity.int = scores[3];
        entity.wis = scores[4];
        entity.cha = scores[5];
      }
    }
  } else {
    const matchScore = (k) => {
      const m = text.match(new RegExp(`\\b${k}\\s*:?\\s*(\\d+)`, 'i'));
      return m ? parseInt(m[1], 10) : null;
    };
    if (matchScore('STR') !== null) entity.str = matchScore('STR');
    if (matchScore('DEX') !== null) entity.dex = matchScore('DEX');
    if (matchScore('CON') !== null) entity.con = matchScore('CON');
    if (matchScore('INT') !== null) entity.int = matchScore('INT');
    if (matchScore('WIS') !== null) entity.wis = matchScore('WIS');
    if (matchScore('CHA') !== null) entity.cha = matchScore('CHA');
  }

  const sensesMatch = text.match(/Senses\s*:?\s*([^\n\r]+)/i);
  if (sensesMatch) entity.senses = sensesMatch[1].trim();

  const langMatch = text.match(/Languages\s*:?\s*([^\n\r]+)/i);
  if (langMatch) entity.languages = langMatch[1].trim();

  const resMatch = text.match(/Damage Resistances\s*:?\s*([^\n\r]+)/i);
  if (resMatch) entity.resistances = resMatch[1].trim();

  const immMatch = text.match(/Damage Immunities\s*:?\s*([^\n\r]+)/i);
  if (immMatch) entity.immunities = immMatch[1].trim();

  const condImmMatch = text.match(/Condition Immunities\s*:?\s*([^\n\r]+)/i);
  if (condImmMatch) entity.conditionImmunities = condImmMatch[1].trim();

  const crMatch = text.match(/(?:Challenge|CR)\s*:?\s*([0-9\/\.]+)/i);
  if (crMatch) entity.cr = crMatch[1];

  let pastHeader = false;
  let currentItem = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (/^ACTIONS$/i.test(line) || /^#+\s*ACTIONS$/i.test(line)) {
      if (currentItem) pushItem(entity, currentSection, currentItem);
      currentItem = null;
      currentSection = 'actions';
      pastHeader = true;
      continue;
    }
    if (/^REACTIONS$/i.test(line) || /^#+\s*REACTIONS$/i.test(line)) {
      if (currentItem) pushItem(entity, currentSection, currentItem);
      currentItem = null;
      currentSection = 'reactions';
      pastHeader = true;
      continue;
    }
    if (/^LEGENDARY ACTIONS$/i.test(line) || /^#+\s*LEGENDARY ACTIONS$/i.test(line)) {
      if (currentItem) pushItem(entity, currentSection, currentItem);
      currentItem = null;
      currentSection = 'legendary';
      pastHeader = true;
      continue;
    }

    if (!pastHeader) {
      if (/Challenge|CR\s*:?/i.test(line) || /Languages\s*:?/i.test(line)) {
        pastHeader = true;
      }
      continue;
    }

    const entryHeaderMatch = line.match(/^(?:\*\*)?([A-Za-z0-9\s\(\)\/\-\+\'\,\’]+?)(?:\*\*)?\s*[\.:]\s*(.+)$/i);
    if (entryHeaderMatch && entryHeaderMatch[1].length < 40 && !/^(STR|DEX|CON|INT|WIS|CHA|Speed|Armor Class|Hit Points|Saving Throws|Skills|Senses|Languages|Challenge)/i.test(entryHeaderMatch[1])) {
      if (currentItem) pushItem(entity, currentSection, currentItem);
      currentItem = {
        name: entryHeaderMatch[1].trim(),
        text: autoTagText(entryHeaderMatch[2].trim())
      };
    } else if (currentItem) {
      currentItem.text += '\n' + autoTagText(line);
    }
  }

  if (currentItem) {
    pushItem(entity, currentSection, currentItem);
  }

  return entity;
}

function pushItem(entity, section, item) {
  if (!item || !item.name) return;
  if (section === 'actions') entity.actions.push(item);
  else if (section === 'reactions') entity.reactions.push(item);
  else if (section === 'legendary') entity.legendaryActions.push(item);
  else entity.traits.push(item);
}

function parsePlaintextSpell(text, code) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const name = lines[0].replace(/^#+\s*/, '').replace(/^\*\*|\*\*$/g, '');

  let level = 1;
  let school = 'Evocation';

  const lvlMatch = text.match(/(\d+)(st|nd|rd|th)[ -]level\s+([A-Za-z]+)/i);
  if (lvlMatch) {
    level = parseInt(lvlMatch[1], 10);
    school = capitalize(lvlMatch[3]);
  } else {
    const cantripMatch = text.match(/([A-Za-z]+)\s+cantrip/i);
    if (cantripMatch) {
      level = 0;
      school = capitalize(cantripMatch[1]);
    }
  }

  let castingTimeNum = 1;
  let castingTimeUnit = 'action';
  const ctMatch = text.match(/Casting Time\s*:\s*(\d+)?\s*(action|bonus action|reaction|minute|hour)/i);
  if (ctMatch) {
    if (ctMatch[1]) castingTimeNum = parseInt(ctMatch[1], 10);
    castingTimeUnit = ctMatch[2].toLowerCase();
  }

  let rangeDistance = 60;
  let rangeType = 'feet';
  const rMatch = text.match(/Range\s*:\s*(Self|Touch|(\d+)\s*(feet|ft|miles|mile)?)/i);
  if (rMatch) {
    if (/Self/i.test(rMatch[1])) {
      rangeDistance = 0;
      rangeType = 'self';
    } else if (/Touch/i.test(rMatch[1])) {
      rangeDistance = 0;
      rangeType = 'touch';
    } else if (rMatch[2]) {
      rangeDistance = parseInt(rMatch[2], 10);
      rangeType = 'feet';
    }
  }

  let componentV = false;
  let componentS = false;
  let componentM = false;
  let materialsText = '';
  const compMatch = text.match(/Components\s*:\s*([^\n\r]+)/i);
  if (compMatch) {
    const cStr = compMatch[1];
    componentV = /\bV\b/i.test(cStr);
    componentS = /\bS\b/i.test(cStr);
    componentM = /\bM\b/i.test(cStr);
    const mMatch = cStr.match(/\(([^)]+)\)/);
    if (mMatch) materialsText = mMatch[1];
  }

  let durationAmount = 1;
  let durationUnit = 'instant';
  let isConcentration = false;
  const durMatch = text.match(/Duration\s*:\s*([^\n\r]+)/i);
  if (durMatch) {
    const dStr = durMatch[1];
    isConcentration = /concentration/i.test(dStr);
    if (/instant/i.test(dStr)) {
      durationUnit = 'instant';
    } else {
      const uMatch = dStr.match(/(\d+)?\s*(round|minute|hour|day)/i);
      if (uMatch) {
        durationAmount = uMatch[1] ? parseInt(uMatch[1], 10) : 1;
        durationUnit = uMatch[2].toLowerCase();
      }
    }
  }

  let higherLevelsDesc = '';
  const higherSplit = text.split(/(?:At Higher Levels|Using a Higher-Level Spell Slot)\s*[\.:]\s*/i);
  if (higherSplit.length > 1) {
    higherLevelsDesc = autoTagText(higherSplit[1].trim());
  }

  const bodyLines = [];
  let pastHeader = false;
  for (const l of lines) {
    if (!pastHeader) {
      if (/Duration\s*:/i.test(l) || /Components\s*:/i.test(l)) {
        pastHeader = true;
      }
      continue;
    }
    if (/At Higher Levels/i.test(l)) break;
    bodyLines.push(l);
  }
  const description = autoTagText(bodyLines.join('\n\n'));

  return {
    id: `spell_${Date.now()}_${code.toLowerCase()}`,
    name,
    source: code,
    level,
    school,
    castingTimeNum,
    castingTimeUnit,
    rangeDistance,
    rangeType,
    durationUnit,
    durationAmount,
    componentV,
    componentS,
    componentM,
    isConcentration,
    materialsText,
    damageFormula: '',
    damageType: '',
    savingThrow: '',
    upcastBonus: '',
    classes: ['Wizard', 'Sorcerer'],
    description,
    higherLevelsDesc
  };
}

function parsePlaintextItem(text, code) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const name = lines[0].replace(/^#+\s*/, '').replace(/^\*\*|\*\*$/g, '');

  let itemType = 'Wondrous Item';
  let rarity = 'uncommon';
  let reqAttune = false;
  let attuneDetails = '';

  const metaMatch = text.match(/(Wondrous [Ii]tem|Weapon|Armor|Potion|Ring|Rod|Scroll|Staff|Wand)[,\s]+(common|uncommon|rare|very rare|legendary|artifact)(?:\s*\((requires attunement(?: by [^)]+)?)\))?/i);
  if (metaMatch) {
    itemType = metaMatch[1];
    rarity = metaMatch[2].toLowerCase();
    if (metaMatch[3]) {
      reqAttune = true;
      const byMatch = metaMatch[3].match(/by\s+([^)]+)/i);
      if (byMatch) attuneDetails = byMatch[1].trim();
    }
  }

  const descLines = lines.slice(2);
  const description = autoTagText(descLines.join('\n\n'));

  return {
    id: `item_${Date.now()}_${code.toLowerCase()}`,
    name,
    source: code,
    itemType,
    rarity,
    reqAttune,
    attuneDetails,
    damageDice: '',
    damageType: '',
    bonusHitDmg: 0,
    baseAc: 0,
    acBonus: 0,
    weaponProperties: '',
    valueGp: 100,
    weightLbs: 1,
    charges: 0,
    description
  };
}

function capitalize(s) {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}
