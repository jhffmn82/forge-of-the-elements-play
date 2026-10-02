/* =====================================================================
   floors.js - stairs back up (2026-09-17).
   Every floor after the first has stairs up where you arrive. Leaving a floor keeps it exactly as you
   left it (map, monsters, loot, what you've explored), so you can climb back to a Forge or shrine and
   come down again to the same place. Floors are kept in RUN.floorStash, so saves carry them too.
   ===================================================================== */

var UPSTAIRS = 19;
var FLOOR_KEYS = FoteTransitions.floorKeys;

// Portals are placed after traps, so clear every trap on a travel tile.
// Pits and teleport runes also cannot displace the player from a narrow
// approach. Follow those passages into the room, including their mouth.
// Derive this from terrain so old saves and later-carved arrival stairs agree.
function repairStairApproachTraps(){
  if(!feats.length)return false;
  var travelTiles=new Set(),protectedTiles=new Set(),directions=[[1,0],[-1,0],[0,1],[0,-1]];
  function open(x,y){
    if(!inb(x,y))return false;
    var t=at(x,y),p=propAt(x,y);
    return !(p&&p.b)&&(walkable(x,y)||isDoorish(t)||t===STAIRS||t===UPSTAIRS||t===EXIT||t===PORTAL);
  }
  function neighbors(x,y){return directions.map(function(d){return{x:x+d[0],y:y+d[1]};}).filter(function(p){return open(p.x,p.y);});}
  for(var i=0;i<map.length;i++){
    if(map[i]!==STAIRS&&map[i]!==UPSTAIRS&&map[i]!==EXIT&&map[i]!==PORTAL)continue;
    travelTiles.add(i);protectedTiles.add(i);
    var pending=neighbors(i%MW,Math.floor(i/MW)),visited=new Set([i]);
    while(pending.length){
      var cell=pending.pop(),index=idxOf(cell.x,cell.y);
      if(visited.has(index))continue;
      visited.add(index);protectedTiles.add(index);
      var next=neighbors(cell.x,cell.y);
      if(next.length<=2)Array.prototype.push.apply(pending,next);
    }
  }
  var before=feats.length;
  feats=feats.filter(function(f){
    var index=idxOf(f.x,f.y);
    var room=roomAt(f.x,f.y);if(room&&room.trapBypass&&room.trapBypass.indexOf(index)>=0)return false;
    return !travelTiles.has(index)&&(!(f.kind==='teleport'||f.kind==='pit')||!protectedTiles.has(index));
  });
  // A junction ends the local passage walk, but several displacing traps can
  // still seal all routes beyond it. Preserve one route from arrival to each
  // exit, clearing the fewest pits/runes rather than emptying the room.
  if(typeof player!=='undefined'&&player&&inb(player.x,player.y)){
    var danger=new Set(feats.filter(function(f){return f.kind==='pit'||f.kind==='teleport';}).map(function(f){return idxOf(f.x,f.y);}));
    if(danger.size){
      var cost=new Int32Array(map.length).fill(2147483647),parent=new Int32Array(map.length).fill(-1);
      var origin=idxOf(player.x,player.y),queue=[origin];cost[origin]=0;
      for(var head=0;head<queue.length;head++){
        var here=queue[head],x=here%MW,y=Math.floor(here/MW);
        directions.map(function(d){return{x:x+d[0],y:y+d[1]};}).filter(function(cell){
          if(open(cell.x,cell.y))return true;
          if(!inb(cell.x,cell.y)||typeof terrainRules==='undefined')return false;
          var p=propAt(cell.x,cell.y);
          var t=at(cell.x,cell.y),room=typeof rooms!=='undefined'&&rooms.find(function(r){return r.puzzle&&cell.x>=r.x&&cell.x<r.x+r.w&&cell.y>=r.y&&cell.y<r.y+r.h;});
          var solvedPath=t===CHASM&&room&&room.puzzle.kind==='chasm';
          return !(p&&p.b&&!p.br&&!p.hoard)&&(terrainRules.walkable(t,false,true)||isDoorish(t)||[CHEST,FORGE,SHRINE,EXIT,STAIRS,UPSTAIRS,PORTAL].includes(t)||solvedPath);
        }).forEach(function(cell){
          var next=idxOf(cell.x,cell.y),score=cost[here]+(danger.has(next)?1:0);
          if(score>=cost[next])return;
          cost[next]=score;parent[next]=here;queue.push(next);
        });
      }
      var clear=new Set();
      travelTiles.forEach(function(target){
        if(cost[target]===2147483647||cost[target]===0)return;
        for(var step=target;step!==origin&&step>=0;step=parent[step])if(danger.has(step))clear.add(step);
      });
      feats=feats.filter(function(f){return !(f.kind==='pit'||f.kind==='teleport')||!clear.has(idxOf(f.x,f.y));});
    }
  }
  return feats.length!==before;
}

/* the tile behaves like stairs everywhere else in the code */


function presentRestoredFloor(at){
  if(typeof repairWallMemorials==='function')repairWallMemorials();
  if(typeof repairDeadEndDoors==='function')repairDeadEndDoors();
  repairCryptPuzzleGuardians();
  repairCrystalVaultClaims();
  repairStairApproachTraps();
  if(floorMeta && floorMeta.shrineGod) RUN.shrineGod=floorMeta.shrineGod;
  if(typeof repairCoreProgress==='function')repairCoreProgress();
  if(typeof refreshCavernResidents==='function')refreshCavernResidents();
  if(typeof refreshEncounterTuning==='function')refreshEncounterTuning();
  if(typeof SURF_CACHE!=='undefined') SURF_CACHE.key=null;
  ents.forEach(function(e){if(e!==player)gameEffects.repairClock(e,player.t);});
  fx=[]; PARTS.length=0; aiming=null;
  var spot = at && walkable(at.x,at.y) && !ents.some(function(e){ return e!==player && e.x===at.x && e.y===at.y; }) ? at : (at ? nearFree(at.x,at.y,3) : null);
  if(spot){ player.x=spot.x; player.y=spot.y; }
  player._lx=undefined;arriveRarePet();
  if(typeof FoteShadowClone!=='undefined')FoteShadowClone.arrive();
  if(typeof syncMurkSummons==='function')syncMurkSummons();
  if(typeof repairBossCore==='function')repairBossCore();
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
  repairStairApproachTraps();
  computeFOV();items=items.filter(function(it){return !(it.x===player.x&&it.y===player.y);});draw();
}
function findTileIn(stash, t){ var m=stash.map,w=FoteState.dimensions(stash).width; for(var i=0;i<m.length;i++) if(m[i]===t) return {x:i%w, y:(i/w)|0}; return null; }

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
function entryUpstairsHint(){ if(at(player.x,player.y)===UPSTAIRS&&!(typeof FoteChaosCampaign!=='undefined'&&FoteChaosCampaign.entryHint())) log('Up to floor '+(floorNo-1)+': '+(document.body.classList.contains('touch') ? 'tap stairs.' : '<b>&lt;</b> or click.'),'c-kill');  }
