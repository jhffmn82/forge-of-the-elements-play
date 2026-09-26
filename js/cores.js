/* =====================================================================
   cores.js - boss cores (2026-09-17).
   A biome's boss drops its core (the Dungeon Core in biome 1). The exit gate stays sealed until you
   bring the core to it. Picking up each core raises your affinity cap permanently;
   the gate consumes the carried core only to open the way onward.
   ===================================================================== */

var CORE_NAMES = ['Dungeon Core', 'Crypt Core', 'Cavern Core', 'Ruin Core', 'Abyss Core'];
function coreName(){ return CORE_NAMES[Math.min(CORE_NAMES.length-1, Math.floor((floorNo-1)/5))]; }

/* The cap counts claimed cores; old absorbed-core counts seed the name ledger. */
affinityCap = function(){
  if(RUN && RUN.cores===undefined) RUN.cores = RUN.bossDead && floorMeta && floorMeta.exitOpen ? 1 : 0;
  return 1 + (RUN ? RUN.cores : 0) + ((RACES[player.race]||{}).capBonus||0);
};

function coreClaims(){
  if(!Array.isArray(RUN.coreClaims))RUN.coreClaims=CORE_NAMES.slice(0,Math.max(0,RUN.cores||0));
  return RUN.coreClaims;
}
function claimCore(name,announce){
  if(!RUN||CORE_NAMES.indexOf(name)<0)return false;
  var claims=coreClaims();if(claims.indexOf(name)>=0)return false;
  claims.push(name);RUN.cores=(RUN.cores||0)+1;
  if(announce)log('<b>Your affinity cap rises to '+affinityCap()+'.</b> One more element can take root in you.','c-kill');
  return true;
}

/* Old saves may have crossed completed biome gates before cores were tracked.
   Loading claims carried cores but never consumes them: an earlier floor's open
   gate must not take a later core while the player backtracks to a forge. */
function repairCoreProgress(){
  if(!RUN || !player) return false;
  var changed=false,legacy=!Array.isArray(RUN.coreClaims),completedBefore=Math.max(0,Math.min(4,Math.floor((floorNo-1)/5)));
  if(legacy&&(RUN.cores||0)<completedBefore){RUN.cores=completedBefore;changed=true;}
  coreClaims();
  if(player.core&&claimCore(player.core,false))changed=true;
  return changed;
}

/* Important drops must stay on the player's side of walls and locked gates.
   Ordinary nearFree() only checks distance; it can choose another room through
   a wall when a boss has been pulled into a corridor. */
function coreReachableTiles(){
  var reachable=new Set(),queue=[{x:player.x,y:player.y}];
  reachable.add(player.x+','+player.y);
  for(var i=0;i<queue.length;i++)for(var dy=-1;dy<=1;dy++)for(var dx=-1;dx<=1;dx++){
    if(!dx&&!dy)continue;
    var x=queue[i].x+dx,y=queue[i].y+dy,key=x+','+y;
    if(!inb(x,y)||reachable.has(key))continue;
    var tile=at(x,y),prop=propAt(x,y);
    if(!walkable(x,y)&&!(tile===DOOR&&!(prop&&prop.b)))continue;
    reachable.add(key);queue.push({x:x,y:y});
  }
  return reachable;
}
function coreDropSpot(origin,reachable){
  reachable=reachable||coreReachableTiles();origin=origin||player;
  var best=null,bestScore=Infinity;
  reachable.forEach(function(key){
    var xy=key.split(','),x=Number(xy[0]),y=Number(xy[1]);
    if(at(x,y)!==FLOOR||!walkable(x,y)||occupied(x,y)||itemAt(x,y)||propAt(x,y))return;
    var score=Math.max(Math.abs(x-origin.x),Math.abs(y-origin.y))*100+Math.abs(x-player.x)+Math.abs(y-player.y);
    if(score<bestScore){bestScore=score;best={x:x,y:y};}
  });
  /* A completely crowded room still has the player's reachable tile. */
  return best||{x:player.x,y:player.y};
}
function dropBossCore(origin){
  var name=coreName();
  if(player.core===name)return null;
  var existing=items.find(function(it){return it.kind==='core'&&it.name===name;});
  if(existing)return existing;
  var spot=coreDropSpot(origin),core={x:spot.x,y:spot.y,kind:'core',name:name};
  items.push(core);return core;
}
function repairBossCore(){
  if(!RUN||!player||!floorMeta||floorMeta.plane||floorNo<5||floorNo>20||floorNo%5!==0||floorMeta.exitOpen)return false;
  /* RUN.bossDead refers to earlier floors too. Require this floor's evidence. */
  var defeated=floorMeta.bossRewarded||floorNo===15&&(floorMeta.caveWon||floorMeta.maw&&floorMeta.maw.phase==='dead')||floorNo===20&&floorMeta.matron&&floorMeta.matron.phase==='dead';
  if(!defeated||ents.some(function(e){return e.foe&&e.hp>0&&e.base&&e.base.boss;}))return false;
  var name=coreName();if(player.core===name)return false;
  var core=items.find(function(it){return it.kind==='core'&&it.name===name;});
  if(!core){dropBossCore(player);return true;}
  var reachable=coreReachableTiles(),prop=propAt(core.x,core.y);
  if(reachable.has(core.x+','+core.y)&&walkable(core.x,core.y)&&!(prop&&prop.b))return false;
  var spot=coreDropSpot(player,reachable);core.x=spot.x;core.y=spot.y;return true;
}

function absorbCoreAtGate(nx, ny){
  var name=player.core;
  if(!name||floorNo%5!==0||floorMeta.plane||name!==coreName())return false;
  claimCore(name,true); // Supports legacy carried cores before the load migration.
  player.core=null; floorMeta.exitOpen=true;
  log('You press the <b>'+name+'</b> into the gate. It drinks the light, and the gate grinds open.','c-kill');
  sfx('victory'); if(typeof ringFx==='function') ringFx(nx,ny,'#9FD8FF',4); sparkleFx(nx,ny,'light',60);
  computeFOV(); updateUI(); draw(); return true;
}


/* picking it up */


var _itemArtNameCore = itemArtName;
itemArtName = function(it){ return it && it.kind==='core' ? (it.name==='Crypt Core' ? 'item-core-crypt' : 'item-core-dungeon') : _itemArtNameCore(it); };
ITEM_FIT.core = 0.52;

/* the sealed gate takes the core */


/* a line in the Equipment keys list while you carry one */
var _equipHTMLCore = equipHTML;
equipHTML = function(){
  var h=_equipHTMLCore();
  if(!player.core) return h;
  var chip='<span class="mote keychip"><span class="kart" data-kicon="item-core-dungeon"></span>'+player.core+'</span>';
  return h.replace(/(<div class="sec">Keys<\/div><div class="pouch">)(<span class="mote">no keys[^<]*<\/span>)?/, '$1'+chip);
};

/* Named travel and entry stages; ordered by transition-adapter.js. */
function entryCollectCores(){
  var here = items.filter(function(it){ return it.kind==='core' && it.x===player.x && it.y===player.y; });
  here.forEach(function(it){
    removeItem(it); player.core = it.name;
    log('You take up the <b>'+it.name+'</b>. It hums against your ribs. Bring it to the exit gate.','c-kill');
    claimCore(it.name,true);
    sfx('pickup-mote'); sparkleFx(player.x, player.y, 'magic', 30);
  });
}

function moveCoreGate(dx,dy){
  var nx=player.x+dx, ny=player.y+dy;
  if(at(nx,ny)===EXIT && player.core){
    var wasOpen=!!floorMeta.exitOpen;
    if(!absorbCoreAtGate(nx,ny)){
      if(wasOpen)return false;
      log('This gate does not answer to the core you carry.','c-info');sfx('door-locked');return true;
    }
    if(!wasOpen){ endTurn(); return true; }
    /* An already-open burrow absorbs the core and continues downstairs. */
  } else if(at(nx,ny)===EXIT && !floorMeta.exitOpen){
    log('The gate is sealed. It waits for the heart its guardian carried.','c-info'); sfx('door-locked'); return true;
  }
  return false;
}
