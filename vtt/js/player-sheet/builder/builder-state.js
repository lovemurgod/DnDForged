/**
 * Character Builder State Model & Calculation Services
 */

import { getMod, getClassHitDie } from '../calc/stats.js';
import { extractTextFromEntries } from '../vtt-sheet-rolls.js';

export const POINT_BUY_COSTS = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };

export function getPointBuySpent(workingChar) {
    if (!workingChar || !workingChar.pointBuyScores) return 0;
    return ['str', 'dex', 'con', 'int', 'wis', 'cha'].reduce((sum, s) => {
        const val = Math.max(8, Math.min(15, parseInt(workingChar.pointBuyScores[s]) || 8));
        return sum + (POINT_BUY_COSTS[val] ?? 0);
    }, 0);
}

export function extractCatalogRacialBonuses(baseRace, subrace, workingChar = null, choiceDefsOut = null) {
    const bonuses = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
    const newDefs = [];
    let choiceIdx = 0;

    const baseAbStr = JSON.stringify(baseRace?.ability || null);
    const subAbStr = JSON.stringify(subrace?.ability || null);
    const rObjectsToProcess = [];
    if (baseRace && baseRace.ability) rObjectsToProcess.push(baseRace);
    if (subrace && subrace.ability && subrace !== baseRace && subAbStr !== baseAbStr) {
        rObjectsToProcess.push(subrace);
    }

    rObjectsToProcess.forEach((rObj) => {
        if (!rObj.ability) return;
        const abArray = Array.isArray(rObj.ability) ? rObj.ability : [rObj.ability];
        abArray.forEach((ab) => {
            if (typeof ab === 'object') {
                ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach((stat) => {
                    if (typeof ab[stat] === 'number') {
                        bonuses[stat] += ab[stat];
                    }
                });

                if (ab.choose) {
                    const cObj = ab.choose;
                    const count = parseInt(cObj.count) || 1;
                    const amount = parseInt(cObj.amount) || 1;
                    const from =
                        Array.isArray(cObj.from) && cObj.from.length > 0
                            ? cObj.from.map((s) => s.toLowerCase())
                            : ['str', 'dex', 'con', 'int', 'wis', 'cha'];

                    for (let c = 0; c < count; c++) {
                        const cId = `racial_choice_${choiceIdx++}`;
                        newDefs.push({
                            id: cId,
                            label:
                                count > 1
                                    ? `Racial Choice ${c + 1} (+${amount})`
                                    : `Racial Ability Choice (+${amount})`,
                            from,
                            amount
                        });
                    }
                }
            }
        });
    });

    if (Array.isArray(choiceDefsOut)) {
        choiceDefsOut.length = 0;
        choiceDefsOut.push(...newDefs);
    }

    if (workingChar && workingChar.racialAsiMode === 'catalog' && workingChar.racialChoices) {
        newDefs.forEach((cd) => {
            const chosen = workingChar.racialChoices[cd.id];
            if (chosen && bonuses[chosen] !== undefined) {
                bonuses[chosen] += cd.amount;
            }
        });
    }

    return bonuses;
}

export function getEffectiveRacialBonuses(workingChar, matchedBaseRace, matchedSubrace, racialChoiceDefs = []) {
    if (!workingChar) return { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };

    if (workingChar.racialAsiMode === 'custom') {
        return { ...workingChar.customRacialBonuses };
    }
    if (workingChar.racialAsiMode === 'tashas') {
        const b = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
        if (workingChar.tashasMode === 'threePlus1') {
            if (workingChar.tashasPlus1_1 && b[workingChar.tashasPlus1_1] !== undefined)
                b[workingChar.tashasPlus1_1] += 1;
            if (workingChar.tashasPlus1_2 && b[workingChar.tashasPlus1_2] !== undefined)
                b[workingChar.tashasPlus1_2] += 1;
            if (workingChar.tashasPlus1_3 && b[workingChar.tashasPlus1_3] !== undefined)
                b[workingChar.tashasPlus1_3] += 1;
        } else {
            if (workingChar.tashasPlus2 && b[workingChar.tashasPlus2] !== undefined) b[workingChar.tashasPlus2] += 2;
            if (workingChar.tashasPlus1 && b[workingChar.tashasPlus1] !== undefined) b[workingChar.tashasPlus1] += 1;
        }
        return b;
    }
    if (workingChar.racialAsiMode === 'background') {
        const b = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
        if (workingChar.bgAsiMode === 'threePlus1') {
            if (workingChar.bgAsiPlus1_1 && b[workingChar.bgAsiPlus1_1] !== undefined) b[workingChar.bgAsiPlus1_1] += 1;
            if (workingChar.bgAsiPlus1_2 && b[workingChar.bgAsiPlus1_2] !== undefined) b[workingChar.bgAsiPlus1_2] += 1;
            if (workingChar.bgAsiPlus1_3 && b[workingChar.bgAsiPlus1_3] !== undefined) b[workingChar.bgAsiPlus1_3] += 1;
        } else {
            if (workingChar.bgAsiPlus2 && b[workingChar.bgAsiPlus2] !== undefined) b[workingChar.bgAsiPlus2] += 2;
            if (workingChar.bgAsiPlus1 && b[workingChar.bgAsiPlus1] !== undefined) b[workingChar.bgAsiPlus1] += 1;
        }
        return b;
    }
    return extractCatalogRacialBonuses(matchedBaseRace, matchedSubrace, workingChar, racialChoiceDefs);
}

export function getFeatAndAsiBonuses(asiTiers) {
    const validStats = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
    const bonuses = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
    if (Array.isArray(asiTiers)) {
        asiTiers.forEach((t) => {
            if (t.choice === 'unselected') return;
            const isOrigin = t.tierType === 'origin_feat_background' || t.tierType === 'origin_feat_species' || t.isOrigin;
            if (t.choice === 'asi' || t.mode === 'split' || t.mode === 'plus2') {
                const isPlus2 = t.asiMode === 'plus2' || t.mode === 'plus2';
                const st1 = (t.stat1 || t.plus2Stat || t.splitStat1 || '').toLowerCase();
                const st2 = (t.stat2 || t.splitStat2 || '').toLowerCase();
                if (isPlus2 && validStats.includes(st1)) {
                    bonuses[st1] += 2;
                } else {
                    if (validStats.includes(st1)) bonuses[st1] += 1;
                    if (validStats.includes(st2)) bonuses[st2] += 1;
                }
            } else if (t.choice === 'feat' || isOrigin || (!t.choice && t.feat)) {
                const halfStat = (t.halfFeatStat || t.featSubChoices?.halfFeatStat || '').toLowerCase();
                if (validStats.includes(halfStat)) {
                    bonuses[halfStat] += 1;
                }
                if (t.featSubChoices) {
                    validStats.forEach((st) => {
                        if (t.featSubChoices['stat_' + st]) {
                            bonuses[st] += parseInt(t.featSubChoices['stat_' + st]) || 1;
                        }
                        if (t.featSubChoices.ability === st) {
                            bonuses[st] += parseInt(t.featSubChoices.amount) || 1;
                        }
                    });
                }
            }
        });
    }
    return bonuses;
}

export function calculateEffectiveSpeed(workingChar, matchedBaseRace, matchedSubrace, asiTiers = []) {
    const baseSpeed = {
        walk: parseInt(matchedSubrace?.speeds?.walk || matchedBaseRace?.speeds?.walk) || 30,
        climb: parseInt(matchedSubrace?.speeds?.climb || matchedBaseRace?.speeds?.climb) || 0,
        swim: parseInt(matchedSubrace?.speeds?.swim || matchedBaseRace?.speeds?.swim) || 0,
        fly: parseInt(matchedSubrace?.speeds?.fly || matchedBaseRace?.speeds?.fly) || 0,
        burrow: parseInt(matchedSubrace?.speeds?.burrow || matchedBaseRace?.speeds?.burrow) || 0
    };

    let bonusWalk = 0;
    let bonusAll = 0;
    let squatNimbleness = false;
    let scoutSuperiorMobility = false;
    let rangerRoving = false;

    // Feat-based speed bonuses
    if (Array.isArray(asiTiers)) {
        asiTiers.forEach((tier) => {
            const fId = (tier.selectedFeatId || tier.featName || tier.name || '').toLowerCase();
            if (fId.includes('mobile')) {
                bonusAll += 10;
            } else if (fId.includes('squat nimbleness') || fId.includes('squat_nimbleness')) {
                bonusWalk += 5;
                squatNimbleness = true;
            } else if (fId.includes('speedy')) {
                bonusWalk += 10;
            } else if (fId.includes('boon of speed') || fId.includes('boon_of_speed')) {
                bonusAll += 30;
            }
        });
    }

    // Class and Subclass-based speed bonuses
    if (Array.isArray(workingChar?.classes)) {
        workingChar.classes.forEach((c) => {
            const cName = (c.name || '').toLowerCase();
            const sub = (c.subclass || '').toLowerCase();
            const lvl = parseInt(c.level) || 1;

            // Barbarian Fast Movement (level 5+)
            if (cName.includes('barbarian') && lvl >= 5) {
                bonusWalk += 10;
            }
            // Rogue (Scout) Superior Mobility (level 9+)
            if (cName.includes('rogue') && sub.includes('scout') && lvl >= 9) {
                bonusWalk += 10;
                scoutSuperiorMobility = true;
            }
            // Ranger Deft Explorer: Roving (level 6+)
            if (cName.includes('ranger') && lvl >= 6) {
                bonusWalk += 5;
                rangerRoving = true;
            }
            // Paladin (Oath of Glory) Aura of Alacrity (level 7+)
            if (cName.includes('paladin') && sub.includes('glory') && lvl >= 7) {
                bonusWalk += 10;
            }
            // Monk Unarmored Movement (level 2+)
            if (cName.includes('monk') && lvl >= 2) {
                let monkBonus = 10;
                if (lvl >= 18) monkBonus = 30;
                else if (lvl >= 14) monkBonus = 25;
                else if (lvl >= 10) monkBonus = 20;
                else if (lvl >= 6) monkBonus = 15;
                bonusAll += monkBonus;
            }
        });
    }

    const effective = {
        walk: baseSpeed.walk + bonusWalk + bonusAll,
        climb: baseSpeed.climb + bonusAll,
        swim: baseSpeed.swim + bonusAll,
        fly: baseSpeed.fly > 0 ? baseSpeed.fly + bonusAll : 0,
        burrow: baseSpeed.burrow > 0 ? baseSpeed.burrow + bonusAll : 0
    };

    if (scoutSuperiorMobility) {
        if (effective.climb > 0) effective.climb += 10;
        if (effective.swim > 0) effective.swim += 10;
    }

    if (squatNimbleness) {
        effective.climb = Math.max(effective.climb, effective.walk);
    }

    if (rangerRoving) {
        effective.climb = Math.max(effective.climb, effective.walk);
        effective.swim = Math.max(effective.swim, effective.walk);
    }

    return effective;
}

export function getEffectiveStats(workingChar, matchedBaseRace, matchedSubrace, asiTiers, racialChoiceDefs = []) {
    const stats = {};
    const racial = getEffectiveRacialBonuses(workingChar, matchedBaseRace, matchedSubrace, racialChoiceDefs);
    const asi = getFeatAndAsiBonuses(asiTiers);

    ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach((s) => {
        let base = 10;
        if (workingChar.statMethod === 'standard') {
            base = parseInt(workingChar.standardArrayAssignments?.[s]) || 10;
        } else if (workingChar.statMethod === 'pointbuy') {
            base = parseInt(workingChar.pointBuyScores?.[s]) || 8;
        } else if (workingChar.statMethod === 'roll') {
            const matchedRoll = (workingChar.rolledScores || []).find((r) => r.assignedStat === s);
            base = matchedRoll ? matchedRoll.val : 10;
        } else if (workingChar.statMethod === 'manual') {
            base = parseInt(workingChar.manualScores?.[s]) || 10;
        }
        stats[s] = base + (racial[s] || 0) + (asi[s] || 0);
    });
    return stats;
}

export function getBaseScores(workingChar) {
    const baseStats = {};
    ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach((s) => {
        let base = 10;
        if (workingChar.statMethod === 'standard') {
            base = parseInt(workingChar.standardArrayAssignments?.[s]) || 10;
        } else if (workingChar.statMethod === 'pointbuy') {
            base = parseInt(workingChar.pointBuyScores?.[s]) || 8;
        } else if (workingChar.statMethod === 'roll') {
            const matchedRoll = (workingChar.rolledScores || []).find((r) => r.assignedStat === s);
            base = matchedRoll ? matchedRoll.val : 10;
        } else if (workingChar.statMethod === 'manual') {
            base = parseInt(workingChar.manualScores?.[s]) || 10;
        }
        baseStats[s] = base;
    });
    return baseStats;
}

export function extractGrantedSpells(baseRace, subrace, bg, totalLvl, allSpells) {
    if (!Array.isArray(allSpells) || allSpells.length === 0) return [];
    const results = [];
    const seen = new Set();

    function checkAndAddSpell(rawSpellName, sourceLabel, originName, minLvl = 1) {
        if (!rawSpellName || totalLvl < minLvl) return;
        const cleanName = rawSpellName
            .replace(/#c\d+/i, '')
            .replace(/\|[a-z0-9_]+/gi, '')
            .trim();
        const matched = allSpells.find((s) => (s.name || '').toLowerCase() === cleanName.toLowerCase());
        if (matched && !seen.has(matched.name.toLowerCase())) {
            seen.add(matched.name.toLowerCase());
            results.push({
                id: 'sp_innate_' + matched.name.replace(/\W+/g, '_'),
                name: matched.name,
                source: matched.source || '',
                level: parseInt(matched.level) || 0,
                school: matched.school || '',
                time: matched.time || matched.castingTime || '1 action',
                range: matched.range || 'Self',
                duration: matched.duration || 'Instantaneous',
                description: matched.descriptionMarkdown || matched.descriptionHtml || matched.description || '',
                spell: matched,
                sourceLabel: sourceLabel || 'Innate',
                originName: originName || sourceLabel || 'Innate',
                minLevel: minLvl
            });
        }
    }

    const speciesObjs = [];
    if (baseRace) speciesObjs.push(baseRace);
    if (subrace && subrace !== baseRace) speciesObjs.push(subrace);

    speciesObjs.forEach((r) => {
        const origin = r.name || r.raceName || 'Species';
        if (r.additionalSpells) {
            const addSp = Array.isArray(r.additionalSpells) ? r.additionalSpells : [r.additionalSpells];
            addSp.forEach((as) => {
                if (as && typeof as === 'object') {
                    ['innate', 'known', 'prepared'].forEach((poolKey) => {
                        const pool = as[poolKey];
                        if (pool && typeof pool === 'object') {
                            Object.entries(pool).forEach(([lvlReqStr, spList]) => {
                                const lvlReq = parseInt(lvlReqStr) || 1;
                                if (Array.isArray(spList)) {
                                    spList.forEach((spItem) => {
                                        if (typeof spItem === 'string')
                                            checkAndAddSpell(spItem, 'Species', origin, lvlReq);
                                        else if (spItem && spItem.name)
                                            checkAndAddSpell(spItem.name, 'Species', origin, lvlReq);
                                    });
                                }
                            });
                        }
                    });
                }
            });
        }

        const textSources = [];
        if (Array.isArray(r.traits)) {
            r.traits.forEach((t) => {
                textSources.push((t.name || '') + ' ' + (t.description || '') + ' ' + (t.descriptionMarkdown || ''));
            });
        }
        if (r.description) textSources.push(r.description);
        if (r.entriesHtml) textSources.push(r.entriesHtml);

        textSources.forEach((txt) => {
            if (!txt) return;
            const tagMatches = txt.matchAll(/\{@spell\s+([^}|]+)/gi);
            for (const m of tagMatches) {
                let reqLvl = 1;
                const idx = m.index || 0;
                const surrounding = txt.substring(Math.max(0, idx - 80), Math.min(txt.length, idx + 80)).toLowerCase();
                if (surrounding.includes('3rd level') || surrounding.includes('level 3')) reqLvl = 3;
                else if (surrounding.includes('5th level') || surrounding.includes('level 5')) reqLvl = 5;
                checkAndAddSpell(m[1], 'Species', origin, reqLvl);
            }
            const cantripMatch = txt.matchAll(/you know the\s+([A-Za-z\s'\-]+?)\s+cantrip/gi);
            for (const m of cantripMatch) {
                checkAndAddSpell(m[1], 'Species', origin, 1);
            }
            const castMatch = txt.matchAll(/can(?:\s+also)?\s+cast\s+(?:the\s+)?([A-Za-z\s'\-]+?)\s+spell/gi);
            for (const m of castMatch) {
                let reqLvl = 1;
                const idx = m.index || 0;
                const surrounding = txt.substring(Math.max(0, idx - 80), Math.min(txt.length, idx + 80)).toLowerCase();
                if (surrounding.includes('3rd level') || surrounding.includes('level 3')) reqLvl = 3;
                else if (surrounding.includes('5th level') || surrounding.includes('level 5')) reqLvl = 5;
                checkAndAddSpell(m[1], 'Species', origin, reqLvl);
            }
        });
    });

    if (bg) {
        const origin = bg.name || 'Background';
        if (bg.additionalSpells) {
            const addSp = Array.isArray(bg.additionalSpells) ? bg.additionalSpells : [bg.additionalSpells];
            addSp.forEach((as) => {
                if (as && typeof as === 'object') {
                    ['innate', 'known', 'prepared'].forEach((poolKey) => {
                        const pool = as[poolKey];
                        if (pool && typeof pool === 'object') {
                            Object.entries(pool).forEach(([lvlReqStr, spList]) => {
                                const lvlReq = parseInt(lvlReqStr) || 1;
                                if (Array.isArray(spList)) {
                                    spList.forEach((spItem) => {
                                        if (typeof spItem === 'string')
                                            checkAndAddSpell(spItem, 'Background', origin, lvlReq);
                                        else if (spItem && spItem.name)
                                            checkAndAddSpell(spItem.name, 'Background', origin, lvlReq);
                                    });
                                }
                            });
                        }
                    });
                }
            });
        }

        const bgTexts = [];
        if (Array.isArray(bg.features)) {
            bg.features.forEach((f) => {
                bgTexts.push((f.name || '') + ' ' + (f.description || ''));
            });
        }
        if (bg.description) bgTexts.push(bg.description);

        bgTexts.forEach((txt) => {
            if (!txt) return;
            const tagMatches = txt.matchAll(/\{@spell\s+([^}|]+)/gi);
            for (const m of tagMatches) {
                checkAndAddSpell(m[1], 'Background', origin, 1);
            }
        });

        if (Array.isArray(bg.spells)) {
            bg.spells.forEach((sp) => {
                if (typeof sp === 'string') checkAndAddSpell(sp, 'Background', origin, 1);
                else if (sp && sp.name) checkAndAddSpell(sp.name, 'Background', origin, 1);
            });
        }
    }

    return results;
}

export function parseEquipmentTextToData(rawEquip) {
    if (!rawEquip) {
        return { fixedItems: [], fixedGold: 0, choiceSets: [] };
    }
    let fixedGold = 0;
    const fixedItems = [];

    if (Array.isArray(rawEquip)) {
        for (const entry of rawEquip) {
            if (typeof entry === 'string') {
                const sub = parseEquipmentTextToData(entry);
                fixedGold += sub.fixedGold;
                fixedItems.push(...sub.fixedItems);
            } else if (entry && typeof entry === 'object') {
                if (entry.special) {
                    const sub = parseEquipmentTextToData(entry.special);
                    fixedGold += sub.fixedGold;
                    fixedItems.push(...sub.fixedItems);
                } else if (entry.item) {
                    const qty = parseInt(entry.quantity, 10) || 1;
                    const name = typeof entry.item === 'string' ? entry.item.split('|')[0] : 'Item';
                    fixedItems.push({ name, quantity: qty, type: 'item' });
                }
            }
        }
        return { fixedItems, fixedGold, choiceSets: [] };
    }

    if (typeof rawEquip !== 'string') {
        return { fixedItems: [], fixedGold: 0, choiceSets: [] };
    }

    let clean = rawEquip.trim();
    const goldMatch = clean.match(/(?:(?:a\s+)?pouch\s+containing\s+)?(\d+)\s*(?:gp|gold(?:\s*pieces?)?)/i);
    if (goldMatch) {
        fixedGold = parseInt(goldMatch[1], 10) || 0;
        clean = clean.replace(goldMatch[0], '').replace(/,\s*,/g, ',').trim();
    }

    const parts = clean
        .split(/(?:,\s*(?:and\s+)?|;\s*|\s+and\s+(?:a|an|the)?\s*)/i)
        .map((s) => s.replace(/^[,\s\.]+|[,\s\.]+$/g, ''))
        .map((s) => s.replace(/^(?:a|an|the|one|set of)\s+/i, '').trim())
        .filter((s) => s.length > 1 && !/^\s*pouch\s*$/i.test(s));

    parts.forEach((part) => {
        const qtyMatch = part.match(/^(\d+)\s+(.*)/);
        if (qtyMatch) {
            fixedItems.push({ name: qtyMatch[2].trim(), quantity: parseInt(qtyMatch[1], 10) || 1, type: 'item' });
        } else {
            fixedItems.push({ name: part, quantity: 1, type: 'item' });
        }
    });

    return { fixedItems, fixedGold, choiceSets: [] };
}
