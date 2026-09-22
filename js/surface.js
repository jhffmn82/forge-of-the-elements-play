/* =====================================================================
   surface.js - continuous terrain (map-art pass, 2026-09-17).
   The old renderer gave every cell its own 64px tile, picked by hash from sets that mixed stone scales,
   brick-pattern "floor", mossy repavings, runes and grates, and mixed rough rock with dark brick on wall
   tops. Now:
   - Floor, wall face and wall top each come from one large seamless surface (tools/terrainart.py),
     sampled by world coordinate, so neighbouring cells always continue the same stones and courses.
   - Wall tops get a capstone rim on every edge that meets open ground; wall faces show their ends.
   - Decoration is placed by rule (pebbles gather at walls, damp moss in corners, rare drains and cracks),
     drawn as transparent pieces or cached per-cell rasters with irregular, tapering edges.
   - Everything is chosen from world coordinates plus the floor's seed through hash2: stable across frames,
     camera moves and revisits, and it never touches the gameplay rng.
   ===================================================================== */

var SURF_P = 12;                        /* cells per repeat of each surface */
/* Cache subtle mineral grain in the constructed stone surfaces. Work at the
   original two-pixel grain, preserving mortar and bevels and never using rng. */
var WALL_GRAIN_CACHE = new WeakMap();
function weatheredMasonry(img){
  if(!img || !(img.naturalWidth||img.width)) return img;
  if(WALL_GRAIN_CACHE.has(img)) return WALL_GRAIN_CACHE.get(img);
  var c=document.createElement('canvas');
  c.width=img.naturalWidth||img.width; c.height=img.naturalHeight||img.height;
  var g=c.getContext('2d'); g.drawImage(img,0,0);
  var im=g.getImageData(0,0,c.width,c.height), d=im.data;
  function grain(x,y,s){var n=Math.imul(x+17,374761393)^Math.imul(y+31,668265263)^s;n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967296;}
  for(var y=0;y<c.height;y++)for(var x=0;x<c.width;x++){
    var i=(y*c.width+x)*4, lum=(d[i]+d[i+1]+d[i+2])/3;
    if(!d[i+3]||lum<16)continue; // preserve deep joints without skipping dark brick
    var u=x>>1,v=y>>1,n=grain(u,v,71),patch=grain(u>>2,v>>2,193);
    var delta=((n-.5)*20+(patch-.5)*15)*Math.min(1,(lum-16)/22);
    if(n<.065)delta-=9; else if(n>.96)delta+=6;
    for(var k=0;k<3;k++)d[i+k]=Math.max(0,Math.min(255,d[i+k]+delta));
  }
  g.putImageData(im,0,0); WALL_GRAIN_CACHE.set(img,c); return c;
}
function surfImg(name){
  /* a biome or plane with its own stone uses it: surface-crypt-floor, surface-light-floor ... */
  var pre = (typeof floorMeta!=='undefined' && floorMeta && floorMeta.plane) ? floorMeta.plane : (typeof bidx==='function' && bidx()===1 ? 'crypt' : null);
  var key=pre && AS.surface && AS.surface[pre+'-'+name] ? pre+'-'+name : name;
  var img=(AS.surface && AS.surface[key]) ? atl('surface-'+key+'.png') : null;
  return ['face','top','rim-n','rim-v'].indexOf(name)>=0 ? weatheredMasonry(img) : img;
}
function surfSalt(){ return ((typeof worldSeed==='number' ? worldSeed : 0) % 9973) + floorNo*31; }
function smod(v){ return ((v % SURF_P) + SURF_P) % SURF_P; }
function surfOff(k){ return Math.floor(hash2(surfSalt(), k, 77)*SURF_P); }
function isDoorTile(t){ return t===DOOR || t===LOCKED || t===TOLL || t===ICEDOOR || t===THORNS || t===SEALED; }
function openGround(x,y){ if(!inb(x,y)) return false; var t=at(x,y); return !isWallLike(t); }

/* ---------------------------------------------------------------- base tiles */
var _floorTileSurf = floorTile;
floorTile = function(x, y){
  var t=at(x,y);
  /* a closed door sits in masonry: the wall around the arch, not open floor */
  if(isDoorTile(t)){
    if(isWallLike(at(x-1,y)) || isWallLike(at(x+1,y))){ var fimg=surfImg('face'); if(fimg) return {img:fimg, sx:smod(x+surfOff(2))*64, sy:0, sw:64, sh:64}; }
  }
  var img=surfImg('floor'); if(!img) return _floorTileSurf(x, y);
  var per=img.naturalWidth ? Math.max(1, Math.round(img.naturalWidth/64)) : SURF_P;   /* the Crypt floor repeats every 24 cells */
  return {img:img, sx:((x+surfOff(0))%per+per)%per*64, sy:((y+surfOff(1))%per+per)%per*64, sw:64, sh:64};
};
function sideDoorAt(x,y){ var t=at(x,y); return (isDoorTile(t)||t===OPEN) && sideDoor(x,y); }
function wallFaces(x,y){ var south=at(x,y+1); return !(south===WALL || south===SECRET) && !sideDoorAt(x,y+1); }
var _wallTileSurf = wallTile;
wallTile = function(x, y){
  var faceBelow=wallFaces(x,y);
  if(faceBelow){ var f=surfImg('face'); if(f) return {img:f, sx:smod(x+surfOff(2))*64, sy:0, sw:64, sh:64}; }
  else { var t=surfImg('top'); if(t) return {img:t, sx:smod(x+surfOff(3))*64, sy:smod(y+surfOff(4))*64, sw:64, sh:64}; }
  return _wallTileSurf(x, y);
};

/* ---------------------------------------------------------------- wall edges, ends and fixtures */
var DECO = {pebble:[0,1,2], crack:[3,4,5], drain:6, damage:[7,8], sconce:9, banner:[10,11], cap:12};
var RIM = 20;   /* capstone depth in the 64px source */
function drawDeco(i, px, py, alpha, opt){
  var img=surfImg('deco'); if(!img) return;
  opt=opt||{};
  ctx.save(); ctx.globalAlpha=alpha*(opt.a===undefined?1:opt.a); ctx.imageSmoothingEnabled=false;
  var s=opt.s||1, w=TS*s;
  ctx.drawImage(img, i*64, 0, 64, 64, Math.round(px+(opt.dx||0)*TS+(TS-w)/2), Math.round(py+(opt.dy||0)*TS+(TS-w)/2), Math.round(w), Math.round(w));
  ctx.restore();
}
function drawWallEdges(x, y, t, px, py, a){
  var faceBelow = wallFaces(x,y);
  ctx.save(); ctx.globalAlpha=a; ctx.imageSmoothingEnabled=false;
  if(faceBelow){
    /* a face that ends beside open ground shows its corner stones */
    var e=Math.max(2, Math.round(TS*0.09));
    if(openGround(x-1,y) && !isDoorTile(at(x-1,y))){ ctx.fillStyle='rgba(18,20,26,0.55)'; ctx.fillRect(px,py,e,TS); ctx.fillStyle='rgba(120,124,132,0.35)'; ctx.fillRect(px+e,py,1,TS); }
    if(openGround(x+1,y) && !isDoorTile(at(x+1,y))){ ctx.fillStyle='rgba(18,20,26,0.55)'; ctx.fillRect(px+TS-e,py,e,TS); }
    /* a secret wall keeps its tell: a straight seam through the courses */
    if(t===SECRET){ ctx.fillStyle='rgba(20,22,28,0.7)'; ctx.fillRect(px+Math.round(TS*0.47),py+Math.round(TS*0.12),Math.max(1,Math.round(TS*0.04)),Math.round(TS*0.76)); }
    else if(typeof wallTorchAt==='function' && wallTorchAt(x,y)) drawDeco(DECO.sconce, px, py, 1, {dy:-0.02});
    else {
      var h=hash2(x,y,11);
      if(h<0.12){
        var rare=WALL_FACE_RARE[Math.floor(hash2(x,y,5)*WALL_FACE_RARE.length)];
        if((rare===9 || rare===10) && !(typeof bidx==='function' && bidx()===1)) drawDeco(DECO.banner[rare===9?0:1], px, py, 1);   /* no banners in the Crypt */
        else if(rare===1 || rare===2) drawDeco(DECO.crack[rare===1?0:1], px, py, 1, {a:0.55});
      }
    }
  } else {
    /* a wall top meeting open ground: capstones along that edge, pillar caps where runs meet or turn */
    var rn=surfImg('rim-n'), rv=surfImg('rim-v'), rw=Math.max(4, Math.round(TS*RIM/64));
    var oN=openGround(x,y-1), oW=openGround(x-1,y), oE=openGround(x+1,y);
    if(rn && oN) ctx.drawImage(rn, smod(x+surfOff(5))*64, 0, 64, RIM, px, py, TS, rw);
    if(rv && oW) ctx.drawImage(rv, 0, smod(y+surfOff(6))*64, RIM, 64, px, py, rw, TS);
    if(rv && oE) ctx.drawImage(rv, 0, smod(y+surfOff(7))*64, RIM, 64, px+TS-rw, py, rw, TS);
    /* where a side run reaches the face row below it, it caps into that face's coping */
    var faceS = isWallLike(at(x,y+1)) && wallFaces(x,y+1);
    var caps=[];
    if(oN && oW) caps.push([0,0]); if(oN && oE) caps.push([1,0]);
    if(!oN && !oW && openGround(x-1,y-1)) caps.push([0,0]);
    if(!oN && !oE && openGround(x+1,y-1)) caps.push([1,0]);
    if(oW && faceS && !openGround(x-1,y+1)) caps.push([0,1]);
    if(oE && faceS && !openGround(x+1,y+1)) caps.push([1,1]);
    if(!oW && !oE && faceS && (openGround(x-1,y+1) || openGround(x+1,y+1))) caps.push([openGround(x-1,y+1)?0:1, 1]);
    caps.forEach(function(c){
      var cs=Math.round(rw*1.45), cx=px+(c[0]?TS-cs+Math.round((cs-rw)/2):-Math.round((cs-rw)/2)), cy=py+(c[1]?TS-cs+Math.round((cs-rw)/2):-Math.round((cs-rw)/2));
      var img=surfImg('deco'); if(img) ctx.drawImage(img, 12*64+18, 18, 28, 28, cx, cy, cs, cs);
    });
  }
  ctx.restore();
}

/* ---------------------------------------------------------------- moss and bones: cached rasters with ragged edges */
var SURF_CACHE = {key:null, cells:{}};
function surfCache(){
  var k=surfSalt()+':'+MW+'x'+MH;
  if(SURF_CACHE.key!==k){ SURF_CACHE={key:k, cells:{}}; }
  return SURF_CACHE.cells;
}
var _generateSurf = generate;
generate = function(seed){ _generateSurf(seed); SURF_CACHE.key=null; };

/* moss seeds: every G_MOSS cell, plus damp inner corners of rooms */
function mossSeeds(x, y){
  var out=[];
  for(var yy=y-2; yy<=y+2; yy++) for(var xx=x-2; xx<=x+2; xx++){
    if(!inb(xx,yy) || isWallLike(at(xx,yy))) continue;
    var salt=surfSalt();
    if(ground[idxOf(xx,yy)]===G_MOSS) out.push({x:xx+0.5+(hash2(xx,yy,salt+41)-0.5)*0.5, y:yy+0.5+(hash2(xx,yy,salt+42)-0.5)*0.5, r:0.7+0.35*hash2(xx,yy,salt+43)});
    /* an inner corner: walls on two touching sides */
    var wn=isWallLike(at(xx,yy-1)), ws=isWallLike(at(xx,yy+1)), ww=isWallLike(at(xx-1,yy)), we=isWallLike(at(xx+1,yy));
    if(((wn||ws)&&(ww||we)) && hash2(xx,yy,salt+44)<0.3){
      out.push({x:xx+(ww?0.05:0.95), y:yy+(wn?0.05:0.95), r:0.75+0.35*hash2(xx,yy,salt+45)});
    }
  }
  return out;
}
function mossRaster(x, y){
  var seeds=mossSeeds(x,y); if(!seeds.length) return null;
  var R=32, c=document.createElement('canvas'); c.width=R; c.height=R;
  var g=c.getContext('2d'), im=g.createImageData(R,R), D=im.data, any=false, salt=surfSalt();
  for(var v=0; v<R; v++) for(var u=0; u<R; u++){
    var wx=x+(u+0.5)/R, wy=y+(v+0.5)/R, d=0;
    for(var k=0;k<seeds.length;k++){ var s=seeds[k], dd=Math.sqrt((wx-s.x)*(wx-s.x)+(wy-s.y)*(wy-s.y))/s.r; if(dd<1) d=Math.max(d, 1-dd); }
    if(d<=0) continue;
    /* grain: two scales of hashed noise break the edge into clumps and stray pixels */
    var gx=Math.floor(wx*16), gy=Math.floor(wy*16), n1=hash2(gx,gy,salt+50), n2=hash2(Math.floor(wx*6),Math.floor(wy*6),salt+51);
    /* clumps with holes: coarse noise decides the clump, fine noise ragged-edges it */
    var val=d*1.1 + (n2-0.5)*0.55 + (n1-0.5)*0.18;
    if(val<0.62) continue;
    var dense=Math.min(1,(val-0.62)*2.6), p=(v*R+u)*4;
    var cols=[[70,80,36],[86,96,42],[104,112,52],[56,64,30]];
    var cc=cols[Math.min(3, Math.floor(n1*3 + dense))];
    D[p]=cc[0]; D[p+1]=cc[1]; D[p+2]=cc[2]; D[p+3]=Math.round(210+45*dense); any=true;
  }
  if(!any) return null;
  g.putImageData(im,0,0); return c;
}
function bonesRaster(x, y){
  // Native canvas decoration: fine contours instead of magnified 32px blocks.
  var R=128,c=document.createElement('canvas');c.width=R;c.height=R;
  var g=c.getContext('2d'),salt=surfSalt(),H=function(k){return hash2(x,y,salt+60+k);};
  g.scale(4,4);
  function oval(cx,cy,rx,ry,col){g.fillStyle=col;g.beginPath();g.ellipse(cx,cy,rx,ry,0,0,Math.PI*2);g.fill();}
  var n=3+Math.floor(H(0)*3);
  for(var i=0;i<n;i++){
    var cx=6+H(i*3+1)*20,cy=8+H(i*3+2)*16,len=4+H(i*5+4)*5;
    g.save();g.translate(cx,cy);g.rotate(H(i*3+3)*Math.PI);
    g.lineCap='round';g.strokeStyle='rgba(22,19,15,.45)';g.lineWidth=1.8;
    g.beginPath();g.moveTo(-len/2+.3,.5);g.lineTo(len/2+.3,.5);g.stroke();
    g.strokeStyle='#918776';g.lineWidth=1.25;g.beginPath();g.moveTo(-len/2,0);g.quadraticCurveTo(0,.5,len/2,0);g.stroke();
    g.strokeStyle='#c4b9a1';g.lineWidth=.7;g.beginPath();g.moveTo(-len/2,-.2);g.quadraticCurveTo(0,.2,len/2,-.2);g.stroke();
    [-1,1].forEach(function(end){oval(end*len/2,-.35,.65,.55,'#c9bea7');oval(end*len/2,.35,.6,.5,'#b2a58c');oval(end*len/2-.15,-.48,.3,.2,'#dfd2b6');});
    g.restore();
  }
  if(H(30)<.5){
    g.save();g.translate(11+H(31)*14,12+H(32)*10);g.rotate((H(33)-.5)*1.1);
    oval(.35,.5,2.9,2.55,'rgba(22,19,15,.5)');
    var bone=g.createLinearGradient(-2,-2,2,2);bone.addColorStop(0,'#d8ccb1');bone.addColorStop(.55,'#bdb097');bone.addColorStop(1,'#8e816c');
    oval(0,-.3,2.65,2.2,bone);oval(0,1.45,1.8,.9,'#ac9c81');
    oval(-1,-.15,.72,.83,'#403a31');oval(1,-.15,.72,.83,'#403a31');
    oval(-1.12,-.3,.36,.45,'#292620');oval(.88,-.3,.36,.45,'#292620');
    g.fillStyle='#51483b';g.beginPath();g.moveTo(0,.5);g.lineTo(-.4,1.1);g.lineTo(.4,1.1);g.fill();
    g.strokeStyle='#776a55';g.lineWidth=.18;
    for(var t=-1;t<=1;t+=.5){g.beginPath();g.moveTo(t,1.4);g.lineTo(t,2);g.stroke();}
    g.beginPath();g.moveTo(.2,-2.25);g.lineTo(-.2,-1.65);g.lineTo(.2,-1.3);g.stroke();
    g.restore();
  }
  return c;
}
function cachedRaster(kind, x, y, fn){
  var cells=surfCache(), key=kind+x+','+y;
  if(!(key in cells)) cells[key]=fn(x,y);
  return cells[key];
}
function blitRaster(c, px, py, alpha){
  if(!c) return;
  ctx.save(); ctx.globalAlpha=alpha; ctx.imageSmoothingEnabled=c.width>32; ctx.drawImage(c, 0,0,c.width,c.height, px,py,TS,TS); ctx.restore();
}

/* moss and bones are drawn by the surface pass now */
var _drawGroundDecalSurf = drawGroundDecal;
drawGroundDecal = function(gv, x, y, px, py, alpha, now){
  if(gv===G_MOSS) return true;
  if(gv===G_BONES){ blitRaster(cachedRaster('b', x, y, bonesRaster), px, py, alpha); return true; }
  return _drawGroundDecalSurf(gv, x, y, px, py, alpha, now);
};

/* ---------------------------------------------------------------- the decoration pass (after terrain, before ground decals) */
function drawSurfaceDeco(){
  if(!surfImg('floor')) return;
  var salt=surfSalt();
  for(var y=camY; y<=camY+viewH; y++) for(var x=camX; x<=camX+viewW; x++){
    if(!inb(x,y)) continue; var i=idxOf(x,y); if(!(revealAll||seen[i])) continue;
    var t=map[i]; if(isWallLike(t) || t===CHASM || t===WATER) continue;
    var px=(x-camX)*TS, py=(y-camY)*TS, a=(revealAll||vis[i])?1:memA(0.4);
    blitRaster(cachedRaster('m', x, y, mossRaster), px, py, a);
    if(t!==FLOOR || ground[i] || propAt(x,y)) continue;
    var wn=isWallLike(at(x,y-1)), ws=isWallLike(at(x,y+1)), ww=isWallLike(at(x-1,y)), we=isWallLike(at(x+1,y));
    var nearWall=wn||ws||ww||we, h=hash2(x,y,salt+70);
    if(nearWall && h<0.08){
      /* grit gathers against the wall it fell from */
      drawDeco(DECO.pebble[Math.floor(hash2(x,y,salt+71)*3)], px, py, a, {dx:ww?-0.22:we?0.22:0, dy:wn?-0.2:ws?0.24:0});
    } else if(!nearWall && h<0.012){
      drawDeco(DECO.drain, px, py, a, {s:0.9});
    } else if(!nearWall && h>0.975){
      drawDeco(DECO.crack[Math.floor(hash2(x,y,salt+72)*3)], px, py, a, {a:0.6});
    }
  }
}

/* ---------------------------------------------------------------- flat props: bones and rubble lie in the floor */
function drawPropSurface(p, px, py, alpha){
  if(!surfImg('deco')) return false;
  if(p.name==='bones'){ blitRaster(cachedRaster('pb', p.x, p.y, bonesRaster), px, py, alpha); return true; }
  if(p.name==='bookshelf'){
    /* shelves fill the tile's width so a row of them stands nearly flush against the wall */
    var o=objArt('props','bookshelf'); if(!o) return false;
    var w=TS*0.98, h=o.sh*(w/o.sw);
    propShadow(p.x, p.y, px, py, alpha, 'bookshelf');
    ctx.save(); ctx.globalAlpha=alpha; ctx.imageSmoothingEnabled=false;
    ctx.drawImage(o.img, o.sx, o.sy, o.sw, o.sh, Math.round(px+(TS-w)/2), Math.round(py+TS*0.97-h), Math.round(w), Math.round(h));
    ctx.restore(); return true;
  }
  if(p.name==='rubble'){ drawDeco(DECO.pebble[Math.floor(hash2(p.x,p.y,surfSalt()+73)*3)], px, py, alpha, {s:1.05}); return true; }
  return false;
}

/* ---------------------------------------------------------------- doors in east/west walls
   A door whose walls run north-south is seen from above, not face on: capstone jambs at its ends and the
   leaf as a heavy plank across the passage. Open, the leaf stands swung back against the room side. */
function sideDoor(x, y){ return isWallLike(at(x,y-1)) && isWallLike(at(x,y+1)) && !isWallLike(at(x-1,y)) && !isWallLike(at(x+1,y)); }
function drawSideDoor(x, y, t, px, py, a){
  if(!(isDoorTile(t) || t===OPEN) || !sideDoor(x,y) || !surfImg('deco')) return false;
  if(t===ICEDOOR || t===THORNS) return false;   /* ice and thorns fill the gap anyway */
  var deco=surfImg('deco'), rw=Math.max(4, Math.round(TS*RIM/64));
  ctx.save(); ctx.globalAlpha=a; ctx.imageSmoothingEnabled=false;
  var crystal = t===SEALED && floorMeta.crystalDoor && floorMeta.crystalDoor.x===x && floorMeta.crystalDoor.y===y;
  var iron = t===LOCKED || (t===SEALED && !crystal) || (t===OPEN && floorMeta.ironDoors && floorMeta.ironDoors[idxOf(x,y)]);
  var pal = crystal ? {leaf:'#6FC6DE', hi:'#C8F2FF', lo:'#2F6E86', band:'#E8FBFF'} : iron ? {leaf:'#5A5D66', hi:'#8E929C', lo:'#2B2D33', band:'#2B2D33'} : {leaf:'#6B4726', hi:'#8E6238', lo:'#3A2614', band:'#2E2A26'};
  var lw=Math.max(6, Math.round(TS*0.26)), cx=px+Math.round(TS/2);
  function plankV(x0, y0, w, h){
    ctx.fillStyle='rgba(0,0,0,0.35)'; ctx.fillRect(x0+2, y0+1, w, h);
    ctx.fillStyle=pal.lo; ctx.fillRect(x0-1, y0, w+2, h);
    ctx.fillStyle=pal.leaf; ctx.fillRect(x0, y0, w, h);
    ctx.fillStyle=pal.hi; ctx.fillRect(x0, y0, 1, h);
    if(!crystal){ ctx.fillStyle=pal.lo; for(var k=1;k<3;k++) ctx.fillRect(x0+Math.round(w*k/3), y0, 1, h); }   /* boards */
    ctx.fillStyle=pal.band; ctx.fillRect(x0-1, y0+Math.round(h*0.2), w+2, 2); ctx.fillRect(x0-1, y0+Math.round(h*0.76), w+2, 2);
  }
  function plankH(x0, y0, w, h){
    ctx.fillStyle='rgba(0,0,0,0.35)'; ctx.fillRect(x0+1, y0+2, w, h);
    ctx.fillStyle=pal.lo; ctx.fillRect(x0, y0-1, w, h+2);
    ctx.fillStyle=pal.leaf; ctx.fillRect(x0, y0, w, h);
    ctx.fillStyle=pal.hi; ctx.fillRect(x0, y0, w, 1);
    ctx.fillStyle=pal.band; ctx.fillRect(x0+Math.round(w*0.2), y0-1, 2, h+2); ctx.fillRect(x0+Math.round(w*0.76), y0-1, 2, h+2);
  }
  if(t===OPEN){
    /* swung back into the room, lying edge-on against the wall above the doorway */
    var roomE = !!roomAt(x+1,y), ox = roomE ? px+TS-Math.round(lw*0.2) : px-TS+Math.round(lw*0.2);
    plankH(ox, py-Math.round(lw*0.55), TS, Math.max(4, Math.round(lw*0.55)));
  } else {
    /* the door fills the hall from post to post */
    plankV(cx-Math.round(lw/2), py, lw, TS);
    if(t===TOLL){ ctx.fillStyle='#B8B2A6'; for(var k2=0;k2<4;k2++){ var sy=py+Math.round(TS*(0.14+0.24*k2)); ctx.fillRect(cx-Math.round(lw/2)-4, sy, 4, 2); ctx.fillRect(cx+Math.round(lw/2), sy, 4, 2); } }
    if(t===LOCKED || crystal){ ctx.fillStyle=crystal?'#FFFFFF':'#E8B44A'; ctx.fillRect(cx-1, py+Math.round(TS/2)-3, 3, 5); }
    else if(!iron){ ctx.fillStyle='#C9A870'; ctx.fillRect(cx+Math.round(lw/2)-3, py+Math.round(TS/2), 2, 3); }
    if(crystal && !ANIM.reduce){ ctx.globalCompositeOperation='lighter'; ctx.globalAlpha=a*0.25; ctx.fillStyle='#9FE8FF'; ctx.fillRect(cx-Math.round(lw/2)-2, py, lw+4, TS); ctx.globalCompositeOperation='source-over'; ctx.globalAlpha=a; }
  }
  /* the frame: a capstone lintel along the wall above and below the doorway, outside the hall square,
     ending in square caps laid exactly where the wall's own corner caps sit so the two overlap */
  var rn=surfImg('rim-n'), cs=Math.round(rw*1.45), ofs=Math.round((cs-rw)/2);
  [[py-rw, py-rw+rw-cs+ofs], [py+TS, py+TS-ofs]].forEach(function(r, k){
    if(rn) ctx.drawImage(rn, smod(x+surfOff(8+k))*64, 0, 64, RIM, px, r[0], TS, rw);
    [[px-ofs], [px+TS-cs+ofs]].forEach(function(c){ ctx.drawImage(deco, 12*64+18, 18, 28, 28, c[0], r[1], cs, cs); });
  });
  ctx.restore();
  return true;
}

/* ---------------------------------------------------------------- water: rounded pools instead of square overlays
   A metaball field over the water cells: every water tile stays fully wet at its centre, while the edge rounds
   off and bulges a little into neighbouring open ground, so a pool never reads as a square. Visual only: the
   water tiles (and their movement rules) are unchanged. */
function isWaterAt(x,y){ return inb(x,y) && at(x,y)===WATER; }
function waterSig(x,y){ var s=''; for(var yy=y-2;yy<=y+2;yy++) for(var xx=x-2;xx<=x+2;xx++) s+=isWaterAt(xx,yy)?'1':'0'; return s; }
function waterRaster(x, y){
  var R=32, cells=[];
  for(var yy=y-2;yy<=y+2;yy++) for(var xx=x-2;xx<=x+2;xx++) if(isWaterAt(xx,yy)) cells.push([xx+0.5, yy+0.5]);
  if(!cells.length) return null;
  var c=document.createElement('canvas'); c.width=R; c.height=R;
  var g=c.getContext('2d'), im=g.createImageData(R,R), D=im.data, salt=surfSalt(), any=false;
  for(var v=0; v<R; v++) for(var u=0; u<R; u++){
    var wx=x+(u+0.5)/R, wy=y+(v+0.5)/R, f=0;
    for(var k=0;k<cells.length;k++){ var dx=wx-cells[k][0], dy=wy-cells[k][1], d=Math.sqrt(dx*dx+dy*dy)/1.4; if(d<1) f+=(1-d)*(1-d); }
    /* lobes: a slow wobble in the shoreline, then a pixel of grain */
    var lx=wx*1.7, ly=wy*1.7, ix=Math.floor(lx), iy=Math.floor(ly), fx=lx-ix, fy=ly-iy;
    var h00=hash2(ix,iy,salt+92), h10=hash2(ix+1,iy,salt+92), h01=hash2(ix,iy+1,salt+92), h11=hash2(ix+1,iy+1,salt+92);
    var lobe=(h00*(1-fx)+h10*fx)*(1-fy)+(h01*(1-fx)+h11*fx)*fy-0.5;
    var n=hash2(Math.floor(wx*12), Math.floor(wy*12), salt+90)-0.5;
    var edge=f + lobe*0.16 + n*0.03;
    if(edge<0.2) continue;
    var p=(v*R+u)*4, deep=Math.min(1,(edge-0.2)*2.2);
    var rim = edge<0.27;
    var col = rim ? [96,132,146] : [36+(1-deep)*22, 66+(1-deep)*24, 86+(1-deep)*20];
    /* a few soft glints */
    D[p]=col[0]; D[p+1]=col[1]; D[p+2]=col[2]; D[p+3]= rim ? 170 : Math.round(185+45*deep); any=true;
  }
  if(!any) return null;
  g.putImageData(im,0,0); return c;
}
if(!AS.wang_water) AS.wang_water={cell:64, tiles:{}, procedural:true};   /* keeps render.js's square fallback off */
var _drawWangLayerSurf = drawWangLayer;
drawWangLayer = function(key, tileType){
  if(key!=='water' || !surfImg('floor')) return _drawWangLayerSurf(key, tileType);
  for(var y=camY-1; y<=camY+viewH+1; y++) for(var x=camX-1; x<=camX+viewW+1; x++){
    if(!inb(x,y)) continue; var i=idxOf(x,y); if(!(revealAll||seen[i])) continue;
    var t=map[i]; if(isWallLike(t) && t!==WATER) continue;
    var near=false; for(var dy=-1;dy<=1 && !near;dy++) for(var dx=-1;dx<=1;dx++) if(isWaterAt(x+dx,y+dy)){ near=true; break; }
    if(!near) continue;
    var c=cachedRaster('w'+waterSig(x,y)+'@', x, y, waterRaster);
    blitRaster(c, (x-camX)*TS, (y-camY)*TS, (revealAll||vis[i])?1:memA(0.4));
    if(isWaterAt(x,y) && (revealAll||vis[i])) waterGlints(x, y, (x-camX)*TS, (y-camY)*TS);
  }
  ctx.globalAlpha=1;
};

/* ---------------------------------------------------------------- tall grass: a ragged bed of shade under the blades
   (the blades themselves, and grass's sight and fire rules, are unchanged) */
function grassSig(x,y){ var s=''; for(var yy=y-1;yy<=y+1;yy++) for(var xx=x-1;xx<=x+1;xx++) s+=(inb(xx,yy)&&ground[idxOf(xx,yy)]===G_GRASS)?'1':'0'; return s; }
function grassRaster(x, y){
  var R=32, cells=[];
  for(var yy=y-1;yy<=y+1;yy++) for(var xx=x-1;xx<=x+1;xx++) if(inb(xx,yy) && ground[idxOf(xx,yy)]===G_GRASS && !isWallLike(at(xx,yy))) cells.push([xx+0.5,yy+0.5]);
  if(!cells.length) return null;
  var c=document.createElement('canvas'); c.width=R; c.height=R;
  var g=c.getContext('2d'), im=g.createImageData(R,R), D=im.data, salt=surfSalt(), any=false;
  for(var v=0; v<R; v++) for(var u=0; u<R; u++){
    var wx=x+(u+0.5)/R, wy=y+(v+0.5)/R, f=0;
    for(var k=0;k<cells.length;k++){ var dx=wx-cells[k][0], dy=wy-cells[k][1], d=Math.sqrt(dx*dx+dy*dy)/1.15; if(d<1) f+=(1-d)*(1-d); }
    var n=hash2(Math.floor(wx*8), Math.floor(wy*8), salt+95)-0.5, n2=hash2(Math.floor(wx*20), Math.floor(wy*20), salt+96)-0.5;
    var val=f + n*0.25 + n2*0.08;
    if(val<0.3) continue;
    var p=(v*R+u)*4, dense=Math.min(1,(val-0.3)*2);
    D[p]=24; D[p+1]=44; D[p+2]=18; D[p+3]=Math.round(40+70*dense); any=true;
  }
  if(!any) return null;
  g.putImageData(im,0,0); return c;
}
/* trampled grass (G_SHORT): the flattened mat the blades lie on. A flat fillRect over the tile read as a green
   square on the stone, so this is the same ragged field as the tall-grass bed, at a smaller radius, and it leans
   into neighbouring grass so a walked path blends with the patch it came from. */
function tramSig(x,y){
  var s='';
  for(var yy=y-1;yy<=y+1;yy++) for(var xx=x-1;xx<=x+1;xx++){
    var g=inb(xx,yy)?ground[idxOf(xx,yy)]:0; s+=(g===G_SHORT?'2':g===G_GRASS?'1':'0');
  }
  return s;
}
function tramRaster(x, y){
  var R=32, cells=[];
  for(var yy=y-1;yy<=y+1;yy++) for(var xx=x-1;xx<=x+1;xx++){
    if(!inb(xx,yy) || isWallLike(at(xx,yy))) continue;
    var g=ground[idxOf(xx,yy)];
    if(g===G_SHORT) cells.push([xx+0.5, yy+0.5, 1]);
    else if(g===G_GRASS) cells.push([xx+0.5, yy+0.5, 0.55]);
  }
  if(!cells.length) return null;
  var c=document.createElement('canvas'); c.width=R; c.height=R;
  var g2=c.getContext('2d'), im=g2.createImageData(R,R), D=im.data, salt=surfSalt(), any=false;
  for(var v=0; v<R; v++) for(var u=0; u<R; u++){
    var wx=x+(u+0.5)/R, wy=y+(v+0.5)/R, f=0;
    for(var k=0;k<cells.length;k++){
      var dx=wx-cells[k][0], dy=wy-cells[k][1], d=Math.sqrt(dx*dx+dy*dy)/0.92;
      if(d<1) f+=(1-d)*(1-d)*cells[k][2];
    }
    var n=hash2(Math.floor(wx*7), Math.floor(wy*7), salt+120)-0.5,
        n2=hash2(Math.floor(wx*18), Math.floor(wy*18), salt+121)-0.5,
        n3=hash2(Math.floor(wx*40), Math.floor(wy*40), salt+122)-0.5;
    var val=f + n*0.34 + n2*0.14 + n3*0.08;
    if(val<0.34) continue;
    var p=(v*R+u)*4, dense=Math.min(1,(val-0.34)*2.4), dark=n3>0.2;
    D[p]=dark?22:32; D[p+1]=dark?38:54; D[p+2]=dark?16:24; D[p+3]=Math.round(26+44*dense); any=true;
  }
  if(!any) return null;
  g2.putImageData(im,0,0); return c;
}
function drawGrassBed(){
  for(var y=camY; y<=camY+viewH; y++) for(var x=camX; x<=camX+viewW; x++){
    if(!inb(x,y)) continue; var i=idxOf(x,y); if(!(revealAll||seen[i]) || isWallLike(map[i])) continue;
    var near=false; for(var dy=-1;dy<=1 && !near;dy++) for(var dx=-1;dx<=1;dx++){ var xx=x+dx, yy=y+dy; if(inb(xx,yy) && ground[idxOf(xx,yy)]===G_GRASS){ near=true; break; } }
    if(!near) continue;
    blitRaster(cachedRaster('g'+grassSig(x,y)+'@', x, y, grassRaster), (x-camX)*TS, (y-camY)*TS, (revealAll||vis[i])?1:memA(0.4));
  }
}
var _drawSurfaceDecoGrass = drawSurfaceDeco;
drawSurfaceDeco = function(){ _drawSurfaceDecoGrass(); drawGrassBed(); };

/* ---------------------------------------------------------------- props sit on the stone: a soft contact shadow */
var PROP_SHADOW = {chest:0.34, crate:0.36, barrel:0.3, 'barrel-explosive':0.3, pot:0.28, 'brazier-lit':0.32, 'brazier-unlit':0.32, 'torch-stand':0.16,
  'table-candle':0.3, bookshelf:0.42, 'weapon-rack':0.36, cart:0.42, statue:0.34, 'statue-broken':0.34, 'banner-stand':0.3, 'alchemy-table':0.38,
  cage:0.4, fountain:0.44, 'altar-spikes':0.4, 'chest-wood-open':0.34};
/* PR #4: scenery sits flush with the floor. Only actors cast contact shadows. */
function propShadow(){}

/* ---------------------------------------------------------------- animated pixel flames on braziers, torch stands and candles
   anchor: where the flame's base sits in the trimmed sprite (measured from the art); size: flame height in tiles */
var FLAME_AT = {'brazier-lit':{ax:0.49, ay:0.26, size:0.46, wide:1.5}, 'torch-stand':{ax:0.53, ay:0.2, size:0.26, wide:0.9}, 'table-candle':{ax:0.5, ay:0.12, size:0.14, wide:0.7}};
function propFlame(p, o, px, py, alpha, now){
  var F=FLAME_AT[p.name]; if(!F || !o || !spriteOn) return;
  /* the same box drawObj used for this prop */
  var fit=(p.name==='bookshelf'||p.name==='statue')?1.12:0.9, sc=Math.min(fit*TS/o.sw, fit*TS/o.sh), w=o.sw*sc, h=o.sh*sc;
  var bx=px+(TS-w)/2+F.ax*w, by=py+TS*0.96-h+F.ay*h;
  drawPixelFlame(bx, by, TS*F.size, F.wide, alpha, now, p.x*7+p.y*13);
}
function drawPixelFlame(bx, by, H, wide, alpha, now, seed){
  /* 2026-09-20: Justin - "the art for on fire looks really bad and low res". It was drawn one art pixel per TS/32,
     so at a close zoom the flame was a handful of fat blocks. Finer pixels, so it has the detail the rest has. */
  var u=Math.max(1, Math.round(TS/64));                 /* one art pixel */
  var t=ANIM.reduce ? 0 : now/1000;
  var cols=(typeof SOUL_FIRE!=='undefined' && SOUL_FIRE==='violet') ? ['#3A1A6A','#7A3CD8','#B884FF','#F0DCFF'] : (typeof SOUL_FIRE!=='undefined' && SOUL_FIRE) ? ['#1E5A2A','#3FB85A','#8CF07A','#E0FFC0'] : ['#8E2A12','#E2622B','#FFA040','#FFE08A'];   /* the Crypt burns green */
  ctx.save(); ctx.globalAlpha=alpha; ctx.imageSmoothingEnabled=false;
  var rows=Math.max(4, Math.round(H/u)), half=Math.max(2, Math.round(H*0.28*wide/u));
  for(var r=0; r<rows; r++){
    var q=r/rows;                                        /* 0 at the base, 1 at the tip */
    var sway=Math.sin(t*7 + seed + q*3.2)*q*1.6 + Math.sin(t*13 + seed*1.7 + q*6)*q*0.8;
    var lick=0.85+0.15*Math.sin(t*11 + seed + r*0.9);
    var hw=half*(q<0.25 ? 0.75+q : Math.pow(1-(q-0.25)/0.75, 1.3))*lick;
    if(hw<0.45) continue;
    for(var c=-Math.ceil(hw); c<=Math.ceil(hw); c++){
      var e=Math.abs(c)/Math.max(0.5,hw);
      if(e>1) continue;
      var k = e>0.72 || q>0.8 ? 1 : e>0.4 || q>0.55 ? 2 : 3;
      if(q<0.12 && e>0.6) k=0;
      ctx.fillStyle=cols[k];
      ctx.fillRect(Math.round(bx+(c+sway)*u - u/2), Math.round(by - r*u - u), u, u);
    }
  }
  /* a spark now and then */
  if(!ANIM.reduce){
    var ph=((now/900 + seed*0.37) % 1);
    ctx.globalAlpha=alpha*(1-ph); ctx.fillStyle='#FFD070';
    ctx.fillRect(Math.round(bx + Math.sin(seed+now/300)*half*u*0.8), Math.round(by - H - ph*H*0.8), u, u);
  }
  ctx.restore();
}

/* glints on the water: a few pixels per tile that brighten, drift a little and fade, each on its own clock */
function waterGlints(x, y, px, py){
  var now=performance.now(), salt=surfSalt(), u=Math.max(1, Math.round(TS/32));
  ctx.save(); ctx.imageSmoothingEnabled=false;
  for(var k=0;k<3;k++){
    var hx=hash2(x,y,salt+300+k), hy=hash2(x,y,salt+310+k), hp=hash2(x,y,salt+320+k), period=1800+1400*hash2(x,y,salt+330+k);
    var ph = ANIM.reduce ? 0.5 : ((now/period + hp) % 1);
    var a = ANIM.reduce ? 0.25 : Math.pow(Math.sin(Math.PI*ph), 2)*0.85;
    if(a<0.03) continue;
    var gx = px + TS*(0.15+0.7*hx) + (ANIM.reduce ? 0 : (ph-0.5)*TS*0.12);
    var gy = py + TS*(0.2+0.6*hy);
    ctx.globalAlpha=a; ctx.fillStyle='#BFE4F0';
    ctx.fillRect(Math.round(gx), Math.round(gy), u, u);
    if(a>0.55){ ctx.globalAlpha=a*0.45; ctx.fillRect(Math.round(gx-u), Math.round(gy), u, u); ctx.fillRect(Math.round(gx+u), Math.round(gy), u, u); }   /* a short sparkle at the peak */
  }
  ctx.restore();
}
