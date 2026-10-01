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
function lvHealing(n,holyGround){
  n=rotHealing(n);
  if(hasGod('glimmer'))n*=1+.10*godRank();
  if(!holyGround&&inSanctuary(player))n*=1+.25*holyGroundStrength(player);
  return lvNumber(n);
}
function lvDamage(A){
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
    air:    function(n){ return 'Arc: hits have a '+(5*n)+'% chance to arc to a nearby enemy for half damage. Immune to Stun.'; },
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
var ABILITY_LIVE = {
  shadowswarm: function(A){var stats=shadowSwarmStats(A);return 'Summon up to 9 Shades in a 3x3 area for '+stats.duration+' turns: '+stats.hp+' HP and '+stats.damage+' shadow damage each. Replaces your previous swarm.';},
  missile:     function(A){return 'Deal '+lvDamage(A)+' magic damage. Always hits and ignores resistance.';},
  sap:         function(A){return 'Deal '+lvDamage(A)+' physical damage. Stun for 3 turns (6 if unaware). The waking hit is a surprise critical; the target then resists further Saps.';},
  firebolt:    function(A){return 'Deal '+lvDamage(A)+' fire damage and inflict Burning for 3 turns. Ignites grass; destroys thorns.';},
  frostshard:  function(A){return 'Deal '+lvDamage(A)+' frost damage and apply Chill. Freeze at '+(ePts('water')>=6?3:4)+' stacks.';},
  root:        function(A){return 'Deal '+lvDamage(A)+' physical damage and Root for 2 turns.';},
  shadowbolt:  function(A){return 'Deal '+lvDamage(A)+' shadow damage and inflict Fear for 2 turns.';},
  spark:       function(A){return 'Deal '+lvDamage(A)+' lightning damage; '+(5*ePts('air'))+'% chance to Stun for 1 turn. +50% damage to Wet targets.';},
  smite:       function(A){return 'Deal '+lvDamage(A)+' light damage; '+(10*ePts('light'))+'% chance to Blind for 2 turns. +50% damage to undead and shadow creatures.';},
  fireball:    function(A){return 'Deal '+lvDamage(A)+' fire damage and inflict Burning for 3 turns in a 5x5 area.';},
  frostcone:   function(A){return 'Deal '+lvDamage(A)+' frost damage in a '+spellRange(A)+'-tile cone. Apply Chill and knock enemies back 1 tile.';},
  chainbolt:   function(A){return 'Deal '+lvDamage(A)+' lightning damage. Jumps to 4 more enemies within 3 tiles, losing 25% damage each jump.';},
  earthquake:  function(A){return 'Deal '+lvDamage(A)+' physical damage within 5 tiles. Hits your summons; does not hit you.';},
  radiantbeam: function(A){return 'Deal '+lvDamage(A)+' light damage in a 3-tile-wide beam. +50% damage to undead and shadow creatures; '+(5*ePts('light'))+'% chance to Blind for 2 turns.';},
  ironbody:    function(){return '+'+Math.round(4*lvDiv())+' armor and +'+Math.round(30*lvDiv())+'% chance for unarmed hits to Stun for 1 turn. Lasts '+fullDivineDuration(12)+' turns. Instant.';},
  bellow:      function(){return 'Stun enemies within 3 tiles for 1 turn and heal '+lvHealing(Math.round(player.maxhp*(.10+.02*godRank())*lvDiv()))+' HP.';},
  temper:      function(){return '+'+Math.round(2*lvDiv())+' weapon damage and +'+Math.round(4*lvDiv())+' armor for '+fullDivineDuration(12)+' turns. Instant.';},
  unholyaura:  function(){return 'For '+fullDivineDuration(8)+' turns, deal '+Math.round(4*godRank()*lvDiv())+' shadow damage per turn to enemies within 2 tiles. Heal '+lvHealing(1)+' HP per enemy hit.';},
  intothedark: function(){return 'Hide for '+fullDivineDuration(SYLLA.darkTurns)+' turns and break pursuit. Your next hit from hiding deals +'+Math.round(SYLLA.darkPerRank*godRank()*lvDiv()*100)+'% damage.';},
  heal:        function(){var r=godRank(),bonus=(1+.10*r)*(inSanctuary(player)?1+.25*holyGroundStrength(player):1),raw=Math.round(player.maxhp*(.10+.02*r)*lvDiv());return 'Restore up to '+lvHealing(Math.min(raw,player.maxhp*.4/bonus))+' HP.';},
  dawn:        function(A){return 'Deal '+Math.round(sDMG(A.base[0])*spellPower(A))+'-'+Math.round(sDMG(A.base[1])*spellPower(A))+' light damage and Blind visible enemies for 3 turns. Reveal all enemies for 20 turns.';},
  glacialtomb: function(A){return 'Imprison an enemy, unable to act or take damage: 10 turns (elites 6, bosses 2). Deal '+spellBaseDamage(A,A.base[0])+'-'+spellBaseDamage(A,A.base[1])+' frost damage to adjacent enemies. Self-cast: 3 turns, then restore 25% max HP and mana.';},
  upheaval: function(A){return 'Create up to 7 walls in a line for 20 turns. Deal '+spellBaseDamage(A,A.base[0])+'-'+spellBaseDamage(A,A.base[1])+' physical damage and Root creatures within 2 tiles for 2 turns. Hits your summons; does not hit you.';},
  arcaneward:  function(){return 'Gain a '+Math.round((8+2*godRank())*divineStrength())+' HP shield and Communion for '+fullDivineDuration(8)+' turns. Damaging actions earn '+Number((godRank()*divineStrength()).toFixed(2))+' Favor each.';},
  livingflame: function(A){var sp=spellPower(A);return 'Summon a Living Flame for 30 turns: '+Math.round(28*sp)+' HP, '+Math.round(5*sp)+'-'+Math.round(9*sp)+' fire damage, range 6. Damages adjacent enemies on arrival. Every third shot splashes for half damage. Uses one of 2 summon slots.';}
};
var PRAYER_LIVE = {
  rampage:function(){var r=godRank(),d=lvDiv();return '+'+Math.round((.20+.04*r)*d*100)+'% melee damage and +'+Math.round((.10+.02*r)*d*100)+'% melee attack speed for '+fullDivineDuration(10)+' turns. Instant.';},
  trollblood:function(){return 'Heal '+lvHealing(player.maxhp*(.20+.05*godRank())*lvDiv())+' HP and cleanse harmful statuses.';},
  ironhide:function(){return '+'+Math.round(5*lvDiv())+' armor and a '+Math.round((5+2*godRank())*lvDiv())+' HP shield for '+fullDivineDuration(12)+' turns. Instant.';},
  pummel:function(){return 'Your next 3 unarmed hits deal +'+Math.round(100*lvDiv())+'% damage and Stun for 1 turn. Instant.';},
  consecrate:function(){return 'Cleanse yourself and deal '+Math.round(8*lvDiv())+' light damage to every undead and shadow creature within 3 tiles. Instant.';},
  sanctuary:function(){return 'Bless the ground within 3 tiles for '+fullDivineDuration(10)+' turns; Fear enemies there for 4 turns. Each turn, heal '+lvHealing(player.maxhp*.02*lvDiv(),true)+' HP and deal '+Math.max(1,Math.round(sDMG(3+aff('light'))*lvDiv()))+' light damage to enemies (double against undead and shadow). Protects and heals allies on the ground.';},
  rally:function(){return 'Heal '+lvHealing(player.maxhp*.25*lvDiv())+' HP. You and allies in sight cleanse harmful statuses and gain +10% damage for '+fullDivineDuration(10)+' turns. Allies heal '+lvNumber(25*lvDiv())+'% max HP.';},
  laststand:function(){return 'Use at half HP or less: take 50% less damage for '+fullDivineDuration(10)+' turns. Instant.';},
  luckystreak:function(){return 'For '+fullDivineDuration(8)+' turns, reroll a failed hit, crit, evasion, block, parry or enchantment roll once per turn. Instant.';},
  'the-brood':function(){return 'Summon up to 3 spiderlings for '+fullDivineDuration(SYLLA.broodLife)+' turns. Their bites web or poison. Replaces your previous brood.';},
  'venom-burst':function(){return 'Deal '+lvDivineDamage(6)+' poison damage to enemies within 3 tiles, then Poison and Blind for 3 turns.';},
  bonespear:function(){return 'Deal '+lvDivineDamage(6)+' shadow damage to every enemy in a line up to 6 tiles long. Costs '+prayerHealthCost('bonespear')+' HP; must leave at least 1 HP. No cooldown.';},
  arcanelance:function(){return 'Deal '+lvDivineDamage(6)+' magic damage to one enemy within 6 tiles. Costs 5 Favor. No cooldown.';},
  arcanenova:function(){return 'Deal '+lvDivineDamage(8)+' magic damage in a 3x3 area within 6 tiles.';}
};
function abilityKeyOf(A){ if(typeof ABILITIES==='undefined') return null; for(var k in ABILITIES) if(ABILITIES[k]===A) return k; return null; }
function liveDesc(A){
  if(!A) return '';
  var k=abilityKeyOf(A), f=k && ABILITY_LIVE[k],text=A.desc||'';
  if(typeof player!=='undefined' && player){
    if(f){try{text=f(A);}catch(x){}}
    if(A.range&&A.kind!=='cone')text+=' Range: '+spellRange(A)+' tiles.';
  }
  return text;
}
function prayerLive(P){
  if(!P) return '';
  var k=null; if(typeof PRAYERS!=='undefined') for(var q in PRAYERS) if(PRAYERS[q]===P) k=q;
  var f=k && PRAYER_LIVE[prayerId(k)];
  if(f && typeof player!=='undefined' && player){ try { return f(P); } catch(x){} }
  return P.desc || '';
}
