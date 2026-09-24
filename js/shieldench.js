/* =====================================================================
   shieldench.js - shields can be enchanted too (2026-09-17).
   Weapons, armor, orbs and tomes could all take a mote; a shield could not, which left the whole sword-and-
   board side of the game with one fewer thing to build. A shield's enchantment answers a blow instead of
   landing one: it fires when you block, except Earth, which simply makes you block more often.
   The Forge offers these wherever it offers the other off-hand infusions - offKind() now answers 'shield'.
   ===================================================================== */

function shieldEnchantValues(el){return enchantValues('shield',el);}

/* called from attack() the moment a blow is blocked, with the damage that was coming */
function onShieldBlock(att, def, raw){
  if(def!==player || !att || att===player) return;
  var sh=player.off, el=sh && sh.enchant;
  if(!el || !(sh.block>0)) return;
  var values=shieldEnchantValues(el);
  if(el==='fire'){
    var burn=Math.max(1, Math.round(raw*values.fire));
    var fd=applyDamage(att, burn, 'fire', player);
    floatText(att.x, att.y, String(fd), 'fire');
    if(pRoll(values.burn) && att.hp>0) applyStatus(att,'burn',values.burnDuration,typeof burnDmg==='function'?burnDmg():2);
    log('Your shield throws the blow back as fire &mdash; <b>'+fd+'</b>.','c-good');
    if(att.hp<=0) kill(att, player);
  }
  else if(el==='water' && pRoll(values.water)){ addChill(att); log('The blocked attacker is chilled.','c-good'); }
  else if(el==='air' && pRoll(values.air)){
    applyStatus(att,'stun',values.stunDuration);
    if(typeof knockback==='function') knockback(att, att.x-player.x, att.y-player.y, values.knockback);
    log('A thunderclap off your shield staggers it.','c-good');
  }
  else if(el==='light'){
    var h=Math.min(player.maxhp-player.hp, values.light);
    if(h>0){ player.hp+=h; floatText(player.x, player.y, '+'+h, 'heal'); }
  }
  else if(el==='shadow' && pRoll(values.shadow)){ applyStatus(att,'corrupt',values.corruptDuration); log('The blocked attacker is corrupted.','c-good'); }
}
