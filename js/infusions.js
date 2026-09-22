/* =====================================================================
   infusions.js - enchanting orbs and tomes (2026-09-16).
   Infusions change how spells are delivered (orb) or paid for (tome).
   They never add an element's own statuses or defenses (chill, root,
   blind, fear, arcs, shields...), so they don't compete with the
   elemental paths. Strength scales with affinity like other enchants.
   ===================================================================== */

ENCHANT_TEXT.orb = {
  fire:  'Cinders: spell crits scorch the target’s tile, Burning it for 2 turns (2 damage, +1 per Fire point)',
  water: 'Up to +15% spell damage, the fuller your mana',
  air:   '+1 spell range (+2 at Air 3, +3 at Air 5)',
  earth: '+10% spell damage if you did not move last turn (+3% per Earth point)',
  light: 'Spell crits restore 3 mana (grows with Light)',
  shadow:'+10% spell damage against targets below half HP (+3% per Shadow point)'
};
ENCHANT_TEXT.tome = {
  fire:  'Spells cost 5% less for each Burning enemy in view (up to 25%, +5% per Fire point)',
  water: '+30% mana regeneration (grows with Water)',
  air:   '5% chance per Air point (min 5%) that a spell costs no mana',
  earth: '+10% max mana (grows with Earth)',
  light: 'Mana Ward: 10% of the mana you spend (+5% per Light point) becomes a shield',
  shadow:'Spell kills heal 1% of max HP per Shadow point (min 1%)'
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
  if(el==='water') m *= 1 + 0.15*infScale(el)*clamp(player.mp/Math.max(1,player.maxmp),0,1);
  if(el==='earth' && !player.movedLast) m *= 1 + 0.10 + 0.03*affPts('earth');
  if(el==='shadow' && player._spellTarget && player._spellTarget.hp < player._spellTarget.maxhp/2) m *= 1 + 0.10 + 0.03*affPts('shadow');
  return m;
};
var _spellRangeInf = spellRange;
spellRange = function(A){ var r=_spellRangeInf(A); if(r && !A.tech && !A.divine && infusion('orb')==='air') r += 1 + (affPts('air')>=3?1:0) + (affPts('air')>=5?1:0); return r; };
/* the aimed target, so Shadow's "below half HP" can see it before damage is rolled */
var _castAtInf = castAt;
castAt = function(x,y){
  player._spellTarget = ents.filter(function(e){ return e.foe && e.x===x && e.y===y; })[0] || null;
  var r=_castAtInf(x,y); player._spellTarget=null; return r;
};
/* called from castAt after a spell's damage lands (combat.js) */
function spellOnHit(f, d, crit, A){
  var el=infusion('orb');
  if(el==='light' && crit){ var mp=Math.round(3*infScale(el)); player.mp=Math.min(player.maxmp, player.mp+mp); floatText(player.x,player.y,'+'+mp+' mp','ice'); }
  if(el==='fire' && crit && inb(f.x,f.y) && at(f.x,f.y)!==WATER){
    fireT[idxOf(f.x,f.y)]=Math.max(fireT[idxOf(f.x,f.y)],2); fireSrc[idxOf(f.x,f.y)]=1;
    if(f.hp>0) applyStatus(f,'burn',2,burnDmg());
    burst(f.x,f.y,'fire',16,0.05);
  }
  if(f.hp<=0 && infusion('tome')==='shadow'){
    var h=Math.max(1, Math.round(player.maxhp*0.01*Math.max(1,affPts('shadow'))));
    healPlayer(h); floatText(player.x,player.y,'+'+h,'heal');
  }
}

/* ---------------------------------------------------------------- tome: what casting costs */
function burningInView(){ return ents.filter(function(e){ return e.foe && e.st && e.st.burn && vis[idxOf(e.x,e.y)]; }).length; }
var _costOfInf = costOf;
costOf = function(A){
  var c=_costOfInf(A);
  if(c>0 && !A.tech && !A.divine && infusion('tome')==='fire'){
    var cut=Math.min(0.05*burningInView(), 0.25+0.05*affPts('fire'));
    if(cut>0) c=Math.max(1, Math.round(c*(1-cut)));
  }
  return c;
};
var _spellConductInf = spellConduct;
spellConduct = function(A){
  var r=_spellConductInf(A);
  var cost=costOf(A), el=infusion('tome');
  player._lastSpellCost=cost;
  if(el==='air' && rng() < Math.max(0.05, 0.05*affPts('air'))){ player.mp=Math.min(player.maxmp, player.mp+cost); log('The quill writes the spell for you: no mana spent.','c-good'); }
  else if(el==='light' && cost>0){
    var add=cost*(0.10+0.05*affPts('light')), capW=Math.round(player.maxhp*0.30);
    player.mward=Math.min(capW, (player.mward||0)+add);
  }
  return r;
};
var _deriveInf = derive;
derive = function(p){ _deriveInf(p); if(p===player && infusion('tome')==='earth') p.maxmp=Math.round(p.maxmp*(1+0.10*infScale('earth'))); };
var _endTurnInf = endTurn;
endTurn = function(){
  if(player) player.movedLast = !!player.movedThisTurn;
  var before=turn;_endTurnInf();if(turn===before)return;
  if(!player || player.hp<=0) return;
  if(infusion('tome')==='water') player.mp=Math.min(player.maxmp, player.mp + player.maxmp*0.006*0.30*infScale('water'));
  if(player.mward>0 && infusion('tome')!=='light') player.mward=0;
};
var _playerShieldInf = playerShield;
playerShield = function(){ return _playerShieldInf() + Math.max(0, Math.floor(player.mward||0)); };
/* Shadow armor: stealth */
/* the one armor enchant that did not read enchantScale, so Old Anvil skipped it too (2026-09-18) */
function stealthExtra(){ var a=bodyArmor(player); if(!a || a.enchant!=='shadow') return 0;
  var am = (player.god==='anvil' ? 1 + 0.10*godRank() : 1);
  return 0.05*Math.max(1,affPts('shadow'))*am; }

/* item cards show the infusion */
var _bagCardInf = bagCard;
bagCard = function(it){
  var h=_bagCardInf(it);
  if(it && it.kind==='off' && it.data.enchant && !it.data.unid){ var ic=(it.data.icon||'').replace(/^item-/,''); if(ENCHANT_TEXT[ic]) h+='<div class="row"><span>Infusion</span><b style="color:'+AFF_COL[it.data.enchant]+'">'+cap(it.data.enchant)+'</b></div><div class="hint">'+ENCHANT_TEXT[ic][it.data.enchant]+'</div>'; }
  return h;
};
