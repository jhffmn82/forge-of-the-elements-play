/* =====================================================================
   floors.js - stairs back up (2026-09-17).
   Every floor after the first has stairs up where you arrive. Leaving a floor keeps it exactly as you
   left it (map, monsters, loot, what you've explored), so you can climb back to a Forge or shrine and
   come down again to the same place. Floors are kept in RUN.floorStash, so saves carry them too.
   ===================================================================== */

var UPSTAIRS = 19;
var FLOOR_KEYS = FoteTransitions.floorKeys;

/* the tile behaves like stairs everywhere else in the code */


function presentRestoredFloor(at){
  if(typeof repairWallMemorials==='function')repairWallMemorials();
  if(floorMeta && floorMeta.shrineGod) RUN.shrineGod=floorMeta.shrineGod;
  if(typeof repairCoreProgress==='function')repairCoreProgress();
  if(typeof refreshCavernResidents==='function')refreshCavernResidents();
  if(typeof refreshEncounterTuning==='function')refreshEncounterTuning();
  if(typeof SURF_CACHE!=='undefined') SURF_CACHE.key=null;
  ents.forEach(function(e){if(e!==player)gameEffects.repairClock(e,player.t);});
  fx=[]; PARTS.length=0; aiming=null;
  var spot = at && walkable(at.x,at.y) && !ents.some(function(e){ return e!==player && e.x===at.x && e.y===at.y; }) ? at : (at ? nearFree(at.x,at.y,3) : null);
  if(spot){ player.x=spot.x; player.y=spot.y; }
  player._lx=undefined;
  computeFOV(); resize(); updateUI(); draw();
}
function findTile(t){ for(var i=0;i<map.length;i++) if(map[i]===t) return {x:i%MW, y:(i/MW)|0}; return null; }


function placeArrivalStairs(){
  if(floorNo<=1||!floorMeta||floorMeta.upAt)return;
  var startRoom=rooms.filter(function(r){return r.role==='start';})[0],hall=floorNo>5&&startRoom&&carveDeadEnd(startRoom);
  if(!hall&&startRoom&&floorNo>5){
    var near=rooms.filter(function(r){return r!==startRoom&&!r.pocket&&r.role!=='boss'&&r.role!=='stairs';}).sort(function(a,b){return(Math.abs(a.cx-startRoom.cx)+Math.abs(a.cy-startRoom.cy))-(Math.abs(b.cx-startRoom.cx)+Math.abs(b.cy-startRoom.cy));});
    for(var ni=0;ni<near.length&&!hall&&ni<4;ni++)hall=carveDeadEnd(near[ni]);
  }
  if(hall){player.x=hall.x;player.y=hall.y;player._lx=undefined;if(typeof SURF_CACHE!=='undefined')SURF_CACHE.key=null;}
  setT(player.x,player.y,UPSTAIRS);floorMeta.upAt={x:player.x,y:player.y};
  computeFOV();items=items.filter(function(it){return !(it.x===player.x&&it.y===player.y);});draw();
}
function findTileIn(stash, t){ var m=stash.map; for(var i=0;i<m.length;i++) if(m[i]===t) return {x:i%MW, y:(i/MW)|0}; return null; }

/* stepping on it, the key, the button */


window.addEventListener('keydown', function(ev){
  var tgt=ev.target && ev.target.tagName; if(tgt==='INPUT'||tgt==='SELECT'||tgt==='TEXTAREA') return;
  if(ev.key!=='<' || !player || player.hp<=0 || (typeof uiOpen==='function' && uiOpen())) return;
  ev.preventDefault(); ascend();
});

/* light and the map overlay */

function addUpstairsLights(L, now, prp){
  var u=floorMeta && floorMeta.upAt;
  if(u && at(u.x,u.y)===UPSTAIRS && (revealAll||seen[idxOf(u.x,u.y)])) L.push({x:u.x, y:u.y, c:hexRGB('#9FD8FF'), r:3.2, s:0.7, tx:u.x, ty:u.y});
  return L;

}

/* Named travel and entry stages; ordered by transition-adapter.js. */
function entryUpstairsHint(){ if(at(player.x,player.y)===UPSTAIRS) log('Stairs up to floor '+(floorNo-1)+'. '+(document.body.classList.contains('touch') ? 'Tap them to climb.' : 'Press <b>&lt;</b> to climb.'),'c-kill');  }
