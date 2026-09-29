/* Off-hand enchant consumers. Magnitudes and descriptions live in the
   canonical enchantment registry; this module applies their game effects. */


/* 2026-09-29 (Justin): among armor, shield, orb, tome and holy symbol only the strongest enchant of each element
   counts. You wear one body armor and one off-hand, so the only overlap is an off-hand enchant of the armor's element,
   and the armor's is the stronger (a resistance plus its bonus): that off-hand enchant lies dormant. Weapons stand
   apart: each weapon's enchant rides only the hits made with it (attackView), never another weapon's. */
function offEnchantDormant(o,armor){ return !!(o && o.enchant && armor && armor.enchant===o.enchant); }
function infusion(kind){ var o=player.off; return offKind()===kind && o.enchant && !offEnchantDormant(o,bodyArmor(player)) ? o.enchant : null; }
function affPts(el){ return (player.aff && player.aff[el]) || 0; }

/* ---------------------------------------------------------------- the Forge: the off-hand can be enchanted when it is an orb or tome */


/* ---------------------------------------------------------------- orb: how spells land */


/* called from castAt after a spell's damage lands (combat.js) */
function applySpellOffhandEffects(f, d, crit, A){
  if(crit)orbOnCritical(f);
}
function spellKillReward(f){
  if(f.hp<=0 && infusion('tome')==='shadow'){
    var h=Math.max(1, Math.round(player.maxhp*enchantValues('tome','shadow').killHeal));
    healPlayer(h); floatText(player.x,player.y,'+'+h,'heal');
  }
}

/* ---------------------------------------------------------------- tome: what casting costs */


function turnClearTomeWard(context){  if(!player || player.hp<=0) return;

  if(player.mward>0 && infusion('tome')!=='light') player.mward=0;

}


/* Shadow armor: stealth */
function stealthExtra(){ var a=bodyArmor(player); return a&&a.enchant==='shadow'?enchantValues('armor','shadow').stealth:0; }

/* item cards show the infusion */


function orbOnCritical(f,view){
  var el=view?actionInfusion('orb',view):infusion('orb'),values=enchantValues('orb',el);
  if(el==='water')player.iceArmor=Math.min(player.iceArmorMax,player.iceArmor+values.iceArmor);
  if(el==='air' && f.hp>0)applyStatus(f,'stun',values.stunDuration);
  if(el==='light'){ var mp=values.mana; player.mp=Math.min(player.maxmp, player.mp+mp); floatText(player.x,player.y,'+'+mp+' mp','ice'); }
  if(el==='fire' && inb(f.x,f.y) && at(f.x,f.y)!==WATER){
    fireT[idxOf(f.x,f.y)]=Math.max(fireT[idxOf(f.x,f.y)],values.fireDuration); fireSrc[idxOf(f.x,f.y)]=1;
    if(f.hp>0) applyStatus(f,'burn',values.burnDuration,burnDmg());
    burst(f.x,f.y,'fire',16,0.05);
  }
}
