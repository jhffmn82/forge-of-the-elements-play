/* ============================================================================
   render.js - the map renderer: atlases, terrain, decals, props, items, traps,
   animated characters and monsters, lighting. Replaces game.js draw().
   ========================================================================== */

var AS = window.ASSETS || {};
var ATL = {};
function atl(file){
  if(!ATL[file]){ var im=new Image(); im.onload=function(){ if(typeof draw==='function') draw(); }; im.src='art/packed/'+file+(window.ASSETS && ASSETS.build ? '?v='+ASSETS.build : ''); ATL[file]=im; }
  var a=ATL[file]; return (a.complete && a.naturalWidth) ? a : null;
}
function hash2(x,y,s){ var h=(x*374761393 + y*668265263 + (s||0)*2147483647)|0; h=(h^(h>>>13))*1274126177|0; return ((h^(h>>>16))>>>0)/4294967295; }

/* ---- sprite lookups ---- */
function objArt(group, name){
  if(name==='item-censer'||name==='held-censer'){group='knife';name='ceremonial-knife';}
  if(group==='structures'&&name==='stairs-up'&&AS.map&&AS.map.stairs)group='stairs';
  if(group==='props'&&name==='weapon-rack'&&AS.map&&AS.map.rack)group='rack';
  var g=AS.map && AS.map[group]; if(!g || !g.items[name]) return null;
  var img=atl('map-'+group+'.png'); if(!img) return null;
  var b=g.items[name];
  return {img:img, sx:b[0]+b[2], sy:b[1]+b[3], sw:Math.max(1,b[4]), sh:Math.max(1,b[5])};
}
function anyObj(name){
  var groups=['props','chests','structures','traps','items','terrain','icons','monsters'];
  for(var i=0;i<groups.length;i++){ var o=objArt(groups[i],name); if(o) return o; }
  return null;
}
var WHITE_CACHE={};
function whiteCut(img, sx,sy,sw,sh){
  var key=img.src+'|'+sx+','+sy+','+sw+','+sh;
  if(WHITE_CACHE[key]) return WHITE_CACHE[key];
  var c=document.createElement('canvas'); c.width=sw; c.height=sh;
  var g=c.getContext('2d'); g.drawImage(img,sx,sy,sw,sh,0,0,sw,sh);
  g.globalCompositeOperation='source-in'; g.fillStyle='#fff'; g.fillRect(0,0,sw,sh);
  WHITE_CACHE[key]=c; return c;
}
/* draw a trimmed object in a tile. fit: fraction of the tile; feet: stand on the tile's lower edge */
/* Adapted from render/place.js at fb69933: round destination edges together, not each size separately. */
function placementRect(x,y,w,h){
  var left=Math.round(x),top=Math.round(y);
  return {x:left,y:top,w:Math.max(1,Math.round(x+w)-left),h:Math.max(1,Math.round(y+h)-top)};
}
function drawObj(o, px, py, opt){
  if(!o) return false;
  opt=opt||{};
  var fit=(opt.fit||0.92)*TS, s=Math.min(fit/o.sw, fit/o.sh);
  if(opt.fill){ s=Math.max(TS/o.sw, TS/o.sh); }
  var w=o.sw*s, h=o.sh*s*(1+(opt.sy||0));
  var dx=px+(TS-w)/2, dy= opt.feet ? py+TS*(opt.base||0.96)-h : py+(TS-h)/2;
  var rect=placementRect(dx,dy,w,h); dx=rect.x;dy=rect.y;w=rect.w;h=rect.h;
  ctx.save();
  ctx.globalAlpha=(opt.alpha===undefined?1:opt.alpha);
  ctx.imageSmoothingEnabled = s<1;
  if(opt.flip){ ctx.translate(dx+w/2,0); ctx.scale(-1,1); ctx.translate(-(dx+w/2),0); }
  if(opt.outline){
    var cut=whiteCut(o.img,o.sx,o.sy,o.sw,o.sh), edge=Math.max(1,Math.round(TS/40));
    ctx.globalAlpha=(opt.alpha===undefined?1:opt.alpha)*0.22;
    [[-edge,0],[edge,0],[0,-edge],[0,edge],[-edge,-edge],[edge,-edge],[-edge,edge],[edge,edge]].forEach(function(d){ctx.drawImage(cut,dx+d[0],dy+d[1],w,h);});
    ctx.globalAlpha=(opt.alpha===undefined?1:opt.alpha);
  }
  ctx.drawImage(o.img, o.sx,o.sy,o.sw,o.sh, dx,dy,w,h);
  if(opt.flash>0){ ctx.globalAlpha*=opt.flash; ctx.drawImage(whiteCut(o.img,o.sx,o.sy,o.sw,o.sh), dx,dy,w,h); }
  ctx.restore();
  return true;
}
function tileFrom(key, i){
  var t=AS[key]; if(!t) return null; var img=atl(key==='floor2'?'floor2.png':key+'.png'); if(!img) return null;
  var c=t.tiles[i]; if(!c) return null; return {img:img, sx:c[0], sy:c[1], sw:t.cell, sh:t.cell};
}
function blitTile(o, px, py, alpha){
  if(!o) return false;
  ctx.globalAlpha=alpha; ctx.imageSmoothingEnabled=true;
  ctx.drawImage(o.img,o.sx,o.sy,o.sw,o.sh,px,py,TS+0.6,TS+0.6);
  return true;
}

/* dynamic lighting can be switched off from the sandbox (Light field) */
function lightingOn(){ try { return localStorage.getItem('astra-temple-light')!=='off'; } catch(e){ return true; } }

/* the colour behind each condition's icon: light where the art is dark, deep where the art is pale */
var STATUS_CHIP = {challenged:'#E8B44A', coward:'#E8B44A', burn:'#FFC27A', chill:'#BFE4F0', frozen:'#DCF2FF', root:'#C8E0A0', stun:'#FFE9A8', fear:'#C8B4E0',
                   blind:'#FFFFFF', poison:'#C6E39A', web:'#E4DCF0', slow:'#E4DCF0', bleed:'#F0B0B0'};

/* ---- terrain choices ---- */
var FLOOR_PLAIN=[0,12], FLOOR_ACCENT=[2,2,6,6,14,10,11,15,9,1,3,7,13,5];
function floorTile(x,y){
  var h=hash2(x,y,floorNo);
  if(h<0.93) return tileFrom('floor', FLOOR_PLAIN[Math.floor(hash2(x,y,7)*FLOOR_PLAIN.length)]);
  return tileFrom('floor', FLOOR_ACCENT[Math.floor(hash2(y,x,3)*FLOOR_ACCENT.length)]);
}
var WALL_TOP=[0,4,3,7], WALL_FACE=[11,13,15,8,11,13], WALL_FACE_RARE=[1,2,6,9,10,12];
function wallTile(x,y){
  var south=at(x,y+1), faceBelow = !(south===WALL || south===SECRET) ;
  if(at(x,y)===SECRET) return faceBelow ? tileFrom('walls',14) : tileFrom('walls',WALL_TOP[0]);
  if(faceBelow){
    var h=hash2(x,y,11);
    if(h<0.12) return tileFrom('walls', WALL_FACE_RARE[Math.floor(hash2(x,y,5)*WALL_FACE_RARE.length)]);
    return tileFrom('walls', WALL_FACE[Math.floor(hash2(x,y,9)*WALL_FACE.length)]);
  }
  return tileFrom('walls', WALL_TOP[Math.floor(hash2(x,y,13)*WALL_TOP.length)]);
}
function isWallLike(t){ return t===WALL || t===SECRET; }
/* 2026-09-19: remembered tiles were faded one tile at a time, which drew the edge of what you can see as a
   staircase of squares. With lighting on, the lightmap's (blurred) memory tone does that darkening smoothly,
   so tiles draw at full strength; with lighting off they keep the old fade. */
function memA(fade){ return (typeof lightingOn==='function' && lightingOn()) ? 1 : fade; }
var TILE_SPRITE = {};
function tileSprite(x,y,t){
  /* 2026-09-19: a door set in a wall that runs up-down (walls above and below it) is seen edge-on */
  var sideDoor = (t===DOOR || t===LOCKED) && isWallLike(at(x,y-1)) && isWallLike(at(x,y+1)) && !(isWallLike(at(x-1,y)) && isWallLike(at(x+1,y)));
  if(t===DOOR) return (sideDoor && objArt('structures','door-wood-side')) || objArt('structures','door-wood');
  if(t===OPEN) return null;   /* open doors are drawn as jambs + a swung leaf, see drawOpenDoor */
  if(t===LOCKED) return (sideDoor && objArt('structures','door-iron-side')) || objArt('structures','door-iron');
  if(t===TOLL) return objArt('structures','door-spiked');
  if(t===ICEDOOR) return objArt('structures','door-ice') || objArt('props','ice-block');
  if(t===THORNS) return objArt('structures','door-thorns') || objArt('props','vines');
  if(t===SEALED) return (floorMeta && floorMeta.crystalDoor && floorMeta.crystalDoor.x===x && floorMeta.crystalDoor.y===y && objArt('structures','door-crystal')) || objArt('structures','door-iron');
  if(t===STAIRS) return objArt('structures','stairs-down');
  if(t===CHEST) { var k=chestKind[idxOf(x,y)]||'chest-wood'; return objArt('chests', k==='mimic'?'chest-wood':k); }
  if(t===FORGE) return setArt('forge-lit') || objArt('structures','forge-lit') || objArt('structures','forge-cold');
  if(t===SHRINE) return objArt('structures', (GODS[RUN.shrineGod]||{}).sprite) || objArt('structures','shrine');
  if(t===EXIT) return objArt('structures','exit-gate') || objArt('structures','archway');
  if(t===RUBBLE) return objArt('props','rubble');
  if(t===BRIDGE){   /* chasm to the left and right: the bridge runs up-down */
    var lr = (at(x-1,y)===CHASM || at(x+1,y)===CHASM) && !(at(x,y-1)===CHASM || at(x,y+1)===CHASM);
    return (lr && objArt('structures','bridge-v')) || objArt('structures','bridge');
  }
  return null;
}

/* an open door: stone jambs flush with the wall, the leaf swung back against one side */
function drawOpenDoor(x, y, px, py, alpha){
  var wallsLR = isWallLike(at(x-1,y)) || isWallLike(at(x+1,y));
  var iron = !!(floorMeta.ironDoors && floorMeta.ironDoors[idxOf(x,y)]);
  var jamb='#5C554C', jambHi='#7A7266', jambLo='#2A2622', leaf= iron ? '#6E7078' : '#6B4726', leafHi= iron ? '#9A9CA4' : '#8A5E34', band= iron ? '#3A3C44' : '#3A2614';
  ctx.save(); ctx.globalAlpha=alpha;
  var j=Math.max(3, Math.round(TS*0.16));
  if(wallsLR){
    /* passage runs north-south: jambs on the left and right edges */
    [[px,0],[px+TS-j,1]].forEach(function(p){
      ctx.fillStyle=jamb; ctx.fillRect(p[0],py,j,TS);
      ctx.fillStyle=jambHi; ctx.fillRect(p[0],py,j,2);
      ctx.fillStyle=jambLo; ctx.fillRect(p[1]?p[0]:p[0]+j-1,py,1,TS);
    });
    /* the leaf, swung open against the left jamb, seen edge-on as a thick plank */
    var lw=Math.max(3, Math.round(TS*0.14)), lx=px+j;
    ctx.fillStyle='rgba(0,0,0,.35)'; ctx.fillRect(lx+lw,py+TS*0.08,2,TS*0.84);
    ctx.fillStyle=leaf; ctx.fillRect(lx,py+TS*0.06,lw,TS*0.86);
    ctx.fillStyle=leafHi; ctx.fillRect(lx,py+TS*0.06,1,TS*0.86);
    ctx.fillStyle=band; ctx.fillRect(lx,py+TS*0.24,lw,2); ctx.fillRect(lx,py+TS*0.7,lw,2);
  } else {
    /* passage runs east-west: lintel along the top edge and a threshold along the bottom */
    ctx.fillStyle=jamb; ctx.fillRect(px,py,TS,j);
    ctx.fillStyle=jambHi; ctx.fillRect(px,py,TS,2);
    ctx.fillStyle=jambLo; ctx.fillRect(px,py+j-1,TS,1);
    ctx.fillStyle='rgba(0,0,0,.25)'; ctx.fillRect(px,py+TS-3,TS,3);
    /* the leaf swung back along the top wall, seen from above */
    var lh=Math.max(3, Math.round(TS*0.18));
    ctx.fillStyle='rgba(0,0,0,.35)'; ctx.fillRect(px+TS*0.08,py+j+lh,TS*0.8,2);
    ctx.fillStyle=leaf; ctx.fillRect(px+TS*0.06,py+j,TS*0.82,lh);
    ctx.fillStyle=leafHi; ctx.fillRect(px+TS*0.06,py+j,TS*0.82,1);
    ctx.fillStyle=band; ctx.fillRect(px+TS*0.24,py+j,2,lh); ctx.fillRect(px+TS*0.66,py+j,2,lh);
  }
  ctx.restore();
}

/* ---- dual-grid overlays for water and chasm (corner-based wang tiles) ---- */
function drawWangLayer(key, tileType){
  var set=AS['wang_'+key]; var img=set && atl('wang-'+key+'.png');
  for(var vy=camY; vy<=camY+viewH+1; vy++) for(var vx=camX; vx<=camX+viewW+1; vx++){
    var c=[[vx-1,vy-1],[vx,vy-1],[vx-1,vy],[vx,vy]], any=false, known=false, lit=false, bits='';
    for(var i=0;i<4;i++){
      var cx=c[i][0], cy=c[i][1], on = inb(cx,cy) && (at(cx,cy)===tileType || (tileType===CHASM && at(cx,cy)===BRIDGE));
      if(on) any=true;
      if(inb(cx,cy)){ if(revealAll||seen[idxOf(cx,cy)]) known=true; if(revealAll||vis[idxOf(cx,cy)]) lit=true; }
      bits += on ? '0' : '1';
    }
    if(!any || !known) continue;
    var px=(vx-camX)*TS - TS/2, py=(vy-camY)*TS - TS/2, a=lit?1:memA(0.42);
    if(img && set.tiles[bits]){ var tc=set.tiles[bits]; ctx.globalAlpha=a; ctx.imageSmoothingEnabled=true; ctx.drawImage(img,tc[0],tc[1],64,64,px,py,TS+0.6,TS+0.6); }
  }
  ctx.globalAlpha=1;
}

/* ---- tall grass: procedural blades that sway in a slow wind and part around whoever walks through ---- */
var GRASS_COLS = ['#1F3D1A','#2B5222','#3A6A2B','#4E8434','#6C9F42'];
function grassHash(x, y, k){ var h=(x*73856093) ^ (y*19349663) ^ (k*83492791); h=(h^(h>>>13))*1274126177; return ((h^(h>>>16))>>>0)/4294967296; }
function drawGrassTile(x, y, px, py, alpha, layer, now){
  var front = layer==='front';
  var stand = null;
  if(front){
    if(player && player.x===x && player.y===y) stand=player;
    else for(var i=0;i<ents.length;i++) if(ents[i].x===x && ents[i].y===y){ stand=ents[i]; break; }
  }
  ctx.save(); ctx.globalAlpha=alpha;
  if(!front && typeof drawGrassBed!=='function'){ ctx.fillStyle='rgba(24,46,18,.35)'; ctx.fillRect(px, py, TS, TS); }
  var n = front ? 6 : 10, t = ANIM.reduce ? 0 : now/1000;
  var gust = Math.sin(t*0.9 + x*0.45 + y*0.2) * 0.5 + Math.sin(t*2.3 + x*1.3) * 0.18;
  ctx.lineCap='round';
  for(var b=0;b<n;b++){
    var r1=grassHash(x,y,b+(front?50:0)), r2=grassHash(x,y,b+100), r3=grassHash(x,y,b+200);
    /* back blades root across the tile, front blades root along its lower edge */
    /* blades grow in three tufts per tile so the patch reads as clumps, not a lawn */
    var tuft = b%3, tx0 = grassHash(x,y,300+tuft), ty0 = grassHash(x,y,400+tuft);
    var bx = px + TS*(0.12 + 0.76*tx0 + (r1-0.5)*0.22);
    var by = front ? py + TS*(0.92 + 0.08*r2) : py + TS*(0.35 + 0.55*ty0 + (r2-0.5)*0.08);
    var h = TS*(front ? 0.16 + 0.14*r3 : 0.26 + 0.24*r3);
    var sway = (gust + Math.sin(t*3.1 + r1*9)*0.12) * TS*0.12;
    if(stand){ sway += (bx < px+TS/2 ? -1 : 1) * TS*0.12; h *= 0.8; }   /* parted around a body */
    var lean = (r2-0.5)*TS*0.14;
    var tipx = bx + lean + sway, tipy = by - h;
    var col = GRASS_COLS[Math.min(4, Math.floor(r3*3) + (front?1:0) + (by>py+TS*0.7?1:0))];
    ctx.strokeStyle=col; ctx.lineWidth=Math.max(1.5, TS*(0.045 + 0.03*r1));
    ctx.beginPath(); ctx.moveTo(bx, by);
    ctx.quadraticCurveTo(bx + lean*0.3, by - h*0.55, tipx, tipy); ctx.stroke();
    if(r1>0.72){ ctx.strokeStyle=GRASS_COLS[4]; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(tipx, tipy); ctx.lineTo(tipx - lean*0.15, tipy + h*0.25); ctx.stroke(); }
  }
  ctx.restore();
}

/* thorny vines creeping across the floor: curling stems with leaves and pale thorns, gently stirring */
function drawVines(x, y, px, py, alpha, now){
  var H=function(k){ return grassHash(x,y,k); }, t=ANIM.reduce?0:now/1000;
  ctx.save(); ctx.globalAlpha=alpha; ctx.lineCap='round'; ctx.lineJoin='round';
  for(var v=0; v<4; v++){
    var ax=px+TS*(0.42+0.12*H(v)), ay=py+TS*(0.48+0.12*H(v+10));
    var bx=px+TS*(0.05+0.9*H(v+20)), by=py+TS*(0.1+0.8*H(v+30));
    var mx=(ax+bx)/2+(H(v+40)-0.5)*TS*0.6 + Math.sin(t*0.8+v)*TS*0.02, my=(ay+by)/2+(H(v+50)-0.5)*TS*0.6;
    ctx.strokeStyle='#263021'; ctx.lineWidth=Math.max(1,TS*0.028);
    ctx.beginPath(); ctx.moveTo(ax,ay); ctx.quadraticCurveTo(mx,my,bx,by); ctx.stroke();
    ctx.strokeStyle='#556043'; ctx.lineWidth=Math.max(0.5,TS*0.012);
    ctx.beginPath(); ctx.moveTo(ax,ay); ctx.quadraticCurveTo(mx,my,bx,by); ctx.stroke();
    for(var k=1;k<8;k++){
      var q=k/8, qx=(1-q)*(1-q)*ax+2*(1-q)*q*mx+q*q*bx, qy=(1-q)*(1-q)*ay+2*(1-q)*q*my+q*q*by;
      if(H(v*10+k+60)<0.85){
        var la=Math.atan2((1-q)*(my-ay)+q*(by-my),(1-q)*(mx-ax)+q*(bx-mx))+(k%2?1:-1)*0.9, lr=TS*(0.032+H(v*10+k+70)*0.025);
        ctx.fillStyle= H(v*10+k+80)<0.5 ? '#667044' : '#46573A';
        ctx.beginPath(); ctx.ellipse(qx+Math.cos(la)*lr*0.8, qy+Math.sin(la)*lr*0.8, lr, lr*0.45, la, 0, Math.PI*2); ctx.fill();
      } else {
        ctx.fillStyle='#8B8861'; var th=Math.max(.5,TS*0.014); ctx.fillRect(qx-th/2, qy-th*1.6, th, th*1.4);
      }
    }
  }
  ctx.restore();
}

/* ---- traps: set into the floor, drawn flat so they sit in the tile like the flagstones around them ---- */
function drawTrap(f, px, py, alpha, now){
  var t = ANIM.reduce ? 0 : now/1000, H=function(k){ return grassHash(f.x,f.y,k); };
  var cx=px+TS/2, cy=py+TS/2, u=TS/32;              /* u: one pixel of a 32px tile */
  var P=function(x,y,w,h,c){ ctx.fillStyle=c; ctx.fillRect(Math.round(px+x*u), Math.round(py+y*u), Math.ceil(w*u), Math.ceil(h*u)); };
  /* 2026-09-22 (Justin): a trap under a prop (a gas vent under a brazier) drew its sunken plate as a dark box around
     the prop's feet. Under a prop only the glow and what leaks out are drawn; the plate and grate stay hidden. */
  var covered = typeof propAt==='function' && !!propAt(f.x,f.y);
  ctx.save(); ctx.globalAlpha=alpha;
  /* a sunken stone plate: dark seam, lit lower-right lip, flat face */
  function plate(face, x0, y0, w, h){
    if(covered) return;
    P(x0-1, y0-1, w+2, h+2, 'rgba(8,6,6,.75)');
    P(x0, y0, w, h, face);
    P(x0, y0, w, 1, 'rgba(0,0,0,.35)'); P(x0, y0, 1, h, 'rgba(0,0,0,.35)');
    P(x0, y0+h-1, w, 1, 'rgba(255,240,220,.12)'); P(x0+w-1, y0, 1, h, 'rgba(255,240,220,.12)');
  }
  function glowDot(x, y, r, col, a){
    var g=ctx.createRadialGradient(px+x*u,py+y*u,0,px+x*u,py+y*u,r*u); g.addColorStop(0,hexA(col,a)); g.addColorStop(1,hexA(col,0));
    ctx.fillStyle=g; ctx.fillRect(px+(x-r)*u, py+(y-r)*u, 2*r*u, 2*r*u);
  }
  var k=f.kind, pulse=0.5+0.5*Math.sin(t*2.4 + f.x + f.y*1.7);
  if(k==='dart'){
    plate('#4A4540', 8, 8, 16, 16);
    if(!covered) for(var i=0;i<3;i++) for(var j=0;j<3;j++){ P(10+i*5, 10+j*5, 2, 2, '#15110F'); P(10+i*5, 12+j*5, 2, 1, 'rgba(255,255,255,.08)'); }
  } else if(k==='fire' || k==='gas' || k==='frost'){
    /* an iron vent grate; what leaks out tells you which */
    var col = k==='fire' ? '#FF7A30' : k==='gas' ? '#7FC05A' : '#9FD8FF';
    plate('#2E2A28', 8, 9, 16, 14);
    if(!covered) for(var b=0;b<4;b++) P(10+b*4, 11, 2, 10, '#5A534C');
    glowDot(16, 16, 9, col, 0.25+0.2*pulse);
    if(!ANIM.reduce) for(var w=0; w<3; w++){
      var ph=((t*0.6 + H(w)) % 1), wx=11+H(w+5)*10 + Math.sin(t*2+w)*1.5, wy=16 - ph*14;
      ctx.globalAlpha=alpha*(1-ph)*0.8; P(wx, wy, 2, 2, k==='frost' ? '#E6F6FF' : col); ctx.globalAlpha=alpha;
    }
  } else if(k==='spark'){
    plate('#5C5A58', 7, 7, 18, 18);
    if(!covered) P(9, 9, 14, 14, '#6E6B66');
    var sc = pulse>0.75 ? '#FFF1A8' : '#E8B44A';
    [[17,10],[15,13],[18,14],[14,18],[16,21]].forEach(function(q,i2,arr){ if(i2) { var a=arr[i2-1]; ctx.strokeStyle=sc; ctx.lineWidth=Math.max(1.5,1.6*u); ctx.beginPath(); ctx.moveTo(px+a[0]*u,py+a[1]*u); ctx.lineTo(px+q[0]*u,py+q[1]*u); ctx.stroke(); } });
    glowDot(16, 16, 8, '#E8B44A', 0.15+0.25*pulse);
  } else if(k==='teleport'){
    /* a rune ring cut into the stone, slowly turning */
    ctx.strokeStyle=hexA('#B58CFF', 0.55+0.35*pulse); ctx.lineWidth=Math.max(1.5, 1.4*u);
    ctx.beginPath(); ctx.ellipse(cx, cy, 11*u, 11*u, 0, 0, Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(cx, cy, 7*u, 7*u, 0, 0, Math.PI*2); ctx.stroke();
    for(var r2=0;r2<6;r2++){ var ang=t*0.6 + r2*Math.PI/3; P(16+Math.cos(ang)*9-1, 16+Math.sin(ang)*9-1, 2, 2, '#E3D2FF'); }
    glowDot(16, 16, 10, '#8A5CFF', 0.12+0.18*pulse);
  } else if(k==='web'){
    ctx.strokeStyle='rgba(225,225,215,.55)'; ctx.lineWidth=Math.max(1,u);
    for(var s2=0;s2<8;s2++){ var a2=s2/8*Math.PI*2+H(1); ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(cx+Math.cos(a2)*14*u, cy+Math.sin(a2)*14*u); ctx.stroke(); }
    for(var rr=1; rr<=3; rr++){ ctx.beginPath(); for(s2=0;s2<=8;s2++){ a2=s2/8*Math.PI*2+H(1); var R2=4.2*rr*u; if(!s2) ctx.moveTo(cx+Math.cos(a2)*R2, cy+Math.sin(a2)*R2); else ctx.lineTo(cx+Math.cos(a2)*R2, cy+Math.sin(a2)*R2); } ctx.stroke(); }
  } else if(k==='alarm'){
    /* a tripwire strung between two pegs, with a little brass bell */
    P(4, 14, 3, 4, '#3A2E24'); P(25, 14, 3, 4, '#3A2E24');
    ctx.strokeStyle='rgba(220,210,190,.7)'; ctx.lineWidth=Math.max(1,u); ctx.beginPath(); ctx.moveTo(px+6*u,py+15*u); ctx.quadraticCurveTo(cx, py+17*u, px+26*u, py+15*u); ctx.stroke();
    var sw = ANIM.reduce ? 0 : Math.sin(t*5)*0.8;
    P(14+sw, 16, 4, 4, '#C9962E'); P(15+sw, 20, 2, 1, '#7A5A1E'); P(14+sw, 16, 1, 2, '#F0C860');
  } else if(k==='pit'){
    /* loose boards over a hole */
    P(7, 7, 18, 18, '#050404');
    P(8, 8, 16, 16, '#0C0908');
    for(var pb=0; pb<3; pb++){ P(7, 9+pb*6, 18, 3, pb===1 ? '#4E3A26' : '#6A5033'); P(7, 9+pb*6, 18, 1, 'rgba(255,230,200,.12)'); }
    P(12, 12, 2, 3, '#050404'); P(20, 18, 2, 3, '#050404');
  } else {
    plate('#4A4540', 9, 9, 14, 14);
  }
  ctx.restore();
}

/* a raised stone pillar (Amulet of the Pillar): drawn, with cracks showing as it nears crumbling */
function drawPillar(p, px, py, alpha, now){
  var left = Math.max(0, (p.until||0) - turn), u=TS/32;
  ctx.save(); ctx.globalAlpha=alpha;
  var w=TS*0.56, h=TS*1.05, x=px+(TS-w)/2, y=py+TS*0.92-h;
  var g=ctx.createLinearGradient(x,0,x+w,0); g.addColorStop(0,'#5A544C'); g.addColorStop(0.35,'#8C857A'); g.addColorStop(1,'#46403A');
  ctx.fillStyle=g; ctx.fillRect(x, y+u*3, w, h-u*3);
  ctx.fillStyle='#9C958A'; ctx.fillRect(x-u*2, y, w+u*4, u*4);
  ctx.fillStyle='#3A352F'; ctx.fillRect(x-u*2, y+u*4, w+u*4, u);
  ctx.fillStyle='#6E675D'; ctx.fillRect(x-u*2, py+TS*0.92-u*3, w+u*4, u*3);
  ctx.strokeStyle='rgba(20,16,12,.55)'; ctx.lineWidth=Math.max(1,u);
  for(var i=0;i<3;i++){ var yy=y+h*(0.3+0.22*i); ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x+w, yy+u); ctx.stroke(); }
  if(left<=4){ ctx.beginPath(); ctx.moveTo(x+w*0.3, y+u*5); ctx.lineTo(x+w*0.5, y+h*0.4); ctx.lineTo(x+w*0.35, y+h*0.7); ctx.stroke(); }
  ctx.restore();
}

/* ---- flat ground decals, drawn top-down so they sit in the floor instead of standing on it ---- */
function drawGroundDecal(gv, x, y, px, py, alpha, now){
  var H=function(k){ return grassHash(x,y,k); }, i, a, r, cx, cy;
  ctx.save(); ctx.globalAlpha=alpha; ctx.lineCap='round';
  if(gv===G_SHORT){
    /* trampled grass: a few bent, flattened blades lying across the stone */
    /* the mat under the blades: a ragged cached field (surface.js), never a flat square of colour */
    if(typeof tramRaster==='function') blitRaster(cachedRaster('tr'+tramSig(x,y)+'@', x, y, tramRaster), px, py, alpha);
    else { ctx.fillStyle='rgba(30,52,22,.18)'; ctx.fillRect(px+TS*0.1,py+TS*0.1,TS*0.8,TS*0.8); }
    for(i=0;i<9;i++){
      cx=px+TS*(0.1+0.8*H(i)); cy=py+TS*(0.15+0.75*H(i+20)); a=(H(i+40)-0.5)*1.4 + (H(i+60)<0.5?0:Math.PI);
      r=TS*(0.14+0.14*H(i+80));
      ctx.strokeStyle=['#2B4A22','#3A5F2B','#51773A','#6A7F3E'][Math.floor(H(i+90)*4)];
      ctx.lineWidth=Math.max(1.5, TS*0.04);
      ctx.beginPath(); ctx.moveTo(cx,cy); ctx.quadraticCurveTo(cx+Math.cos(a)*r*0.6, cy+Math.sin(a)*r*0.6-TS*0.04, cx+Math.cos(a)*r, cy+Math.sin(a)*r+TS*0.02); ctx.stroke();
    }
    /* one or two short stubs still upright */
    for(i=0;i<3;i++){ cx=px+TS*(0.15+0.7*H(i+100)); cy=py+TS*(0.3+0.6*H(i+110));
      ctx.strokeStyle='#4E8434'; ctx.lineWidth=Math.max(1.5,TS*0.035); ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(cx+(H(i+120)-0.5)*TS*0.08, cy-TS*0.1); ctx.stroke(); }
  } else if(gv===G_ASH || gv===G_SCORCH){
    var ash = gv===G_ASH;
    for(i=0;i<5;i++){ cx=px+TS*(0.25+0.5*H(i)); cy=py+TS*(0.25+0.5*H(i+10)); r=TS*(0.18+0.2*H(i+30));
      ctx.fillStyle= ash ? 'rgba(20,18,16,.35)' : 'rgba(10,8,6,.4)'; ctx.beginPath(); ctx.ellipse(cx,cy,r,r*0.8,H(i+5)*3,0,Math.PI*2); ctx.fill(); }
    if(ash) for(i=0;i<14;i++){ ctx.fillStyle= H(i+50)<0.3 ? 'rgba(170,160,150,.55)' : 'rgba(95,88,82,.6)';
      ctx.fillRect(px+TS*(0.1+0.8*H(i+60)), py+TS*(0.1+0.8*H(i+70)), Math.max(1,TS*0.05), Math.max(1,TS*0.04)); }
    if(ash && !ANIM.reduce){ var glow=0.25+0.25*Math.sin(now/500+x*3+y); ctx.fillStyle='rgba(226,98,43,'+(glow*0.5)+')';
      ctx.fillRect(px+TS*(0.3+0.4*H(90)), py+TS*(0.3+0.4*H(91)), Math.max(1,TS*0.04), Math.max(1,TS*0.04)); }
  } else if(gv===G_PUDDLE){
    for(i=0;i<3;i++){ cx=px+TS*(0.3+0.4*H(i)); cy=py+TS*(0.35+0.3*H(i+10)); r=TS*(0.16+0.14*H(i+20));
      ctx.fillStyle='rgba(38,74,98,.62)'; ctx.beginPath(); ctx.ellipse(cx,cy,r*1.2,r*0.8,0,0,Math.PI*2); ctx.fill(); }
    var sh = ANIM.reduce ? 0 : Math.sin(now/700 + x + y*2)*TS*0.03;
    ctx.fillStyle='rgba(170,215,240,.35)'; ctx.fillRect(px+TS*0.36+sh, py+TS*0.4, TS*0.18, Math.max(1,TS*0.025));
  } else if(gv===G_BLOOD){
    for(i=0;i<6;i++){ cx=px+TS*(0.3+0.4*H(i)); cy=py+TS*(0.3+0.4*H(i+10)); r=TS*(i<2?0.12+0.08*H(i+20):0.03+0.04*H(i+20));
      if(i>=2){ cx+= (H(i+30)-0.5)*TS*0.5; cy+=(H(i+40)-0.5)*TS*0.5; }
      ctx.fillStyle= i<2 ? 'rgba(96,18,20,.75)' : 'rgba(120,24,24,.7)'; ctx.beginPath(); ctx.ellipse(cx,cy,r*1.2,r,H(i)*3,0,Math.PI*2); ctx.fill(); }
  } else if(gv===G_MOSS){
    for(i=0;i<16;i++){ ctx.fillStyle=['rgba(58,92,40,.55)','rgba(78,112,48,.5)','rgba(40,66,30,.6)'][i%3];
      r=TS*(0.05+0.07*H(i+50)); ctx.beginPath(); ctx.arc(px+TS*(0.1+0.8*H(i)), py+TS*(0.1+0.8*H(i+10)), r, 0, Math.PI*2); ctx.fill(); }
  } else if(gv===G_ICE){
    ctx.fillStyle='rgba(150,205,235,.28)'; ctx.beginPath(); ctx.ellipse(px+TS/2,py+TS/2,TS*0.46,TS*0.4,H(7),0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='rgba(230,248,255,.55)'; ctx.lineWidth=1;
    for(i=0;i<3;i++){ ctx.beginPath(); ctx.moveTo(px+TS*H(i), py+TS*H(i+5)); ctx.lineTo(px+TS*H(i+10), py+TS*H(i+15)); ctx.stroke(); }
  } else if(gv===G_TELL){
    for(i=0;i<3;i++){ ctx.strokeStyle='rgba(15,12,10,.45)'; ctx.lineWidth=Math.max(1,TS*0.03);
      cx=px+TS*(0.2+0.6*H(i)); cy=py+TS*(0.2+0.6*H(i+10));
      ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(cx+TS*0.18*(H(i+20)-0.3), cy+TS*0.14); ctx.lineTo(cx+TS*0.22, cy+TS*0.1*(H(i+30)-0.5)); ctx.stroke(); }
  } else if(gv===G_WEB){
    cx=px+TS*(0.4+0.2*H(1)); cy=py+TS*(0.4+0.2*H(2));
    ctx.strokeStyle='rgba(225,225,215,.5)'; ctx.lineWidth=1;
    for(i=0;i<7;i++){ a=i/7*Math.PI*2+H(3); ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(cx+Math.cos(a)*TS*0.5, cy+Math.sin(a)*TS*0.5); ctx.stroke(); }
    for(var ring=1;ring<=3;ring++){ ctx.beginPath(); for(i=0;i<=7;i++){ a=i/7*Math.PI*2+H(3); var rr=TS*0.13*ring; if(i===0) ctx.moveTo(cx+Math.cos(a)*rr, cy+Math.sin(a)*rr); else ctx.lineTo(cx+Math.cos(a)*rr, cy+Math.sin(a)*rr); } ctx.stroke(); }
  } else { ctx.restore(); return false; }   /* bones keep their sprite */
  ctx.restore(); return true;
}

/* ---- characters: cast sheets with clips ---- */
var CLIP_MS = {idle:130, walk:60, cast:65, ranged:65, melee:55, hurt:75, death:95, attack:60};
/* how long each action clip winds up before its projectile leaves or its blow connects */
var CLIP_WINDUP = {melee:170, attack:170, ranged:300, cast:260};
function setClip(e, name){
  if(!e) return;
  if(e._clip && e._clip.name==='death') return;
  /* clips share the effect queue: an action starts when the previous effect is done, and the lunge,
     bolt, damage number and hurt flash that follow are pushed back until the swing or release frame */
  var nowC=performance.now();
  if(typeof fxClock==='number' && fxClock>nowC+900) fxClock=nowC+900;   /* never fall far behind held keys */
  var t0=Math.max(nowC, typeof fxClock==='number' ? fxClock : 0);
  if(name==='hurt' && e._hit) t0=Math.max(t0, e._hit);
  e._clip={name:name, t0:t0};
  if(CLIP_WINDUP[name] && !ANIM.reduce && typeof fxClock==='number') fxClock = t0 + CLIP_WINDUP[name];
}
function castSheet(look){ var m=AS.cast && AS.cast[look]; if(!m) return null; var img=atl('cast-'+look+'.png'); return img ? {img:img, m:m} : null; }
function mobSheet(name){ var m=AS.mobs && AS.mobs[name]; if(!m) return null; var img=atl('mob-'+name+'.png'); return img ? {img:img, m:m} : null; }
function clipFrame(sheet, e, sliding){
  var m=sheet.m, now=performance.now(), cell=m.cell;
  /* 2026-09-23 (Justin: the Magma Crawler changed art between asleep and awake): a creature whose animation rows
     drifted off its still (packet 04's fire and water five, stillPose in planesfwa.js) holds the still in every
     state, mid-clip included, until it is re-animated on model. */
  if(e.base && e.base.stillPose && m.static_row!==undefined) return {sx:0, sy:m.static_row*cell};
  if(e._clip){
    var c=m.clips[e._clip.name];
    if(c){
      var ms=CLIP_MS[e._clip.name]||70, f=Math.floor((now-e._clip.t0)/ms);
      if(e._clip.name==='death' && f>=c.frames) f=c.frames-1;
      if(f>=0 && f<c.frames) return {sx:f*cell, sy:c.row*cell};
    }
    /* Expired clips fall through without mutating the simulation actor. */
  }
  if(ANIM.reduce){ var st=m.static_row!==undefined ? m.static_row : (m.clips.idle?m.clips.idle.row:0); return {sx:0, sy:st*cell}; }
  /* 2026-09-19: Justin - a sleeping creature kept playing its idle (the Myconid swayed about with a Z over it).
     Asleep it holds its still pose until something wakes it. */
  if(e.state==='asleep'){ var sr=m.static_row!==undefined ? m.static_row : (m.clips.idle?m.clips.idle.row:0); return {sx:0, sy:sr*cell}; }
  if(sliding && m.clips.walk){ var w=m.clips.walk; return {sx:(Math.floor(now/CLIP_MS.walk)%w.frames)*cell, sy:w.row*cell}; }
  if(m.clips.idle){ var id=m.clips.idle, ph=((e.id||0)*97)%500; return {sx:(Math.floor((now+ph)/CLIP_MS.idle)%id.frames)*cell, sy:id.row*cell}; }
  return {sx:0, sy:(m.static_row||0)*cell};
}
function drawCharacter(e, px, py, opts){
  opts=opts||{};
  if(e===player){
    var cs = spriteOn ? castSheet(player.look) : null;
    if(cs){
      var fr=clipFrame(cs, e, opts.sliding), m=cs.m, cell=m.cell, sc=(TS*1.08)/m.stand;
      var w=cell*sc, h=cell*sc, dx=px+TS/2-w/2, dy=py+TS-(cell-m.foot)*sc;
      var rect=placementRect(dx,dy,w,h);dx=rect.x;dy=rect.y;w=rect.w;h=rect.h;
      ctx.save(); ctx.globalAlpha=opts.alpha===undefined?1:opts.alpha; ctx.imageSmoothingEnabled=true;
      if(opts.flip){ ctx.translate(px+TS/2,0); ctx.scale(-1,1); ctx.translate(-(px+TS/2),0); }
      if(typeof drawCastLayers==='function') drawCastLayers(player, cs, fr, dx, dy, w, h); else ctx.drawImage(cs.img, fr.sx, fr.sy, cell, cell, dx, dy, w, h);
      if(opts.flash>0){ ctx.globalAlpha*=opts.flash; ctx.drawImage(whiteCut(cs.img,fr.sx,fr.sy,cell,cell), dx,dy,w,h); }
      ctx.restore();
      return true;
    }
    return false;
  }
  var ms = spriteOn ? mobSheet(e.base.sprite) : null;
  if(ms){
    var f2=clipFrame(ms, e, false), mm=ms.m, c2=mm.cell, box=mm.box||[0,0,c2,c2];
    var target=TS*(e.base.art||0.9)*(e.big?1.25:1), s2=target/Math.max(box[3], box[2]*0.8);
    var w2=c2*s2, h2=c2*s2, feet=(box[1]+box[3]);
    var dx2=px+TS/2-(box[0]+box[2]/2)*s2, dy2=py+TS*0.97-feet*s2;
    /* Tier-two reference art has a single pose: give it a restrained breath,
       attack compression and recoil without altering simulation state. */
    if((e.base.elementTier || e.base.stillPose) && !ANIM.reduce && e.state!=='asleep'){
      var msNow=performance.now(), age2=e._clip?msNow-e._clip.t0:9999;
      var action2=e._clip&&e._clip.name==='attack'&&age2>=0&&age2<540?Math.sin(age2/540*Math.PI):0;
      var pulse2=Math.sin(msNow/330+(e.id||0))*.012;
      var sy2=1+pulse2-action2*.08, sx2=1+action2*.05;
      dx2=px+TS/2+(dx2-px-TS/2)*sx2;w2*=sx2;
      dy2=py+TS*.97+(dy2-py-TS*.97)*sy2;h2*=sy2;
    }
    var rect2=placementRect(dx2,dy2,w2,h2);dx2=rect2.x;dy2=rect2.y;w2=rect2.w;h2=rect2.h;
    ctx.save(); ctx.globalAlpha=opts.alpha===undefined?1:opts.alpha; ctx.imageSmoothingEnabled=true;
    if(opts.flip){ ctx.translate(px+TS/2,0); ctx.scale(-1,1); ctx.translate(-(px+TS/2),0); }
    if(opts.outline){
      var cut2=whiteCut(ms.img,f2.sx,f2.sy,c2,c2),edge2=Math.max(1,Math.round(TS/40));
      ctx.globalAlpha=0.22;
      [[-edge2,0],[edge2,0],[0,-edge2],[0,edge2],[-edge2,-edge2],[edge2,-edge2],[-edge2,edge2],[edge2,edge2]].forEach(function(d){ctx.drawImage(cut2,dx2+d[0],dy2+d[1],w2,h2);});
      ctx.globalAlpha=1;
    }
    ctx.drawImage(ms.img, f2.sx, f2.sy, c2, c2, dx2, dy2, w2, h2);
    if(opts.flash>0){ ctx.globalAlpha*=opts.flash; ctx.drawImage(whiteCut(ms.img,f2.sx,f2.sy,c2,c2), dx2,dy2,w2,h2); }
    ctx.restore();
    return true;
  }
  var o = spriteOn ? objArt('monsters', 'mob-'+({rat:'rat',bat:'bat',goblin:'goblin',archer:'goblin-archer',brute:'goblin-brute',slime:'slime',shaman:'goblin-shaman'}[e.kind]||'x')) : null;
  if(o) return drawObj(o, px, py, {feet:true, fit:(e.base.art||0.9), flip:opts.flip, flash:opts.flash, sy:opts.breath, outline:opts.outline});
  return false;
}

/* ---- item art ---- */
/* hearts and mana globes: drawn, pulsing, fading out in their last turns */
function drawGlobe(it, px, py, alpha, now){
  var left = it.until ? it.until-turn : 99, fade = left<8 ? 0.35+0.65*(ANIM.reduce?1:(0.5+0.5*Math.sin(now/90))) : 1;
  var pulse = ANIM.reduce ? 1 : 1+0.08*Math.sin(now/220+it.x);
  var cx=px+TS/2, cy=py+TS*0.56, r=TS*0.13*pulse;
  ctx.save(); ctx.globalAlpha=alpha*fade;
  var col = it.kind==='heart' ? '#E0443A' : '#4AA8F0', glowC = it.kind==='heart' ? 'rgba(255,90,80,' : 'rgba(110,190,255,';
  var gl=ctx.createRadialGradient(cx,cy,0,cx,cy,TS*0.32); gl.addColorStop(0,glowC+'0.45)'); gl.addColorStop(1,glowC+'0)');
  ctx.fillStyle=gl; ctx.fillRect(cx-TS*0.35,cy-TS*0.35,TS*0.7,TS*0.7);
  ctx.fillStyle=col;
  if(it.kind==='heart'){
    ctx.beginPath(); ctx.moveTo(cx, cy+r*1.1);
    ctx.bezierCurveTo(cx-r*1.9, cy-r*0.2, cx-r*0.9, cy-r*1.6, cx, cy-r*0.55);
    ctx.bezierCurveTo(cx+r*0.9, cy-r*1.6, cx+r*1.9, cy-r*0.2, cx, cy+r*1.1); ctx.fill();
    ctx.fillStyle='rgba(255,220,210,.8)'; ctx.fillRect(cx-r*0.9, cy-r*0.9, Math.max(1,r*0.35), Math.max(1,r*0.35));
  } else {
    ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='rgba(220,240,255,.85)'; ctx.beginPath(); ctx.arc(cx-r*0.35,cy-r*0.35,r*0.28,0,Math.PI*2); ctx.fill();
  }
  ctx.restore();
}

/* how big each kind of loot is on the floor, as a share of a tile: small things stay small */
var ITEM_FIT = {ring:0.42, amulet:0.46, essence:0.42, mote:0.42, key:0.46, sigil:0.5, food:0.52, off:0.58, armor:0.62, weapon:0.68};   /* between the old full-tile size and the too-small trim */
function itemArtName(it){
  if(it.kind==='essence') return 'item-essence';
  if(it.kind==='mote') return 'mote-'+it.el;
  if(it.kind==='food') return (FOODS[it.food]||{}).icon || 'item-ration';
  if(it.kind==='key') return it.key==='crystal' ? 'item-key-crystal' : 'item-key-iron';
  if(it.kind==='sigil') return sigilArtName(it.use);
  if(it.it && it.it.icon) return it.it.icon;
  return 'item-sword';
}
function sigilArtName(use){ var look=(RUN && RUN.sigilLooks && RUN.sigilLooks[use]) || 'ashen'; var n='sigil-'+look; return (AS.map && AS.map.items && AS.map.items.items[n]) ? n : 'item-sigil'; }

/* ---- lights ---- */
function drawLights(){
  var now=performance.now();
  ctx.save(); ctx.globalCompositeOperation='lighter';
  function glow(x,y,col,rad,str){
    if(!inb(x,y) || !(revealAll||vis[idxOf(x,y)])) return;
    var cx=(x-camX+0.5)*TS, cy=(y-camY+0.5)*TS, fl=1+0.08*Math.sin(now/170+x*3+y*7)+0.05*Math.sin(now/53+x);
    var g=ctx.createRadialGradient(cx,cy,TS*0.2,cx,cy,TS*rad*fl);
    g.addColorStop(0, hexA(col, str)); g.addColorStop(1, hexA(col, 0));
    ctx.fillStyle=g; ctx.fillRect(cx-TS*rad*1.2, cy-TS*rad*1.2, TS*rad*2.4, TS*rad*2.4);
  }
  props.forEach(function(p){ if(p.light) glow(p.x,p.y,p.light, p.dim?1.6:2.8, p.dim?0.10:0.20); });
  for(var y=camY;y<=camY+viewH;y++) for(var x=camX;x<=camX+viewW;x++){
    if(!inb(x,y)) continue; var t=at(x,y);
    if(fireT[idxOf(x,y)]>0) glow(x,y,'#FF7A30',2.2,0.22);
    else if(t===FORGE) glow(x,y,'#FF8A3A',3.2,0.24);
    else if(t===SHRINE) glow(x,y,(GODS[RUN.shrineGod]||{}).color||'#FFFFFF',3,0.14);
    else if(t===EXIT && floorMeta.exitOpen) glow(x,y,'#9FD8FF',3,0.25);
  }
  if(!lightingOn()) glow(player.x,player.y,'#FFD9A0',3.6,0.07);
  ctx.restore();
}
/* ---------------------------------------------------------------- lightmap
   One texel per tile, built each frame from light sources, then scaled up with smoothing and
   multiplied over the scene. Smoothing gives soft falloff, and darker wall texels shade the floor
   along wall bases for free. Values above 1 feed a small additive bloom pass. */
var LM = {c:null, x:null, bloom:null, bx:null};
function hexRGB(hex){ var n=parseInt((hex||'#FFFFFF').slice(1),16); return [((n>>16)&255)/255, ((n>>8)&255)/255, (n&255)/255]; }
function lightBlocks(x,y){ var t=at(x,y); return t===WALL||t===SECRET||t===DOOR||t===LOCKED||t===ICEDOOR||t===THORNS||t===SEALED||t===TOLL; }
function lightLOS(x0,y0,x1,y1){
  var dx=Math.abs(x1-x0), dy=Math.abs(y1-y0), sx=x0<x1?1:-1, sy=y0<y1?1:-1, err=dx-dy, x=x0, y=y0;
  while(!(x===x1 && y===y1)){
    var e2=2*err; if(e2>-dy){ err-=dy; x+=sx; } if(e2<dx){ err+=dx; y+=sy; }
    if(x===x1 && y===y1) return true;
    if(lightBlocks(x,y)) return false;
  }
  return true;
}
function wallTorchAt(x,y){
  if(!isWallLike(at(x,y)) || at(x,y)===SECRET) return false;
  var south=at(x,y+1); if(south===WALL || south===SECRET) return false;
  return hash2(x,y,11)<0.12 && WALL_FACE_RARE[Math.floor(hash2(x,y,5)*WALL_FACE_RARE.length)]===12;
}
function gatherLights(now, prp){
  var L=[], x, y;
  function add(lx,ly,col,rad,str,src){ L.push({em:L.length>0, x:lx, y:ly, c:hexRGB(col), r:rad, s:str, tx:src?src[0]:Math.round(lx), ty:src?src[1]:Math.round(ly)}); }
  function fl(k){ return ANIM.reduce ? 1 : 1 + 0.07*Math.sin(now/130 + k*1.7) + 0.04*Math.sin(now/47 + k*3.1); }
  var x0=camX-7, x1=camX+viewW+7, y0=camY-7, y1=camY+viewH+7;
  /* the hero's own torch follows the sliding render position, so light glides with each step */
  var pr = 5.5 + (player.aff && player.aff.light ? 1 : 0) + (player.aff && player.aff.fire ? 0.5 : 0);
  add(prp.x, prp.y, '#FFB066', pr, 1.15*fl(0.3), [player.x, player.y]);
  for(y=Math.max(0,y0); y<=Math.min(MH-1,y1); y++) for(x=Math.max(0,x0); x<=Math.min(MW-1,x1); x++){
    var i=idxOf(x,y), t=map[i];
    if(!(revealAll||seen[i])) continue;
    if(wallTorchAt(x,y)) add(x, y+0.75, '#FF9A48', 5, 1.2*fl(x*7+y), [x, y+1]);
    else if(fireT[i]>0) add(x, y, '#FF7A30', 3.2, 0.9*fl(x+y*5));
    else if(t===FORGE) add(x, y, '#FF8A3A', 5.5, 1.15*fl(x*3+y));
    else if(t===SHRINE) add(x, y, (GODS[RUN.shrineGod]||{}).color||'#FFFFFF', 4, 0.5);
    else if(t===EXIT && floorMeta.exitOpen) add(x, y, '#9FD8FF', 4.5, 0.9);
    else if(t===STAIRS) add(x, y, '#9FD8FF', 3.2, 0.7);
    else if(t===CHEST) add(x, y, '#E8B44A', 2.2, 0.45);
  }
  props.forEach(function(pp){ if(pp.light && pp.x>=x0 && pp.x<=x1 && pp.y>=y0 && pp.y<=y1 && (revealAll||seen[idxOf(pp.x,pp.y)])) add(pp.x, pp.y, pp.light, pp.dim?2.8:4.8, (pp.dim?0.55:1.0)*fl(pp.x*5+pp.y)); });
  items.forEach(function(it){ if(it.kind==='mote' && (revealAll||vis[idxOf(it.x,it.y)])) add(it.x, it.y, AFF_COL[it.el]||'#FFFFFF', 2.2, 0.55*fl(it.x+it.y)); });
  items.forEach(function(it){ if(it.kind==='key' && (revealAll||seen[idxOf(it.x,it.y)])) add(it.x, it.y, it.key==='crystal' ? '#A0E6FF' : '#78BEFF', 2.6, 0.6*fl(it.x+it.y*3)); });
  ents.forEach(function(e){ if(e.base && e.base.glow && (revealAll||vis[idxOf(e.x,e.y)])){ var rp=renderPos(e); add(rp.x, rp.y, e.base.glow, 3, 0.8, [e.x,e.y]); } });
  /* spells and arrows in flight carry their light along the path */
  fx.forEach(function(f){
    if(f.k!=='p') return; var q=(now-f.t0)/f.dur; if(q<0 || q>1) return;
    var col = f.arrow ? null : (DMG_COL[f.type]||'#FFFFFF'); if(!col) return;
    var lx=f.ax+(f.bx-f.ax)*q, ly=f.ay+(f.by-f.ay)*q;
    add(lx, ly, col, 3.2, 1.0);
  });
  return L;
}
function drawLightmap(now, prp){
  var S=2, W=(viewW+3)*S, H=(viewH+3)*S, ox=camX-1, oy=camY-1;   /* S texels per tile */
  if(!LM.c){ LM.c=document.createElement('canvas'); LM.x=LM.c.getContext('2d'); LM.bloom=document.createElement('canvas'); LM.bx=LM.bloom.getContext('2d'); }
  if(LM.c.width!==W || LM.c.height!==H){ LM.c.width=W; LM.c.height=H; LM.bloom.width=W; LM.bloom.height=H; }
  var img=LM.x.createImageData(W,H), bl=LM.bx.createImageData(W,H), D=img.data, B=bl.data;
  var lights=gatherLights(now, prp);
  var room=roomAt(player.x,player.y), darkRoom = room && room.dark && !(player.aff.light>0) && !(player.aff.fire>0);
  /* how dark each biome is: the dungeon is a lived-in, torch-lit place; the crypt and caverns are not */
  var BL = [ {amb:[0.50,0.51,0.58], mem:[0.55,0.58,0.70]},    /* dungeon */
             {amb:[0.34,0.35,0.44], mem:[0.46,0.48,0.62]},    /* crypt: brighter, cooler, like the concept art */
             {amb:[0.20,0.21,0.26], mem:[0.38,0.40,0.50]} ][Math.min(2, biomeIdx())];
  /* the elemental planes set their own mood: Light is bright and warm, Shadow near-black, Earth a dim green */
  var PL = floorMeta && floorMeta.plane ? {light:{amb:[0.90,0.89,0.88], mem:[0.60,0.60,0.64]}, shadow:{amb:[0.30,0.26,0.40], mem:[0.40,0.36,0.52]}, earth:{amb:[0.42,0.44,0.34], mem:[0.46,0.48,0.40]}}[floorMeta.plane] : null;
  if(PL) BL=PL;
  var AMB = darkRoom ? [0.08,0.08,0.12] : BL.amb, MEM=BL.mem.map(function(v){ return v*0.45; });   /* the tile fade moved in here (memA) */
  var vals=new Float32Array(W*H*3), isWall=new Uint8Array(W*H);
  var tx, ty, k, j;
  for(ty=0; ty<H; ty++) for(tx=0; tx<W; tx++){
    var x=ox+Math.floor(tx/S), y=oy+Math.floor(ty/S), o=(ty*W+tx)*3, cell=ty*W+tx;
    var fx0=ox+(tx+0.5)/S-0.5, fy0=oy+(ty+0.5)/S-0.5;
    if(!inb(x,y)){ continue; }
    var i=idxOf(x,y);
    if(!(revealAll||seen[i])) continue;
    var wall=isWallLike(at(x,y)); isWall[cell]=wall?1:0;
    var r, g, b;
    if(!(revealAll||vis[i])){ r=MEM[0]; g=MEM[1]; b=MEM[2]; }
    else {
      r=AMB[0]; g=AMB[1]; b=AMB[2];
      /* 2026-09-19: the Underdark lights its regions differently - a dull red glow over the lava rock (deeprender.js) */
      if(typeof deepAmbAt==='function'){ var da=deepAmbAt(x,y); if(da){ r=da[0]; g=da[1]; b=da[2]; } }
      /* a wall face takes its light from the floor in front of it; a wall top is lit later from its neighbours */
      var face = wall && !isWallLike(at(x,y+1));
      if(!wall || face){
        var sx=fx0, sy=face ? y+1 : fy0, stx=x, sty=face ? y+1 : y;
        for(k=0;k<lights.length;k++){
          var L=lights[k], ddx=L.x-sx, ddy=L.y-sy, d=Math.sqrt(ddx*ddx+ddy*ddy);
          if(d>=L.r) continue;
          if(face && L.y < y+0.5) continue;
          if(k===0 ? !(revealAll||vis[idxOf(stx,sty)]) : !lightLOS(L.tx, L.ty, stx, sty)) continue;
          var f=1-d/L.r; f=Math.pow(f,1.6)*L.s;
          r+=L.c[0]*f; g+=L.c[1]*f; b+=L.c[2]*f;
        }
        if(face){ r*=0.9; g*=0.9; b*=0.9; }
        else { var n=0.93+0.09*(typeof ptVal==='function' ? ptVal(fx0*0.7, fy0*0.7, 21) : hash2(x,y,21)); r*=n; g*=n; b*=n; }   /* smooth across tiles (a per-tile value showed as a grid) */
      } else { r=-1; g=0; b=0; }
    }
    vals[o]=r; vals[o+1]=g; vals[o+2]=b;
  }
  /* wall tops: dark masses, faintly picking up the light of the open ground beside them */
  for(ty=0; ty<H; ty++) for(tx=0; tx<W; tx++){
    var o2=(ty*W+tx)*3; if(vals[o2]!==-1) continue;
    var sr=0, sg=0, sb=0, cnt=0;
    for(j=0;j<4;j++){
      var nx=tx+[1,-1,0,0][j], ny=ty+[0,0,1,-1][j]; if(nx<0||ny<0||nx>=W||ny>=H) continue;
      var no=(ny*W+nx)*3; if(isWall[ny*W+nx] || vals[no]<0) continue;
      sr+=vals[no]; sg+=vals[no+1]; sb+=vals[no+2]; cnt++;
    }
    /* 2026-09-19: in the Underdark the rock keeps its own (already dimmed) ambient and takes far less of the cave's
       light, so a wall stops the glow instead of glowing with it */
    var wx2=ox+Math.floor(tx/S), wy2=oy+Math.floor(ty/S);
    var dAmb = typeof deepAmbAt==='function' ? deepAmbAt(wx2, wy2) : null, A2 = dAmb || AMB, bleed = dAmb ? 0.16 : 0.45;
    vals[o2] = A2[0]*0.7 + (cnt? sr/cnt*bleed : 0); vals[o2+1] = A2[1]*0.7 + (cnt? sg/cnt*bleed : 0); vals[o2+2] = A2[2]*0.7 + (cnt? sb/cnt*bleed : 0);
  }
  /* soft ceiling: stacked lights (braziers beside a shrine) roll off instead of washing the tiles out */
  for(j=0;j<W*H*3;j++){ var v=vals[j]; if(v>1) vals[j]=1+(v-1)*0.3; }
  for(j=0;j<W*H;j++){
    var q=j*3, p4=j*4;
    D[p4]=Math.min(255, vals[q]*255); D[p4+1]=Math.min(255, vals[q+1]*255); D[p4+2]=Math.min(255, vals[q+2]*255); D[p4+3]=255;
    var ex=Math.max(0, Math.max(vals[q],vals[q+1],vals[q+2])-1.1);
    B[p4]=Math.min(255, vals[q]*ex*110); B[p4+1]=Math.min(255, vals[q+1]*ex*110); B[p4+2]=Math.min(255, vals[q+2]*ex*110); B[p4+3]=255;
  }
  LM.x.putImageData(img,0,0); LM.bx.putImageData(bl,0,0);
  ctx.save();
  ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality='high';
  ctx.globalCompositeOperation='multiply';
  /* 2026-09-19: the light is worked out a tile at a time, so a wall or blocking object cast a square-edged
     shadow and stretching two texels a tile left square steps along walls and objects. A blur before it is
     laid over the scene melts the steps into gradients. */
  ctx.filter='blur('+Math.max(2, Math.round(TS*0.38))+'px)';
  ctx.drawImage(LM.c, 0, 0, W, H, -TS, -TS, W*TS/S, H*TS/S);
  ctx.filter='none';
  ctx.globalCompositeOperation='lighter'; ctx.globalAlpha=0.3;
  ctx.drawImage(LM.bloom, 0, 0, W, H, -TS, -TS, W*TS/S, H*TS/S);
  ctx.restore();
}

/* ---- telegraphs: the floor a boss is about to hit glows red, brighter as the blow gets close ---- */
function drawTelegraphs(now){
  ents.forEach(function(e){
    if(!e.windup || !e.windup.tiles) return;
    var urgent = e.windup.due<=1, pulse = ANIM.reduce ? 0.7 : 0.5+0.5*Math.sin(now/(urgent?110:220));
    ctx.save();
    e.windup.tiles.forEach(function(t){
      if(!(revealAll||vis[idxOf(t[0],t[1])])) return;
      var px=(t[0]-camX)*TS, py=(t[1]-camY)*TS;
      ctx.globalCompositeOperation='source-over';
      ctx.fillStyle='rgba(210,40,30,'+((urgent?0.34:0.2)+0.16*pulse)+')'; ctx.fillRect(px+1,py+1,TS-2,TS-2);
      ctx.strokeStyle='rgba(255,120,90,'+(0.55+0.35*pulse)+')'; ctx.lineWidth=Math.max(1.5,TS*0.05); ctx.strokeRect(px+2,py+2,TS-4,TS-4);
      if(e.windup.kind==='charge'){ ctx.fillStyle='rgba(255,210,160,'+(0.5+0.4*pulse)+')'; var cx=px+TS/2, cy=py+TS/2, a=Math.atan2(player.y-e.y+0.0001, player.x-e.x); ctx.beginPath(); ctx.moveTo(cx+Math.cos(a)*TS*0.25, cy+Math.sin(a)*TS*0.25); ctx.lineTo(cx+Math.cos(a+2.4)*TS*0.18, cy+Math.sin(a+2.4)*TS*0.18); ctx.lineTo(cx+Math.cos(a-2.4)*TS*0.18, cy+Math.sin(a-2.4)*TS*0.18); ctx.closePath(); ctx.fill(); }
    });
    ctx.restore();
  });
}

/* ---- beacons: key interactables glow and shed sparks so they read at a glance, even from memory ---- */
var BEACON_PROPS = {'fountain':'#7FC8FF', 'altar-spikes':'#B8453A', 'elemental-lock':'#C9A8FF', 'lever-up':'#E8D27A', 'lever-down':'#E8D27A', 'tablet':'#F6E7B0', 'cage':'#E8B44A', 'boss-throne':'#E2622B'};
function beaconAt(x, y){
  var t=at(x,y);
  if(t===STAIRS) return {col:'#9FD8FF', big:1};
  if(t===EXIT) return floorMeta.exitOpen ? {col:'#9FD8FF', big:1} : null;
  if(t===CHEST) return {col:'#E8B44A'};
  if(t===SHRINE) return {col:(GODS[RUN.shrineGod]||{}).color||'#FFFFFF', big:1};
  if(t===FORGE) return {col:'#FF8A3A', big:1};
  if(t===LOCKED || t===TOLL) return {col:'#E8B44A', small:1};
  return null;
}
function drawBeacons(now){
  var list=[], x, y;
  for(y=camY-1;y<=camY+viewH+1;y++) for(x=camX-1;x<=camX+viewW+1;x++){
    if(!inb(x,y)) continue; var i=idxOf(x,y); if(!(revealAll||seen[i])) continue;
    var b=beaconAt(x,y); if(b){ b.x=x; b.y=y; b.lit=revealAll||vis[i]; list.push(b); }
  }
  props.forEach(function(pp){
    var c = pp.tablet ? '#F6E7B0' : pp.prisoner ? '#E8B44A' : pp.drink ? '#7FC8FF' : pp.altar ? '#B8453A'
          : (pp.lever && pp.name==='lever-up') ? '#E8D27A' : pp.name==='elemental-lock' ? '#C9A8FF' : null;
    if(!c) return;
    var i=idxOf(pp.x,pp.y); if(!(revealAll||seen[i])) return;
    list.push({x:pp.x, y:pp.y, col:c, small:1, lit:revealAll||vis[i]});
  });
  if(!list.length) return;
  ctx.save(); ctx.globalCompositeOperation='lighter';
  list.forEach(function(b){
    var cx=(b.x-camX+0.5)*TS, cy=(b.y-camY+0.62)*TS, rgb=hexRGB(b.col);
    var pulse = ANIM.reduce ? 0.8 : 0.65 + 0.35*Math.sin(now/520 + b.x*1.3 + b.y*0.7);
    var R=TS*(b.big?1.0:b.small?0.65:0.85), a=(b.lit?(b.big?0.4:0.55):0.3)*pulse;
    var g=ctx.createRadialGradient(cx,cy,0,cx,cy,R);
    g.addColorStop(0,'rgba('+(rgb[0]*255|0)+','+(rgb[1]*255|0)+','+(rgb[2]*255|0)+','+a+')');
    g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=g; ctx.beginPath(); ctx.ellipse(cx,cy,R,R*0.7,0,0,Math.PI*2); ctx.fill();
    /* a thin ring on the floor that breathes outward, so the spot reads even against bright light */
    if(!ANIM.reduce){
      var rp=(now/1400 + b.x*0.13) % 1;
      ctx.globalAlpha=(1-rp)*(b.lit?0.55:0.3); ctx.strokeStyle=b.col; ctx.lineWidth=Math.max(1.5, TS*0.04);
      ctx.beginPath(); ctx.ellipse(cx, cy+TS*0.2, TS*(0.3+0.3*rp), TS*(0.12+0.12*rp), 0, 0, Math.PI*2); ctx.stroke(); ctx.globalAlpha=1;
    }
    if(!b.lit || ANIM.reduce) return;
    /* a few sparks drifting upward, on a loop seeded by the tile */
    var n=b.big?5:3;
    for(var k=0;k<n;k++){
      var ph=((now/1600) + grassHash(b.x,b.y,k)) % 1;
      var sx=cx + (grassHash(b.x,b.y,k+10)-0.5)*TS*0.8 + Math.sin(now/400+k)*TS*0.04;
      var sy=cy + TS*0.2 - ph*TS*1.1;
      ctx.globalAlpha=Math.sin(ph*Math.PI)*0.9;
      ctx.fillStyle=b.col; var sz=Math.max(2, TS*0.05); ctx.fillRect(sx, sy, sz, sz);
    }
    ctx.globalAlpha=1;
  });
  ctx.restore();
}
/* screen-edge arrow toward stairs (or the open exit) that you have found but that is off screen */
function drawStairsPointer(now){
  if(!RUN || !map) return;
  var best=null, bd=1e9;
  for(var i=0;i<map.length;i++){
    var t=map[i]; if(!(t===STAIRS || (t===EXIT && floorMeta.exitOpen))) continue;
    if(!(revealAll||seen[i])) continue;
    var x=i%MW, y=(i/MW)|0, d=Math.abs(x-player.x)+Math.abs(y-player.y); if(d<bd){ bd=d; best={x:x,y:y}; }
  }
  if(!best) return;
  var sx=(best.x-camX+0.5)*TS-camOX, sy=(best.y-camY+0.5)*TS-camOY, W=viewW*TS, H=viewH*TS;
  if(sx>TS*0.3 && sx<W-TS*0.3 && sy>TS*0.3 && sy<H-TS*0.3) return;
  var cx=W/2, cy=H/2, dx=sx-cx, dy=sy-cy, m=TS*0.6;
  var k=Math.min((W/2-m)/Math.max(1e-3,Math.abs(dx)), (H/2-m)/Math.max(1e-3,Math.abs(dy)));
  var ax=cx+dx*k, ay=cy+dy*k, ang=Math.atan2(dy,dx), bob=ANIM.reduce?0:Math.sin(now/300)*3;
  ctx.save(); ctx.translate(ax-Math.cos(ang)*bob, ay-Math.sin(ang)*bob); ctx.rotate(ang);
  ctx.globalAlpha=0.9; ctx.fillStyle='#9FD8FF'; ctx.strokeStyle='rgba(0,0,0,.7)'; ctx.lineWidth=2;
  var z=Math.max(8, TS*0.28);
  ctx.beginPath(); ctx.moveTo(z,0); ctx.lineTo(-z*0.7,-z*0.7); ctx.lineTo(-z*0.35,0); ctx.lineTo(-z*0.7,z*0.7); ctx.closePath(); ctx.stroke(); ctx.fill();
  ctx.restore();
  ctx.save(); ctx.font='bold '+Math.max(10,TS*0.26|0)+'px monospace'; ctx.textAlign='center'; ctx.fillStyle='#9FD8FF'; ctx.strokeStyle='rgba(0,0,0,.8)'; ctx.lineWidth=3;
  var lx=ax-Math.cos(ang)*z*2, ly=ay-Math.sin(ang)*z*2+4;
  ctx.strokeText('>', lx, ly); ctx.fillText('>', lx, ly); ctx.restore();
}

function hexA(hex, a){ var n=parseInt(hex.slice(1),16); return 'rgba('+((n>>16)&255)+','+((n>>8)&255)+','+(n&255)+','+a+')'; }

/* ============================================================== draw */
function draw(){
  if(!map || !ground) return;
  var x, y, now=performance.now();
  var prp=renderPos(player);
  var camFX=clamp(prp.x-(viewW>>1), 0, Math.max(0,MW-viewW));
  var camFY=clamp(prp.y-(viewH>>1), 0, Math.max(0,MH-viewH));
  camX=Math.floor(camFX); camY=Math.floor(camFY);
  /* 2026-09-18: on touch the player stays centred even at a map edge. The tile window stays clamped (every
     loop below reads inside the map); only the pixel offset follows the player, so the far side of the edge
     is empty dark and the tiles pushed past the other side are simply off-canvas. Taps convert through camOX. */
  if(document.body.classList.contains('touch')){ camFX=prp.x-(viewW>>1); camFY=prp.y-(viewH>>1); }
  camOX=(camFX-camX)*TS; camOY=(camFY-camY)*TS;
  ctx.globalAlpha=1; ctx.fillStyle='#07060A'; ctx.fillRect(0,0,viewW*TS,viewH*TS);
  ctx.save(); ctx.translate(-camOX, -camOY);
  var artOK = spriteOn && AS.floor && atl('floor.png') && AS.walls && atl('walls.png');

  /* ---- terrain ---- */
  for(y=camY;y<=camY+viewH;y++) for(x=camX;x<=camX+viewW;x++){
    if(!inb(x,y)) continue;
    var i=idxOf(x,y), lit=revealAll||vis[i], known=revealAll||seen[i];
    if(!known) continue;
    var t=map[i], px=(x-camX)*TS, py=(y-camY)*TS, a=lit?1:memA(0.40);
    if(artOK){
      if(isWallLike(t)) blitTile(wallTile(x,y), px, py, a);
      else if(t===CHASM){ ctx.globalAlpha=a; ctx.fillStyle='#050408'; ctx.fillRect(px,py,TS+1,TS+1); }
      else blitTile(floorTile(x,y), px, py, a);
    } else {
      var B=biome();
      ctx.globalAlpha=a; ctx.fillStyle = isWallLike(t) ? B.wall : t===CHASM ? '#050408' : t===WATER ? '#243A4A' : B.floor; ctx.fillRect(px,py,TS,TS);
    }
    /* shadow cast by a wall face onto the floor below it */
    /* (not under the organic rock of the Caverns and the planes, where a tile-wide band showed as square blocks) */
    if(!isWallLike(t) && isWallLike(at(x,y-1)) && t!==CHASM && !(typeof ptMat==='function' && ptMat())){
      ctx.globalAlpha=0.55*a; var sg=ctx.createLinearGradient(0,py,0,py+TS*0.35); sg.addColorStop(0,'rgba(0,0,0,0.7)'); sg.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=sg; ctx.fillRect(px,py,TS,TS*0.35);
    }
    /* wall tops get capstone rims where they meet open ground; faces show their ends and fixtures (surface.js) */
    if(artOK && isWallLike(t)){
      if(typeof drawWallEdges==='function') drawWallEdges(x, y, t, px, py, a);
      else if(isWallLike(at(x,y+1))){
        ctx.globalAlpha=0.35*a; ctx.fillStyle='#8C8378';
        if(!isWallLike(at(x-1,y))) ctx.fillRect(px,py,2,TS);
        if(!isWallLike(at(x+1,y))) ctx.fillRect(px+TS-2,py,2,TS);
        if(!isWallLike(at(x,y-1))) ctx.fillRect(px,py,TS,2);
      }
    }
  }
  ctx.globalAlpha=1;
  if(artOK){ drawWangLayer('water', WATER); drawWangLayer('chasm', CHASM); }
  /* fallback water tint where no water tileset exists */
  for(y=camY;y<=camY+viewH;y++) for(x=camX;x<=camX+viewW;x++){
    if(!inb(x,y)) continue; var ii=idxOf(x,y); if(!(revealAll||seen[ii])) continue;
    var tt=map[ii], ppx=(x-camX)*TS, ppy=(y-camY)*TS, aa=(revealAll||vis[ii])?1:memA(0.4);
    if(tt===WATER && !(AS.wang_water)){ ctx.globalAlpha=0.55*aa; ctx.fillStyle='#2E5E80'; ctx.fillRect(ppx,ppy,TS,TS);
      ctx.globalAlpha=0.25*aa; ctx.fillStyle='#9FD8FF'; ctx.fillRect(ppx+TS*0.2+Math.sin(now/600+x)*2,ppy+TS*0.3,TS*0.3,1); }
    if(tt===CHASM && !(AS.wang_chasm)){ ctx.globalAlpha=aa; ctx.fillStyle='#000'; ctx.fillRect(ppx+2,ppy+2,TS-4,TS-4); }
  }
  ctx.globalAlpha=1;

  /* ---- surface decoration: moss, grit, drains (surface.js) ---- */
  if(artOK && typeof drawSurfaceDeco==='function') drawSurfaceDeco();
  ctx.globalAlpha=1;

  /* ---- ground decals ---- */
  for(y=camY;y<=camY+viewH;y++) for(x=camX;x<=camX+viewW;x++){
    if(!inb(x,y)) continue; var gi=idxOf(x,y), gv=ground[gi]; if(!gv || !(revealAll||seen[gi])) continue;
    var ga=(revealAll||vis[gi])?1:memA(0.4), gpx=(x-camX)*TS, gpy=(y-camY)*TS, go=objArt('terrain', GROUND_ART[gv]);
    if(gv===G_GRASS){ drawGrassTile(x, y, gpx, gpy, ga, 'back', now); continue; }
    if(drawGroundDecal(gv, x, y, gpx, gpy, ga, now)) continue;
    if(go) drawObj(go, gpx, gpy, {fit:0.9, alpha:ga*0.95});
    else if(gv===G_SHORT||gv===G_ASH||gv===G_SCORCH){
      /* not a full tile of flat colour (that read as a grey square under trampled grass): a ragged blotch instead */
      var col={1:'#2F5A24',2:'#4A6A32',3:'#3A3632',6:'#141210'}[gv];
      ctx.globalAlpha=0.3*ga; ctx.fillStyle=col;
      for(var bb=0;bb<7;bb++){
        var bh=hash2(x,y,300+bb), bh2=hash2(x,y,320+bb), br=TS*(0.16+hash2(x,y,340+bb)*0.2);
        ctx.beginPath(); ctx.ellipse(gpx+TS*(0.2+bh*0.6), gpy+TS*(0.2+bh2*0.6), br, br*0.7, bh*3, 0, 7); ctx.fill();
      }
      ctx.globalAlpha=1;
    }
  }
  var upright=[];
  function standing(row,paint){upright.push({row:row,paint:paint,order:upright.length});}
  /* ---- tile objects ---- */
  function paintTileObject(x,y){
    if(!inb(x,y)) return; var oi=idxOf(x,y); if(!(revealAll||seen[oi])) return;
    var ot=map[oi]; if(ot===FLOOR||ot===WALL||ot===WATER||ot===CHASM||ot===SECRET) return;
    var oa=(revealAll||vis[oi])?1:memA(0.45), opx=(x-camX)*TS, opy=(y-camY)*TS, spr=spriteOn?tileSprite(x,y,ot):null;
    if(ot===CHEST && typeof propShadow==='function') propShadow(x, y, opx, opy, oa, 'chest');
    if(typeof drawSideDoor==='function' && drawSideDoor(x, y, ot, opx, opy, oa)) return;   /* doors in east/west walls (surface.js) */
    if(ot===OPEN){ drawOpenDoor(x, y, opx, opy, oa); return; }
    var isDoor=(ot===DOOR||ot===OPEN||ot===LOCKED||ot===TOLL||ot===ICEDOOR||ot===THORNS||ot===SEALED);
    if(spr){
      var big = ot===FORGE||ot===SHRINE||ot===EXIT;   /* 2026-09-19: the god statues are two tiles tall - a shrine stands on its tile and rises above it */
      drawObj(spr, opx, opy, {feet:!isDoor && ot!==STAIRS && ot!==19 && ot!==BRIDGE, fit: isDoor?1.02 : ot===SHRINE?2.1 : ot===FORGE?2.3 : big?1.18 : (ot===STAIRS||ot===19)?0.95 : 0.85, alpha:oa, fill: isDoor});
      if(ot===EXIT && !floorMeta.exitOpen){ ctx.globalAlpha=0.55*oa; ctx.fillStyle='#000'; ctx.fillRect(opx+TS*0.2,opy+TS*0.1,TS*0.6,TS*0.8); ctx.globalAlpha=1; }
      if(ot===SEALED && !(floorMeta.crystalDoor && floorMeta.crystalDoor.x===x && floorMeta.crystalDoor.y===y)){ ctx.globalAlpha=0.35*oa; ctx.fillStyle='#6FB7FF'; ctx.fillRect(opx,opy,TS,TS); ctx.globalAlpha=1; }
    } else {
      ctx.globalAlpha=oa;
      var col={2:'#6B4B2A',7:'#53381F',3:'#E8B44A',4:'#7A5A2A',5:'#E2622B',9:'#8A8A9A',10:'#F6E7B0',11:'#9FD8FF',12:'#3E6B2E',13:'#9FD8FF',14:'#B8453A',17:'#7A5A34',18:'#6FB7FF'}[ot]||'#555';
      ctx.fillStyle=col; ctx.fillRect(opx+TS*0.12,opy+TS*0.12,TS*0.76,TS*0.76); ctx.globalAlpha=1;
    }
  }
  for(y=camY;y<=camY+viewH;y++) for(x=camX;x<=camX+viewW;x++){
    if(!inb(x,y) || !(revealAll||seen[idxOf(x,y)]))continue;
    (function(tx,ty){standing(ty+1,function(){paintTileObject(tx,ty);});})(x,y);
  }
  /* pressure plates */
  if(plates) plates.cells.forEach(function(p){
    if(!(revealAll||seen[idxOf(p.x,p.y)])) return;
    var ppx=(p.x-camX)*TS, ppy=(p.y-camY)*TS;
    drawObj(objArt('structures', p.pressed?'plate-glow':'trap-plate') || objArt('traps','trap-plate'), ppx, ppy, {fit:0.8, alpha:(revealAll||vis[idxOf(p.x,p.y)])?1:memA(0.45)});
    ctx.fillStyle = p.pressed ? '#FFE9A0' : '#D8CFC0'; ctx.font='700 '+Math.round(TS*0.42)+'px serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText({moon:'\u263E', sun:'\u2600', star:'\u2605'}[p.symbol], ppx+TS/2, ppy+TS/2);
  });
  /* traps you know about */
  feats.forEach(function(f){
    if(!(revealAll||f.found) || !(revealAll||seen[idxOf(f.x,f.y)])) return;
    var fpx=(f.x-camX)*TS, fpy=(f.y-camY)*TS, fa=(revealAll||vis[idxOf(f.x,f.y)])?1:memA(0.45);
    drawTrap(f, fpx, fpy, fa, now);
  });
  drawTelegraphs(now);   /* boss attack markings sit on the floor, under whoever stands there */
  /* props */
  function paintProp(p){
    if(!(revealAll||seen[idxOf(p.x,p.y)])) return;
    var ppx=(p.x-camX)*TS, ppy=(p.y-camY)*TS, pa=(revealAll||vis[idxOf(p.x,p.y)])?1:memA(0.45);
    var o=spriteOn ? objArt('props',p.name)||objArt('structures',p.name)||objArt('chests',p.name)||objArt('terrain',p.name) : null;   /* an opened chest's art lives with the chests */
    if(p.name==='elemental-lock' && p.opened) pa*=0.6;
    if(p.name==='vines'){ drawVines(p.x, p.y, ppx, ppy, pa, now); return; }
    if(p.pillar){ drawPillar(p, ppx, ppy, pa, now); return; }
    if(typeof drawPropSurface==='function' && drawPropSurface(p, ppx, ppy, pa)) return;   /* flat bones and rubble (surface.js) */
    if(typeof propShadow==='function' && !p.flat) propShadow(p.x, p.y, ppx, ppy, pa, p.name);   /* contact shadow (surface.js) */
    if(!drawObj(o, ppx, ppy, {feet:!p.flat, fit: p.flat?0.82 : (p.name==='bookshelf'||p.name==='statue'||p.name==='boss-throne')?1.12 : /^(urn|coffin|sarcophagus|tomb)/.test(p.name)?1.08 : 0.9, alpha:pa, flash:flashOf(p)})){
      ctx.globalAlpha=pa; ctx.fillStyle=p.b?'#6A5A48':'#4A4038'; ctx.fillRect(ppx+TS*0.2,ppy+TS*0.2,TS*0.6,TS*0.6); ctx.globalAlpha=1;
    }
    if(typeof propFlame==='function') propFlame(p, o, ppx, ppy, pa, now);   /* animated flames (surface.js) */
    if(p.name==='elemental-lock' && !p.opened){ ctx.globalAlpha=pa*(0.6+0.3*Math.sin(now/300)); ctx.fillStyle=AFF_COL[p.element]; ctx.beginPath(); ctx.arc(ppx+TS/2,ppy+TS*0.25,TS*0.1,0,7); ctx.fill(); ctx.globalAlpha=1; }
    if(p.prisoner && (revealAll||vis[idxOf(p.x,p.y)])){ mark('!', ppx+TS*0.72, ppy+TS*0.2, '#E8B44A'); }
  }
  props.forEach(function(p){
    if(p.flat || p.name==='vines')paintProp(p);
    else standing(p.y+(p.h||1),function(){paintProp(p);});
  });

  /* items: after the flat props, so a pickup dropped on rubble, bones or moss lies on top of them rather than
     under them (2026-09-22, Justin: a mana globe under a rock); standing props and creatures are deferred and
     still cover it */
  items.forEach(function(it){
    if(!(revealAll||vis[idxOf(it.x,it.y)])) return;
    var ipx=(it.x-camX)*TS, ipy=(it.y-camY)*TS, ia=(revealAll||vis[idxOf(it.x,it.y)])?1:memA(0.45);
    var bob = ANIM.reduce ? 0 : Math.sin(now/400 + it.x*2 + it.y)*TS*0.03;
    if(it.kind==='key'){
      /* 2026-09-17: a key on a stone floor was almost impossible to spot, and missing one locks the vault
         for the rest of the floor. It sits in a blue glow that breathes. */
      var kp = ANIM.reduce ? 1 : 0.75 + 0.25*Math.sin(now/420 + it.x + it.y);
      var kc = it.key==='crystal' ? '160,230,255' : '120,190,255';
      var kg = ctx.createRadialGradient(ipx+TS/2, ipy+TS*0.58, TS*0.05, ipx+TS/2, ipy+TS*0.58, TS*0.62);
      kg.addColorStop(0, 'rgba('+kc+','+(0.55*kp*ia)+')');
      kg.addColorStop(0.55, 'rgba('+kc+','+(0.18*kp*ia)+')');
      kg.addColorStop(1, 'rgba('+kc+',0)');
      ctx.fillStyle=kg; ctx.beginPath(); ctx.arc(ipx+TS/2, ipy+TS*0.58, TS*0.62, 0, 7); ctx.fill();
      if(!ANIM.reduce && Math.random()<0.10) sparkleFx(it.x, it.y, 'ice', 1);
    }
    if(it.kind==='heart' || it.kind==='managlobe'){ drawGlobe(it, ipx, ipy+bob, ia, now); return; }
    var o=spriteOn ? (objArt('items', itemArtName(it))) : null;
    if(o) drawObj(o, ipx, ipy+TS*0.08+bob, {fit: ITEM_FIT[it.kind]||0.5, alpha:ia});
    else { ctx.globalAlpha=ia; glyph(it.kind==='essence'?'\u2022':it.kind==='mote'?'\u25C6':it.kind==='food'?'%':it.kind==='sigil'?'?':it.kind==='armor'?'[':'/', ipx, ipy, it.kind==='mote'?AFF_COL[it.el]:'#E8B44A'); ctx.globalAlpha=1; }
    if(it.kind==='mote' && !ANIM.reduce){ ctx.save(); ctx.globalCompositeOperation='lighter'; ctx.globalAlpha=0.18+0.08*Math.sin(now/200+it.x); ctx.fillStyle=AFF_COL[it.el]; ctx.beginPath(); ctx.arc(ipx+TS/2,ipy+TS*0.58,TS*0.2,0,7); ctx.fill(); ctx.restore(); }
  });
  /* fire on the ground */
  for(y=camY;y<=camY+viewH;y++) for(x=camX;x<=camX+viewW;x++){
    if(!inb(x,y) || !fireT[idxOf(x,y)] || !(revealAll||vis[idxOf(x,y)])) continue;
    var fpx2=(x-camX)*TS, fpy2=(y-camY)*TS;
    /* 2026-09-20: Justin - the burning-ground flames read as too big; 70% of what they were */
    drawObj(objArt('terrain','fire-ground'), fpx2, fpy2 + (ANIM.reduce?0:Math.sin(now/90+x*5)*1.2), {fit:0.67, feet:true, sy: ANIM.reduce?0:0.08*Math.sin(now/70+y*3)});
    if(typeof emitFire==='function') emitFire(x,y);
  }

  /* ---- entities, back to front ---- */
  var list=ents.filter(function(e){ return e!==player && (revealAll||vis[idxOf(e.x,e.y)]||(e.foe && player && player.dawnUntil>turn)); }).sort(function(a,b){ return a.y-b.y; });
  function drawPlayer(){
    var poff=entOffset(player);
    atTile(prp.x,prp.y,function(px0,py0){
      var px=px0+poff[0]+shakeOf(player), py=py0+poff[1]-prp.hop*TS*0.10;
      ctx.globalAlpha=0.35; ctx.fillStyle='#000'; ctx.beginPath(); ctx.ellipse(px0+TS/2,py0+TS*0.9,TS*0.28,TS*0.1,0,0,7); ctx.fill(); ctx.globalAlpha=1;
      var fade = player.hidden>0 ? 0.5 : 1;
      var flip = player.face==='west';
      if(!drawCharacter(player, px, py, {alpha:fade, flip:flip, flash:flashOf(player), sliding:motionActive(player,now)})){
        ctx.globalAlpha=fade; ctx.fillStyle=player.col||'#E8B44A'; roundRect(px+TS*0.14,py+TS*0.1,TS*0.72,TS*0.72,TS*0.16); ctx.fill(); glyph('@',px,py,'#120F0D'); ctx.globalAlpha=1;
      }
      var shp = typeof playerShield==='function' ? playerShield() : 0;
      if(shp>0){ var pulseS=ANIM.reduce?0.5:0.5+0.5*Math.sin(now/400); ctx.save(); ctx.globalAlpha=0.18+0.12*pulseS+Math.min(0.2, shp/player.maxhp*0.4);
        var gS=ctx.createRadialGradient(px0+TS/2,py0+TS*0.55,TS*0.2,px0+TS/2,py0+TS*0.55,TS*0.62); gS.addColorStop(0,'rgba(150,215,255,0)'); gS.addColorStop(0.8,'rgba(150,215,255,0.35)'); gS.addColorStop(1,'rgba(200,235,255,0.9)');
        ctx.fillStyle=gS; ctx.beginPath(); ctx.ellipse(px0+TS/2,py0+TS*0.55,TS*0.5,TS*0.62,0,0,7); ctx.fill(); ctx.restore(); }
      if(player.stillness>0){ ctx.save(); ctx.globalAlpha=0.5; ctx.strokeStyle='#9FD8FF'; ctx.setLineDash([3,3]); ctx.beginPath(); ctx.ellipse(px0+TS/2,py0+TS*0.9,TS*0.36,TS*0.12,0,0,7); ctx.stroke(); ctx.restore(); }
      if(player.levitate>0){ ctx.globalAlpha=0.35; ctx.strokeStyle='#E8D27A'; ctx.beginPath(); ctx.ellipse(px0+TS/2,py0+TS*0.92,TS*0.3,TS*0.09,0,0,7); ctx.stroke(); ctx.globalAlpha=1; }
    });
  }
  list.forEach(function(e){
    standing(renderPos(e).y+1,function(){
    var off=entOffset(e), rp=renderPos(e);
    atTile(rp.x,rp.y,function(px0,py0){
      var px=px0+off[0]+shakeOf(e), py=py0+off[1]-rp.hop*TS*0.14 - (e.base.flying ? TS*0.12 + (ANIM.reduce?0:Math.sin(now/180+e.id)*TS*0.04) : 0);
      ctx.globalAlpha=0.35; ctx.fillStyle='#000'; ctx.beginPath(); ctx.ellipse(px0+TS/2,py0+TS*0.9,TS*0.26*(e.base.art||0.9),TS*0.09,0,0,7); ctx.fill(); ctx.globalAlpha=1;
      var flip = e.ally && typeof e.facingLeft==='boolean' ? e.facingLeft : player.x < e.x;
      if(e.base && e.base.artLeft) flip = !flip;   /* art painted facing left (goblin) */
      if(!drawCharacter(e, px, py, {flip:flip, flash:flashOf(e), breath:breathOf(e), outline:e.foe && !!vis[idxOf(e.x,e.y)]})){
        var bb=breathOf(e)*TS*0.6;
        ctx.fillStyle=e.col; roundRect(px+TS*0.14,py+TS*0.1-bb,TS*0.72,TS*0.72+bb,TS*0.16); ctx.fill(); glyph(e.ch,px,py,'#120F0D');
      }
      if(e.ally){ ctx.strokeStyle='#7FD08A'; ctx.lineWidth=2; ctx.beginPath(); ctx.ellipse(px0+TS/2,py0+TS*0.9,TS*0.34,TS*0.12,0,0,7); ctx.stroke(); ctx.lineWidth=1; }
      /* health bar only once hurt, or always for bosses */
      /* 2026-09-19: a boss has the bar across the top of the screen (ui.js bossBar) - no second one over its head */
      if(e.hp<e.maxhp && !(e.base && e.base.boss)){
        /* 2026-09-19: Justin - "the Matron's hp bar is on her waist". A big creature is drawn taller than its own
           tile, so the bar goes above what is actually drawn, and spans its whole footprint. */
        var bigN=(e.base && e.base.big) || 1, bScale=(e.base && e.base.bigScale) || 1;
        var artH=(e.base && e.base.art) || 0.9;                    /* tall art (the Matron stands 2.1 tiles) */
        var lift=Math.max(bigN*bScale>1 ? TS*(bigN*0.98*bScale-bigN) : 0, artH>1 ? TS*(artH-1) : 0);
        var barW=TS*0.76*bigN, barX=px0+TS*0.12*bigN;
        var barY=py0-TS*0.02-lift;
        ctx.fillStyle='rgba(0,0,0,.7)'; ctx.fillRect(barX,barY,barW,3);
        ctx.fillStyle = e.ally ? '#7FD08A' : e.hp/e.maxhp>0.5 ? '#C7B04F' : '#C7503F';
        ctx.fillRect(barX,barY,barW*clamp(e.hp/e.maxhp,0,1),3);
      }
      var ix=px0+TS*0.02;
      if(e.surprised && e.foe) { mark('!',px0+TS*0.78,py0+TS*0.02,'#FFD24A'); }
      if(e.state==='asleep') { mark('z',px0+TS*0.78,py0+TS*0.08+(ANIM.reduce?0:Math.sin(now/400+e.id)*2),'#CFE0FF'); }
      if(e.keyholder){ drawObj(objArt('items','item-key-iron'), px0+TS*0.52, py0-TS*0.34, {fit:0.4}); }
      /* 2026-09-20: Justin - "we need some art for conditions and not just a black placeholder symbol". The icons
         were drawn straight onto the scene, so a dark one over a dark creature read as a black box. Each sits on a
         small chip of its own colour now, with a dark rim, so it reads against anything. */
      (typeof statusList==='function'?statusList(e):[]).forEach(function(status){
        var k=status.k;
        var col=STATUS_CHIP[k]||'#C8C0B4', cx=ix+TS*0.1, cy=py0-TS*0.3+TS*0.15, rr=TS*0.115;
        ctx.save();
        ctx.fillStyle='rgba(10,8,6,0.85)'; ctx.beginPath(); ctx.arc(cx, cy, rr*1.25, 0, 7); ctx.fill();
        ctx.fillStyle=col; ctx.beginPath(); ctx.arc(cx, cy, rr, 0, 7); ctx.fill();
        ctx.restore();
        if(!drawObj(objArt('icons',status.icon||'st-'+k), cx-TS/2, cy-TS/2, {fit:0.26})){
          ctx.save();
          ctx.fillStyle='#120F0D'; ctx.font='600 '+Math.max(7,Math.round(TS*0.2))+'px "IBM Plex Mono",monospace';
          ctx.textAlign='center'; ctx.textBaseline='middle';
          ctx.fillText(k.charAt(0).toUpperCase(),cx,cy);
          ctx.restore();
        }
        ix+=TS*0.24;
      });
    });
  });
    });
  standing(prp.y+1,drawPlayer);
  upright.sort(function(a,b){return a.row-b.row || a.order-b.order;}).forEach(function(c){c.paint();});

  /* tall grass sits on top: its front blades are drawn over everything standing on the tile */
  for(y=camY;y<=camY+viewH;y++) for(x=camX;x<=camX+viewW;x++){
    if(!inb(x,y)) continue; var fgi=idxOf(x,y); if(ground[fgi]!==G_GRASS || !(revealAll||seen[fgi])) continue;
    drawGrassTile(x, y, (x-camX)*TS, (y-camY)*TS, (revealAll||vis[fgi])?1:memA(0.4), 'front', now);
  }

  if(lightingOn()) drawLightmap(now, prp);
  drawLights();
  drawBeacons(now);

  /* ---- aiming ---- */
  if(aiming){
    var A=aiming.A, reach = A.kind==='dash' ? 3 : spellRange(A);
    for(var ty=camY;ty<camY+viewH+1;ty++) for(var tx=camX;tx<camX+viewW+1;tx++){
      if(dist(player,{x:tx,y:ty})>reach || (tx===player.x&&ty===player.y)) continue;
      if(!inb(tx,ty) || !(revealAll||vis[idxOf(tx,ty)])) continue;
      atTile(tx,ty,function(px,py){ ctx.fillStyle='rgba(226,98,43,.10)'; ctx.fillRect(px,py,TS,TS); });
    }
    if(hoverX>=0){
      var ok=inRange(hoverX,hoverY);
      var onFoe=ents.some(function(e){ return e.foe && e.x===hoverX && e.y===hoverY; });
      if(A.kind==='summon' && ok && (!walkable(hoverX,hoverY) || occupied(hoverX,hoverY))) ok=false;
      var col = !ok ? '#B8453A' : (onFoe || A.kind==='dash' || A.kind==='summon' ? '#E8B44A' : '#8A7F74');
      atTile(hoverX,hoverY,function(px,py){
        ctx.strokeStyle=col; ctx.lineWidth=2; ctx.strokeRect(px+1,py+1,TS-2,TS-2);
        ctx.fillStyle = ok ? 'rgba(232,180,74,.16)' : 'rgba(184,69,58,.16)'; ctx.fillRect(px+1,py+1,TS-2,TS-2); ctx.lineWidth=1;
      });
      if(ok && typeof previewPath==='function') previewPath(player.x,player.y,hoverX,hoverY,A);
    }
  }
  drawFX();
  ctx.restore();

  /* screen-space: vignette */
  var vg=ctx.createRadialGradient(viewW*TS/2, viewH*TS/2, Math.min(viewW,viewH)*TS*0.35, viewW*TS/2, viewH*TS/2, Math.max(viewW,viewH)*TS*0.7);
  vg.addColorStop(0,'rgba(0,0,0,0)'); vg.addColorStop(1,'rgba(0,0,0,0.45)');
  ctx.fillStyle=vg; ctx.fillRect(0,0,viewW*TS,viewH*TS);
  drawStairsPointer(now);
}
