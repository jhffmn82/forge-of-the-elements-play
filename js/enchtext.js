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
    air:   function(){ return ePct(Math.max(0.05, 0.05*ePts('air')))+' chance of an instant extra attack'; },
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
