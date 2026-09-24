/* =====================================================================
   infusions.js - enchanting orbs and tomes (2026-09-16).
   Infusions change how spells are delivered (orb) or paid for (tome).
   They never add an element's own statuses or defenses (chill, root,
   blind, fear, arcs, shields...), so they don't compete with the
   elemental paths. Strength scales with affinity like other enchants.
   ===================================================================== */

ENCHANT_TEXT.orb = {
 fire:'Critical hits ignite the target tile and inflict Burning for 2 turns; Burning damage scales with Fire mastery.',
 water:'Critical hits restore 1 Ice Armor +1 per Water mastery, up to your existing capacity.',
 air:'Critical hits stun the target for 1 turn.',
 earth:'Crit chance against Rooted targets +5% +3% per Earth mastery.',
 light:'Critical hits restore 3 mana +0.9 per Light mastery.',
 shadow:'Crit damage multiplier +10% +5% per Shadow mastery.'
};
ENCHANT_TEXT.tome = {
 fire:'Spell power +5% +3% per Fire mastery.',water:'Evasion +2 +1 per Water mastery.',
 air:'Casting time reduced by 2% +1% per Air mastery.',earth:'All elemental resistances +2% +1% per Earth mastery.',
 light:'10% of mana spent +5% per Light mastery becomes a shield, capped at 30% of maximum HP.',
 shadow:'Spell kills heal 1% of maximum HP per Shadow mastery (minimum 1%).'
};
function offKind(){ var o=player.twoHanded ? null : player.off; if(!o || o===EMPTY_OFF) return null; var ic=(o.icon||'').replace(/^item-/,''); return (ic==='orb'||ic==='tome') ? ic : null; }
function infusion(kind){ var o=player.off; return offKind()===kind && o.enchant ? o.enchant : null; }
function infScale(el){ return enchantScale(el); }
function affPts(el){ return (player.aff && player.aff[el]) || 0; }

/* ---------------------------------------------------------------- the Forge: the off-hand can be enchanted when it is an orb or tome */
var _renderForgeInf = renderForge;
renderForge = function(){
  _renderForgeInf();
  if(forgeTab!=='enchant') return;
  var panel=document.querySelector('#forgeBody .fpanel'); if(!panel) return;
  var kind=offKind(), it=player.off;
  var h='<div class="fslot"><b>Off hand:</b> '+(kind ? gearName(it) : '<span class="c-info">an orb or tome can be infused to change how your spells work</span>')+'</div>';
  if(kind){
    h+='<div class="egrid">';
    ELEMENTS.forEach(function(el){
      var ok=(player.motes[el]||0)>0;
      h+='<button data-ench="off:'+el+'" '+(ok?'':'disabled')+' title="'+ENCHANT_TEXT[kind][el]+'"><span class="dot" style="background:'+AFF_COL[el]+'"></span>'+cap(el)+'<span class="d">'+ENCHANT_TEXT[kind][el]+'</span></button>';
    });
    h+='</div>';
  }
  panel.insertAdjacentHTML('beforeend', h);
  panel.querySelectorAll('[data-ench^="off:"]').forEach(function(b){ b.onclick=function(){ enchantItem('off', b.getAttribute('data-ench').split(':')[1]); }; });
};
var _enchantItemInf = enchantItem;
enchantItem = function(slot, el){
  if(slot!=='off') return _enchantItemInf(slot, el);
  var kind=offKind(), item=player.off;
  if(!kind){ log('Only an orb or tome in your off hand can be infused.','c-info'); return; }
  if(!(player.motes[el]>0)){ log('You have no '+el+' mote.','c-info'); return; }
  /* infusing the same element again does nothing at all, so refuse rather than eat the mote (2026-09-17) */
  if(item.enchant===el){ log('Your '+gearName(item)+' already carries '+el+'. A second mote would change nothing.','c-info'); sfx('ui-error'); return; }
  player.motes[el]--; if(player.motes[el]<=0) delete player.motes[el];
  var was=item.cursed; item.enchant=el;
  if(player.god==='anvil') gainPiety(20);
  godConductEquip('off', item);
  if(was) breakCurse(item);
  derive(player);
  log('The Forge infuses your '+gearName(item)+' with <b>'+el+'</b>: '+ENCHANT_TEXT[kind][el]+' (&times;'+enchantScale(el).toFixed(1)+' from your affinity).','c-kill');
  sfx('forge-enchant'); sparkleFx(player.x,player.y,TRAIL_EL(el),40);
  updateUI(); renderForge();
};

/* ---------------------------------------------------------------- orb: how spells land */
var _spellPowerInf = spellPower;
spellPower = function(A){
  var m=_spellPowerInf(A), el=infusion('orb');
  if(infusion('tome')==='fire')m*=1+(.05+.03*affPts('fire'))*enchantGodBonus();
  return m;
};



/* called from castAt after a spell's damage lands (combat.js) */
function spellOnHit(f, d, crit, A){
  if(crit)orbOnCritical(f);
  if(f.hp<=0 && infusion('tome')==='shadow'){
    var h=Math.max(1, Math.round(player.maxhp*0.01*Math.max(1,affPts('shadow'))*enchantGodBonus()));
    healPlayer(h); floatText(player.x,player.y,'+'+h,'heal');
  }
}

/* ---------------------------------------------------------------- tome: what casting costs */

var _spellConductInf = spellConduct;
spellConduct = function(A){
  var r=_spellConductInf(A);
  var cost=player._actualSpellCost||0, el=infusion('tome');
  player._lastSpellCost=cost;
  if(el==='light' && cost>0){
    var add=cost*(0.10+0.05*affPts('light'))*enchantGodBonus(), capW=Math.round(player.maxhp*0.30);
    player.mward=Math.min(capW, (player.mward||0)+add);
  }
  return r;
};
var _deriveInf = derive;
derive = function(p){ _deriveInf(p); if(p===player && infusion('tome')==='water')p.eva+=Math.round((2+affPts('water'))*enchantGodBonus()); };
var _endTurnInf = endTurn;
endTurn = function(){
  if(player) player.movedLast = !!player.movedThisTurn;
  var before=turn;_endTurnInf();if(turn===before)return;
  if(!player || player.hp<=0) return;

  if(player.mward>0 && infusion('tome')!=='light') player.mward=0;
};
var _playerShieldInf = playerShield;
playerShield = function(){ return _playerShieldInf() + Math.max(0, Math.floor(player.mward||0)); };
/* Shadow armor: stealth */
/* the one armor enchant that did not read enchantScale, so Old Anvil skipped it too (2026-09-18) */
function stealthExtra(){ var a=bodyArmor(player); if(!a || a.enchant!=='shadow') return 0;
  var am = enchantGodBonus();
  return 0.05*Math.max(1,affPts('shadow'))*am; }

/* item cards show the infusion */
var _bagCardInf = bagCard;
bagCard = function(it){
  var h=_bagCardInf(it);
  if(it && it.kind==='off' && it.data.enchant && !it.data.unid){ var ic=(it.data.icon||'').replace(/^item-/,''); if(it.data.block>0 && ENCHANT_TEXT.shield) ic='shield';   /* 2026-09-22 audit: a shield's infusion was never on its card */
    if(ENCHANT_TEXT[ic]) h+='<div class="row"><span>Infusion</span><b style="color:'+AFF_COL[it.data.enchant]+'">'+cap(it.data.enchant)+'</b></div><div class="hint">'+enchantLive(ic,it.data.enchant)+'</div>'; }
  return h;
};

function orbOnCritical(f){
  var el=infusion('orb');
  if(el==='water')player.iceArmor=Math.min(player.iceArmorMax,player.iceArmor+Math.round((1+affPts('water'))*enchantGodBonus()));
  if(el==='air' && f.hp>0)applyStatus(f,'stun',1);
  if(el==='light'){ var mp=Math.round(3*infScale(el)); player.mp=Math.min(player.maxmp, player.mp+mp); floatText(player.x,player.y,'+'+mp+' mp','ice'); }
  if(el==='fire' && inb(f.x,f.y) && at(f.x,f.y)!==WATER){
    fireT[idxOf(f.x,f.y)]=Math.max(fireT[idxOf(f.x,f.y)],2); fireSrc[idxOf(f.x,f.y)]=1;
    if(f.hp>0) applyStatus(f,'burn',2,burnDmg());
    burst(f.x,f.y,'fire',16,0.05);
  }
}
