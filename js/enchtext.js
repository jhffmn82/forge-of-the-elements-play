/* =====================================================================
   enchtext.js - what an enchantment is doing for you right now (2026-09-17).
   ENCHANT_TEXT describes an enchantment in the abstract ("5% chance per Shadow point"), which is the right
   thing to read at the Forge, where you are choosing what to put into a piece of gear. On the item itself it
   is the wrong question: there you want the number you actually have. enchantLive() computes the live values
   from your affinity (and Old Anvil's rank, which enchantScale folds in), and the item cards use it.
   The Forge keeps the per-point wording.
   ===================================================================== */

function ePts(el){ return (player && player.aff && player.aff[el]) || 0; }
function eSc(el){ return typeof enchantScale==='function' ? enchantScale(el) : 1; }
function ePct(v){ return Math.round(v*100) + '%'; }

var ENCH_LIVE = {
  holy: {
    fire:function(){return '+'+ePct(.08*eSc('fire'))+' damage while buffed';},
    water:function(){return '+'+ePct(.15*eSc('water'))+' mana regeneration while buffed';},
    air:function(){return ePct(.05*eSc('air'))+' less action time while buffed';},
    earth:function(){return ePct(Math.min(.5,.05*eSc('earth')))+' less damage taken while buffed';},
    light:function(){return 'Gaining a buff heals '+ePct(.03*eSc('light'))+' of maximum HP';},
    shadow:function(){return '+'+ePct(.03*eSc('shadow'))+' crit chance while buffed';}
  },
  weapon: {
    fire:  function(){ var p=ePts('fire'); return '+'+ePct((0.10+0.03*p)*enchantGodBonus())+' of each hit as fire' + (p ? ', '+ePct(0.05*p*enchantGodBonus())+' chance to set Burning' : ''); },
    water: function(){ return ePct((0.15+0.05*ePts('water'))*enchantGodBonus())+' chance to Chill'; },
    air:   function(){ return ePct(Math.max(0.05, 0.05*ePts('air'))*enchantGodBonus())+' chance of an instant extra attack, or a spell landing twice'; },
    earth: function(){ return ePct(0.15*eSc('earth'))+' chance to Root for 2 turns'; },
    light: function(){ return '+'+Math.round(10*eSc('light'))+' accuracy, +'+ePct(.25*enchantGodBonus())+' damage to undead and shadow'; },
    shadow:function(){ return ePct(Math.max(0.05, 0.05*ePts('shadow'))*enchantGodBonus())+' chance of +'+ePct(.25*enchantGodBonus())+' dark damage and Corrupt; +1 damage to Hollowed'; }
  },
  armor: {fire:function(){return '+'+ePct((.10+.05*ePts('fire'))*enchantGodBonus())+' fire resistance; '+('+'+ePct((.05+.03*ePts('fire'))*enchantGodBonus())+' maximum HP');},
water:function(){return '+'+ePct((.10+.05*ePts('water'))*enchantGodBonus())+' ice resistance; '+('+'+Math.round(8*eSc('water'))+' evasion');},
air:function(){return '+'+ePct((.10+.05*ePts('air'))*enchantGodBonus())+' Lightning resistance; '+(ePct((.05+.03*ePts('air'))*enchantGodBonus())+' ranged projectile deflection');},
earth:function(){return '+'+ePct((.10+.05*ePts('earth'))*enchantGodBonus())+' poison resistance; '+('+'+Math.round(eSc('earth'))+' armor');},
light:function(){return '+'+ePct((.10+.05*ePts('light'))*enchantGodBonus())+' light resistance; '+('+'+ePct(.5*eSc('light'))+' HP regeneration');},
shadow:function(){return '+'+ePct((.10+.05*ePts('shadow'))*enchantGodBonus())+' shadow resistance; '+('+'+ePct(.05*Math.max(1,ePts('shadow'))*enchantGodBonus())+' stealth');}},
  orb: {
 fire:function(){return 'Critical hits ignite the target tile and inflict Burning for 2 turns ('+burnDmg()+' damage per turn).';},
 water:function(){return 'Critical hits restore '+Math.round((1+ePts('water'))*enchantGodBonus())+' Ice Armor, up to capacity.';},
 air:function(){return 'Critical hits stun for 1 turn.';},
 earth:function(){return '+'+ePct((.05+.03*ePts('earth'))*enchantGodBonus())+' crit chance against Rooted targets.';},
 light:function(){return 'Critical hits restore '+Math.round(3*eSc('light'))+' mana.';},
 shadow:function(){return '+'+ePct((.10+.05*ePts('shadow'))*enchantGodBonus())+' crit damage multiplier.';}
},
  tome: {
 fire:function(){return '+'+ePct((.05+.03*ePts('fire'))*enchantGodBonus())+' spell power';},
 water:function(){return '+'+Math.round((2+ePts('water'))*enchantGodBonus())+' evasion';},
 air:function(){return ePct((.02+.01*ePts('air'))*enchantGodBonus())+' less casting time';},
 earth:function(){return '+'+ePct((.02+.01*ePts('earth'))*enchantGodBonus())+' all elemental resistances';},
 light:function(){return ePct((.10+.05*ePts('light'))*enchantGodBonus())+' of mana spent becomes a shield (up to '+Math.round(player.maxhp*.3)+' HP)';},
 shadow:function(){return 'Spell kills heal '+ePct(.01*Math.max(1,ePts('shadow'))*enchantGodBonus())+' of maximum HP';}
}
};

/* slot is 'weapon', 'armor', 'orb' or 'tome'; falls back to the Forge wording for anything unknown */
function enchantLive(slot, el){
  var f = ENCH_LIVE[slot] && ENCH_LIVE[slot][el];
  if(f) { try { return f(); } catch(e){} }
  return (typeof ENCHANT_TEXT!=='undefined' && ENCHANT_TEXT[slot] && ENCHANT_TEXT[slot][el]) || '';
}

/* ---------------------------------------------------------------- the item cards read the live numbers */
(function(){
  if(typeof ENCHANT_TEXT==='undefined') return;
  /* ui.js builds the weapon and armor cards straight out of ENCHANT_TEXT, so hand those two lookups a proxy
     that answers with live values instead. The Forge reads ENCHANT_TEXT.weapon / .armor directly and is
     untouched, because it asks for the tables by name before an item exists. */
  var liveProxy = function(slot){
    var out = {};
    ELEMENTS.forEach(function(el){
      Object.defineProperty(out, el, { get: function(){ return enchantLive(slot, el); }, enumerable: true });
    });
    return out;
  };
  if(typeof itemCardHTML==='function'){ /* nothing: hook below covers it */ }
  ENCHANT_TEXT.weaponLive = liveProxy('weapon');
  ENCHANT_TEXT.armorLive  = liveProxy('armor');
  ENCHANT_TEXT.orbLive    = liveProxy('orb');
  ENCHANT_TEXT.tomeLive   = liveProxy('tome');
})();

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
