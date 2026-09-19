/* =====================================================================
   deeprender.js - how the Underdark looks (2026-09-19). The world is built in js/deep.js.
   - Terrain by region, per cell: every floor, wall face, wall top, rim and deco is drawn from the surface set of the
     region that cell belongs to (surface-temple-*, surface-underdark-*, surface-volcanic-*), so each room's walls
     match its floor. Temple rooms go through the ordinary surface renderer (surface.js) with its capstone rims.
   - Cave rock: near the edges of the spider caves and the volcanic caves each cell is baked into a 64 px raster from
     the same textures, with an organic outline - smooth and rounded for the underdark, broken and jagged for the
     volcanic rock (the Caverns' ptJag idea) - and a cliff face of that rock where it meets the ground below.
   - Region borders: where a hallway crosses from one region into the next, the rasters pick each pixel's region from
     a noise-warped neighbour, so floors and walls change set along a ragged line two or three tiles long, and a
     little rubble lies at the seam.
   - Lava: the 'lava' surface scrolled slowly and pulsing, cut to a rounded metaball edge with a basalt crust, and its
     own orange light.
   - The pieces (map-deep.png) at natural size: standing pieces set down by their solid bottom over a contact shadow,
     flat pieces lying in the floor with none, wall pieces hung from the top of a wall face, web curtains scaled to
     fill their tunnel tile, the drow stairway over the stairs.
   - Vegetation: the violet cave grass and fungus in the spider caves, ashweed on the volcanic rock (vegart.js).
   ===================================================================== */

/* ---------------------------------------------------------------- the sheet */
function deepArt(name){
  var g=AS.map && AS.map.deep; if(!g || !g.items[name]) return null;
  var img=atl('map-deep.png'); if(!img) return null;
  var b=g.items[name];
  return {img:img, sx:b[0]+b[2], sy:b[1]+b[3], sw:Math.max(1,b[4]), sh:Math.max(1,b[5]), ox:b[2], oy:b[3], fullW:b[6], fullH:b[7], nm:name};
}
var _setArtDeep = setArt;
setArt = function(name){ var o=_setArtDeep(name); if(o) return o; return deepArt(name); };

/* ---------------------------------------------------------------- the region of the cell being drawn */
var DEEP_AT = -1;          /* region index while one cell's terrain is drawn, -1 otherwise */
var DEEP_RC = false;       /* the cell being drawn is a baked rock raster: no rims, no square wall shadow */
var _surfImgDeep = surfImg;
surfImg = function(name){
  if(DEEP_AT>=0 && inDeep()){
    var pre=DEEP_REGIONS[DEEP_AT];
    if(AS.surface && AS.surface[pre+'-'+name]) return atl('surface-'+pre+'-'+name+'.png');
  }
  return _surfImgDeep(name);
};
function deepCellReg(x, y){ return deepRegionAt(Math.max(0,Math.min(MW-1,x)), Math.max(0,Math.min(MH-1,y))); }
/* ptMat() answers for the one cell being drawn when it is a raster: render.js then leaves out the tile-wide shadow
   band under a wall face and surface.js the capstone rims, both of which read as square blocks against cave rock */
var _ptMatDeep = ptMat;
ptMat = function(){ var m=_ptMatDeep(); if(m) return m; return DEEP_RC ? PT_MAT.cavern : null; };

/* ---------------------------------------------------------------- per-floor cache */
var DC = {key:null, map:null, cells:{}, built:0, rmix:null, lock:null, tex:{}};
var DEEP_BUDGET = 18;       /* rasters baked a frame (about 1.5 ms each on a desktop; fewer on touch devices, below) */
function deepCache(){
  var key=(typeof worldSeed==='number'?worldSeed:0)+':'+floorNo;
  if(DC.key!==key || DC.map!==map){
    DC.key=key; DC.map=map; DC.cells={}; DC.lava={};
    var R=floorMeta.deepRegion, N=MW*MH, i, x, y;
    DC.rmix=new Uint8Array(N); DC.lock=new Uint8Array(N);
    for(y=0;y<MH;y++) for(x=0;x<MW;x++){
      i=idxOf(x,y); var own=R[i], mix=0;
      for(var oy=-2;oy<=2 && !mix;oy++) for(var ox=-2;ox<=2;ox++){ var nx=x+ox, ny=y+oy; if(inb(nx,ny) && R[idxOf(nx,ny)]!==own){ mix=1; break; } }
      DC.rmix[i]=mix;
    }
    /* a room's floor and the walls round it are locked to the room's region: the ragged change happens in hallways */
    rooms.forEach(function(r){
      deepRoomCells(r).forEach(function(c){
        for(var oy=-1;oy<=1;oy++) for(var ox=-1;ox<=1;ox++){ var nx=c.x+ox, ny=c.y+oy; if(!inb(nx,ny)) continue; var k=idxOf(nx,ny);
          if((!ox && !oy) || isWallLike(map[k])) DC.lock[k]=1; }
      });
    });
  }
  return DC;
}
function deepSig(x, y){
  var s=0, b=1;
  for(var oy=-2;oy<=2;oy++) for(var ox=-2;ox<=2;ox++){ if(!inb(x+ox,y+oy) || isWallLike(at(x+ox,y+oy))) s+=b; b*=2; }
  return s;
}
/* raster a cell when it is near a region change, or near the edge of cave rock */
function deepNeedsRaster(x, y, sig){
  var C=deepCache(), i=idxOf(x,y);
  if(C.rmix[i]) return true;
  if(DEEP_STYLE[floorMeta.deepRegion[i]]==='rect') return false;
  return sig!==0 && sig!==33554431;
}

/* ---------------------------------------------------------------- texture pixels */
function deepTex(reg, name){
  var k=reg+':'+name; if(DC.tex[k]) return DC.tex[k];
  var img=atl('surface-'+DEEP_REGIONS[reg]+'-'+name+'.png'); if(!img) return null;
  try{
    var c=document.createElement('canvas'); c.width=img.naturalWidth; c.height=img.naturalHeight;
    var g=c.getContext('2d'); g.drawImage(img,0,0);
    return (DC.tex[k]={w:c.width, h:c.height, d:g.getImageData(0,0,c.width,c.height).data});
  }catch(e){ return null; }
}
function deepTexel(T, X, Y){ X=((X%T.w)+T.w)%T.w; Y=((Y%T.h)+T.h)%T.h; var p=(Y*T.w+X)*4; return p; }

/* ---------------------------------------------------------------- the solid rock, per pixel */
function deepWallCell(x, y){ return !inb(x,y) || isWallLike(at(x,y)); }
function deepPixReg(wx, wy, salt){
  var cx=Math.floor(wx), cy=Math.floor(wy), R=floorMeta.deepRegion;
  if(!inb(cx,cy)) return deepCellReg(cx,cy);
  var i=idxOf(cx,cy); if(DC.lock[i] || !DC.rmix[i]) return R[i];
  var jx=(ptVal(wx*0.75, wy*0.75, salt+1)-0.5)*2.6 + (ptVal(wx*2.6, wy*2.6, salt+2)-0.5)*0.9 + (hash2(Math.floor(wx*16), Math.floor(wy*16), salt+5)-0.5)*0.35;
  var jy=(ptVal(wx*0.75+9, wy*0.75, salt+3)-0.5)*2.6 + (ptVal(wx*2.6+4, wy*2.6, salt+4)-0.5)*0.9 + (hash2(Math.floor(wx*16), Math.floor(wy*16), salt+6)-0.5)*0.35;
  var sx=Math.floor(wx+jx), sy=Math.floor(wy+jy);
  return inb(sx,sy) ? R[idxOf(sx,sy)] : R[i];
}
function deepSolid(wx, wy, style, salt){
  var cx=Math.floor(wx), cy=Math.floor(wy), own=deepWallCell(cx,cy);
  if(style==='rect') return own;
  var same=true;
  for(var oy=-1;oy<=1 && same;oy++) for(var ox=-1;ox<=1;ox++) if(deepWallCell(cx+ox,cy+oy)!==own){ same=false; break; }
  if(same) return own;
  var sum=0, wsum=0;
  for(var oy2=-2;oy2<=2;oy2++) for(var ox2=-2;ox2<=2;ox2++){
    var nx=cx+ox2, ny=cy+oy2, dx=wx-(nx+0.5), dy=wy-(ny+0.5), d=Math.sqrt(dx*dx+dy*dy), w=Math.max(0, 1-d/1.35);
    if(!w) continue; w*=w; wsum+=w; if(deepWallCell(nx,ny)) sum+=w;
  }
  var f=wsum ? sum/wsum : (own?1:0), thr;
  if(style==='smooth') thr = 0.5 + (ptVal(wx*0.7, wy*0.7, salt+3)-0.5)*0.3;
  else {
    /* jagged: ridged noise at two finer scales chips and notches the edge (the Caverns' ptJag, pushed harder) */
    var r1=1-Math.abs(ptVal(wx*3.6, wy*3.6, salt+41)*2-1), r2=1-Math.abs(ptVal(wx*8.2, wy*8.2, salt+43)*2-1);
    thr = 0.5 + (ptVal(wx*0.85, wy*0.85, salt+3)-0.5)*0.3 + (r1-0.5)*0.5 + (r2-0.5)*0.22;
  }
  if(f>0.8) return true; if(f<0.2) return false;   /* no pinholes in the rock, no islands on the floor */
  var sld = f > thr;
  var fx=wx-cx, fy=wy-cy, rc=Math.sqrt((fx-0.5)*(fx-0.5)+(fy-0.5)*(fy-0.5));
  if(!own && sld && rc<0.3) return false;      /* open cells keep a walkable core */
  if(own && !sld && rc<0.24) return true;
  return sld;
}

/* ---------------------------------------------------------------- one baked cell (64 px) */
var DEEP_RF = 32;
var DEEP_TOP_DIM = 0.72;   /* cave rock tops sit a little darker than the floor, so a cave reads as a hollow in the rock */          /* the outline is worked out at 32 px a cell, the colour at 64 */
function deepCellRaster(x, y){
  var salt=(typeof ptSalt==='function' ? ptSalt() : 7)+1301, RF=DEEP_RF, step=1/RF, FACE=RF;
  var regs=[0,1,2], TX={};
  for(var ri2=0; ri2<3; ri2++){ var fl=deepTex(ri2,'floor'), tp=deepTex(ri2,'top'), fc=deepTex(ri2,'face'); TX[ri2]={floor:fl, top:tp, face:fc}; }
  var present=floorMeta.deepPresent || (floorMeta.deepPresent=(function(){ var s={}; for(var i=0;i<floorMeta.deepRegion.length;i++) s[floorMeta.deepRegion[i]]=1; return s; })());
  for(var k in present) if(!TX[k].floor || !TX[k].top || !TX[k].face) return undefined;   /* textures still loading: try again later */
  /* kinds (1 rock, 0 open) and regions over the cell and a tile below it (for the cliff faces) */
  var W=RF+2, H=RF+FACE+2, kind=new Uint8Array(W*H), reg=new Uint8Array(W*H);
  for(var v=-1; v<H-1; v++) for(var u=-1; u<W-1; u++){
    var wx=x+(u+0.5)*step, wy=y+(v+0.5)*step, rg=deepPixReg(wx, wy, salt), j=(v+1)*W+(u+1);
    reg[j]=rg; kind[j]=deepSolid(wx, wy, DEEP_STYLE[rg], salt) ? 1 : 0;
  }
  function K(u,v){ return kind[(v+1)*W+(u+1)]; }
  /* distance down to open ground, per mask pixel of the cell */
  var dn=new Uint8Array(RF*RF);
  for(var u2=0; u2<RF; u2++){
    var dist=-1;                                           /* -1: no open ground below yet */
    for(var v2=H-2; v2>=0; v2--){
      if(!K(u2,v2)) dist=0; else if(dist>=0) dist++;
      if(v2<RF) dn[v2*RF+u2] = (K(u2,v2) && dist>0 && dist<=FACE) ? dist : 0;
    }
  }
  var c=document.createElement('canvas'); c.width=64; c.height=64;
  var g=c.getContext('2d'), im=g.createImageData(64,64), D=im.data;
  var o0=surfOff(0), o1=surfOff(1), o2=surfOff(2), o3=surfOff(3), o4=surfOff(4);
  for(var V=0; V<64; V++) for(var U=0; U<64; U++){
    var mu=U>>1, mv=V>>1, kk=K(mu,mv), rgn=reg[(mv+1)*W+(mu+1)], T=TX[rgn], p=(V*64+U)*4, r, gg, b, q, sh=1;
    var style=DEEP_STYLE[rgn];
    if(!kk){
      /* floor, darkened a little under a wall face above and beside rock */
      q=deepTexel(T.floor, (x+o0)*64+U, (y+o1)*64+V); r=T.floor.d[q]; gg=T.floor.d[q+1]; b=T.floor.d[q+2];
      for(var up=1; up<=10; up++){ if(K(mu,mv-up)){ sh=Math.min(sh, 0.5+0.5*(up-1)/10); break; } }
      if(K(mu-1,mv) || K(mu+1,mv)) sh*=0.86;
    } else {
      var d=dn[mv*RF+mu];
      if(d>0){
        var e=d*2-(V&1);                                  /* pixels above the ground line */
        if(style==='rect'){
          q=deepTexel(T.face, (x+o2)*64+U, 64-Math.min(64,e)); r=T.face.d[q]; gg=T.face.d[q+1]; b=T.face.d[q+2];
        } else {
          /* cave cliff: the region's own rock, drawn down the face, darkening to its foot, a pale lip on top */
          q=deepTexel(T.top, (x+o3)*64+U, (y+o4)*64+Math.floor(V*0.6)); r=T.top.d[q]; gg=T.top.d[q+1]; b=T.top.d[q+2];
          sh = e<=4 ? 0.34 : 0.5;                          /* one steady tone down the face (a gradient striped jagged edges), a dark foot */
          if(mv>0 ? (dn[(mv-1)*RF+mu]===0) : e>=62) sh=1.3;  /* the lip where the rock top turns down, catching the light */
        }
      } else {
        q=deepTexel(T.top, (x+o3)*64+U, (y+o4)*64+V); r=T.top.d[q]; gg=T.top.d[q+1]; b=T.top.d[q+2];
        if(style!=='rect') sh=DEEP_TOP_DIM;
        if(!K(mu-1,mv) || !K(mu+1,mv) || !K(mu,mv-1)) sh=0.4;
        else if(!K(mu-2,mv) || !K(mu+2,mv) || !K(mu,mv-2)) sh*=0.85;
      }
    }
    D[p]=Math.min(255,r*sh); D[p+1]=Math.min(255,gg*sh); D[p+2]=Math.min(255,b*sh); D[p+3]=255;
  }
  g.putImageData(im,0,0);
  return c;
}
function deepRasterTile(x, y){
  var C=deepCache(), sig=deepSig(x,y);
  if(!deepNeedsRaster(x,y,sig)) return null;
  var key=x+','+y+':'+sig;
  if(!(key in C.cells)){
    if(C.built>=DEEP_BUDGET) return null;
    C.built++;
    var r=deepCellRaster(x,y);
    if(r===undefined) return null;
    C.cells[key]=r;
  }
  return C.cells[key] ? {img:C.cells[key], sx:0, sy:0, sw:64, sh:64, crisp:true} : null;
}
function deepIsRaster(x, y){ if(!inDeep() || !floorMeta.deepRegion) return false; return deepNeedsRaster(x, y, deepSig(x,y)); }

/* ---------------------------------------------------------------- hooking the terrain pass */
var _floorTileDeep = floorTile;
floorTile = function(x, y){
  if(!inDeep() || !floorMeta.deepRegion){ DEEP_RC=false; DEEP_AT=-1; return _floorTileDeep(x,y); }
  var rt=deepRasterTile(x,y); DEEP_RC=!!rt; DEEP_AT=deepCellReg(x,y);
  if(rt) return rt;
  var o=_floorTileDeep(x,y); return o;
};
var _wallTileDeep = wallTile;
wallTile = function(x, y){
  if(!inDeep() || !floorMeta.deepRegion){ DEEP_RC=false; DEEP_AT=-1; return _wallTileDeep(x,y); }
  var rt=deepRasterTile(x,y); DEEP_AT=deepCellReg(x,y); DEEP_RC=!!rt && !deepBuiltWall(x,y);
  if(rt) return rt;
  if(DEEP_STYLE[DEEP_AT]!=='rect'){
    /* cave rock not baked yet (a few are baked a frame): its rock top, never a brick face */
    var t=surfImg('top'); if(t) return {img:t, sx:smod(x+surfOff(3))*64, sy:smod(y+surfOff(4))*64, sw:64, sh:64, deepDim:wallFaces(x,y) ? 0.5 : 1-DEEP_TOP_DIM};
  }
  return _wallTileDeep(x,y);
};
/* a built (temple) room's own wall keeps its capstone rims even where it is baked for a nearby region change */
function deepBuiltWall(x, y){ var C=deepCache(), i=idxOf(x,y); return !!C.lock[i] && DEEP_STYLE[floorMeta.deepRegion[i]]==='rect'; }
var _drawWallEdgesDeep = drawWallEdges;
drawWallEdges = function(x, y, t, px, py, a){
  if(!inDeep() || !floorMeta.deepRegion) return _drawWallEdgesDeep.apply(this, arguments);
  var keep=DEEP_AT; DEEP_AT=deepCellReg(x,y);
  try{ return _drawWallEdgesDeep.apply(this, arguments); } finally { DEEP_AT=keep; }
};
/* a deco piece (grit, crack, drain, banner) takes the region of the cell it is drawn in; no drains in the caves */
var _drawDecoDeep = drawDeco;
drawDeco = function(i, px, py, alpha, opt){
  if(!inDeep() || !floorMeta.deepRegion) return _drawDecoDeep.apply(this, arguments);
  var cx=Math.floor(px/TS+0.5)+camX, cy=Math.floor(py/TS+0.5)+camY, keep=DEEP_AT;
  DEEP_AT=deepCellReg(cx,cy);
  if(i===DECO.drain && DEEP_AT!==0){ DEEP_AT=keep; return; }
  try{ return _drawDecoDeep.apply(this, arguments); } finally { DEEP_AT=keep; }
};
/* wall torches only on built temple and volcanic walls drawn as tiles (a raster cell has no sconce to hold one) */
var _wallTorchAtDeep = wallTorchAt;
wallTorchAt = function(x, y){
  var r=_wallTorchAtDeep(x,y); if(!r || !inDeep() || !floorMeta.deepRegion) return r;
  return deepCellReg(x,y)!==1 && !deepIsRaster(x,y);
};
var _blitTileDeep = blitTile;
blitTile = function(o, px, py, alpha){
  var r=_blitTileDeep.apply(this, arguments);
  if(o && o.deepDim){ ctx.globalAlpha=alpha*o.deepDim; ctx.fillStyle='#000'; ctx.fillRect(px, py, TS+0.6, TS+0.6); ctx.globalAlpha=alpha; }
  return r;
};
var _drawDeepBudget = draw;
draw = function(){
  if(DC) DC.built = document.body.classList.contains('touch') ? DEEP_BUDGET-8 : 0;
  var r=_drawDeepBudget.apply(this, arguments);
  DEEP_RC=false; DEEP_AT=-1;
  if(inDeep() && DC.built>=DEEP_BUDGET) requestAnimationFrame(function(){ draw(); });
  return r;
};

/* ---------------------------------------------------------------- lava */
var DEEP_LAVA_T = 0.34;
function deepLavaCells(x, y){ var out=[]; for(var oy=-2;oy<=2;oy++) for(var ox=-2;ox<=2;ox++) if(at(x+ox,y+oy)===LAVA) out.push([x+ox+0.5, y+oy+0.5]); return out; }
function deepLavaSig(x, y){ var s=''; for(var oy=-2;oy<=2;oy++) for(var ox=-2;ox<=2;ox++){ var t=at(x+ox,y+oy); s+=t===LAVA?'1':isWallLike(t)?'2':'0'; } return s; }
function deepLavaRasters(x, y){
  var R=32, cells=deepLavaCells(x,y); if(!cells.length) return null;
  var walls=[]; for(var oy=-1;oy<=1;oy++) for(var ox=-1;ox<=1;ox++) if(isWallLike(at(x+ox,y+oy))) walls.push([x+ox+0.5, y+oy+0.5]);
  var salt=(typeof ptSalt==='function' ? ptSalt() : 7)+1409;
  var mask=document.createElement('canvas'); mask.width=R; mask.height=R;
  var crust=document.createElement('canvas'); crust.width=R; crust.height=R;
  var gm=mask.getContext('2d'), gc=crust.getContext('2d'), im=gm.createImageData(R,R), ic=gc.createImageData(R,R), M=im.data, Cc=ic.data, any=false;
  for(var v=0; v<R; v++) for(var u=0; u<R; u++){
    var wx=x+(u+0.5)/R, wy=y+(v+0.5)/R, f=0;
    for(var k=0;k<cells.length;k++){ var dx=wx-cells[k][0], dy=wy-cells[k][1], d=Math.sqrt(dx*dx+dy*dy)/1.25; if(d<1) f+=(1-d)*(1-d); }
    f += (ptVal(wx*1.3, wy*1.3, salt)-0.5)*0.34 + (ptVal(wx*3.1, wy*3.1, salt+1)-0.5)*0.14;   /* banks that bulge and pinch */
    for(var k2=0;k2<walls.length;k2++){ var ex=wx-walls[k2][0], ey=wy-walls[k2][1], ed=Math.max(Math.abs(ex),Math.abs(ey))/1.05; if(ed<1) f-=(1-ed)*(1-ed)*1.6; }   /* it keeps off the rock */
    var p=(v*R+u)*4;
    if(f>=DEEP_LAVA_T){ M[p]=255; M[p+1]=255; M[p+2]=255; M[p+3]=255; any=true;
      if(f<DEEP_LAVA_T+0.05){ Cc[p]=255; Cc[p+1]=150; Cc[p+2]=60; Cc[p+3]=200; } }       /* the bright rim is drawn over the flow below */
    else if(f>=DEEP_LAVA_T-0.13){
      /* the basalt crust: dark, with a glowing inner edge */
      var inner=(f-(DEEP_LAVA_T-0.13))/0.13, grit=hash2(Math.floor(wx*32), Math.floor(wy*32), salt+2);
      var col = inner>0.72 ? [190,64,18] : grit<0.25 ? [52,36,30] : [26,18,16];
      Cc[p]=col[0]; Cc[p+1]=col[1]; Cc[p+2]=col[2]; Cc[p+3]=Math.round(inner>0.72 ? 230 : 120+110*inner); any=true;
    }
  }
  if(!any) return null;
  gm.putImageData(im,0,0); gc.putImageData(ic,0,0);
  return {mask:mask, crust:crust};
}
function deepLavaRaster(x, y){
  var C=deepCache(), k=x+','+y+':'+deepLavaSig(x,y);
  if(!(k in C.lava)) C.lava[k]=deepLavaRasters(x,y);
  return C.lava[k];
}
var DEEP_LB = null, DEEP_LM = null;
function drawDeepLava(now){
  if(!floorMeta.lava) return;
  var lava=atl('surface-lava.png'); if(!lava) return;
  var S=32, W=(viewW+3)*S, H=(viewH+3)*S, ox=camX-1, oy=camY-1, list=[], near=[];
  for(var y=camY-1; y<=camY+viewH+1; y++) for(var x=camX-1; x<=camX+viewW+1; x++){
    if(!inb(x,y) || !(revealAll||seen[idxOf(x,y)]) || isWallLike(at(x,y))) continue;
    if(at(x,y)===LAVA) list.push([x,y]);
    else if(deepLavaCells(x,y).some(function(c){ return Math.abs(c[0]-0.5-x)<=1 && Math.abs(c[1]-0.5-y)<=1; })) near.push([x,y]);
  }
  if(!list.length) return;
  if(!DEEP_LB){ DEEP_LB=document.createElement('canvas'); DEEP_LB.g=DEEP_LB.getContext('2d'); }
  if(DEEP_LB.width!==W || DEEP_LB.height!==H){ DEEP_LB.width=W; DEEP_LB.height=H; }
  if(!DEEP_LM){ DEEP_LM=document.createElement('canvas'); DEEP_LM.g=DEEP_LM.getContext('2d'); }
  if(DEEP_LM.width!==W || DEEP_LM.height!==H){ DEEP_LM.width=W; DEEP_LM.height=H; }
  var g=DEEP_LB.g, gm=DEEP_LM.g, t=(ANIM.reduce ? 0 : now/1000);
  /* the mask of every lava cell in view, then the flow cut to it in one go (per-tile compositing would clear the rest) */
  gm.clearRect(0,0,W,H);
  list.forEach(function(c){ var rr=deepLavaRaster(c[0],c[1]); if(rr) gm.drawImage(rr.mask, (c[0]-ox)*S, (c[1]-oy)*S); });
  g.globalCompositeOperation='source-over'; g.globalAlpha=1; g.clearRect(0,0,W,H);
  /* the flow: the lava surface at half size (a tile = 32 px here), anchored to the world, drifting slowly;
     a second sheet flipped over it drifts the other way, and the whole flow breathes brighter and dimmer */
  var P=192, sx=((ox*S + t*5) % P + P) % P, sy=((oy*S + t*3) % P + P) % P;
  for(var yy=-sy; yy<H; yy+=P) for(var xx=-sx; xx<W; xx+=P) g.drawImage(lava, 0, 0, lava.naturalWidth, lava.naturalHeight, xx, yy, P, P);
  g.globalAlpha=0.35; var sx2=((ox*S - t*2) % P + P) % P, sy2=((oy*S + t*1.5) % P + P) % P;
  for(var y2=-sy2; y2<H; y2+=P) for(var x2=-sx2; x2<W; x2+=P){ g.save(); g.translate(x2+P, y2+P); g.scale(-1,-1); g.drawImage(lava, 0, 0, lava.naturalWidth, lava.naturalHeight, 0, 0, P, P); g.restore(); }
  var pulse=ANIM.reduce ? 0.12 : 0.1+0.1*Math.sin(t*1.4);
  g.globalAlpha=pulse; g.fillStyle='#FFB040'; g.fillRect(0,0,W,H);
  g.globalAlpha=1; g.globalCompositeOperation='destination-in'; g.drawImage(DEEP_LM, 0, 0);
  g.globalCompositeOperation='source-over';
  ctx.save(); ctx.imageSmoothingEnabled=false;
  near.concat(list).forEach(function(c){ var rr=deepLavaRaster(c[0],c[1]); if(!rr) return; ctx.globalAlpha=(revealAll||vis[idxOf(c[0],c[1])]) ? 1 : memA(0.45); ctx.drawImage(rr.crust, 0,0,S,S, (c[0]-camX)*TS, (c[1]-camY)*TS, TS, TS); });
  ctx.globalAlpha=1;
  ctx.drawImage(DEEP_LB, 0, 0, W, H, -TS, -TS, W*TS/S, H*TS/S);
  /* the bright rim sits on top of the flow */
  list.forEach(function(c){ var rr=deepLavaRaster(c[0],c[1]); if(rr) ctx.drawImage(rr.crust, 0,0,S,S, (c[0]-camX)*TS, (c[1]-camY)*TS, TS, TS); });
  ctx.restore();
}
var _drawWangLayerDeep = drawWangLayer;
drawWangLayer = function(key, tileType){
  DEEP_RC=false; DEEP_AT=-1;
  var r=_drawWangLayerDeep.apply(this, arguments);
  if(key==='chasm' && inDeep()) drawDeepLava(performance.now());
  return r;
};
var _gatherLightsDeep = gatherLights;
gatherLights = function(now, prp){
  var L=_gatherLightsDeep.apply(this, arguments);
  if(!inDeep() || !L) return L;
  /* the scenery's fires burn a little lower down here: the Underdark is meant to be dark */
  for(var i=1;i<L.length;i++){ L[i].s*=0.75; }
  (floorMeta.lavaLights||[]).forEach(function(l){
    if(l.x<camX-7 || l.x>camX+viewW+7 || l.y<camY-7 || l.y>camY+viewH+7 || !(revealAll||seen[idxOf(l.x,l.y)])) return;
    var fl=ANIM.reduce ? 1 : 1+0.12*Math.sin(now/650+l.ph)+0.05*Math.sin(now/170+l.ph*3);
    L.push({x:l.x, y:l.y, c:hexRGB('#FF6A20'), r:5.2, s:1.15*fl, tx:l.x, ty:l.y});
  });
  return L;
};

/* ---------------------------------------------------------------- after the terrain: seams, wall webbing and cracks */
function drawDeepSurface(){
  var salt=surfSalt()+530, R=floorMeta.deepRegion;
  for(var y=camY; y<=camY+viewH; y++) for(var x=camX; x<=camX+viewW; x++){
    if(!inb(x,y)) continue; var i=idxOf(x,y); if(!(revealAll||seen[i])) continue;
    var t=map[i], px=(x-camX)*TS, py=(y-camY)*TS, a=(revealAll||vis[i]) ? 1 : memA(0.4);
    if(t===FLOOR && !roomAt(x,y) && !propAt(x,y) && !ground[i]){
      /* rubble where a hallway passes from one region's stone into the next */
      var seam=[[1,0],[-1,0],[0,1],[0,-1]].some(function(o){ var nx=x+o[0], ny=y+o[1]; return inb(nx,ny) && !isWallLike(at(nx,ny)) && R[idxOf(nx,ny)]!==R[i]; });
      if(seam && hash2(x,y,salt)<0.75) drawDeco(DECO.pebble[Math.floor(hash2(x,y,salt+1)*3)], px, py, a, {dx:(hash2(x,y,salt+2)-0.5)*0.4, dy:(hash2(x,y,salt+3)-0.5)*0.4, s:0.8});
    }
    /* cave faces: webbing draped on the spider caves' walls, cracks glowing in the volcanic rock */
    if(isWallLike(t) && t!==SECRET && inb(x,y+1) && !isWallLike(at(x,y+1)) && R[i]!==0 && deepIsRaster(x,y) && !propAt(x,y)){
      var h=hash2(x,y,salt+7);
      if(R[i]===1 && h<0.14) drawDeco(DECO.banner[hash2(x,y,salt+8)<0.5?0:1], px, py, a*0.9, {dy:0.08, s:0.9});
      else if(R[i]===2 && h<0.1) drawDeco(DECO.crack[Math.floor(hash2(x,y,salt+9)*3)], px, py, a*0.8, {dy:0.1});
    }
  }
}
var _drawSurfaceDecoDeep = drawSurfaceDeco;
drawSurfaceDeco = function(){
  var r=_drawSurfaceDecoDeep.apply(this, arguments);
  if(inDeep() && floorMeta.deepRegion) drawDeepSurface();
  return r;
};

/* ---------------------------------------------------------------- the pieces */
function deepBottomPad(o){ return typeof packBottomPad==='function' ? packBottomPad(o) : 0; }
function deepDrawPiece(p, alpha){
  var o=deepArt(p.name); if(!o) return false;
  var s=TS/64, w=p.w||1, h=p.h||1, X=(p.x-camX)*TS, Y=(p.y-camY)*TS, dx, dy, dw, dh, flip=false;
  ctx.save(); ctx.globalAlpha=alpha; ctx.imageSmoothingEnabled=false;
  if(p.curtain){
    /* the curtains are painted small and low in their cell: scaled up to fill the tunnel, wall to wall */
    var k = p.name==='web-curtain-h' ? TS*1.12/o.sw : TS*1.12/o.sh;
    dw=o.sw*k; dh=o.sh*k; dx=X+(TS-dw)/2; dy=Y+(TS-dh)/2 + (p.name==='web-curtain-h' ? -TS*0.08 : 0);
  } else if(p.wall){
    /* hung from the top of the wall face it is set on */
    flip=!!p.flipX;
    dw=o.sw*s; dh=o.sh*s; dx=X+(TS-o.fullW*s)/2+o.ox*s; dy=Y+o.oy*s+(p.name.indexOf('web-corner')===0 ? 0 : TS*0.12);
    if(flip) dx=X+TS-(dx-X)-dw;
  } else if(p.flat || !p.b){
    /* lies in the floor: the canvas centred on its footprint, no shadow */
    flip=!!(p.cluster || /^web-floor|^cocoons-small|^basalt|^obsidian|^candles/.test(p.name)) && hash2(p.x,p.y,5)<0.5;
    dw=o.sw*s; dh=o.sh*s; dx=X+(w*TS-o.fullW*s)/2+o.ox*s; dy=Y+(h*TS-o.fullH*s)/2+o.oy*s;
    if(flip) dx=X+w*TS-(dx-X)-dw;
  } else {
    /* stands on the bottom edge of its footprint, set down by its own solid bottom, over a contact shadow */
    var bottom=Y+h*TS+deepBottomPad(o)*s;
    dw=o.sw*s; dh=o.sh*s; dx=X+(w*TS-o.fullW*s)/2+o.ox*s; dy=bottom-o.fullH*s+o.oy*s;
    ctx.fillStyle='rgba(8,6,12,0.34)'; ctx.beginPath(); ctx.ellipse(dx+dw/2, Y+h*TS-TS*0.08, Math.min(dw*0.46, w*TS*0.48), TS*0.13, 0, 0, 7); ctx.fill();
  }
  if(flip){ ctx.translate(dx+dw/2, 0); ctx.scale(-1,1); ctx.translate(-(dx+dw/2), 0); }
  ctx.drawImage(o.img, o.sx, o.sy, o.sw, o.sh, Math.round(dx), Math.round(dy), Math.round(dw), Math.round(dh));
  ctx.restore();
  if(typeof flashOf==='function' && p.br){ var fl=flashOf(p); if(fl>0){ ctx.save(); ctx.globalAlpha=fl*0.6; ctx.fillStyle='#FFF'; ctx.fillRect(X+TS*0.2, Y+TS*0.2, TS*0.6, TS*0.6); ctx.restore(); } }
  if(typeof objFxDraw==='function') objFxDraw(o, Math.round(dx), Math.round(dy), Math.round(dw), Math.round(dh), alpha, flip);
  return true;
}
var _drawPropSurfaceDeep = drawPropSurface;
drawPropSurface = function(p, px, py, alpha){
  if(p && (p.deep || DEEP_PIECES[p.name]) && deepDrawPiece(p, alpha)) return true;
  return _drawPropSurfaceDeep.apply(this, arguments);
};
/* the drow stairway stands over the stairs at the end of its passage; lava draws itself (nothing in the object pass) */
var _drawSideDoorDeep = typeof drawSideDoor==='function' ? drawSideDoor : null;
drawSideDoor = function(x, y, t, px, py, alpha){
  if(t===LAVA) return true;
  if(t===STAIRS && inDeep()){
    var o=deepArt('stairs-down-drow');
    if(o){
      var s=TS/64, bottom=py+TS+deepBottomPad(o)*s*0.5, dw=o.sw*s, dh=o.sh*s, dx=px+(TS-o.fullW*s)/2+o.ox*s, dy=bottom-o.fullH*s+o.oy*s;
      ctx.save(); ctx.globalAlpha=alpha; ctx.imageSmoothingEnabled=false;
      ctx.drawImage(o.img, o.sx, o.sy, o.sw, o.sh, Math.round(dx), Math.round(dy), Math.round(dw), Math.round(dh));
      ctx.restore();
      if(typeof objFxDraw==='function') objFxDraw(o, Math.round(dx), Math.round(dy), Math.round(dw), Math.round(dh), alpha, false);
      return true;
    }
  }
  return _drawSideDoorDeep ? _drawSideDoorDeep.apply(this, arguments) : false;
};
/* tall pieces are drawn before the creatures: one standing behind a pillar or an idol is covered by it again */
var _drawOccludersDeep = typeof drawOccluders==='function' ? drawOccluders : null;
drawOccluders = function(now){
  if(_drawOccludersDeep) _drawOccludersDeep(now);
  if(!inDeep() || !props.length) return;
  var bodies=ents.filter(function(e){ return e.hp>0 && (e===player || revealAll || vis[idxOf(e.x,e.y)]); });
  props.forEach(function(p){
    if(!DEEP_PIECES[p.name] || p.flat || p.wall || p.curtain || !(revealAll||seen[idxOf(p.x,p.y)])) return;
    var o=deepArt(p.name); if(!o) return;
    var w=p.w||1, h=p.h||1, rise=Math.ceil((o.fullH-o.oy)/64 - 0.25) - h;
    if(rise<1) return;
    var hit=bodies.some(function(e){ var rp=renderPos(e); return rp.x>p.x-0.8 && rp.x<p.x+w-0.2 && rp.y<p.y-0.05 && rp.y>=p.y-rise-0.5; });
    if(hit) deepDrawPiece(p, (revealAll||vis[idxOf(p.x,p.y+h-1)])?1:0.45);
  });
};
/* the pieces' flames flicker and their runes glow (objanim.js) */
if(typeof OBJ_FX_RULES!=='undefined') OBJ_FX_RULES.push(
  [/^(candelabra-tall|candles-scarlet-\d|stairs-down-drow|drow-altar)/, ['flicker']],
  [/^lava-forge$/, ['flicker', 'embers']],
  [/^(basalt-embers-\d|blood-font|ritual-circle-active|drow-obelisk)$/, ['glow']]
);
/* one family of fire light per room (lightrules.js): the drow candles are candles */
if(typeof LIGHT_FAMILY!=='undefined') LIGHT_FAMILY.push([/^(candelabra-tall|candles-scarlet-\d)$/, 'candle'], [/^lava-forge$/, 'forge']);

/* ---------------------------------------------------------------- vegetation */
var _vegSetDeep = vegSet;
vegSet = function(){ if(inDeep()) return 'underdark'; return _vegSetDeep(); };
VEG_DIM.underdark = [0.22, '#1A1426'];
var _drawVegSpotsDeep = drawVegSpots;
drawVegSpots = function(now){
  if(!inDeep()) return _drawVegSpotsDeep.apply(this, arguments);
  var S=floorMeta && floorMeta.vegSpots; if(!S || !S.length) return;
  S.forEach(function(sp){
    if(sp.x<camX-1 || sp.x>camX+viewW+1 || sp.y<camY-1 || sp.y>camY+viewH+1) return;
    var i=idxOf(sp.x,sp.y); if(!(revealAll||seen[i])) return;
    var a=(revealAll||vis[i]) ? 1 : memA(0.42), px=(sp.x-camX)*TS, py=(sp.y-camY)*TS, sw=vegSway(sp.x,sp.y,now,vegBend(sp.x,sp.y));
    if(sp.kind==='ashweed'){
      vegDraw(vegArt('volcanic-ashweed-'+(1+Math.floor(hash2(sp.x,sp.y,81)*3))), px+TS*(0.35+0.3*hash2(sp.x,sp.y,82)), py+TS*0.95, 0.85, sw*0.6, a, hash2(sp.x,sp.y,83)<0.5);
    } else {
      /* two or three fungus of one kind, each on its own */
      var n=2+Math.floor(hash2(sp.x,sp.y,72)*2), kind=1+Math.floor(hash2(sp.x,sp.y,71)*3);
      for(var k=0;k<n;k++){
        var ox=0.2+0.6*hash2(sp.x+k,sp.y,73), oy=0.55+0.4*hash2(sp.x,sp.y+k,74), sc=0.55+0.35*hash2(k,sp.x+sp.y,75);
        vegDraw(vegArt('underdark-fungus-'+kind), px+TS*ox, py+TS*oy, sc, sw*0.3, a, hash2(k,sp.y,77)<0.5);
      }
    }
  });
};

/* ---------------------------------------------------------------- the automap: lava */
var _drawAutomapDeep = typeof drawAutomap==='function' ? drawAutomap : null;
if(_drawAutomapDeep) drawAutomap = function(){
  var r=_drawAutomapDeep.apply(this, arguments);
  if(!inDeep() || !floorMeta.lava || typeof AUTOMAP_ON==='undefined' || !AUTOMAP_ON) return r;
  var c=$('automap'), host=$('map'); if(!c || !host) return r;
  var W=host.clientWidth, H=host.clientHeight, g=c.getContext('2d');
  var cell=Math.max(3, Math.floor(Math.min((W-40)/MW, (H-40)/MH))), ox=Math.round((W-cell*MW)/2), oy=Math.round((H-cell*MH)/2);
  g.fillStyle='rgba(255,110,40,0.55)';
  for(var i=0;i<map.length;i++) if(map[i]===LAVA && (revealAll||seen[i])) g.fillRect(ox+(i%MW)*cell, oy+((i/MW)|0)*cell, cell, cell);
  return r;
};

/* ---------------------------------------------------------------- no dungeon moss down here
   surface.js grows green moss in every damp inner corner; against cave rock those clumps were cut square by their
   cell, and green moss is not the Underdark's (the spider caves have their own violet growth) */
var _mossRasterDeep = mossRaster;
mossRaster = function(x, y){ if(inDeep()) return null; return _mossRasterDeep.apply(this, arguments); };
