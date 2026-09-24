

function capstone(god){ return player && player.god===god && godRank()>=5; }

/* 2026-09-20: Justin - Saint Glimmer's free revive is gone. Her rank 5 is the Light affinity now, and a
   killing blow kills. */

function foesInView(){ return ents.filter(function(e){ return e.foe && vis[idxOf(e.x,e.y)]; }).length; }

/* ---------------------------------------------------------------- Murk: the servant rises again once */

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
    else { if(player.god==='vellum')gainPiety(5,'mana globe',{pietyOnly:true}); var m=Math.min(Math.max(5, Math.round(player.maxmp*0.25)), player.maxmp-player.mp); player.mp+=m; floatText(player.x,player.y,'+'+Math.round(m)+' mp','ice'); sparkleFx(player.x,player.y,'ice',12); sfx('pickup-essence',{vol:0.6}); }
  });
  _stepOnGlobes();
};
var _endTurnGlobes = endTurn;
endTurn = function(){
  _endTurnGlobes();
  if(items.some(function(it){ return it.until && turn>=it.until; })) items=items.filter(function(it){ return !(it.until && turn>=it.until); });
};
var _itemLabelGlobes = itemLabel;
itemLabel = function(it){ return it.kind==='heart' ? 'a heart (+25% HP)' : it.kind==='managlobe' ? 'a mana globe (+25% mana)' : _itemLabelGlobes(it); };
