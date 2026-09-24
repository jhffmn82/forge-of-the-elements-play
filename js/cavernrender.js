/* =====================================================================
   cavernrender.js - how the Caverns look (2026-09-19). Rock and floor come from the plane terrain renderer
   (js/planeterrain.js) with a cave material; on top of it:
   - chasms: black void, the delivered lip / corner art laid round every edge a quarter tile at a time, and
     floating debris drifting in the dark;
   - rope bridges drawn in code, planked across most of the tile (the delivered bridge art is a quarter tile wide);
   - the cave pieces (map-cave.png) at their natural size: 64 px of art = one tile, standing on their footprint,
     tall art rising above it; clusters and decals flat on the floor; stalactites, glowworms, fossils and the
     waterfall hung on cliff faces.
   Light: the dark biome ambient (render.js), the hero's torch, and the glowing pieces, crystals and pools.
   ===================================================================== */

/* ---------------------------------------------------------------- the cave material for the terrain renderer */
PT_MAT.cavern = {
  /* warm grey stone, darker rock, teal and violet minerals, still teal pools */
  floor:[112,103,94], floorLav:[98,96,102], jointCol:[72,66,60], joint:0.5, grain:0.03, occ:[54,50,48],
  mineralCool:[92,104,112], pearl:[132,124,116], band:[106,99,92],
  top:[84,78,74], topHi:[116,108,100], topLo:[58,54,54], topLav:[82,82,96], edge:[30,27,28],
  face:[82,75,68], faceLo:[48,43,42], faceH:0.8, lip:[134,123,112],
  void:[6,6,8], voidEdge:[24,22,24],
  vein:[64,186,180], veinHot:[186,255,242], veinDark:[34,80,82], inlay:[116,108,100], inlayJoint:[76,70,64], polish:[126,118,108],
  pool:[16,64,92], poolEdge:[36,142,156], poolShallow:[64,172,176], poolRim:[168,248,238], poolShelf:[80,92,96], poolShelfDry:[104,98,92], poolWet:[76,72,70], poolLight:'#5FE0E0',
  crystal:['#E6FFFB','#9FF0E8','#5AB8C8','#8A5AE0'], crystalGold:'#6A4AB8', crystalLight:'#6FE0E8', fill:'#2E3842',
  moss:[[38,92,82],[54,120,104],[28,66,62],[88,186,158]],
  rockHi:'#8A8078', rockMid:'#6A625C', rockLo:'#4A4440', rockEdge:'#221E1E', motif:'none', jag:1   /* broken, rocky edges (planeterrain.js ptJag) */
};


/* ---------------------------------------------------------------- the sheet */
function packedCaveArt(name){
  var g=AS.map && AS.map.cave; if(!g || !g.items[name]) return null;
  var img=atl('map-cave.png'); if(!img) return null;
  var b=g.items[name];
  return {img:img, sx:b[0]+b[2], sy:b[1]+b[3], sw:Math.max(1,b[4]), sh:Math.max(1,b[5]), ox:b[2], oy:b[3], fullW:b[6], fullH:b[7]};
}
/* setArt (js/cryptset.js) finds cave pieces too, so drawSetPiece / setArt('worm-burrow-open') work for anyone */


/* draw a piece at its natural size: the canvas's bottom centre on the footprint's bottom centre */
function caveArtScale(o){ return TS/64*(o.nm && /^(giant-mushroom|mushroom-pair)/.test(o.nm)?.65:1); }
function drawCaveSprite(o, cx, bottom, alpha, flipX){
  if(o.nm==='kobold-crate'){
    ctx.save();ctx.globalAlpha=alpha;ctx.imageSmoothingEnabled=false;
    var cs=Math.min(TS*.46/o.sw,TS*.53/o.sh), cw=o.sw*cs,ch=o.sh*cs;
    var boxes=[[-.24,-.20],[.23,-.14]];
    if(Math.abs(Math.round(cx/TS)+Math.round(bottom/TS))%2===0)boxes.push([0,0]);
    boxes.forEach(function(b){ctx.drawImage(o.img,o.sx,o.sy,o.sw,o.sh,cx+b[0]*TS-cw/2,bottom+b[1]*TS-ch,cw,ch);});
    ctx.restore();return;
  }
  var s=caveArtScale(o), left=cx-o.fullW*s/2, top=bottom-o.fullH*s;
  ctx.save(); ctx.globalAlpha=alpha; ctx.imageSmoothingEnabled=false;
  if(flipX){ ctx.translate(cx, 0); ctx.scale(-1, 1); ctx.translate(-cx, 0); }
  ctx.drawImage(o.img, o.sx, o.sy, o.sw, o.sh, left+o.ox*s, top+o.oy*s, o.sw*s, o.sh*s);
  ctx.restore();
}

function drawCaveProp(p, px, py, alpha){
  var o=(p.cave || CAVE_PIECES[p.name]) ? caveArt(p.name) : null;
  if(!o) return false;
  var w=p.w||1, h=p.h||1, X=(p.x-camX)*TS, Y=(p.y-camY)*TS, flip=hash2(p.x,p.y,5)<0.5 && !/burrow|pool|mine-support/.test(p.name);
  if(p.flat){
    /* clusters and bedrolls: centred on their tile */
    drawCaveArt(o, X+TS/2, Y+TS/2+o.fullH*TS/128, alpha, flip);
    return true;
  }
  drawCaveArt(o, X+w*TS/2, Y+h*TS-TS*0.02, alpha, flip);
  if(typeof flashOf==='function' && p.br){ var fl=flashOf(p); if(fl>0){ ctx.save(); ctx.globalAlpha=fl*0.6; ctx.fillStyle='#FFF'; ctx.fillRect(X+TS*0.25, Y+TS*0.25, TS*0.5, TS*0.5); ctx.restore(); } }
  return true;

}

/* ---------------------------------------------------------------- chasms */
function caveLand(x, y){ if(!inb(x,y)) return false; var t=at(x,y); return t!==CHASM && t!==BRIDGE && !isWallLike(t); }

/* ---------------------------------------------------------------- rope bridges */
function drawCaveBridge(x, y, px, py, alpha){
  var ew = caveLand(x-1,y) || at(x-1,y)===BRIDGE || caveLand(x+1,y) || at(x+1,y)===BRIDGE;
  var ns = caveLand(x,y-1) || at(x,y-1)===BRIDGE || caveLand(x,y+1) || at(x,y+1)===BRIDGE;
  var horiz = ew && !(ns && !(at(x-1,y)===BRIDGE || at(x+1,y)===BRIDGE));
  var endA = horiz ? caveLand(x-1,y) : caveLand(x,y-1), endB = horiz ? caveLand(x+1,y) : caveLand(x,y+1);
  ctx.save(); ctx.globalAlpha=alpha;
  ctx.translate(px+TS/2, py+TS/2); if(!horiz) ctx.rotate(Math.PI/2); ctx.translate(-TS/2, -TS/2);
  var u=TS/24, d0=TS*0.17, d1=TS*0.83, n=5, pw=TS/n;
  /* shadow of the deck in the void */
  ctx.fillStyle='rgba(0,0,0,0.55)'; ctx.fillRect(0, d1, TS, u*1.5);
  var woods=['#7A5634','#6B4A2C','#845E3A','#71502F'];
  for(var k=0;k<n;k++){
    var hx=hash2(x*5+k, y, 811), sag=Math.round((hash2(x,y*3+k,813)-0.5)*u*1.4);
    var x0=Math.round(k*pw)+(k?0.5:0), x1=Math.round((k+1)*pw)-0.5;
    ctx.fillStyle=woods[Math.floor(hx*woods.length)];
    ctx.fillRect(x0, d0+sag, x1-x0, d1-d0);
    ctx.fillStyle='rgba(255,230,190,0.18)'; ctx.fillRect(x0, d0+sag, x1-x0, u*0.8);          /* lit top edge */
    ctx.fillStyle='rgba(0,0,0,0.35)'; ctx.fillRect(x0, d1+sag-u*0.8, x1-x0, u*0.8);          /* shaded bottom end */
    ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillRect(x1, d0+sag, 1, d1-d0);                     /* gap between planks */
    if(hash2(x,y,815+k)<0.5){ ctx.fillStyle='rgba(30,20,12,0.6)'; ctx.fillRect(x0+(x1-x0)*0.45, d0+sag+(d1-d0)*0.2, 1, (d1-d0)*0.5); }   /* grain */
  }
  /* rope rails along both sides, and posts where the bridge meets the ground */
  ctx.lineCap='round';
  [[d0-u*0.5],[d1+u*0.5]].forEach(function(r){
    ctx.strokeStyle='#3A2A18'; ctx.lineWidth=Math.max(1.5, u*1.4); ctx.beginPath(); ctx.moveTo(0, r[0]); ctx.quadraticCurveTo(TS/2, r[0]+u*1.2, TS, r[0]); ctx.stroke();
    ctx.strokeStyle='#C8A870'; ctx.lineWidth=Math.max(1, u*0.7); ctx.beginPath(); ctx.moveTo(0, r[0]-u*0.2); ctx.quadraticCurveTo(TS/2, r[0]+u, TS, r[0]-u*0.2); ctx.stroke();
  });
  [[endA, 0],[endB, TS-u*3]].forEach(function(e){
    if(!e[0]) return;
    [d0-u*2.2, d1-u*0.6].forEach(function(py2){ ctx.fillStyle='#2A1E12'; ctx.fillRect(e[1], py2, u*3, u*3.2); ctx.fillStyle='#8A6A44'; ctx.fillRect(e[1]+u*0.6, py2+u*0.4, u*1.6, u*1.2); });
  });
  ctx.restore();
}


/* ---------------------------------------------------------------- decals and wall features */
function drawCaveDecals(){
  var D=floorMeta.caveDeco; if(!D) return;
  D.decals.forEach(function(d){
    if(d.x<camX-1 || d.x>camX+viewW+1 || d.y<camY-1 || d.y>camY+viewH+1) return;
    var i=idxOf(d.x,d.y); if(!(revealAll||seen[i]) || at(d.x,d.y)!==FLOOR) return;
    var o=caveArt(d.n); if(!o) return;
    var a=((revealAll||vis[i]) ? 1 : memA(0.42))*(/^dc-lichen/.test(d.n) ? 0.3 : 0.8), px=(d.x-camX)*TS, py=(d.y-camY)*TS;   /* 2026-09-19: lichen at 30%, so it tints the stone instead of sitting on it */
    drawCaveArt(o, px+TS/2, py+TS/2+o.fullH*TS/128, a, hash2(d.x,d.y,31)<0.5);
  });
}
function drawGlowwormCurtain(w,px,py,alpha,now){
  var warm=/-2$/.test(w.n);
  ctx.save();ctx.globalAlpha=alpha;ctx.lineWidth=Math.max(.6,TS/90);
  for(var k=0;k<8;k++){
    var h=hash2(w.x,w.y,850+k), x=px+TS*(.14+k*.1), y=py+TS*.12;
    var len=TS*(.25+h*.5), bend=TS*(hash2(w.x,w.y,880+k)-.5)*.09;
    ctx.strokeStyle=warm?'#706340':'#405d50';ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo(x+bend,y+len*.5,x+bend,y+len);ctx.stroke();
    for(var j=1;j<=3;j++){
      var pulse=ANIM.reduce?1:.8+.2*Math.sin((now||0)/750+k*2+j);
      ctx.globalAlpha=alpha*pulse;ctx.fillStyle=warm?'#C5B978':'#80CBB0';
      var dot=Math.max(1,TS*.024);ctx.fillRect(x+bend*j/3-dot/2,y+len*j/3,dot,dot);
    }
    ctx.globalAlpha=alpha;
  }
  ctx.restore();
}
function drawCaveWalls(now){
  var D=floorMeta.caveDeco; if(!D) return;
  D.walls.forEach(function(w){
    if(/^wf-fossil/.test(w.n)) return;   /* 2026-09-22 (Justin): fossils dropped; floors already built keep the entry but never draw it */
    if(w.x<camX-1 || w.x>camX+viewW+1 || w.y<camY-2 || w.y>camY+viewH+1) return;
    var i=idxOf(w.x,w.y); if(!(revealAll||seen[i]) || !isWallLike(at(w.x,w.y))) return;
    var o=caveArt(w.n); if(!o) return;
    var below=idxOf(w.x,w.y+1), a=(revealAll||vis[i]||vis[below]) ? 1 : memA(0.42), px=(w.x-camX)*TS, py=(w.y-camY)*TS, s=TS/64;
    if(/^wf-glowworm-curtain/.test(w.n)){drawGlowwormCurtain(w,px,py,a,now);return;}
    ctx.save(); ctx.globalAlpha=a; ctx.imageSmoothingEnabled=false;
    /* wall art attaches at its top: the waterfall's lip sits at the top of the rock and its basin on the floor below */
    var top = w.fall ? py : py+TS*0.18;
    ctx.drawImage(o.img, o.sx, o.sy, o.sw, o.sh, px+o.ox*s, top+o.oy*s, o.sw*s, o.sh*s);
    if(w.fall && !ANIM.reduce){
      /* a shimmer running down the falling water */
      var t=now/1000, yy=top+TS*(0.35+((t*1.6)%1)*1.1);
      ctx.globalCompositeOperation='lighter'; ctx.globalAlpha=a*0.35; ctx.fillStyle='#BFF6FF'; ctx.fillRect(px+TS*0.46, yy, TS*0.08, TS*0.18);
    }
    ctx.restore();
  });
}
/* after the terrain (render.js draws the wang layers, then paints an inset black square on every chasm cell when
   there is no chasm tileset, then calls drawSurfaceDeco): decals, then the void with its lips, then the cliff-face
   pieces. It hooks drawSurfaceDeco so it lands after that black square instead of under it. */


function drawCavernSurface(){
  if(!inCaverns())return;
  var now=performance.now();
  drawCaveDecals(); drawCaveChasms(now); drawCaveWalls(now);
  ctx.globalAlpha=1;

}
