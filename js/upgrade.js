/* =====================================================================
   upgrade.js - essence economy and item upgrades (2026-09-16).
   - Essence found is worth more in deeper biomes (x1, x2.5, x4.5, x6, x8),
     so one +1 is reachable by the end of biome 1 and full +3 gear by the end.
   - The Forge's Upgrade tab raises weapons, armor, off-hands and rings, to +3.
     Rings cost 500 / 1000 / 2000 for +1 / +2 / +3. Dwarves pay 25% less.
   - Upgrading a cursed item breaks the curse (rings go to +0).
   - Rings: +0 gives the base effect, each rank adds a step; cursed rings are -1..-3.
   - Amulets are not bought up: they level with use (hidden count) - 10 uses to
     level 2, 30 to level 3 - and their level is how many charges they hold.
   - Placement: about 2 rings and 1 amulet per floor, outside the normal loot pool.
   ===================================================================== */

/* to +1, +2, +3. 2026-09-17: was 600/1200/2000, cut to 150/400/900 because a full biome 1 gave ~700.
   2026-09-20 (Justin): doubled to 300/800/1800 - the cut went too far. Fine costs 2x these and
   Masterwork 4x, through tierCostMult below, so a Masterwork +3 is 7200 (2026-09-22, Justin: was 1.5x / 2x,
   and a full-clear character ended biome 4 with 29,000 essence unspent). */
var UPGRADE_COST = [300, 800, 1800];
var RING_RANK_COST = [500, 1000, 2000];   /* to +1, +2, +3 (2026-09-18, Justin: was a flat 500 a rank) */
var ESSENCE_BIOME_MULT = [1, 2.5, 4.5, 6, 8];
function essenceMult(){ return ESSENCE_BIOME_MULT[Math.min(ESSENCE_BIOME_MULT.length-1, Math.floor((floorNo-1)/5))]; }

/* ---------------------------------------------------------------- essence scales with depth, applied when picked up */
var _itemLabelUp = itemLabel;
itemLabel = function(it){ return it.kind==='essence' ? Math.round(it.n*essenceMult())+' essence' : _itemLabelUp(it); };
var _stepOnUp = stepOn;
stepOn = function(){
  var m=essenceMult();
  if(m!==1) items.forEach(function(it){ if(it.kind==='essence' && it.x===player.x && it.y===player.y && !it.scaled){ it.n=Math.round(it.n*m); it.scaled=true; } });
  _stepOnUp();
};

/* ---------------------------------------------------------------- rings: +0 is the base effect */
ringPower = function(r){ if(!r) return 0; return r.cursed ? (r.plus||-1) : (r.plus||0)+1; };
makeRing = function(type, cursed){
  ensureTrinketLooks();
  type = type || pick(Object.keys(RINGS));
  var plus = cursed ? -ri(1,3) : (rng()<0.7 ? 0 : 1);
  return {kind:'ring', ring:type, name:RINGS[type].name, plus:plus, cursed:!!cursed, unid:true, icon:'item-ring-'+RUN.ringLook[type]};
};
var _gearNameUp = gearName;
gearName = function(it){
  if(it && it.kind==='ring' && !(it.unid && !RUN.ringKnown[it.ring]) && !it.unid) return it.name+' '+((it.plus||0)>=0?'+':'')+(it.plus||0)+(it.cursed?' (cursed)':'');
  if(it && it.kind==='amulet' && !it.unid && AMULETS[it.amulet]) return it.name+' ('+['I','II','III'][Math.max(0,Math.min(2,(it.level||1)-1))]+')'+(it.cursed?' (cursed)':'');
  return _gearNameUp(it);
};
var _breakCurseUp = breakCurse;
breakCurse = function(it){
  var was = it && it.cursed;
  var r=_breakCurseUp(it);
  if(was && it.kind==='ring'){ it.plus=0; derive(player); refreshBagNames(); }
  return r;
};

/* ---------------------------------------------------------------- amulets: level = charge capacity, earned by use */
var AMULET_LEVEL_USES = [0, 10, 30];
AMULET_MAX_CHARGES = 3;
function amuletCap(a){ return Math.max(1, Math.min(3, a.level||1)); }
var _amuletSyncUp = amuletSync;
amuletSync = function(a){
  if(!a.level) a.level=1;
  if(a.charges===undefined){ a.charges=1; a.progress=0; }
  if(a.charges>amuletCap(a)) a.charges=amuletCap(a);
  a.charge = a.charges>0 ? 0 : Math.max(1, amuletKillsNeeded(a)-(a.progress||0));
};
amuletKillsNeeded = function(a){ return Math.max(2, Math.round(AMULETS[a.amulet].kills * (a.cursed ? 1.3 : 1))); };
var _makeAmuletUp = makeAmulet;
makeAmulet = function(type, cursed){ var a=_makeAmuletUp(type, cursed); a.plus=0; a.level=1; a.uses=0; return a; };
var _spendAmuletUp = spendAmulet;
spendAmulet = function(a){
  _spendAmuletUp(a);
  var lv=a.level||1;
  if(lv<3 && a.uses>=AMULET_LEVEL_USES[lv]){ a.level=lv+1; amuletSync(a); refreshBagNames(); log('Your <b>'+gearName(a)+'</b> has grown used to you: it now holds '+a.level+' charges.','c-kill'); sfx('piety-rank'); }
};
/* the kill hook caps at the amulet's level instead of a flat 3 */
var _killUp = kill;
kill = function(e, by){
  var a=player && player.amulet;
  if(a && AMULETS[a.amulet]) AMULET_MAX_CHARGES = amuletCap(a);
  _killUp(e, by);
  AMULET_MAX_CHARGES = 3;
};
var _abilityBarUp = abilityBar;
abilityBar = function(){
  var a=player && player.amulet; if(a && AMULETS[a.amulet]) AMULET_MAX_CHARGES = amuletCap(a);
  _abilityBarUp();
  AMULET_MAX_CHARGES = 3;
};
var _trinketCardUp = trinketCard;
trinketCard = function(it){
  if(it.kind==='amulet' && AMULETS[it.amulet]){ AMULET_MAX_CHARGES = amuletCap(it); var h=_trinketCardUp(it); AMULET_MAX_CHARGES = 3;
    return h.replace('Stores up to 3 charges', 'Holds '+amuletCap(it)+' charge'+(amuletCap(it)>1?'s':'')+' at level '+(it.level||1)+'; using it often raises its level (up to 3)'); }
  return _trinketCardUp(it);
};

/* ---------------------------------------------------------------- Keen Eyes: anything you can see */
var _endTurnUp = endTurn;
endTurn = function(){
  var before=turn;_endTurnUp();if(turn===before)return;
  if(!player || player.hp<=0 || !(ringVal('keeneyes')>0)) return;
  var ch=ringVal('keeneyes');
  feats.forEach(function(f){ if(!f.found && vis[idxOf(f.x,f.y)] && rng()<ch){ f.found=true; log('Your ring tingles: a <b>'+trapName(f.kind)+' trap</b>.','c-info'); } });
  for(var y=0;y<MH;y++) for(var x=0;x<MW;x++){ if(at(x,y)===SECRET && vis[idxOf(x,y)] && rng()<ch*0.5){ setT(x,y,DOOR); log('Your ring tingles: a <b>hidden door</b>.','c-kill'); sfx('door-secret'); computeFOV(); } }
};
RINGS.keeneyes.desc='Spot traps and hidden doors anywhere you can see.';
RINGS.keeneyes.unit='% chance a turn to spot traps you can see';

/* ---------------------------------------------------------------- upgrades at the Forge */
/* 2026-09-18 (Justin): Fine costs more to upgrade and Masterwork more again - a Masterwork piece is never swapped
   out, so its +3 is the last thing that slot ever buys. 2026-09-22 (Justin): Fine 2x the base, Masterwork 2x that. */
function tierCostMult(it){ if(!it || it.kind==='ring' || typeof tierNum!=='function') return 1; var t=tierNum(it); return t>=3 ? 4 : t===2 ? 2 : 1; }
function upgradeCost(it){
  if(!it) return null;
  var plus=it.plus||0;
  if(it.cursed) plus=-1;
  if(plus>=3) return null;
  var base = it.kind==='ring' ? RING_RANK_COST[Math.max(0,plus)] : UPGRADE_COST[Math.max(0,plus)] * tierCostMult(it);
  return Math.round(base * (player.race==='dwarf' ? 0.75 : 1));
}
/* 2026-09-17: an unidentified piece cannot be upgraded - you would be paying essence for a bonus you
   cannot see, on something that might be cursed. The Forge lists it, greyed, saying why. */
function upgradeable(it){ return it && (it.kind==='ring' || it.kind==='weapon' || it.kind==='armor' || it.kind==='off' || (it.dmg && !it.unarmed) || it.armor!==undefined || it.block!==undefined) && it!==EMPTY_OFF && !it.unarmed && !it.joke && !it.unid; }
function allUpgradeTargets(){
  var out=[];
  function add(it, where){ if(upgradeable(it) && out.every(function(o){ return o.it!==it; })) out.push({it:it, where:where}); }
  add(player.sets[player.activeSet], 'main hand'); add(player.ranged, 'bow / ranged'); add(player.armorItem, 'armor');
  if(player.off && player.off!==EMPTY_OFF) add(player.off, 'off hand');
  (player.rings||[]).forEach(function(r,i){ add(r, 'ring '+(i+1)); });
  player.bag.forEach(function(b){ if(b.data && (b.kind==='weapon'||b.kind==='armor'||b.kind==='off'||b.kind==='ring')) add(b.data, 'bag'); });
  return out;
}
function upgradeItem(it){
  if(it && it.unid){ log('The Forge will not work metal you do not know. <b>Identify it first.</b>','c-info'); sfx('ui-error'); return; }
  var cost=upgradeCost(it); if(cost===null){ log('That is as strong as the Forge can make it.','c-info'); return; }
  if(player.essence<cost){ log('You need '+cost+' essence.','c-info'); sfx('ui-error'); return; }
  spendEssence(cost);
  if(it.cursed){ it.cursed=false; it.unid=false; it.plus = it.kind==='ring' ? 0 : Math.max(0, it.plus||0); log('The Forge burns the curse out of your <b>'+gearName(it)+'</b>.','c-kill'); }
  else { it.plus=(it.plus||0)+1; it.unid=false; log('The Forge hammers your <b>'+gearName(it)+'</b> stronger.','c-kill'); }
  if(it.kind==='ring') RUN.ringKnown[it.ring]=true;
  if(player.god==='anvil') gainPiety(10);
  derive(player); refreshBagNames(); sfx('forge-enchant'); sparkleFx(player.x,player.y,'fire',30);
  updateUI(); renderForge();
}
function upgradePanelHTML(){
  var list=allUpgradeTargets();
  var h='<p class="c-info">Spend essence to strengthen gear, up to +3. Worn or carried, it all counts. '+
        'Rings cost '+RING_RANK_COST.join(' / ')+' to reach +1 / +2 / +3. Fine gear costs 2x, Masterwork 4x. Upgrading a cursed item breaks the curse. Deeper biomes yield more essence.'+
        (player.race==='dwarf'?' <b>Dwarven smithing: 25% cheaper.</b>':'')+'</p>';
  if(!list.length) return h+'<p class="c-info">Nothing to upgrade.</p>';
  list.forEach(function(o, i){
    var it=o.it, cost=upgradeCost(it), plus=it.cursed ? 'cursed' : '+'+(it.plus||0);
    var what = it.kind==='ring' ? (it.unid && !RUN.ringKnown[it.ring] ? 'unknown ring' : ringLine(it)) : it.dmg ? it.dmg[0]+'&ndash;'+it.dmg[1]+' dmg' : it.armor!==undefined ? it.armor+' armor' : (it.note||'');
    h+='<div class="frow"><div class="ftext"><b>'+gearName(it)+'</b> <span class="c-info">('+o.where+')</span><div class="d">'+what+' &middot; now '+plus+'</div></div>'+
       '<button data-up="'+i+'" '+(cost===null||player.essence<cost?'disabled':'')+'>'+(cost===null?'max':(it.cursed?'Cleanse ':'Upgrade ')+cost)+'</button></div>';
  });
  return h;
}
/* off-hands gain a little per plus: shields block, orbs spell damage, tomes mana, holy symbols divine strength */
var _deriveUp = derive;
derive = function(p){
  _deriveUp(p);
  var o=p.off, pl=(o && !p.twoHanded && o!==EMPTY_OFF) ? (o.plus||0) : 0;
  if(pl){
    if(o.block>0) p.block=Math.min(0.6, p.block+0.03*pl);
    if(o.manaPct) p.maxmp=Math.round(p.maxmp*(1+0.05*pl));
  }
};
var _spellPowerUp = spellPower;
spellPower = function(A){ return _spellPowerUp(A); };   /* orb and staff levels now live in focusBonus (combat.js) */

/* ---------------------------------------------------------------- rings and amulets placed per floor */
var _generateUp = generate;
generate = function(seed){
  _generateUp(seed);
  var r=mulberry32(((seed||0) ^ 0x7a11)>>>0);
  function spot(){
    for(var t=0;t<200;t++){ var rm=rooms[Math.floor(r()*rooms.length)]; if(!rm || rm.role==='start') continue;
      var x=rm.x+Math.floor(r()*rm.w), y=rm.y+Math.floor(r()*rm.h); if(freeCell(x,y)) return {x:x,y:y}; }
    return null;
  }
  /* a fixed budget per biome: 2 rings and 1 amulet, on non-boss floors (the crystal vault and Wobbles can add more) */
  var biome=Math.floor((floorNo-1)/5), key='b'+biome;
  RUN.trinketPlan=RUN.trinketPlan||{};
  if(!RUN.trinketPlan[key]){
    var pr=mulberry32(((worldSeed||0) ^ (0x51ed+biome*977))>>>0), floors=[1,2,3,4].map(function(f){ return biome*5+f; });
    function pickF(){ return floors[Math.floor(pr()*floors.length)]; }
    RUN.trinketPlan[key]={rings:[pickF(), pickF()], amulets:[pickF()]};
  }
  var plan=RUN.trinketPlan[key];
  var nRings = plan.rings.filter(function(f){ return f===floorNo; }).length;
  var nAmulets = plan.amulets.filter(function(f){ return f===floorNo; }).length;
  var saveRng=rng; rng=r;
  for(var i=0;i<nRings;i++){ var s=spot(); if(s) items.push({kind:'ring', it:makeRing(null, r()<0.15), x:s.x, y:s.y}); }
  for(var j=0;j<nAmulets;j++){ var s2=spot(); if(s2) items.push({kind:'amulet', it:makeAmulet(null, r()<0.15), x:s2.x, y:s2.y}); }
  rng=saveRng;
};
/* and no longer in the general loot pool */
var _randomGearUp = randomGear;
randomGear = function(){
  for(var t=0;t<20;t++){ var g=_randomGearUp(); if(g.kind!=='ring' && g.kind!=='amulet') return g; }
  return _randomGearBase();
};
