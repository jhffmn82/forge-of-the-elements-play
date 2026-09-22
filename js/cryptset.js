/* =====================================================================
   cryptset.js - composed Crypt rooms (2026-09-17), modeled on art/reference/crypt-concept.png.
   - Set pieces: multi-tile art (a sarcophagus on its dais, tombs lying 1x2 or 2x1, a grave monument, wide stairs)
     that block every tile they cover and draw once, full size.
   - Wall pieces: skeleton niches set into wall faces.
   - Green ooze that flows over several tiles and bubbles; soul-fire urns trailing green smoke; Crypt doors.
   - buildCryptShowcase(): the concept's burial hall rebuilt as a playable room, for review.
   ===================================================================== */

function setArt(name){
  var g=AS.map && AS.map.set;
  if(!g || !g.items[name]){ var po=objArt('props', name); return po ? {img:po.img, sx:po.sx, sy:po.sy, sw:po.sw, sh:po.sh} : null; }   /* props can be set pieces too */
  var img=atl('map-set.png'); if(!img) return null;
  var b=g.items[name];
  return {img:img, sx:b[0]+b[2], sy:b[1]+b[3], sw:Math.max(1,b[4]), sh:Math.max(1,b[5]), fullW:b[6], fullH:b[7], ox:b[2], oy:b[3]};
}

/* ---------------------------------------------------------------- multi-tile set pieces */
function addSetPiece(x, y, name, w, h, extra){
  var p=addProp(x, y, name, Object.assign({set:true, w:w, h:h, b:1, keep:true}, extra||{}));
  if(!p) return null;
  var idx=props.indexOf(p);
  for(var yy=y; yy<y+h; yy++) for(var xx=x; xx<x+w; xx++){ if(inb(xx,yy)) propGrid[idxOf(xx,yy)]=idx; }
  return p;
}
var _rebuildPropGridSet = rebuildPropGrid;
rebuildPropGrid = function(){
  _rebuildPropGridSet();
  for(var i=0;i<props.length;i++){ var p=props[i]; if(!p.set) continue; for(var yy=p.y; yy<p.y+p.h; yy++) for(var xx=p.x; xx<p.x+p.w; xx++) if(inb(xx,yy)) propGrid[idxOf(xx,yy)]=i; }
};
function drawSetPiece(p, alpha){
  var o=setArt(p.name); if(!o) return false;
  if(p.half){ o={img:o.img, sx:o.sx+(p.half==='r'?Math.floor(o.sw/2):0), sy:o.sy, sw:Math.ceil(o.sw/2), sh:o.sh}; }   /* one urn of the pair */
  /* the art itself (its trimmed box) fills the piece's tiles, standing on their bottom edge */
  var fit=p.wall ? 0.9 : 0.98, sc=Math.min((p.w*TS*fit)/o.sw, (p.h*TS*(p.w===1&&p.h===1?1.15:1.02))/o.sh);
  var dw=o.sw*sc, dh=o.sh*sc, px=(p.x-camX)*TS+(p.w*TS-dw)/2, py=p.wall ? (p.y-camY)*TS+(TS-dh)/2 : (p.y-camY+p.h)*TS-dh-TS*0.02;
  ctx.save(); ctx.globalAlpha=alpha; ctx.imageSmoothingEnabled=false;
  /* 2026-09-21: no contact shadow under a set piece either - a map object casts none (Justin's ruling) */
  ctx.drawImage(o.img, o.sx, o.sy, o.sw, o.sh, px, py, dw, dh);
  ctx.restore();
  return true;
}

/* ---------------------------------------------------------------- ooze: green pools that flow over tiles */
function isOozeAt(x,y){ return inb(x,y) && floorMeta && floorMeta.ooze && floorMeta.ooze[idxOf(x,y)]; }
function oozeSig(x,y){ var s=''; for(var yy=y-2;yy<=y+2;yy++) for(var xx=x-2;xx<=x+2;xx++) s+=isOozeAt(xx,yy)?'1':'0'; return s; }
function oozeField(wx, wy, cells, salt){
  var f=0;
  for(var k=0;k<cells.length;k++){ var dx=wx-cells[k][0], dy=wy-cells[k][1], d=Math.sqrt(dx*dx+dy*dy)/1.4; if(d<1) f+=(1-d)*(1-d); }
  if(!f) return 0;
  return f + (ptValG(wx*1.9, wy*1.9, salt)-0.5)*0.34 + (ptValG(wx*5.3, wy*5.3, salt+5)-0.5)*0.12;
}
function oozeRaster(x, y){
  var R=32, cells=[];
  for(var yy=y-2;yy<=y+2;yy++) for(var xx=x-2;xx<=x+2;xx++) if(isOozeAt(xx,yy)) cells.push([xx+0.5, yy+0.5]);
  if(!cells.length) return null;
  var c=document.createElement('canvas'); c.width=R; c.height=R;
  var g=c.getContext('2d'), im=g.createImageData(R,R), D=im.data, salt=surfSalt()+7, any=false, T=0.22, e=1.5/R;
  for(var v=0; v<R; v++) for(var u=0; u<R; u++){
    var wx=x+(u+0.5)/R, wy=y+(v+0.5)/R, f=oozeField(wx, wy, cells, salt);
    if(f<T) continue;
    var p=(v*R+u)*4, deep=Math.min(1,(f-T)*2.2), shore=f<T+0.07;
    var col, a;
    if(shore){
      /* which way does this bit of shore face? light comes from the upper left */
      var fUL=oozeField(wx-e, wy-e, cells, salt), facing=f-fUL;
      var glint=ptValG(wx*6.5, wy*6.5, salt+9);
      if(facing>0.004 && glint>0.62){ col=[130,196,92]; a=210; }                  /* a lit, wet edge: only in places */
      else if(glint<0.3){ col=[40,96,34]; a=150; }                                /* the film thins over the stone */
      else { col=[24,70,28]; a=215; }                                             /* dark lip */
    } else {
      col=[30+(1-deep)*16, 78+(1-deep)*26, 34+(1-deep)*6]; a=Math.round(150+50*deep);   /* darker, translucent green */
      var sheen=ptValG(wx*2.6+3, wy*2.6, salt+11);
      if(sheen>0.78 && deep>0.35) { col=[col[0]+18, col[1]+26, col[2]+10]; }   /* broad soft sheen patches */
      if(deep>0.3 && hash2(Math.floor(wx*R), Math.floor(wy*R), salt+13)<0.012) { col=[150,220,120]; a=220; }   /* a few wet glints */
    }
    D[p]=col[0]; D[p+1]=col[1]; D[p+2]=col[2]; D[p+3]=a; any=true;
  }
  if(!any) return null;
  g.putImageData(im,0,0); return c;
}
function drawOoze(now){
  if(!floorMeta || !floorMeta.ooze) return;
  var t=ANIM.reduce ? 0 : now/1000;
  for(var y=camY-1; y<=camY+viewH+1; y++) for(var x=camX-1; x<=camX+viewW+1; x++){
    if(!inb(x,y)) continue; var i=idxOf(x,y); if(!(revealAll||seen[i]) || isWallLike(map[i])) continue;
    var near=false; for(var dy=-1;dy<=1 && !near;dy++) for(var dx=-1;dx<=1;dx++) if(isOozeAt(x+dx,y+dy)){ near=true; break; }
    if(!near) continue;
    var alpha=(revealAll||vis[i])?1:memA(0.4);
    blitRaster(cachedRaster('o'+oozeSig(x,y)+'@', x, y, oozeRaster), (x-camX)*TS, (y-camY)*TS, alpha);
    if(isOozeAt(x,y) && alpha===1){
      /* a slow sheen drifting over the surface */
      var sh=(t*0.12 + hash2(x,y,41))%1, sx=(x-camX+sh)*TS, sy=(y-camY+0.3+0.2*hash2(x,y,43))*TS;
      if(isOozeAt(x+1,y) || sh<0.6){ ctx.globalAlpha=0.14*Math.sin(sh*Math.PI); ctx.fillStyle='#CFF0B8'; ctx.beginPath(); ctx.ellipse(sx, sy, TS*0.22, TS*0.05, -0.3, 0, 7); ctx.fill(); ctx.globalAlpha=1; }
      /* bubbles swell and pop */
      for(var b=0;b<2;b++){
        var ph=(t*0.55 + hash2(x,y,31+b)*7)%1, bx=(x-camX+0.2+0.6*hash2(x,y,11+b))*TS, by=(y-camY+0.2+0.6*hash2(x,y,21+b))*TS, r=TS*0.07*Math.sin(ph*Math.PI);
        if(r<0.8) continue;
        ctx.fillStyle='rgba(120,210,80,0.55)'; ctx.beginPath(); ctx.arc(bx,by,r,0,7); ctx.fill();
        ctx.strokeStyle='rgba(200,255,160,0.85)'; ctx.lineWidth=1; ctx.beginPath(); ctx.arc(bx,by,r,0,7); ctx.stroke();
        ctx.fillStyle='rgba(240,255,220,0.95)'; ctx.fillRect(bx-r*0.45, by-r*0.55, Math.max(1,r*0.4), Math.max(1,r*0.4));
      }
    }
  }
  ctx.globalAlpha=1;
}

/* ---------------------------------------------------------------- grime: green-brown blotches and moss worked into the floor
   Denser against walls, around ooze and in corners, thin in the open; the same world tile always gets the same stain. */
function grimeLevel(x,y){
  var near=0;
  for(var dy=-1;dy<=1;dy++) for(var dx=-1;dx<=1;dx++){ if(!dx&&!dy) continue; var t=at(x+dx,y+dy); if(isWallLike(t) && t!==WATER) near++; }
  var ooze=0; for(var oy=-2;oy<=2;oy++) for(var ox=-2;ox<=2;ox++) if(isOozeAt(x+ox,y+oy)) ooze++;
  return Math.min(1, 0.12 + near*0.09 + ooze*0.06);
}
function grimeBlobs(cx, cy, salt){
  if(!inb(cx,cy) || isWallLike(at(cx,cy))) return [];
  var lvl=grimeLevel(cx,cy);
  if(hash2(cx,cy,salt) > 0.35+lvl*0.65) return [];
  var out=[], nb=1+Math.floor(hash2(cx,cy,salt+1)*3);
  for(var k=0;k<nb;k++) out.push([cx+hash2(cx,cy,salt+10+k), cy+hash2(cx,cy,salt+20+k), 0.22+0.4*hash2(cx,cy,salt+30+k)*(0.6+lvl)]);
  return out;
}
function grimeRaster(x, y){
  var R=32, salt=surfSalt()+19, blobs=[];
  for(var oy=-1;oy<=1;oy++) for(var ox=-1;ox<=1;ox++) blobs=blobs.concat(grimeBlobs(x+ox, y+oy, salt));
  if(!blobs.length) return null;
  var c=document.createElement('canvas'); c.width=R; c.height=R;
  var g=c.getContext('2d'), im=g.createImageData(R,R), D=im.data, any=false;
  for(var v=0; v<R; v++) for(var u=0; u<R; u++){
    var wx=x+(u+0.5)/R, wy=y+(v+0.5)/R, f=0;
    for(var b=0;b<blobs.length;b++){ var dx=wx-blobs[b][0], dy=wy-blobs[b][1], d=Math.sqrt(dx*dx+dy*dy)/blobs[b][2]; if(d<1) f+=(1-d); }
    if(f<=0) continue;
    var grain=hash2(Math.floor(wx*24), Math.floor(wy*24), salt+40), clump=ptValG(wx*3.2, wy*3.2, salt+41);
    var joint=grimeJoint(wx, wy);
    var val=f*0.75 + (grain-0.5)*0.3 + (clump-0.5)*0.4 + joint*0.55 - 0.08;
    if(val<0.35) continue;
    var p=(v*R+u)*4, moss=grain>0.72;
    var col = moss ? [74,110,38] : [44+grain*14, 62+grain*18, 30];
    D[p]=col[0]; D[p+1]=col[1]; D[p+2]=col[2]; D[p+3]=Math.round(Math.min(150, (val-0.35)*260) * (moss?1:0.8)); any=true;
  }
  if(!any) return null;
  g.putImageData(im,0,0); return c;
}
/* how much of a joint lies under this spot of floor (0..1), read from the floor texture itself */
var GRIME_FLOOR = {img:null, data:null, W:0};
function grimeJoint(wx, wy){
  var img=typeof surfImg==='function' ? surfImg('floor') : null; if(!img || !img.naturalWidth) return 0;
  if(GRIME_FLOOR.img!==img){ try{ var c=document.createElement('canvas'); c.width=img.naturalWidth; c.height=img.naturalHeight; var g=c.getContext('2d'); g.drawImage(img,0,0); GRIME_FLOOR={img:img, data:g.getImageData(0,0,c.width,c.height).data, W:c.width, H:c.height}; }catch(e){ GRIME_FLOOR={img:img, data:null}; } }
  var F=GRIME_FLOOR; if(!F.data) return 0;
  var per=Math.round(F.W/64), cx=Math.floor(wx), cy=Math.floor(wy);
  var tx=(((cx+surfOff(0))%per+per)%per)*64 + Math.floor((wx-cx)*64), ty=(((cy+surfOff(1))%per+per)%per)*64 + Math.floor((wy-cy)*64);
  var best=255;
  for(var o=-3;o<=3;o+=3){ var sx=(tx+o+F.W)%F.W, sy=(ty+F.H)%F.H, p=(sy*F.W+sx)*4, l=(F.data[p]+F.data[p+1]+F.data[p+2])/3; if(l<best) best=l;
                            sx=(tx+F.W)%F.W; sy=(ty+o+F.H)%F.H; p=(sy*F.W+sx)*4; l=(F.data[p]+F.data[p+1]+F.data[p+2])/3; if(l<best) best=l; }
  return Math.max(0, Math.min(1, (70-best)/30));
}
function ptValG(wx, wy, s){ var x0=Math.floor(wx), y0=Math.floor(wy), fx=wx-x0, fy=wy-y0; fx=fx*fx*(3-2*fx); fy=fy*fy*(3-2*fy);
  var a=hash2(x0,y0,s), b=hash2(x0+1,y0,s), c=hash2(x0,y0+1,s), d=hash2(x0+1,y0+1,s); return a+(b-a)*fx+(c-a)*fy+(a-b-c+d)*fx*fy; }
function drawGrime(){
  if(!(typeof inCrypt==='function' && inCrypt()) || (floorMeta && floorMeta.plane)) return;
  for(var y=camY; y<=camY+viewH; y++) for(var x=camX; x<=camX+viewW; x++){
    if(!inb(x,y)) continue; var i=idxOf(x,y); if(!(revealAll||seen[i]) || isWallLike(map[i])) continue;
    var sig='gr2';
    blitRaster(cachedRaster(sig+'@', x, y, grimeRaster), (x-camX)*TS, (y-camY)*TS, (revealAll||vis[i])?1:0.5);
  }
  ctx.globalAlpha=1;
}

/* ---------------------------------------------------------------- soul fire smoke rising from urns */
function drawSoulSmoke(p, now){
  var t=ANIM.reduce ? 0 : now/1000, cx=(p.x-camX+0.5)*TS, base=(p.y-camY+0.3)*TS;
  ctx.save();
  for(var k=0;k<6;k++){
    var ph=((t*0.35 + k/6 + hash2(p.x,p.y,k))%1), y=base - ph*TS*1.6, x=cx + Math.sin(t*2.2 + ph*9 + k)*TS*0.14*ph;
    ctx.globalAlpha=(1-ph)*0.55; ctx.fillStyle= k%2 ? '#9CFF8A' : '#4FD86A';
    var s=Math.max(2, TS*0.09*(1-ph*0.4)); ctx.fillRect(x-s/2, y-s/2, s, s);
  }
  ctx.restore();
}

/* ---------------------------------------------------------------- hooking the renderer */
var _drawTelegraphsSet = drawTelegraphs;
drawTelegraphs = function(now){ drawGrime(); drawOoze(now); _drawTelegraphsSet(now); };
var _drawPropSurfaceSet = typeof drawPropSurface==='function' ? drawPropSurface : null;
drawPropSurface = function(p, px, py, alpha){
  if(p.set){ if(drawSetPiece(p, alpha)){ if(p.soulSmoke) drawSoulSmoke(p, performance.now()); return true; } }
  if(p.soulSmoke){ var r=_drawPropSurfaceSet ? _drawPropSurfaceSet(p, px, py, alpha) : false; if(!r){ var o=objArt('props',p.name)||setArtAsObj(p.name); if(o){ drawObj(o, px, py, {feet:true, fit:0.9, alpha:alpha}); } } drawSoulSmoke(p, performance.now()); return true; }
  return _drawPropSurfaceSet ? _drawPropSurfaceSet(p, px, py, alpha) : false;
};
function setArtAsObj(name){ var o=setArt(name); return o ? {img:o.img, sx:o.sx, sy:o.sy, sw:o.sw, sh:o.sh} : null; }



/* Crypt doors */
var _tileSpriteSet = tileSprite;
tileSprite = function(x,y,t){
  if(typeof inCrypt==='function' && inCrypt() && (t===DOOR)){ var o=setArtAsObj('crypt-door'); if(o) return o; }
  return _tileSpriteSet(x,y,t);
};

/* ---------------------------------------------------------------- the showcase: the concept's burial hall */
/* laid out from the concept: a top chapel, the central hall, two side chapels behind doors, a hallway to the stairs */
var CRYPT_HALL = (function(){
  var W=28, H=24, rows=[];
  for(var y=0;y<H;y++){ var r=''; for(var x=0;x<W;x++) r+='#'; rows.push(r.split('')); }
  function fill(x0,y0,x1,y1,ch){ for(var y=y0;y<=y1;y++) for(var x=x0;x<=x1;x++) rows[y][x]=ch; }
  fill(10,1,16,4,'.');     /* top chapel */
  fill(13,5,14,5,'.');     /* its opening */
  fill(7,6,20,15,'.');     /* the hall */
  fill(1,8,5,12,'.');      /* west chapel */
  fill(22,8,26,12,'.');    /* east chapel */
  rows[10][6]='D'; rows[10][21]='D';
  fill(13,16,14,22,'.');   /* the hallway in */
  return rows.map(function(r){ return r.join(''); });
})();
/* Stamp the hall at (ox,oy). mode 'boss' = Morty's hall on the Crypt's last floor (exit gate in the east chapel, the
   hallway opens onto the rest of the floor); anything else = the stand-alone showcase with wide stairs at the hallway's end. */
function stampCryptHall(ox, oy, mode){
  var boss = mode==='boss';
  floorMeta.ooze = floorMeta.ooze || {}; floorMeta.clouds = floorMeta.clouds || []; floorMeta.marks = floorMeta.marks || [];
  for(var y=0;y<CRYPT_HALL.length;y++) for(var x=0;x<CRYPT_HALL[y].length;x++){
    var ch=CRYPT_HALL[y][x], i=idxOf(ox+x, oy+y);
    map[i] = ch==='#' ? WALL : ch==='D' ? DOOR : FLOOR;
  }
  function P(x,y){ return {x:ox+x, y:oy+y}; }
  function put(x,y,name,extra){ var c=P(x,y);
    if(name==='urn-cluster'){   /* urns stand against walls, breakable, one or two of them */
      var h=hash2(c.x,c.y,71); extra=Object.assign({br:1, loot:0.35, sfx:'pot-break', half:h<0.35?'l':h<0.7?'r':null}, extra||{});
      if(!(isWallLike(at(c.x-1,c.y))||isWallLike(at(c.x+1,c.y))||isWallLike(at(c.x,c.y-1))||isWallLike(at(c.x,c.y+1)))) console.warn('urn off the wall', x, y);
    }
    return addProp(c.x,c.y,name,Object.assign({set:true, w:1, h:1, b:name==='rubble'?0:1, keep:true}, extra||{})); }
  function piece(x,y,name,w,h){ var c=P(x,y); return addSetPiece(c.x,c.y,name,w,h); }
  function wall(x,y,name){ var c=P(x,y); return addProp(c.x,c.y,name,{set:true, w:1, h:1, wall:true, keep:true}); }
  var SOUL={soulSmoke:true, light:'#7CFFA0'}, WISP={wisps:true, light:'#7CFFA0', dim:1};
  /* the top chapel: a grave monument against the back wall, skeletons in niches, soul fire either side (Morty's phylactery waits here) */
  piece(12,1,'grave-monument',2,2);
  wall(11,0,'wall-niche'); wall(15,0,'wall-niche');
  put(10,2,'soul-urn',SOUL); put(16,2,'soul-urn',SOUL);
  put(10,4,'urn-cluster'); put(16,4,'urn-cluster');
  /* the hall: the great sarcophagus on its dais (only ever here), grave posts breathing soul wisps, ooze across the floor */
  piece(12,9,'dais-sarcophagus',3,4);
  put(10,8,'grave-post',WISP); put(17,8,'grave-post',WISP); put(10,13,'grave-post',WISP); put(17,13,'grave-post',WISP);
  put(7,6,'soul-urn',SOUL); put(20,6,'soul-urn',SOUL);
  put(19,6,'urn-cluster'); addProp(P(7,15).x,P(7,15).y,'rubble'); addProp(P(20,11).x,P(20,11).y,'rubble'); addProp(P(19,15).x,P(19,15).y,'rubble');
  [[7,10],[8,10],[8,11],[7,11],[8,12],[9,11],[9,12],[9,13],[8,13],[7,12],[9,14],[10,14],[11,14],[11,15],[12,15],[8,14]].forEach(function(o){ var c=P(o[0],o[1]); floorMeta.ooze[idxOf(c.x,c.y)]=1; });
  /* the west chapel: a tomb, a skeleton niche, soul fire */
  piece(2,9,'tomb-v',1,2); wall(3,7,'wall-niche'); put(4,9,'soul-urn',{soulSmoke:true, light:'#7CFFA0', dim:1}); put(1,8,'urn-cluster'); addProp(P(4,12).x,P(4,12).y,'rubble');
  wall(24,7,'wall-niche'); put(23,9,'soul-urn',{soulSmoke:true, light:'#7CFFA0', dim:1}); put(26,8,'urn-cluster'); put(26,12,'urn-cluster');
  var hall={x:ox+7, y:oy+6, w:14, h:10, cx:ox+13, cy:oy+10, id:rooms.length, hall:true};
  if(boss){
    /* the east chapel holds the way on: the exit gate straight through the door from the hall, the rune tomb beside it */
    piece(23,11,'tomb-rune',1,2);
    var g=P(26,10); setT(g.x,g.y,EXIT); floorMeta.exitAt={x:g.x, y:g.y};
    floorMeta.bossAt=P(13,7); floorMeta.phylAt=P(13,3);
    addProp(P(13,17).x,P(13,17).y,'bones'); addProp(P(14,20).x,P(14,20).y,'rubble');
    floorMeta.hallRect={x:ox, y:oy, w:CRYPT_HALL[0].length, h:CRYPT_HALL.length};
    rooms.push(hall);
  } else {
    piece(25,9,'tomb-rune',1,2);
    var st=P(13,21); map[idxOf(st.x,st.y)]=(typeof UPSTAIRS!=='undefined'?UPSTAIRS:STAIRS);
    var sp=piece(13,21,'stairs-wide',2,2); if(sp) sp.b=0;
    addProp(P(13,17).x,P(13,17).y,'bones');
  }
  return hall;
}
/* the boss floor: the approach is built in the west, the hall is stamped against the east edge and its hallway is tunnelled
   down, west and up into the nearest approach room */
function stampCryptBossHall(){
  var ox=MW-CRYPT_HALL[0].length-1, oy=(MH-CRYPT_HALL.length)>>1;
  var near=rooms.slice().sort(function(a,b){ return (b.x+b.w)-(a.x+a.w); })[0];
  var hall=stampCryptHall(ox, oy, 'boss');
  var fx=ox+13, fy=oy+CRYPT_HALL.length-1, low=Math.min(MH-2, fy+2);
  function dig(x,y){ if(at(x,y)===WALL) setT(x,y,FLOOR); }
  for(var y=fy; y<=low; y++){ dig(fx,y); dig(fx+1,y); }
  var tx=near.x+(near.w>>1);
  for(var x=fx; x!==tx; x+= x>tx?-1:1) dig(x,low);
  for(y=low; y>=near.y+near.h-1; y--) dig(tx,y);
  return hall;
}
/* after the rest of the generator has run, keep chests, traps, loot and grass out of the hall itself */
var _generateHall = generate;
generate = function(seed){
  _generateHall(seed);
  var R=floorMeta && floorMeta.hallRect; if(!R) return;
  function inR(o){ return o.x>=R.x && o.x<R.x+R.w && o.y>=R.y && o.y<R.y+R.h; }
  feats=feats.filter(function(f){ return !inR(f); }); items=items.filter(function(it){ return !inR(it); });
  for(var y=R.y;y<R.y+R.h;y++) for(var x=R.x;x<R.x+R.w;x++){ var i=idxOf(x,y); if(map[i]===CHEST){ map[i]=FLOOR; delete chestKind[i]; } ground[i]=0; }
};
function buildCryptShowcase(){
  var W=MW, H=MH, ox=Math.floor((W-CRYPT_HALL[0].length)/2), oy=Math.floor((H-CRYPT_HALL.length)/2);
  map=new Uint8Array(W*H); seen=new Uint8Array(W*H); vis=new Uint8Array(W*H); ground=new Uint8Array(W*H); fireT=new Uint8Array(W*H);
  if(typeof fireSrc!=='undefined') fireSrc=new Uint8Array(W*H);
  propGrid=new Int16Array(W*H).fill(-1); props=[]; feats=[]; items=[]; ents=[player]; rooms=[]; chestKind={}; levers=[]; plates=null; altars={};
  if(typeof groundReset==='function') groundReset();
  floorMeta={floor:floorNo, biome:1, notes:[], ooze:{}, clouds:[], marks:[]};
  stampCryptHall(ox, oy, 'showcase');
  player.x=ox+13; player.y=oy+19; player._lx=undefined;
  for(var j=0;j<seen.length;j++) seen[j]=1;
  if(typeof SURF_CACHE!=='undefined') SURF_CACHE.key=null;
  computeFOV(); resize(); updateUI(); draw();
}

/* ---------- ooze: 1 poison damage for each turn a living creature ends in it (the dead and oozes don't care) ---------- */
var _endTurnOoze = endTurn;
endTurn = function(){
  _endTurnOoze();
  if(!floorMeta || !floorMeta.ooze || !player || player.hp<=0) return;
  ents.slice().forEach(function(e){
    if(e.hp<=0 || !isOozeAt(e.x,e.y)) return;
    if(e!==player && (e.base.undead || e.base.object || e.base.ooze || e.base.flying)) return;
    var d=1; e.hp-=d; e._hit=Math.max(performance.now(), fxClock);   /* a flat tick like poison status: guards and wards don't soak it */
    floatText(e.x,e.y,String(d),'poison');
    if(e===player){ log('The grave ooze stings: '+d+' poison damage.','c-you'); if(player.hp<=0){ heroicResolve(); if(player.hp<=0) death(); } }
    else if(e.hp<=0) kill(e, null);
  });
};

/* ---------- soul wisps: glowing green smoke curling up out of grave posts ---------- */
function drawSoulWisps(p, now){
  var t=ANIM.reduce ? 0 : now/1000, cx=(p.x-camX+0.5)*TS, top=(p.y-camY)*TS+TS*0.02;
  ctx.save(); ctx.globalCompositeOperation='lighter';
  for(var k=0;k<3;k++){
    var off=hash2(p.x,p.y,k+11), speed=0.22+off*0.12;
    for(var s=0;s<9;s++){   /* each wisp is a ribbon of soft puffs trailing up and swaying */
      var ph=((t*speed + k/3 + off - s*0.018)%1+1)%1;
      var y=top - ph*TS*1.5, sway=Math.sin(t*1.6 + ph*7 + k*2.1)*TS*(0.05+ph*0.22);
      var r=TS*(0.09+ph*0.2), a=(1-ph)*(ph<0.12 ? ph/0.12 : 1)*0.42*(1-s/12);
      var g=ctx.createRadialGradient(cx+sway, y, 0, cx+sway, y, r);
      g.addColorStop(0, 'rgba(170,255,160,'+a.toFixed(3)+')'); g.addColorStop(0.5, 'rgba(90,230,120,'+(a*0.6).toFixed(3)+')'); g.addColorStop(1, 'rgba(40,160,80,0)');
      ctx.fillStyle=g; ctx.beginPath(); ctx.arc(cx+sway, y, r, 0, 7); ctx.fill();
    }
  }
  /* a glow at the post's mouth */
  var pulse=0.75+0.25*Math.sin(t*2.3+p.x);
  var gg=ctx.createRadialGradient(cx, top+TS*0.05, 0, cx, top+TS*0.05, TS*0.3);
  gg.addColorStop(0,'rgba(150,255,150,'+(0.6*pulse).toFixed(3)+')'); gg.addColorStop(1,'rgba(60,200,100,0)');
  ctx.fillStyle=gg; ctx.beginPath(); ctx.arc(cx, top+TS*0.05, TS*0.3, 0, 7); ctx.fill();
  ctx.restore();
}
var _drawPropSurfaceWisp = drawPropSurface;
drawPropSurface = function(p, px, py, alpha){
  var r=_drawPropSurfaceWisp(p, px, py, alpha);
  if(r && p.wisps) drawSoulWisps(p, performance.now());
  return r;
};

/* ---------- ordinary Crypt floors: grave posts as soul-wisp torches, crumbled tombs scattered through rooms ---------- */
PROPS['grave-post'] = PROPS['grave-post'] || {b:1};
var _addPropPost = addProp;
addProp = function(x, y, name, extra){
  if(inCrypt() && !(floorMeta && floorMeta.plane) && (name==='torch-stand' || name==='candelabra') && !(extra && extra.set) && rng()<0.35 && setArt('grave-post'))
    return _addPropPost(x, y, 'grave-post', Object.assign({set:true, w:1, h:1, b:1, wisps:true, light:'#7CFFA0', dim:1}, extra||{}));
  return _addPropPost(x, y, name, extra);
};
var CRUMBLED = [['tomb-crumbled-v',1,2], ['tomb-crumbled-h',2,1], ['tomb-open-h',2,1]];
function scatterCrumbledTomb(r){
  var kind=pick(CRUMBLED), w=kind[1], h=kind[2];
  if(!setArt(kind[0]) || r.w<w+2 || r.h<h+2) return false;
  for(var tries=0; tries<12; tries++){
    var x=r.x+1+ri(0, r.w-w-2), y=r.y+1+ri(0, r.h-h-2), ok=true;
    for(var yy=y; yy<y+h && ok; yy++) for(var xx=x; xx<x+w && ok; xx++) if(!freeCell(xx,yy) || nearDoor(xx,yy) || (xx===r.cx && yy===r.cy)) ok=false;
    if(ok){ addSetPiece(x, y, kind[0], w, h); return true; }
  }
  return false;
}
var _decoratePlainCrypt = decoratePlain;
decoratePlain = function(r){
  _decoratePlainCrypt(r);
  if(!inCrypt() || (floorMeta && floorMeta.plane) || r.hall) return;
  if(rng()<0.45) scatterCrumbledTomb(r);
  if(rng()<0.4){ var e=pick(edgeCells(r)); if(e) blob(e.x, e.y, ri(6,14), function(xx,yy){ if(at(xx,yy)===FLOOR && !gAt(xx,yy) && !propAt(xx,yy) && !isOozeAt(xx,yy)) setG(xx,yy,G_GRASS); }); }   /* mushroom patches creep out from the walls */
  if(r.w*r.h>=36 && rng()<0.3) scatterCrumbledTomb(r);
};

/* ---------- Crypt vegetation: glowing purple mushrooms instead of grass (2026-09-17) ----------
   Same ground codes as grass: G_GRASS = a living patch, G_SHORT = trampled. They glow, they don't hide you or block sight,
   and stepping on a patch squashes it with a puff of spores. */
function cryptShrooms(){ return typeof inCrypt==='function' && inCrypt() && !(floorMeta && floorMeta.plane); }
function shroomRaster(x, y, squashed){
  var R=32, salt=surfSalt()+57, c=document.createElement('canvas'); c.width=R; c.height=R;
  var g=c.getContext('2d'); g.imageSmoothingEnabled=false;
  var n = squashed ? 4+Math.floor(hash2(x,y,salt)*3) : 5+Math.floor(hash2(x,y,salt)*3), caps=[];
  for(var k=0;k<n;k++) caps.push({u:3+hash2(x,y,salt+10+k)*26, v:7+hash2(x,y,salt+20+k)*23, s:(k===0?0.5:0)+hash2(x,y,salt+30+k)*(k===0?0.5:0.8)});
  caps.sort(function(a,b){ return a.v-b.v; });
  function px(u,v,col){ g.fillStyle=col; g.fillRect(Math.round(u),Math.round(v),1,1); }
  caps.forEach(function(m){
    var r = squashed ? 2+Math.round(m.s*2) : 2+Math.round(m.s*2), h = squashed ? 0 : 2+Math.round(m.s*3);
    var cu=m.u, cv=m.v;
    if(squashed){   /* a flattened splat of cap and a smear of glow */
      for(var dx=-r-1; dx<=r+1; dx++) for(var dy=-1; dy<=1; dy++){ if(Math.abs(dx)+Math.abs(dy)*2>r+1) continue; px(cu+dx, cv+dy, (dx+dy)%2 ? '#5A2A8C' : '#3C1C60'); }
      px(cu, cv, '#C890FF'); if(r>2) px(cu+2, cv, '#9A5AD8');
      return;
    }
    for(var s=1; s<=h; s++){ px(cu, cv-s+1, s===1 ? '#8C7AA0' : '#D8CCE6'); if(r>3) px(cu+1, cv-s+1, '#B2A2C6'); }   /* stem */
    var top=cv-h;
    for(var dy2=-r; dy2<=1; dy2++) for(var dx2=-r; dx2<=r; dx2++){   /* dome cap */
      var e=(dx2*dx2)/(r*r) + (dy2<0 ? (dy2*dy2)/(r*r*0.7) : 0);
      if(e>1.05) continue;
      var edge = e>0.7 || dy2===1, lit = dx2<0 && dy2<0;
      px(cu+dx2, top+dy2, dy2===1 ? '#3A1660' : edge ? '#5C2496' : lit ? '#B46AF2' : '#8A3CD0');
    }
    px(cu-Math.round(r/2), top-Math.round(r/2), '#F0D2FF'); if(r>2) px(cu-Math.round(r/2)+1, top-Math.round(r/2), '#F0D2FF');   /* glowing spots */
    if(r>2) px(cu+Math.round(r/2), top-1, '#E2B4FF'); if(r>4) px(cu, top-r+1, '#E2B4FF');
  });
  return c;
}
function shroomGlowRaster(x, y){
  var R=32, c=document.createElement('canvas'); c.width=R; c.height=R; var g=c.getContext('2d');
  var gr=g.createRadialGradient(16,18,1,16,18,15); gr.addColorStop(0,'rgba(190,110,255,0.55)'); gr.addColorStop(0.5,'rgba(140,60,230,0.22)'); gr.addColorStop(1,'rgba(90,30,180,0)');
  g.fillStyle=gr; g.fillRect(0,0,R,R); return c;
}
/* 2026-09-20: packet 08's mushrooms replace the code-drawn caps. Justin: "make sure they are tiny and in groups on
   the ground" - so a patch is four to seven small caps of mixed size scattered across the tile, each one swaying and
   bobbing on its own clock (vegart.js), over the same violet glow the patch always had. */
var CRYPT_SHROOM_ART = 6;
function cryptShroomArt(i){ return (typeof vegArt==='function') ? vegArt('crypt-shroom-'+i) : null; }
var _drawGrassTileShroom = drawGrassTile;
drawGrassTile = function(x, y, px, py, alpha, layer, now){
  if(!cryptShrooms()) return _drawGrassTileShroom(x, y, px, py, alpha, layer, now);
  if(layer==='front') return;   /* mushrooms are short: nothing to draw over whoever stands in them */
  now=now||performance.now();
  var t=ANIM.reduce ? 0 : now/1000, pulse=0.65+0.35*Math.sin(t*1.8 + hash2(x,y,5)*6.28);
  ctx.save(); ctx.globalCompositeOperation='lighter'; ctx.globalAlpha=alpha*pulse*0.8;
  ctx.drawImage(cachedRaster('shg@', x, y, shroomGlowRaster), 0,0,32,32, px-TS*0.25, py-TS*0.25, TS*1.5, TS*1.5);
  ctx.restore();
  if(!cryptShroomArt(1)) return blitRaster(cachedRaster('shr@', x, y, function(a,b){ return shroomRaster(a,b,false); }), px, py, alpha);
  var n=4+Math.floor(hash2(x,y,301)*4);                       /* four to seven caps: a clump, never one lone cap */
  for(var k=0;k<n;k++){
    var o=cryptShroomArt(1+Math.floor(hash2(x+k,y,302+k)*CRYPT_SHROOM_ART)); if(!o) continue;
    var ox=0.12+0.76*hash2(x,y+k,303+k), oy=0.45+0.5*hash2(x+k,y+k,304+k);
    var sc=0.30+0.22*hash2(k,x+y,305+k);                      /* tiny: about a third of a tile at most */
    var sw=vegSway(x+k*0.3, y, now, 0)*0.5;
    vegDraw(o, px+TS*ox, py+TS*oy, sc, sw, alpha, hash2(k,x,306)<0.5);
  }
};
var _drawGroundDecalShroom = drawGroundDecal;
drawGroundDecal = function(gv, x, y, px, py, alpha, now){
  if(gv===G_SHORT && cryptShrooms()){
    var sq=(typeof vegArt==='function') && vegArt('crypt-shroom-squashed-'+(1+Math.floor(hash2(x,y,307)*3)));
    if(sq){ vegDraw(sq, px+TS*0.5, py+TS*0.8, 0.6, 0, alpha*0.9, hash2(x,y,308)<0.5); return true; }
    blitRaster(cachedRaster('shs@', x, y, function(a,b){ return shroomRaster(a,b,true); }), px, py, alpha*0.9); return true;
  }
  return _drawGroundDecalShroom(gv, x, y, px, py, alpha, now);
};
var _setGShroom = setG;
setG = function(x, y, v){
  if(v===G_SHORT && inb(x,y) && ground[idxOf(x,y)]===G_GRASS && cryptShrooms() && typeof burst==='function' && (revealAll||vis[idxOf(x,y)])) burst(x, y, 'magic', 10, 0.035);
  return _setGShroom(x, y, v);
};
var _opaqueShroom = opaque;
opaque = function(x, y){
  if(cryptShrooms() && ground && gAt(x,y)===G_GRASS){ var t=at(x,y); if(!(t===WALL||t===DOOR||t===LOCKED||t===ICEDOOR||t===THORNS||t===SECRET||t===SEALED||t===TOLL)) return false; }
  return _opaqueShroom(x, y);
};
var _gatherLightsShroom = gatherLights;
gatherLights = function(now, prp){
  var L=_gatherLightsShroom(now, prp);
  if(!cryptShrooms()) return L;
  var x0=Math.max(0,camX-4), x1=Math.min(MW-1,camX+viewW+4), y0=Math.max(0,camY-4), y1=Math.min(MH-1,camY+viewH+4);
  for(var y=y0;y<=y1;y++) for(var x=x0;x<=x1;x++){
    var i=idxOf(x,y); if(ground[i]!==G_GRASS || !(revealAll||seen[i]) || hash2(x,y,77)>0.4) continue;
    L.push({x:x, y:y, c:hexRGB('#B070FF'), r:2.4, s:0.5*(0.8+0.2*Math.sin(now/600 + x*1.3 + y)), tx:x, ty:y});
  }
  return L;
};

/* 2026-09-20: Justin - the mushroom patches sat straight on the flagstones. This is the moss bed the Dungeon's
   grass got (vegart.js drawVegMoss), in the Crypt's colours: one smooth, mostly transparent field over every
   mushroom cell and its neighbours, so touching patches join into a single growth, with pale moss flecks and a
   violet cast picked up from the caps. Drawn from drawSurfaceDeco, which runs before the ground layer. */
function cryptMossIs(x,y){ if(!inb(x,y) || isWallLike(at(x,y))) return false; var g=ground[idxOf(x,y)]; return g===G_GRASS || g===G_SHORT; }
function cryptMossSig(x,y){ var s=''; for(var yy=y-1;yy<=y+1;yy++) for(var xx=x-1;xx<=x+1;xx++) s+=cryptMossIs(xx,yy)?'1':'0'; return s; }
function cryptMossRaster(x, y){
  var R=32, cells=[];
  for(var yy=y-1;yy<=y+1;yy++) for(var xx=x-1;xx<=x+1;xx++) if(cryptMossIs(xx,yy)) cells.push([xx+0.5,yy+0.5]);
  if(!cells.length) return null;
  var c=document.createElement('canvas'); c.width=R; c.height=R;
  var g=c.getContext('2d'), im=g.createImageData(R,R), D=im.data, salt=surfSalt()+163, any=false;
  for(var v=0; v<R; v++) for(var u=0; u<R; u++){
    var wx=x+(u+0.5)/R, wy=y+(v+0.5)/R, f=0;
    for(var k=0;k<cells.length;k++){ var dx=wx-cells[k][0], dy=wy-cells[k][1], d=Math.sqrt(dx*dx+dy*dy)/1.25; if(d<1) f+=(1-d)*(1-d); }
    var val=f + (ptValG(wx*2.2, wy*2.2, salt)-0.5)*0.35 + (hash2(Math.floor(wx*16), Math.floor(wy*16), salt+1)-0.5)*0.1;
    if(val<0.28) continue;
    var p=(v*R+u)*4, dense=Math.min(1,(val-0.28)*1.8), n=hash2(Math.floor(wx*16), Math.floor(wy*16), salt+2);
    var col = n<0.12 ? [104,128,60] : n>0.9 ? [84,50,116] : [48+18*dense, 72+16*dense, 38];
    D[p]=col[0]; D[p+1]=col[1]; D[p+2]=col[2]; D[p+3]=Math.round((n<0.12?110:58)+92*dense); any=true;   /* ~23-60%: the caps' own glow is drawn over this with 'lighter', so a Dungeon-weight bed vanished under it */
  }
  if(!any) return null;
  g.putImageData(im,0,0); return c;
}
function drawCryptMoss(){
  if(!cryptShrooms()) return;
  for(var y=camY-1; y<=camY+viewH+1; y++) for(var x=camX-1; x<=camX+viewW+1; x++){
    if(!inb(x,y)) continue; var i=idxOf(x,y); if(!(revealAll||seen[i]) || isWallLike(at(x,y))) continue;
    var sig=cryptMossSig(x,y); if(sig.indexOf('1')<0) continue;
    blitRaster(cachedRaster('cm'+sig+'@', x, y, cryptMossRaster), (x-camX)*TS, (y-camY)*TS, (revealAll||vis[i])?1:memA(0.4));
  }
}
var _drawSurfaceDecoCryptMoss = drawSurfaceDeco;
drawSurfaceDeco = function(){ var r=_drawSurfaceDecoCryptMoss.apply(this, arguments); drawCryptMoss(); return r; };

/* ---------- Crypt floors: ooze instead of standing water, mushroom patches instead of the blue mushroom prop, more moss ---------- */
var _addPropShroom = addProp;
addProp = function(x, y, name, extra){
  if(name==='mushrooms' && cryptShrooms() && !(extra && extra.keep)){   /* puzzle mushrooms (keep:true) stay as they are */
    if(inb(x,y) && at(x,y)===FLOOR) blob(x, y, ri(4,9), function(xx,yy){ if(at(xx,yy)===FLOOR && !gAt(xx,yy) && !propAt(xx,yy)) setG(xx,yy,G_GRASS); });
    return null;
  }
  return _addPropShroom(x, y, name, extra);
};
var _decoratePlainMoss = decoratePlain;
decoratePlain = function(r){
  _decoratePlainMoss(r);
  if(!cryptShrooms() || r.hall) return;
  if(rng()<0.6){ var e=pick(edgeCells(r)); if(e) blob(e.x, e.y, ri(3,8), function(xx,yy){ if(at(xx,yy)===FLOOR && !gAt(xx,yy)) setG(xx,yy,G_MOSS); }); }
};
var _generateOoze = generate;
generate = function(seed){
  _generateOoze(seed);
  if(!cryptShrooms()) return;
  floorMeta.ooze = floorMeta.ooze || {};
  var n=0;
  for(var i=0;i<map.length;i++){
    if(map[i]!==WATER) continue;
    var x=i%MW, y=(i/MW)|0;
    if(typeof puzzleRoomAt==='function' && puzzleRoomAt(x,y)) continue;   /* flooded puzzle rooms keep their water */
    map[i]=FLOOR; ground[i]=0; floorMeta.ooze[i]=1; n++;
  }
  /* a floor with no pools gets one or two of its own, away from the start */
  for(var k=0; k<(n?0:2); k++){
    var r=pick(rooms.filter(function(q){ return q.role!=='start' && q.role!=='boss' && !q.hall && q.w*q.h>=16; }));
    if(!r) break;
    blob(r.x+ri(1,Math.max(1,r.w-2)), r.y+ri(1,Math.max(1,r.h-2)), ri(3,7), function(xx,yy){ var j=idxOf(xx,yy); if(at(xx,yy)===FLOOR && !propAt(xx,yy) && !itemAt(xx,yy) && !feats.some(function(f){ return f.x===xx&&f.y===yy; })){ floorMeta.ooze[j]=1; ground[j]=0; } });
  }
};

/* ---------------------------------------------------------------- shelf fungus and hanging roots (packet 08, 2026-09-20)
   The Crypt's walls get the rest of the mushroom pack: bracket fungus stepping down a wall face, and pale roots
   pushing through the masonry. Both hang from the top of a wall face that looks onto open floor, like the pack's
   cobwebs, and they sway with everything else (vegart.js). Two to four a floor, never side by side. */
var CRYPT_WALLVEG = {shelf:3, roots:3};
function cryptWallFaces(){
  var out=[];
  for(var y=1;y<MH-1;y++) for(var x=1;x<MW-1;x++){
    if(!isWallLike(at(x,y)) || at(x,y)===SECRET) continue;
    if(at(x,y+1)!==FLOOR) continue;                       /* the face you can see, with floor below it */
    if(propAt(x,y) || propAt(x,y+1)) continue;
    out.push({x:x, y:y});
  }
  return out;
}
function cryptGrowWallVeg(){
  if(!cryptShrooms() || typeof vegArt!=='function' || !vegArt('crypt-shelf-fungus-1')) return;
  var spots=shuffled(cryptWallFaces()), used={}, put=0, want=ri(2,4);
  for(var i=0;i<spots.length && put<want;i++){
    var s=spots[i];
    if(used[(s.x-1)+','+s.y] || used[(s.x+1)+','+s.y]) continue;   /* never two in a row */
    var roots=rng()<0.45;
    var name=(roots?'crypt-roots-':'crypt-shelf-fungus-')+(1+Math.floor(rng()*(roots?CRYPT_WALLVEG.roots:CRYPT_WALLVEG.shelf)));
    addProp(s.x, s.y, name, {wall:true, flat:1, b:0, cryptWallVeg:1});
    used[s.x+','+s.y]=1; put++;
  }
}
var _generateCryptWallVeg = generate;
generate = function(seed){ var r=_generateCryptWallVeg.apply(this, arguments); try{ cryptGrowWallVeg(); }catch(e){ if(window.console) console.warn('crypt wall veg', e); } return r; };
/* drawn hanging from the top of the wall face */
var _drawPropSurfaceCryptWallVeg = drawPropSurface;
drawPropSurface = function(p, px, py, alpha){
  if(p && p.cryptWallVeg && typeof vegArt==='function'){
    var o=vegArt(p.name);
    if(o){
      var sw=vegSway(p.x, p.y, performance.now(), 0)*0.35;
      vegDraw(o, px+TS*(0.5+0.12*(hash2(p.x,p.y,311)-0.5)), py+TS*0.92, 0.9, sw, alpha, hash2(p.x,p.y,312)<0.5);
      return true;
    }
  }
  return _drawPropSurfaceCryptWallVeg(p, px, py, alpha);
};
['crypt-shelf-fungus-1','crypt-shelf-fungus-2','crypt-shelf-fungus-3','crypt-roots-1','crypt-roots-2','crypt-roots-3']
  .forEach(function(n){ PROPS[n]={flat:1}; });
