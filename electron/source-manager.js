import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

/**
 * Category Definitions for DnDForged Databases
 */
export const SOURCE_CATEGORIES = [
  { id: 'bestiary', name: 'Bestiary', icon: '🐉', description: 'Monsters, NPCs & Creatures' },
  { id: 'spells', name: 'Spells', icon: '✨', description: 'Arcane, Divine & Primal Magic' },
  { id: 'items', name: 'Items & Equipment', icon: '⚔️', description: 'Weapons, Armor & Magic Items' },
  { id: 'classes', name: 'Classes & Subclasses', icon: '🛡️', description: 'Core Classes, Subclasses & Kits' },
  { id: 'races', name: 'Races & Lineages', icon: '🧝', description: 'Player Species, Lineages & Heritages' },
  { id: 'feats', name: 'Feats & Traits', icon: '📜', description: 'Feats, Boons & Supernatural Gifts' },
  { id: 'backgrounds', name: 'Backgrounds', icon: '🎭', description: 'Origins, Backgrounds & Characteristics' },
  { id: 'adventures', name: 'Adventures & Lore', icon: '📖', description: 'Published Modules, Guides & Rulesets' }
];

export class SourceManager {
  constructor(options = {}) {
    this.rootDir = options.rootDir || process.cwd();
    this.dataDir = options.dataDir || path.join(this.rootDir, '5etools-src', 'data');
    this.campaignDataDir = options.campaignDataDir || path.join(this.rootDir, '.dndforged-data');
    this.configFilePath = path.join(this.campaignDataDir, 'sources-config.json');
    this.bookTitlesCache = null;
    this.cachedBuiltinCategories = null;
    this.config = {
      disabledSources: {
        global: [],
        campaigns: {}
      },
      customSources: []
    };
    this.ensureDirs();
    this.loadConfig();
  }

  setCampaignDataDir(newDir) {
    this.campaignDataDir = newDir;
    this.configFilePath = path.join(this.campaignDataDir, 'sources-config.json');
    this.ensureDirs();
    this.loadConfig();
  }

  ensureDirs() {
    try {
      if (!fs.existsSync(this.campaignDataDir)) {
        fs.mkdirSync(this.campaignDataDir, { recursive: true });
      }
      const sourcesBaseDir = path.join(this.campaignDataDir, 'sources');
      if (!fs.existsSync(sourcesBaseDir)) {
        fs.mkdirSync(sourcesBaseDir, { recursive: true });
      }
      for (const cat of SOURCE_CATEGORIES) {
        const catDir = path.join(sourcesBaseDir, cat.id);
        if (!fs.existsSync(catDir)) {
          fs.mkdirSync(catDir, { recursive: true });
        }
      }
    } catch (e) {
      console.error('[SourceManager] Failed to ensure sources directory structure:', e);
    }
  }

  loadConfig() {
    try {
      if (fs.existsSync(this.configFilePath)) {
        const parsed = JSON.parse(fs.readFileSync(this.configFilePath, 'utf8'));
        this.config = {
          disabledSources: {
            global: parsed.disabledSources?.global || [],
            campaigns: parsed.disabledSources?.campaigns || {}
          },
          customSources: parsed.customSources || []
        };
      } else {
        this.saveConfig();
      }
    } catch (err) {
      console.error('[SourceManager] Error loading sources-config.json:', err);
    }
  }

  saveConfig() {
    try {
      fs.writeFileSync(this.configFilePath, JSON.stringify(this.config, null, 2), 'utf8');
    } catch (err) {
      console.error('[SourceManager] Error saving sources-config.json:', err);
    }
  }

  getBookTitlesMap() {
    if (this.bookTitlesCache) return this.bookTitlesCache;
    const titles = new Map();

    // Standard known acronyms map
    const knownDefaults = {
      'PHB': "Player's Handbook (2014)",
      'XPHB': "Player's Handbook (2024)",
      'MM': 'Monster Manual (2014)',
      'XMM': 'Monster Manual (2024)',
      'DMG': "Dungeon Master's Guide (2014)",
      'XDMG': "Dungeon Master's Guide (2024)",
      'XGE': "Xanathar's Guide to Everything",
      'TCE': "Tasha's Cauldron of Everything",
      'FTD': "Fizban's Treasury of Dragons",
      'MPMM': 'Mordenkainen Presents: Monsters of the Multiverse',
      'MTF': "Mordenkainen's Tome of Foes",
      'VGM': "Volo's Guide to Monsters",
      'SCAG': "Sword Coast Adventurer's Guide",
      'EGW': "Explorer's Guide to Wildemount",
      'ERLW': 'Eberron: Rising from the Last War',
      'VRGR': "Van Richten's Guide to Ravenloft",
      'BGG': 'Bigby Presents: Glory of the Giants',
      'BMT': 'The Book of Many Things',
      'GGR': "Guildmasters' Guide to Ravnica",
      'MOT': 'Mythic Odysseys of Theros',
      'SCC': 'Strixhaven: A Curriculum of Chaos',
      'AAG': "Astral Adventurer's Guide",
      'BAM': 'Boo\'s Astral Menagerie',
      'COS': 'Curse of Strahd',
      'TOA': 'Tomb of Annihilation',
      'WDH': 'Waterdeep: Dragon Heist',
      'WDMM': 'Waterdeep: Dungeon of the Mad Mage',
      'IDROTF': 'Icewind Dale: Rime of the Frostmaiden',
      'BGDIA': 'Baldur\'s Gate: Descent Into Avernus',
      'DSOTDQ': 'Dragonlance: Shadow of the Dragon Queen',
      'PAbtSO': 'Phandelver and Below: The Shattered Obelisk',
      'CRCOTN': 'Critical Role: Call of the Netherdeep',
      'FRAIF': 'Forgotten Realms: Adventures in Faerûn',
      'EFA': 'Elminster\'s Forgotten Archive',
      'NF': 'Nightfall',
      'DoD': 'Dungeons of Drakkenheim',
      'KP': 'Kobold Press',
      'MCDM': 'MCDM Productions',
      'TGS': 'The Griffon\'s Saddlebag',
      'VSOS': 'Valda\'s Spire of Secrets'
    };

    for (const [k, v] of Object.entries(knownDefaults)) {
      titles.set(k.toUpperCase(), v);
    }

    try {
      const booksPath = path.join(this.dataDir, 'books.json');
      if (fs.existsSync(booksPath)) {
        const booksData = JSON.parse(fs.readFileSync(booksPath, 'utf8'));
        if (Array.isArray(booksData.book)) {
          for (const b of booksData.book) {
            if (b.id && b.name) titles.set(String(b.id).toUpperCase(), b.name);
            if (b.source && b.name) titles.set(String(b.source).toUpperCase(), b.name);
          }
        }
      }
    } catch (e) {}

    try {
      const advPath = path.join(this.dataDir, 'adventures.json');
      if (fs.existsSync(advPath)) {
        const advData = JSON.parse(fs.readFileSync(advPath, 'utf8'));
        if (Array.isArray(advData.adventure)) {
          for (const a of advData.adventure) {
            if (a.id && a.name) titles.set(String(a.id).toUpperCase(), a.name);
            if (a.source && a.name) titles.set(String(a.source).toUpperCase(), a.name);
          }
        }
      }
    } catch (e) {}

    this.bookTitlesCache = titles;
    return titles;
  }

  formatTitle(sourceCode) {
    if (!sourceCode) return 'Unknown Source';
    const clean = String(sourceCode).trim().toUpperCase();
    const map = this.getBookTitlesMap();
    if (map.has(clean)) return map.get(clean);

    return clean
      .split(/[-_]+/)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  }

  getAllSources(campaignId = null) {
    const titlesMap = this.getBookTitlesMap();
    const disabledSet = new Set(
      (this.config.disabledSources.global || []).map(s => String(s).toUpperCase())
    );

    if (campaignId && this.config.disabledSources.campaigns?.[campaignId]) {
      for (const s of this.config.disabledSources.campaigns[campaignId]) {
        disabledSet.add(String(s).toUpperCase());
      }
    }

    // Cache built-in sources on first scan for instant subsequent renders
    if (!this.cachedBuiltinCategories) {
      this.cachedBuiltinCategories = new Map();
      for (const cat of SOURCE_CATEGORIES) {
        const bMap = new Map();
        this.scanBuiltinCategory(cat.id, bMap, titlesMap);
        this.cachedBuiltinCategories.set(cat.id, Array.from(bMap.values()));
      }
    }

    const categoriesResult = [];

    for (const cat of SOURCE_CATEGORIES) {
      const sourcesMap = new Map();

      // 1. Fast load from cached built-in sources
      const cached = this.cachedBuiltinCategories.get(cat.id) || [];
      for (const src of cached) {
        sourcesMap.set(src.code, { ...src });
      }

      // 2. Scan Custom Sources in campaignDataDir
      this.scanCustomCategory(cat.id, sourcesMap);

      // Convert map to array and assign enabled flag
      const list = Array.from(sourcesMap.values()).map(src => {
        const upperCode = src.code.toUpperCase();
        return {
          ...src,
          enabled: !disabledSet.has(upperCode)
        };
      });

      list.sort((a, b) => {
        if (a.isCustom !== b.isCustom) return a.isCustom ? 1 : -1;
        return (a.name || '').localeCompare(b.name || '');
      });

      const enabledCount = list.filter(s => s.enabled).length;

      categoriesResult.push({
        id: cat.id,
        name: cat.name,
        icon: cat.icon,
        description: cat.description,
        totalCount: list.length,
        enabledCount,
        sources: list
      });
    }

    return {
      success: true,
      categories: categoriesResult,
      globalDisabled: this.config.disabledSources.global || [],
      campaignDisabled: campaignId ? (this.config.disabledSources.campaigns?.[campaignId] || []) : []
    };
  }

  scanBuiltinCategory(categoryId, sourcesMap, titlesMap) {
    try {
      let normalizedDirName = '';
      let filePrefix = '';

      switch (categoryId) {
        case 'bestiary':
          normalizedDirName = 'bestiary-normalized';
          filePrefix = 'bestiary-';
          break;
        case 'spells':
          normalizedDirName = 'spells-normalized';
          filePrefix = 'spells-';
          break;
        case 'items':
          normalizedDirName = 'items-normalized';
          filePrefix = 'items-';
          break;
        case 'classes':
          normalizedDirName = 'classes-normalized';
          filePrefix = 'classes-';
          break;
        case 'races':
          normalizedDirName = 'races-normalized';
          filePrefix = 'races-';
          break;
        case 'feats':
          normalizedDirName = 'feats-normalized';
          filePrefix = 'feats-';
          break;
        case 'backgrounds':
          normalizedDirName = 'backgrounds-normalized';
          filePrefix = 'backgrounds-';
          break;
        case 'adventures':
          this.scanAdventuresAndBooks(sourcesMap, titlesMap);
          return;
      }

      const dirPath = path.join(this.dataDir, normalizedDirName);
      if (fs.existsSync(dirPath)) {
        const files = fs.readdirSync(dirPath);
        for (const file of files) {
          if (!file.endsWith('.json') || !file.startsWith(filePrefix)) continue;
          const srcCode = file.slice(filePrefix.length, -5).toUpperCase();
          const filePath = path.join(dirPath, file);
          let entryCount = 0;
          let fileSize = 0;

          try {
            const stats = fs.statSync(filePath);
            fileSize = stats.size;
            const content = fs.readFileSync(filePath, 'utf8');
            const json = JSON.parse(content);
            if (Array.isArray(json)) {
              entryCount = json.length;
            } else if (typeof json === 'object') {
              const arrayProp = Object.values(json).find(v => Array.isArray(v));
              if (arrayProp) entryCount = arrayProp.length;
            }
          } catch (e) {}

          const name = titlesMap.get(srcCode) || this.formatTitle(srcCode);

          sourcesMap.set(srcCode, {
            id: `${categoryId}-${srcCode.toLowerCase()}`,
            code: srcCode,
            name,
            category: categoryId,
            isCustom: false,
            entryCount,
            fileSize,
            filePath,
            fileName: file,
            author: 'Official / Published',
            version: '1.0',
            description: `Core database partition containing ${entryCount} ${categoryId} records.`
          });
        }
      }
    } catch (err) {
      console.error(`[SourceManager] Error scanning built-in category ${categoryId}:`, err);
    }
  }

  scanAdventuresAndBooks(sourcesMap, titlesMap) {
    try {
      const booksFile = path.join(this.dataDir, 'books.json');
      if (fs.existsSync(booksFile)) {
        const data = JSON.parse(fs.readFileSync(booksFile, 'utf8'));
        if (Array.isArray(data.book)) {
          for (const b of data.book) {
            const code = (b.id || b.source || '').toUpperCase();
            if (!code || sourcesMap.has(code)) continue;
            sourcesMap.set(code, {
              id: `adventures-${code.toLowerCase()}`,
              code,
              name: b.name || titlesMap.get(code) || code,
              category: 'adventures',
              isCustom: false,
              entryCount: b.contents?.length || 1,
              fileSize: 0,
              filePath: booksFile,
              fileName: 'books.json',
              author: b.author || 'Wizards RPG Team',
              version: b.published || '2014-2024',
              description: `Sourcebook contents and reference rules.`
            });
          }
        }
      }
    } catch (e) {}

    try {
      const advFile = path.join(this.dataDir, 'adventures.json');
      if (fs.existsSync(advFile)) {
        const data = JSON.parse(fs.readFileSync(advFile, 'utf8'));
        if (Array.isArray(data.adventure)) {
          for (const a of data.adventure) {
            const code = (a.id || a.source || '').toUpperCase();
            if (!code || sourcesMap.has(code)) continue;
            sourcesMap.set(code, {
              id: `adventures-${code.toLowerCase()}`,
              code,
              name: a.name || titlesMap.get(code) || code,
              category: 'adventures',
              isCustom: false,
              entryCount: a.contents?.length || 1,
              fileSize: 0,
              filePath: advFile,
              fileName: 'adventures.json',
              author: a.author || 'Wizards of the Coast',
              version: a.published || 'Published',
              description: `Campaign adventure module with chapters and maps.`
            });
          }
        }
      }
    } catch (e) {}
  }

  scanCustomCategory(categoryId, sourcesMap) {
    try {
      const customDir = path.join(this.campaignDataDir, 'sources', categoryId);
      if (!fs.existsSync(customDir)) return;

      const files = fs.readdirSync(customDir);
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        const filePath = path.join(customDir, file);
        let srcCode = file.replace(/\.json$/i, '').toUpperCase();
        let name = this.formatTitle(srcCode);
        let author = 'Custom Homebrew';
        let version = '1.0';
        let description = 'User-created custom database';
        let entryCount = 0;
        let fileSize = 0;

        try {
          const stats = fs.statSync(filePath);
          fileSize = stats.size;
          const raw = fs.readFileSync(filePath, 'utf8');
          const json = JSON.parse(raw);

          if (json.source) srcCode = String(json.source).toUpperCase();
          if (json.name) name = json.name;
          if (json.author) author = json.author;
          if (json.version) version = json.version;
          if (json.description) description = json.description;

          if (Array.isArray(json)) {
            entryCount = json.length;
          } else if (typeof json === 'object') {
            const primaryKey = categoryId === 'bestiary' ? 'monsters' : categoryId;
            if (Array.isArray(json[primaryKey])) {
              entryCount = json[primaryKey].length;
            } else {
              const arrayProp = Object.values(json).find(v => Array.isArray(v));
              if (arrayProp) entryCount = arrayProp.length;
            }
          }
        } catch (e) {}

        const configMeta = (this.config.customSources || []).find(
          c => c.fileName === file && c.category === categoryId
        );
        if (configMeta) {
          if (configMeta.id) srcCode = configMeta.id.toUpperCase();
          if (configMeta.name) name = configMeta.name;
          if (configMeta.author) author = configMeta.author;
          if (configMeta.version) version = configMeta.version;
          if (configMeta.description) description = configMeta.description;
        }

        sourcesMap.set(srcCode, {
          id: `custom-${categoryId}-${srcCode.toLowerCase()}`,
          code: srcCode,
          name,
          category: categoryId,
          isCustom: true,
          entryCount,
          fileSize,
          filePath,
          fileName: file,
          author,
          version,
          description
        });
      }
    } catch (err) {
      console.error(`[SourceManager] Error scanning custom category ${categoryId}:`, err);
    }
  }

  toggleSource(sourceCode, enabled, campaignId = null) {
    const code = String(sourceCode).trim().toUpperCase();
    if (campaignId) {
      if (!this.config.disabledSources.campaigns) {
        this.config.disabledSources.campaigns = {};
      }
      if (!this.config.disabledSources.campaigns[campaignId]) {
        this.config.disabledSources.campaigns[campaignId] = [];
      }
      const list = this.config.disabledSources.campaigns[campaignId];
      const idx = list.indexOf(code);
      if (enabled && idx !== -1) {
        list.splice(idx, 1);
      } else if (!enabled && idx === -1) {
        list.push(code);
      }
    } else {
      if (!Array.isArray(this.config.disabledSources.global)) {
        this.config.disabledSources.global = [];
      }
      const list = this.config.disabledSources.global;
      const idx = list.indexOf(code);
      if (enabled && idx !== -1) {
        list.splice(idx, 1);
      } else if (!enabled && idx === -1) {
        list.push(code);
      }
    }

    this.saveConfig();
    return { success: true, code, enabled, campaignId };
  }

  /**
   * Bulk toggle an entire list of sources
   */
  batchToggle(sourceCodes, enabled, campaignId = null) {
    const codes = (sourceCodes || []).map(c => String(c).trim().toUpperCase());
    for (const code of codes) {
      this.toggleSource(code, enabled, campaignId);
    }
    return { success: true, count: codes.length, enabled, campaignId };
  }

  /**
   * Apply a preset ruleset configuration
   */
  applyPreset(presetKey, campaignId = null) {
    const key = (presetKey || '').toLowerCase().trim();
    const all = this.getAllSources(campaignId);
    const allCodes = new Set();
    for (const cat of all.categories) {
      for (const s of cat.sources) {
        allCodes.add(s.code.toUpperCase());
      }
    }

    const REVISION_2024_CODES = new Set(['XPHB', 'XMM', 'XDMG', 'EFA', 'FRAIF', 'NF']);
    const LEGACY_2014_CODES = new Set(['PHB', 'MM', 'DMG', 'VGM', 'MTF']);
    const CORE_CODES = new Set(['PHB', 'XPHB', 'MM', 'XMM', 'DMG', 'XDMG']);

    let toDisable = [];

    switch (key) {
      case '2024-ruleset':
        toDisable = Array.from(LEGACY_2014_CODES);
        break;

      case '2014-classic':
        toDisable = Array.from(REVISION_2024_CODES);
        break;

      case 'core-only':
        toDisable = Array.from(allCodes).filter(c => !CORE_CODES.has(c));
        break;

      case 'all-official':
        toDisable = [];
        for (const cat of all.categories) {
          for (const s of cat.sources) {
            if (s.isCustom || s.code.startsWith('UA') || s.code.startsWith('XUA')) {
              toDisable.push(s.code.toUpperCase());
            }
          }
        }
        break;

      case 'everything':
        toDisable = [];
        break;

      case 'disable-all':
        toDisable = Array.from(allCodes);
        break;

      default:
        return { success: false, error: `Unknown preset '${presetKey}'` };
    }

    if (campaignId) {
      if (!this.config.disabledSources.campaigns) {
        this.config.disabledSources.campaigns = {};
      }
      this.config.disabledSources.campaigns[campaignId] = toDisable;
    } else {
      this.config.disabledSources.global = toDisable;
    }

    this.saveConfig();
    return { success: true, preset: key, disabledCount: toDisable.length, campaignId };
  }

  getSourceDetails(category, sourceCode) {
    const code = String(sourceCode).trim().toUpperCase();
    const all = this.getAllSources();
    const cat = all.categories.find(c => c.id === category);
    if (!cat) return { success: false, error: `Category '${category}' not found.` };

    const src = cat.sources.find(s => s.code === code);
    if (!src) return { success: false, error: `Source '${code}' not found in category '${category}'.` };

    let rawJson = '';
    try {
      if (fs.existsSync(src.filePath)) {
        rawJson = fs.readFileSync(src.filePath, 'utf8');
      }
    } catch (e) {
      return { success: false, error: `Failed to read source file: ${e.message}` };
    }

    return {
      success: true,
      source: src,
      rawJson
    };
  }

  saveSourceDetails({ category, code, name, author, version, description, rawJson }) {
    const cleanCode = String(code).trim().toUpperCase();
    const details = this.getSourceDetails(category, cleanCode);
    if (!details.success) return details;

    const src = details.source;

    let parsedData = null;
    if (rawJson !== undefined) {
      try {
        parsedData = JSON.parse(rawJson);
      } catch (err) {
        return { success: false, error: `Invalid JSON syntax: ${err.message}` };
      }
    }

    try {
      if (rawJson !== undefined) {
        fs.writeFileSync(src.filePath, JSON.stringify(parsedData, null, 2), 'utf8');
      }
    } catch (err) {
      return { success: false, error: `Failed to write file to disk: ${err.message}` };
    }

    if (src.isCustom) {
      let meta = this.config.customSources.find(
        c => c.fileName === src.fileName && c.category === category
      );
      if (!meta) {
        meta = {
          id: cleanCode,
          fileName: src.fileName,
          category
        };
        this.config.customSources.push(meta);
      }
      if (name) meta.name = name;
      if (author) meta.author = author;
      if (version) meta.version = version;
      if (description) meta.description = description;
      this.saveConfig();
    }

    return { success: true, code: cleanCode, category };
  }

  addDatabaseFile({ category, filePath }) {
    if (!fs.existsSync(filePath)) {
      return { success: false, error: 'Selected file does not exist.' };
    }

    let rawContent = '';
    let parsed = null;
    try {
      rawContent = fs.readFileSync(filePath, 'utf8');
      parsed = JSON.parse(rawContent);
    } catch (e) {
      return { success: false, error: `Failed to parse JSON: ${e.message}` };
    }

    let srcCode = parsed.source || parsed.id;
    if (!srcCode) {
      const base = path.basename(filePath, '.json');
      srcCode = base.replace(/[^a-zA-Z0-9_-]/g, '_').toUpperCase();
    } else {
      srcCode = String(srcCode).toUpperCase();
    }

    const srcName = parsed.name || this.formatTitle(srcCode);
    const destFileName = `${srcCode.toLowerCase()}.json`;
    const targetDir = path.join(this.campaignDataDir, 'sources', category);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    const destPath = path.join(targetDir, destFileName);

    try {
      fs.writeFileSync(destPath, JSON.stringify(parsed, null, 2), 'utf8');
    } catch (e) {
      return { success: false, error: `Failed to write database file: ${e.message}` };
    }

    let meta = this.config.customSources.find(
      c => c.fileName === destFileName && c.category === category
    );
    if (!meta) {
      meta = {
        id: srcCode,
        name: srcName,
        category,
        fileName: destFileName,
        author: parsed.author || 'Imported',
        version: parsed.version || '1.0',
        description: parsed.description || 'Imported custom database file.'
      };
      this.config.customSources.push(meta);
    } else {
      meta.name = srcName;
    }

    const globalList = this.config.disabledSources.global || [];
    const idx = globalList.indexOf(srcCode);
    if (idx !== -1) globalList.splice(idx, 1);

    this.saveConfig();

    return {
      success: true,
      source: {
        code: srcCode,
        name: srcName,
        category,
        filePath: destPath,
        fileName: destFileName
      }
    };
  }

  createCustomSource({ category, code, name, author, description }) {
    const cleanCode = (code || '').trim().replace(/[^a-zA-Z0-9_-]/g, '_').toUpperCase();
    if (!cleanCode) return { success: false, error: 'Source code is required.' };

    const cleanName = (name || cleanCode).trim();
    const cleanAuthor = (author || 'Homebrew Creator').trim();
    const cleanDesc = (description || '').trim();

    const targetDir = path.join(this.campaignDataDir, 'sources', category);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const fileName = `${cleanCode.toLowerCase()}.json`;
    const filePath = path.join(targetDir, fileName);

    let scaffold = {
      source: cleanCode,
      name: cleanName,
      author: cleanAuthor,
      version: '1.0.0',
      description: cleanDesc
    };

    switch (category) {
      case 'bestiary':
        scaffold.monsters = [
          {
            id: `creature_${cleanCode.toLowerCase()}_sample_beast`,
            name: 'Sample Homebrew Creature',
            source: cleanCode,
            size: 'Medium',
            type: 'monstrosity',
            alignment: 'unaligned',
            ac: [{ ac: 14, from: ['natural armor'] }],
            hp: { average: 45, formula: '6d8 + 18' },
            speed: { walk: 30 },
            str: 16,
            dex: 14,
            con: 16,
            int: 6,
            wis: 12,
            cha: 8,
            cr: '2',
            crNumeric: 2,
            passive: 11,
            trait: [
              {
                name: 'Keen Senses',
                entries: ['The creature has advantage on Wisdom (Perception) checks.']
              }
            ],
            action: [
              {
                name: 'Multiattack',
                entries: ['The creature makes two melee attacks.']
              },
              {
                name: 'Claw',
                entries: ['Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 7 (1d8 + 3) slashing damage.']
              }
            ]
          }
        ];
        break;

      case 'spells':
        scaffold.spells = [
          {
            id: `spell_${cleanCode.toLowerCase()}_sample_spell`,
            name: 'Sample Homebrew Spell',
            source: cleanCode,
            level: 1,
            school: 'Evocation',
            time: [{ number: 1, unit: 'action' }],
            range: { type: 'point', distance: { type: 'feet', amount: 60 } },
            components: { v: true, s: true },
            duration: [{ type: 'instant' }],
            entries: [
              'A burst of vibrant mystical energy flares at a point you choose. Each creature within 5 feet must make a Dexterity saving throw, taking 2d6 radiant damage on a failed save.'
            ]
          }
        ];
        break;

      case 'items':
        scaffold.items = [
          {
            id: `item_${cleanCode.toLowerCase()}_sample_blade`,
            name: 'Sample Homebrew Weapon',
            source: cleanCode,
            type: 'M',
            rarity: 'uncommon',
            weight: 3,
            entries: [
              'A finely balanced weapon imbued with ancient smithing techniques.'
            ]
          }
        ];
        break;

      default:
        scaffold[category] = [];
        break;
    }

    try {
      fs.writeFileSync(filePath, JSON.stringify(scaffold, null, 2), 'utf8');
    } catch (err) {
      return { success: false, error: `Failed to create file: ${err.message}` };
    }

    let meta = this.config.customSources.find(
      c => c.fileName === fileName && c.category === category
    );
    if (!meta) {
      meta = {
        id: cleanCode,
        name: cleanName,
        category,
        fileName,
        author: cleanAuthor,
        version: '1.0.0',
        description: cleanDesc
      };
      this.config.customSources.push(meta);
    }
    this.saveConfig();

    return {
      success: true,
      source: {
        code: cleanCode,
        name: cleanName,
        category,
        filePath,
        fileName
      }
    };
  }

  deleteCustomSource(category, sourceCode) {
    const cleanCode = String(sourceCode).trim().toUpperCase();
    const all = this.getAllSources();
    const cat = all.categories.find(c => c.id === category);
    if (!cat) return { success: false, error: `Category '${category}' not found.` };

    const src = cat.sources.find(s => s.code === cleanCode);
    if (!src) return { success: false, error: `Source '${cleanCode}' not found.` };

    if (!src.isCustom) {
      return { success: false, error: 'Built-in official sourcebooks cannot be deleted. You can toggle them Off.' };
    }

    try {
      if (fs.existsSync(src.filePath)) {
        fs.unlinkSync(src.filePath);
      }
    } catch (e) {
      return { success: false, error: `Failed to remove file: ${e.message}` };
    }

    this.config.customSources = (this.config.customSources || []).filter(
      c => !(c.fileName === src.fileName && c.category === category)
    );

    if (this.config.disabledSources.global) {
      this.config.disabledSources.global = this.config.disabledSources.global.filter(
        c => c.toUpperCase() !== cleanCode
      );
    }
    this.saveConfig();

    return { success: true, code: cleanCode, category };
  }

  searchCompendium(category, query = '', limit = 30) {
    const cleanQuery = (query || '').toLowerCase().trim();
    if (!this.catalogCache) this.catalogCache = {};

    let list = this.catalogCache[category];
    if (!list) {
      try {
        const catalogFileMap = {
          bestiary: 'bestiary-catalog.json',
          spells: 'spells-catalog.json',
          items: 'items-catalog.json',
          classes: 'classes-catalog.json',
          races: 'races-catalog.json',
          feats: 'feats-catalog.json',
          backgrounds: 'backgrounds-catalog.json',
          adventures: 'adventures.json'
        };

        const targetFile = catalogFileMap[category] || 'bestiary-catalog.json';
        const fullPath = path.join(this.dataDir, targetFile);
        if (fs.existsSync(fullPath)) {
          const parsed = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
          list = Array.isArray(parsed) ? parsed : (parsed.items || parsed[category] || Object.values(parsed).find(v => Array.isArray(v)) || []);
          this.catalogCache[category] = list;
        } else {
          list = [];
        }
      } catch (err) {
        console.error(`[SourceManager] Error loading catalog for search (${category}):`, err);
        list = [];
      }
    }

    const matches = [];
    for (const item of (list || [])) {
      const name = item.name || item.id || '';
      const source = item.source || '';
      if (!cleanQuery || name.toLowerCase().includes(cleanQuery) || source.toLowerCase().includes(cleanQuery)) {
        let summary = '';
        if (category === 'bestiary') summary = `CR ${item.cr ?? '—'} • ${item.size || ''} ${item.type || ''}`.trim();
        else if (category === 'spells') summary = `${item.level === 0 ? 'Cantrip' : 'Level ' + item.level} • ${item.school || ''}`.trim();
        else if (category === 'items') summary = `${item.rarity || 'Mundane'} • ${item.type || 'Item'}`.trim();
        else if (category === 'classes') summary = `Hit Die ${item.hitDie || 'd8'}`;
        else if (category === 'races') summary = `Speed ${item.speed?.walk || item.speed || 30} ft`;
        else summary = source;

        matches.push({
          id: item.id || `${name}_${source}`,
          name,
          source,
          category,
          summary,
          item
        });
        if (matches.length >= limit) break;
      }
    }

    return { success: true, results: matches };
  }

  getEntityFullData(category, name, source) {
    const cleanName = (name || '').toLowerCase().trim();
    const cleanSource = (source || '').toLowerCase().trim();

    try {
      const normalizedDirMap = {
        bestiary: 'bestiary-normalized',
        spells: 'spells-normalized',
        items: 'items-normalized',
        classes: 'classes-normalized',
        races: 'races-normalized',
        feats: 'feats-normalized',
        backgrounds: 'backgrounds-normalized'
      };

      const folderName = normalizedDirMap[category];
      if (folderName) {
        const partitionPath = path.join(this.dataDir, folderName, `${category}-${cleanSource}.json`);
        if (fs.existsSync(partitionPath)) {
          const content = JSON.parse(fs.readFileSync(partitionPath, 'utf8'));
          const arr = Array.isArray(content) ? content : (content[category] || content.monster || content.spell || content.item || Object.values(content).find(v => Array.isArray(v)) || []);
          const match = arr.find(e => (e.name || '').toLowerCase().trim() === cleanName);
          if (match) return { success: true, data: match, entity: match };
        }
      }

      if (this.catalogCache && this.catalogCache[category]) {
        const match = this.catalogCache[category].find(e =>
          (e.name || '').toLowerCase().trim() === cleanName &&
          (!cleanSource || (e.source || '').toLowerCase().trim() === cleanSource)
        );
        if (match) return { success: true, data: match, entity: match };
      }
    } catch (e) {
      console.error(`[SourceManager] Error retrieving full entity data:`, e);
    }

    return { success: false, error: 'Entity data not found' };
  }

  exportSource(category, code, targetPath) {
    const details = this.getSourceDetails(category, code);
    if (!details || !details.success) {
      return { success: false, error: details?.error || 'Source not found.' };
    }

    try {
      fs.writeFileSync(targetPath, details.rawJson, 'utf8');
      return { success: true, path: targetPath, filePath: targetPath };
    } catch (err) {
      return { success: false, error: `Failed to export: ${err.message}` };
    }
  }

  saveAssetImage(tempFilePath) {
    try {
      const assetsDir = path.join(this.campaignDataDir, 'assets', 'tokens');
      if (!fs.existsSync(assetsDir)) {
        fs.mkdirSync(assetsDir, { recursive: true });
      }

      const ext = path.extname(tempFilePath) || '.png';
      const destName = `token-${Date.now()}-${Math.random().toString(36).slice(2, 7)}${ext}`;
      const destPath = path.join(assetsDir, destName);
      fs.copyFileSync(tempFilePath, destPath);

      return {
        success: true,
        webPath: `/assets/tokens/${destName}`,
        localPath: destPath
      };
    } catch (err) {
      return { success: false, error: `Failed to save asset: ${err.message}` };
    }
  }

  searchAllCompendium(query, options = {}) {
    const cleanQuery = (query || '').toLowerCase().trim();
    if (!cleanQuery) return { success: true, results: [] };

    const limit = options.limit || 40;
    const requestedCategory = options.category || null;
    const categoriesToSearch = requestedCategory
      ? [requestedCategory]
      : ['bestiary', 'spells', 'items', 'classes', 'races', 'feats', 'backgrounds', 'adventures'];

    const matches = [];

    for (const cat of categoriesToSearch) {
      const searchRes = this.searchCompendium(cat, cleanQuery, 20);
      if (searchRes && searchRes.results) {
        for (const item of searchRes.results) {
          matches.push({
            id: item.id,
            name: item.name,
            source: item.source,
            category: cat,
            summary: item.summary,
            details: item.summary
          });
          if (matches.length >= limit) break;
        }
      }
      if (matches.length >= limit) break;
    }

    return { success: true, results: matches };
  }

  getFormattedStatblock(category, name, source) {
    const fullRes = this.getEntityFullData(category, name, source);
    let entity = fullRes?.entity;

    // If not found in partition, fallback to catalogCache
    if (!entity && this.catalogCache && this.catalogCache[category]) {
      const cleanName = (name || '').toLowerCase().trim();
      const cleanSource = (source || '').toLowerCase().trim();
      entity = this.catalogCache[category].find(e =>
        (e.name || '').toLowerCase().trim() === cleanName &&
        (!cleanSource || (e.source || '').toLowerCase().trim() === cleanSource)
      );
    }

    if (!entity) {
      return { success: false, error: fullRes?.error || 'Entity not found' };
    }

    let statblock = { ...entity };
    if (category === 'bestiary') {
      const primaryAc = entity.primaryAc !== undefined
        ? entity.primaryAc
        : (Array.isArray(entity.ac)
          ? (typeof entity.ac[0] === 'object' ? entity.ac[0]?.value : entity.ac[0])
          : entity.ac);

      const acCondition = entity.acCondition || (Array.isArray(entity.ac) && entity.ac[0]?.condition) || '';

      const hpAvg = entity.hp && typeof entity.hp === 'object'
        ? (entity.hp.average || entity.hpAvg || 10)
        : (typeof entity.hp === 'number' ? entity.hp : (entity.hpAvg || 10));

      const hpFormula = (entity.hp && typeof entity.hp === 'object' && entity.hp.formula)
        ? entity.hp.formula
        : (entity.hpFormula || '');

      const speedWalk = (entity.speed && typeof entity.speed === 'object') ? (entity.speed.walk || 30) : (entity.speedWalk || 30);
      const speedFly = (entity.speed && typeof entity.speed === 'object') ? (entity.speed.fly || 0) : (entity.speedFly || 0);
      const speedSwim = (entity.speed && typeof entity.speed === 'object') ? (entity.speed.swim || 0) : (entity.speedSwim || 0);
      const speedClimb = (entity.speed && typeof entity.speed === 'object') ? (entity.speed.climb || 0) : (entity.speedClimb || 0);
      const speedBurrow = (entity.speed && typeof entity.speed === 'object') ? (entity.speed.burrow || 0) : (entity.speedBurrow || 0);

      const formatCardItems = (arr) => {
        if (!Array.isArray(arr)) return [];
        return arr.map(item => ({
          name: item.name || 'Action',
          text: item.text || item.descriptionHtml?.replace(/<[^>]*>/g, '') || (Array.isArray(item.entries) ? item.entries.join('\n') : '')
        }));
      };

      statblock = {
        ...entity,
        name: entity.name || name,
        source: entity.source || source,
        ac: primaryAc || 10,
        acCondition,
        hpAvg,
        hpFormula,
        speedWalk,
        speedFly,
        speedSwim,
        speedClimb,
        speedBurrow,
        str: entity.str || (entity.abilities?.str?.score) || 10,
        dex: entity.dex || (entity.abilities?.dex?.score) || 10,
        con: entity.con || (entity.abilities?.con?.score) || 10,
        int: entity.int || (entity.abilities?.int?.score) || 10,
        wis: entity.wis || (entity.abilities?.wis?.score) || 10,
        cha: entity.cha || (entity.abilities?.cha?.score) || 10,
        senses: Array.isArray(entity.senses) ? entity.senses.join(', ') : (entity.senses?.sensesString || entity.senses || ''),
        languages: Array.isArray(entity.languages) ? entity.languages.join(', ') : (entity.languages || ''),
        traits: formatCardItems(entity.traits),
        actions: formatCardItems(entity.actions),
        reactions: formatCardItems(entity.reactions),
        legendaryActions: formatCardItems(entity.legendaryActions?.entries || entity.legendaryActions)
      };
    }

    return {
      success: true,
      category,
      name: statblock.name || name,
      source: statblock.source || source,
      statblock,
      entity: statblock
    };
  }

  inspectImportFiles(inputPaths = []) {
    const tempDir = path.join(this.campaignDataDir, 'scratch', 'import-temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const jsonFiles = [];

    const collectJsonFiles = (targetPath) => {
      try {
        if (!fs.existsSync(targetPath)) return;
        const stat = fs.statSync(targetPath);
        if (stat.isDirectory()) {
          const entries = fs.readdirSync(targetPath);
          for (const entry of entries) {
            collectJsonFiles(path.join(targetPath, entry));
          }
        } else if (stat.isFile()) {
          const ext = path.extname(targetPath).toLowerCase();
          if (ext === '.json') {
            jsonFiles.push(targetPath);
          } else if (ext === '.zip') {
            const extractDir = path.join(tempDir, `zip-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
            fs.mkdirSync(extractDir, { recursive: true });
            try {
              execFileSync('tar.exe', ['-xf', targetPath, '-C', extractDir], { stdio: 'ignore' });
              collectJsonFiles(extractDir);
            } catch (err) {
              console.warn('[SourceManager] Failed to extract zip with tar:', err);
            }
          }
        }
      } catch (err) {
        console.warn(`[SourceManager] Error inspecting path: ${targetPath}`, err);
      }
    };

    for (const p of inputPaths) {
      collectJsonFiles(p);
    }

    const inspected = [];

    for (const filePath of jsonFiles) {
      try {
        const contentStr = fs.readFileSync(filePath, 'utf8');
        const parsed = JSON.parse(contentStr);

        const fileName = path.basename(filePath);
        let category = 'bestiary';
        let detectedSource = 'HOMEBREW';
        let entryCount = 0;

        // Detect 5eTools category
        if (parsed.monster || (Array.isArray(parsed) && parsed[0]?.cr !== undefined)) {
          category = 'bestiary';
          entryCount = parsed.monster ? parsed.monster.length : parsed.length;
        } else if (parsed.spell || (Array.isArray(parsed) && parsed[0]?.school !== undefined)) {
          category = 'spells';
          entryCount = parsed.spell ? parsed.spell.length : parsed.length;
        } else if (parsed.item || parsed.baseitem || (Array.isArray(parsed) && (parsed[0]?.rarity !== undefined || parsed[0]?.reqAttune !== undefined))) {
          category = 'items';
          entryCount = parsed.item ? parsed.item.length : parsed.length;
        } else if (parsed.class || parsed.subclass || (Array.isArray(parsed) && parsed[0]?.hd !== undefined)) {
          category = 'classes';
          entryCount = parsed.class ? parsed.class.length : (parsed.subclass ? parsed.subclass.length : parsed.length);
        } else if (parsed.race || (Array.isArray(parsed) && parsed[0]?.raceName !== undefined)) {
          category = 'races';
          entryCount = parsed.race ? parsed.race.length : parsed.length;
        } else if (parsed.feat || (Array.isArray(parsed) && parsed[0]?.prerequisite !== undefined)) {
          category = 'feats';
          entryCount = parsed.feat ? parsed.feat.length : parsed.length;
        } else if (parsed.background || (Array.isArray(parsed) && parsed[0]?.skillProficiencies !== undefined)) {
          category = 'backgrounds';
          entryCount = parsed.background ? parsed.background.length : parsed.length;
        } else if (parsed.adventure || parsed.data || (Array.isArray(parsed) && parsed[0]?.story !== undefined)) {
          category = 'adventures';
          entryCount = parsed.adventure ? parsed.adventure.length : (parsed.data ? parsed.data.length : parsed.length);
        } else {
          const lower = fileName.toLowerCase();
          if (lower.includes('bestiary') || lower.includes('monster')) category = 'bestiary';
          else if (lower.includes('spell')) category = 'spells';
          else if (lower.includes('item')) category = 'items';
          else if (lower.includes('class')) category = 'classes';
          else if (lower.includes('race')) category = 'races';
          else if (lower.includes('feat')) category = 'feats';
          else if (lower.includes('background')) category = 'backgrounds';
          else if (lower.includes('adventure') || lower.includes('book')) category = 'adventures';

          if (Array.isArray(parsed)) entryCount = parsed.length;
          else if (typeof parsed === 'object' && parsed !== null) {
            const arr = Object.values(parsed).find(v => Array.isArray(v));
            entryCount = arr ? arr.length : 1;
          }
        }

        // Detect source code
        if (parsed._meta?.sources?.[0]?.json) {
          detectedSource = parsed._meta.sources[0].json.toUpperCase();
        } else {
          const firstItem = Array.isArray(parsed) ? parsed[0] : Object.values(parsed).find(v => Array.isArray(v))?.[0];
          if (firstItem?.source) {
            detectedSource = String(firstItem.source).toUpperCase();
          } else {
            detectedSource = fileName.replace(/\.json$/i, '').toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 12) || 'CUSTOM';
          }
        }

        const targetDir = path.join(this.campaignDataDir, 'sources', category);
        const targetFile = path.join(targetDir, fileName);
        const hasConflict = fs.existsSync(targetFile);

        inspected.push({
          filePath,
          originalPath: filePath,
          fileName,
          category,
          detectedCategory: category,
          sourceCode: detectedSource,
          detectedSource,
          entryCount,
          hasConflict
        });
      } catch (err) {
        console.warn(`[SourceManager] Could not parse JSON file: ${filePath}`, err);
      }
    }

    return {
      success: true,
      candidates: inspected,
      files: inspected
    };
  }

  bulkImportSources(candidates = [], conflictDecisions = {}) {
    let imported = 0;
    let skipped = 0;
    const results = [];

    for (const item of candidates) {
      try {
        const cat = item.category || item.detectedCategory || 'bestiary';
        const targetDir = path.join(this.campaignDataDir, 'sources', cat);
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }

        let finalFileName = item.fileName;
        let destPath = path.join(targetDir, finalFileName);
        const srcPath = item.filePath || item.originalPath;

        if (!srcPath || !fs.existsSync(srcPath)) {
          results.push({ fileName: item.fileName, status: 'error', error: 'Source file does not exist' });
          continue;
        }

        if (fs.existsSync(destPath)) {
          const decision = conflictDecisions[srcPath] || conflictDecisions[item.fileName] || conflictDecisions[item.originalPath] || 'overwrite';
          if (decision === 'skip') {
            skipped++;
            results.push({ fileName: item.fileName, status: 'skipped' });
            continue;
          } else if (decision === 'rename') {
            const ext = path.extname(item.fileName);
            const base = path.basename(item.fileName, ext);
            let counter = 1;
            while (fs.existsSync(destPath)) {
              finalFileName = `${base}_copy${counter > 1 ? counter : ''}${ext}`;
              destPath = path.join(targetDir, finalFileName);
              counter++;
            }
          }
        }

        fs.copyFileSync(srcPath, destPath);

        const code = (item.sourceCode || item.detectedSource || 'CUSTOM').toUpperCase();
        const existingCustom = this.config.customSources.find(s => s.category === cat && s.code === code && s.fileName === finalFileName);
        if (!existingCustom) {
          this.config.customSources.push({
            id: `custom_${cat}_${code.toLowerCase()}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            category: cat,
            code,
            name: `${code} Compendium`,
            author: 'Imported',
            version: '1.0.0',
            description: `Bulk imported on ${new Date().toLocaleDateString()}`,
            fileName: finalFileName,
            filePath: destPath,
            isCustom: true,
            createdAt: new Date().toISOString()
          });
        }

        imported++;
        results.push({ fileName: item.fileName, finalFileName, category: cat, status: 'imported' });
      } catch (err) {
        console.error(`[SourceManager] Failed to import file ${item.fileName}:`, err);
        results.push({ fileName: item.fileName, status: 'error', error: err.message });
      }
    }

    this.saveConfig();
    this.cachedBuiltinCategories = null;

    return {
      success: true,
      importedCount: imported,
      skippedCount: skipped,
      results
    };
  }
}
