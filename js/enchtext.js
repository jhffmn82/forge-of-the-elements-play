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

/* ---------------------------------------------------------------- 2026-09-23 (Justin): "do that for every ability and
   infusion description in the game". Every description that states a rate shows the number you have right now, with
   the rate in brackets, wherever it is displayed (sheet, hotbar titles, the Forge's messages). The tables keep the
   per-point wording as the fallback. */
function lvRank(){ return typeof godRank==='function' ? godRank() : 0; }
function lvDiv(){ return (typeof divineStrength==='function' ? divineStrength() : 1); }
var RANK_LIVE = {
  3: {
    fire:   function(n){ return 'Searing: +'+(5*n)+'% damage (5% per Fire point) against Burning enemies. Immune to Burning.'; },
    water:  function(n){ return 'Deep Chill: enemies you Chill are slowed by '+Math.round(Math.min(50, 33+3*n))+'% (33% plus 3% per Water point, up to 50%). Immune to Chill and Freeze.'; },
    air:    function(n){ return 'Arc: a '+(5*n)+'% chance (5% per Air point) that any hit or spell arcs to a nearby enemy for half damage. Immune to Stun.'; },
    earth:  function(n){ var t=Math.min(3, Math.max(1, n-2)); return 'Venom: anything you Root is also Poisoned for '+t+' turn'+(t===1?'':'s')+' (up to 3 at Earth 5). Poison takes 10% of max HP a turn, 5% for bosses. Immune to Root.'; },
    light:  function(n){ return 'Radiance: heal '+n+' HP (1 per Light point) whenever you deal light damage. Immune to Blind.'; },
    shadow: function(n){ return 'Fade: after '+Math.max(4, 16-2*n)+' quiet turns out of combat you become Hidden (2 fewer per Shadow point, down to 4). Immune to Fear.'; }
  }
};
function rankLive(r, e){
  var n=ePts(e), f=RANK_LIVE[r] && RANK_LIVE[r][e];
  if(f && n>=r){ try { return f(n); } catch(x){} }
  return (typeof RANK_TEXT!=='undefined' && RANK_TEXT[r] && RANK_TEXT[r][e]) || '';
}
var ABILITY_LIVE = {
  shadowswarm: function(A){var stats=shadowSwarmStats(A);return 'Summon up to nine Shades in a 3x3 area for '+stats.duration+' turns. Each has '+stats.hp+' HP and hits for '+stats.damage+' shadow damage. A new swarm replaces the old one.';},
  missile:     function(A){ var t=typeof totalAffinity==='function' ? totalAffinity() : 0; return 'Always hits, and nothing resists its magic damage. +'+t+' damage (1 per affinity point).'; },
  spark:       function(A){ return 'Lightning damage with a '+(5*ePts('air'))+'% chance (5% per Air point) to Stun. +50% against targets that are Wet or standing in water.'; },
  smite:       function(A){ return 'Light damage with a '+(10*ePts('light'))+'% chance (10% per Light point) to Blind. +50% against undead and shadow creatures.'; },
  radiantbeam: function(A){ return 'A beam 3 tiles wide along a row, column or diagonal: light damage (+50% to undead and shadow), '+(5*ePts('light'))+'% Blind (5% per Light point).'; },
  heal:        function(){var r=godRank(),bonus=inSanctuary(player)?1+.25*holyGroundStrength(player):1;return 'Restore up to '+Math.min(Math.round(player.maxhp*.4),Math.round(player.maxhp*(.10+.02*r)*divineStrength()*(1+.10*r)*bonus))+' HP.';},
  dawn:        function(A){return 'Strike every enemy in sight for '+Math.round(sDMG(A.base[0])*spellPower(A))+'-'+Math.round(sDMG(A.base[1])*spellPower(A))+' light damage and Blind the survivors for 3 turns. For 20 turns, every enemy on the floor is revealed.';},
  glacialtomb: function(A){return 'Seal an enemy in ice for 10 turns (6 for elites, 2 for bosses); it can neither act nor be hurt. Enemies beside it take '+spellBaseDamage(A,A.base[0])+'-'+spellBaseDamage(A,A.base[1])+' frost damage. On yourself: 3 safe turns, then 25% of max HP and mana back.';},
  upheaval: function(A){return 'Raise a line of stone walls up to 7 tiles long for 20 turns. Enemies and your summons within 2 tiles of a wall take '+spellBaseDamage(A,A.base[0])+'-'+spellBaseDamage(A,A.base[1])+' physical damage and are Rooted for 2 turns. You are spared.';},
  arcaneward:  function(){return 'Gain a shield of '+Math.round((8+2*godRank())*divineStrength())+' HP and Communion for '+fullDivineDuration(8)+' turns: each action that deals damage earns '+(godRank()*divineStrength()).toFixed(2)+' Favor.';},
  livingflame: function(A){var sp=spellPower(A);return 'Call a Living Flame onto an empty tile for 30 turns: '+Math.round(28*sp)+' HP, hurling '+Math.round(5*sp)+'-'+Math.round(9*sp)+' fire damage at range 6. Every third shot splashes nearby enemies for half. Counts toward your two summons.';}
};
var PRAYER_LIVE = {
  rampage: function(){var r=godRank(),d=divineStrength();return '+'+Math.round((.20+.04*r)*d*100)+'% melee damage and +'+Math.round((.10+.02*r)*d*100)+'% melee attack speed for 10 turns (20% and 10%, plus 4% and 2% per rank; grows with Divine Power). Takes no turn.';},
  trollblood: function(){var r=godRank();return 'Heal '+Math.round(player.maxhp*(.20+.05*r)*divineStrength())+' HP (20% of max HP plus 5% per rank; grows with Divine Power) and cleanse yourself.';},
  ironhide: function(){return '+'+Math.round(5*divineStrength())+' armor and a shield of '+Math.round((5+2*godRank())*divineStrength())+' HP for '+fullDivineDuration(12)+' turns. Takes no turn.';}
,
bonespear:function(){return 'Deal '+Math.round(5*godRank()*divineStrength())+'-'+Math.round((5*godRank()+6)*divineStrength())+' shadow damage to every enemy in a line up to 6 tiles long.';},
arcanelance:function(){return 'Deal '+Math.round(5*godRank()*divineStrength())+'-'+Math.round((5*godRank()+6)*divineStrength())+' magic damage to one enemy within 6 tiles.';}};
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
