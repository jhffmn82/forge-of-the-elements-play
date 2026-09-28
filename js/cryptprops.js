/* =====================================================================
   cryptprops.js - one consistent Crypt prop set (2026-09-17).
   The Crypt's props came from different sources with different detail, outline and shading: flat generated
   tombs, a gray skull pedestal, outlined 1-cell coffins, bright urns. This redraws the stone pieces from one
   pixel recipe at the game's source density (32 px a cell), in one weathered gray-violet palette, lit from the
   upper left, with a 1px dark outline like the storybook creatures:
     - sarcophagi, 2 cells long, lying north-south or east-west: stone thickness you can read, a recessed lid
       panel, restrained carving; intact, cracked, and open (lid pushed aside, dark inside)
     - pedestals: a plinth with cap and base, carrying a skull, an urn, or nothing (grave posts keep their wisps)
     - urn groups keep their approved arrangements; their vessels get the same outline and light treatment
   Gameplay footprints do not change: a piece blocks the cells it covers, as before.
   ===================================================================== */

var CP_PAL = {
  out:[16,13,22], deep:[36,32,48], faceLo:[46,42,60], face:[64,58,80], top:[122,114,140], topHi:[156,148,174],
  hi:[196,188,210], cut:[30,27,40], moss:[72,98,48], moss2:[92,118,58], inside:[14,12,20], bone:[206,198,176], boneLo:[150,142,126]
};
function cpNoise(x, y, s){ return hash2(x|0, y|0, s); }
function cpPut(D, W, x, y, c, a){ if(x<0||y<0||x>=W||y*W+x>=D.length/4) return; var p=(y*W+x)*4; D[p]=c[0]; D[p+1]=c[1]; D[p+2]=c[2]; D[p+3]=a===undefined?255:a; }
function cpShade(c, k){ return [c[0]*k, c[1]*k, c[2]*k]; }
function cpAdd(c, k){ return [c[0]+k, c[1]+k, c[2]+k*1.08]; }

/* ---------------------------------------------------------------- a stone box in three-quarter view
   footprint W x H px on the floor; the top (lid) is lifted by `lift` px and the front face shows below it */
function cpStoneBox(D, CW, x0, y0, W, H, lift, seed, opt){
  opt=opt||{};
  var P=CP_PAL;
  var topY=y0, topH=H-lift, faceY=y0+topH, faceH=lift;
  /* front face */
  for(var y=faceY; y<faceY+faceH; y++) for(var x=x0; x<x0+W; x++){
    var t=(y-faceY)/Math.max(1,faceH-1), g=(cpNoise(x,y,seed+1)-0.5)*10;
    var c=cpAdd(cpShade(P.face, 1-0.22*t), g);
    if(x===x0+W-1 || x===x0+W-2) c=cpShade(c,0.82);
    if(y===faceY) c=cpAdd(c, -14);                                   /* the shadow under the lid overhang */
    if(opt.moss && y>faceY+faceH-3 && cpNoise(x,y,seed+2)<0.35) c=cpNoise(x,y,seed+3)<0.5?P.moss:P.moss2;
    cpPut(D, CW, x, y, c);
  }
  /* top surface */
  for(var y2=topY; y2<topY+topH; y2++) for(var x2=x0; x2<x0+W; x2++){
    var g2=(cpNoise(x2,y2,seed+4)-0.5)*9 + (cpNoise(x2>>2,y2>>2,seed+5)-0.5)*8;
    var c2=cpAdd(P.top, g2 - (y2-topY)*0.35);
    var ex=x2-x0, ey=y2-topY;
    if(ex<=1 || ey<=1) c2=cpAdd(c2, ex===0||ey===0 ? 40 : 18);          /* lit lip */
    if(ex>=W-2 || ey>=topH-2) c2=cpAdd(c2, -26);
    c2=cpAdd(c2, -ex*0.25);
    cpPut(D, CW, x2, y2, c2);
  }
  /* recessed lid panel with restrained carving */
  if(opt.panel){
    var m=opt.panel, px0=x0+m, py0=topY+m, pw=W-2*m, ph=topH-2*m;
    for(var y3=py0; y3<py0+ph; y3++) for(var x3=px0; x3<px0+pw; x3++){
      var ex3=x3-px0, ey3=y3-py0, c3=cpAdd(P.top, (cpNoise(x3,y3,seed+6)-0.5)*7 - 8);
      if(ex3===0 || ey3===0) c3=P.deep;                                /* the recess edge in shadow (top/left) */
      else if(ex3===pw-1 || ey3===ph-1) c3=cpAdd(P.topHi, 6);          /* its far edge catches light */
      cpPut(D, CW, x3, y3, c3);
    }
    if(opt.carve==='cross'){
      var cx=px0+Math.floor(pw/2), cy=py0+Math.floor(ph*0.42), vl=Math.max(3, Math.floor(Math.min(ph,pw*2)*0.34)), hl=Math.max(2, Math.floor(pw*0.28));
      if(opt.horiz){ for(var k=-vl;k<=vl;k++){ cpPut(D,CW,cx+k,cy,P.cut); cpPut(D,CW,cx+k,cy+1,cpAdd(P.topHi,4)); } for(var k2=-hl;k2<=hl;k2++){ cpPut(D,CW,cx-Math.floor(vl*0.45),cy+k2,P.cut); cpPut(D,CW,cx-Math.floor(vl*0.45)+1,cy+k2,cpAdd(P.topHi,4)); } }
      else { for(var k3=-vl;k3<=vl;k3++){ cpPut(D,CW,cx,cy+k3,P.cut); cpPut(D,CW,cx+1,cy+k3,cpAdd(P.topHi,4)); } for(var k4=-hl;k4<=hl;k4++){ cpPut(D,CW,cx+k4,cy-Math.floor(vl*0.45),P.cut); cpPut(D,CW,cx+k4,cy-Math.floor(vl*0.45)+1,cpAdd(P.topHi,4)); } }
    }
  }
  /* outline */
  for(var y4=y0-1; y4<=y0+H; y4++) for(var x4=x0-1; x4<=x0+W; x4++){
    if(x4>=x0 && x4<x0+W && y4>=y0 && y4<y0+H) continue;
    cpPut(D, CW, x4, y4, P.out, (x4===x0-1||x4===x0+W)&&(y4===y0-1||y4===y0+H) ? 0 : 255);
  }
}
function cpCrack(D, CW, x, y, len, seed){
  var cx=x, cy=y;
  for(var i=0;i<len;i++){ cpPut(D, CW, cx, cy, CP_PAL.cut); cpPut(D, CW, cx+1, cy, cpAdd(CP_PAL.top,-6)); cx+= cpNoise(i,seed,11)<0.5 ? 1 : 0; cy+=1; if(cpNoise(i,seed,12)<0.2) cx-=1; }
}
function cpShadow(D, CW, x0, y0, W, H){   /* soft contact shadow to the lower right on the floor */
  for(var y=y0; y<y0+H+3; y++) for(var x=x0+2; x<x0+W+3; x++){ var p=(y*CW+x)*4; if(p<0 || p>=D.length || D[p+3]) continue; D[p]=8; D[p+1]=6; D[p+2]=14; D[p+3]=70; }
}

var CP_CACHE = {};
/* ---------------------------------------------------------------- the stone recipe, second pass
   Broad planes, a thick bevelled lid rim, a visible front face, a recessed motif, a few broad chips and worn
   corners; purple-gray edges, with the darkest values kept for the gap under a lid and the inside of an open tomb. */
var CS = {
  edge:[64,54,78], gap:[24,19,32], cavity:[18,14,26], cavityLo:[32,26,42],
  lidTop:[134,126,152], lidHi:[172,164,190], lidLo:[102,94,120], recess:[112,104,130], relief:[162,154,180], reliefLo:[82,74,100],
  lidFront:[112,104,130], face:[88,80,104], faceLo:[66,60,82], plinth:[74,68,90], plinthLo:[56,50,70],
  broken:[150,140,160], moss:[78,104,52], moss2:[98,124,62], bone:[206,198,176], boneLo:[150,142,126]
};
function csBuf(W,H){ return {W:W, H:H, c:new Array(W*H), a:new Uint8Array(W*H)}; }
function csSet(B,x,y,col){ x|=0; y|=0; if(x<0||y<0||x>=B.W||y>=B.H) return; B.c[y*B.W+x]=col; B.a[y*B.W+x]=1; }
function csClear(B,x,y){ x|=0; y|=0; if(x<0||y<0||x>=B.W||y>=B.H) return; B.a[y*B.W+x]=0; }
function csGet(B,x,y){ return (x<0||y<0||x>=B.W||y>=B.H) ? 0 : B.a[y*B.W+x]; }
function csMix(a,b,t){ return [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t]; }
function csStain(x,y,seed){ return (ptValG(x/9, y/9, seed)-0.5)*16; }   /* broad soft stains, not pixel noise */
function csTone(col,x,y,seed){ var k=csStain(x,y,seed); return [col[0]+k, col[1]+k, col[2]+k*1.1]; }
/* a rectangle with worn (clipped) corners */
function csRect(B,x0,y0,w,h,colFn,wear){
  for(var y=y0;y<y0+h;y++) for(var x=x0;x<x0+w;x++){
    var dx=Math.min(x-x0, x0+w-1-x), dy=Math.min(y-y0, y0+h-1-y);
    if(wear && dx+dy<wear) continue;
    csSet(B,x,y,colFn(x,y,x-x0,y-y0,w,h));
  }
}
/* a broad chip: a triangular bite out of an edge, its broken face catching light */
function csChip(B,cx,cy,r,dirx,diry){
  for(var y=cy-r;y<=cy+r;y++) for(var x=cx-r;x<=cx+r;x++){
    var d=Math.abs(x-cx)+Math.abs(y-cy); if(d>r) continue;
    if((x-cx)*dirx+(y-cy)*diry < -r*0.2) continue;
    csClear(B,x,y);
  }
  for(var y2=cy-r-1;y2<=cy+r+1;y2++) for(var x2=cx-r-1;x2<=cx+r+1;x2++){
    if(!csGet(B,x2,y2)) continue;
    var nb=!csGet(B,x2-dirx,y2-diry);
    if(nb && Math.abs(x2-cx)+Math.abs(y2-cy)<=r+1) csSet(B,x2,y2,CS.broken);
  }
}
function csWeather(B, seed, amount){
  /* grime where water and dirt would really collect: under lid overhangs, in cracks and chips, along the bottom edge,
     joined into uneven stains with a few short downward streaks; the upper bevels stay mostly clean */
  var GRIME=[54,52,48], MOSS=[72,98,50], MOSSD=[52,74,40];
  var W=B.W, H=B.H, wet=new Float32Array(W*H);
  var clean={}; [CS.lidHi, CS.lidTop, CS.relief, CS.reliefLo, CS.recess, CS.bone, CS.boneLo, CS.gap, CS.cavity, CS.cavityLo].forEach(function(c){ clean[c]=1; });
  for(var y=0;y<H;y++) for(var x=0;x<W;x++){
    var i=y*W+x; if(!B.a[i]) continue;
    var here=B.c[i];
    /* sources: the row under a gap or crack, the bottom edge of the piece */
    if(y>0 && B.a[i-W] && (B.c[i-W]===CS.gap) && here!==CS.gap){
      var len=1+Math.floor(ptValG(x/2.5, 3, seed+40)*3.2) + (ptValG(x/1.3, 7, seed+41)>0.78 ? 3+Math.floor(ptValG(x,9,seed+42)*3) : 0);   /* a band, now and then a streak */
      for(var k=0;k<len && y+k<H;k++){ var j=i+k*W; if(!B.a[j] || B.c[j]===CS.gap) break; wet[j]=Math.max(wet[j], (1-k/(len+1))*(0.55+0.45*ptValG(x/3,y/3,seed+43))); }
    }
    if(!csGet(B,x,y+1) || !csGet(B,x,y+2)){
      var up=1+Math.floor(ptValG(x/3, 1, seed+44)*3.5);
      for(var k2=0;k2<up && y-k2>=0;k2++){ var j2=i-k2*W; if(!B.a[j2]) break; wet[j2]=Math.max(wet[j2], (1-k2/(up+1))*0.8); }
    }
    if(here===CS.broken){ wet[i]=Math.max(wet[i],0.5); }
  }
  for(var y2=0;y2<H;y2++) for(var x2=0;x2<W;x2++){
    var i2=y2*W+x2, w=wet[i2]*amount; if(!B.a[i2] || w<0.12) continue;
    var col=B.c[i2]; if(col===CS.gap || col===CS.cavity || col===CS.bone || col===CS.boneLo) continue;
    if(clean[col] && y2 < H*0.5) w*=0.25;                                   /* keep the lit top shapes readable */
    var k3=Math.min(0.6, w*0.7);
    col=[col[0]+(GRIME[0]-col[0])*k3, col[1]+(GRIME[1]-col[1])*k3, col[2]+(GRIME[2]-col[2])*k3];
    /* where it is wettest, moss takes hold as part of the stain, not as separate dots */
    if(w>0.62 && ptValG(x2/2.2, y2/2.2, seed+45)>0.5) col = ptValG(x2/1.4, y2/1.4, seed+46)>0.5 ? MOSS : MOSSD;
    B.c[i2]=col;
  }
}
function csFinish(B, seed, shadow){
  var c=document.createElement('canvas'); c.width=B.W; c.height=B.H; var g=c.getContext('2d'), im=g.createImageData(B.W,B.H), D=im.data;
  for(var y=0;y<B.H;y++) for(var x=0;x<B.W;x++){
    var i=y*B.W+x, p=i*4;
    if(B.a[i]){
      var col=B.c[i];
      var out=!csGet(B,x-1,y)||!csGet(B,x+1,y)||!csGet(B,x,y-1)||!csGet(B,x,y+1);
      if(out && col!==CS.gap && col!==CS.cavity) col=CS.edge;
      D[p]=col[0]; D[p+1]=col[1]; D[p+2]=col[2]; D[p+3]=255;
    } else if(shadow && y>=shadow.y0 && y<=shadow.y1 && x>=shadow.x0 && x<=shadow.x1 && (csGet(B,x-2,y-1)||csGet(B,x-1,y-2))){
      D[p]=10; D[p+1]=8; D[p+2]=16; D[p+3]=80;
    }
  }
  g.putImageData(im,0,0); return c;
}
function csMotif(B, cx, cy, kind, horiz){
  function relief(x,y){ csSet(B,x,y,CS.relief); if(!csGet(B,x+1,y+1)||true) csSet(B,x+1,y+1,CS.reliefLo); }
  if(kind==='cross'){
    var L=horiz?7:9, A=horiz?3:3;
    if(horiz){ for(var k=-L;k<=L;k++){ csSet(B,cx+k,cy,CS.relief); csSet(B,cx+k,cy+1,CS.reliefLo); } for(var j=-A;j<=A;j++){ csSet(B,cx-3,cy+j,CS.relief); csSet(B,cx-2,cy+j,CS.reliefLo); } }
    else { for(var k2=-L;k2<=L;k2++){ csSet(B,cx,cy+k2,CS.relief); csSet(B,cx+1,cy+k2,CS.reliefLo); } for(var j2=-A;j2<=A;j2++){ csSet(B,cx+j2,cy-3,CS.relief); csSet(B,cx+j2,cy-2,CS.reliefLo); } }
  } else if(kind==='skull'){
    for(var y=-3;y<=2;y++) for(var x=-3;x<=3;x++){ if(x*x/9+y*y/(y<0?9:5)>1) continue; csSet(B,cx+x,cy+y, (x<0&&y<0)?CS.relief:csMix(CS.relief,CS.recess,0.4)); }
    csSet(B,cx-1,cy,CS.reliefLo); csSet(B,cx+1,cy,CS.reliefLo); csSet(B,cx,cy+2,CS.reliefLo);
  } else if(kind==='ring'){
    for(var t=0;t<24;t++){ var an=t/24*Math.PI*2, rx=cx+Math.round(Math.cos(an)*4), ry=cy+Math.round(Math.sin(an)*3); csSet(B,rx,ry, Math.sin(an)<0 ? CS.relief : CS.reliefLo); }
    csSet(B,cx,cy,CS.relief);
  }
}
/* kind: intact | cracked | open ; horiz: east-west (2x1) or north-south (1x2) */
function cpSarcophagus(kind, horiz, seed){
  var key='S2'+kind+(horiz?'h':'v')+seed; if(CP_CACHE[key]) return CP_CACHE[key];
  var r=mulberry32(seed*9973+17), W=horiz?64:32, H=horiz?44:74;
  var B=csBuf(W,H);
  var shrink=Math.floor(r()*4), lidT=3+Math.floor(r()*2);
  /* body box: footprint rectangle for the lid top, the front face below it */
  var lx0=horiz?3+shrink:3, lx1=horiz?60-shrink:28;           /* lid x span */
  var ly0=horiz?8:8, ly1=horiz?26:56+(shrink>2?-2:0);          /* lid top y span */
  var faceH=horiz?12:12;
  var fx0=lx0+2, fx1=lx1-2, fy0=ly1+lidT, fy1=fy0+faceH;       /* chest face */
  /* plinth */
  csRect(B, fx0-2, fy1-2, fx1-fx0+5, 5, function(x,y,ex,ey,w,h){ return csTone(ey<1?CS.plinth:CS.plinthLo,x,y,seed+1); }, 2);
  /* chest front face */
  csRect(B, fx0, fy0, fx1-fx0+1, faceH, function(x,y,ex,ey,w,h){ var c=csMix(CS.face, CS.faceLo, ey/h); if(ex>=w-3) c=csMix(c,CS.faceLo,0.6); return csTone(c,x,y,seed+2); }, 0);
  if(kind!=='open'){
    /* the gap under the lid: the darkest line on the piece */
    for(var gx=fx0; gx<=fx1; gx++) csSet(B, gx, fy0, CS.gap);
    /* lid front edge (its thickness) */
    csRect(B, lx0, ly1, lx1-lx0+1, lidT, function(x,y,ex,ey,w,h){ var c=ey===0?CS.lidHi:CS.lidFront; if(ex>=w-3) c=csMix(c,CS.lidLo,0.5); return csTone(c,x,y,seed+3); }, 1);
    /* lid top: a thick bevelled rim around a recessed field */
    var rim=horiz?4:4;
    csRect(B, lx0, ly0, lx1-lx0+1, ly1-ly0, function(x,y,ex,ey,w,h){
      var c=CS.lidTop;
      var inRim = ex<rim || ey<rim || ex>=w-rim || ey>=h-rim;
      if(inRim){ c = (ex<2 || ey<2) ? CS.lidHi : (ex>=w-2 || ey>=h-2) ? CS.lidLo : CS.lidTop; }
      else { c = (ex===rim || ey===rim) ? CS.lidLo : (ex===w-rim-1 || ey===h-rim-1) ? CS.lidHi : CS.recess; }
      return csTone(c,x,y,seed+4);
    }, 3);
    var mot=['cross','skull','ring','cross'][Math.floor(r()*4)];
    csMotif(B, Math.round((lx0+lx1)/2), Math.round((ly0+ly1)/2), mot, horiz);
    /* broad chips on corners and edges, a worn look instead of fine lines */
    var nch=1+Math.floor(r()*2)+(kind==='cracked'?2:0);
    for(var i=0;i<nch;i++){
      var side=Math.floor(r()*4), cx, cy, dx=0, dy=0, rr=2+Math.floor(r()*2)+(kind==='cracked'?1:0);
      if(side===0){ cx=lx0+4+Math.floor(r()*(lx1-lx0-8)); cy=ly0; dy=1; }
      else if(side===1){ cx=lx1; cy=ly0+4+Math.floor(r()*(ly1-ly0-8)); dx=-1; }
      else if(side===2){ cx=lx0; cy=ly0+4+Math.floor(r()*(ly1-ly0-8)); dx=1; }
      else { cx=lx0+4+Math.floor(r()*(lx1-lx0-8)); cy=ly1+lidT-1; dy=-1; }
      csChip(B,cx,cy,rr,dx,dy);
    }
    if(kind==='cracked'){
      /* a crack across the lid: dark line, lit lower edge, one shifted piece */
      var x=Math.round(lx0+(lx1-lx0)*(0.55+r()*0.15)), y=ly0+1, steps=(ly1-ly0)+lidT-1;
      for(var s2=0;s2<steps;s2++){ csSet(B,x,y,CS.gap); csSet(B,x+1,y,CS.lidHi); y++; if(r()<0.35) x+= r()<0.5?1:-1; }
    }
  } else {
    /* open: a thick stone rim round a dark cavity, and the lid shoved aside */
    csRect(B, lx0, ly0, lx1-lx0+1, (ly1-ly0)+lidT, function(x,y,ex,ey,w,h){
      var rimW=4, inRim = ex<rimW || ey<rimW || ex>=w-rimW || ey>=h-rimW;
      if(inRim) return csTone((ex<2||ey<2) ? CS.lidHi : (ex>=w-2||ey>=h-2) ? CS.lidLo : CS.lidTop, x,y,seed+5);
      var depth=(ey-rimW)/(h-2*rimW);
      return (ey===rimW || ex===rimW) ? CS.cavity : csMix(CS.cavity, CS.cavityLo, depth*0.8);
    }, 3);
    /* bones in the dark */
    var bx=Math.round(lx0+(lx1-lx0)*0.35), by=Math.round(ly0+(ly1-ly0)*0.55);
    if(horiz){ for(var k=0;k<8;k++) csSet(B,bx+k,by,CS.boneLo); csSet(B,bx-1,by-1,CS.bone); csSet(B,bx+8,by+1,CS.bone); csSet(B,bx+3,by-1,CS.bone); }
    else { for(var k2=0;k2<10;k2++) csSet(B,bx,by-5+k2,CS.boneLo); csSet(B,bx-1,by-6,CS.bone); csSet(B,bx+1,by+5,CS.bone); }
    csChip(B, lx0, Math.round((ly0+ly1)/2), 2, 1, 0);
    /* the displaced lid: a slab with its own thickness, skewed off one end, casting the darkest shadow */
    var sx0=horiz?Math.round(lx0+(lx1-lx0)*0.45):lx0+5, sx1=horiz?lx1+2:lx1+3, sy0=horiz?ly0-5:Math.round(ly0+(ly1-ly0)*0.45), sy1=horiz?ly1-4:ly1+2;
    if(sx1>=W) sx1=W-1;
    for(var gx2=sx0+1; gx2<=sx1; gx2++) csSet(B, gx2, sy1+lidT, CS.gap);
    csRect(B, sx0, sy1, sx1-sx0+1, lidT, function(x,y,ex,ey,w,h){ return csTone(ey===0?CS.lidHi:CS.lidFront,x,y,seed+6); }, 1);
    csRect(B, sx0, sy0, sx1-sx0+1, sy1-sy0, function(x,y,ex,ey,w,h){ var c=(ex<2||ey<2)?CS.lidHi:(ex>=w-2||ey>=h-2)?CS.lidLo:CS.lidTop; return csTone(c,x,y,seed+7); }, 2);
    csChip(B, sx0, sy0+2, 2, 1, 1);
  }
  /* coffin taper: narrow at the head, widest at the shoulders, narrowing to the foot */
  function prof(t){ return t<0.26 ? 0.74+0.26*(t/0.26) : 1-0.3*((t-0.26)/0.74); }
  if(!horiz){
    var cxm=(lx0+lx1)/2, half=(lx1-lx0)/2+2;
    for(var y3=0;y3<H;y3++){ var t3=Math.max(0,Math.min(1,(y3-ly0)/Math.max(1,(fy1-ly0)))), hw=half*prof(t3);
      for(var x3=0;x3<W;x3++){ if(Math.abs(x3+0.5-cxm)>hw) csClear(B,x3,y3); } }
  } else {
    var span=ly1-ly0;
    for(var x4=0;x4<W;x4++){ var t4=Math.max(0,Math.min(1,(x4-lx0)/Math.max(1,(lx1-lx0)))), inset=Math.round((1-prof(t4))*span*0.9);
      for(var y4=0;y4<ly0+inset && y4<H;y4++) csClear(B,x4,y4); }
  }
  csWeather(B, seed, kind==='intact' ? 0.8 : 1.2);
  var c=csFinish(B, seed, {x0:0, x1:W-1, y0:0, y1:H-1});
  c.lift = horiz ? 12/32 : 10/32;
  return (CP_CACHE[key]=c);
}
function cpPedestal(top, seed){
  var key='P2'+top+seed; if(CP_CACHE[key]) return CP_CACHE[key];
  var r=mulberry32(seed*7919+3), W=32, H=48, B=csBuf(W,H);
  /* plinth */
  csRect(B, 6, 40, 20, 6, function(x,y,ex,ey){ return csTone(ey<2?CS.lidTop:CS.plinth,x,y,seed); }, 2);
  /* shaft: a lit left plane, a shaded right plane, a recessed panel */
  csRect(B, 9, 20, 14, 21, function(x,y,ex,ey,w,h){ var c=ex<5?CS.lidFront:ex<10?CS.face:CS.faceLo; if(ex>=4&&ex<=9&&ey>=6&&ey<=14) c=(ey===6||ex===4)?CS.gap:csMix(CS.faceLo,CS.face,0.3); return csTone(c,x,y,seed+1); }, 1);
  /* cap: a thick bevelled slab */
  csRect(B, 6, 17, 20, 4, function(x,y,ex,ey,w,h){ return csTone(ey===0?CS.lidHi:CS.lidFront,x,y,seed+2); }, 1);
  csRect(B, 6, 11, 20, 6, function(x,y,ex,ey,w,h){ var c=(ex<2||ey<2)?CS.lidHi:(ex>=w-2||ey>=h-2)?CS.lidLo:CS.lidTop; return csTone(c,x,y,seed+3); }, 2);
  for(var gx=9; gx<=22; gx++) csSet(B, gx, 21, CS.gap);
  csChip(B, 6+Math.floor(r()*18), 11, 2, 0, 1); if(r()<0.6) csChip(B, 25, 30+Math.floor(r()*8), 2, -1, 0);
  if(top==='skull'){
    var sx=16, sy=8;
    for(var y=-4;y<=3;y++) for(var x=-4;x<=4;x++){ if(x*x/16+y*y/(y<0?14:8)>1) continue; csSet(B,sx+x,sy+y, (x<=0&&y<0)?CS.bone:CS.boneLo); }
    csSet(B,sx-2,sy,CS.gap); csSet(B,sx-1,sy,CS.gap); csSet(B,sx+1,sy,CS.gap); csSet(B,sx+2,sy,CS.gap); csSet(B,sx,sy+2,CS.faceLo);
    for(var t=-2;t<=2;t++) csSet(B,sx+t,sy+3,t%2?CS.faceLo:CS.boneLo);
  }
  csWeather(B, seed, 0.9);
  var c=csFinish(B, seed, {x0:0, x1:W-1, y0:0, y1:H-1});
  return (CP_CACHE[key]=c);
}
/* ---------------------------------------------------------------- wiring */
function cpOn(){ return typeof inCrypt==='function' && inCrypt() && !(floorMeta && floorMeta.plane); }
PROPS['sarc'] = {b:1};
PROPS['pedestal'] = {b:1};
/* the old one-cell coffins and sarcophagi become two-cell sarcophagi when there is room, else a pedestal */


/* generated tomb set pieces are drawn with the same recipe */
var CP_TOMB = {'tomb-v':['intact',false], 'tomb-h':['intact',true], 'tomb-rune':['intact',false], 'tomb-crumbled-v':['cracked',false], 'tomb-crumbled-h':['cracked',true], 'tomb-open-h':['open',true]};

function drawCryptStoneProp(p, px, py, alpha){
  if(cpOn()){
    var img=null, cw=1, ch=1, lift=0;
    if(p.name==='sarc'){ img=cpSarcophagus(p.kind||'intact', !!p.horiz, p.seed||0); cw=p.horiz?2:1; ch=p.horiz?1:2; lift=img.lift||0; }
    else if(CP_TOMB[p.name]){ var t=CP_TOMB[p.name]; img=cpSarcophagus(t[0], t[1], (p.x*7+p.y*3)%97); cw=t[1]?2:1; ch=t[1]?1:2; lift=img.lift||0; }
    else if(p.name==='pedestal'){ img=cpPedestal(p.top||'none', p.seed||0); lift=0.5; }
    if(img){
      var X=Math.round((p.x-camX)*TS), Y=Math.round((p.y-camY-lift)*TS);
      ctx.save(); ctx.globalAlpha=alpha; ctx.imageSmoothingEnabled=false;
      ctx.drawImage(img, 0, 0, img.width, img.height, X, Y, Math.round((p.x+cw-camX)*TS)-X, Math.round((p.y+ch-camY)*TS)-Math.round((p.y-camY)*TS) + Math.round(lift*TS));
      if(p.wisps && typeof drawSoulWisps==='function') drawSoulWisps(p, performance.now());
      ctx.restore();
      return true;
    }
  }
  return false;

}
/* grave posts (the wisp torches) become pedestals too, keeping their wisps and light */


/* ---------------------------------------------------------------- a small test room showing the whole set with creatures */
function buildCryptPropTest(){
  var W=MW, H=MH;
  map=new Uint8Array(W*H); seen=new Uint8Array(W*H); vis=new Uint8Array(W*H); ground=new Uint8Array(W*H); fireT=new Uint8Array(W*H);
  if(typeof fireSrc!=='undefined') fireSrc=new Uint8Array(W*H);
  propGrid=new Int16Array(W*H).fill(-1); props=[]; feats=[]; items=[]; ents=[player]; rooms=[]; chestKind={}; levers=[]; plates=null; altars={};
  floorMeta={floor:floorNo, biome:1, notes:[], ooze:{}, clouds:[], marks:[]};
  var ox=22, oy=11, rw=12, rh=10;
  for(var y=0;y<H;y++) for(var x=0;x<W;x++) map[idxOf(x,y)]=WALL;
  for(var y2=oy;y2<oy+rh;y2++) for(var x2=ox;x2<ox+rw;x2++) map[idxOf(x2,y2)]=FLOOR;
  rooms=[{x:ox,y:oy,w:rw,h:rh,cx:ox+6,cy:oy+5,id:0}];
  function P(a,b){ return {x:ox+a, y:oy+b}; }
  var q;
  q=P(1,1); addSetPiece(q.x,q.y,'sarc',2,1,{cp:true,kind:'intact',horiz:true,seed:3});
  q=P(4,1); addSetPiece(q.x,q.y,'sarc',2,1,{cp:true,kind:'cracked',horiz:true,seed:8});
  q=P(10,1); addSetPiece(q.x,q.y,'sarc',1,2,{cp:true,kind:'open',horiz:false,seed:5});
  q=P(0,4); addSetPiece(q.x,q.y,'sarc',1,2,{cp:true,kind:'intact',horiz:false,seed:11});
  q=P(7,0); addProp(q.x,q.y,'pedestal',{cp:true,top:'skull',seed:2});
  q=P(8,0); addProp(q.x,q.y,'pedestal',{cp:true,top:'none',seed:4, wisps:true, light:'#7CFFA0', dim:1});
  q=P(11,5); addProp(q.x,q.y,'pedestal',{cp:true,top:'skull',seed:9});
  [[11,8,0],[0,8,4],[6,9,5],[11,3,2]].forEach(function(u){ var c=P(u[0],u[1]), e=urnGroupExtra(); e.pattern=u[2]; addProp(c.x,c.y,'urn-group',e); });
  [[3,6],[4,6],[4,7],[5,7],[3,7],[5,8]].forEach(function(o){ var c=P(o[0],o[1]); floorMeta.ooze[idxOf(c.x,c.y)]=1; });
  [[8,6],[9,6],[9,7],[8,7],[10,7]].forEach(function(o){ var c=P(o[0],o[1]); ground[idxOf(c.x,c.y)]=G_GRASS; });
  var m;
  q=P(4,4); m=spawn('skeleton',q.x,q.y); m.state='asleep';
  q=P(7,5); m=spawn('acolyte',q.x,q.y); m.state='asleep';
  q=P(2,7); m=spawn('shambler',q.x,q.y); m.state='asleep';
  q=P(9,4); m=spawn('bonearcher',q.x,q.y); m.state='asleep';
  player.x=ox+6; player.y=oy+7; player._lx=undefined;
  for(var j=0;j<seen.length;j++) seen[j]=1;
}

/* ---------------------------------------------------------------- tight spaces get fewer, smaller pieces
   A corridor or a cramped burial chamber keeps the same palette and prop scale, but two-cell sarcophagi never
   block a corridor and clutter thins out, so narrow routes stay readable and walkable. */



/* ---------------------------------------------------------------- straw beds lie against walls, in rows
   A single bed in the middle of a room read as a stray object; a prison or barracks lays them head to the wall. */


/* ---------------------------------------------------------------- nothing a prop does may seal off part of a floor
   Two-cell sarcophagi, urn groups and crate stacks all block. If one of them cuts a region off, it is moved to a free
   spot in the same room, and removed only if there is nowhere to put it. Doors, keys and levers still gate as designed:
   this compares reachability with props against reachability without them, so only prop-caused blockage is touched. */
function propsKeepOpen(){
  function reach(ignoreProps){
    if(ignoreProps) props.forEach(function(p){ if(p.b){ p._bSave=1; p.b=0; } });
    if(ignoreProps) rebuildPropGrid();
    var d=bfsFrom(player.x, player.y);
    if(ignoreProps){ props.forEach(function(p){ if(p._bSave){ p.b=1; delete p._bSave; } }); rebuildPropGrid(); }
    return d;
  }
  for(var pass=0; pass<12; pass++){
    var withProps=reach(false), without=reach(true), bad=null;
    for(var i=0;i<map.length && !bad;i++){ var x=i%MW, y=(i/MW)|0; if(!walkable(x,y)) continue; if(withProps[i]<0 && without[i]>=0) bad={x:x,y:y}; }
    if(!bad) return;
    var blockers=props.filter(function(p){ return p.b; })
                      .sort(function(a,b){ return (Math.abs(a.x-bad.x)+Math.abs(a.y-bad.y))-(Math.abs(b.x-bad.x)+Math.abs(b.y-bad.y)); });
    var p=blockers[0]; if(!p) return;
    /* try to move it elsewhere in its own room first */
    var r=roomAt(p.x,p.y), moved=false;
    if(r){
      var spots=shuffled(edgeCells(r).concat(interiorCells(r)));
      for(var k=0;k<spots.length && !moved;k++){
        var c=spots[k], ok=true;
        for(var yy=c.y; yy<c.y+(p.h||1) && ok; yy++) for(var xx=c.x; xx<c.x+(p.w||1); xx++){
          var q=propAt(xx,yy);
          if(!freeCell(xx,yy) && !(q===p)) { ok=false; break; }
          if(nearDoor(xx,yy)) { ok=false; break; }
        }
        if(!ok) continue;
        var ox=p.x, oy=p.y; p.x=c.x; p.y=c.y; rebuildPropGrid();
        var d2=bfsFrom(player.x,player.y), still=false;
        for(var j=0;j<map.length && !still;j++){ if(walkable(j%MW,(j/MW)|0) && d2[j]<0 && without[j]>=0) still=true; }
        if(!still) moved=true; else { p.x=ox; p.y=oy; rebuildPropGrid(); }
      }
    }
    if(!moved) removeProp(p);
  }
}

/* Named floor-generation stages; ordered by generation-adapter.js. */
function openGeneratedCryptPaths(seed){

  if(floorMeta && !floorMeta.plane) propsKeepOpen();
}
