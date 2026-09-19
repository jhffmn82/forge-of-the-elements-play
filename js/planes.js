/* =====================================================================
   planes.js - elemental plane maps (2026-09-17, generator stage).
   A plane is one cave floor, freshly generated every visit (cellular automata), with guaranteed pieces
   placed at random: an entrance hallway at one edge, a large central chamber around the element's
   centerpiece (the elite's arena), a dead-end treasure grotto (rune stone and chest behind a 1-wide
   neck), a grotto with a pool, and one or two side pockets. See DESIGN.md section 17.
   This file builds the layout only; it is not wired into floors yet (planePreview draws layouts).
   ===================================================================== */

var PLANE_W = 56, PLANE_H = 34;
/* cell codes for a plane layout (turned into game tiles once planes are playable) */
var PL = {ROCK:0, FLOOR:1, WATER:2, CENTER:3, DECOR:4, TREASURE:5, RUNE:6, ENTRY:7, LIGHT:8, BLOCK:9};

var PLANE_THEMES = {
  light:  {name:'Radiant Sanctum', rock:'#8C7F66', floor:'#E6D9B8', water:'#8ED3E0', center:'#E8B84A', decor:'#F6E27A', light:'#FFF1A8', block:'#B8A67E',
           centerKind:'dais', decorKind:'crystal', lightKind:'sunvein'},
  shadow: {name:'Umbral Reach', rock:'#3B3348', floor:'#6E5F84', water:'#3A1F6E', center:'#4B2A8C', decor:'#9A7BD0', light:'#C9B2FF', block:'#55496A',
           centerKind:'voidpool', decorKind:'crystal', lightKind:'moonpool'},
  earth:  {name:'Stonebound Deep', rock:'#5A4E3A', floor:'#A08A62', water:'#5FA8B8', center:'#6F8A44', decor:'#7FA05A', light:'#C9B27A', block:'#6B6450',
           centerKind:'mound', decorKind:'roots', lightKind:'mushroom'}
};

function makePlaneMap(element, seed){
  var W=PLANE_W, H=PLANE_H, r=mulberry32((seed>>>0) ^ 0x9E3779B9), g=new Uint8Array(W*H);
  function I(x,y){ return y*W+x; }
  function inside(x,y,m){ m=m||1; return x>=m && y>=m && x<W-m && y<H-m; }
  function rnd(a,b){ return a+Math.floor(r()*(b-a+1)); }
  function blob(cx, cy, rx, ry, val, round){
    var cells=[];
    for(var y=cy-ry-2;y<=cy+ry+2;y++) for(var x=cx-rx-2;x<=cx+rx+2;x++){
      if(!inside(x,y,2)) continue;
      var a=Math.atan2(y-cy, x-cx), wob=round ? 1+0.06*Math.sin(a*4+cx) : 1+0.18*Math.sin(a*3+cx)+0.12*Math.sin(a*5+cy);
      var d=Math.pow((x-cx)/(rx*wob),2)+Math.pow((y-cy)/(ry*wob),2);
      if(d<=1){ g[I(x,y)]=val===undefined?PL.FLOOR:val; cells.push({x:x,y:y}); }
    }
    return cells;
  }
  function tunnel(ax, ay, bx, by, width){
    var x=ax, y=ay, guard=0;
    for(var sy0=0;sy0<width;sy0++) for(var sx0=0;sx0<width;sx0++) if(inside(x+sx0,y+sy0,2) && g[I(x+sx0,y+sy0)]===PL.ROCK) g[I(x+sx0,y+sy0)]=PL.FLOOR;
    while((x!==bx || y!==by) && guard++<400){
      if(r()<0.72){ if(Math.abs(bx-x)>Math.abs(by-y)) x+=Math.sign(bx-x); else y+=Math.sign(by-y); }
      else { if(r()<0.5) x+=Math.sign(bx-x)||rnd(-1,1); else y+=Math.sign(by-y)||rnd(-1,1); }
      x=Math.max(2,Math.min(W-3,x)); y=Math.max(2,Math.min(H-3,y));
      for(var oy=0;oy<width;oy++) for(var ox=0;ox<width;ox++) if(inside(x+ox,y+oy,2) && g[I(x+ox,y+oy)]===PL.ROCK) g[I(x+ox,y+oy)]=PL.FLOOR;
    }
  }

  /* 1. a rough cave: random fill, then smooth */
  for(var y=2;y<H-2;y++) for(var x=2;x<W-2;x++) g[I(x,y)] = r()<0.42 ? PL.FLOOR : PL.ROCK;   /* a sparser base, so the placed rooms read clearly */
  for(var it=0;it<5;it++){
    var n2=new Uint8Array(g);
    for(y=2;y<H-2;y++) for(x=2;x<W-2;x++){
      var walls=0; for(var dy=-1;dy<=1;dy++) for(var dx=-1;dx<=1;dx++) if((dx||dy) && g[I(x+dx,y+dy)]===PL.ROCK) walls++;
      n2[I(x,y)] = walls>=5 ? PL.ROCK : walls<=3 ? PL.FLOOR : g[I(x,y)];
    }
    g=n2;
  }

  /* 2. the entrance: an edge, a hallway in */
  var side=rnd(0,3), ent;
  if(side===0) ent={x:rnd(Math.floor(W*0.35), Math.floor(W*0.65)), y:H-3, dx:0, dy:-1};
  else if(side===1) ent={x:rnd(Math.floor(W*0.35), Math.floor(W*0.65)), y:2, dx:0, dy:1};
  else if(side===2) ent={x:2, y:rnd(Math.floor(H*0.35), Math.floor(H*0.65)), dx:1, dy:0};
  else ent={x:W-3, y:rnd(Math.floor(H*0.35), Math.floor(H*0.65)), dx:-1, dy:0};

  /* 3. two grottos in the corners away from the entrance: clear the rock around them first */
  var cx=Math.floor(W/2)+rnd(-5,5)-ent.dx*3, cy=Math.floor(H/2)+rnd(-2,2)-ent.dy*2;
  var corners=[{x:9,y:7},{x:W-10,y:7},{x:9,y:H-8},{x:W-10,y:H-8}]
    .map(function(c){ return {x:c.x+rnd(-2,2), y:c.y+rnd(-1,1), d:Math.abs(c.x-ent.x)+Math.abs(c.y-ent.y)}; })
    .sort(function(a,b){ return b.d-a.d; });
  var treasureAt=corners[0], poolAt=corners[1];
  if(r()<0.5){ var tmp=treasureAt; treasureAt=poolAt; poolAt=tmp; }
  function clearRing(c, rad){ for(var yy=c.y-rad;yy<=c.y+rad;yy++) for(var xx=c.x-rad;xx<=c.x+rad;xx++) if(inside(xx,yy,2)) g[I(xx,yy)]=PL.ROCK; }
  clearRing(treasureAt, 8); clearRing(poolAt, 7);

  /* 4. the central chamber and the entrance hallway */
  var chamber=blob(cx, cy, rnd(8,10), rnd(5,6));
  var hallLen=rnd(5,7), hx=ent.x, hy=ent.y;
  /* solid rock around the hallway, so it reads as a hallway */
  for(var k0=-1;k0<=hallLen;k0++) for(var w0=-2;w0<=2;w0++){ var rx0=ent.x+ent.dx*k0+(ent.dx===0?w0:0), ry0=ent.y+ent.dy*k0+(ent.dy===0?w0:0); if(inside(rx0,ry0,1)) g[I(rx0,ry0)]=PL.ROCK; }
  for(var k=0;k<hallLen;k++){ g[I(hx,hy)]=PL.FLOOR; if(ent.dx===0){ g[I(hx+1,hy)]=PL.ROCK; g[I(hx-1,hy)]=PL.ROCK; } else { g[I(hx,hy+1)]=PL.ROCK; g[I(hx,hy-1)]=PL.ROCK; } hx+=ent.dx; hy+=ent.dy; }
  tunnel(hx, hy, cx, cy, 2);

  /* the grottos themselves */
  var tr=rnd(3,4), pr=rnd(3,4);
  blob(treasureAt.x, treasureAt.y, tr, tr-1, undefined, true);
  blob(poolAt.x, poolAt.y, pr+1, pr, undefined, true);
  /* the treasure grotto hangs off a 1-wide neck: a real dead end */
  tunnel(treasureAt.x, treasureAt.y, cx+Math.sign(treasureAt.x-cx)*4, cy, 1);
  tunnel(poolAt.x, poolAt.y, cx, cy, 2);
  var pockets=rnd(1,2), sidePockets=[];
  for(var p=0;p<pockets;p++){
    var px=r()<0.5 ? rnd(5,12) : rnd(W-13,W-6), py=rnd(Math.floor(H*0.35), Math.floor(H*0.65));
    blob(px, py, rnd(2,3), 2); tunnel(px, py, cx, cy, 1); sidePockets.push({x:px,y:py});
  }

  /* 5. keep only what the entrance can reach */
  var seen=new Uint8Array(W*H), q=[I(ent.x,ent.y)], h=0; seen[q[0]]=1;
  while(h<q.length){ var c=q[h++], qx=c%W, qy=(c/W)|0; [[1,0],[-1,0],[0,1],[0,-1]].forEach(function(d){ var nx=qx+d[0], ny=qy+d[1]; if(!inside(nx,ny,1)) return; var ni=I(nx,ny); if(!seen[ni] && g[ni]!==PL.ROCK){ seen[ni]=1; q.push(ni); } }); }
  for(var i=0;i<g.length;i++) if(!seen[i]) g[i]=PL.ROCK;

  /* 6. the pieces */
  var T=PLANE_THEMES[element]||PLANE_THEMES.light;
  g[I(ent.x,ent.y)]=PL.ENTRY;
  /* centerpiece */
  if(T.centerKind==='voidpool'){ blob(cx, cy, 4, 2, PL.WATER).forEach(function(c){ if(r()<0.08) g[I(c.x,c.y)]=PL.FLOOR; }); g[I(cx,cy)]=PL.CENTER; }
  else if(T.centerKind==='mound'){ blob(cx, cy, 2, 1, PL.BLOCK); [[-3,-1],[3,1],[-2,2],[2,-2]].forEach(function(o){ g[I(cx+o[0],cy+o[1])]=PL.BLOCK; }); }
  else { blob(cx, cy, 2, 2, PL.CENTER); }
  /* pool grotto */
  blob(poolAt.x, poolAt.y, Math.max(1,pr-1), Math.max(1,pr-2), PL.WATER);
  /* treasure grotto: rune stone at the back, chest before it */
  var back={x:treasureAt.x-Math.sign(cx-treasureAt.x), y:treasureAt.y-Math.sign(cy-treasureAt.y)};
  g[I(back.x,back.y)]=PL.RUNE; g[I(treasureAt.x,treasureAt.y)]=PL.TREASURE;
  /* light sources and decoration along the walls */
  var decor=0, lights=0;
  for(y=3;y<H-3;y++) for(x=3;x<W-3;x++){
    if(g[I(x,y)]!==PL.FLOOR) continue;
    var rock=0; for(dy=-1;dy<=1;dy++) for(dx=-1;dx<=1;dx++) if(g[I(x+dx,y+dy)]===PL.ROCK) rock++;
    if(rock>=3 && r()<0.10){ g[I(x,y)]=PL.DECOR; decor++; }
    else if(rock===0 && r()<0.012){ g[I(x,y)]=PL.LIGHT; lights++; }
  }
  return {grid:g, w:W, h:H, element:element, seed:seed, entry:ent, center:{x:cx,y:cy}, treasure:treasureAt, pool:poolAt, pockets:sidePockets,
    floorCount:g.reduce(function(a,v){ return a+(v!==PL.ROCK?1:0); },0), decor:decor, lights:lights};
}

/* dev: draw a layout in plain colors */
function planePreview(m, scale){
  scale=scale||10;
  var T=PLANE_THEMES[m.element], c=document.createElement('canvas'); c.width=m.w*scale; c.height=m.h*scale+22;
  var x2=c.getContext('2d'); x2.fillStyle='#14121A'; x2.fillRect(0,0,c.width,c.height);
  var col={}; col[PL.ROCK]=T.rock; col[PL.FLOOR]=T.floor; col[PL.WATER]=T.water; col[PL.CENTER]=T.center; col[PL.DECOR]=T.decor;
  col[PL.TREASURE]='#E8B44A'; col[PL.RUNE]='#FFFFFF'; col[PL.ENTRY]='#FF5A5A'; col[PL.LIGHT]=T.light; col[PL.BLOCK]=T.block;
  for(var y=0;y<m.h;y++) for(var x=0;x<m.w;x++){
    var v=m.grid[y*m.w+x];
    if(v===PL.ROCK){ var near=false; for(var dy=-1;dy<=1&&!near;dy++) for(var dx=-1;dx<=1;dx++){ var nx=x+dx, ny=y+dy; if(nx>=0&&ny>=0&&nx<m.w&&ny<m.h&&m.grid[ny*m.w+nx]!==PL.ROCK){ near=true; break; } } if(!near) continue; }
    x2.fillStyle=col[v]; x2.fillRect(x*scale, y*scale, scale, scale);
  }
  x2.fillStyle='#EDE6DA'; x2.font='13px monospace'; x2.fillText(T.name+'  seed '+m.seed, 6, m.h*scale+16);
  return c;
}
