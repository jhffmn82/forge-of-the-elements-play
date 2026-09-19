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
  if(typeof floorMeta==='undefined' || !floorMeta) return null;
  if(floorMeta.plane) return floorMeta.plane==='earth' ? 'earth' : null;
  if(typeof inCaverns==='function' && inCaverns()) return 'caverns';
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
function vegDraw(o, cx, base, scale, shear, alpha, flip){
  if(!o) return;
  var s=TS/64*scale, w=o.sw*s, h=o.sh*s;
  ctx.save(); ctx.globalAlpha=alpha; ctx.imageSmoothingEnabled=false;
  ctx.translate(cx, base); ctx.transform(1, 0, -shear, 1, 0, 0);
  if(flip) ctx.scale(-1,1);
  ctx.drawImage(o.img, o.sx, o.sy, o.sw, o.sh, -w/2, -h, w, h);
  ctx.restore();
}
function vegBody(x, y){
  if(player && Math.round(renderPos(player).x)===x && Math.round(renderPos(player).y)===y) return player;
  for(var i=0;i<ents.length;i++){ var e=ents[i]; if(e!==player && e.hp>0 && e.x===x && e.y===y) return e; }
  return null;
}
function vegBend(x, y){ var b=vegBody(x,y); if(!b) return 0; var rp=renderPos(b); return (rp.x <= x ? -1 : 1)*0.35; }

/* tall grass: back row beneath, front row over whoever stands in it */
var _drawGrassTileVeg = drawGrassTile;
drawGrassTile = function(x, y, px, py, alpha, layer, now){
  var set=vegSet(); if(!set) return _drawGrassTileVeg.apply(this, arguments);
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
};
/* short grass: a low tuft or two, under everything */
var _drawGroundDecalVeg = drawGroundDecal;
drawGroundDecal = function(gv, x, y, px, py, alpha, now){
  var set=vegSet();
  if(gv===G_SHORT && set){
    now=now||performance.now();
    var sw=vegSway(x,y,now,vegBend(x,y))*0.8;
    vegDraw(vegPick(set,'grass-front',3,x,y,66), px+TS*(0.05+0.9*hash2(x,y,67)), py+TS*(0.4+0.2*hash2(x,y,68)), 0.85, sw, alpha*0.9, hash2(x,y,69)<0.5);
    vegDraw(vegPick(set,'grass-front',3,x,y,61), px+TS*(0.1+0.8*hash2(x,y,62)), py+TS*(0.72+0.2*hash2(x,y,63)), 1.1, sw, alpha, hash2(x,y,64)<0.5);
    if(hash2(x,y,65)<0.6) vegDraw(vegPick(set,'grass-front',3,x,y,70), px+TS*(0.0+hash2(x,y,71)), py+TS*(0.95+0.1*hash2(x,y,72)), 1.0, sw, alpha, hash2(x,y,73)<0.5);
    return true;
  }
  return _drawGroundDecalVeg.apply(this, arguments);
};

/* plants: Dungeon bushes and ferns, Caverns mushroom groups (spots from vegetation.js), drawn on the ground layer */
function drawVegSpots(now){
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
var _drawSurfaceDecoVeg = drawSurfaceDeco;
drawSurfaceDeco = function(){ var r=_drawSurfaceDecoVeg.apply(this, arguments); drawVegSpots(performance.now()); return r; };

/* the Earth plane's plants: its fern, root tangle and mushroom props wear the pack's art and sway */
var VEG_EARTH_PROP = {'fern':['fern','bush'], 'root-tangle':['root-tangle'], 'glow-mushrooms':['mushroom-cluster']};
var _drawPropSurfaceVeg = drawPropSurface;
drawPropSurface = function(p, px, py, alpha){
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
  return _drawPropSurfaceVeg.apply(this, arguments);
};

/* ---------------------------------------------------------------- cuttable bushes (vegetation.js places them) */
var _drawPropSurfaceBush = drawPropSurface;
drawPropSurface = function(p, px, py, alpha){
  if(p && p.name==='bush'){
    var o=vegArt('earth-bush-'+(1+Math.floor(hash2(p.x,p.y,91)*3)));
    if(o){
      ctx.save(); ctx.globalAlpha=alpha*0.35; ctx.fillStyle='#0A0806'; ctx.beginPath(); ctx.ellipse(px+TS/2, py+TS*0.9, TS*0.4, TS*0.12, 0, 0, 7); ctx.fill(); ctx.restore();
      vegDraw(o, px+TS/2, py+TS*0.97, 1.0, vegSway(p.x,p.y,performance.now(),0)*0.3, alpha, hash2(p.x,p.y,92)<0.5);
      if(typeof flashOf==='function'){ var fl=flashOf(p); if(fl>0){ ctx.save(); ctx.globalAlpha=fl*0.5; ctx.fillStyle='#FFF'; ctx.fillRect(px+TS*0.2, py+TS*0.3, TS*0.6, TS*0.6); ctx.restore(); } }
      return true;
    }
  }
  return _drawPropSurfaceBush.apply(this, arguments);
};
/* cutting one: a burst of leaves, and what it drops is mostly a heart (Zelda rules) */
var _damagePropBush = damageProp;
damageProp = function(p, src, type){
  if(!p || !p.bush) return _damagePropBush.apply(this, arguments);
  removeProp(p); sfx('step-grass');
  if(typeof burst==='function') burst(p.x, p.y, 'heal', 14, 0.05);
  if(type==='fire'){ setG(p.x,p.y,G_ASH); return; }
  if(rng()<(p.loot||0.25)){
    var it = rng()<0.6 ? {kind:'heart'} : {kind:'essence', n:ri(2,5)+floorNo};
    it.x=p.x; it.y=p.y; items.push(it);
    log(it.kind==='heart' ? 'A heart was tucked under the bush.' : 'Something glints among the cut leaves.','c-good');
  }
};
