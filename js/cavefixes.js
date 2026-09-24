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


/* ---------------------------------------------------------------- 2. the Maw's burrow is the way out */

/* the exit on floor 15 is the Maw's open burrow, not the Dungeon's gate */


/* ---------------------------------------------------------------- 3. weak clips */
var CAVE_TOPPLE = {'m-storm-beetle':1, 'm-crystal-crawler':1, 'm-shock-eel':1, 'm-myconid':1};
var CAVE_ATTACK_TRIM = {'m-storm-beetle':6, 'm-spark-jelly':6, 'm-crystal-crawler':6};
(function trimClips(){
  if(!(typeof AS!=='undefined' && AS && AS.mobs)){ setTimeout(trimClips, 200); return; }
  for(var k in CAVE_ATTACK_TRIM){ var m=AS.mobs[k]; if(m && m.clips.attack) m.clips.attack.frames=Math.min(m.clips.attack.frames, CAVE_ATTACK_TRIM[k]); }
})();


/* ---------------------------------------------------------------- 4. standing pieces sit on the ground
   The delivered canvases leave 7-20 empty pixels under some pieces (giant mushrooms, pylons, the pool, burrows,
   the mine support), and the canvas bottom is what stood on the floor - so the art hovered over its own shadow.
   Standing pieces are now set down by the art's own solid bottom. */
var CAVE_STANDING = /^(giant-mushroom|mushroom-pair|pylon|geode|glowing-pool|worm-burrow|mine-support|mine-cart|stalagmite|kobold-)/;
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


/* ---------------------------------------------------------------- 5. the Caverns were too bright
   Every glowing mushroom, crystal, pool and glowworm adds a light of its own on top of the hero's, and they
   overlapped into a wash. In the Caverns the scenery lights burn at 55% strength and 85% reach; the hero's own
   light (always the first in the list) is left alone. */

function shadeCavernLights(L, now, prp){
  if(typeof inCaverns==='function' && inCaverns() && L && L.length) for(var i=1;i<L.length;i++){
    /* 2026-09-22 (Justin): "the light sources in the caverns are too bright". A later pass had turned the scenery
       lights UP (x1.35 strength, x1.25 reach) and the crystals washed whole chambers to grey. Back to the intent
       above: scenery burns at 55% strength and 85% reach; a light carried at the hero's feet is left alone. */
    var emitted=L[i].em || !(L[i].x===prp.x && L[i].y===prp.y);
    if(emitted){ L[i].s*=0.55; L[i].r*=0.85; }
  }
  return L;

}

/* ---------------------------------------------------------------- 6. no lone moss, nothing wall-bound out in the open
   Glow moss only reads as moss in a streak; a single tuft (a streak that could not grow, or a Dungeon vine
   converted on the way in) is taken out after the floor is built. */


/* ---------------------------------------------------------------- 7. pools lie in the ground; big pieces stand alone
   The glowing pool is a hole in the floor, but it was drawn like a standing piece over a contact shadow, so it
   hovered. It is drawn centred flat in its footprint now, with no shadow. And the big set pieces are interesting
   enough on their own: no small clusters or floor decals within a tile of them. */

function drawGlowingPoolProp(p, px, py, alpha){
  if(p && /^glowing-pool/.test(p.name) && typeof caveArt==='function'){
    var o=caveArt(p.name); if(o){
      var w=p.w||2, h=p.h||2, X=(p.x-camX)*TS, Y=(p.y-camY)*TS, s=TS/64, artH=o.sh*s;
      /* the art's solid box centred in the footprint (the standing-piece wrapper above adds the canvas padding) */
      var bottom = Y + h*TS/2 + artH/2;
      drawCaveArt(o, X+w*TS/2, bottom, alpha, false);
      return true;
    }
  }
  return false;

}
var CAVE_BIG = /^(glowing-pool|geode|mushroom-pair|stalagmite-group|worm-burrow|mine-support|giant-mushroom|pylon|stalagmite-tall)/;


/* ---------------------------------------------------------------- 8. the Maw's burrow mounds are heaved out of the floor (2026-09-19)
   Justin: the mounds on floor 15 sat on the stone like a pile set down on it. Under each one now: churned dark earth
   fading out past its footprint, cracks running away from it, and a scatter of pebbles thrown up with it - drawn on
   the ground layer, beneath the mound, in the floor's own tint. One raster per mound, cached. */
function mawSkirtRaster(x, y){
  var T=24, W=4, R=T*W, c=document.createElement('canvas'); c.width=R; c.height=R;
  var g=c.getContext('2d'), im=g.createImageData(R,R), D=im.data, salt=(typeof ptSalt==='function' ? ptSalt() : 7)+880;
  var M=(typeof PT_MAT!=='undefined' && PT_MAT.cavern && PT_MAT.cavern.floor) || [96,84,70];
  var cx=R/2, cy=R*0.56;                                   /* the mound's base centre (its 2x2 sits in the middle of the 4x4) */
  for(var v=0; v<R; v++) for(var u=0; u<R; u++){
    var dx=(u-cx)/(T*1.55), dy=(v-cy)/(T*1.15), wx=x+u/T, wy=y+v/T;
    var d=Math.sqrt(dx*dx+dy*dy) + (ptVal(wx*1.6, wy*1.6, salt)-0.5)*0.35;
    var p=(v*R+u)*4, col=null, a=0;
    if(d<1){                                                /* churned earth: darker, a little warmer, broken up */
      var k=1-d, grit=hash2(u>>1, v>>1, salt+1);
      col=[M[0]*0.36, M[1]*0.31, M[2]*0.27]; a=Math.round(215*Math.pow(k,0.5)*(grit<0.2 ? 0.7 : 1));
      if(d>0.8 && grit>0.35){ col=[M[0]*1.18, M[1]*1.1, M[2]*1.0]; a=Math.round(170*(1-Math.abs(d-0.9)/0.1)); }   /* the heaved-up lip, catching the light */
    }
    /* cracks running out from the mound */
    var an=Math.atan2(dy, dx), rays=7, rk=((an+Math.PI)/(Math.PI*2))*rays + (ptVal(wx*2.5, wy*2.5, salt+2)-0.5)*0.6;
    var rd=Math.abs(rk-Math.round(rk)), reach=0.9+0.5*hash2(Math.round(rk), 3, salt+3);
    if(d>0.5 && d<reach && rd<0.05*(1.25-d/reach)){ col=[M[0]*0.3, M[1]*0.27, M[2]*0.25]; a=Math.round(200*(1-(d-0.55)/(reach-0.55))); }
    /* pebbles thrown up around it */
    var cell=hash2(u>>2, v>>2, salt+4);
    if(d>0.45 && d<1.35 && cell<0.16*(1.4-d) && (u&3)<3 && (v&3)<2){ var lit=(v&3)===0; col=lit ? [M[0]*1.15, M[1]*1.12, M[2]*1.08] : [M[0]*0.6, M[1]*0.56, M[2]*0.52]; a=235; }
    if(!col) continue;
    D[p]=Math.min(255,col[0]); D[p+1]=Math.min(255,col[1]); D[p+2]=Math.min(255,col[2]); D[p+3]=Math.max(0,Math.min(255,a));
  }
  g.putImageData(im,0,0); return c;
}
var MAW_SKIRT={};
function drawMawSkirts(){
  if(typeof inCaverns!=='function' || !inCaverns() || typeof props==='undefined') return;
  props.forEach(function(p){
    if(!/^worm-burrow/.test(p.name)) return;
    if(p.x+3<camX || p.x-1>camX+viewW || p.y+3<camY || p.y-1>camY+viewH) return;
    var i=idxOf(p.x,p.y); if(!(revealAll||seen[i])) return;
    var k=floorNo+':'+p.x+','+p.y, c=MAW_SKIRT[k]||(MAW_SKIRT[k]=mawSkirtRaster(p.x-1, p.y-1));
    ctx.save(); ctx.imageSmoothingEnabled=false; ctx.globalAlpha=(revealAll||vis[i]) ? 1 : memA(0.42);
    ctx.drawImage(c, 0, 0, c.width, c.height, Math.round((p.x-1-camX)*TS), Math.round((p.y-1-camY)*TS), TS*4, TS*4);
    ctx.restore();
  });
}


/* ---------------------------------------------------------------- 9. pieces with their own base cast no shadow (2026-09-19)
   Justin: "the firepit and the crystal here in the cavern have a shadow underneath and look like they are floating".
   Every standing piece was drawn over the same dark ellipse. A piece whose art already ends in a wide base - the
   campfire's ring of stones, a crystal's rubble skirt, a stalagmite's foot - sits in the ground on its own, and the
   ellipse under it reads as a hole it hovers over. Measured from the art: a wide, flat bottom means no shadow, and
   anything narrower keeps a tighter, softer one. */
var CAVE_BASE = {};
function caveBaseWide(o){
  if(!o || !o.nm) return false;
  if(CAVE_BASE[o.nm]!==undefined) return CAVE_BASE[o.nm];
  var wide=false;
  try{
    var c=document.createElement('canvas'); c.width=o.sw; c.height=o.sh; var g=c.getContext('2d');
    g.drawImage(o.img, o.sx, o.sy, o.sw, o.sh, 0, 0, o.sw, o.sh);
    var D=g.getImageData(0,0,o.sw,o.sh).data, rows=Math.max(3, Math.round(o.sh*0.09)), best=0;
    for(var y=o.sh-1; y>=Math.max(0,o.sh-rows); y--){
      var lo=-1, hi=-1;
      for(var x=0;x<o.sw;x++) if(D[(y*o.sw+x)*4+3]>=140){ if(lo<0) lo=x; hi=x; }
      if(lo>=0) best=Math.max(best, (hi-lo+1)/o.sw);
    }
    wide = best>=0.62;                     /* the art stands on most of its own width: it has a base */
  }catch(e){ wide=false; }
  return (CAVE_BASE[o.nm]=wide);
}
function drawWideCaveProp(p, px, py, alpha){
    if(!inCaverns() || p.flat || !(p.cave || (typeof CAVE_PIECES!=='undefined' && CAVE_PIECES[p.name]))) return false;
    var o=typeof caveArt==='function' ? caveArt(p.name) : null;
    if(!o || !caveBaseWide(o)) return false;
    var w=p.w||1, h=p.h||1, X=(p.x-camX)*TS, Y=(p.y-camY)*TS;
    var flip=hash2(p.x,p.y,5)<0.5 && !/burrow|pool|mine-support/.test(p.name);
    drawCaveArt(o, X+w*TS/2, Y+h*TS-TS*0.02, alpha, flip);   /* no ellipse: the art brings its own footing */
    if(typeof flashOf==='function' && p.br){ var fl=flashOf(p); if(fl>0){ ctx.save(); ctx.globalAlpha=fl*0.6; ctx.fillStyle='#FFF'; ctx.fillRect(X+TS*0.25, Y+TS*0.25, TS*0.5, TS*0.5); ctx.restore(); } }
    return true;

}

/* Named floor-generation stages; ordered by generation-adapter.js. */
function trimGeneratedCavernClusters(seed){

  if(typeof inCaverns==='function' && inCaverns() && typeof props!=='undefined'){
    var moss=props.filter(function(p){ return /^cl-glow-moss/.test(p.name); });
    var lone=moss.filter(function(p){ return !moss.some(function(q){ return q!==p && Math.abs(q.x-p.x)+Math.abs(q.y-p.y)===1; }); });
    /* crystals, rubble and small mushrooms only where the floor meets the rock (converted Dungeon props included) */
    var loose=props.filter(function(p){ return /^cl-(crystal-shards|rubble|small-mushrooms)/.test(p.name) && ![[1,0],[-1,0],[0,1],[0,-1]].some(function(d){ return isWallLike(at(p.x+d[0],p.y+d[1])); }); });
    lone=lone.concat(loose);
    if(lone.length){ props=props.filter(function(p){ return lone.indexOf(p)<0; }); if(typeof rebuildPropGrid==='function') rebuildPropGrid(); }
  }
  return;
}

function clearGeneratedCavernProps(seed){

  if(typeof inCaverns==='function' && inCaverns() && typeof props!=='undefined'){
    /* this floor's theme wins over pieces that arrived another way (converted Dungeon props) */
    var TH=floorMeta.caveTheme;
    if(TH){
      var themeTall=TH.tall.map(function(t){ return t[0]; });
      props=props.filter(function(p){
        var m=p.name.match(/^cl-(small-mushrooms|crystal-shards|rubble|cave-pearls|lost-miner)/);
        if(m) return TH.clusters.indexOf(m[1])>=0 || (m[1]==='lost-miner' && TH.miner);
        var tl=p.name.match(/^(stalagmite-tall|giant-mushroom|pylon|stalagmite-group|geode|mushroom-pair|mine-cart|mine-support)/);
        if(tl) return themeTall.indexOf(tl[1])>=0;
        return true;
      });
      if(typeof rebuildPropGrid==='function') rebuildPropGrid();
    }
    var bigs=props.filter(function(p){ return CAVE_BIG.test(p.name); });
    function nearBig(x,y){ return bigs.some(function(b){ var w=b.w||1, h=b.h||1; return x>=b.x-1 && x<=b.x+w && y>=b.y-1 && y<=b.y+h; }); }
    var before=props.length;
    props=props.filter(function(p){ return !(/^cl-/.test(p.name) && nearBig(p.x,p.y)); });
    if(props.length!==before && typeof rebuildPropGrid==='function') rebuildPropGrid();
    if(floorMeta.caveDeco) floorMeta.caveDeco.decals=floorMeta.caveDeco.decals.filter(function(d){ return !nearBig(d.x,d.y); });
  }
  return;
}
