/* =====================================================================
   floors.js - stairs back up (2026-09-17).
   Every floor after the first has stairs up where you arrive. Leaving a floor keeps it exactly as you
   left it (map, monsters, loot, what you've explored), so you can climb back to a Forge or shrine and
   come down again to the same place. Floors are kept in RUN.floorStash, so saves carry them too.
   ===================================================================== */

var UPSTAIRS = 19;
var FLOOR_KEYS = ['map','seen','vis','feats','items','ents','rooms','ground','fireT','fireSrc','props','propGrid','chestKind','floorMeta',
  'levers','plates','altars','iceG','rootG','holyG','spawnedExtra','nextSpawn','worldSeed'];

/* the tile behaves like stairs everywhere else in the code */
var _walkableUp = walkable;
walkable = function(x,y){ return at(x,y)===UPSTAIRS || _walkableUp(x,y); };
var _objectTileUp = objectTile;
objectTile = function(t){ return t===UPSTAIRS || _objectTileUp(t); };
var _tileSpriteUp = tileSprite;
tileSprite = function(x,y,t){ return t===UPSTAIRS ? (objArt('structures','stairs-up') || objArt('structures','stairs-down')) : _tileSpriteUp(x,y,t); };

function stashFloor(){
  if(!RUN) return;
  if(!RUN.floorStash) RUN.floorStash={};
  var s={};
  FLOOR_KEYS.forEach(function(k){ s[k]=window[k]; });
  s.ents = ents.filter(function(e){ return e!==player && !e.ally; });   /* allies stay behind as before: freed prisoners leave with the floor */
  s.keys = player.keys ? {iron:player.keys.iron||0, crystal:player.keys.crystal||0} : {iron:0, crystal:0};
  s.turn = turn;
  RUN.floorStash[floorNo]=s;
}
function restoreFloor(n, at){
  var s=RUN.floorStash[n]; if(!s) return false;
  FLOOR_KEYS.forEach(function(k){ if(s[k]!==undefined) window[k]=s[k]; });
  if(typeof repairWallMemorials==='function')repairWallMemorials();
  ents = s.ents.concat([player]);
  player.keys = {iron:s.keys.iron, crystal:s.keys.crystal};
  delete RUN.floorStash[n];
  if(floorMeta && floorMeta.shrineGod) RUN.shrineGod=floorMeta.shrineGod;
  floorNo = n;
  if(typeof repairCoreProgress==='function')repairCoreProgress();
  if(typeof refreshCavernResidents==='function')refreshCavernResidents();
  if(typeof refreshEncounterTuning==='function')refreshEncounterTuning();
  if(typeof SURF_CACHE!=='undefined') SURF_CACHE.key=null;
  ents.forEach(function(e){ e._lx=undefined; e._ly=undefined; e.t=player.t; });
  fx=[]; PARTS.length=0; aiming=null;
  var spot = at && walkable(at.x,at.y) && !ents.some(function(e){ return e!==player && e.x===at.x && e.y===at.y; }) ? at : (at ? nearFree(at.x,at.y,3) : null);
  if(spot){ player.x=spot.x; player.y=spot.y; }
  player._lx=undefined;
  computeFOV(); resize(); updateUI(); draw();
  return true;
}
function findTile(t){ for(var i=0;i<map.length;i++) if(map[i]===t) return {x:i%MW, y:(i/MW)|0}; return null; }

var _descendUp = descend;
descend = function(fell){
  if(!RUN || floorNo>=LAST_FLOOR && !(RUN.floorStash && RUN.floorStash[floorNo+1])) return _descendUp(fell);
  var target=floorNo+1;
  if(RUN.floorStash && RUN.floorStash[target]){
    stashFloor();
    if(!fell) sfx('stairs');
    player.levitate=0;
    var up=RUN.floorStash[target].floorMeta && RUN.floorStash[target].floorMeta.upAt;
    restoreFloor(target, up);
    log('You climb back down to <b>floor '+floorNo+'</b>. It is as you left it.','c-kill');
    playSceneMusic();
    return;
  }
  stashFloor();
  var r=_descendUp(fell);
  /* a fresh floor: stairs back up where you arrive */
  if(floorNo>1 && floorMeta && !floorMeta.upAt){
    var startRoom=rooms.filter(function(r){ return r.role==='start'; })[0], hall=floorNo>5 && startRoom && carveDeadEnd(startRoom);   /* hallway stairs from biome 2 on */
    if(!hall && startRoom && floorNo>5){   /* the start room is boxed in: use the nearest other room */
      var near=rooms.filter(function(r){ return r!==startRoom && !r.pocket && r.role!=='boss' && r.role!=='stairs'; }).sort(function(a,b){ return (Math.abs(a.cx-startRoom.cx)+Math.abs(a.cy-startRoom.cy))-(Math.abs(b.cx-startRoom.cx)+Math.abs(b.cy-startRoom.cy)); });
      for(var ni=0;ni<near.length && !hall && ni<4;ni++) hall=carveDeadEnd(near[ni]);
    }
    if(hall){ player.x=hall.x; player.y=hall.y; player._lx=undefined; if(typeof SURF_CACHE!=='undefined') SURF_CACHE.key=null; }
    setT(player.x, player.y, UPSTAIRS); floorMeta.upAt={x:player.x, y:player.y};
    computeFOV();
    items=items.filter(function(it){ return !(it.x===player.x && it.y===player.y); });
    draw();
  }
  return r;
};
function ascend(){
  if(at(player.x,player.y)!==UPSTAIRS){ log('No stairs up here.','c-info'); return; }
  if(!RUN.floorStash || !RUN.floorStash[floorNo-1]){ log('The way up has collapsed.','c-info'); return; }
  stashFloor();
  sfx('stairs'); player.levitate=0;
  var target=floorNo-1, down=findTileIn(RUN.floorStash[target], STAIRS) || findTileIn(RUN.floorStash[target], EXIT);   /* a boss floor's way down is its gate */
  restoreFloor(target, down);
  log('You climb back up to <b>floor '+floorNo+'</b>. It is as you left it.','c-kill');
  if(floorMeta.forge) log('The Elemental Forge still burns on this floor.','c-info');
  playSceneMusic();
  if(typeof writeSlot==='function' && !RUN.over) writeSlot('auto', 'floor '+floorNo);
}
function findTileIn(stash, t){ var m=stash.map; for(var i=0;i<m.length;i++) if(m[i]===t) return {x:i%MW, y:(i/MW)|0}; return null; }

/* stepping on it, the key, the button */
var _stepOnFloors = stepOn;
stepOn = function(){ var r=_stepOnFloors(); if(at(player.x,player.y)===UPSTAIRS) log('Stairs up to floor '+(floorNo-1)+'. '+(document.body.classList.contains('touch') ? 'Tap them to climb.' : 'Press <b>&lt;</b> to climb.'),'c-kill'); return r; };
window.addEventListener('keydown', function(ev){
  var tgt=ev.target && ev.target.tagName; if(tgt==='INPUT'||tgt==='SELECT'||tgt==='TEXTAREA') return;
  if(ev.key!=='<' || !player || player.hp<=0 || (typeof uiOpen==='function' && uiOpen())) return;
  ev.preventDefault(); ascend();
});

/* light and the map overlay */
var _gatherLightsUp = gatherLights;
gatherLights = function(now, prp){
  var L=_gatherLightsUp(now, prp), u=floorMeta && floorMeta.upAt;
  if(u && at(u.x,u.y)===UPSTAIRS && (revealAll||seen[idxOf(u.x,u.y)])) L.push({x:u.x, y:u.y, c:hexRGB('#9FD8FF'), r:3.2, s:0.7, tx:u.x, ty:u.y});
  return L;
};
