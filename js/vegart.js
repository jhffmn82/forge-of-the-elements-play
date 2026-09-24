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
function vegArt(name){ return objArt('veg', 'veg-'+name); }
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
  /* pull the colours toward grey first (a desaturating grey wash), then darken toward the set's shadow */
  g.globalCompositeOperation='source-atop';
  g.globalAlpha=0.22; g.fillStyle='#6E6A60'; g.fillRect(0,0,o.sw,o.sh);
  g.globalAlpha=d[0]; g.fillStyle=d[1]; g.fillRect(0,0,o.sw,o.sh);
  return (VEG_BAKE[k]=c);
}
function vegDraw(o, cx, base, scale, shear, alpha, flip){
  if(!o) return;
  var s=TS/64*scale, w=o.sw*s, h=o.sh*s, b=vegBaked(o);
  ctx.save(); ctx.globalAlpha=alpha; ctx.imageSmoothingEnabled=false;
  ctx.translate(cx, base); ctx.transform(1, 0, -shear, 1, 0, 0);
  if(flip) ctx.scale(-1,1);
  if(b) ctx.drawImage(b, 0, 0, o.sw, o.sh, -w/2, -h, w, h);
  else ctx.drawImage(o.img, o.sx, o.sy, o.sw, o.sh, -w/2, -h, w, h);
  ctx.restore();
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
      /* two to four mushrooms of one colour, each bobbing on its own */
      var col=['teal','violet','amber'][Math.floor(hash2(sp.x,sp.y,71)*3)], n=2+Math.floor(hash2(sp.x,sp.y,72)*3);
      for(var k=0;k<n;k++){
        var ox=0.2+0.6*hash2(sp.x+k,sp.y,73), oy=0.55+0.4*hash2(sp.x,sp.y+k,74), sc=0.55+0.4*hash2(k,sp.x+sp.y,75);
        vegDraw(vegArt('caverns-mushroom-'+col+'-'+(1+Math.floor(hash2(k,sp.x,76)*2))), px+TS*ox, py+TS*oy, sc, sw*0.5, a, hash2(k,sp.y,77)<0.5);
      }
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
function vegMossRaster(x, y){
  var R=32, cells=[];
  for(var yy=y-1;yy<=y+1;yy++) for(var xx=x-1;xx<=x+1;xx++) if(vegIsGrass(xx,yy)) cells.push([xx+0.5,yy+0.5]);
  if(!cells.length) return null;
  var c=document.createElement('canvas'); c.width=R; c.height=R;
  var g=c.getContext('2d'), im=g.createImageData(R,R), D=im.data, salt=surfSalt()+140, any=false;
  for(var v=0; v<R; v++) for(var u=0; u<R; u++){
    var wx=x+(u+0.5)/R, wy=y+(v+0.5)/R, f=0;
    for(var k=0;k<cells.length;k++){ var dx=wx-cells[k][0], dy=wy-cells[k][1], d=Math.sqrt(dx*dx+dy*dy)/1.25; if(d<1) f+=(1-d)*(1-d); }
    var val=f + (vegNoise(wx*2.2, wy*2.2, salt)-0.5)*0.35 + (hash2(Math.floor(wx*16), Math.floor(wy*16), salt+1)-0.5)*0.1;
    if(val<0.28) continue;
    var p=(v*R+u)*4, dense=Math.min(1,(val-0.28)*1.8), fleck=hash2(Math.floor(wx*16), Math.floor(wy*16), salt+2)<0.14;
    var col = fleck ? [104,128,62] : [58+18*dense, 82+16*dense, 40];
    D[p]=col[0]; D[p+1]=col[1]; D[p+2]=col[2]; D[p+3]=Math.round((fleck?70:34)+62*dense); any=true;   /* ~15-40% */
  }
  if(!any) return null;
  g.putImageData(im,0,0); return c;
}
function drawVegMoss(){
  if(vegSet()!=='dungeon') return;
  for(var y=camY-1; y<=camY+viewH+1; y++) for(var x=camX-1; x<=camX+viewW+1; x++){
    if(!inb(x,y)) continue; var i=idxOf(x,y); if(!(revealAll||seen[i]) || isWallLike(at(x,y))) continue;
    var sig=vegMossSig(x,y); if(sig.indexOf('1')<0) continue;
    blitRaster(cachedRaster('vm'+sig+'@', x, y, vegMossRaster), (x-camX)*TS, (y-camY)*TS, (revealAll||vis[i])?1:memA(0.4));
  }
}

function drawVegetationSurface(){ drawVegMoss(); drawVegSpots(performance.now()); return;
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
