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
  weapon: {
    fire:  function(){ var p=ePts('fire'); return '+'+ePct(0.10+0.03*p)+' of each hit as fire' + (p ? ', '+ePct(0.05*p)+' chance to set Burning' : ''); },
    water: function(){ return ePct(0.15+0.05*ePts('water'))+' chance to Chill'; },
    air:   function(){ return ePct(Math.max(0.05, 0.05*ePts('air')))+' chance of an instant extra attack, or a spell landing twice'; },
    earth: function(){ return ePct(0.15*eSc('earth'))+' chance to Root for 2 turns'; },
    light: function(){ return '+'+Math.round(10*eSc('light'))+' accuracy, +25% damage to undead and shadow'; },
    shadow:function(){ return ePct(Math.max(0.05, 0.05*ePts('shadow')))+' chance of +25% dark damage and Corrupt; +1 damage to Hollowed'; }
  },
  armor: {
    fire:  function(){ return '+'+ePct(0.10*eSc('fire'))+' fire resistance'; },
    water: function(){ return '+'+Math.round(8*eSc('water'))+' evasion'; },
    air:   function(){ return '+'+ePct(0.10*eSc('air'))+' lightning resistance'; },
    earth: function(){ return '+'+Math.round(2*eSc('earth'))+' armor'; },
    light: function(){ return '+'+ePct(0.5*eSc('light'))+' HP regeneration'; },
    shadow:function(){ return '+'+ePct(Math.max(0.05, 0.05*ePts('shadow')))+' stealth'; }
  },
  orb: {
    fire:  function(){ return 'spell crits set the target’s tile alight, Burning for 2 turns'; },
    water: function(){ return 'up to +'+ePct(0.15*eSc('water'))+' spell damage, the fuller your mana'; },
    air:   function(){ var p=ePts('air'); return '+'+(1 + (p>=3?1:0) + (p>=5?1:0))+' spell range'; },
    earth: function(){ return '+'+ePct(0.10+0.03*ePts('earth'))+' spell damage when you did not move last turn'; },
    light: function(){ return 'spell crits restore '+Math.round(3*eSc('light'))+' mana'; },
    shadow:function(){ return '+'+ePct(0.10+0.03*ePts('shadow'))+' spell damage to targets below half HP'; }
  },
  tome: {
    fire:  function(){ return 'spells cost 5% less per Burning enemy in view, up to '+ePct(0.25+0.05*ePts('fire')); },
    water: function(){ return '+'+ePct(0.30*eSc('water'))+' mana regeneration'; },
    air:   function(){ return ePct(Math.max(0.05, 0.05*ePts('air')))+' chance a spell costs no mana'; },
    earth: function(){ return '+'+ePct(0.10*eSc('earth'))+' max mana'; },
    light: function(){ return ePct(0.10+0.05*ePts('light'))+' of the mana you spend becomes a shield'; },
    shadow:function(){ return 'spell kills heal '+ePct(0.01*Math.max(1, ePts('shadow')))+' of max HP'; }
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
function lvDiv(){ return (typeof divineStrength==='function' ? divineStrength() : 1) + 0.03*Math.max(0, ((player && player.stats && player.stats.foc)||10)-10); }
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
  missile:     function(A){ var t=typeof totalAffinity==='function' ? totalAffinity() : 0; return 'Always hits; magic damage nothing resists. +'+t+' base damage (1 per affinity point).'; },
  spark:       function(A){ return 'Lightning damage with a '+(5*ePts('air'))+'% chance (5% per Air point) to stun. +50% against targets standing in water.'; },
  smite:       function(A){ return 'Light damage with a '+(10*ePts('light'))+'% chance (10% per Light point) to Blind. +50% against undead and shadow creatures.'; },
  radiantbeam: function(A){ return 'A beam 3 tiles wide along a row, column or diagonal: light damage (+50% to undead and shadow), '+(5*ePts('light'))+'% Blind (5% per Light point).'; },
  heal:        function(A){ var r=lvRank(), raw=Math.round(player.maxhp*(0.12+0.03*r)*lvDiv()*(1+0.10*r)), cap=Math.round(player.maxhp*0.4); return 'Invoke (Saint Glimmer): restore about '+Math.min(raw, cap)+' HP (12% of max HP, +3% per piety rank, up to 40%).'; },
  arcaneward:  function(A){ var r=lvRank(); return 'Invoke (Vellum): 8 Favor, one action. A 10-turn ward with '+Math.round(player.maxmp*(0.10+0.02*r)*lvDiv())+' HP (10% + 2% per divine rank of maximum mana).'; },
  livingflame: function(A){ var sp=typeof spellPower==='function' ? spellPower(A) : 1; return A.desc+' Now: '+Math.round(20*sp)+' HP, hits for '+Math.round(4*sp)+'-'+Math.round(8*sp)+'.'; }
};
var PRAYER_LIVE = {
  ironhide: function(P){ return '+5 armor for 12 turns, and a shield of '+Math.round((5+2*lvRank())*(typeof divineStrength==='function' ? divineStrength() : 1))+' (5 + 2 per rank).'; }
};
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
  var f=k && PRAYER_LIVE[k];
  if(f && typeof player!=='undefined' && player){ try { return f(P); } catch(x){} }
  return P.desc || '';
}
