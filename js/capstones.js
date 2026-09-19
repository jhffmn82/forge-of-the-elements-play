/* =====================================================================
   capstones.js - rank 5 god boons (passive only; no third prayer).
   Grom: Mountain's Fists | Grumbok: Spellbreaker | Glimmer: Undying Light
   Murk: Lich-Mother | Reginald: Champion | Anvil: Masterwork
   Vellum: Archmage (Spell Echo 35% lives in gods.js) | Wobbles: Beloved Toy
   ===================================================================== */

function capstone(god){ return player && player.god===god && godRank()>=5; }
function foesInView(){ return ents.filter(function(e){ return e.foe && vis[idxOf(e.x,e.y)]; }).length; }

/* ---------------------------------------------------------------- attacks you make */
var _attackCap = attack;
attack = function(att, def, mult, label){
  mult = mult || 1;
  var knock=false;
  if(att===player && def && def.hp>0){
    if(capstone('grom') && player.weapon && player.weapon.unarmed){
      player.gromStreak=(player.gromStreak||0)+1;
      if(player.gromStreak>=3){ player.gromStreak=0; mult*=1.6; knock=true; }
    }
    if(capstone('grumbok') && player.spellbreak && dist(att,def)<=1){ mult*=2; player.spellbreak=false; log('<b>Spellbreaker!</b> You answer the spell with steel.','c-good'); }
    if(capstone('reginald') && foesInView()===1) mult*=1.3;
  }
  var hp0 = def ? def.hp : 0;
  var r=_attackCap(att, def, mult, label);
  if(knock && def && def.hp>0 && def.hp<hp0 && !(def.base && def.base.boss)){
    var nx=def.x+Math.sign(def.x-player.x), ny=def.y+Math.sign(def.y-player.y);
    if(walkable(nx,ny) && !occupied(nx,ny)){ def.x=nx; def.y=ny; def._lx=undefined; }
    log('<b>Mountain’s Fists</b> hurl the '+def.name+' back.','c-good');
  }
  return r;
};

/* ---------------------------------------------------------------- damage you take */
var _applyDamageCap = applyDamage;
applyDamage = function(target, amount, type, source){
  if(target===player){
    if(capstone('grumbok') && type!=='phys' && source && source.foe){ amount*=0.5; player.spellbreak=true; }
    if(capstone('reginald') && foesInView()===1) amount*=0.8;
  }
  var d=_applyDamageCap(target, amount, type, source);
  if(target===player && player.hp<=0){
    if(capstone('glimmer') && !floorMeta.undyingUsed){
      floorMeta.undyingUsed=true; player.hp=Math.round(player.maxhp*0.5);
      log('<b>Undying Light.</b> Saint Glimmer will not let you fall here.','c-kill'); sparkleFx(player.x,player.y,'light',50); sfx('heal');
    } else if(capstone('wobbles') && !floorMeta.wobblesSaved){
      floorMeta.wobblesSaved=true; player.hp=Math.max(1, Math.round(player.maxhp*0.25));
      var pickR=Math.floor(rng()*3);
      if(pickR===0){ player.hp=player.maxhp; log('<b>Wobbles giggles.</b> "Not yet!" You are fully healed.','c-kill'); }
      else if(pickR===1){
        var spots=[]; for(var y=0;y<MH;y++) for(var x=0;x<MW;x++) if(walkable(x,y) && !occupied(x,y) && inRoom(x,y) && dist(player,{x:x,y:y})>12) spots.push({x:x,y:y});
        if(spots.length){ var s=pick(spots); player.x=s.x; player.y=s.y; player._lx=undefined; computeFOV(); }
        log('<b>Wobbles giggles</b> and yanks you somewhere else entirely.','c-kill');
      } else {
        if(source && source.foe && !(source.base && source.base.boss)){ var sx=source.x, sy=source.y; ents=ents.filter(function(e){ return e!==source; }); var rat=spawn('rat',sx,sy); rat.name='Very Confused Rat'; rat.noXp=true; rat.state='wander'; }
        log('<b>Wobbles giggles.</b> Your killer is suddenly a very confused rat.','c-kill');
      }
      sfx('wobbles-giggle'); sparkleFx(player.x,player.y,'magic',40);
    }
  }
  return d;
};

/* ---------------------------------------------------------------- Murk: the servant rises again once */
var _killCap = kill;
kill = function(e, by){
  var rise = e && e.ally && e.undeadServant && !e.revived && capstone('murk') && ents.indexOf(e)>=0;
  _killCap(e, by);
  if(rise){
    e.revived=true; e.hp=e.maxhp; e.st={};
    var spot = !occupied(e.x,e.y) ? {x:e.x,y:e.y} : nearFree(e.x,e.y,2);
    if(spot){ e.x=spot.x; e.y=spot.y; e._lx=undefined; ents.push(e); log('<b>Mother Murk</b> will not let your '+e.name+' rest. It rises again.','c-kill'); sparkleFx(e.x,e.y,'dark',30); }
  }
};

/* ---------------------------------------------------------------- Anvil: cheaper upgrades, and +4 */
var _upgradeCostCap = upgradeCost;
upgradeCost = function(it){
  if(!it) return null;
  var mw = capstone('anvil');
  if(mw && !it.cursed && (it.plus||0)===3){
    return Math.round((it.kind==='ring' ? RING_RANK_COST[RING_RANK_COST.length-1] : 3000*tierCostMult(it)) * 0.7 * (player.race==='dwarf' ? 0.75 : 1));
  }
  var c=_upgradeCostCap(it);
  return c===null ? null : Math.round(c * (mw ? 0.7 : 1));
};

/* ---------------------------------------------------------------- Vellum: spells cost a quarter less */
var _costOfCap = costOf;
costOf = function(A){
  var c=_costOfCap(A);
  if(c>0 && capstone('vellum') && !A.tech && !A.divine) c=Math.max(1, Math.round(c*0.75));
  return c;
};

/* =====================================================================
   Hearts and mana globes: every kill has a 15% chance to drop each.
   Stepping on one uses it (heart +10 HP, globe +20 mana). They fade after 40 turns.
   ===================================================================== */
var GLOBE_CHANCE = 0.15, GLOBE_LIFE = 40;
var _killGlobes = kill;
kill = function(e, by){
  var ok = e && e!==player && e.foe && (by===player || by==='player' || (by && by.ally)) && ents.indexOf(e)>=0 && !e.noXp;
  _killGlobes(e, by);
  if(!ok) return;
  [['heart', GLOBE_CHANCE], ['managlobe', GLOBE_CHANCE]].forEach(function(g){
    if(rng()>=g[1]) return;
    var spot = (!items.some(function(it){ return it.x===e.x && it.y===e.y; }) && walkable(e.x,e.y)) ? {x:e.x,y:e.y} : nearFree(e.x,e.y,1);
    if(spot) items.push({kind:g[0], x:spot.x, y:spot.y, until:turn+GLOBE_LIFE});
  });
};
var _stepOnGlobes = stepOn;
stepOn = function(){
  /* a full bar leaves the globe where it lies for later */
  items.filter(function(it){ return it.x===player.x && it.y===player.y && ((it.kind==='heart' && player.hp<player.maxhp) || (it.kind==='managlobe' && player.mp<player.maxmp)); }).forEach(function(it){
    items=items.filter(function(o){ return o!==it; });
    if(it.kind==='heart'){ var h=Math.min(Math.max(4, Math.round(player.maxhp*0.25)), player.maxhp-player.hp); player.hp+=h; floatText(player.x,player.y,'+'+Math.round(h),'heal'); sparkleFx(player.x,player.y,'heal',12); sfx('heal',{vol:0.5}); }
    else { var m=Math.min(Math.max(5, Math.round(player.maxmp*0.25)), player.maxmp-player.mp); player.mp+=m; floatText(player.x,player.y,'+'+Math.round(m)+' mp','ice'); sparkleFx(player.x,player.y,'ice',12); sfx('pickup-essence',{vol:0.6}); }
  });
  _stepOnGlobes();
};
var _endTurnGlobes = endTurn;
endTurn = function(){
  _endTurnGlobes();
  if(items.some(function(it){ return it.until && turn>=it.until; })) items=items.filter(function(it){ return !(it.until && turn>=it.until); });
};
var _itemLabelGlobes = itemLabel;
itemLabel = function(it){ return it.kind==='heart' ? 'a heart (+10 HP)' : it.kind==='managlobe' ? 'a mana globe (+20 mana)' : _itemLabelGlobes(it); };
