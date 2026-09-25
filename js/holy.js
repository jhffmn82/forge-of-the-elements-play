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
/* the Forge can now infuse a holy symbol like an orb or tome */

function holySymbol(){ return offKind()==='holy' ? player.off : null; }
function holyDurationPct(it){
  it=it||holySymbol(); if(!it || it.cursed) return 0;
  var t=typeof it.tier==='number' ? Math.max(0,Math.min(3,it.tier)) : 1;
  return (HOLY_DURATION[t] + HOLY_DURATION_PER*Math.max(0, it.plus||0))*gearPassiveBonus();
}

/* ---------------------------------------------------------------- what counts as a buff on you */
function buffTimers(){
  var out={};
  if(player.buffs) for(var k in player.buffs) if(k!=='hardened'&&player.buffs[k]>0) out['b:'+k]=player.buffs[k];
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
function isBuffed(){ if(livingMountainStacks(player)>0)return true;var b=buffTimers(); for(var k in b) return true; return false; }

/* a buff that is new or refreshed since the last turn is lengthened, and Radiance heals */

function turnPrepareHolyBuffs(context){
  if(player && player.hp>0){
    var now=buffTimers(), prev=player._buffSeen||{}, pct=holyDurationPct(), gained=0;
    for(var k in now){
      if(!(now[k] > (prev[k]||0))) continue;
      gained++;
      if(pct>0) setBuffTimer(k, now[k] + Math.max(1, Math.round(now[k]*pct)));
    }
    if(gained && infusion('holy')==='light'){
      var h=Math.max(1, Math.round(player.maxhp*enchantValues('holy','light').buffHeal*gained));
      if(player.race!=='gloomling'){ healPlayer(h); floatText(player.x,player.y,'+'+h,'heal'); }
    }
  }

}

/* Zeal and Steadfast */


/* Swiftness */


/* Dread: crit is read from player.crit when an attack or spell resolves */


/* item card: show the duration bonus under the strength bonus */
