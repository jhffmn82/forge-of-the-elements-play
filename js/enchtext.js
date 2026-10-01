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

/* Live descriptions show current values. Forge/fallback text keeps the scaling
 * rules without repeating those formulas in every equipped ability tooltip. */
function lvRank(){ return typeof godRank==='function' ? godRank() : 0; }
function lvDiv(){ return (typeof divineStrength==='function' ? divineStrength() : 1); }
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
  missile:     function(A){ var t=typeof totalAffinity==='function' ? totalAffinity() : 0; return 'Always hits and ignores resistance. +'+t+' magic damage from affinity.'; },
  spark:       function(A){ return 'Deal lightning damage; '+(5*ePts('air'))+'% Stun chance. +50% damage to Wet targets or targets in water.'; },
  smite:       function(A){ return 'Deal light damage; '+(10*ePts('light'))+'% Blind chance. +50% damage to undead and shadow creatures.'; },
  radiantbeam: function(A){ return 'Light damage in a 3-tile-wide row, column or diagonal. +50% damage to undead and shadow creatures; '+(5*ePts('light'))+'% Blind chance.'; },
  heal:        function(){var r=godRank(),bonus=inSanctuary(player)?1+.25*holyGroundStrength(player):1;return 'Restore up to '+Math.min(Math.round(player.maxhp*.4),Math.round(player.maxhp*(.10+.02*r)*divineStrength()*(1+.10*r)*bonus))+' HP.';},
  dawn:        function(A){return 'Deal '+Math.round(sDMG(A.base[0])*spellPower(A))+'-'+Math.round(sDMG(A.base[1])*spellPower(A))+' light damage and Blind visible enemies for 3 turns. Reveal all enemies for 20 turns.';},
  glacialtomb: function(A){return 'Imprison an enemy, unable to act or take damage: 10 turns (elites 6, bosses 2). Deal '+spellBaseDamage(A,A.base[0])+'-'+spellBaseDamage(A,A.base[1])+' frost damage to adjacent enemies. Self-cast: 3 turns, then restore 25% max HP and mana.';},
  upheaval: function(A){return 'Create up to 7 walls in a line for 20 turns. Deal '+spellBaseDamage(A,A.base[0])+'-'+spellBaseDamage(A,A.base[1])+' physical damage and Root creatures within 2 tiles for 2 turns. Hits your summons; does not hit you.';},
  arcaneward:  function(){return 'Gain a '+Math.round((8+2*godRank())*divineStrength())+' HP shield and Communion for '+fullDivineDuration(8)+' turns. Damaging actions earn '+Number((godRank()*divineStrength()).toFixed(2))+' Favor each.';},
  livingflame: function(A){var sp=spellPower(A);return 'Summon a Living Flame for 30 turns: '+Math.round(28*sp)+' HP, '+Math.round(5*sp)+'-'+Math.round(9*sp)+' fire damage, range 6. Damages adjacent enemies on arrival. Every third shot splashes for half damage. Uses one of 2 summon slots.';}
};
var PRAYER_LIVE = {
  rampage: function(){var r=godRank(),d=divineStrength();return '+'+Math.round((.20+.04*r)*d*100)+'% melee damage and +'+Math.round((.10+.02*r)*d*100)+'% melee attack speed for 10 turns. Instant.';},
  trollblood: function(){var r=godRank();return 'Heal '+Math.round(player.maxhp*(.20+.05*r)*divineStrength())+' HP and cleanse harmful statuses.';},
  ironhide: function(){return '+'+Math.round(5*divineStrength())+' armor and a '+Math.round((5+2*godRank())*divineStrength())+' HP shield for '+fullDivineDuration(12)+' turns. Instant.';}
,
bonespear:function(){return 'Deal '+Math.round(5*godRank()*divineStrength())+'-'+Math.round((5*godRank()+6)*divineStrength())+' shadow damage to every enemy in a line up to 6 tiles long. Costs '+prayerHealthCost('bonespear')+' HP; must leave at least 1 HP. No cooldown.';},
arcanelance:function(){return 'Deal '+Math.round(5*godRank()*divineStrength())+'-'+Math.round((5*godRank()+6)*divineStrength())+' magic damage to one enemy within 6 tiles. Costs 5 Favor. No cooldown.';}};
function abilityKeyOf(A){ if(typeof ABILITIES==='undefined') return null; for(var k in ABILITIES) if(ABILITIES[k]===A) return k; return null; }
function liveDesc(A){
  if(!A) return '';
  var k=abilityKeyOf(A), f=k && ABILITY_LIVE[k];
  if(f && typeof player!=='undefined' && player){ try { return f(A); } catch(x){} }
  return A.desc || '';
}
function prayerLive(P){
  if(!P) return '';
  var k=null; if(typeof PRAYERS!=='undefined') for(var q in PRAYERS) if(PRAYERS[q]===P) k=q;
  var f=k && PRAYER_LIVE[prayerId(k)];
  if(f && typeof player!=='undefined' && player){ try { return f(P); } catch(x){} }
  return P.desc || '';
}
