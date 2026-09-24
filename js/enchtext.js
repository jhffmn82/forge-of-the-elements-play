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
    fire:   function(n){ return 'Searing: +'+(5*n)+'% damage (5% per Fire rank) against Burning enemies. Immune to Burning.'; },
    water:  function(n){ return 'Deep Chill: Chill slows movement and actions by '+Math.round(Math.min(50, 33+3*n))+'% (33% plus 3 points per Water rank, maximum 50%). Immune to Chill and Freeze.'; },
    air:    function(n){ return 'Arc: '+(5*n)+'% chance (5% per Air point) that any hit or spell arcs to a nearby enemy for 50%. Immune to Stun.'; },
    earth:  function(n){ var t=Math.min(3, Math.max(1, n-2)); return 'Venom: Earth Root applies Poison for '+t+' turn'+(t===1?'':'s')+' (1 / 2 / 3 at Earth ranks 3 / 4 / 5+): 10% max HP per turn, or 5% to bosses. Immune to Root.'; },
    light:  function(n){ return 'Radiance: heal '+n+' HP (1 per Light point) whenever you deal light damage. Immune to Blind.'; },
    shadow: function(n){ return 'Fade: become Hidden after '+Math.max(4, 16-2*n)+' consecutive unseen turns (10 / 8 / 6 / 4 at Shadow ranks 3-6). Immune to Fear.'; }
  }
};
function rankLive(r, e){
  var n=ePts(e), f=RANK_LIVE[r] && RANK_LIVE[r][e];
  if(f && n>=r){ try { return f(n); } catch(x){} }
  return (typeof RANK_TEXT!=='undefined' && RANK_TEXT[r] && RANK_TEXT[r][e]) || '';
}
var ABILITY_LIVE = {
  shadowswarm: function(A){var stats=shadowSwarmStats(A);return 'Summon up to nine Shades in a 3×3 area: '+stats.hp+' HP, '+stats.damage+' base Dark damage and '+stats.duration+' world turns each (base 10 HP, 10 damage and 5 turns, multiplied by Spell Power at casting). Benefits from Murk’s Grave Strength. Replaces your previous swarm.';},
  missile:     function(A){ var t=typeof totalAffinity==='function' ? totalAffinity() : 0; return 'Always hits; magic damage nothing resists. +'+t+' base damage (1 per affinity point).'; },
  spark:       function(A){ return 'Lightning damage with a '+(5*ePts('air'))+'% chance (5% per Air point) to stun. +50% against targets standing in water.'; },
  smite:       function(A){ return 'Light damage with a '+(10*ePts('light'))+'% chance (10% per Light point) to Blind. +50% against undead and shadow creatures.'; },
  radiantbeam: function(A){ return 'A beam 3 tiles wide along a row, column or diagonal: light damage (+50% to undead and shadow), '+(5*ePts('light'))+'% Blind (5% per Light point).'; },
  heal:        function(){var r=godRank(),bonus=inSanctuary(player)?1+.25*divineStrength():1;return 'Restore up to '+Math.min(Math.round(player.maxhp*.4),Math.round(player.maxhp*(.10+.02*r)*divineStrength()*(1+.10*r)*bonus))+' HP.';},
  arcaneward:  function(){return '8 mana: shield '+Math.round((8+2*godRank())*divineStrength())+' HP and Communion for '+fullDivineDuration(8)+' turns. Damaging attacks earn '+(godRank()*divineStrength()).toFixed(2)+' Favor once per action; the buff survives the shield breaking.';},
  livingflame: function(A){var sp=spellPower(A);return '100 mana: summon a Living Flame for 30 world turns. '+Math.round(28*sp)+' HP, '+Math.round(5*sp)+'–'+Math.round(9*sp)+' Fire damage. Every third ranged attack splashes nearby enemies for half damage. Shared two-summon limit.';}
};
var PRAYER_LIVE = {
  ironhide: function(){return '+'+Math.round(5*divineStrength())+' armor and '+Math.round((5+2*godRank())*divineStrength())+' shield HP for '+fullDivineDuration(12)+' turns. Refreshes without stacking.';}
,
bonespear:function(){return 'Piercing Dark damage '+Math.round(5*godRank()*divineStrength())+'–'+Math.round((5*godRank()+6)*divineStrength())+', range 6. Costs 5 Favor.';},
arcanelance:function(){return 'Magic damage '+Math.round(5*godRank()*divineStrength())+'–'+Math.round((5*godRank()+6)*divineStrength())+', range 6. Costs 5 Favor; no cooldown.';}};
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
