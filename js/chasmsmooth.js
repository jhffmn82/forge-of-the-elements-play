/* chasmsmooth.js - smooth chasm edges drawn in code (2026-09-19).
   The lip art from the Caverns pack was cut into quarter-tile pieces and stamped around every chasm cell: each
   piece carried its own patch of painted ground that never matched the floor, the joins showed as squares, and
   the edges were ragged. This replaces that with a chasm computed across the grid: a smooth field over the
   neighbouring chasm cells decides where the void is, wobbled by slow noise, so the edge flows in curves and
   rounds its corners. The void always fills its own cells (the renderer paints them black underneath) and
   bulges a little way out into the floor; the floor's real texture shows everywhere else. The rim is shaded in
   the floor's own colour: a lit lip, a cliff face falling away into the dark, a faint shadow on the ground.
   Floating debris still drifts over the void. Used in the Dungeon, the Crypt and the Caverns (not the planes). */
var CHS_R = 32;
function chsVoidCell(x, y){ if(!inb(x,y)) return false; var t=at(x,y); return t===CHASM || t===BRIDGE; }
function chsTint(){ return (typeof PT_MAT!=='undefined' && PT_MAT.cavern && PT_MAT.cavern.floor) || [90,86,82]; }
function chsRaster(x, y){
  var R=CHS_R, c=document.createElement('canvas'); c.width=R; c.height=R;
  var g=c.getContext('2d'), im=g.createImageData(R,R), D=im.data, T=chsTint(), salt=(typeof ptSalt==='function' ? ptSalt() : 7)+600;
  var own=chsVoidCell(x,y), any=false;
  for(var v=0; v<R; v++) for(var u=0; u<R; u++){
    var wx=x+(u+0.5)/R, wy=y+(v+0.5)/R, sum=0, wsum=0;
    for(var oy=-2;oy<=2;oy++) for(var ox=-2;ox<=2;ox++){
      var nx=x+ox, ny=y+oy, dx=wx-(nx+0.5), dy=wy-(ny+0.5), d=Math.sqrt(dx*dx+dy*dy), w=Math.max(0, 1-d/1.35);
      if(!w) continue; w*=w; wsum+=w; if(chsVoidCell(nx,ny)) sum+=w;
    }
    var f=wsum ? sum/wsum : 0;
    /* the edge sits between 0.3 and 0.5 of the field: never inside a chasm cell, up to a third of a tile out */
    /* 2026-09-19: broken, not smooth - ridged noise at two scales (the same idea as the cave walls) chips and
       notches the edge; it wanders up to about half a tile out into the floor */
    var r1=1-Math.abs(ptVal(wx*2.1, wy*2.1, salt+4)*2-1), r2=1-Math.abs(ptVal(wx*5.3, wy*5.3, salt+5)*2-1);
    var thr=0.36 + (ptVal(wx*0.9, wy*0.9, salt+1)-0.5)*0.16 + (r1-0.5)*0.2 + (r2-0.5)*0.1;
    var e=own ? Math.max(0.02, f-thr) : f-thr, p=(v*R+u)*4, col=null, a=0;
    if(e>0){
      /* the cliff face: floor-coloured rock under the lip, in strata and chipped ledges, falling into black */
      var k=Math.min(1, e/0.3), strata=ptVal(wx*2.5, wy*11, salt+3), chip=ptVal(wx*7, wy*7, salt+6);
      var sh=0.55*(1-k)*(strata<0.45 ? 0.72 : 1)*(chip>0.72 && k<0.55 ? 1.35 : 1);
      col=[T[0]*sh+4*k, T[1]*sh*0.97+4*k, T[2]*sh+7*k]; a=255;
    } else if(e>-0.03 && ptVal(wx*9, wy*9, salt+7)>0.3){ col=[Math.min(255,T[0]*1.22), Math.min(255,T[1]*1.2), Math.min(255,T[2]*1.18)]; a=200; }   /* the lit lip, broken up */
    else if(e>-0.07){ col=[T[0]*0.45, T[1]*0.43, T[2]*0.45]; a=Math.round(90*(1-(-e-0.022)/0.048)); }   /* a soft shadow on the ground */
    if(!col) continue;
    any=true; D[p]=col[0]; D[p+1]=col[1]; D[p+2]=col[2]; D[p+3]=a;
  }
  if(!any) return null;
  g.putImageData(im,0,0);
  return c;
}
function chsNear(x, y){ for(var oy=-1;oy<=1;oy++) for(var ox=-1;ox<=1;ox++) if(chsVoidCell(x+ox,y+oy)) return true; return false; }
function drawCaveChasms(now){
  var t=(typeof ANIM!=='undefined' && ANIM.reduce) ? 0 : now/1000, tag='chs'+bidx()+(floorMeta && floorMeta.plane ? 'p' : '')+'@';
  for(var y=camY-1; y<=camY+viewH+1; y++) for(var x=camX-1; x<=camX+viewW+1; x++){
    if(!inb(x,y) || !chsNear(x,y) || (isWallLike(at(x,y)) && !chsVoidCell(x,y))) continue;
    var i=idxOf(x,y); if(!(revealAll||seen[i])) continue;
    var px=(x-camX)*TS, py=(y-camY)*TS, a=(revealAll||vis[i]) ? 1 : memA(0.42);
    var sig=''; for(var oy=-2;oy<=2;oy++) for(var ox=-2;ox<=2;ox++) sig+=chsVoidCell(x+ox,y+oy)?'1':'0';
    blitRaster(cachedRaster(tag+sig+'#', x, y, chsRaster), px, py, a);
    /* the far depth and the floating debris, over whole chasm cells only */
    if(!chsVoidCell(x,y) || at(x,y)===BRIDGE) continue;
    var hd=hash2(x,y,701);
    if(hd<0.16 && typeof caveArt==='function'){
      var o=caveArt('ch-floating-debris-'+(1+Math.floor(hash2(x,y,703)*3)));
      if(o){ var bob=Math.sin(t*0.9+hd*40)*TS*0.04; drawCaveArt(o, px+TS*(0.25+0.5*hash2(x,y,704)), py+TS*(0.55+0.3*hash2(x,y,705))+bob, a*0.85, hash2(x,y,706)<0.5); }
    }
  }
  ctx.globalAlpha=1;
}
