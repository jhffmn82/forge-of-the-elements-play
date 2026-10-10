/* =====================================================================
   searchfx.js - searching looks like searching (2026-09-17).
   Pressing Search used to spend a turn and print a line, with nothing on screen: you could not tell it had
   happened, nor how far it reached. Now the character sweeps the 5x5 he actually checks - a ring that opens
   out to the edge of that square, a few motes of dust lifting off the floor, and a brief glint on each tile
   as it is looked over. Anything found gets its own ping on top of the usual log line.
   ===================================================================== */

/* 2026-09-28 (Justin): a spotted trap draws the eye. The chime used to ring with nothing on the map to say what
   it meant ("it sounds like an important SFX", a player review), so every way of finding a trap (spotting it in
   passing, searching, the Keen Eyes ring) rings its tile and lifts a "!" off it, starting with the chime. No
   rng() (the "!" skips floatText, whose jitter draws from it), no timers, and nothing under reduced motion,
   like the sweep below. */
function trapSpotFx(f){
  if(!f || (typeof ANIM!=='undefined' && ANIM.reduce) || typeof fx==='undefined') return;
  var t0=Math.max(performance.now(), typeof fxClock==='number' ? fxClock : 0);   /* when sfx() plays the chime */
  if(typeof ringFx==='function') ringFx(f.x, f.y, '#E2622B', 1.2, {at:t0});
  fx.push({k:'t', x:f.x, y:f.y, text:'!', col:'#E2622B', big:false, t0:t0, dur:760, jitter:0});
}

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
      FoteTransitions.deferScene(gameState,function(){
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

/* Search owns the action; presentation owns its completion markers. The
 * before/after count includes doors revealed by the action's world phase. */
function searchDoorFx(secretsBefore){
  var secretsAfter=map.reduce(function(n,tile){return n+(tile===SECRET?1:0);},0);
  if(secretsAfter>=secretsBefore)return;
  for(var dy=-2;dy<=2;dy++)for(var dx=-2;dx<=2;dx++){
    var tx=player.x+dx,ty=player.y+dy;
    if(inb(tx,ty)&&at(tx,ty)===DOOR){ringFx(tx,ty,'#FFE08A',1.4);break;}
  }
}
