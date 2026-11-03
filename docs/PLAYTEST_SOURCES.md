# ForgeDVTT Playtester Compendium & Source Directory

Welcome to the ForgeDVTT playtest! This document provides direct raw JSON URLs to easily import official rulesets, partnered third-party sourcebooks, playtest materials, and community supplements into your ForgeDVTT client.

---

## ⚡ Quick-Start: How to Import (3 Steps)

1. **Copy a URL:** Find any sourcebook or compendium in the tables below and copy its raw JSON link.
2. **Open ForgeDVTT Sources:**
   - In ForgeDVTT, go to the **Sources / Compendium** manager on the left navigation bar.
   - Click the **"🌐 Import from URL"** button at the top right.
3. **Download & Integrate:**
   - Paste the link into the **Sourcebook JSON Web URL** input field.
   - *(Optional)* Expand **Provenance & Licensing Details** to inspect detected metadata or provide custom notes.
   - Click **"🚀 Download & Import"**. The content will validate and immediately appear in your bestiary, spellbook, or items library.

> [!NOTE]
> ForgeDVTT does not require an active internet connection after a source is imported. The JSON data is saved locally on your computer inside your campaign data directory.

---

## 🌟 Recommended Starter Pack (Top 5 Essential Links)

If you're jumping into a playtest session and want a well-rounded compendium without importing everything at once, we recommend importing these 5 core sources first:

| Essential Sourcebook | Category | Direct Raw URL |
| :--- | :--- | :--- |
| **1. Player's Handbook Spells** | Spells | `https://raw.githubusercontent.com/5etools-mirror-2/5etools-2.github.io/master/data/spells/spells-phb.json` |
| **2. Monster Manual Creatures** | Bestiary | `https://raw.githubusercontent.com/5etools-mirror-2/5etools-2.github.io/master/data/bestiary/bestiary-mm.json` |
| **3. Core Magic Items & Gear** | Equipment | `https://raw.githubusercontent.com/5etools-mirror-2/5etools-2.github.io/master/data/items.json` |
| **4. MCDM's Flee, Mortals!** | Action Bestiary | `https://raw.githubusercontent.com/TheGiddyLimit/homebrew/master/partnered/MCDM%20Productions%3B%20Flee%2C%20Mortals!.json` |
| **5. The Griffon's Saddlebag (Bk 1)** | Magic Items | `https://raw.githubusercontent.com/TheGiddyLimit/homebrew/master/partnered/Griffin%20Macaulay%3B%20The%20Griffon's%20Saddlebag%2C%20Book%201%20-%202024.json` |

---

## 1. Core 5e Ruleset Compendiums (5e.tools Mirror Data)

### A. Bestiary & Monsters by Publication
| Publication | Code | Description | Direct Raw JSON URL |
| :--- | :--- | :--- | :--- |
| **Monster Manual (MM)** | `MM` | Core 5e monster stat blocks | `https://raw.githubusercontent.com/5etools-mirror-2/5etools-2.github.io/master/data/bestiary/bestiary-mm.json` |
| **Monsters of the Multiverse (MPMM)** | `MPMM` | Modern revised stat blocks & playable species | `https://raw.githubusercontent.com/5etools-mirror-2/5etools-2.github.io/master/data/bestiary/bestiary-mpmm.json` |
| **Volo's Guide to Monsters (VGM)** | `VGM` | Classic monster lore & monstrous stat blocks | `https://raw.githubusercontent.com/5etools-mirror-2/5etools-2.github.io/master/data/bestiary/bestiary-vgm.json` |
| **Mordenkainen's Tome of Foes (MTF)** | `MTF` | Extraplanar & high-level legendary foes | `https://raw.githubusercontent.com/5etools-mirror-2/5etools-2.github.io/master/data/bestiary/bestiary-mtf.json` |
| **Fizban's Treasury of Dragons (FTD)** | `FTD` | Chromatic, metallic, gem dragons & draconic minions | `https://raw.githubusercontent.com/5etools-mirror-2/5etools-2.github.io/master/data/bestiary/bestiary-ftd.json` |
| **Bigby Presents: Glory of the Giants (BGG)** | `BGG` | Giant types, runic champions & elemental brutes | `https://raw.githubusercontent.com/5etools-mirror-2/5etools-2.github.io/master/data/bestiary/bestiary-bgg.json` |
| **Curse of Strahd Bestiary (CoS)** | `CoS` | Barovian horrors, gothic undead & Strahd von Zarovich | `https://raw.githubusercontent.com/5etools-mirror-2/5etools-2.github.io/master/data/bestiary/bestiary-cos.json` |

### B. Spell Compendiums by Publication
| Publication | Code | Direct Raw JSON URL |
| :--- | :--- | :--- |
| **Player's Handbook Spells (PHB)** | `PHB` | `https://raw.githubusercontent.com/5etools-mirror-2/5etools-2.github.io/master/data/spells/spells-phb.json` |
| **Xanathar's Guide to Everything (XGE)** | `XGE` | `https://raw.githubusercontent.com/5etools-mirror-2/5etools-2.github.io/master/data/spells/spells-xge.json` |
| **Tasha's Cauldron of Everything (TCE)** | `TCE` | `https://raw.githubusercontent.com/5etools-mirror-2/5etools-2.github.io/master/data/spells/spells-tce.json` |
| **Fizban's Treasury of Dragons (FTD)** | `FTD` | `https://raw.githubusercontent.com/5etools-mirror-2/5etools-2.github.io/master/data/spells/spells-ftd.json` |
| **Explorer's Guide to Wildemount (EGW)** | `EGW` | `https://raw.githubusercontent.com/5etools-mirror-2/5etools-2.github.io/master/data/spells/spells-egw.json` |
| **Acquisitions Incorporated (AI)** | `AI` | `https://raw.githubusercontent.com/5etools-mirror-2/5etools-2.github.io/master/data/spells/spells-ai.json` |

### C. Character Options & Equipment Catalogs
| Catalog | Content | Direct Raw JSON URL |
| :--- | :--- | :--- |
| **All Magic Items & Artifacts** | Weapons, armor, rods, wands, wondrous items | `https://raw.githubusercontent.com/5etools-mirror-2/5etools-2.github.io/master/data/items.json` |
| **Base Mundane Items & Gear** | Nonmagical weapons, armor, adventuring gear, tools | `https://raw.githubusercontent.com/5etools-mirror-2/5etools-2.github.io/master/data/items-base.json` |
| **Generic Magic Variants** | +1, +2, +3 weapons & enchanted armor variants | `https://raw.githubusercontent.com/5etools-mirror-2/5etools-2.github.io/master/data/magicvariants.json` |
| **Player Species & Lineages** | Core & supplemental races, subraces, lineages | `https://raw.githubusercontent.com/5etools-mirror-2/5etools-2.github.io/master/data/races.json` |
| **Feats & Supernal Gifts** | General feats, racial feats, epic boons | `https://raw.githubusercontent.com/5etools-mirror-2/5etools-2.github.io/master/data/feats.json` |
| **Origins & Backgrounds** | Character backgrounds, tool/skill proficiencies | `https://raw.githubusercontent.com/5etools-mirror-2/5etools-2.github.io/master/data/backgrounds.json` |

### D. Individual Core Class Definitions
| Class | Direct Raw JSON URL |
| :--- | :--- |
| **Wizard** | `https://raw.githubusercontent.com/5etools-mirror-2/5etools-2.github.io/master/data/class/class-wizard.json` |
| **Fighter** | `https://raw.githubusercontent.com/5etools-mirror-2/5etools-2.github.io/master/data/class/class-fighter.json` |
| **Cleric** | `https://raw.githubusercontent.com/5etools-mirror-2/5etools-2.github.io/master/data/class/class-cleric.json` |
| **Rogue** | `https://raw.githubusercontent.com/5etools-mirror-2/5etools-2.github.io/master/data/class/class-rogue.json` |
| **Paladin** | `https://raw.githubusercontent.com/5etools-mirror-2/5etools-2.github.io/master/data/class/class-paladin.json` |
| **Barbarian** | `https://raw.githubusercontent.com/5etools-mirror-2/5etools-2.github.io/master/data/class/class-barbarian.json` |
| **Bard** | `https://raw.githubusercontent.com/5etools-mirror-2/5etools-2.github.io/master/data/class/class-bard.json` |
| **Druid** | `https://raw.githubusercontent.com/5etools-mirror-2/5etools-2.github.io/master/data/class/class-druid.json` |
| **Monk** | `https://raw.githubusercontent.com/5etools-mirror-2/5etools-2.github.io/master/data/class/class-monk.json` |
| **Ranger** | `https://raw.githubusercontent.com/5etools-mirror-2/5etools-2.github.io/master/data/class/class-ranger.json` |
| **Sorcerer** | `https://raw.githubusercontent.com/5etools-mirror-2/5etools-2.github.io/master/data/class/class-sorcerer.json` |
| **Warlock** | `https://raw.githubusercontent.com/5etools-mirror-2/5etools-2.github.io/master/data/class/class-warlock.json` |
| **Artificer** | `https://raw.githubusercontent.com/5etools-mirror-2/5etools-2.github.io/master/data/class/class-artificer.json` |

---

## 2. Partnered Third-Party Publishers

### A. MCDM Productions
| Module | Category | Code | Direct Raw JSON URL |
| :--- | :--- | :--- | :--- |
| **Flee, Mortals!** | Bestiary | `FLEEMORTALS` | `https://raw.githubusercontent.com/TheGiddyLimit/homebrew/master/partnered/MCDM%20Productions%3B%20Flee%2C%20Mortals!.json` |
| **Where Evil Lives** | Encounters / Adv | `WHEREEVILLIVES` | `https://raw.githubusercontent.com/TheGiddyLimit/homebrew/master/partnered/MCDM%20Productions%3B%20Where%20Evil%20Lives.json` |
| **The Illrigger Revised** | Class | `ILLRIGGERREVISED` | `https://raw.githubusercontent.com/TheGiddyLimit/homebrew/master/partnered/MCDM%20Productions%3B%20The%20Illrigger%20Revised.json` |

### B. Kobold Press
| Module | Category | Code | Direct Raw JSON URL |
| :--- | :--- | :--- | :--- |
| **Tome of Beasts 1 (2023 Edition)** | Bestiary | `TOB1-2023` | `https://raw.githubusercontent.com/TheGiddyLimit/homebrew/master/partnered/Kobold%20Press%3B%20Tome%20of%20Beasts%201%20(2023%20Edition).json` |
| **Book of Ebon Tides** | Spells / Options | `BOOKOFEBONTIDES` | `https://raw.githubusercontent.com/TheGiddyLimit/homebrew/master/partnered/Kobold%20Press%3B%20Book%20of%20Ebon%20Tides.json` |
| **Tales from the Shadows** | Adventures | `TALESFROMTHESHADOWS` | `https://raw.githubusercontent.com/TheGiddyLimit/homebrew/master/partnered/Kobold%20Press%3B%20Tales%20from%20the%20Shadows.json` |
| **Northlands Worldbook** | Player Options | `NORTHLANDSWORLDBOOK` | `https://raw.githubusercontent.com/TheGiddyLimit/homebrew/master/partnered/Kobold%20Press%3B%20Northlands%20Worldbook.json` |
| **Northlands Sagas** | Adventures | `NORTHLANDSSAGAS` | `https://raw.githubusercontent.com/TheGiddyLimit/homebrew/master/partnered/Kobold%20Press%3B%20Northlands%20Sagas.json` |

### C. Ghostfire Gaming (Drakkenheim & Grim Hollow)
| Module | Category | Code | Direct Raw JSON URL |
| :--- | :--- | :--- | :--- |
| **Dungeons of Drakkenheim** | Campaign / Spells | `DUNGEONSDRAKKENHEIM` | `https://raw.githubusercontent.com/TheGiddyLimit/homebrew/master/partnered/Ghostfire%20Gaming%3B%20Dungeons%20of%20Drakkenheim.json` |
| **Monsters of Drakkenheim** | Bestiary | `MONSTERSOFDRAKKENHEIM` | `https://raw.githubusercontent.com/TheGiddyLimit/homebrew/master/partnered/Ghostfire%20Gaming%3B%20Monsters%20of%20Drakkenheim.json` |
| **In Search of the Smuggler's Secrets** | Adventure | `DODKSEARCHSMUGGLERSSECRETS` | `https://raw.githubusercontent.com/TheGiddyLimit/homebrew/master/partnered/Ghostfire%20Gaming%3B%20Dungeons%20of%20Drakkenheim%20In%20Search%20of%20the%20Smuggler's%20Secrets.json` |
| **Grim Hollow: Player's Guide (2024)** | Subclasses / Feats | `GRIMHOLLOWPG24` | `https://raw.githubusercontent.com/TheGiddyLimit/homebrew/master/partnered/Ghostfire%20Gaming%3B%20Grim%20Hollow%20-%20Player's%20Guide%20-%202024.json` |
| **Grim Hollow: Campaign Guide (2024)** | Spells / Setting | `GRIMHOLLOWCG24` | `https://raw.githubusercontent.com/TheGiddyLimit/homebrew/master/partnered/Ghostfire%20Gaming%3B%20Grim%20Hollow%20-%20Campaign%20Guide%20-%202024.json` |
| **Grim Hollow: Lairs of Etharis** | Bestiary / Adv | `GRIMHOLLOWLAIRSETHARIS` | `https://raw.githubusercontent.com/TheGiddyLimit/homebrew/master/partnered/Ghostfire%20Gaming%3B%20Grim%20Hollow%20-%20Lairs%20of%20Etharis.json` |
| **Vampire: The Masquerade - Bound by Blood** | Options / Rules | `BOUNDBYBLOOD` | `https://raw.githubusercontent.com/TheGiddyLimit/homebrew/master/partnered/Ghostfire%20Gaming%3B%20Vampire%20-%20The%20Masquerade%20-%20Bound%20by%20Blood.json` |

### D. The Griffon's Saddlebag
| Module | Category | Code | Direct Raw JSON URL |
| :--- | :--- | :--- | :--- |
| **The Griffon's Saddlebag: Book 1 (2024)** | Magic Items | `24GRIFFONSSADDLEBAG1` | `https://raw.githubusercontent.com/TheGiddyLimit/homebrew/master/partnered/Griffin%20Macaulay%3B%20The%20Griffon's%20Saddlebag%2C%20Book%201%20-%202024.json` |
| **The Griffon's Saddlebag: Book 2** | Magic Items | `GRIFFONSSADDLEBAG2` | `https://raw.githubusercontent.com/TheGiddyLimit/homebrew/master/partnered/Griffin%20Macaulay%3B%20The%20Griffon's%20Saddlebag%2C%20Book%202.json` |

### E. Keith Baker (Eberron)
| Module | Category | Code | Direct Raw JSON URL |
| :--- | :--- | :--- | :--- |
| **Exploring Eberron (2024 Revision)** | Races / Classes | `EXPLORINGEBERRON24` | `https://raw.githubusercontent.com/TheGiddyLimit/homebrew/master/partnered/Keith%20Baker%3B%20Exploring%20Eberron%20-%202024.json` |
| **Frontiers of Eberron: Quickstone** | Campaign / Lore | `FOEQUICKSTONE` | `https://raw.githubusercontent.com/TheGiddyLimit/homebrew/master/partnered/Keith%20Baker%3B%20Frontiers%20of%20Eberron%20Quickstone.json` |

### F. Darrington Press (Critical Role: Exandria)
| Module | Category | Code | Direct Raw JSON URL |
| :--- | :--- | :--- | :--- |
| **Tal'Dorei Campaign Setting Reborn** | Classes / Feats / Bestiary | `TALDOREICAMPAIGNSETTINGREBORN` | `https://raw.githubusercontent.com/TheGiddyLimit/homebrew/master/partnered/Darrington%20Press%3B%20Tal'Dorei%20Campaign%20Setting%20Reborn.json` |

### G. Hit Point Press, Loot Tavern & Avantris
| Module | Category | Code | Direct Raw JSON URL |
| :--- | :--- | :--- | :--- |
| **Humblewood Campaign Setting** | Races / Classes / Bestiary | `HUMBLEWOODCAMPAIGNSETTING` | `https://raw.githubusercontent.com/TheGiddyLimit/homebrew/master/partnered/Hit%20Point%20Press%3B%20Humblewood%20Campaign%20Setting.json` |
| **Humblewood Tales** | Expanded Options | `HUMBLEWOODTALES` | `https://raw.githubusercontent.com/TheGiddyLimit/homebrew/master/partnered/Hit%20Point%20Press%3B%20Humblewood%20Tales.json` |
| **Heliana's Guide to Monster Hunting** | Crafting / Bestiary | `HELIANASGUIDETOMONSTERHUNTING` | `https://raw.githubusercontent.com/TheGiddyLimit/homebrew/master/partnered/Loot%20Tavern%3B%20Heliana's%20Guide%20To%20Monster%20Hunting.json` |
| **Crooked Moon (Avantris Folk Horror)** | Subclasses / Monsters | `CROOKEDMOON24` | `https://raw.githubusercontent.com/TheGiddyLimit/homebrew/master/partnered/Avantris%3B%20Crooked%20Moon.json` |

### H. Mage Hand Press, Benjamin Huffman & MonkeyDM
| Module | Category | Code | Direct Raw JSON URL |
| :--- | :--- | :--- | :--- |
| **The Pugilist (2024 Revision)** | Class | `PUGILIST2024` | `https://raw.githubusercontent.com/TheGiddyLimit/homebrew/master/partnered/Benjamin%20Huffman%3B%20The%20Pugilist%20-%202024.json` |
| **Valda's Spire of Secrets (Player Pack 1)** | Classes / Spells | `VALDASPIREOFSECRETS` | `https://raw.githubusercontent.com/TheGiddyLimit/homebrew/master/partnered/Mage%20Hand%20Press%3B%20Valda's%20Spire%20of%20Secrets%20-%20Player%20Pack.json` |
| **Valda's Spire of Secrets (Player Pack 2)** | Classes / Subclasses | `VALDAPLAYERPACK2` | `https://raw.githubusercontent.com/TheGiddyLimit/homebrew/master/partnered/Mage%20Hand%20Press%3B%20Valda's%20Spire%20of%20Secrets%20-%20Player%20Pack%202.json` |
| **Gunslinger Class** | Class | `VALDAGUNSLINGER` | `https://raw.githubusercontent.com/TheGiddyLimit/homebrew/master/partnered/Mage%20Hand%20Press%3B%20Gunslinger.json` |
| **Steinhardt's Guide to the Eldritch Hunt** | Player Pack / Items | `STEINHARDTGUIDE` | `https://raw.githubusercontent.com/TheGiddyLimit/homebrew/master/partnered/MonkeyDM%3B%20Steinhardt's%20Guide%20to%20the%20Eldritch%20Hunt%20Player%20Pack.json` |

### I. Other Partnered Compendiums
| Module | Category | Code | Direct Raw JSON URL |
| :--- | :--- | :--- | :--- |
| **The Lord of the Rings Roleplaying** *(Free League)* | Classes / Options | `TLOTRR` | `https://raw.githubusercontent.com/TheGiddyLimit/homebrew/master/partnered/Free%20League%3B%20The%20Lord%20of%20the%20Rings%20Roleplaying.json` |
| **Ruins of Symbaroum Setting Handbook** | Classes / Feats | `SYMBAROUM` | `https://raw.githubusercontent.com/TheGiddyLimit/homebrew/master/partnered/Free%20League%3B%20Ruins%20of%20Symbaroum%20Setting%20Handbook.json` |
| **Cthulhu by Torchlight** *(Chaosium)* | Rules / Spells | `CTHULHUTORCHLIGHT` | `https://raw.githubusercontent.com/TheGiddyLimit/homebrew/master/partnered/Chaosium%20Inc.%3B%20Cthulhu%20by%20Torchlight.json` |
| **D&D Beyond Drops** *(Digital Extras)* | Items / Options | `DNDBEYONDDROPS` | `https://raw.githubusercontent.com/TheGiddyLimit/homebrew/master/partnered/D%26D%20Beyond%3B%20D%26D%20Beyond%20Drops.json` |
| **One-Shot Wonders: Forest Adventures** | Adventures | `ONESHOTWONDERSFOREST` | `https://raw.githubusercontent.com/TheGiddyLimit/homebrew/master/partnered/Roll%20%26%20Play%20Press%3B%20One%20Shot%20Wonders%20-%2010%20Forest%20One%20Shot%20Adventures.json` |
| **The Malady of Minarrh** | Adventure / Bestiary | `MALADYOFMINARRH` | `https://raw.githubusercontent.com/TheGiddyLimit/homebrew/master/partnered/Road%20to%20Ithaka%20Press%3B%20The%20Malady%20of%20Minarrh.json` |

---

## 3. Unearthed Arcana & Playtest Packets (WotC)

| Playtest Packet | Category | Direct Raw JSON URL |
| :--- | :--- | :--- |
| **Class Feature Variants** *(Original Tasha's UA)* | Class Features | `https://raw.githubusercontent.com/TheGiddyLimit/unearthed-arcana/master/prerelease/Unearthed%20Arcana%20-%20Class%20Feature%20Variants.json` |
| **2022 Wonders of the Multiverse** | Races / Feats | `https://raw.githubusercontent.com/TheGiddyLimit/unearthed-arcana/master/prerelease/Unearthed%20Arcana%20-%202022%20Wonders%20of%20the%20Multiverse.json` |
| **2022 Heroes of Krynn** | Races / Backgrounds | `https://raw.githubusercontent.com/TheGiddyLimit/unearthed-arcana/master/prerelease/Unearthed%20Arcana%20-%202022%20Heroes%20of%20Krynn.json` |
| **2022 Giant Options** | Subclasses / Feats | `https://raw.githubusercontent.com/TheGiddyLimit/unearthed-arcana/master/prerelease/Unearthed%20Arcana%20-%202022%20Giant%20Options.json` |
| **2020 Subclasses, Part 1** | Subclasses | `https://raw.githubusercontent.com/TheGiddyLimit/unearthed-arcana/master/prerelease/Unearthed%20Arcana%20-%202020%20Subclasses%2C%20Part%201.json` |
| **Feats for Races** | Feats | `https://raw.githubusercontent.com/TheGiddyLimit/unearthed-arcana/master/prerelease/Unearthed%20Arcana%20-%20Feats%20for%20Races.json` |
| **Feats for Skills** | Feats | `https://raw.githubusercontent.com/TheGiddyLimit/unearthed-arcana/master/prerelease/Unearthed%20Arcana%20-%20Feats%20for%20Skills.json` |
| **Eladrin and Gith** | Races | `https://raw.githubusercontent.com/TheGiddyLimit/unearthed-arcana/master/prerelease/Unearthed%20Arcana%20-%20Eladrin%20and%20Gith.json` |
| **Centaurs and Minotaurs** | Races | `https://raw.githubusercontent.com/TheGiddyLimit/unearthed-arcana/master/prerelease/Unearthed%20Arcana%20-%20Centaurs%20and%20Minotaurs.json` |

---

## 4. Curated Community Supplements

| Creator & Supplement | Category | Direct Raw JSON URL |
| :--- | :--- | :--- |
| **KibblesTasty: Casting Compendium** | Spells | `https://raw.githubusercontent.com/TheGiddyLimit/homebrew/master/spells/KibblesTasty%3B%20Kibbles'%20Casting%20Compendium.json` |
| **LaserLlama: Alternate Fighter** | Class | `https://raw.githubusercontent.com/TheGiddyLimit/homebrew/master/class/LaserLlama%3B%20Alternate%20Fighter.json` |
| **LaserLlama: Alternate Barbarian** | Class | `https://raw.githubusercontent.com/TheGiddyLimit/homebrew/master/class/LaserLlama%3B%20Alternate%20Barbarian.json` |
| **LaserLlama: Alternate Monk** | Class | `https://raw.githubusercontent.com/TheGiddyLimit/homebrew/master/class/LaserLlama%3B%20Alternate%20Monk.json` |
| **LaserLlama: Alternate Rogue** | Class | `https://raw.githubusercontent.com/TheGiddyLimit/homebrew/master/class/LaserLlama%3B%20Alternate%20Rogue.json` |

---

## ⚖️ Playtester Licensing & Sharing Notice

* **Private Playtesting Scope:** These links are provided for private playtesting and campaign evaluation in ForgeDVTT.
* **Content Authorization:** Ensure you are authorized to download and use the content you import. A public URL or 5eTools format does not establish distribution rights.
* **Player Sharing:** When hosting a campaign and sharing compendium entries across the network with players, check that your use aligns with applicable creator licenses or publisher terms.
* **Provenance Tracking:** ForgeDVTT automatically saves the import URL, timestamp, and licensing metadata on your machine for every imported file so you can review and verify terms at any time.
