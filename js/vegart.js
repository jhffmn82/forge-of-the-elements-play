/* vegart.js - the vegetation pack, drawn and animated (2026-09-19).
   GPT painted each plant upright and rooted at the bottom centre, with tall grass split into a back row and a
   front row. The game animates them: every plant is drawn with a horizontal shear pivoting on its root, so the
   top sways in a slow wind with gusts rolling across the map, each tile on its own phase; a plant someone is
   standing in bends away from them. Tall grass draws its back row under whoever stands in it and its front row
   over them.
     Dungeon  - its own grass; lush rooms' plant spots (vegetation.js) get the Earth bushes and ferns
     Caverns  - teal cave grass, and single glowing mushrooms in groups of one colour
     Earth    - the plane's grass, bushes, ferns, mushroom clusters and root tangles
   The Crypt and the other planes keep their own ground cover. Options > Motion off stops the sway. */
function vegSet(){
  if(inDeep())return 'underdark';
  if(typeof floorMeta==='undefined' || !floorMeta) return null;
  if(floorMeta.plane) return floorMeta.plane==='earth' ? 'earth' : null;
  if(typeof inCaverns==='function' && inCaverns()) return 'caverns';
  if(typeof cryptShrooms==='function' && cryptShrooms()) return 'crypt';   /* 2026-09-20: the Crypt's purple mushrooms */
  return bidx()===0 ? 'dungeon' : null;
}
function vegPick(set, kind, n, x, y, salt){ return vegArt(set+'-'+kind+'-'+(1+Math.floor(hash2(x,y,salt)*n))); }
/* the wind: a slow wave across the map plus a flutter; a body in the tile pushes the plant away */
function vegSway(x, y, now, bend){
  if(typeof ANIM!=='undefined' && ANIM.reduce) return bend||0;
  var t=now/1000;
  return (Math.sin(t*0.9 + x*0.45 + y*0.2)*0.5 + Math.sin(t*2.3 + x*1.3 + y*0.7)*0.18)*0.16 + (bend||0);
}
/* draw a plant: its bottom centre at (cx, base), sheared by `shear` (top moves shear*height sideways) */
/* 2026-09-19: Justin - the pack's greens were jarringly bright on the grey stone. Each plant is baked once into a
   darker, less saturated copy (a canvas filter per draw is slow, and older iPads lack ctx.filter), and grass is
   drawn part-transparent so the floor shows through it. VEG_DIM per set: how far toward the set's shadow colour. */
var VEG_DIM = {dungeon:[0.38,'#2A2E1C'], caverns:[0.25,'#14222A'], earth:[0.2,'#23261A'], crypt:[0.18,'#221A30']}, VEG_GRASS_A = 0.78, VEG_BAKE = {};
function vegBaked(o){
  var set=vegSet(), d=VEG_DIM[set]; if(!d) return null;
  var k=set+':'+o.sx+','+o.sy+','+o.sw+','+o.sh+':'+(o.img.src||'').slice(-24);
  if(VEG_BAKE[k]!==undefined) return VEG_BAKE[k];
  if(!o.img.complete || !o.img.naturalWidth) return null;
  var c=document.createElement('canvas'); c.width=o.sw; c.height=o.sh; var g=c.getContext('2d');
  g.drawImage(o.img, o.sx, o.sy, o.sw, o.sh, 0, 0, o.sw, o.sh);
  /* darken toward the set's shadow. 2026-09-27 (Justin, render plan Q8): the grey wash that went on first was
     written for the old pack's greens; the new plants are painted in the game's palette and keep their colour. */
  g.globalCompositeOperation='source-atop';
  g.globalAlpha=d[0]; g.fillStyle=d[1]; g.fillRect(0,0,o.sw,o.sh);
  return (VEG_BAKE[k]=c);
}
function vegBody(x, y){
  if(player && Math.round(renderPos(player).x)===x && Math.round(renderPos(player).y)===y) return player;
  for(var i=0;i<ents.length;i++){ var e=ents[i]; if(e!==player && e.hp>0 && e.x===x && e.y===y) return e; }
  return null;
}
function vegBend(x, y){ var b=vegBody(x,y); if(!b) return 0; var rp=renderPos(b); return (rp.x <= x ? -1 : 1)*0.35; }

/* tall grass: back row beneath, front row over whoever stands in it */

function drawVegetationGrass(x,y,px,py,alpha,layer,now){
  var set=vegSet(); if(!set) return false;
  /* the Crypt has no grass: its patches are the purple mushrooms, drawn by js/cryptset.js. It only borrows this
     file's sway and grading (vegSet returns 'crypt' for those). */
  if(set==='crypt') return false;
  alpha*=VEG_GRASS_A;
  now=now||performance.now();
  var bend=vegBend(x,y), sw=vegSway(x,y,now,bend), flip=hash2(x,y,51)<0.5;
  if(layer==='front'){
    vegDraw(vegPick(set,'grass-front',3,x,y,52), px+TS*(0.3+0.4*hash2(x,y,53)), py+TS*1.02, 1.0, sw*1.1, alpha, flip);
    return;
  }
  /* three back tufts spilling a little past the tile, so neighbouring tiles grow into one mass */
  vegDraw(vegPick(set,'grass-back',3,x,y,55), px+TS*(0.1+0.8*hash2(x,y,56)), py+TS*0.62, 0.9, sw*0.9, alpha*0.95, !flip);
  vegDraw(vegPick(set,'grass-back',3,x,y,57), px+TS*(0.05+0.9*hash2(x,y,58)), py+TS*0.82, 1.05, sw, alpha, flip);
  vegDraw(vegPick(set,'grass-back',3,x,y,54), px+TS*0.5, py+TS*1.0, 1.2, sw, alpha, flip);

}
/* short grass: a low tuft or two, under everything */

function drawVegetationGroundDecal(gv, x, y, px, py, alpha, now){
  var set=vegSet();
  if(gv===G_SHORT && set==='crypt') return false;
  if(gv===G_SHORT && set){
    now=now||performance.now(); alpha*=VEG_GRASS_A;
    var sw=vegSway(x,y,now,vegBend(x,y))*0.8;
    vegDraw(vegPick(set,'grass-front',3,x,y,66), px+TS*(0.05+0.9*hash2(x,y,67)), py+TS*(0.4+0.2*hash2(x,y,68)), 0.85, sw, alpha*0.9, hash2(x,y,69)<0.5);
    vegDraw(vegPick(set,'grass-front',3,x,y,61), px+TS*(0.1+0.8*hash2(x,y,62)), py+TS*(0.72+0.2*hash2(x,y,63)), 1.1, sw, alpha, hash2(x,y,64)<0.5);
    if(hash2(x,y,65)<0.6) vegDraw(vegPick(set,'grass-front',3,x,y,70), px+TS*(0.0+hash2(x,y,71)), py+TS*(0.95+0.1*hash2(x,y,72)), 1.0, sw, alpha, hash2(x,y,73)<0.5);
    return true;
  }
  return false;

}

/* plants: Dungeon bushes and ferns, Caverns mushroom groups (spots from vegetation.js), drawn on the ground layer */
function drawOrdinaryPlants(now){
  var set=vegSet(), S=floorMeta && floorMeta.vegSpots; if(!set || !S || !S.length) return;
  S.forEach(function(sp){
    if(sp.x<camX-1 || sp.x>camX+viewW+1 || sp.y<camY-1 || sp.y>camY+viewH+1) return;
    var i=idxOf(sp.x,sp.y); if(!(revealAll||seen[i])) return;
    var a=(revealAll||vis[i]) ? 1 : memA(0.42), px=(sp.x-camX)*TS, py=(sp.y-camY)*TS, sw=vegSway(sp.x,sp.y,now,vegBend(sp.x,sp.y));
    if(set==='caverns'){
      /* One of five baked arrangements per color; the entire clump sways
       * together and never reassembles itself as individual sprites. */
      var col=['teal','violet','amber'][Math.floor(hash2(sp.x,sp.y,71)*3)];
      drawSceneryCluster('mushroom-'+col,Math.floor(hash2(sp.x,sp.y,72)*5),px,py,a,hash2(sp.x,sp.y,77)<.5,sw*.5);
    } else {
      var kind = sp.wet ? 'fern' : (hash2(sp.x,sp.y,78)<0.55 ? 'bush' : 'fern');
      vegDraw(vegArt('earth-'+kind+'-'+(1+Math.floor(hash2(sp.x,sp.y,79)*3))), px+TS*0.5, py+TS*0.95, 0.85, sw*(kind==='bush'?0.35:0.8), a, hash2(sp.x,sp.y,80)<0.5);
    }
  });
}
/* 2026-09-19: Justin - a soft moss bed under the Dungeon's grass, mostly transparent, so a patch reads as growth on the
   stone rather than tufts set down on it. One smooth field over every grass cell (short or tall), so neighbouring
   tiles join into one mass, with a fleck of lighter moss through it. */
/* 2026-09-20: a plant spot has no grass under it any more (vegetation.js: one piece of growth per tile), so the
   moss bed counts those tiles too - a bush or fern still stands on moss, joined to the patch around it. */
var VEG_SPOT_MAP = {arr:null, map:null};
function vegSpotMap(){
  var a=(typeof floorMeta!=='undefined' && floorMeta) ? floorMeta.vegSpots : null;
  if(!a) return null;
  if(VEG_SPOT_MAP.arr!==a){ var m={}; a.forEach(function(sp){ m[idxOf(sp.x,sp.y)]=1; }); VEG_SPOT_MAP={arr:a, map:m}; }
  return VEG_SPOT_MAP.map;
}
function vegIsGrass(x,y){ if(!inb(x,y) || isWallLike(at(x,y))) return false; var i=idxOf(x,y), g=ground[i];
  if(g===G_GRASS || g===G_SHORT) return true;
  var S=vegSpotMap(); return !!(S && S[i]); }
function vegMossSig(x,y){ var s=''; for(var yy=y-1;yy<=y+1;yy++) for(var xx=x-1;xx<=x+1;xx++) s+=vegIsGrass(xx,yy)?'1':'0'; return s; }
/* one axis of a moss raster: world position of each pixel centre, and its lattice cell and smoothed fraction at the
   two noise scales (ptVal at 2.2 per tile, mossNoise at 16), computed exactly as those functions compute them */
function vegMossAxis(o, R){
  var w=new Float64Array(R), pi=new Int32Array(R), pf=new Float64Array(R), mi=new Int32Array(R), mf=new Float64Array(R);
  for(var u=0; u<R; u++){
    var s=o+(u+0.5)/R, a=s*2.2, i=Math.floor(a), t=a-i, b=s*16, j=Math.floor(b), r=b-j;
    w[u]=s; pi[u]=i; pf[u]=t*t*(3-2*t); mi[u]=j; mf[u]=r*r*(3-2*r);
  }
  return {w:w, pi:pi, pf:pf, mi:mi, mf:mf};
}
/* hash2 at every lattice point the axes reach, and the next one on (the far corners) */
function vegMossTable(xs, ys, salt){
  var x0=xs[0], x1=xs[xs.length-1]+1, y0=ys[0], y1=ys[ys.length-1]+1, n=x1-x0+1, h=new Float64Array(n*(y1-y0+1));
  for(var y=y0; y<=y1; y++) for(var x=x0; x<=x1; x++) h[(y-y0)*n+x-x0]=hash2(x,y,salt);
  return {h:h, n:n, x:x0, y:y0};
}
/* 2026-09-27 (Justin, render plan Q11): built at 128px like the Crypt's bed (cryptset.js cryptMossRaster). It was a 32px
   raster blown up with square 2px flecks; the grain and flecks are now continuous noise, the colours and cover unchanged. */
function vegMossRaster(x, y){
  var R=128, cells=[];
  for(var yy=y-1;yy<=y+1;yy++) for(var xx=x-1;xx<=x+1;xx++) if(vegIsGrass(xx,yy)) cells.push([xx+0.5,yy+0.5]);
  if(!cells.length) return null;
  var c=document.createElement('canvas'); c.width=R; c.height=R;
  var g=c.getContext('2d'), im=g.createImageData(R,R), D=im.data, salt=surfSalt()+140, any=false;
  /* 2026-09-28 (frame cost: 733 ms of a Dungeon walk at 4x CPU, built while you walk): the same arithmetic on the same
     values, not repeated per pixel. Each column's and row's position, lattice cell and smoothed fraction is worked out
     once, the lattice corners (hash2 of whole lattice points) come from tables filled once per raster, and a pixel
     whose seed field alone cannot reach the threshold (the two noise terms add at most 0.225) skips its noise. */
  var cols=vegMossAxis(x,R), rows=vegMossAxis(y,R), smooth=typeof ptVal==='function';
  var T0=vegMossTable(cols.pi,rows.pi,salt), T1=vegMossTable(cols.mi,rows.mi,salt+1), T2=vegMossTable(cols.mi,rows.mi,salt+2);
  var n0=T0.n, n1=T1.n, near=[];
  for(var v=0; v<R; v++){
    /* the seeds this row can reach (a seed 1.25 tiles off in y adds nothing anywhere on it), in their original order */
    var wy=rows.w[v]; near.length=0;
    for(var k=0;k<cells.length;k++){ var ey=wy-cells[k][1]; if(ey*ey<1.5625) near.push(cells[k]); }
    if(!near.length) continue;
    for(var u=0; u<R; u++){
      var wx=cols.w[u], f=0;
      for(k=0;k<near.length;k++){ var dx=wx-near[k][0], dy=wy-near[k][1], d=Math.sqrt(dx*dx+dy*dy)/1.25; if(d<1) f+=(1-d)*(1-d); }
      if(f<0.05) continue;
      var q=(rows.pi[v]-T0.y)*n0+cols.pi[u]-T0.x, a=T0.h[q], b=T0.h[q+1], cc=T0.h[q+n0], dd=T0.h[q+n0+1], fx=cols.pf[u], fy=rows.pf[v];
      var vn=smooth ? a+(b-a)*fx+(cc-a)*fy+(a-b-cc+dd)*fx*fy : a;                                  /* vegNoise(wx*2.2, wy*2.2, salt) */
      q=(rows.mi[v]-T1.y)*n1+cols.mi[u]-T1.x; fx=cols.mf[u]; fy=rows.mf[v];
      a=T1.h[q]; b=T1.h[q+1]; cc=T1.h[q+n1]; dd=T1.h[q+n1+1];
      var val=f + (vn-0.5)*0.35 + ((a+(b-a)*fx)*(1-fy)+(cc+(dd-cc)*fx)*fy-0.5)*0.1;              /* mossNoise(wx*16, wy*16, salt+1) */
      if(val<0.28) continue;
      a=T2.h[q]; b=T2.h[q+1]; cc=T2.h[q+n1]; dd=T2.h[q+n1+1];
      var p=(v*R+u)*4, dense=Math.min(1,(val-0.28)*1.8), fleck=mossEdge((a+(b-a)*fx)*(1-fy)+(cc+(dd-cc)*fx)*fy,.68,.08);
      D[p]=58+18*dense+(46-18*dense)*fleck; D[p+1]=82+16*dense+(46-16*dense)*fleck; D[p+2]=40+22*fleck;
      D[p+3]=Math.round((34+36*fleck+62*dense)*mossEdge(val,.28,.06)); any=true;   /* ~15-40% */
    }
  }
  if(!any) return null;
  g.putImageData(im,0,0); c.environmentTerrain={pixels:D,nativeDetail:true}; return c;
}
function drawVegMoss(){
  if(vegSet()!=='dungeon') return;
  for(var y=camY-1; y<=camY+viewH+1; y++) for(var x=camX-1; x<=camX+viewW+1; x++){
    if(!inb(x,y)) continue; var i=idxOf(x,y); if(!(revealAll||seen[i]) || isWallLike(at(x,y))) continue;
    var sig=vegMossSig(x,y); if(sig.indexOf('1')<0) continue;
    blitRaster(cachedRaster('vm'+sig+'@', x, y, vegMossRaster), (x-camX)*TS, (y-camY)*TS, (revealAll||vis[i])?1:memA(0.4));
  }
  vegMossAhead();
}
/* 2026-09-28 (frame cost): a step used to build the moss rasters for a whole new row of cells inside one frame (14 of
   them, 90 ms, at 4x CPU). The rasters within three cells of the view are built ahead in idle time; a frame still
   builds any it needs that are not ready, so the pixels are the same either way. */
var VEG_MOSS_AHEAD={job:null, done:''};
function vegMossAhead(){
  var want=camX+','+camY+','+viewW+','+viewH+','+surfSalt();
  if(VEG_MOSS_AHEAD.job!==null || VEG_MOSS_AHEAD.done===want) return;
  var idle=window.requestIdleCallback || function(fn){ return setTimeout(function(){ var end=Date.now()+4; fn({timeRemaining:function(){ return end-Date.now(); }}); }, 50); };
  VEG_MOSS_AHEAD.job=idle(function(deadline){
    VEG_MOSS_AHEAD.job=null;
    if(!map || vegSet()!=='dungeon') return;
    var cells=surfCache(), M=3, want=camX+','+camY+','+viewW+','+viewH+','+surfSalt();
    for(var y=Math.max(0,camY-M); y<=Math.min(MH-1,camY+viewH+M); y++) for(var x=Math.max(0,camX-M); x<=Math.min(MW-1,camX+viewW+M); x++){
      if(isWallLike(at(x,y))) continue;
      var sig=vegMossSig(x,y); if(sig.indexOf('1')<0 || ('vm'+sig+'@'+x+','+y) in cells) continue;
      if(deadline.timeRemaining()<3){ vegMossAhead(); return; }
      cachedRaster('vm'+sig+'@', x, y, vegMossRaster);
    }
    VEG_MOSS_AHEAD.done=want;
  });
}

/* the Earth plane's plants: its fern, root tangle and mushroom props wear the pack's art and sway */
var VEG_EARTH_PROP = {'fern':['fern','bush'], 'root-tangle':['root-tangle'], 'glow-mushrooms':['mushroom-cluster']};

function drawEarthPlantProp(p, px, py, alpha){
  if(p && floorMeta && floorMeta.plane==='earth' && VEG_EARTH_PROP[p.name]){
    var kinds=VEG_EARTH_PROP[p.name], kind=kinds[Math.floor(hash2(p.x,p.y,81)*kinds.length)], n=kind==='root-tangle'?2:3;
    var o=vegArt('earth-'+kind+'-'+(1+Math.floor(hash2(p.x,p.y,82)*n)));
    if(o){
      ctx.save(); ctx.globalAlpha=alpha*0.35; ctx.fillStyle='#0A0806'; ctx.beginPath(); ctx.ellipse(px+TS/2, py+TS*0.92, TS*0.34, TS*0.1, 0, 0, 7); ctx.fill(); ctx.restore();
      var sway = kind==='fern' ? 0.8 : kind==='bush' ? 0.35 : 0.1;
      vegDraw(o, px+TS/2, py+TS*0.96, 0.95, vegSway(p.x,p.y,performance.now(),0)*sway, alpha, hash2(p.x,p.y,83)<0.5);
      return true;
    }
  }
  return false;

}

/* ---------------------------------------------------------------- cuttable bushes (vegetation.js places them) */

function drawBushProp(p, px, py, alpha){
  if(p && p.name==='bush'){
    var o=vegArt('earth-bush-'+(1+Math.floor(hash2(p.x,p.y,91)*3)));
    if(o){
      ctx.save(); ctx.globalAlpha=alpha*0.35; ctx.fillStyle='#0A0806'; ctx.beginPath(); ctx.ellipse(px+TS/2, py+TS*0.9, TS*0.4, TS*0.12, 0, 0, 7); ctx.fill(); ctx.restore();
      vegDraw(o, px+TS/2, py+TS*0.97, 1.0, vegSway(p.x,p.y,performance.now(),0)*0.3, alpha, hash2(p.x,p.y,92)<0.5);
      if(typeof flashOf==='function'){ var fl=flashOf(p); if(fl>0){ ctx.save(); ctx.globalAlpha=fl*0.5; ctx.fillStyle='#FFF'; ctx.fillRect(px+TS*0.2, py+TS*0.3, TS*0.6, TS*0.6); ctx.restore(); } }
      return true;
    }
  }
  return false;

}
/* cutting one: a burst of leaves, and what it drops is mostly a heart (Zelda rules) */

function cutBushProp(p,src,type){
  removeProp(p); sfx('step-grass',{vol:0.5});   /* 2026-09-23 (Justin): cutting a bush at half volume; the walking rustle stays */
  if(typeof burst==='function') burst(p.x, p.y, 'heal', 14, 0.05);
  (floorMeta.regrow=floorMeta.regrow||[]).push({x:p.x, y:p.y, at:turn+VEG_REGROW.bush});
  if(type==='fire'){ setG(p.x,p.y,G_ASH); return; }
  if(rng()<(p.loot||0.25)){
    var it = rng()<0.6 ? {kind:'heart'} : {kind:'essence', n:ri(2,5)+floorNo};
    it.x=p.x; it.y=p.y; items.push(it);
    log(it.kind==='heart' ? 'A heart was tucked under the bush.' : 'Something glints among the cut leaves.','c-good');
  }

}

/* ---------------------------------------------------------------- regrowth (2026-09-19, Justin: the food clock stops
   anyone farming it forever). Cut bushes grow back, trampled tall grass stands up again and burned ground greens
   over - only where you cannot see it happen, and never under a creature or an item. */
var VEG_REGROW = {bush:150, tall:100, burnt:200};
function vegRemember(){
  if(!ground || !vegSet()) return;
  var o={}; for(var i=0;i<ground.length;i++){ if(ground[i]===G_GRASS) o[i]='G'; else if(ground[i]===G_SHORT) o[i]='s'; }
  floorMeta.vegOrig=o; floorMeta.vegSeen={};
}


function vegRegrowTick(){
  if(!floorMeta || !ground || !vegSet() || !player) return;
  var hidden=function(x,y){ var i=idxOf(x,y); return !vis[i] && !ents.some(function(e){ return e.hp>0 && e.x===x && e.y===y; }) && !items.some(function(it){ return it.x===x && it.y===y; }) && !(player.x===x && player.y===y); };
  /* bushes */
  if(floorMeta.regrow && floorMeta.regrow.length){
    floorMeta.regrow=floorMeta.regrow.filter(function(r){
      if(turn<r.at) return true;
      if(!hidden(r.x,r.y) || propAt(r.x,r.y) || at(r.x,r.y)!==FLOOR) return true;   /* try again later */
      addProp(r.x, r.y, 'bush'); return false;
    });
  }
  /* grass, every 10 turns: a trampled or burned tile that was grass notes when it changed, and recovers later */
  if(turn%10 || !floorMeta.vegOrig) return;
  var O=floorMeta.vegOrig, S=floorMeta.vegSeen||(floorMeta.vegSeen={});
  for(var k in O){
    var i=+k, g=ground[i], want=O[k], x=i%MW, y=(i/MW)|0;
    var ok = (want==='G' && g===G_SHORT) || ((want==='G'||want==='s') && (g===G_ASH || g===G_SCORCH || !g));
    if(!ok){ delete S[k]; continue; }
    if(S[k]===undefined){ S[k]=turn; continue; }
    var wait = (g===G_ASH || g===G_SCORCH) ? VEG_REGROW.burnt : VEG_REGROW.tall;
    if(turn-S[k] < wait || !hidden(x,y)) continue;
    ground[i] = (g===G_SHORT || want==='s') ? (want==='G' ? G_GRASS : G_SHORT) : G_SHORT;   /* burned ground comes back short first */
    S[k]=turn;
  }
}

/* Named floor-generation stages; ordered by generation-adapter.js. */
function rememberGeneratedVegetation(seed){  try{ vegRemember(); }catch(e){} return; }
