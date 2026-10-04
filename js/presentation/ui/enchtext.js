/* =====================================================================
   enchtext.js - what an enchantment is doing for you right now (2026-09-17).
   ENCHANT_TEXT describes an enchantment in the abstract ("5% chance per Shadow point"), which is the right
   thing to read at the Forge, where you are choosing what to put into a piece of gear. On the item itself it
   is the wrong question: there you want the number you actually have. enchantLive() computes the live values
   from your affinity (and Old Anvil's rank, which enchantScale folds in), and the item cards use it.
   The Forge keeps the per-point wording.
   ===================================================================== */

function ePts(el){ return (player && player.aff && player.aff[el]) || 0; }
function enchantLive(slot,el){
  if(typeof player==='undefined'||!player)return FoteEnchantments.formula(slot,el);
  var context=enchantContext();
  context.maxhp=player.maxhp;
  if(slot==='orb'&&el==='fire')context.burnDamage=burnDmg();
  return FoteEnchantments.describe(slot,el,ePts(el),context);
}

/* Ability text reports the current result, never its scaling formula.
 * Equipment and stat passives keep their separate bonus descriptions. */
function lvRank(){ return typeof godRank==='function' ? godRank() : 0; }
function lvDiv(){ return (typeof divineStrength==='function' ? divineStrength() : 1); }
function lvNumber(n){return Number(n.toFixed(1));}
function wobblesPassiveDetails(){return actionDetail('Wobbles may grant gifts, restore your strength or play a prank.');}
function lvHealing(n,holyGround){
  return lvNumber(playerHealingAmount(n,{holyGround:!!holyGround}));
}
function lvRegeneration(n){return lvNumber(playerHealingAmount(n,{regen:true}));}
function lvDamage(A){
  if(A.divinePowerOnly){var damage=arcaneLanceRules().damage;return damage+'-'+damage;}
  var base=A.base||AOE_BASE;
  function value(n){
    if(A.kind==='bolt')return A.tech?n+Math.floor((player.dmg[0]+player.dmg[1])/4):Math.round((sDMG(n)+(A.perAffinity?A.perAffinity*totalAffinity():0))*spellPower(A));
    if(A.kind==='dawn')return Math.round(sDMG(n)*spellPower(A));
    return spellBaseDamage(A,n);
  }
  return value(base[0])+'-'+value(base[1]);
}
function lvDivineDamage(extra){return Math.round(5*godRank()*divineStrength())+'-'+Math.round((5*godRank()+extra)*divineStrength());}
var RANK_LIVE = {
  3: {
    fire:   function(n){ return 'Searing: +'+(5*n)+'% damage to Burning enemies. Immune to Burning.'; },
    water:  function(n){ return 'Deep Chill: your Chill slows enemies by '+Math.round(Math.min(50, 33+3*n))+'%. Immune to Chill and Freeze.'; },
    air:    function(n){ var arc=FoteDamage.airArc(n);return 'Arc: attacks and spell hits have a '+Math.round(100*arc.chance)+'% chance to hit up to '+arc.targets+' nearby enemies within '+arc.range+' tiles for '+Math.round(100*arc.damageMultiplier)+'% damage. Arcs do not trigger more arcs. Immune to Stun.'; },
    earth:  function(n){ var t=Math.min(3, Math.max(1, n-2)); return 'Venom: Root also inflicts Poison for '+t+' turn'+(t===1?'':'s')+': 10% max HP per turn (bosses 5%). Immune to Root.'; },
    light:  function(n){ return 'Radiance: heal '+n+' HP when you deal light damage. Immune to Blind.'; },
    shadow: function(n){ return 'Fade: hide after '+Math.max(4, 16-2*n)+' quiet turns out of combat. Immune to Fear.'; }
  }
};
function rankLive(r, e){
  var n=ePts(e), f=RANK_LIVE[r] && RANK_LIVE[r][e];
  if(f && n>=r){ try { return f(n); } catch(x){} }
  return (typeof RANK_TEXT!=='undefined' && RANK_TEXT[r] && RANK_TEXT[r][e]) || '';
}
/* One semantic record feeds cards, sheets and plain-text descriptions. Facts
 * carry the existing live calculations; renderers never parse narrative text. */
function actionDetail(summary,facts,notes){
  return {summary:summary||'',facts:(facts||[]).map(function(f){return {label:f[0],value:String(f[1])};}),notes:notes||[]};
}
function actionFact(detail,label,value){
  if(value===undefined||value===null||value==='')return;
  var old=detail.facts.find(function(f){return f.label===label;});
  if(old)old.value=String(value);else detail.facts.push({label:label,value:String(value)});
}
function lvTurns(n){return n+' turn'+(n===1?'':'s');}
/* Cards have no selected recipient. Query the application owner for ordinary
 * foes and boss exceptions; these descriptors never enter the actor list. */
function lvStatusTurns(key,turns,options){
  options=options||{};
  var enemy={foe:true,base:{}},boss={foe:true,base:{boss:true}},application=options.application;
  var normal=gameEffects.duration(enemy,key,turns,application),text=lvTurns(normal);
  if(options.allies||options.others)text+=' on enemies';
  if(options.alternative){
    var alternative=gameEffects.duration(enemy,key,options.alternative.turns,application);
    text+='; '+alternative+' '+options.alternative.when;
  }
  if(options.bosses!==false){
    var bossTurns=gameEffects.duration(boss,key,turns,application);
    if(bossTurns!==normal||options.alternative&&gameEffects.duration(boss,key,options.alternative.turns,application)!==alternative)text+='; bosses '+lvTurns(bossTurns);
  }
  if(options.allies||options.others){
    var ally=gameEffects.duration({ally:true,base:{}},key,turns,application);
    var constitution=gameEffects.duration({ally:true,base:{},shadowClone:true,cloneStats:{passives:{ironConst:true}}},key,turns,application);
    text+='; '+(options.others?'others':'allies')+' '+lvTurns(ally)+(ally===constitution?'':' ('+constitution+' with Iron Constitution)');
  }
  return text;
}
function lvTiles(n){return n+' tile'+(n===1?'':'s');}
function lvRange(A){return A.kind==='lunge'?reginaldRules().lunge.range:A.kind==='charge'||A.kind==='upheaval'?A.range:spellRange(A);}
function lvWeaponDamage(mult){return weaponDamageRange(mult||1,true).join('-')+' physical';}
function lvRangedWeaponFact(detail,mult){
  var view=player;
  if(player.ranged&&typeof isRangedWeapon==='function'&&isRangedWeapon(player.ranged))view=attackView(player,null,{weapon:player.ranged});
  else if(!player.weapon||!(player.weapon.range>1))return;
  var damage=detail.facts.find(function(f){return f.label==='Damage';});if(damage)damage.label='Melee damage';
  actionFact(detail,'Ranged damage',weaponDamageRange(mult,false,view).join('-')+' physical');
  detail.notes.push('Targets beyond 1 tile use your ranged weapon.');
}
var ABILITY_LIVE = {
  double:function(){return actionDetail('Strike one enemy twice.',[['Damage',lvWeaponDamage()+' per hit'],['Range','Adjacent']]);},
  shadowswarm:function(A){var s=shadowSwarmStats(A);return actionDetail('Place a group of melee attackers.',[['Damage',s.damage+' shadow per Shade'],['Summons','Up to 9 Shades · '+s.hp+' HP each'],['Area','3×3 tiles'],['Duration',lvTurns(s.duration)]],['Replaces your previous swarm.']);},
  missile:function(A){return actionDetail('Always hits one enemy, ignoring resistance.',[['Damage',lvDamage(A)+' magic']]);},
  sap:function(A){return actionDetail('Stun one enemy.',[['Damage',lvDamage(A)+' physical'],['Stun',lvStatusTurns('stun',A.status.stun,{alternative:{turns:6,when:'if unaware'}})]],['The waking hit is a surprise critical. The target then resists further Saps.']);},
  firebolt:function(A){return actionDetail('Burn one enemy.',[['Damage',lvDamage(A)+' fire'],['Burning',lvStatusTurns('burn',A.status.burn)]],['Ignites grass; destroys thorns.']);},
  frostshard:function(A){return actionDetail('Slow one enemy with Chill.',[['Damage',lvDamage(A)+' frost'],['Freeze',(ePts('water')>=6?3:4)+' Chill stacks · '+lvStatusTurns('frozen',2)]]);},
  root:function(A){return actionDetail('Hold one enemy in place.',[['Damage',lvDamage(A)+' physical'],['Root',lvStatusTurns('root',A.status.root)]]);},
  shadowbolt:function(A){return actionDetail('Make one enemy flee.',[['Damage',lvDamage(A)+' shadow'],['Fear',lvStatusTurns('fear',A.status.fear)]]);},
  spark:function(A){return actionDetail('Hit one enemy, with a chance to Stun.',[['Damage',lvDamage(A)+' lightning'],['Stun',(5*ePts('air'))+'% chance · '+lvStatusTurns('stun',1)]],['+50% damage to Wet targets.']);},
  smite:function(A){return actionDetail('Hit one enemy, with a chance to Blind.',[['Damage',lvDamage(A)+' light'],['Blind',(10*ePts('light'))+'% chance · '+lvStatusTurns('blind',2)]],['+50% damage to undead and shadow creatures.']);},
  fireball:function(A){return actionDetail('Blast a visible tile.',[['Damage',lvDamage(A)+' fire'],['Area','5×5 tiles'],['Burning',lvStatusTurns('burn',3)]]);},
  frostcone:function(A){return actionDetail('Chill and push enemies ahead of you.',[['Damage',lvDamage(A)+' frost'],['Area','Cone'],['Knockback','1 tile']]);},
  chainbolt:function(A){var chain=FoteDamage.chainLightning();return actionDetail('Jump between nearby enemies.',[['Damage',lvDamage(A)+' lightning'],['Targets','Up to '+chain.targets],['Jump range',chain.jumpRange+' tiles']],['Each jump deals '+Math.round((1-chain.damageMultiplier)*100)+'% less damage than the last.']);},
  earthquake:function(A){return actionDetail('Damage nearby creatures.',[['Damage',lvDamage(A)+' physical'],['Area','5-tile radius']],['Hits your summons; does not hit you.']);},
  radiantbeam:function(A){return actionDetail('Fire a beam through enemies.',[['Damage',lvDamage(A)+' light'],['Width','3 tiles'],['Blind',(5*ePts('light'))+'% chance · '+lvStatusTurns('blind',2)]],['+50% damage to undead and shadow creatures.']);},
  ironbody:function(){return actionDetail('Gain armor; unarmed hits can Stun.',[['Armor','+'+Math.round(4*lvDiv())],['Stun',Math.round(30*lvDiv())+'% chance on unarmed hits · '+lvStatusTurns('stun',1)],['Duration',lvTurns(fullDivineDuration(12))]]);},
  bellow:function(){return actionDetail('Stun nearby enemies and recover HP.',[['Healing',lvHealing(Math.round(player.maxhp*(.10+.02*godRank())*lvDiv()))+' HP'],['Area','3-tile radius'],['Stun',lvStatusTurns('stun',1)]]);},
  temper:function(){return actionDetail('',[['Weapon damage','+'+Math.round(2*lvDiv())],['Armor','+'+Math.round(4*lvDiv())],['Duration',lvTurns(fullDivineDuration(12))],['Cast','Instant']]);},
  unholyaura:function(){return actionDetail('Drain nearby enemies each turn.',[['Damage',Math.round(4*godRank()*lvDiv())+' shadow per turn'],['Healing',lvHealing(1)+' HP per enemy hit'],['Area','2-tile radius'],['Duration',lvTurns(fullDivineDuration(8))]]);},
  intothedark:function(){return actionDetail('Hide and break pursuit.',[['Bonus damage','+'+Math.round(SYLLA.darkPerRank*godRank()*lvDiv()*100)+'% on your next hit from hiding'],['Duration',lvTurns(fullDivineDuration(SYLLA.darkTurns))]]);},
  heal:function(){var r=godRank(),bonus=(1+.10*r)*(inSanctuary(player)?1+.25*holyGroundStrength(player):1),raw=Math.round(player.maxhp*(.10+.02*r)*lvDiv());return actionDetail('',[['Healing','Up to '+lvHealing(Math.min(raw,player.maxhp*.4/bonus))+' HP']]);},
  dawn:function(A){return actionDetail('Reveal every enemy on the floor.',[['Damage',Math.round(sDMG(A.base[0])*spellPower(A))+'-'+Math.round(sDMG(A.base[1])*spellPower(A))+' light'],['Targets','Visible enemies'],['Blind',lvStatusTurns('blind',3)],['Reveal','All enemies · 20 turns']]);},
  glacialtomb:function(A){return actionDetail('Disable one enemy and make it immune to damage.',[['Damage',spellBaseDamage(A,A.base[0])+'-'+spellBaseDamage(A,A.base[1])+' frost to adjacent enemies'],['Duration','10 turns; elites 6, bosses 2']],['Self-cast: 3 turns, then restore 25% max HP and Mana.']);},
  upheaval:function(A){return actionDetail('Raise a barrier across your aim, centered on the chosen square.',[['Damage',spellBaseDamage(A,A.base[0])+'-'+spellBaseDamage(A,A.base[1])+' physical'],['Walls','Up to 7'],['Area','Within 2 tiles of the walls'],['Root',lvStatusTurns('root',2,{allies:true})],['Duration','20 turns']],['Hits your summons; does not hit you.']);},
  arcanelance:function(){return actionDetail('Strike one enemy.',[['Damage',arcaneLanceRules().damage+' magic']],['Spell Power and affinity do not increase its base damage.']);},
  livingflame:function(A){var sp=spellPower(A);return actionDetail('Summon a ranged attacker.',[['Damage',Math.round(5*sp)+'-'+Math.round(9*sp)+' fire'],['Summon HP',Math.round(28*sp)],['Attack range','6 tiles'],['Duration','30 turns']],['Damages adjacent enemies on arrival. Every third shot splashes for half damage. Uses one of 2 summon slots.']);},
  raisedead:function(){return actionDetail('Call an undead servant.',[['Summons','One servant']],['Cannot summon while your servant still stands.']);},
  lunge:function(){var rule=reginaldRules().lunge;return actionDetail('Move beside an enemy and attack with your main hand.',[['Damage',lvWeaponDamage(lvDiv())],['Stun',lvStatusTurns('stun',rule.stun)]],['Stun requires a damaging hit. Requires a clear route and an empty adjacent landing tile.']);},
  rolldice:function(){return actionDetail('Invite Wobbles to grant a reward or play a prank.');},
  shadowstep:function(){return actionDetail('Hide and break pursuit.',[['Duration',lvTurns(fullDivineDuration(3))]],['Requires no adjacent enemies.']);},
  charge:function(A){return actionDetail('Charge in a straight line to open ground or an enemy.',[['Damage',lvWeaponDamage()],['Stun','Adjacent enemies at your destination · '+lvStatusTurns('stun',2)]],['Always hits an enemy target. Cannot charge while rooted or frozen.']);},
  stormform:function(){return actionDetail('Become living lightning.',[['Speed','×2 movement, attack and casting'],['Duration',lvTurns(fullDivineDuration(6))],['Cast','Instant']]);},
  umbral:function(){return actionDetail('Teleport to an explored tile and leave a melee shadow.',[['Hide',lvTurns(fullDivineDuration(2))],['Shadow','Your weapons and combat stats']],['Requires no adjacent enemies at the destination. The shadow follows between floors until destroyed or recast.']);}
};
var PRAYER_LIVE = {
  rampage:function(){var r=godRank(),d=lvDiv();return actionDetail('Fight faster and hit harder in melee.',[['Melee damage','+'+Math.round((.20+.04*r)*d*100)+'%'],['Attack speed','+'+Math.round((.10+.02*r)*d*100)+'% in melee'],['Duration',lvTurns(fullDivineDuration(10))],['Cast','Instant']]);},
  trollblood:function(){var rule=trollBloodRules();return actionDetail('Restore HP, cleanse harmful statuses and regenerate HP.',[['Healing',lvHealing(player.maxhp*rule.healingFraction)+' HP'],['Recovery','Up to '+lvRegeneration(player.maxhp*rule.regenFraction)+' HP per turn'],['Duration',lvTurns(rule.duration)]],['Regeneration stops while Rotted.']);},
  ironhide:function(){return actionDetail('',[['Armor','+'+Math.round(5*lvDiv())],['Shield',Math.round((5+2*godRank())*lvDiv())+' HP'],['Duration',lvTurns(fullDivineDuration(12))]]);},
  pummel:function(){return actionDetail('Strengthen your next successful unarmed hits.',[['Bonus damage','+'+Math.round(100*lvDiv())+'%'],['Hits',3],['Stun',lvStatusTurns('stun',1)]]);},
  consecrate:function(){return actionDetail('Cleanse yourself and strike nearby undead and shadow creatures.',[['Damage',Math.round(8*lvDiv())+' light'],['Area','3-tile radius'],['Cast','Instant']]);},
  sanctuary:function(){return actionDetail('Heal allies and damage enemies in the area.',[['Damage',Math.max(1,Math.round(sDMG(3+aff('light'))*lvDiv()))+' light per turn'],['Healing',lvHealing(player.maxhp*.02*lvDiv(),true)+' HP per turn'],['Area','3-tile radius'],['Fear',lvStatusTurns('fear',4)],['Duration',lvTurns(fullDivineDuration(10))]],['Double damage against undead and shadow creatures. Protects allies in the area.']);},
  rally:function(){return actionDetail('Heal and cleanse yourself and allies in sight.',[['Healing',lvHealing(player.maxhp*.25*lvDiv())+' HP to you'],['Ally healing',lvNumber(25*lvDiv())+'% max HP'],['Bonus damage','+10%'],['Duration',lvTurns(fullDivineDuration(10))]]);},
  laststand:function(){var rule=reginaldRules().lastStand;return actionDetail('Reduce incoming damage and regenerate HP.',[['Damage taken','−'+Math.round((1-rule.damageMultiplier)*100)+'%'],['Recovery','Up to '+lvRegeneration(player.maxhp*rule.regenFraction)+' HP per world turn'],['Duration',rule.duration+' world turns'],['Cast','Instant']],['Regeneration stops while Rotted.']);},
  luckystreak:function(){return actionDetail('Retry one failed combat roll per turn.',[['Duration',lvTurns(fullDivineDuration(8))],['Cast','Instant']],['Shared by attacks, defense, gear and elemental procs.']);},
  'the-brood':function(){return actionDetail('Summon spiderlings whose bites web or poison.',[['Summons','Up to 3 spiderlings'],['Duration',lvTurns(fullDivineDuration(SYLLA.broodLife))]],['Replaces your previous brood.']);},
  'venom-burst':function(){return actionDetail('Poison and blind nearby enemies.',[['Damage',lvDivineDamage(6)+' poison'],['Area','3-tile radius'],['Poison',lvStatusTurns('poison',3)],['Blind',lvStatusTurns('blind',3)]]);},
  bonespear:function(){return actionDetail('Pierce every enemy in a line.',[['Damage',lvDivineDamage(6)+' shadow'],['Range','6 tiles']],['Must leave at least 1 HP.']);},
  manaward:function(){var w=manaWardRules();return actionDetail('Absorbed damage restores Mana.',[['Shield',w.shield+' HP'],['Mana recovery',w.manaPerHP+' per HP absorbed'],['Duration',lvTurns(w.duration)]],['Refreshes the shield.']);},
  arcaneblink:function(){return actionDetail('Teleport to visible, empty walkable ground.',[['Range',lvTiles(arcaneBlinkRules().range)]]);},
  raisedead:function(){return actionDetail('Call an undead servant.',[['Summons','One servant'],['Duration','Until destroyed or you leave the floor']],['Cannot summon while your servant still stands or your Lich is returning.']);},
  fieldsmelt:function(){return actionDetail('Recycle one carried item for its full Essence value.',[['Cast','Instant']],['Requires being out of combat.']);},
  anviltoll:function(){return actionDetail('Strike all nearby enemies with your weapon.',[['Damage',lvWeaponDamage(lvDiv())],['Area','2-tile radius'],['Knockback','2 tiles'],['Stun',lvStatusTurns('stun',1)]],['Knockback and Stun require a damaging hit.']);},
  lance:function(){var rule=reginaldRules().lance;return actionDetail('Attack enemies in a beam with your main hand.',[['Damage',lvWeaponDamage(rule.multiplier*lvDiv())],['Range',lvTiles(rule.range)],['Width',lvTiles(rule.width)]]);},
  rolldice2:function(){return actionDetail('Tempt Wobbles for a greater reward - or a nastier prank.');}
};
function abilityKeyOf(A){if(typeof ABILITIES==='undefined')return null;for(var k in ABILITIES)if(ABILITIES[k]===A)return k;return null;}
function prayerKeyOf(P){if(typeof PRAYERS==='undefined')return null;for(var k in PRAYERS)if(PRAYERS[k]===P)return typeof prayerId==='function'?prayerId(k):k;return null;}
function actionCooldown(detail,key,base,unit){
  if(base===undefined)return;
  var turns=typeof cooldownTurns==='function'?cooldownTurns(base):base;
  var left=typeof cdLeft==='function'?cdLeft(key):0;
  function count(n){return unit?n+' '+unit+(n===1?'':'s'):lvTurns(n);}
  actionFact(detail,'Cooldown',turns?count(turns)+(left?' · ready in '+count(left):''):'None');
}
function abilityDetails(A,key){
  if(!A)return actionDetail('');
  key=key||abilityKeyOf(A);
  var live=typeof player!=='undefined'&&player,fn=key&&ABILITY_LIVE[key];
  var d=live&&fn?fn(A):actionDetail(A.desc||'');
  if(A.range)actionFact(d,'Range',lvTiles(live?lvRange(A):A.range));
  var cost=A.cost?(live&&typeof costOf==='function'?costOf(A):A.cost):0;
  actionFact(d,'Cost',A.favor?A.favor+' Favor':cost?cost+' Mana':'None');
  var cds=typeof DIVINE_COOLDOWNS!=='undefined'?DIVINE_COOLDOWNS.invokes:{};
  actionCooldown(d,key,A.cd!==undefined?A.cd:A.divine?cds[key]:undefined);
  if(A.instant)actionFact(d,'Cast','Instant');
  d.notes=[];
  return d;
}
function prayerDetails(P,key){
  if(!P)return actionDetail('');
  key=key||prayerKeyOf(P);if(typeof prayerId==='function')key=prayerId(key);
  var live=typeof player!=='undefined'&&player,fn=key&&PRAYER_LIVE[key];
  var d=live&&fn?fn(P):actionDetail(P.desc||'');
  if(live&&key==='anviltoll')lvRangedWeaponFact(d,lvDiv());
  var health=P.health?(typeof prayerHealthCost==='function'?prayerHealthCost(key):P.health):0;
  actionFact(d,'Cost',health?health+' HP':P.favor?P.favor+' Favor':P.essence?P.essence+' Essence':P.amusement?P.amusement+' Amusement':'None');
  var cds=typeof DIVINE_COOLDOWNS!=='undefined'?DIVINE_COOLDOWNS.prayers:{};
  actionCooldown(d,typeof prayerCdKey==='function'?prayerCdKey(key):'pray:'+key,cds[key],key==='laststand'||key==='lance'?'paid action':undefined);
  if(P.instant)actionFact(d,'Cast','Instant');
  actionFact(d,'Requires','Faith rank '+P.rank);
  d.notes=[];
  return d;
}
/* Sigil values use the same authored inputs as SIGIL_CASTS. Damage is shown
 * before the target's defenses, as it is for spells and weapon cards. */
function sigilStoneDetail(turns,shield){
  var d=actionDetail('Clear Poison and Stun, then gain Stone Skin.',[['Physical protection','3 damage per hit'],['Duration',lvTurns(fullDivineDuration(turns))]],['Immune to Poison, poison damage and Stun.']);
  if(shield)actionFact(d,'Shield',Math.round(player.maxhp*shield)+' HP');
  return d;
}
function sigilFloatDetail(turns){return actionDetail('Clear roots and webs, then float over obstacles.',[['Duration',lvTurns(fullDivineDuration(turns))]],['Cross chasms and water; ignore roots, webs, floor traps and ground hazards.']);}
var SIGIL_LIVE={
  firestorm:function(){return actionDetail('Burn enemies around you and ignite nearby ground.',[['Damage',(8+floorNo)+' fire'],['Area','3-tile radius'],['Burning',lvStatusTurns('burn',3)]]);},
  firestorm2:function(){return actionDetail('Burn nearby visible enemies and ignite nearby ground.',[['Damage',(14+floorNo)+' fire'],['Area','4-tile radius'],['Targets','Visible enemies'],['Burning',lvStatusTurns('burn',4)]]);},
  heal:function(){return actionDetail('Heal now and over time.',[['Healing',lvHealing(Math.round(player.maxhp*.35))+' HP'],['Recovery',lvHealing(Math.max(1,Math.round(player.maxhp*.05)))+' HP per turn'],['Duration',lvTurns(fullDivineDuration(15))]]);},
  heal2:function(){return actionDetail('Heal to full and cleanse harmful statuses.',[['Healing','Up to '+player.maxhp+' HP']]);},
  mana:function(){return actionDetail('',[['Mana restored',Math.round(player.maxmp*.5)],['Mana recovery','+'+Number((player.maxmp*.009).toFixed(2))+' per turn'],['Duration',lvTurns(fullDivineDuration(20))]]);},
  stoneskin:function(){return sigilStoneDetail(15);},
  stoneskin2:function(){return sigilStoneDetail(30,.2);},
  aegis:function(){return sigilStoneDetail(15,.5);},
  levitate:function(){return sigilFloatDetail(25);},
  levitate2:function(){var d=sigilFloatDetail(60);actionFact(d,'Speed','+30% movement, attack and casting for '+lvTurns(fullDivineDuration(10)));return d;},
  haste:function(){return actionDetail('Move, attack and cast faster.',[['Speed','+30%'],['Duration',lvTurns(fullDivineDuration(20))]]);},
  cinder:function(){return actionDetail('Move, attack and cast faster, leaving fire where you step.',[['Speed','+50%'],['Duration',lvTurns(fullDivineDuration(10))]]);},
  magma:function(){return actionDetail('Burn enemies and the ground around you.',[['Bonus damage','+5 fire on attacks and single-target spells'],['Area','2-tile radius'],['Burning','Nearby enemies · '+lvStatusTurns('burn',3)],['Ground fire','5 turns'],['Duration',lvTurns(fullDivineDuration(5))]]);},
  sunburst:function(){return actionDetail('Blind all visible enemies.',[['Damage',(6+floorNo)+' light'],['Targets','All visible enemies'],['Blind',lvStatusTurns('blind',3)]]);},
  storm:function(){return actionDetail('Strike before making all visible enemies Wet.',[['Damage',(10+floorNo)+' lightning; '+Math.round((10+floorNo)*1.5)+' against Wet targets'],['Targets','3 nearest visible enemies'],['Stun','50% chance · '+lvStatusTurns('stun',1)],['Wet','All visible enemies · 5 turns']]);},
  mire:function(){return actionDetail('Root and drench nearby enemies.',[['Area','3-tile radius'],['Root',lvStatusTurns('root',3)],['Wet','6 turns']]);},
  purify:function(){return actionDetail('Cleanse harmful statuses and curses on equipped gear.',[['Healing',lvHealing(Math.round(player.maxhp*.2))+' HP']]);},
  vanish:function(){return actionDetail('Hide and break pursuit.',[['Hide',lvTurns(fullDivineDuration(5))]]);},
  vanish2:function(){return SIGIL_LIVE.vanish();},
  identify:function(){return actionDetail('Identify carried sigils and one chosen piece of gear.',[['Extinguish','Fires within 3 tiles']]);},
  identify2:function(){return actionDetail('Identify all sigils and all carried or equipped gear.',[['Extinguish','Fires within 5 tiles']]);},
  smoke:function(){return actionDetail('Fill the room with smoke.',[['Sight','1 tile through smoke'],['Duration','12 turns']],['Enemies beyond 1 tile lose track of you and can be surprised.']);},
  rot:function(){return actionDetail('Permanently destroy one equipped item.',[['Requires','A known curse on that item']]);},
  recall:function(){return actionDetail('Teleport to this floor’s stairs or open gate.');},
  blink:function(){return actionDetail('Teleport to a random empty tile you can see.',[['Range','3–6 tiles']]);},
  mapping:function(){return actionDetail('Reveal this floor’s layout.');},
  ascension:function(){return actionDetail('Upgrade one piece of gear.',[['Upgrade','+1, up to +3']],['A cursed item is cleansed instead.']);},
  naturesbounty:function(){return actionDetail('Conjure a Honeycake, a Mushroom Skewer and a Moonberry Tart nearby.',[['Requires','3 empty tiles']]);},
  transmutation:function(){return actionDetail('Replace a carried or equipped item with another of the same type.',[],['Keeps quality, upgrades, enchantment and curse.']);},
  wisdom:function(){return actionDetail('Gain a level and keep your current XP progress.',[['Levels','+1, up to level 20']]);}
};
function sigilDetails(key){
  var S=SIGILS[key],live=typeof player!=='undefined'&&player,fn=SIGIL_LIVE[key];
  return live&&fn?fn():actionDetail(S&&S.desc||'');
}
/* Amulet powers use the same facts as abilities. Charge capacity, recharge and
 * item level remain with FoteGear and the equipment card. */
var AMULET_LIVE={
  hook:function(){return actionDetail('Pull an enemy to you, or yourself to an obstacle.',[['Stun',lvStatusTurns('stun',1,{bosses:false})]],['Cannot pull bosses. Crosses chasms and water.']);},
  swap:function(){return actionDetail('Trade places with a visible creature.',[],['Cannot move bosses.']);},
  tide:function(){return actionDetail('Flood ground and wash away hazards.',[['Area','3×3 tiles'],['Wet',lvStatusTurns('wet',6,{others:true})],['Duration','20 turns']],['Clears Burning and webs. Triggers every trap in the target room.']);},
  seeking:function(){return actionDetail('Reveal terrain, traps and hidden doors.',[['Area','16-tile radius']]);},
  pillar:function(){return actionDetail('Raise a pillar that blocks movement and sight.',[['Duration','15 turns'],['Requires','An empty tile']]);},
  stillness:function(){return actionDetail('Move without spending time.',[['Movement','3 steps']],['Any other action ends Stillness.']);},
  echo:function(){return actionDetail('Repeat your last sigil.',[],['Consumes no additional sigil.']);},
  thorns:function(){return actionDetail('Root yourself and reflect melee damage.',[['Shield','At least '+amuletThornsWard()+' HP'],['Reflection','50% melee damage'],['Root','5 turns'],['Duration','5 turns']],['Includes damage to your Ward, Mana Ward and Ice Armor.']);},
  plenty:function(){return actionDetail('Conjure a ration at your feet.');}
};
function amuletDetails(item){
  var A=item&&typeof AMULETS!=='undefined'&&AMULETS[item.amulet];if(!A)return actionDetail('This amulet has lost its power.');
  var live=typeof player!=='undefined'&&player;
  if(item.unid&&!(typeof RUN!=='undefined'&&RUN.amuletKnown&&RUN.amuletKnown[item.amulet]))return actionDetail('Unidentified amulet.');
  if(item.cursed&&!item.unid)return actionDetail('Cursed: triggers a random trap instead of its normal power.',[['Cost','1 charge']]);
  var fn=AMULET_LIVE[item.amulet],d=live&&fn?fn():actionDetail(A.desc||'');
  if(A.range)actionFact(d,'Range',lvTiles(A.range));
  actionFact(d,'Cost','1 charge');
  return d;
}
var ACTION_FACT_ORDER=['Damage','Melee damage','Ranged damage','Healing','Recovery','Ally healing','Mana restored','Mana recovery','Shield','Armor','Physical protection','Weapon damage','Bonus damage','Damage taken','Reflection','Attack speed','Speed','Summon HP','Summons','Shadow','Hits','Targets','Range','Movement','Attack range','Jump range','Area','Width','Walls','Knockback','Stun','Burning','Ground fire','Root','Fear','Blind','Poison','Chill','Freeze','Wet','Hide','Reveal','Sight','Extinguish','Favor','Reward chance','Duration','Cost','Cooldown','Cast','Requires'];
function actionFacts(detail,options){
  var omit=options&&options.omit||[];
  return detail.facts.filter(function(f){return omit.indexOf(f.label)<0&&!((f.label==='Cost'||f.label==='Cooldown')&&f.value==='None');}).slice().sort(function(a,b){
    var x=ACTION_FACT_ORDER.indexOf(a.label),y=ACTION_FACT_ORDER.indexOf(b.label);return (x<0?999:x)-(y<0?999:y);
  });
}
function actionEscape(text){return String(text).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
function actionDisplayText(text,label){
  var value=String(text).replace(/world turns?/g,function(s){return s==='world turn'?'turn':'turns';}).replace(/paid actions?|action turns?/g,'turns');
  return label==='Duration'||label==='Cooldown'?value.replace(/\s+turns?\b/g,''):value;
}
function actionDetailsHTML(detail,options){
  var facts=actionFacts(detail,options),h='<div class="action-details">';
  if(detail.summary)h+='<p class="action-summary">'+actionEscape(actionDisplayText(detail.summary))+'</p>';
  if(facts.length)h+='<dl class="action-facts">'+facts.map(function(f){return '<div><dt>'+actionEscape(f.label)+'</dt><dd>'+actionEscape(actionDisplayText(f.value,f.label))+'</dd></div>';}).join('')+'</dl>';
  return h+detail.notes.map(function(note){return '<p class="action-note">'+actionEscape(actionDisplayText(note))+'</p>';}).join('')+'</div>';
}
function actionDetailsText(detail,options){
  return [actionDisplayText(detail.summary||'')].concat(actionFacts(detail,options).map(function(f){return f.label+': '+actionDisplayText(f.value,f.label)+'.';}),detail.notes.map(function(note){return actionDisplayText(note);})).filter(Boolean).join(' ');
}
function liveDesc(A){return actionDetailsText(abilityDetails(A));}
function prayerLive(P){return actionDetailsText(prayerDetails(P));}
