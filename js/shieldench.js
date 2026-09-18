/* =====================================================================
   shieldench.js - shields can be enchanted too (2026-09-17).
   Weapons, armor, orbs and tomes could all take a mote; a shield could not, which left the whole sword-and-
   board side of the game with one fewer thing to build. A shield's enchantment answers a blow instead of
   landing one: it fires when you block, except Earth, which simply makes you block more often.
   The Forge offers these wherever it offers the other off-hand infusions - offKind() now answers 'shield'.
   ===================================================================== */

ENCHANT_TEXT.shield = {
  fire:  'blocking scorches the attacker for 25% of the blow (+8% per Fire point), and can set it Burning',
  water: '25% chance (+10% per Water point) that a blocked attacker is Chilled',
  air:   '10% chance (+5% per Air point) that a blocked attacker is knocked back and stunned',
  earth: '+5% block chance per Earth point',
  light: 'every block mends you for 1 HP (+1 per Light point)',
  shadow:'15% chance (+5% per Shadow point) that a blocked attacker is Corrupted'
};

function shPts(el){ return (player && player.aff && player.aff[el]) || 0; }
function shSc(el){ return typeof enchantScale==='function' ? enchantScale(el) : 1; }

/* live wording for the item card, the way weapons and armor do it */
if(typeof ENCH_LIVE!=='undefined'){
  ENCH_LIVE.shield = {
    fire:  function(){ return 'blocking burns the attacker for '+Math.round((0.25+0.08*shPts('fire'))*100)+'% of the blow'; },
    water: function(){ return Math.round((0.25+0.10*shPts('water'))*100)+'% chance to Chill a blocked attacker'; },
    air:   function(){ return Math.round(Math.max(0.10, 0.10+0.05*shPts('air'))*100)+'% chance to stun a blocked attacker'; },
    earth: function(){ return '+'+Math.round(0.05*shPts('earth')*100)+'% block chance'; },
    light: function(){ return 'each block mends '+(1+shPts('light'))+' HP'; },
    shadow:function(){ return Math.round((0.15+0.05*shPts('shadow'))*100)+'% chance to Corrupt a blocked attacker'; }
  };
}

/* the Forge treats a shield as an infusable off-hand */
function shieldKind(){
  var o=player && player.off;
  if(!o || o===EMPTY_OFF) return null;
  var ic=(o.icon||'').replace(/^item-/,'');
  return (o.block>0 || ic==='buckler' || ic==='kite') ? 'shield' : null;
}
if(typeof offKind==='function'){
  var _offKindSh = offKind;
  offKind = function(){ return _offKindSh() || shieldKind(); };
}

/* Earth is the one that is not a reaction: it widens the block itself */
if(typeof derive==='function'){
  var _deriveSh = derive;
  derive = function(p){
    var r=_deriveSh(p);
    if(p===player && p.block && p.off && p.off.enchant==='earth' && p.off.block>0 && !p.twoHanded){
      p.block = Math.min(0.6, p.block + 0.05*(p.aff && p.aff.earth || 0));
    }
    return r;
  };
}

/* called from attack() the moment a blow is blocked, with the damage that was coming */
function onShieldBlock(att, def, raw){
  if(def!==player || !att || att===player) return;
  var sh=player.off, el=sh && sh.enchant;
  if(!el || !(sh.block>0)) return;
  var pts=shPts(el);
  if(el==='fire'){
    var burn=Math.max(1, Math.round(raw*(0.25+0.08*pts)));
    var fd=applyDamage(att, burn, 'fire', player);
    floatText(att.x, att.y, String(fd), 'fire');
    if(rng()<0.15+0.05*pts && att.hp>0) applyStatus(att,'burn',2,typeof burnDmg==='function'?burnDmg():2);
    log('Your shield throws the blow back as fire &mdash; <b>'+fd+'</b>.','c-good');
    if(att.hp<=0) kill(att, player);
  }
  else if(el==='water' && rng()<0.25+0.10*pts){ addChill(att); log('The blocked attacker is chilled.','c-good'); }
  else if(el==='air' && rng()<0.10+0.05*pts){
    applyStatus(att,'stun',1);
    if(typeof knockback==='function') knockback(att, att.x-player.x, att.y-player.y, 1);
    log('A thunderclap off your shield staggers it.','c-good');
  }
  else if(el==='light'){
    var h=Math.min(player.maxhp-player.hp, 1+pts);
    if(h>0){ player.hp+=h; floatText(player.x, player.y, '+'+h, 'heal'); }
  }
  else if(el==='shadow' && rng()<0.15+0.05*pts){ applyStatus(att,'corrupt',3); log('The blocked attacker is corrupted.','c-good'); }
}
