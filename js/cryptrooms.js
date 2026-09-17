/* =====================================================================
   cryptrooms.js - funerary architecture for ordinary Crypt floors (2026-09-17).
   The Crypt's stone, green fire and mushrooms work; its rooms still read as dungeon rooms with urns in them.
   This pass gives rooms burial purpose and ties decay to it:
   - urn chambers (the Crypt's version of storage rooms): a recessed tomb set into the upper wall, an engraved
     grave slab before it in a worn stone border, and a family of vessels (tall, squat, ornate, plain, shattered)
     arranged in burial rows with gaps, never the same urn repeated down a wall;
   - door thresholds: a worn stone sill on the floor beside every door;
   - disturbed burials: crumbled tombs spill bones, and some leak ooze;
   - small readability fixes: no dungeon drains, a pale rim around monsters so dark figures read on dark stone.
   Everything is placed at generation (rng) or drawn from world position (hash2), so it is stable and saved.
   ===================================================================== */

PROPS['crypt-recess'] = {b:1};
PROPS['grave-slab']   = {flat:1};
['urn-tall','urn-squat','urn-ornate'].forEach(function(n){ PROPS[n]={b:1, br:1, loot:0.3, sfx:'pot-break'}; });
PROPS['urn-shattered'] = {flat:1};

/* ---------------------------------------------------------------- the urn chamber */
function cryptUrn(kindRoll){
  /* a family, weighted so plain and ornate pieces punctuate the common ones */
  var fam = ['urn-tall','urn-squat','urn','urn-squat','urn-tall','urn-ornate','urn-shattered'];
  var have = fam.filter(function(n){ return n==='urn' || (typeof setArt==='function' && setArt(n)); });
  return have.length ? have[Math.floor(kindRoll*have.length)] : 'urn';
}
function buildUrnChamber(r){
  /* clear what the generic storage room put down (keep chests and anything placed on purpose) */
  props.filter(function(p){ return !p.keep && p.x>=r.x && p.x<r.x+r.w && p.y>=r.y && p.y<r.y+r.h; }).forEach(function(p){ removeProp(p); });
  var cx=r.x+(r.w>>1);
  /* the recessed tomb: centred on the upper wall, which must be solid face for three cells */
  var faceOK=true; for(var x=cx-1;x<=cx+1;x++) if(!isWallLike(at(x,r.y-1)) || isWallLike(at(x,r.y))) faceOK=false;
  if(faceOK){
    addProp(cx, r.y-1, 'crypt-recess', {keep:true, set:false});
    floorMeta.planeLights=floorMeta.planeLights||[];
    if(at(cx,r.y)===FLOOR && !itemAt(cx,r.y)){
      var slab=addSetPiece(cx, r.y, 'grave-slab', 1, 2, {keep:true}); if(slab){ slab.b=0; slab.flat=1; }
    }
    floorMeta.cryptBorders=(floorMeta.cryptBorders||[]).concat([{x:cx-1, y:r.y, w:3, h:3, path:Math.min(r.h-3, 4)}]);
    floorMeta.cryptGlow=(floorMeta.cryptGlow||[]).concat([{x:cx, y:r.y-1}]);
  }
  /* vessels in burial rows: along the upper wall either side of the tomb, then along the side walls, with gaps */
  var spots=[];
  for(var x2=r.x; x2<r.x+r.w; x2++) if(Math.abs(x2-cx)>=2) spots.push({x:x2, y:r.y, row:'top'});
  for(var y2=r.y+2; y2<r.y+r.h-1; y2++){ spots.push({x:r.x, y:y2, row:'left'}); spots.push({x:r.x+r.w-1, y:y2, row:'right'}); }
  var placed=0, lastRow=null, run=0;
  spots.forEach(function(s, i){
    if(!freeCell(s.x,s.y) || nearDoor(s.x,s.y)) { run=0; return; }
    if(s.row!==lastRow){ lastRow=s.row; run=0; }
    /* rows come in short runs of two or three separated by a gap */
    if(placed>=Math.max(3, Math.round((r.w+r.h)/3)) || run>=1+(hash2(s.x,s.y,5)<0.35?1:0) || rng()<0.45){ run=0; return; }
    var name=cryptUrn(rng());
    if(name!=='urn-shattered'){ var gp=_addPropUrns(s.x, s.y, 'urn-group', urnGroupExtra()); if(gp){ run++; placed++; } return; }
    var p=addSetPiece(s.x, s.y, name, 1, 1, name==='urn-shattered' ? {keep:false} : {keep:false, br:1, loot:0.3, sfx:'pot-break'});
    if(p && name==='urn-shattered'){ p.b=0; p.flat=1; if(rng()<0.6) addProp(s.x, s.y+ (s.row==='top'?1:0), 'bones'); }
    if(p) { run++; placed++; }
  });
  /* a larger chamber also holds a disturbed burial in a lower corner */
  if(r.w*r.h>=60){   /* against a side wall in the lower half, never in the middle of the floor */
    var opts=[];
    for(var ty=r.y+Math.floor(r.h/2); ty<r.y+r.h-1; ty++){ opts.push({x:r.x, y:ty, n:'tomb-crumbled-v', w:1, h:2}); opts.push({x:r.x+r.w-1, y:ty, n:'tomb-crumbled-v', w:1, h:2}); }
    for(var tx=r.x+1; tx<r.x+r.w-2; tx++) opts.push({x:tx, y:r.y+r.h-1, n:(rng()<0.5?'tomb-crumbled-h':'tomb-open-h'), w:2, h:1});
    opts=shuffled(opts);
    for(var oi=0; oi<opts.length; oi++){
      var q=opts[oi], ok=true;
      for(var yy=q.y; yy<q.y+q.h && ok; yy++) for(var xx=q.x; xx<q.x+q.w; xx++) if(!freeCell(xx,yy) || nearDoor(xx,yy)){ ok=false; break; }
      if(!ok || !setArt(q.n)) continue;
      addSetPiece(q.x, q.y, q.n, q.w, q.h);
      var tp=props[props.length-1], ring=[];
      for(var ry=q.y-1; ry<=q.y+q.h; ry++) for(var rx=q.x-1; rx<=q.x+q.w; rx++){ if(rx>=q.x && rx<q.x+q.w && ry>=q.y && ry<q.y+q.h) continue; if(freeCell(rx,ry) && !nearDoor(rx,ry)) ring.push({x:rx,y:ry}); }
      ring=shuffled(ring); if(ring.length) addProp(ring[0].x, ring[0].y, 'bones');
      if(ring.length>1){ floorMeta.ooze=floorMeta.ooze||{}; floorMeta.ooze[idxOf(ring[1].x,ring[1].y)]=1; }
      floorMeta.cryptBorders=(floorMeta.cryptBorders||[]).concat([{x:q.x, y:q.y, w:q.w, h:q.h, tight:true}]);
      break;
    }
  }
  r.urnChamber=true;
}
var _buildSpecialCrypt = buildSpecial;
buildSpecial = function(kind, r){
  var out=_buildSpecialCrypt(kind, r);
  if(kind==='storage' && typeof inCrypt==='function' && inCrypt() && !(floorMeta && floorMeta.plane)) buildUrnChamber(r);
  return out;
};

/* ---------------------------------------------------------------- disturbed burials: bones beside, sometimes a leak of ooze */
if(typeof scatterCrumbledTomb==='function'){
  var _scatterCrumbled = scatterCrumbledTomb;
  scatterCrumbledTomb = function(r){
    var before=props.length, ok=_scatterCrumbled(r);
    if(!ok) return ok;
    var t=props[props.length-1]; if(!t || !/tomb/.test(t.name)) return ok;
    var ring=[]; for(var y=t.y-1;y<=t.y+t.h;y++) for(var x=t.x-1;x<=t.x+t.w;x++){ if(x>=t.x && x<t.x+t.w && y>=t.y && y<t.y+t.h) continue; if(freeCell(x,y) && !nearDoor(x,y)) ring.push({x:x,y:y}); }
    ring=shuffled(ring);
    var nb=1+(rng()<0.5?1:0); for(var i=0;i<nb && ring.length;i++){ var c=ring.pop(); addProp(c.x,c.y,'bones'); }
    if(rng()<0.45 && ring.length){ var l=ring.pop(); floorMeta.ooze=floorMeta.ooze||{}; floorMeta.ooze[idxOf(l.x,l.y)]=1; var l2=ring.filter(function(q){ return Math.abs(q.x-l.x)+Math.abs(q.y-l.y)===1; })[0]; if(l2) floorMeta.ooze[idxOf(l2.x,l2.y)]=1; }
    floorMeta.cryptBorders=(floorMeta.cryptBorders||[]).concat([{x:t.x, y:t.y, w:t.w, h:t.h, tight:true}]);
    return ok;
  };
}

/* ---------------------------------------------------------------- drawing: recess, slab, borders, thresholds */
var CR_STONE = {block:'#5E5870', blockHi:'#7C7590', blockLo:'#3A3548', mortar:'#211E2A', dark:'#0C0A12', slab:'#5A546C', slabHi:'#7A7390', slabLo:'#3A3548', carve:'#221F2C'};
function crRect(x,y,w,h,col){ ctx.fillStyle=col; ctx.fillRect(Math.round(x),Math.round(y),Math.max(1,Math.round(w)),Math.max(1,Math.round(h))); }
function drawRecess(p, alpha){
  var u=TS/32, X=(p.x-camX-1)*TS, Y=(p.y-camY-1)*TS, W=3*TS, H=2*TS;
  ctx.save(); ctx.globalAlpha=alpha;
  /* the carved frame: two jambs and an arch of voussoirs */
  var ix=X+W*0.18, iw=W*0.64, iy=Y+H*0.18, ih=H*0.82;
  crRect(X+W*0.08, Y+H*0.08, W*0.84, H*0.92, CR_STONE.mortar);
  crRect(X+W*0.1, Y+H*0.3, W*0.1, H*0.7, CR_STONE.block); crRect(X+W*0.8, Y+H*0.3, W*0.1, H*0.7, CR_STONE.block);
  crRect(X+W*0.1, Y+H*0.3, 2*u, H*0.7, CR_STONE.blockHi); crRect(X+W*0.9-2*u, Y+H*0.3, 2*u, H*0.7, CR_STONE.blockLo);
  for(var k=0;k<3;k++){ crRect(X+W*0.1, Y+H*(0.45+k*0.18), W*0.1, u, CR_STONE.mortar); crRect(X+W*0.8, Y+H*(0.52+k*0.18), W*0.1, u, CR_STONE.mortar); }
  /* dark interior with a rounded top */
  ctx.fillStyle=CR_STONE.dark; ctx.beginPath(); ctx.moveTo(ix, Y+H); ctx.lineTo(ix, iy+iw*0.32); ctx.quadraticCurveTo(ix, iy, ix+iw/2, iy); ctx.quadraticCurveTo(ix+iw, iy, ix+iw, iy+iw*0.32); ctx.lineTo(ix+iw, Y+H); ctx.closePath(); ctx.fill();
  var gr=ctx.createLinearGradient(0, iy, 0, Y+H); gr.addColorStop(0,'rgba(60,90,70,0)'); gr.addColorStop(1,'rgba(70,140,90,0.28)'); ctx.fillStyle=gr; ctx.fill();
  /* arch stones */
  for(var s=0;s<7;s++){
    var a0=Math.PI+s/7*Math.PI, a1=Math.PI+(s+1)/7*Math.PI, rx=iw/2+W*0.06, ry=H*0.2, ccx=ix+iw/2, ccy=iy+iw*0.3;
    ctx.fillStyle = s%2 ? CR_STONE.block : CR_STONE.blockHi;
    ctx.beginPath(); ctx.moveTo(ccx+Math.cos(a0)*(iw/2), ccy+Math.sin(a0)*(ry*0.8)); ctx.lineTo(ccx+Math.cos(a0)*rx, ccy+Math.sin(a0)*(ry+W*0.06));
    ctx.lineTo(ccx+Math.cos(a1)*rx, ccy+Math.sin(a1)*(ry+W*0.06)); ctx.lineTo(ccx+Math.cos(a1)*(iw/2), ccy+Math.sin(a1)*(ry*0.8)); ctx.closePath(); ctx.fill();
    ctx.strokeStyle=CR_STONE.mortar; ctx.lineWidth=Math.max(1,u); ctx.stroke();
  }
  /* keystone skull mark */
  crRect(X+W/2-2*u, Y+H*0.06, 4*u, 4*u, CR_STONE.blockHi); crRect(X+W/2-1*u, Y+H*0.06+1*u, u, u, CR_STONE.carve); crRect(X+W/2+1*u, Y+H*0.06+1*u, u, u, CR_STONE.carve);
  /* the sarcophagus lying in the niche */
  var t=typeof setArt==='function' ? setArt('tomb-h') : null;
  if(t){ var tw=iw*0.94, th=tw*(t.sh/t.sw); ctx.imageSmoothingEnabled=false; ctx.drawImage(t.img, t.sx, t.sy, t.sw, t.sh, ix+(iw-tw)/2, Y+H-th-u, tw, th); }
  /* a sill in front */
  crRect(X+W*0.08, Y+H-3*u, W*0.84, 3*u, CR_STONE.blockLo); crRect(X+W*0.08, Y+H-3*u, W*0.84, u, CR_STONE.blockHi);
  ctx.restore();
}
var CR_SLAB = {};
function graveSlabRaster(seed){
  if(CR_SLAB[seed]) return CR_SLAB[seed];
  var W=28, H=58, c=document.createElement('canvas'); c.width=32; c.height=64;
  var g=c.getContext('2d'), im=g.createImageData(32,64), D=im.data, ox=2, oy=3;
  function h(x,y,k){ return hash2(x+seed*7, y-seed*3, k); }
  /* carving mask: a cross in the upper half, four epitaph lines below */
  function carved(x,y){
    if(x>=12 && x<=15 && y>=6 && y<=24) return true;
    if(x>=7 && x<=20 && y>=11 && y<=13) return true;
    for(var k=0;k<4;k++){ var yy=32+k*5, len=10+Math.floor(h(k,1,3)*8), x0=Math.floor((W-len)/2); if(y===yy && x>=x0 && x<x0+len && h(x,yy,4)>0.18) return true; }
    return false;
  }
  for(var y=0;y<64;y++) for(var x=0;x<32;x++){
    var lx=x-ox, ly=y-oy, p=(y*32+x)*4;
    /* chipped outline: corners and a few edge bites removed */
    var inside = lx>=0 && ly>=0 && lx<W && ly<H;
    if(inside){
      var edgeD=Math.min(lx, ly, W-1-lx, H-1-ly);
      if(edgeD===0 && h(lx,ly,1)<0.18) inside=false;
      if((lx+ly<2) || (W-1-lx+ly<2) || (lx+H-1-ly<3) || (W-1-lx+H-1-ly<2)) inside=false;
      if(lx>18 && ly>44 && (lx-18)+(ly-44)>14) inside=false;                      /* a broken lower corner */
    }
    if(!inside){
      /* contact shadow on the floor just below and right */
      if(lx>=1 && ly>=1 && lx<=W && ly<=H+1){ D[p]=10; D[p+1]=8; D[p+2]=16; D[p+3]=90; }
      continue;
    }
    var grain=h(lx,ly,2), blot=hash2(Math.floor(lx/4)+seed, Math.floor(ly/4), 6);
    var base=[88,82,102], l=(grain-0.5)*14 + (blot-0.5)*12 - ly*0.25;
    var col=[base[0]+l, base[1]+l, base[2]+l*1.1];
    var edge=Math.min(lx, ly, W-1-lx, H-1-ly);
    if(edge<=1 && (lx<=1 || ly<=1)) col=[col[0]+26, col[1]+24, col[2]+28];      /* lit bevel, top and left */
    if(edge<=1 && (lx>=W-2 || ly>=H-2)) col=[col[0]-30, col[1]-30, col[2]-26];   /* shaded bevel, bottom and right */
    if(carved(lx,ly)){
      col = carved(lx-1,ly-1) ? [38,34,48] : [54,50,66];                          /* cut: deep, with a softer lower-right floor */
      if(h(lx,ly,8)<0.16) col=[70,98,44];                                         /* moss in the cut */
    } else if(carved(lx+1,ly+1) || carved(lx+1,ly) || carved(lx,ly+1)){
      col=[col[0]+22, col[1]+20, col[2]+24];                                       /* lit lip on the far side of a cut */
    }
    /* a hairline crack */
    if(Math.abs((ly-22) - (lx-20)*1.6)<0.8 && lx>=18 && lx<=26 && ly>=18 && ly<=36) col=[42,38,52];
    if(h(lx,ly,9)<0.015) col=[col[0]+30,col[1]+30,col[2]+32];                     /* flecks */
    D[p]=Math.max(0,Math.min(255,col[0])); D[p+1]=Math.max(0,Math.min(255,col[1])); D[p+2]=Math.max(0,Math.min(255,col[2])); D[p+3]=255;
  }
  g.putImageData(im,0,0); return (CR_SLAB[seed]=c);
}
function drawGraveSlab(p, alpha){
  var img=graveSlabRaster((p.x*31+p.y*17)%97);
  ctx.save(); ctx.globalAlpha=alpha; ctx.imageSmoothingEnabled=false;
  var X=Math.round((p.x-camX)*TS), Y=Math.round((p.y-camY)*TS);
  ctx.drawImage(img, 0, 0, 32, 64, X, Y, Math.round((p.x+1-camX)*TS)-X, Math.round((p.y+2-camY)*TS)-Y);
  ctx.restore();
}
/* small edging stones around tombs, and a worn processional border leading away from a recess */
function drawCryptBorders(){
  var B=floorMeta && floorMeta.cryptBorders; if(!B) return;
  var u=TS/32;
  ctx.save();
  B.forEach(function(b){
    function stone(wx, wy, horiz, k){
      var cx=Math.floor(wx), cy=Math.floor(wy); if(!inb(cx,cy) || !(revealAll||seen[idxOf(cx,cy)])) return;
      if(hash2(Math.round(wx*4), Math.round(wy*4), 91+k)<0.12) return;                                          /* a few are missing */
      var a=(revealAll||vis[idxOf(cx,cy)])?1:0.45, L=(5+hash2(Math.round(wx*8),Math.round(wy*8),92)*3)*u;
      var px=(wx-camX)*TS, py=(wy-camY)*TS;
      ctx.globalAlpha=a*0.9;
      if(horiz){ crRect(px, py-2*u, L, 4*u, '#4A4558'); crRect(px, py-2*u, L, u, '#6C6680'); }
      else { crRect(px-2*u, py, 4*u, L, '#4A4558'); crRect(px-2*u, py, u, L, '#6C6680'); }
    }
    var x0=b.x-(b.tight?0.08:0.12), y0=b.y-(b.tight?0.08:0.05), x1=b.x+b.w+(b.tight?0.08:0.12), y1=b.y+b.h+(b.tight?0.08:0.1), step=0.28;
    for(var x=x0; x<x1-0.1; x+=step){ if(!b.path || true) stone(x, y1, true, 1); if(b.tight) stone(x, y0, true, 2); }
    for(var y=y0; y<y1-0.1; y+=step){ stone(x0, y, false, 3); stone(x1, y, false, 4); }
    if(b.path){   /* two lines of worn edging running out from the tomb toward the room */
      for(var py2=y1; py2<y1+b.path; py2+=step){ if(hash2(0, Math.round(py2*4), 93)<0.3+0.15*(py2-y1)) continue; stone(b.x+0.35, py2, false, 5); stone(b.x+b.w-0.35, py2, false, 6); }
    }
  });
  ctx.restore();
}
/* a worn stone sill on the floor beside each door */
function drawThresholds(){
  var u=TS/32;
  ctx.save();
  for(var y=Math.max(0,camY-1); y<=Math.min(MH-1,camY+viewH+1); y++) for(var x=Math.max(0,camX-1); x<=Math.min(MW-1,camX+viewW+1); x++){
    var t=at(x,y); if(!(t===DOOR || t===OPEN || t===LOCKED)) continue;
    [[0,1],[0,-1],[1,0],[-1,0]].forEach(function(o){
      var nx=x+o[0], ny=y+o[1]; if(!inb(nx,ny) || at(nx,ny)!==FLOOR || !(revealAll||seen[idxOf(nx,ny)])) return;
      if(isWallLike(at(x-o[1], y-o[0])) === false && isWallLike(at(x+o[1], y+o[0])) === false) return;   /* only doors set in a wall */
      var a=(revealAll||vis[idxOf(nx,ny)])?1:0.45, px=(nx-camX)*TS, py=(ny-camY)*TS;
      ctx.globalAlpha=a;
      if(o[1]!==0){ var sy=o[1]>0 ? py : py+TS-7*u; crRect(px+u, sy, TS-2*u, 7*u, '#4E4960'); crRect(px+u, sy+(o[1]>0?0:6*u), TS-2*u, u, '#6E6884'); crRect(px+TS*0.45, sy+u, u, 5*u, '#3A3548'); }
      else { var sx=o[0]>0 ? px : px+TS-7*u; crRect(sx, py+u, 7*u, TS-2*u, '#4E4960'); crRect(sx+(o[0]>0?0:6*u), py+u, u, TS-2*u, '#6E6884'); crRect(sx+u, py+TS*0.5, 5*u, u, '#3A3548'); }
    });
  }
  ctx.restore();
}
function cryptRoomsOn(){ return typeof inCrypt==='function' && inCrypt() && !(floorMeta && floorMeta.plane); }
var _drawTelegraphsRooms = drawTelegraphs;
drawTelegraphs = function(now){
  if(cryptRoomsOn()){ drawThresholds(); drawCryptBorders(); }
  _drawTelegraphsRooms(now);
};
var _drawPropSurfaceRooms = drawPropSurface;
drawPropSurface = function(p, px, py, alpha){
  if(p.name==='crypt-recess'){ drawRecess(p, alpha); return true; }
  if(p.name==='grave-slab'){ drawGraveSlab(p, alpha); return true; }
  return _drawPropSurfaceRooms(p, px, py, alpha);
};
var _gatherLightsRooms = gatherLights;
gatherLights = function(now, prp){
  var L=_gatherLightsRooms(now, prp);
  if(cryptRoomsOn()) (floorMeta.cryptGlow||[]).forEach(function(g){ if(revealAll||seen[idxOf(g.x,g.y)]) L.push({x:g.x, y:g.y+0.9, c:hexRGB('#7CFFA0'), r:2.6, s:0.5, tx:g.x, ty:g.y+1}); });
  return L;
};
/* no dungeon drains in the Crypt */
var _drawDecoRooms = drawDeco;
drawDeco = function(i, px, py, alpha, opt){ if(cryptRoomsOn() && i===DECO.drain) return; return _drawDecoRooms(i, px, py, alpha, opt); };

/* ---------------------------------------------------------------- monsters: a pale rim so dark figures read on dark stone */
var _drawCharacterRooms = drawCharacter;
drawCharacter = function(e, px, py, opts){
  if(e!==player && cryptRoomsOn()){
    ctx.save(); ctx.shadowColor='rgba(226,218,246,0.48)'; ctx.shadowBlur=Math.max(2, TS*0.07); ctx.shadowOffsetX=0; ctx.shadowOffsetY=0;
    try{ return _drawCharacterRooms(e, px, py, opts); } finally { ctx.restore(); }
  }
  return _drawCharacterRooms(e, px, py, opts);
};

/* ---------------------------------------------------------------- tombs: regraded into the Crypt's stone
   The generated tomb art is flat periwinkle. Every tomb piece is remapped by brightness onto the Crypt's
   purple-gray stone ramp, keeps any green rune glow, and gets top-lit form shading. Cached per piece. */
var CR_GRADED = {};
var CR_RAMP = [[22,19,30],[48,43,60],[78,72,94],[112,104,128],[150,142,166],[188,180,202]];
function crRamp(l){ var f=Math.max(0,Math.min(0.9999,l))*(CR_RAMP.length-1), i=Math.floor(f), t=f-i, a=CR_RAMP[i], b=CR_RAMP[i+1]; return [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t]; }
function crGraded(name, o){
  if(CR_GRADED[name]) return CR_GRADED[name];
  var c=document.createElement('canvas'); c.width=o.sw; c.height=o.sh; var g=c.getContext('2d');
  g.drawImage(o.img, o.sx, o.sy, o.sw, o.sh, 0, 0, o.sw, o.sh);
  var im=g.getImageData(0,0,o.sw,o.sh), D=im.data, W=o.sw, H=o.sh;
  /* bounds of the opaque part, for shading relative to the object */
  var minY=H, maxY=0; for(var yy=0;yy<H;yy++) for(var xx=0;xx<W;xx++) if(D[(yy*W+xx)*4+3]>40){ if(yy<minY) minY=yy; if(yy>maxY) maxY=yy; }
  for(var y=0;y<H;y++) for(var x=0;x<W;x++){
    var p=(y*W+x)*4; if(D[p+3]<8) continue;
    var r=D[p], gg=D[p+1], b=D[p+2];
    if(gg>r+30 && gg>b+8) continue;                                                     /* green rune glow stays */
    var l=(0.3*r+0.55*gg+0.15*b)/255;
    var vy=(y-minY)/Math.max(1,maxY-minY), vx=x/W;
    l = Math.pow(l, 0.95)*1.02 + 0.1*(0.5-vy) + 0.05*(0.5-vx);                         /* lit from the upper left */
    var col=crRamp(l*0.95);
    D[p]=col[0]; D[p+1]=col[1]; D[p+2]=col[2];
  }
  /* a darker base line where the stone meets the floor */
  for(var x2=0;x2<W;x2++) for(var y2=maxY; y2>=Math.max(0,maxY-1); y2--){ var q=(y2*W+x2)*4; if(D[q+3]>40){ D[q]*=0.6; D[q+1]*=0.6; D[q+2]*=0.6; } }
  g.putImageData(im,0,0);
  return (CR_GRADED[name]={img:c, sx:0, sy:0, sw:W, sh:H, fullW:o.fullW, fullH:o.fullH, ox:o.ox, oy:o.oy});
}
var _setArtRooms = setArt;
setArt = function(name){
  var o=_setArtRooms(name);
  if(o && /^tomb-/.test(name) && o.img && o.img.complete && o.img.naturalWidth>0) return crGraded(name, o);
  return o;
};

/* ---------------------------------------------------------------- urn groups: two or three small vessels sharing one cell
   Patterns vary per cell (triangle, back row, diagonal, pair with a little one); vessels come from the urn family. */
PROPS['urn-group'] = {b:1, br:1, loot:0.4, sfx:'pot-break'};
var URN_PATTERNS = [   /* [x, foot y, height, special] in cell units */
  [[0.3,0.62,0.55],[0.7,0.62,0.55],[0.5,0.92,0.6]],                                   /* three-urn triangle: two behind, one in front */
  [[0.28,0.62,0.52],[0.56,0.6,0.58],[0.4,0.84,0.5],[0.72,0.88,0.44]],                /* four-urn group, staggered and overlapping */
  [[0.4,0.84,0.7],[0.74,0.9,0.42]],                                                    /* mixed pair: a medium urn beside a small one */
  [[0.22,0.58,0.46],[0.46,0.56,0.62],[0.74,0.62,0.5],[0.34,0.84,0.4],[0.62,0.9,0.44]],/* five-urn collection, varied heights */
  [[0.3,0.64,0.55],[0.58,0.62,0.62],[0.64,0.94,0.46,'tip']],                           /* disturbed: two upright, one tipped over */
  [[0.36,0.74,0.64],[0.66,0.92,0,'shards'],[0.8,0.7,0,'lid']]                          /* broken: one intact, pottery shards, a fallen lid */
];
function urnGroupExtra(){
  var fam=['urn-tall','urn-squat','urn-ornate','urn'].filter(function(n){ return n==='urn' ? !!objArt('props','urn') : !!setArt(n); });
  var pat=Math.floor(rng()*URN_PATTERNS.length), kinds=[];
  for(var i=0;i<URN_PATTERNS[pat].length;i++) kinds.push(fam[Math.floor(rng()*fam.length)]);
  return {pattern:pat, kinds:kinds, flip:rng()<0.5};
}
function drawUrnGroup(p, alpha){
  var pat=URN_PATTERNS[p.pattern||0]||URN_PATTERNS[0];
  var pts=pat.map(function(q,i){ return {x:q[0], y:q[1], s:q[2], sp:q[3], k:(p.kinds||[])[i]||'urn', i:i}; }).sort(function(a,b){ return a.y-b.y; });
  var u=TS/32;
  ctx.save(); ctx.globalAlpha=alpha; ctx.imageSmoothingEnabled=false;
  pts.forEach(function(q){
    var fx=p.flip ? 1-q.x : q.x, cx=(p.x-camX)*TS+fx*TS, fy=(p.y-camY)*TS+q.y*TS;
    if(q.sp==='shards'){
      for(var k=0;k<5;k++){ var sx=cx+(hash2(p.x+k,p.y,31)-0.5)*TS*0.36, sy=fy-(hash2(p.x,p.y+k,32))*TS*0.14, r=(1.5+hash2(k,p.x,33)*2)*u;
        ctx.fillStyle='#2A2230'; ctx.beginPath(); ctx.moveTo(sx-r,sy); ctx.lineTo(sx,sy-r*0.9); ctx.lineTo(sx+r*1.1,sy-r*0.2); ctx.lineTo(sx+r*0.3,sy+r*0.6); ctx.closePath(); ctx.fill();
        ctx.fillStyle=p.name==='stack-group' ? (k%2 ? '#8A6440' : '#A57A4E') : (k%2 ? '#7A5C74' : '#8E6E86'); ctx.beginPath(); ctx.moveTo(sx-r+u*0.6,sy); ctx.lineTo(sx,sy-r*0.9+u*0.6); ctx.lineTo(sx+r*1.1-u*0.6,sy-r*0.2); ctx.closePath(); ctx.fill(); }
      ctx.fillStyle='rgba(150,146,160,0.35)'; ctx.beginPath(); ctx.ellipse(cx, fy-u, TS*0.16, TS*0.05, 0, 0, 7); ctx.fill();   /* spilled ash */
      return;
    }
    if(q.sp==='lid'){
      var lw=TS*0.16, lh=TS*0.07;
      if(p.name==='stack-group'){ ctx.fillStyle='#3A2616'; ctx.fillRect(Math.round(cx-lw), Math.round(fy-lh), Math.round(lw*2), Math.round(lh*1.4)); ctx.fillStyle='#9A7248'; ctx.fillRect(Math.round(cx-lw+u), Math.round(fy-lh), Math.round(lw*2-2*u), Math.round(lh)); return; }   /* a loose plank */
      ctx.fillStyle='#1E1A26'; ctx.beginPath(); ctx.ellipse(cx, fy, lw, lh, 0.5, 0, 7); ctx.fill();
      ctx.fillStyle='#5E5670'; ctx.beginPath(); ctx.ellipse(cx-u*0.5, fy-u*0.8, lw*0.88, lh*0.8, 0.5, 0, 7); ctx.fill();
      ctx.fillStyle='#8A82A0'; ctx.fillRect(Math.round(cx-u*2), Math.round(fy-u*2), Math.round(2*u), Math.max(1,Math.round(u)));
      return;
    }
    var wood=p.name==='stack-group';
    var o = q.sp==='tip' ? (wood ? objArt('props', q.k==='crate' ? 'barrel' : q.k) : setArt('urn-shattered')) : (q.k==='urn' || wood) ? objArt('props', q.k) : setArt(q.k); if(!o) return;
    var h=TS*q.s, w=h*(o.sw/o.sh);
    if(q.sp==='tip' && !wood){ w=TS*q.s*1.3; h=w*(o.sh/o.sw); }
    if(q.sp==='tip' && wood){   /* a barrel or pot lying on its side */
      var tw=TS*q.s*1.05, th=tw*(o.sw/o.sh);
      ctx.fillStyle='rgba(8,6,12,0.34)'; ctx.beginPath(); ctx.ellipse(cx, fy-u, tw*0.55, TS*0.06, 0, 0, 7); ctx.fill();
      ctx.save(); ctx.translate(cx, fy-th/2); ctx.rotate(p.flip ? -Math.PI/2 : Math.PI/2); ctx.drawImage(o.img, o.sx, o.sy, o.sw, o.sh, -th/2, -tw/2, th, tw); ctx.restore();
      return;
    }
    var X=cx-w/2, Y=fy-h;
    ctx.fillStyle='rgba(8,6,12,0.34)'; ctx.beginPath(); ctx.ellipse(cx, fy-u, w*0.42, TS*0.055, 0, 0, 7); ctx.fill();
    if(p.flip && q.sp==='tip'){ ctx.save(); ctx.translate(cx,0); ctx.scale(-1,1); ctx.drawImage(o.img, o.sx, o.sy, o.sw, o.sh, -w/2, Y, w, h); ctx.restore(); }
    else ctx.drawImage(o.img, o.sx, o.sy, o.sw, o.sh, X, Y, w, h);
  });
  ctx.restore();
}
var _drawPropSurfaceUrns = drawPropSurface;
drawPropSurface = function(p, px, py, alpha){ if(p.name==='urn-group' || p.name==='stack-group'){ drawUrnGroup(p, alpha); return true; } return _drawPropSurfaceUrns(p, px, py, alpha); };
/* in the Crypt, about a third of lone urns become groups; urn chambers mix them into their rows */
var _addPropUrns = addProp;
addProp = function(x, y, name, extra){
  var mapped=(typeof CRYPT_PROP!=='undefined' && CRYPT_PROP[name]) || name;   /* barrels, crates and pots turn into urns further down the chain */
  if(cryptRoomsOn() && mapped==='urn' && !(extra && extra.pattern!==undefined)) return _addPropUrns(x, y, 'urn-group', Object.assign(urnGroupExtra(), extra||{}));
  return _addPropUrns(x, y, name, extra);
};

/* ---------------------------------------------------------------- the same for crates, barrels and pots everywhere else
   (explosive barrels and supply crates stay single: they are gameplay pieces) */
PROPS['stack-group'] = {b:1, br:1, burn:1, loot:0.45, sfx:'crate-break'};
function stackGroupExtra(seedName){
  var fam=['crate','barrel','pot'].filter(function(n){ return !!objArt('props', n); });
  var pat=Math.floor(rng()*URN_PATTERNS.length), kinds=[], lead=fam.indexOf(seedName)>=0 ? seedName : fam[0];
  for(var i=0;i<URN_PATTERNS[pat].length;i++) kinds.push(rng()<0.55 ? lead : fam[Math.floor(rng()*fam.length)]);
  return {pattern:pat, kinds:kinds, flip:rng()<0.5};
}
var _addPropStacks = addProp;
addProp = function(x, y, name, extra){
  var outside = !(typeof inCrypt==='function' && inCrypt()) && !(floorMeta && floorMeta.plane);
  if(outside && (name==='crate' || name==='barrel' || name==='pot') && !(extra && extra.pattern!==undefined)){
    var g=_addPropStacks(x, y, 'stack-group', Object.assign(stackGroupExtra(name), extra||{}));
    if(g && name==='pot'){ g.burn=0; g.sfx='pot-break'; }
    return g;
  }
  return _addPropStacks(x, y, name, extra);
};
