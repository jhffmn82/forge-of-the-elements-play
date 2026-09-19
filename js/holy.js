/* =====================================================================
   holy.js - the holy symbol (2026-09-17).
   Base: every buff that lands on you lasts longer: +10% / +15% / +20% / +25% by tier, +3% per upgrade
   level, always at least +1 turn. It keeps its Invoke and prayer strength bonus on top.
   Forge infusions (themed on being buffed; x1 + 0.3 per affinity point in the element):
   Fire Zeal +8% damage, Water Flow +15% mana regen, Air Swiftness 5% faster actions,
   Earth Steadfast 5% less damage taken, Shadow Dread +3% crit - all while any buff is on you;
   Light Radiance: gaining a buff heals 3% of max HP.
   ===================================================================== */

var HOLY_DURATION = [0.10, 0.15, 0.20, 0.25], HOLY_DURATION_PER = 0.03;
ENCHANT_TEXT.holy = {
  fire:  'Zeal: +8% damage while any buff is on you',
  water: 'Flow: +15% mana regeneration while buffed',
  air:   'Swiftness: actions 5% faster while buffed',
  earth: 'Steadfast: take 5% less damage while buffed',
  light: 'Radiance: gaining a buff heals 3% of your max HP',
  shadow:'Dread: +3% crit chance while buffed'
};
/* the Forge can now infuse a holy symbol like an orb or tome */
offKind = function(){
  var o=player.twoHanded ? null : player.off; if(!o || o===EMPTY_OFF || o.joke) return null;
  var ic=(o.icon||'').replace(/^item-/,'');
  return (ic==='orb'||ic==='tome'||ic==='holy') ? ic : null;
};
function holySymbol(){ return offKind()==='holy' ? player.off : null; }
function holyDurationPct(it){
  it=it||holySymbol(); if(!it || it.cursed) return 0;
  var t=typeof it.tier==='number' ? Math.max(0,Math.min(3,it.tier)) : 1;
  return HOLY_DURATION[t] + HOLY_DURATION_PER*Math.max(0, it.plus||0);
}

/* ---------------------------------------------------------------- what counts as a buff on you */
function buffTimers(){
  var out={};
  if(player.buffs) for(var k in player.buffs) if(player.buffs[k]>0) out['b:'+k]=player.buffs[k];
  ['stone','aura'].forEach(function(k){ var s=player.st && player.st[k]; if(s && s.t>0) out['s:'+k]=s.t; });
  if(player.levitate>0) out.lev=player.levitate;
  if(player.hidden>0) out.hid=player.hidden;
  return out;
}
function setBuffTimer(key, v){
  if(key.indexOf('b:')===0) player.buffs[key.slice(2)]=v;
  else if(key.indexOf('s:')===0) player.st[key.slice(2)].t=v;
  else if(key==='lev') player.levitate=v;
  else if(key==='hid') player.hidden=v;
}
function isBuffed(){ var b=buffTimers(); for(var k in b) return true; return false; }

/* a buff that is new or refreshed since the last turn is lengthened, and Radiance heals */
var _endTurnHoly = endTurn;
endTurn = function(){
  if(player && player.hp>0){
    var now=buffTimers(), prev=player._buffSeen||{}, pct=holyDurationPct(), gained=0;
    for(var k in now){
      if(!(now[k] > (prev[k]||0))) continue;
      gained++;
      if(pct>0) setBuffTimer(k, now[k] + Math.max(1, Math.round(now[k]*pct)));
    }
    if(gained && infusion('holy')==='light'){
      var h=Math.max(1, Math.round(player.maxhp*0.03*infScale('light')*gained));
      if(player.race!=='gloomling'){ healPlayer(h); floatText(player.x,player.y,'+'+h,'heal'); }
    }
  }
  _endTurnHoly();
  if(player){
    player._buffSeen=buffTimers();
    if(infusion('holy')==='water' && player.hp>0 && isBuffed()) player.mp=Math.min(player.maxmp, player.mp + player.maxmp*0.006*0.15*infScale('water'));
  }
};

/* Zeal and Steadfast */
var _applyDamageHoly = applyDamage;
applyDamage = function(target, amount, type, source){
  var el=infusion('holy');
  if(el && isBuffed()){
    if(el==='fire' && source===player && target!==player) amount*=1 + 0.08*infScale('fire');
    if(el==='earth' && target===player) amount*=Math.max(0.5, 1 - 0.05*infScale('earth'));
  }
  return _applyDamageHoly(target, amount, type, source);
};
/* Swiftness */
var _actCostHoly = actCost;
actCost = function(e){ var c=_actCostHoly(e); if(e===player && infusion('holy')==='air' && isBuffed()) c=Math.max(40, Math.round(c*(1 - 0.05*infScale('air')))); return c; };
/* Dread: crit is read from player.crit when an attack or spell resolves */
function withDread(fn){
  return function(){
    var add = infusion('holy')==='shadow' && isBuffed() ? 0.03*infScale('shadow') : 0;
    if(!add) return fn.apply(this, arguments);
    player.crit += add;
    try{ return fn.apply(this, arguments); } finally { player.crit -= add; }
  };
}
attack = withDread(attack);
castAt = withDread(castAt);

/* item card: show the duration bonus under the strength bonus */
var _bagCardHoly = bagCard;
bagCard = function(it){
  var h=_bagCardHoly(it);
  if(it && it.kind==='off' && it.data && itemKey(it.data)==='holy' && !it.data.unid)
    h=h.replace(/(<div class="row"><span>Invoke strength<\/span><b>[^<]*<\/b><\/div>)/, '$1<div class="row"><span>Buff duration</span><b>+'+Math.round(holyDurationPct(it.data)*100)+'%</b></div>');
  return h;
};
