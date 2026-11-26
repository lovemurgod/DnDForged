export const STRIXHAVEN_COLLEGES={lorehold:{name:"Lorehold College",cantrips:["Light","Sacred Flame","Thaumaturgy"],classes:["cleric","wizard"]},prismari:{name:"Prismari College",cantrips:["Fire Bolt","Prestidigitation","Ray of Frost"],classes:["bard","sorcerer"]},quandrix:{name:"Quandrix College",cantrips:["Druidcraft","Guidance","Mage Hand"],classes:["druid","wizard"]},silverquill:{name:"Silverquill College",cantrips:["Sacred Flame","Thaumaturgy","Vicious Mockery"],classes:["bard","cleric"]},witherbloom:{name:"Witherbloom College",cantrips:["Chill Touch","Druidcraft","Spare the Dying"],classes:["druid","wizard"]}},HIGH_SORCERY_MOONS={nuitari:{name:"Nuitari (Black Robes)",cantrips:["Chill Touch","Ray of Sickness","Toll the Dead"],schools:["necromancy","enchantment"]},lunitari:{name:"Lunitari (Red Robes)",cantrips:["Dancing Lights","Minor Illusion","Prestidigitation"],schools:["illusion","transmutation"]},solinari:{name:"Solinari (White Robes)",cantrips:["Light","Message","Sacred Flame"],schools:["abjuration","divination"]}},RUNE_SHAPER_SPELLS=["Armor of Agathys","Command","Disguise Self","Entangle","Fog Cloud","Guiding Bolt","Longstrider","Speak with Animals"],OUTER_PLANES={lawful:{name:"Lawful Outer Plane (Mechanus/Celestia)",cantrip:"Guidance",resistance:"Force"},chaotic:{name:"Chaotic Outer Plane (Limbo/Abyss)",cantrip:"Minor Illusion",resistance:"Poison"},evil:{name:"Evil Outer Plane (Nine Hells/Hades)",cantrip:"Chill Touch",resistance:"Necrotic"},good:{name:"Good Outer Plane (Elysium/Arborea)",cantrip:"Sacred Flame",resistance:"Radiant"},neutral:{name:"Neutral Outer Plane (The Outlands)",cantrip:"Mage Hand",resistance:"Psychic"}},GIANT_STRIKES={"Cloud Strike":{damage:"1d4",type:"thunder",save:"Wisdom",desc:"Target takes an extra 1d4 thunder damage and must succeed on a WIS save or you become invisible to it until the start of your next turn."},"Fire Strike":{damage:"1d10",type:"fire",save:null,desc:"Target takes an extra 1d10 fire damage."},"Frost Strike":{damage:"1d6",type:"cold",save:"Constitution",desc:"Target takes an extra 1d6 cold damage and must succeed on a CON save or its speed is reduced to 0 until the start of your next turn."},"Hill Strike":{damage:"1d6",type:"weapon",save:"Strength",desc:"Target takes an extra 1d6 damage of the weapon's type and must succeed on a STR save or have the prone condition."},"Stone Strike":{damage:"1d6",type:"force",save:"Strength",desc:"Target takes an extra 1d6 force damage and must succeed on a STR save or be pushed 10 feet from you in a straight line."},"Storm Strike":{damage:"1d6",type:"lightning",save:"Constitution",desc:"Target takes an extra 1d6 lightning damage and must succeed on a CON save or have disadvantage on attack rolls until the start of your next turn."}},STANDARD_5E_SKILLS=["Acrobatics","Animal Handling","Arcana","Athletics","Deception","History","Insight","Intimidation","Investigation","Medicine","Nature","Perception","Performance","Persuasion","Religion","Sleight of Hand","Stealth","Survival"],STANDARD_5E_TOOLS=["Thieves' Tools","Alchemist's Supplies","Brewer's Supplies","Calligrapher's Supplies","Carpenter's Tools","Cartographer's Tools","Cobbler's Tools","Cook's Utensils","Glassblower's Tools","Jeweler's Tools","Leatherworker's Tools","Mason's Tools","Painter's Supplies","Potter's Tools","Smith's Tools","Tinker's Tools","Weaver's Tools","Woodcarver's Tools","Disguise Kit","Forgery Kit","Herbalism Kit","Navigator's Tools","Poisoner's Kit"],STANDARD_5E_LANGUAGES=["Common","Dwarvish","Elvish","Giant","Gnomish","Goblin","Halfling","Orc","Abyssal","Celestial","Draconic","Deep Speech","Infernal","Primordial","Sylvan","Undercommon"],FIGHTING_STYLES=["Archery","Blind Fighting","Defense","Dueling","Great Weapon Fighting","Interception","Protection","Superior Technique","Thrown Weapon Fighting","Two-Weapon Fighting","Unarmed Fighting"],ELDRITCH_INVOCATIONS_BASIC=["Armor of Shadows","Beast Speech","Beguiling Influence","Devil's Sight","Eldritch Sight","Eyes of the Rune Keeper","Fiendish Vigor","Gaze of Two Minds","Mask of Many Faces","Misty Visions","Thief of Five Fates"],METAMAGIC_OPTIONS=["Careful Spell","Distant Spell","Empowered Spell","Extended Spell","Heightened Spell","Quickened Spell","Subtle Spell","Twinned Spell"],ELEMENTAL_TYPES=["Acid","Cold","Fire","Lightning","Thunder"],BATTLEMASTER_MANEUVERS=["Commander's Strike","Disarming Attack","Distracting Strike","Evasive Footwork","Feinting Attack","Goading Attack","Lunging Attack","Maneuvering Attack","Menacing Attack","Parry","Precision Attack","Pushing Attack","Rally","Riposte","Sweeping Attack","Trip Attack"],WEAPON_OPTIONS=["Battleaxe","Blowgun","Club","Dagger","Dart","Flail","Glaive","Greataxe","Greatclub","Greatsword","Halberd","Hand Crossbow","Handaxe","Heavy Crossbow","Javelin","Lance","Light Crossbow","Light Hammer","Longbow","Longsword","Mace","Maul","Morningstar","Net","Pike","Quarterstaff","Rapier","Scimitar","Shortbow","Shortsword","Sickle","Sling","Spear","Trident","War Pick","Warhammer","Whip"];export function evaluateFeatPrerequisites(f,u,r){if(!f)return{met:!0};const v=(u?.classes||[]).reduce((b,x)=>b+(parseInt(x.level)||1),0),z=r||{},L=Array.isArray(f.prerequisite)?f.prerequisite:f.prerequisite?[f.prerequisite]:[];for(const b of L)if(!(!b||typeof b!="object")){if(b.level&&v<b.level)return{met:!1,text:`Level ${b.level}+ required (currently Level ${v})`};if(Array.isArray(b.ability))for(const x of b.ability)for(const[h,y]of Object.entries(x)){const S=z[h.toLowerCase()]||10;if(S<y)return{met:!1,text:`${h.toUpperCase()} ${y}+ required (currently ${S})`}}if(b.spellcasting&&!(u?.classes||[]).some(h=>{const y=(h.name||"").toLowerCase();return["wizard","sorcerer","cleric","druid","bard","warlock","paladin","ranger","artificer"].includes(y)})&&!u?.isSpellcaster)return{met:!1,text:"Spellcasting ability required"}}return{met:!0}}export function renderStep7(f){const{bodyEl:u,asiTiers:r,builderCache:v,disabledSources:z,isSourceAllowed:L,recomputeCandidates:b,updateCountsDisplay:x}=f,h=f.workingChar,y=typeof f.getEffectiveStats=="function"?f.getEffectiveStats():{},S=(v?.feats||[]).filter(e=>L(e.source,e.name,z)).sort((e,o)=>e.name.localeCompare(o.name)),A=["str","dex","con","int","wis","cha"];u.innerHTML=`
        ${r.length===0?`
            <div class="builder-section-box" style="text-align:center; padding:30px 20px;">
                <i class="fa-solid fa-trophy" style="font-size:2rem; color:var(--color-gold-base); margin-bottom:12px; opacity:0.6;"></i>
                <h4 style="color:var(--color-gold-light); margin:0 0 6px 0;">No Milestone ASIs / Feats Unlocked Yet</h4>
                <div style="font-size:0.85rem; color:var(--color-text-muted); max-width:480px; margin:0 auto;">
                    Ability Score Improvements and Feats unlock at class milestones (e.g., Level 4, 8, 12, 16, 19) or from Background Origin Feats. You can level up in Step 1 or select a background that grants a bonus feat to unlock them.
                </div>
            </div>
        `:`
            <div style="display:flex; flex-direction:column; gap:12px;">
                ${r.map((e,o)=>{const l=!!e.isOrigin,m=l?S.filter(n=>{const c=(n.name||"").toLowerCase(),C=["alert","crafter","healer","lucky","magic initiate","musician","savage attacker","skilled","tavern brawler","tough","strixhaven initiate","strike of the giants","rune shaper","scion of the outer planes","squire of solamnia","initiate of high sorcery"].some(p=>c.startsWith(p)),k=n.category==="Origin"||n.entries&&JSON.stringify(n.entries).toLowerCase().includes("origin feat");return C||k}):S;return`
                    <div class="builder-section-box" style="${l?"border-left:3px solid #059669;":""}">
                        <div class="builder-section-header">
                            <div style="display:flex; align-items:center; gap:8px;">
                                <i class="fa-solid ${l?"fa-sparkles text-gradient-gold":"fa-award text-gradient-gold"}"></i>
                                <strong style="font-size:0.95rem; color:var(--color-gold-base);">${e.className} ${e.level?`(Level ${e.level})`:""}</strong>
                                ${l?'<span class="badge" style="background:#059669; color:#fff; font-size:0.7rem; padding:2px 8px; border-radius:4px;">Origin Feat</span>':""}
                            </div>
                            ${l?"":`
                                <div style="display:flex; gap:6px;">
                                    <button type="button" class="btn ${e.choice==="asi"?"btn-primary":"btn-secondary"} btn-xxs pc-wiz-tier-choice" data-tidx="${o}" data-choice="asi">Ability Score (+2/+1+1)</button>
                                    <button type="button" class="btn ${e.choice==="feat"?"btn-primary":"btn-secondary"} btn-xxs pc-wiz-tier-choice" data-tidx="${o}" data-choice="feat">Select a Feat</button>
                                </div>
                            `}
                        </div>

                        ${e.choice==="asi"&&!l?`
                            <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap; background:rgba(0,0,0,0.25); padding:8px 12px; border-radius:6px;">
                                <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
                                    <input type="radio" name="asi_mode_${o}" class="pc-wiz-tier-asimode" data-tidx="${o}" value="plus2" ${e.asiMode==="plus2"?"checked":""}>
                                    <span style="font-size:0.85rem; color:var(--color-text-primary);">+2 to One Stat</span>
                                </label>
                                <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
                                    <input type="radio" name="asi_mode_${o}" class="pc-wiz-tier-asimode" data-tidx="${o}" value="plus1plus1" ${e.asiMode==="plus1plus1"?"checked":""}>
                                    <span style="font-size:0.85rem; color:var(--color-text-primary);">+1 to Two Stats</span>
                                </label>
                            </div>
                            <div style="display:flex; gap:12px; margin-top:10px; flex-wrap:wrap;">
                                <div style="flex:1; min-width:140px;">
                                    <label style="font-size:0.75rem; color:var(--color-text-muted);">${e.asiMode==="plus2"?"Add +2 To:":"First +1 Stat:"}</label>
                                    <select class="pc-wiz-tier-stat1" data-tidx="${o}" style="width:100%; padding:6px; font-size:0.85rem; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                                        <option value="" ${e.stat1?"":"selected"}>-- Choose Stat --</option>
                                        ${A.map(n=>`<option value="${n}" ${e.stat1===n?"selected":""}>${n.toUpperCase()}</option>`).join("")}
                                    </select>
                                </div>
                                ${e.asiMode==="plus1plus1"?`
                                    <div style="flex:1; min-width:140px;">
                                        <label style="font-size:0.75rem; color:var(--color-text-muted);">Second +1 Stat:</label>
                                        <select class="pc-wiz-tier-stat2" data-tidx="${o}" style="width:100%; padding:6px; font-size:0.85rem; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                                            <option value="" ${e.stat2?"":"selected"}>-- Choose Stat --</option>
                                            ${A.map(n=>`<option value="${n}" ${e.stat2===n?"selected":""}>${n.toUpperCase()}</option>`).join("")}
                                        </select>
                                    </div>
                                `:""}
                            </div>
                        `:e.choice==="unselected"&&!l?`
                            <div style="padding:10px 14px; background:rgba(0,0,0,0.2); border:1px dashed var(--color-border-subtle); border-radius:6px; font-size:0.85rem; color:var(--color-text-muted); text-align:center;">
                                <i class="fa-solid fa-circle-question" style="color:var(--color-gold-base); margin-right:6px;"></i> Please choose whether to increase <strong>Ability Scores</strong> or select a <strong>Feat</strong> using the buttons above.
                            </div>
                        `:`
                            <!-- Feat Selector -->
                            <div style="display:flex; flex-direction:column; gap:8px;">
                                <select class="pc-tier-feat-sel" data-tidx="${o}" style="width:100%; padding:8px 10px; font-size:0.85rem; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                                    <option value="">-- Choose Feat --</option>
                                    ${m.map(n=>{const c=`${n.id||n.name.replace(/\W+/g,"_").toLowerCase()}::${n.source||"PHB"}`,C=n.id||n.name.replace(/\W+/g,"_").toLowerCase(),k=e.selectedFeatId===c||e.selectedFeatId===C,p=evaluateFeatPrerequisites(n,h,y);return`<option value="${c}" ${k?"selected":""}>${n.name} [${n.source||"PHB"}]${p.met?"":" \u26A0\uFE0F"}</option>`}).join("")}
                                </select>

                                ${e.selectedFeatId?(function(){const n=S.find(t=>{const a=`${t.id||t.name.replace(/\W+/g,"_").toLowerCase()}::${t.source||"PHB"}`,i=t.id||t.name.replace(/\W+/g,"_").toLowerCase();return a===e.selectedFeatId||i===e.selectedFeatId});if(!n)return"";const c=n.name.toLowerCase(),C=evaluateFeatPrerequisites(n,h,y);let p=C.met?"":`
                                                  <div style="background:rgba(255,152,0,0.12); border:1px solid #ff9800; color:#ffb74d; padding:4px 8px; border-radius:4px; font-size:0.75rem; display:inline-flex; align-items:center; gap:6px; margin-top:2px;">
                                                      <i class="fa-solid fa-triangle-exclamation"></i>
                                                      <span>Prerequisite Warning: ${C.text}</span>
                                                  </div>
                                              `;if(n.isHalfFeat||n.abilityBonus||/touched|telekinetic|telepathic|resilient/i.test(c)){let t=["str","dex","con","int","wis","cha"];const a=n.abilityBonus?.chooseFrom||n.abilityBonus?.choose;Array.isArray(a)&&a.length>0?t=a:/fey[- ]touched|shadow[- ]touched|telekinetic|telepathic/i.test(c)&&(t=["int","wis","cha"]);const i=e.halfFeatStat||e.featSubChoices?.halfFeatStat||t[0]||"str";e.halfFeatStat||(e.halfFeatStat=i),e.featSubChoices=e.featSubChoices||{},e.featSubChoices.halfFeatStat=i,p+=`
                                                    <div style="background:rgba(212,175,55,0.08); border:1px solid rgba(212,175,55,0.25); padding:8px 10px; border-radius:6px; margin-top:6px; display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                                                        <span class="badge" style="background:var(--color-gold-base); color:#000; font-size:0.7rem; font-weight:700;"><i class="fa-solid fa-arrow-up"></i> Half-Feat (+1 Stat)</span>
                                                        <span style="font-size:0.78rem; color:var(--color-gold-light);">Ability Score to increase:</span>
                                                        <select class="pc-tier-feat-halfstat-sel" data-tidx="${o}" style="padding:3px 8px; font-size:0.8rem; background:#1e1e1e; color:#fff; border:1px solid var(--color-border-subtle); border-radius:4px;">
                                                            ${t.map(d=>`<option value="${d}" ${i===d?"selected":""}>${d.toUpperCase()} (+1)</option>`).join("")}
                                                        </select>
                                                    </div>
                                                `}if(/magic initiate/i.test(c)){const t=e.featSubChoices?.spellClass||"wizard",a=(v?.spells||[]).filter(s=>parseInt(s.level)===0&&(s.classes||[]).some($=>$.toLowerCase().includes(t))),i=(v?.spells||[]).filter(s=>parseInt(s.level)===1&&(s.classes||[]).some($=>$.toLowerCase().includes(t))),d=e.featSubChoices?.abilityScore||(t==="cleric"||t==="druid"?"wis":t==="wizard"?"int":"cha");e.featSubChoices=e.featSubChoices||{},e.featSubChoices.abilityScore||(e.featSubChoices.abilityScore=d),p+=`
                                            <div style="background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle); padding:10px; border-radius:6px; margin-top:6px; display:flex; flex-direction:column; gap:8px;">
                                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                                    <strong style="color:var(--color-gold-light); font-size:0.8rem;"><i class="fa-solid fa-wand-sparkles"></i> Magic Initiate Spell Selections:</strong>
                                                    <span class="badge" style="background:#2563eb; color:#fff; font-size:0.7rem; padding:2px 6px;">2 Cantrips + 1 1st-Level</span>
                                                </div>
                                                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:8px;">
                                                    <div>
                                                        <label style="font-size:0.75rem; color:var(--color-text-muted);">Spellcasting Class:</label>
                                                        <select class="pc-tier-feat-spellclass-sel" data-tidx="${o}" style="width:100%; padding:4px; font-size:0.8rem; background:#1e1e1e; color:#fff; border:1px solid var(--color-border-subtle); border-radius:4px;">
                                                            <option value="wizard" ${t==="wizard"?"selected":""}>Wizard (INT)</option>
                                                            <option value="cleric" ${t==="cleric"?"selected":""}>Cleric (WIS)</option>
                                                            <option value="druid" ${t==="druid"?"selected":""}>Druid (WIS)</option>
                                                            <option value="sorcerer" ${t==="sorcerer"?"selected":""}>Sorcerer (CHA)</option>
                                                            <option value="warlock" ${t==="warlock"?"selected":""}>Warlock (CHA)</option>
                                                            <option value="bard" ${t==="bard"?"selected":""}>Bard (CHA)</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label style="font-size:0.75rem; color:var(--color-text-muted);">Spellcasting Ability:</label>
                                                        <select class="pc-tier-feat-ability-sel" data-tidx="${o}" style="width:100%; padding:4px; font-size:0.8rem; background:#1e1e1e; color:#fff; border:1px solid var(--color-border-subtle); border-radius:4px;">
                                                            <option value="int" ${d==="int"?"selected":""}>Intelligence (INT)</option>
                                                            <option value="wis" ${d==="wis"?"selected":""}>Wisdom (WIS)</option>
                                                            <option value="cha" ${d==="cha"?"selected":""}>Charisma (CHA)</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label style="font-size:0.75rem; color:var(--color-text-muted);">Cantrip 1:</label>
                                                        <select class="pc-tier-feat-spell-sel" data-tidx="${o}" data-field="cantrip1" style="width:100%; padding:4px; font-size:0.8rem; background:#1e1e1e; color:#fff; border:1px solid var(--color-border-subtle); border-radius:4px;">
                                                            <option value="">-- Choose Cantrip --</option>
                                                            ${a.map(s=>`<option value="${s.name}" ${e.featSubChoices?.cantrip1===s.name?"selected":""}>${s.name}</option>`).join("")}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label style="font-size:0.75rem; color:var(--color-text-muted);">Cantrip 2:</label>
                                                        <select class="pc-tier-feat-spell-sel" data-tidx="${o}" data-field="cantrip2" style="width:100%; padding:4px; font-size:0.8rem; background:#1e1e1e; color:#fff; border:1px solid var(--color-border-subtle); border-radius:4px;">
                                                            <option value="">-- Choose Cantrip --</option>
                                                            ${a.map(s=>`<option value="${s.name}" ${e.featSubChoices?.cantrip2===s.name?"selected":""}>${s.name}</option>`).join("")}
                                                        </select>
                                                    </div>
                                                    <div style="grid-column:1 / -1;">
                                                        <label style="font-size:0.75rem; color:var(--color-text-muted);">1st Level Spell:</label>
                                                        <select class="pc-tier-feat-spell-sel" data-tidx="${o}" data-field="spell1" style="width:100%; padding:4px; font-size:0.8rem; background:#1e1e1e; color:#fff; border:1px solid var(--color-border-subtle); border-radius:4px;">
                                                            <option value="">-- Choose 1st Level Spell --</option>
                                                            ${i.map(s=>`<option value="${s.name}" ${e.featSubChoices?.spell1===s.name?"selected":""}>${s.name}</option>`).join("")}
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>
                                        `}else if(/strixhaven initiate/i.test(c)){let t="lorehold";const a=(e.className||"").toLowerCase();a.includes("prismari")?t="prismari":a.includes("quandrix")?t="quandrix":a.includes("silverquill")?t="silverquill":a.includes("witherbloom")&&(t="witherbloom");const i=e.featSubChoices?.college||t;e.featSubChoices=e.featSubChoices||{},e.featSubChoices.college=i;const d=STRIXHAVEN_COLLEGES[i]||STRIXHAVEN_COLLEGES.lorehold,s=d.cantrips,$=d.classes,T=(v?.spells||[]).filter(g=>parseInt(g.level)===1&&(g.classes||[]).some(E=>$.includes(E.toLowerCase()))),w=e.featSubChoices?.abilityScore||"int";e.featSubChoices.abilityScore=w,p+=`
                                            <div style="background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle); padding:10px; border-radius:6px; margin-top:6px; display:flex; flex-direction:column; gap:8px;">
                                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                                    <strong style="color:var(--color-gold-light); font-size:0.8rem;"><i class="fa-solid fa-graduation-cap"></i> Strixhaven Initiate Spell Selections:</strong>
                                                    <span class="badge" style="background:#7c3aed; color:#fff; font-size:0.7rem; padding:2px 6px;">2 Cantrips + 1 1st-Level</span>
                                                </div>
                                                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:8px;">
                                                    <div>
                                                        <label style="font-size:0.75rem; color:var(--color-text-muted);">College:</label>
                                                        <select class="pc-tier-feat-college-sel" data-tidx="${o}" style="width:100%; padding:4px; font-size:0.8rem; background:#1e1e1e; color:#fff; border:1px solid var(--color-border-subtle); border-radius:4px;">
                                                            <option value="lorehold" ${i==="lorehold"?"selected":""}>Lorehold College</option>
                                                            <option value="prismari" ${i==="prismari"?"selected":""}>Prismari College</option>
                                                            <option value="quandrix" ${i==="quandrix"?"selected":""}>Quandrix College</option>
                                                            <option value="silverquill" ${i==="silverquill"?"selected":""}>Silverquill College</option>
                                                            <option value="witherbloom" ${i==="witherbloom"?"selected":""}>Witherbloom College</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label style="font-size:0.75rem; color:var(--color-text-muted);">Spellcasting Ability:</label>
                                                        <select class="pc-tier-feat-ability-sel" data-tidx="${o}" style="width:100%; padding:4px; font-size:0.8rem; background:#1e1e1e; color:#fff; border:1px solid var(--color-border-subtle); border-radius:4px;">
                                                            <option value="int" ${w==="int"?"selected":""}>Intelligence (INT)</option>
                                                            <option value="wis" ${w==="wis"?"selected":""}>Wisdom (WIS)</option>
                                                            <option value="cha" ${w==="cha"?"selected":""}>Charisma (CHA)</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label style="font-size:0.75rem; color:var(--color-text-muted);">Cantrip 1:</label>
                                                        <select class="pc-tier-feat-spell-sel" data-tidx="${o}" data-field="cantrip1" style="width:100%; padding:4px; font-size:0.8rem; background:#1e1e1e; color:#fff; border:1px solid var(--color-border-subtle); border-radius:4px;">
                                                            <option value="">-- Choose Cantrip --</option>
                                                            ${s.map(g=>`<option value="${g}" ${e.featSubChoices?.cantrip1===g?"selected":""}>${g}</option>`).join("")}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label style="font-size:0.75rem; color:var(--color-text-muted);">Cantrip 2:</label>
                                                        <select class="pc-tier-feat-spell-sel" data-tidx="${o}" data-field="cantrip2" style="width:100%; padding:4px; font-size:0.8rem; background:#1e1e1e; color:#fff; border:1px solid var(--color-border-subtle); border-radius:4px;">
                                                            <option value="">-- Choose Cantrip --</option>
                                                            ${s.map(g=>`<option value="${g}" ${e.featSubChoices?.cantrip2===g?"selected":""}>${g}</option>`).join("")}
                                                        </select>
                                                    </div>
                                                    <div style="grid-column:1 / -1;">
                                                        <label style="font-size:0.75rem; color:var(--color-text-muted);">1st Level Spell (${$.join(" / ").toUpperCase()}):</label>
                                                        <select class="pc-tier-feat-spell-sel" data-tidx="${o}" data-field="spell1" style="width:100%; padding:4px; font-size:0.8rem; background:#1e1e1e; color:#fff; border:1px solid var(--color-border-subtle); border-radius:4px;">
                                                            <option value="">-- Choose 1st Level Spell --</option>
                                                            ${T.map(g=>`<option value="${g.name}" ${e.featSubChoices?.spell1===g.name?"selected":""}>${g.name}</option>`).join("")}
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>
                                        `}else if(/fey[- ]touched/i.test(c)){const t=(v?.spells||[]).filter(a=>parseInt(a.level)===1&&(a.school==="Divination"||a.school==="Enchantment"||(a.school||"").toLowerCase().startsWith("div")||(a.school||"").toLowerCase().startsWith("enc")));p+=`
                                            <div style="background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle); padding:10px; border-radius:6px; margin-top:6px; display:flex; flex-direction:column; gap:8px;">
                                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                                    <strong style="color:var(--color-gold-light); font-size:0.8rem;"><i class="fa-solid fa-sparkles"></i> Fey-Touched Granted Spells:</strong>
                                                    <span class="badge" style="background:#059669; color:#fff; font-size:0.7rem; padding:2px 6px;">Misty Step Auto-Learned</span>
                                                </div>
                                                <div>
                                                    <label style="font-size:0.75rem; color:var(--color-text-muted);">Choose 1st-Level Divination or Enchantment Spell:</label>
                                                    <select class="pc-tier-feat-spell-sel" data-tidx="${o}" data-field="spell1" style="width:100%; padding:6px; font-size:0.8rem; background:#1e1e1e; color:#fff; border:1px solid var(--color-border-subtle); border-radius:4px;">
                                                        <option value="">-- Choose 1st Level Divination / Enchantment Spell --</option>
                                                        ${t.map(a=>`<option value="${a.name}" ${e.featSubChoices?.spell1===a.name?"selected":""}>${a.name} [${a.school}]</option>`).join("")}
                                                    </select>
                                                </div>
                                            </div>
                                        `}else if(/shadow[- ]touched/i.test(c)){const t=(v?.spells||[]).filter(a=>parseInt(a.level)===1&&(a.school==="Illusion"||a.school==="Necromancy"||(a.school||"").toLowerCase().startsWith("ill")||(a.school||"").toLowerCase().startsWith("nec")));p+=`
                                            <div style="background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle); padding:10px; border-radius:6px; margin-top:6px; display:flex; flex-direction:column; gap:8px;">
                                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                                    <strong style="color:var(--color-gold-light); font-size:0.8rem;"><i class="fa-solid fa-moon"></i> Shadow-Touched Granted Spells:</strong>
                                                    <span class="badge" style="background:#7c3aed; color:#fff; font-size:0.7rem; padding:2px 6px;">Invisibility Auto-Learned</span>
                                                </div>
                                                <div>
                                                    <label style="font-size:0.75rem; color:var(--color-text-muted);">Choose 1st-Level Illusion or Necromancy Spell:</label>
                                                    <select class="pc-tier-feat-spell-sel" data-tidx="${o}" data-field="spell1" style="width:100%; padding:6px; font-size:0.8rem; background:#1e1e1e; color:#fff; border:1px solid var(--color-border-subtle); border-radius:4px;">
                                                        <option value="">-- Choose 1st Level Illusion / Necromancy Spell --</option>
                                                        ${t.map(a=>`<option value="${a.name}" ${e.featSubChoices?.spell1===a.name?"selected":""}>${a.name} [${a.school}]</option>`).join("")}
                                                    </select>
                                                </div>
                                            </div>
                                        `}else if(/artificer initiate/i.test(c)){const t=(v?.spells||[]).filter(i=>parseInt(i.level)===0&&(i.classes||[]).some(d=>d.toLowerCase().includes("artificer"))),a=(v?.spells||[]).filter(i=>parseInt(i.level)===1&&(i.classes||[]).some(d=>d.toLowerCase().includes("artificer")));p+=`
                                            <div style="background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle); padding:10px; border-radius:6px; margin-top:6px; display:flex; flex-direction:column; gap:8px;">
                                                <strong style="color:var(--color-gold-light); font-size:0.8rem;"><i class="fa-solid fa-wrench"></i> Artificer Initiate Spell Selections:</strong>
                                                <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                                                    <div>
                                                        <label style="font-size:0.75rem; color:var(--color-text-muted);">Artificer Cantrip:</label>
                                                        <select class="pc-tier-feat-spell-sel" data-tidx="${o}" data-field="cantrip1" style="width:100%; padding:4px; font-size:0.8rem; background:#1e1e1e; color:#fff; border:1px solid var(--color-border-subtle); border-radius:4px;">
                                                            <option value="">-- Choose Cantrip --</option>
                                                            ${t.map(i=>`<option value="${i.name}" ${e.featSubChoices?.cantrip1===i.name?"selected":""}>${i.name}</option>`).join("")}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label style="font-size:0.75rem; color:var(--color-text-muted);">Artificer 1st-Level Spell:</label>
                                                        <select class="pc-tier-feat-spell-sel" data-tidx="${o}" data-field="spell1" style="width:100%; padding:4px; font-size:0.8rem; background:#1e1e1e; color:#fff; border:1px solid var(--color-border-subtle); border-radius:4px;">
                                                            <option value="">-- Choose 1st-Level Spell --</option>
                                                            ${a.map(i=>`<option value="${i.name}" ${e.featSubChoices?.spell1===i.name?"selected":""}>${i.name}</option>`).join("")}
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>
                                        `}else if(/spell sniper/i.test(c)){const t=(v?.spells||[]).filter(a=>parseInt(a.level)===0&&(a.attackStat==="spell"||a.damageList&&a.damageList.length>0));p+=`
                                            <div style="background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle); padding:10px; border-radius:6px; margin-top:6px; display:flex; flex-direction:column; gap:8px;">
                                                <strong style="color:var(--color-gold-light); font-size:0.8rem;"><i class="fa-solid fa-crosshairs"></i> Spell Sniper Attack Cantrip:</strong>
                                                <div>
                                                    <label style="font-size:0.75rem; color:var(--color-text-muted);">Choose Attack Cantrip:</label>
                                                    <select class="pc-tier-feat-spell-sel" data-tidx="${o}" data-field="cantrip1" style="width:100%; padding:6px; font-size:0.8rem; background:#1e1e1e; color:#fff; border:1px solid var(--color-border-subtle); border-radius:4px;">
                                                        <option value="">-- Choose Attack Cantrip --</option>
                                                        ${t.map(a=>`<option value="${a.name}" ${e.featSubChoices?.cantrip1===a.name?"selected":""}>${a.name}</option>`).join("")}
                                                    </select>
                                                </div>
                                            </div>
                                        `}else if(/initiate of high sorcery/i.test(c)){const t=e.featSubChoices?.moon||"solinari";e.featSubChoices=e.featSubChoices||{},e.featSubChoices.moon=t;const a=HIGH_SORCERY_MOONS[t]||HIGH_SORCERY_MOONS.solinari,i=(v?.spells||[]).filter(d=>parseInt(d.level)===1&&a.schools.some(s=>(d.school||"").toLowerCase().startsWith(s)));p+=`
                                            <div style="background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle); padding:10px; border-radius:6px; margin-top:6px; display:flex; flex-direction:column; gap:8px;">
                                                <strong style="color:var(--color-gold-light); font-size:0.8rem;"><i class="fa-solid fa-moon"></i> High Sorcery Order & Spells:</strong>
                                                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:8px;">
                                                    <div>
                                                        <label style="font-size:0.75rem; color:var(--color-text-muted);">Robes / Moon:</label>
                                                        <select class="pc-tier-feat-moon-sel" data-tidx="${o}" style="width:100%; padding:4px; font-size:0.8rem; background:#1e1e1e; color:#fff; border:1px solid var(--color-border-subtle); border-radius:4px;">
                                                            <option value="solinari" ${t==="solinari"?"selected":""}>Solinari (White Robes)</option>
                                                            <option value="lunitari" ${t==="lunitari"?"selected":""}>Lunitari (Red Robes)</option>
                                                            <option value="nuitari" ${t==="nuitari"?"selected":""}>Nuitari (Black Robes)</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label style="font-size:0.75rem; color:var(--color-text-muted);">Cantrip 1:</label>
                                                        <select class="pc-tier-feat-spell-sel" data-tidx="${o}" data-field="cantrip1" style="width:100%; padding:4px; font-size:0.8rem; background:#1e1e1e; color:#fff; border:1px solid var(--color-border-subtle); border-radius:4px;">
                                                            <option value="">-- Choose Cantrip --</option>
                                                            ${a.cantrips.map(d=>`<option value="${d}" ${e.featSubChoices?.cantrip1===d?"selected":""}>${d}</option>`).join("")}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label style="font-size:0.75rem; color:var(--color-text-muted);">Cantrip 2:</label>
                                                        <select class="pc-tier-feat-spell-sel" data-tidx="${o}" data-field="cantrip2" style="width:100%; padding:4px; font-size:0.8rem; background:#1e1e1e; color:#fff; border:1px solid var(--color-border-subtle); border-radius:4px;">
                                                            <option value="">-- Choose Cantrip --</option>
                                                            ${a.cantrips.map(d=>`<option value="${d}" ${e.featSubChoices?.cantrip2===d?"selected":""}>${d}</option>`).join("")}
                                                        </select>
                                                    </div>
                                                    <div style="grid-column:1 / -1;">
                                                        <label style="font-size:0.75rem; color:var(--color-text-muted);">1st-Level Spell (${a.schools.join(" / ").toUpperCase()}):</label>
                                                        <select class="pc-tier-feat-spell-sel" data-tidx="${o}" data-field="spell1" style="width:100%; padding:4px; font-size:0.8rem; background:#1e1e1e; color:#fff; border:1px solid var(--color-border-subtle); border-radius:4px;">
                                                            <option value="">-- Choose 1st Level Spell --</option>
                                                            ${i.map(d=>`<option value="${d.name}" ${e.featSubChoices?.spell1===d.name?"selected":""}>${d.name}</option>`).join("")}
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>
                                        `}else if(/rune shaper/i.test(c))p+=`
                                            <div style="background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle); padding:10px; border-radius:6px; margin-top:6px; display:flex; flex-direction:column; gap:8px;">
                                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                                    <strong style="color:var(--color-gold-light); font-size:0.8rem;"><i class="fa-solid fa-gem"></i> Rune Shaper Runes:</strong>
                                                    <span class="badge" style="background:#0284c7; color:#fff; font-size:0.7rem; padding:2px 6px;">Comprehend Languages Auto-Learned</span>
                                                </div>
                                                <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                                                    <div>
                                                        <label style="font-size:0.75rem; color:var(--color-text-muted);">Rune Spell 1:</label>
                                                        <select class="pc-tier-feat-spell-sel" data-tidx="${o}" data-field="spell1" style="width:100%; padding:4px; font-size:0.8rem; background:#1e1e1e; color:#fff; border:1px solid var(--color-border-subtle); border-radius:4px;">
                                                            <option value="">-- Choose Rune Spell --</option>
                                                            ${RUNE_SHAPER_SPELLS.map(t=>`<option value="${t}" ${e.featSubChoices?.spell1===t?"selected":""}>${t}</option>`).join("")}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label style="font-size:0.75rem; color:var(--color-text-muted);">Rune Spell 2:</label>
                                                        <select class="pc-tier-feat-spell-sel" data-tidx="${o}" data-field="spell2" style="width:100%; padding:4px; font-size:0.8rem; background:#1e1e1e; color:#fff; border:1px solid var(--color-border-subtle); border-radius:4px;">
                                                            <option value="">-- Choose Rune Spell --</option>
                                                            ${RUNE_SHAPER_SPELLS.map(t=>`<option value="${t}" ${e.featSubChoices?.spell2===t?"selected":""}>${t}</option>`).join("")}
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>
                                        `;else if(/scion of the outer planes/i.test(c)){const t=e.featSubChoices?.plane||"neutral";e.featSubChoices=e.featSubChoices||{},e.featSubChoices.plane=t;const a=OUTER_PLANES[t]||OUTER_PLANES.neutral;e.featSubChoices.cantrip1=a.cantrip,p+=`
                                            <div style="background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle); padding:10px; border-radius:6px; margin-top:6px; display:flex; flex-direction:column; gap:8px;">
                                                <strong style="color:var(--color-gold-light); font-size:0.8rem;"><i class="fa-solid fa-ring"></i> Planar Alignment & Innate Magic:</strong>
                                                <div style="display:grid; grid-template-columns:1fr; gap:8px;">
                                                    <div>
                                                        <label style="font-size:0.75rem; color:var(--color-text-muted);">Plane Alignment:</label>
                                                        <select class="pc-tier-feat-plane-sel" data-tidx="${o}" style="width:100%; padding:4px; font-size:0.8rem; background:#1e1e1e; color:#fff; border:1px solid var(--color-border-subtle); border-radius:4px;">
                                                            ${Object.entries(OUTER_PLANES).map(([i,d])=>`<option value="${i}" ${t===i?"selected":""}>${d.name} (${d.cantrip} / ${d.resistance} Res)</option>`).join("")}
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>
                                        `}else if(/strike of the giants/i.test(c)){const t=e.featSubChoices?.giantStrike||"Cloud Strike";e.featSubChoices=e.featSubChoices||{},e.featSubChoices.giantStrike=t;const a=GIANT_STRIKES[t]||GIANT_STRIKES["Cloud Strike"];p+=`
                                            <div style="background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle); padding:10px; border-radius:6px; margin-top:6px; display:flex; flex-direction:column; gap:8px;">
                                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                                    <strong style="color:var(--color-gold-light); font-size:0.8rem;"><i class="fa-solid fa-hand-fist"></i> Giant Strike Benefit:</strong>
                                                    <span class="badge" style="background:#b45309; color:#fff; font-size:0.7rem; padding:2px 6px;">PB Uses / Long Rest</span>
                                                </div>
                                                <div>
                                                    <label style="font-size:0.75rem; color:var(--color-text-muted);">Chosen Strike:</label>
                                                    <select class="pc-tier-feat-subchoice-sel" data-tidx="${o}" data-field="giantStrike" style="width:100%; padding:4px; font-size:0.8rem; background:#1e1e1e; color:#fff; border:1px solid var(--color-border-subtle); border-radius:4px;">
                                                        ${Object.keys(GIANT_STRIKES).map(i=>`<option value="${i}" ${t===i?"selected":""}>${i} (+${GIANT_STRIKES[i].damage} ${GIANT_STRIKES[i].type})</option>`).join("")}
                                                    </select>
                                                </div>
                                                <div style="font-size:0.75rem; color:var(--color-text-secondary); line-height:1.35; padding:6px 8px; background:rgba(0,0,0,0.25); border-radius:4px;">
                                                    ${a.desc}
                                                </div>
                                            </div>
                                        `}else if(/skill expert/i.test(c)){const t=e.featSubChoices?.skillProf||STANDARD_5E_SKILLS[0],a=e.featSubChoices?.skillExp||STANDARD_5E_SKILLS[1];e.featSubChoices=e.featSubChoices||{},e.featSubChoices.skillProf||(e.featSubChoices.skillProf=t),e.featSubChoices.skillExp||(e.featSubChoices.skillExp=a),p+=`
                                            <div style="background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle); padding:10px; border-radius:6px; margin-top:6px; display:flex; flex-direction:column; gap:8px;">
                                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                                    <strong style="color:var(--color-gold-light); font-size:0.8rem;"><i class="fa-solid fa-graduation-cap"></i> Skill Expert Proficiencies:</strong>
                                                    <span class="badge" style="background:#059669; color:#fff; font-size:0.7rem; padding:2px 6px;">1 Proficiency + 1 Expertise</span>
                                                </div>
                                                <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                                                    <div>
                                                        <label style="font-size:0.75rem; color:var(--color-text-muted);">Gain Skill Proficiency:</label>
                                                        <select class="pc-tier-feat-subchoice-sel" data-tidx="${o}" data-field="skillProf" style="width:100%; padding:4px; font-size:0.8rem; background:#1e1e1e; color:#fff; border:1px solid var(--color-border-subtle); border-radius:4px;">
                                                            ${STANDARD_5E_SKILLS.map(i=>`<option value="${i}" ${t===i?"selected":""}>${i}</option>`).join("")}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label style="font-size:0.75rem; color:var(--color-text-muted);">Gain Skill Expertise:</label>
                                                        <select class="pc-tier-feat-subchoice-sel" data-tidx="${o}" data-field="skillExp" style="width:100%; padding:4px; font-size:0.8rem; background:#1e1e1e; color:#fff; border:1px solid var(--color-border-subtle); border-radius:4px;">
                                                            ${STANDARD_5E_SKILLS.map(i=>`<option value="${i}" ${a===i?"selected":""}>${i} (Expertise)</option>`).join("")}
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>
                                        `}else if(/skilled/i.test(c)&&!/expert/i.test(c)){const t=e.featSubChoices?.skillTool1||STANDARD_5E_SKILLS[0],a=e.featSubChoices?.skillTool2||STANDARD_5E_SKILLS[1],i=e.featSubChoices?.skillTool3||STANDARD_5E_SKILLS[2];e.featSubChoices=e.featSubChoices||{},e.featSubChoices.skillTool1||(e.featSubChoices.skillTool1=t),e.featSubChoices.skillTool2||(e.featSubChoices.skillTool2=a),e.featSubChoices.skillTool3||(e.featSubChoices.skillTool3=i);const d=[...STANDARD_5E_SKILLS.map(s=>({group:"Skills",val:s})),...STANDARD_5E_TOOLS.map(s=>({group:"Tools",val:s}))];p+=`
                                            <div style="background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle); padding:10px; border-radius:6px; margin-top:6px; display:flex; flex-direction:column; gap:8px;">
                                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                                    <strong style="color:var(--color-gold-light); font-size:0.8rem;"><i class="fa-solid fa-award"></i> Skilled Proficiencies:</strong>
                                                    <span class="badge" style="background:#059669; color:#fff; font-size:0.7rem; padding:2px 6px;">Choose 3 Skills or Tools</span>
                                                </div>
                                                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(130px, 1fr)); gap:8px;">
                                                    <div>
                                                        <label style="font-size:0.75rem; color:var(--color-text-muted);">Proficiency 1:</label>
                                                        <select class="pc-tier-feat-subchoice-sel" data-tidx="${o}" data-field="skillTool1" style="width:100%; padding:4px; font-size:0.8rem; background:#1e1e1e; color:#fff; border:1px solid var(--color-border-subtle); border-radius:4px;">
                                                            ${d.map(s=>`<option value="${s.val}" ${t===s.val?"selected":""}>[${s.group}] ${s.val}</option>`).join("")}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label style="font-size:0.75rem; color:var(--color-text-muted);">Proficiency 2:</label>
                                                        <select class="pc-tier-feat-subchoice-sel" data-tidx="${o}" data-field="skillTool2" style="width:100%; padding:4px; font-size:0.8rem; background:#1e1e1e; color:#fff; border:1px solid var(--color-border-subtle); border-radius:4px;">
                                                            ${d.map(s=>`<option value="${s.val}" ${a===s.val?"selected":""}>[${s.group}] ${s.val}</option>`).join("")}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label style="font-size:0.75rem; color:var(--color-text-muted);">Proficiency 3:</label>
                                                        <select class="pc-tier-feat-subchoice-sel" data-tidx="${o}" data-field="skillTool3" style="width:100%; padding:4px; font-size:0.8rem; background:#1e1e1e; color:#fff; border:1px solid var(--color-border-subtle); border-radius:4px;">
                                                            ${d.map(s=>`<option value="${s.val}" ${i===s.val?"selected":""}>[${s.group}] ${s.val}</option>`).join("")}
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>
                                        `}else if(/prodigy/i.test(c)){const t=e.featSubChoices?.skill1||STANDARD_5E_SKILLS[0],a=e.featSubChoices?.tool1||STANDARD_5E_TOOLS[0],i=e.featSubChoices?.lang1||STANDARD_5E_LANGUAGES[0],d=e.featSubChoices?.skillExp||STANDARD_5E_SKILLS[1];e.featSubChoices=e.featSubChoices||{},e.featSubChoices.skill1||(e.featSubChoices.skill1=t),e.featSubChoices.tool1||(e.featSubChoices.tool1=a),e.featSubChoices.lang1||(e.featSubChoices.lang1=i),e.featSubChoices.skillExp||(e.featSubChoices.skillExp=d),p+=`
                                            <div style="background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle); padding:10px; border-radius:6px; margin-top:6px; display:flex; flex-direction:column; gap:8px;">
                                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                                    <strong style="color:var(--color-gold-light); font-size:0.8rem;"><i class="fa-solid fa-star"></i> Prodigy Selections:</strong>
                                                    <span class="badge" style="background:#7c3aed; color:#fff; font-size:0.7rem; padding:2px 6px;">Skill, Tool, Language & Expertise</span>
                                                </div>
                                                <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                                                    <div>
                                                        <label style="font-size:0.75rem; color:var(--color-text-muted);">Skill Proficiency:</label>
                                                        <select class="pc-tier-feat-subchoice-sel" data-tidx="${o}" data-field="skill1" style="width:100%; padding:4px; font-size:0.8rem; background:#1e1e1e; color:#fff; border:1px solid var(--color-border-subtle); border-radius:4px;">
                                                            ${STANDARD_5E_SKILLS.map(s=>`<option value="${s}" ${t===s?"selected":""}>${s}</option>`).join("")}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label style="font-size:0.75rem; color:var(--color-text-muted);">Tool Proficiency:</label>
                                                        <select class="pc-tier-feat-subchoice-sel" data-tidx="${o}" data-field="tool1" style="width:100%; padding:4px; font-size:0.8rem; background:#1e1e1e; color:#fff; border:1px solid var(--color-border-subtle); border-radius:4px;">
                                                            ${STANDARD_5E_TOOLS.map(s=>`<option value="${s}" ${a===s?"selected":""}>${s}</option>`).join("")}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label style="font-size:0.75rem; color:var(--color-text-muted);">Language:</label>
                                                        <select class="pc-tier-feat-subchoice-sel" data-tidx="${o}" data-field="lang1" style="width:100%; padding:4px; font-size:0.8rem; background:#1e1e1e; color:#fff; border:1px solid var(--color-border-subtle); border-radius:4px;">
                                                            ${STANDARD_5E_LANGUAGES.map(s=>`<option value="${s}" ${i===s?"selected":""}>${s}</option>`).join("")}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label style="font-size:0.75rem; color:var(--color-text-muted);">Skill Expertise:</label>
                                                        <select class="pc-tier-feat-subchoice-sel" data-tidx="${o}" data-field="skillExp" style="width:100%; padding:4px; font-size:0.8rem; background:#1e1e1e; color:#fff; border:1px solid var(--color-border-subtle); border-radius:4px;">
                                                            ${STANDARD_5E_SKILLS.map(s=>`<option value="${s}" ${d===s?"selected":""}>${s} (Expertise)</option>`).join("")}
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>
                                        `}else if(/fighting initiate/i.test(c)){const t=e.featSubChoices?.fightingStyle||FIGHTING_STYLES[0];e.featSubChoices=e.featSubChoices||{},e.featSubChoices.fightingStyle||(e.featSubChoices.fightingStyle=t),p+=`
                                            <div style="background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle); padding:10px; border-radius:6px; margin-top:6px; display:flex; flex-direction:column; gap:8px;">
                                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                                    <strong style="color:var(--color-gold-light); font-size:0.8rem;"><i class="fa-solid fa-shield-halved"></i> Fighting Style:</strong>
                                                    <span class="badge" style="background:#b45309; color:#fff; font-size:0.7rem; padding:2px 6px;">Choose 1 Fighting Style</span>
                                                </div>
                                                <div>
                                                    <select class="pc-tier-feat-subchoice-sel" data-tidx="${o}" data-field="fightingStyle" style="width:100%; padding:4px; font-size:0.8rem; background:#1e1e1e; color:#fff; border:1px solid var(--color-border-subtle); border-radius:4px;">
                                                        ${FIGHTING_STYLES.map(a=>`<option value="${a}" ${t===a?"selected":""}>${a}</option>`).join("")}
                                                    </select>
                                                </div>
                                            </div>
                                        `}else if(/eldritch adept/i.test(c)){const t=e.featSubChoices?.invocation||ELDRITCH_INVOCATIONS_BASIC[0];e.featSubChoices=e.featSubChoices||{},e.featSubChoices.invocation||(e.featSubChoices.invocation=t),p+=`
                                            <div style="background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle); padding:10px; border-radius:6px; margin-top:6px; display:flex; flex-direction:column; gap:8px;">
                                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                                    <strong style="color:var(--color-gold-light); font-size:0.8rem;"><i class="fa-solid fa-eye"></i> Eldritch Invocation:</strong>
                                                    <span class="badge" style="background:#7c3aed; color:#fff; font-size:0.7rem; padding:2px 6px;">Choose 1 Invocation</span>
                                                </div>
                                                <div>
                                                    <select class="pc-tier-feat-subchoice-sel" data-tidx="${o}" data-field="invocation" style="width:100%; padding:4px; font-size:0.8rem; background:#1e1e1e; color:#fff; border:1px solid var(--color-border-subtle); border-radius:4px;">
                                                        ${ELDRITCH_INVOCATIONS_BASIC.map(a=>`<option value="${a}" ${t===a?"selected":""}>${a}</option>`).join("")}
                                                    </select>
                                                </div>
                                            </div>
                                        `}else if(/metamagic adept/i.test(c)){const t=e.featSubChoices?.metamagic1||METAMAGIC_OPTIONS[0],a=e.featSubChoices?.metamagic2||METAMAGIC_OPTIONS[1];e.featSubChoices=e.featSubChoices||{},e.featSubChoices.metamagic1||(e.featSubChoices.metamagic1=t),e.featSubChoices.metamagic2||(e.featSubChoices.metamagic2=a),p+=`
                                            <div style="background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle); padding:10px; border-radius:6px; margin-top:6px; display:flex; flex-direction:column; gap:8px;">
                                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                                    <strong style="color:var(--color-gold-light); font-size:0.8rem;"><i class="fa-solid fa-sparkles"></i> Metamagic Adept Options:</strong>
                                                    <span class="badge" style="background:#0284c7; color:#fff; font-size:0.7rem; padding:2px 6px;">Choose 2 Metamagics</span>
                                                </div>
                                                <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                                                    <div>
                                                        <label style="font-size:0.75rem; color:var(--color-text-muted);">Metamagic 1:</label>
                                                        <select class="pc-tier-feat-subchoice-sel" data-tidx="${o}" data-field="metamagic1" style="width:100%; padding:4px; font-size:0.8rem; background:#1e1e1e; color:#fff; border:1px solid var(--color-border-subtle); border-radius:4px;">
                                                            ${METAMAGIC_OPTIONS.map(i=>`<option value="${i}" ${t===i?"selected":""}>${i}</option>`).join("")}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label style="font-size:0.75rem; color:var(--color-text-muted);">Metamagic 2:</label>
                                                        <select class="pc-tier-feat-subchoice-sel" data-tidx="${o}" data-field="metamagic2" style="width:100%; padding:4px; font-size:0.8rem; background:#1e1e1e; color:#fff; border:1px solid var(--color-border-subtle); border-radius:4px;">
                                                            ${METAMAGIC_OPTIONS.map(i=>`<option value="${i}" ${a===i?"selected":""}>${i}</option>`).join("")}
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>
                                        `}else if(/elemental adept/i.test(c)){const t=e.featSubChoices?.elementalType||ELEMENTAL_TYPES[0];e.featSubChoices=e.featSubChoices||{},e.featSubChoices.elementalType||(e.featSubChoices.elementalType=t),p+=`
                                            <div style="background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle); padding:10px; border-radius:6px; margin-top:6px; display:flex; flex-direction:column; gap:8px;">
                                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                                    <strong style="color:var(--color-gold-light); font-size:0.8rem;"><i class="fa-solid fa-fire"></i> Elemental Adept Damage Type:</strong>
                                                    <span class="badge" style="background:#ea580c; color:#fff; font-size:0.7rem; padding:2px 6px;">Choose 1 Element</span>
                                                </div>
                                                <div>
                                                    <select class="pc-tier-feat-subchoice-sel" data-tidx="${o}" data-field="elementalType" style="width:100%; padding:4px; font-size:0.8rem; background:#1e1e1e; color:#fff; border:1px solid var(--color-border-subtle); border-radius:4px;">
                                                        ${ELEMENTAL_TYPES.map(a=>`<option value="${a}" ${t===a?"selected":""}>${a}</option>`).join("")}
                                                    </select>
                                                </div>
                                            </div>
                                        `}else if(/martial adept/i.test(c)){const t=e.featSubChoices?.maneuver1||BATTLEMASTER_MANEUVERS[0],a=e.featSubChoices?.maneuver2||BATTLEMASTER_MANEUVERS[1];e.featSubChoices=e.featSubChoices||{},e.featSubChoices.maneuver1||(e.featSubChoices.maneuver1=t),e.featSubChoices.maneuver2||(e.featSubChoices.maneuver2=a),p+=`
                                            <div style="background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle); padding:10px; border-radius:6px; margin-top:6px; display:flex; flex-direction:column; gap:8px;">
                                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                                    <strong style="color:var(--color-gold-light); font-size:0.8rem;"><i class="fa-solid fa-hand-fist"></i> Martial Adept Maneuvers:</strong>
                                                    <span class="badge" style="background:#b45309; color:#fff; font-size:0.7rem; padding:2px 6px;">Choose 2 Maneuvers (+1d6 die)</span>
                                                </div>
                                                <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                                                    <div>
                                                        <label style="font-size:0.75rem; color:var(--color-text-muted);">Maneuver 1:</label>
                                                        <select class="pc-tier-feat-subchoice-sel" data-tidx="${o}" data-field="maneuver1" style="width:100%; padding:4px; font-size:0.8rem; background:#1e1e1e; color:#fff; border:1px solid var(--color-border-subtle); border-radius:4px;">
                                                            ${BATTLEMASTER_MANEUVERS.map(i=>`<option value="${i}" ${t===i?"selected":""}>${i}</option>`).join("")}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label style="font-size:0.75rem; color:var(--color-text-muted);">Maneuver 2:</label>
                                                        <select class="pc-tier-feat-subchoice-sel" data-tidx="${o}" data-field="maneuver2" style="width:100%; padding:4px; font-size:0.8rem; background:#1e1e1e; color:#fff; border:1px solid var(--color-border-subtle); border-radius:4px;">
                                                            ${BATTLEMASTER_MANEUVERS.map(i=>`<option value="${i}" ${a===i?"selected":""}>${i}</option>`).join("")}
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>
                                        `}else if(/weapon master/i.test(c)){const t=e.featSubChoices?.weapon1||WEAPON_OPTIONS[0],a=e.featSubChoices?.weapon2||WEAPON_OPTIONS[1],i=e.featSubChoices?.weapon3||WEAPON_OPTIONS[2],d=e.featSubChoices?.weapon4||WEAPON_OPTIONS[3];e.featSubChoices=e.featSubChoices||{},e.featSubChoices.weapon1||(e.featSubChoices.weapon1=t),e.featSubChoices.weapon2||(e.featSubChoices.weapon2=a),e.featSubChoices.weapon3||(e.featSubChoices.weapon3=i),e.featSubChoices.weapon4||(e.featSubChoices.weapon4=d),p+=`
                                            <div style="background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle); padding:10px; border-radius:6px; margin-top:6px; display:flex; flex-direction:column; gap:8px;">
                                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                                    <strong style="color:var(--color-gold-light); font-size:0.8rem;"><i class="fa-solid fa-shield"></i> Weapon Master Proficiencies:</strong>
                                                    <span class="badge" style="background:#059669; color:#fff; font-size:0.7rem; padding:2px 6px;">Choose 4 Weapons</span>
                                                </div>
                                                <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                                                    <div>
                                                        <label style="font-size:0.75rem; color:var(--color-text-muted);">Weapon 1:</label>
                                                        <select class="pc-tier-feat-subchoice-sel" data-tidx="${o}" data-field="weapon1" style="width:100%; padding:4px; font-size:0.8rem; background:#1e1e1e; color:#fff; border:1px solid var(--color-border-subtle); border-radius:4px;">
                                                            ${WEAPON_OPTIONS.map(s=>`<option value="${s}" ${t===s?"selected":""}>${s}</option>`).join("")}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label style="font-size:0.75rem; color:var(--color-text-muted);">Weapon 2:</label>
                                                        <select class="pc-tier-feat-subchoice-sel" data-tidx="${o}" data-field="weapon2" style="width:100%; padding:4px; font-size:0.8rem; background:#1e1e1e; color:#fff; border:1px solid var(--color-border-subtle); border-radius:4px;">
                                                            ${WEAPON_OPTIONS.map(s=>`<option value="${s}" ${a===s?"selected":""}>${s}</option>`).join("")}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label style="font-size:0.75rem; color:var(--color-text-muted);">Weapon 3:</label>
                                                        <select class="pc-tier-feat-subchoice-sel" data-tidx="${o}" data-field="weapon3" style="width:100%; padding:4px; font-size:0.8rem; background:#1e1e1e; color:#fff; border:1px solid var(--color-border-subtle); border-radius:4px;">
                                                            ${WEAPON_OPTIONS.map(s=>`<option value="${s}" ${i===s?"selected":""}>${s}</option>`).join("")}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label style="font-size:0.75rem; color:var(--color-text-muted);">Weapon 4:</label>
                                                        <select class="pc-tier-feat-subchoice-sel" data-tidx="${o}" data-field="weapon4" style="width:100%; padding:4px; font-size:0.8rem; background:#1e1e1e; color:#fff; border:1px solid var(--color-border-subtle); border-radius:4px;">
                                                            ${WEAPON_OPTIONS.map(s=>`<option value="${s}" ${d===s?"selected":""}>${s}</option>`).join("")}
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>
                                        `}return`
                                        <div style="background:rgba(0,0,0,0.2); border:1px solid var(--color-border-subtle); padding:10px 12px; border-radius:6px; font-size:0.8rem; line-height:1.45; color:var(--color-text-secondary); max-height:140px; overflow-y:auto;" class="scroll-styled">
                                            <strong style="color:var(--color-gold-light);">${n.name}:</strong> ${n.description||(Array.isArray(n.entries)?n.entries.join(" "):"No description.")}
                                        </div>
                                        ${p}
                                    `})():""}
                            </div>
                        `}
                    </div>
                `}).join("")}
            </div>
        `}
    `,u.querySelectorAll(".pc-wiz-tier-choice").forEach(e=>{e.addEventListener("click",o=>{const l=parseInt(o.target.dataset.tidx),m=o.target.dataset.choice;r[l]&&(r[l].choice=m,m==="asi"&&(r[l].asiMode=r[l].asiMode||"plus2",r[l].stat1=r[l].stat1||"str"),b().then(()=>renderStep7(f)))})}),u.querySelectorAll(".pc-wiz-tier-asimode").forEach(e=>{e.addEventListener("change",o=>{const l=parseInt(o.target.dataset.tidx);r[l]&&(r[l].asiMode=o.target.value,b().then(()=>renderStep7(f)))})}),u.querySelectorAll(".pc-wiz-tier-stat1").forEach(e=>{e.addEventListener("change",o=>{const l=parseInt(o.target.dataset.tidx);r[l]&&(r[l].stat1=o.target.value,b().then(()=>x()))})}),u.querySelectorAll(".pc-wiz-tier-stat2").forEach(e=>{e.addEventListener("change",o=>{const l=parseInt(o.target.dataset.tidx);r[l]&&(r[l].stat2=o.target.value,b().then(()=>x()))})}),u.querySelectorAll(".pc-tier-feat-spellclass-sel").forEach(e=>{e.addEventListener("change",o=>{const l=parseInt(o.target.dataset.tidx);r[l]&&(r[l].featSubChoices=r[l].featSubChoices||{},r[l].featSubChoices.spellClass=o.target.value,r[l].featSubChoices.cantrip1="",r[l].featSubChoices.cantrip2="",r[l].featSubChoices.spell1="",renderStep7(f))})}),u.querySelectorAll(".pc-tier-feat-college-sel").forEach(e=>{e.addEventListener("change",o=>{const l=parseInt(o.target.dataset.tidx);r[l]&&(r[l].featSubChoices=r[l].featSubChoices||{},r[l].featSubChoices.college=o.target.value,r[l].featSubChoices.cantrip1="",r[l].featSubChoices.cantrip2="",r[l].featSubChoices.spell1="",renderStep7(f))})}),u.querySelectorAll(".pc-tier-feat-moon-sel").forEach(e=>{e.addEventListener("change",o=>{const l=parseInt(o.target.dataset.tidx);r[l]&&(r[l].featSubChoices=r[l].featSubChoices||{},r[l].featSubChoices.moon=o.target.value,r[l].featSubChoices.cantrip1="",r[l].featSubChoices.cantrip2="",r[l].featSubChoices.spell1="",renderStep7(f))})}),u.querySelectorAll(".pc-tier-feat-plane-sel").forEach(e=>{e.addEventListener("change",o=>{const l=parseInt(o.target.dataset.tidx);if(r[l]){r[l].featSubChoices=r[l].featSubChoices||{},r[l].featSubChoices.plane=o.target.value;const m=OUTER_PLANES[o.target.value]||OUTER_PLANES.neutral;r[l].featSubChoices.cantrip1=m.cantrip,renderStep7(f)}})}),u.querySelectorAll(".pc-tier-feat-ability-sel").forEach(e=>{e.addEventListener("change",o=>{const l=parseInt(o.target.dataset.tidx);r[l]&&(r[l].featSubChoices=r[l].featSubChoices||{},r[l].featSubChoices.abilityScore=o.target.value)})}),u.querySelectorAll(".pc-tier-feat-halfstat-sel").forEach(e=>{e.addEventListener("change",o=>{const l=parseInt(o.target.dataset.tidx);r[l]&&(r[l].halfFeatStat=o.target.value,r[l].featSubChoices=r[l].featSubChoices||{},r[l].featSubChoices.halfFeatStat=o.target.value,b().then(()=>x()))})}),u.querySelectorAll(".pc-tier-feat-spell-sel").forEach(e=>{e.addEventListener("change",o=>{const l=parseInt(o.target.dataset.tidx),m=o.target.dataset.field;r[l]&&(r[l].featSubChoices=r[l].featSubChoices||{},r[l].featSubChoices[m]=o.target.value)})}),u.querySelectorAll(".pc-tier-feat-subchoice-sel").forEach(e=>{e.addEventListener("change",o=>{const l=parseInt(o.target.dataset.tidx),m=o.target.dataset.field;r[l]&&(r[l].featSubChoices=r[l].featSubChoices||{},r[l].featSubChoices[m]=o.target.value,m==="giantStrike"&&renderStep7(f))})}),u.querySelectorAll(".pc-tier-feat-sel").forEach(e=>{e.addEventListener("change",o=>{const l=parseInt(o.target.dataset.tidx);r[l]&&(r[l].selectedFeatId=o.target.value,r[l].featSubChoices={},b().then(()=>renderStep7(f)))})})}export const renderStepFeats=renderStep7,renderStep6=renderStep7;
