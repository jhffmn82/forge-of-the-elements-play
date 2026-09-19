/* cavefixes.js - three rough edges of the Caverns, fixed after the merge (2026-09-19).
   1. Tall scenery (a stalagmite rising two tiles over its one-tile footprint) was drawn before the creatures, so
      one standing just behind it drew over its top. After the creatures are drawn, a tall piece with somebody
      behind it is drawn again, so it hides them the way it should.
   2. The Deep Maw's death won the run 1.5 seconds later, before the loot it dropped could be picked up. Its
      burrow now opens as the way out: walk into it to leave the Caverns.
   3. Four creatures' generated death clips mostly darkened instead of falling, and three attack clips drifted
      dark in their last frames. The death clips give way to the game's own topple-and-fade, and the attack
      clips stop before the drift. */

/* ---------------------------------------------------------------- 1. occlusion */
function drawOccluders(now){
  if(typeof props==='undefined' || !props.length || typeof caveArt!=='function') return;
  var bodies=ents.filter(function(e){ return e!==player && e.hp>0 && (revealAll || vis[idxOf(e.x,e.y)]); });
  if(player && player.hp>0) bodies.push(player);
  if(!bodies.length) return;
  props.forEach(function(p){
    if(p.flat || !(revealAll||seen[idxOf(p.x,p.y)])) return;
    var o=caveArt(p.name); if(!o) return;
    var w=p.w||1, h=p.h||1, rise=Math.ceil(o.fullH/64) - h;   /* rows the art stands above its footprint */
    if(rise<1) return;
    var base=p.y+h-1;
    var hit=bodies.some(function(e){ var rp=renderPos(e); return rp.x>p.x-0.8 && rp.x<p.x+w-0.2 && rp.y<p.y-0.05 && rp.y>=p.y-rise-0.5; });
    if(!hit) return;
    var pa=(revealAll||vis[idxOf(p.x,base)])?1:0.45;
    drawPropSurface(p, (p.x-camX)*TS, (p.y-camY)*TS, pa);
  });
}

/* ---------------------------------------------------------------- 2. the Maw's burrow is the way out */
if(typeof caveBossDown==='function'){
  caveBossDown = function(){
    if(!RUN || RUN.victory || RUN.over || !floorMeta || floorMeta.caveWon) return;
    floorMeta.caveWon=true; RUN.bossDead=true;
    var A=floorMeta.bossArena, spot=null;
    if(A){ var c={x:A.x+Math.floor(A.w/2), y:A.y+Math.floor(A.h/2)}; spot=(walkable(c.x,c.y) && !occupied(c.x,c.y)) ? c : nearFree(c.x,c.y,6); }
    if(!spot) spot=nearFree(player.x,player.y,4);
    if(spot){ setT(spot.x, spot.y, EXIT); floorMeta.exitOpen=true; floorMeta.caveExit=spot; if(typeof sparkleFx==='function') sparkleFx(spot.x,spot.y,'earth',30); }
    log('<b>The Deep Maw is dead.</b> Its burrow gapes open: the way up and out of the Caverns. Gather what it left, then step in.','c-kill');
    if(!spot) setTimeout(function(){ if(RUN && !RUN.over && !RUN.victory) victory(); }, 1500);   /* nowhere to put it: win as before */
    if(typeof draw==='function') draw();
  };
}
/* the exit on floor 15 is the Maw's open burrow, not the Dungeon's gate */
var _tileSpriteCaveExit = tileSprite;
tileSprite = function(x,y,t){
  if(t===EXIT && floorMeta && floorMeta.caveExit && typeof caveArt==='function'){ var o=caveArt('worm-burrow-open'); if(o) return o; }
  return _tileSpriteCaveExit(x,y,t);
};

/* ---------------------------------------------------------------- 3. weak clips */
var CAVE_TOPPLE = {'m-storm-beetle':1, 'm-crystal-crawler':1, 'm-shock-eel':1, 'm-myconid':1};
var CAVE_ATTACK_TRIM = {'m-storm-beetle':6, 'm-spark-jelly':6, 'm-crystal-crawler':6};
(function trimClips(){
  if(!(typeof AS!=='undefined' && AS && AS.mobs)){ setTimeout(trimClips, 200); return; }
  for(var k in CAVE_ATTACK_TRIM){ var m=AS.mobs[k]; if(m && m.clips.attack) m.clips.attack.frames=Math.min(m.clips.attack.frames, CAVE_ATTACK_TRIM[k]); }
})();
var _drawCorpseCave = drawCorpse;
drawCorpse = function(f, p){
  var m = f && f.e && f.e.sprite && CAVE_TOPPLE[f.e.sprite] && AS.mobs ? AS.mobs[f.e.sprite] : null;
  if(m && m.clips.death){ var d=m.clips.death; delete m.clips.death; try { return _drawCorpseCave(f, p); } finally { m.clips.death=d; } }
  return _drawCorpseCave(f, p);
};

/* ---------------------------------------------------------------- 4. standing pieces sit on the ground
   The delivered canvases leave 7-20 empty pixels under some pieces (giant mushrooms, pylons, the pool, burrows,
   the mine support), and the canvas bottom is what stood on the floor - so the art hovered over its own shadow.
   Standing pieces are now set down by the art's own solid bottom. */
var CAVE_STANDING = /^(giant-mushroom|mushroom-pair|pylon|geode|glowing-pool|worm-burrow|mine-support|mine-cart|stalagmite)/;
var CAVE_PAD = {};
function caveBottomPad(o){
  if(CAVE_PAD[o.nm]!==undefined) return CAVE_PAD[o.nm];
  var pad=0;
  try{
    var c=document.createElement('canvas'); c.width=o.sw; c.height=o.sh; var g=c.getContext('2d');
    g.drawImage(o.img, o.sx, o.sy, o.sw, o.sh, 0, 0, o.sw, o.sh);
    var D=g.getImageData(0,0,o.sw,o.sh).data, lowest=-1;
    for(var y=o.sh-1; y>=0 && lowest<0; y--) for(var x=0;x<o.sw;x++) if(D[(y*o.sw+x)*4+3]>=140){ lowest=y; break; }
    pad = (o.fullH - (o.oy + lowest + 1));        /* empty rows under the solid art, in canvas pixels */
  }catch(e){ pad=0; }
  return (CAVE_PAD[o.nm]=Math.max(0, pad-1));
}
var _drawCaveArtStand = drawCaveArt;
drawCaveArt = function(o, cx, bottom, alpha, flipX){
  if(o && o.nm && CAVE_STANDING.test(o.nm)) bottom += caveBottomPad(o)*TS/64;
  return _drawCaveArtStand(o, cx, bottom, alpha, flipX);
};

/* ---------------------------------------------------------------- 5. the Caverns were too bright
   Every glowing mushroom, crystal, pool and glowworm adds a light of its own on top of the hero's, and they
   overlapped into a wash. In the Caverns the scenery lights burn at 55% strength and 85% reach; the hero's own
   light (always the first in the list) is left alone. */
var _gatherLightsCave = gatherLights;
gatherLights = function(now, prp){
  var L=_gatherLightsCave.apply(this, arguments);
  if(typeof inCaverns==='function' && inCaverns() && L && L.length) for(var i=1;i<L.length;i++){ L[i].s*=0.55; L[i].r*=0.85; }
  return L;
};

/* ---------------------------------------------------------------- 6. no lone moss
   Glow moss only reads as moss in a streak; a single tuft (a streak that could not grow, or a Dungeon vine
   converted on the way in) is taken out after the floor is built. */
var _generateMossFix = generate;
generate = function(seed){
  var r=_generateMossFix.apply(this, arguments);
  if(typeof inCaverns==='function' && inCaverns() && typeof props!=='undefined'){
    var moss=props.filter(function(p){ return /^cl-glow-moss/.test(p.name); });
    var lone=moss.filter(function(p){ return !moss.some(function(q){ return q!==p && Math.abs(q.x-p.x)+Math.abs(q.y-p.y)===1; }); });
    if(lone.length){ props=props.filter(function(p){ return lone.indexOf(p)<0; }); if(typeof rebuildPropGrid==='function') rebuildPropGrid(); }
  }
  return r;
};
