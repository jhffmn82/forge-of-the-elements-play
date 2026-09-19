/* =====================================================================
   searchfx.js - searching looks like searching (2026-09-17).
   Pressing Search used to spend a turn and print a line, with nothing on screen: you could not tell it had
   happened, nor how far it reached. Now the character sweeps the 5x5 he actually checks - a ring that opens
   out to the edge of that square, a few motes of dust lifting off the floor, and a brief glint on each tile
   as it is looked over. Anything found gets its own ping on top of the usual log line.
   ===================================================================== */

/* the sweep: a ring at the search radius, dust at the player's feet, and glints walking outward */
function searchSweepFx(quiet){
  if(typeof ANIM!=='undefined' && ANIM.reduce) return;
  var x=player.x, y=player.y;
  /* the d-pad's wait searches too (touchui.js, quiet), so every waited turn would flash the full sweep:
     that one gets a single faint ring and nothing else (2026-09-18) */
  if(quiet){ if(typeof ringFx==='function') ringFx(x, y, '#E8D9A8', 2.4, {a:0.22, w:1.5, dur:600}); return; }
  if(typeof ringFx==='function') ringFx(x, y, '#E8D9A8', 2.6);
  if(typeof burst==='function') burst(x, y, 'magic', 8, 0.02);
  /* a glint on each ring of tiles, the near ones first, so the sweep reads as moving outward */
  for(var d=1; d<=2; d++){
    (function(ring){
      setTimeout(function(){
        if(!player || player.hp<=0) return;
        for(var dy=-ring; dy<=ring; dy++) for(var dx=-ring; dx<=ring; dx++){
          if(Math.max(Math.abs(dx), Math.abs(dy))!==ring) continue;
          var tx=x+dx, ty=y+dy;
          if(!inb(tx,ty) || !(revealAll || vis[idxOf(tx,ty)])) continue;
          if(isWallLike(at(tx,ty)) && at(tx,ty)!==SECRET) continue;
          if(typeof sparkleFx==='function' && Math.random()<0.55) sparkleFx(tx, ty, 'light', 2);
        }
        if(typeof draw==='function') draw();
      }, ring*110);
    })(d);
  }
}

/* wrap the search itself: sweep first, then let it resolve, and ping whatever turns up */
if(typeof searchAround==='function'){
  var _searchAroundFx = searchAround;
  searchAround = function(resting, quiet){
    var before = (typeof feats!=='undefined') ? feats.filter(function(f){ return f.found; }).length : 0;
    var secretsBefore = 0, i;
    if(typeof map!=='undefined') for(i=0;i<map.length;i++) if(map[i]===SECRET) secretsBefore++;

    if(!resting) searchSweepFx(quiet);   /* no new sound: there is no search sample, and the finds have their own */

    var r = _searchAroundFx(resting, quiet);

    /* a found trap or door gets a ring of its own, so the eye goes straight to it */
    if(typeof feats!=='undefined'){
      feats.forEach(function(f){
        if(f.found && !f._pinged && Math.max(Math.abs(f.x-player.x), Math.abs(f.y-player.y))<=2){
          f._pinged = true;
          if(typeof ringFx==='function') ringFx(f.x, f.y, '#E2622B', 1.2);
          if(typeof sparkleFx==='function') sparkleFx(f.x, f.y, 'fire', 10);
        }
      });
    }
    var secretsAfter = 0;
    if(typeof map!=='undefined') for(i=0;i<map.length;i++) if(map[i]===SECRET) secretsAfter++;
    if(secretsAfter < secretsBefore && typeof ringFx==='function'){
      /* the door that just appeared is the nearest DOOR tile inside the searched square */
      for(var dy=-2; dy<=2; dy++) for(var dx=-2; dx<=2; dx++){
        var tx=player.x+dx, ty=player.y+dy;
        if(inb(tx,ty) && at(tx,ty)===DOOR){ ringFx(tx, ty, '#FFE08A', 1.4); break; }
      }
    }
    return r;
  };
}
