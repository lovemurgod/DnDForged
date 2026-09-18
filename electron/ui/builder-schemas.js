/**
 * Builder Schemas & Form <-> JSON Mappers for DnDForged Homebrew Studio
 */

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
        name: entity.name || 'New Creature',
        source: code,
        size: [entity.sizeCategory || (entity.size ? entity.size[0].toUpperCase() : 'M')],
        type: entity.subtype ? { type: entity.type || 'humanoid', tags: [entity.subtype] } : (entity.type || 'humanoid'),
        alignment: entity.alignment ? entity.alignment.split(' ') : ['U'],
        ac: entity.acCondition ? [{ value: acVal, condition: entity.acCondition }] : [acVal],
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
        legendary: (entity.legendaryActions || []).filter(l => l.name && l.text).map(l => ({
          name: l.name,
          entries: Array.isArray(l.text) ? l.text : [l.text]
        }))
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
          fromClassList: Array.isArray(entity.classes) ? entity.classes.map(c => ({ name: c, source: 'PHB' })) : []
        },
        damageInflict: entity.damageType ? [entity.damageType.toLowerCase()] : undefined,
        savingThrow: entity.savingThrow ? [entity.savingThrow.toLowerCase()] : undefined
      };
    }

    case 'items': {
      return {
        name: entity.name || 'New Magic Item',
        source: code,
        type: entity.itemType || 'W',
        rarity: entity.rarity || 'uncommon',
        reqAttune: !!entity.reqAttune ? (entity.attuneDetails || true) : undefined,
        bonusWeapon: entity.bonusHitDmg ? `+${entity.bonusHitDmg}` : undefined,
        dmg1: entity.damageDice || undefined,
        dmgType: entity.damageType ? entity.damageType.charAt(0).toLowerCase() : undefined,
        ac: entity.baseAc ? parseInt(entity.baseAc, 10) : undefined,
        bonusAc: entity.acBonus ? `+${entity.acBonus}` : undefined,
        value: entity.valueGp ? entity.valueGp * 100 : undefined,
        weight: entity.weightLbs ? parseFloat(entity.weightLbs) : undefined,
        charges: entity.charges ? parseInt(entity.charges, 10) : undefined,
        recharge: entity.rechargeText || undefined,
        entries: [entity.description || 'Item description.']
      };
    }

    case 'classes': {
      const clsObj = {
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

      const acVal = Array.isArray(raw.ac) ? (raw.ac[0]?.value || raw.ac[0] || 10) : (raw.ac || 10);
      const acCond = Array.isArray(raw.ac) && raw.ac[0]?.condition ? raw.ac[0].condition : '';

      const traits = (raw.trait || []).map(t => ({
        name: t.name || '',
        text: Array.isArray(t.entries) ? t.entries.join('\n\n') : (t.entries || '')
      }));

      const actions = (raw.action || []).map(a => ({
        name: a.name || '',
        text: Array.isArray(a.entries) ? a.entries.join('\n\n') : (a.entries || '')
      }));

      const reactions = (raw.reaction || []).map(r => ({
        name: r.name || '',
        text: Array.isArray(r.entries) ? r.entries.join('\n\n') : (r.entries || '')
      }));

      const legendaryActions = (raw.legendary || []).map(l => ({
        name: l.name || '',
        text: Array.isArray(l.entries) ? l.entries.join('\n\n') : (l.entries || '')
      }));

      return {
        id: raw.id || `creature_${Date.now()}`,
        name: raw.name || '',
        source: raw.source || 'MYBREW',
        size: Array.isArray(raw.size) ? raw.size[0] : (raw.size || 'M'),
        sizeCategory: Array.isArray(raw.size) ? raw.size[0] : (raw.sizeCategory || 'M'),
        type: typeof raw.type === 'object' ? raw.type.type : (raw.type || 'humanoid'),
        subtype: typeof raw.type === 'object' && raw.type.tags ? raw.type.tags.join(', ') : (raw.subtype || ''),
        alignment: Array.isArray(raw.alignment) ? raw.alignment.join(' ') : (raw.alignment || ''),
        ac: acVal,
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
        cr: raw.cr || '1/4',
        senses: toCommaSeparatedString(raw.senses),
        languages: toCommaSeparatedString(raw.languages) || 'Common',
        tokenUrl: raw.tokenUrl || raw.tokenImg || '',
        resistances: toCommaSeparatedString(raw.resist),
        immunities: toCommaSeparatedString(raw.immune),
        conditionImmunities: toCommaSeparatedString(raw.conditionImmune),
        traits,
        actions,
        reactions,
        legendaryActions
      };
    }

    case 'spells': {
      const timeObj = Array.isArray(raw.time) ? raw.time[0] : (raw.time || { number: 1, unit: 'action' });
      const compObj = raw.components || {};
      const durObj = Array.isArray(raw.duration) ? raw.duration[0] : (raw.duration || { type: 'instant' });

      let descText = '';
      if (Array.isArray(raw.entries)) {
        descText = raw.entries.map(e => typeof e === 'string' ? e : JSON.stringify(e)).join('\n\n');
      }

      let upcastText = '';
      if (Array.isArray(raw.entriesHigherLevel)) {
        upcastText = raw.entriesHigherLevel.map(e => e.entries ? e.entries.join('\n\n') : JSON.stringify(e)).join('\n\n');
      }

      return {
        id: raw.id || `spell_${Date.now()}`,
        name: raw.name || '',
        source: raw.source || 'MYBREW',
        level: raw.level ?? 1,
        school: raw.school || 'Evocation',
        castingTimeNum: timeObj.number || 1,
        castingTimeUnit: timeObj.unit || 'action',
        rangeType: raw.range?.type || 'feet',
        rangeDistance: raw.range?.distance?.amount || 60,
        componentV: !!compObj.v,
        componentS: !!compObj.s,
        componentM: !!compObj.m,
        materialsText: typeof compObj.m === 'string' ? compObj.m : '',
        durationUnit: durObj.duration?.type || durObj.type || 'instant',
        durationAmount: durObj.duration?.amount || 1,
        isConcentration: !!durObj.concentration,
        savingThrow: Array.isArray(raw.savingThrow) ? raw.savingThrow[0]?.toUpperCase() : '',
        damageFormula: raw.damageList?.[0]?.formula || '',
        damageType: raw.damageList?.[0]?.type || '',
        upcastBonus: '',
        classes: raw.classes?.fromClassList ? raw.classes.fromClassList.map(c => c.name) : [],
        description: descText,
        higherLevelsDesc: upcastText
      };
    }

    case 'items': {
      let descText = '';
      if (Array.isArray(raw.entries)) {
        descText = raw.entries.map(e => typeof e === 'string' ? e : JSON.stringify(e)).join('\n\n');
      }

      return {
        id: raw.id || `item_${Date.now()}`,
        name: raw.name || '',
        source: raw.source || 'MYBREW',
        itemType: raw.type || 'Weapon',
        rarity: raw.rarity || 'uncommon',
        reqAttune: !!raw.reqAttune,
        attuneDetails: typeof raw.reqAttune === 'string' ? raw.reqAttune : '',
        damageDice: raw.dmg1 || '',
        damageType: raw.dmgType || '',
        weaponProperties: Array.isArray(raw.property) ? raw.property.join(', ') : '',
        bonusHitDmg: raw.bonusWeapon ? parseInt(raw.bonusWeapon.replace('+', ''), 10) : 0,
        baseAc: raw.ac || 0,
        acBonus: raw.bonusAc ? parseInt(raw.bonusAc.replace('+', ''), 10) : 0,
        charges: raw.charges || 0,
        rechargeText: raw.recharge || '',
        valueGp: raw.value ? raw.value / 100 : 0,
        weightLbs: raw.weight || 0,
        description: descText
      };
    }

    case 'classes': {
      const levelsMap = {};
      if (Array.isArray(raw.classFeatures)) {
        for (const feat of raw.classFeatures) {
          const lvl = feat.level || 1;
          if (!levelsMap[lvl]) levelsMap[lvl] = [];
          levelsMap[lvl].push({
            name: feat.name || '',
            text: Array.isArray(feat.entries) ? feat.entries.join('\n\n') : (feat.entries || '')
          });
        }
      }

      return {
        id: raw.id || `class_${Date.now()}`,
        name: raw.name || '',
        source: raw.source || 'MYBREW',
        hitDie: raw.hd?.faces ? `d${raw.hd.faces}` : 'd8',
        primaryAbility: 'DEX',
        savingThrows: Array.isArray(raw.proficiency) ? raw.proficiency.map(p => p.toUpperCase()) : ['DEX', 'INT'],
        armorProf: raw.startingProficiencies?.armor ? raw.startingProficiencies.armor.join(', ') : '',
        weaponProf: raw.startingProficiencies?.weapons ? raw.startingProficiencies.weapons.join(', ') : '',
        toolProf: raw.startingProficiencies?.tools ? raw.startingProficiencies.tools.join(', ') : '',
        skillChoicesCount: raw.startingProficiencies?.skills?.[0]?.choose?.count || 2,
        skillChoices: raw.startingProficiencies?.skills?.[0]?.choose?.from ? raw.startingProficiencies.skills[0].choose.from.join(', ') : '',
        levels: levelsMap,
        subclasses: (raw.subclasses || []).map(s => ({
          name: s.name || '',
          shortName: s.shortName || s.name || '',
          source: s.source || raw.source || 'MYBREW',
          features: (s.subclassFeatures || []).map(sf => ({
            name: sf.name || '',
            level: sf.level || 3,
            text: Array.isArray(sf.entries) ? sf.entries.join('\n\n') : (sf.entries || '')
          }))
        }))
      };
    }

    case 'races': {
      const abObj = Array.isArray(raw.ability) ? raw.ability[0] : (raw.ability || {});
      const traits = (raw.entries || []).map(e => ({
        name: e.name || '',
        text: Array.isArray(e.entries) ? e.entries.join('\n\n') : (e.entries || '')
      }));

      return {
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
      const prereq = raw.prerequisite?.[0]?.other || '';
      const lines = Array.isArray(raw.entries) ? raw.entries : [];
      const description = lines.filter(l => typeof l === 'string' && !l.startsWith('•')).join('\n\n');
      const benefits = lines.filter(l => typeof l === 'string' && l.startsWith('•')).map(l => l.replace(/^•\s*/, ''));

      return {
        id: raw.id || `feat_${Date.now()}`,
        name: raw.name || '',
        source: raw.source || 'MYBREW',
        prerequisite: prereq,
        description,
        benefits: benefits.length > 0 ? benefits : ['Benefit 1']
      };
    }

    case 'backgrounds': {
      const featEntry = (raw.entries || []).find(e => e.name);
      return {
        id: raw.id || `background_${Date.now()}`,
        name: raw.name || '',
        source: raw.source || 'MYBREW',
        skills: Array.isArray(raw.skillProficiencies) ? raw.skillProficiencies.join(', ') : '',
        tools: '',
        languages: 'One language',
        equipment: raw.startingEquipment?.[0]?.special || '',
        featureName: featEntry?.name || 'Background Feature',
        featureDesc: featEntry?.entries ? featEntry.entries.join('\n\n') : ''
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
