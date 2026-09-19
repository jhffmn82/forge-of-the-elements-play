/* =====================================================================
   planeterrain.js - purpose-built plane terrain (2026-09-17, Plane of Light first).
   The Light plane used to reuse the dungeon's surface renderer with yellow textures: a rectangular paving grid,
   dark rounded cobble walls, moss, drains and capstone rims. It read as a yellow dungeon. This replaces all of
   that on plane floors with terrain drawn from world coordinates, per cell, into cached 32px rasters:
     1. floor: broad irregular limestone slabs, quiet joints (not every slab is outlined), cream/lavender drift;
     2. walls: angular faceted rock masses whose outline follows the wall grid's connectivity (facets decide the
        boundary, so corners, ends and narrow passages come out of the neighbourhood, never at random); a cliff face
        where a mass meets open ground to its south, with a pale lip;
     3. floor-to-wall transition: soft occlusion in the floor next to rock;
     4. overlays that cross cell edges: thin gold veins, rare luminous mineral patches;
     5. crystals set into cliff faces (their glow goes to the lighting system, nothing baked).
   Gameplay tiles, collision and lighting are unchanged; only the drawing is. Everything is deterministic from
   world position and the floor seed, so nothing shifts when the camera moves.
   Rasters are built a few per frame; a cell not built yet draws its flat material colour.
   ===================================================================== */

var PT_R = 32;                               /* raster pixels per cell */
var PT_MAT = {
  light: {
    /* pearl and ivory stone with cool lavender minerals; gold only in veins, markings and crystal bases; a little pale cyan */
    floor:[234,230,220], floorLav:[216,214,226], jointCol:[190,186,188], joint:0.4, grain:0.016, occ:[176,170,178],
    mineralCool:[200,200,218], pearl:[244,242,238], band:[226,224,230],
    top:[222,218,210], topHi:[242,240,234], topLo:[186,182,186], topLav:[206,204,220], edge:[122,116,124],
    face:[204,198,192], faceLo:[152,146,152], faceH:0.8, lip:[248,246,240],
    void:[6,7,11], voidEdge:[34,34,44],
    vein:[216,176,88], veinHot:[255,246,214], veinDark:[124,96,44], inlay:[240,238,232], inlayJoint:[196,192,194], polish:[242,240,236],
    pool:[78,178,204], poolEdge:[128,222,214], poolRim:[236,252,248], poolShelf:[196,222,222], poolShallow:[176,232,224], poolShelfDry:[222,218,214], poolWet:[196,200,212], poolLight:'#B8F0FF',
    crystal:['#FFFFFF','#EEF2F8','#C9CCE0','#9FDDEA'], crystalGold:'#D8AE52', crystalLight:'#F4F0FF', fill:'#FFF6E4',
    rockHi:'#EEEAE4', rockMid:'#D6D0CC', rockLo:'#AAA4AC', rockEdge:'#7C7684', motif:'sun'
  },
  shadow: {
    /* violet-black rock, dark slate floors, violet crystal light, a still void pool */
    floor:[74,64,92], floorLav:[62,54,82], jointCol:[44,38,58], joint:0.45, grain:0.02, occ:[38,32,50],
    mineralCool:[86,74,112], pearl:[104,92,132], band:[90,80,116],
    top:[70,60,88], topHi:[104,92,128], topLo:[46,40,60], topLav:[84,72,110], edge:[24,20,32],
    face:[62,54,78], faceLo:[36,31,46], faceH:0.8, lip:[124,110,152],
    void:[6,5,10], voidEdge:[26,22,34],
    vein:[168,120,232], veinHot:[236,214,255], veinDark:[84,52,126], inlay:[96,84,124], inlayJoint:[56,48,72], polish:[104,92,132],
    pool:[40,22,84], poolEdge:[86,56,150], poolShallow:[74,48,130], poolRim:[196,168,255], poolShelf:[70,60,90], poolShelfDry:[84,74,106], poolWet:[56,48,74], poolLight:'#B98CFF',
    crystal:['#F0E2FF','#D2B4FF','#9E7AD8','#7A4FE0'], crystalGold:'#7A4FE0', crystalLight:'#C9B2FF', fill:'#A48CE0',
    rockHi:'#8C7CA8', rockMid:'#6A5C86', rockLo:'#463C5C', rockEdge:'#241E30', motif:'moon'
  },
  earth: {
    /* warm brown rock and packed dirt, moss, glowing mushroom light, a still green pool */
    floor:[150,128,96], floorLav:[136,120,96], jointCol:[96,80,58], joint:0.5, grain:0.026, occ:[90,76,56],
    mineralCool:[132,126,98], pearl:[168,150,114], band:[146,132,100],
    top:[118,100,72], topHi:[156,136,100], topLo:[86,72,52], topLav:[120,112,84], edge:[46,38,26],
    face:[108,92,66], faceLo:[70,58,42], faceH:0.8, lip:[176,156,118],
    void:[9,8,6], voidEdge:[34,30,22],
    vein:[120,158,70], veinHot:[212,240,168], veinDark:[62,84,38], inlay:[160,144,112], inlayJoint:[96,84,62], polish:[168,152,118],
    pool:[46,96,84], poolEdge:[96,152,116], poolShallow:[120,168,128], poolRim:[196,226,186], poolShelf:[124,112,86], poolShelfDry:[140,126,96], poolWet:[96,86,66], poolLight:'#BFEE8A',
    crystal:['#E8F2C8','#C6DC94','#94AE62','#6E8C46'], crystalGold:'#8CA84E', crystalLight:'#D8F0A0', fill:'#D8C79A',
    moss:[[70,104,44],[92,126,54],[54,84,38],[112,142,68]],
    rockHi:'#C8B48C', rockMid:'#A8926A', rockLo:'#7A6648', rockEdge:'#3A3022', motif:'leaf'
  }
};
function ptMat(){ return floorMeta && floorMeta.plane && PT_MAT[floorMeta.plane] || null; }
function ptSalt(){ return (typeof surfSalt==='function' ? surfSalt() : floorNo*31) + 911; }

/* ---------------------------------------------------------------- noise in world space */
function ptVal(wx, wy, s){   /* smooth value noise, one lattice unit = one tile */
  var x0=Math.floor(wx), y0=Math.floor(wy), fx=wx-x0, fy=wy-y0;
  fx=fx*fx*(3-2*fx); fy=fy*fy*(3-2*fy);
  var a=hash2(x0,y0,s), b=hash2(x0+1,y0,s), c=hash2(x0,y0+1,s), d=hash2(x0+1,y0+1,s);
  return a+(b-a)*fx+(c-a)*fy+(a-b-c+d)*fx*fy;
}
/* Voronoi at a given scale: nearest and second-nearest seed, and the nearest seed's lattice id */
function ptVor(wx, wy, scale, s){
  var gx=wx/scale, gy=wy/scale, cx=Math.floor(gx), cy=Math.floor(gy), d1=9, d2=9, ix=0, iy=0, sx=0, sy=0;
  for(var oy=-1;oy<=1;oy++) for(var ox=-1;ox<=1;ox++){
    var lx=cx+ox, ly=cy+oy, px=lx+0.15+0.7*hash2(lx,ly,s), py=ly+0.15+0.7*hash2(lx,ly,s+1);
    var dx=gx-px, dy=gy-py, d=dx*dx+dy*dy;
    if(d<d1){ d2=d1; d1=d; ix=lx; iy=ly; sx=px*scale; sy=py*scale; } else if(d<d2) d2=d;
  }
  return {d1:Math.sqrt(d1)*scale, d2:Math.sqrt(d2)*scale, ix:ix, iy:iy, sx:sx, sy:sy};
}

/* ---------------------------------------------------------------- the solid mask and the rock band */
function ptWallCell(x, y){ return !inb(x,y) || isWallLike(at(x,y)); }
/* distance in cells from each wall cell to the nearest open cell (Chebyshev), per floor */
function ptDist(){
  var c=ptCacheObj(); if(c.dist) return c.dist;
  var d=new Uint8Array(MW*MH).fill(255), q=[];
  for(var y=0;y<MH;y++) for(var x=0;x<MW;x++) if(!ptWallCell(x,y)){ d[idxOf(x,y)]=0; q.push(x,y); }
  for(var h=0; h<q.length; h+=2){
    var qx=q[h], qy=q[h+1], nd=d[idxOf(qx,qy)]+1; if(nd>6) continue;
    for(var oy=-1;oy<=1;oy++) for(var ox=-1;ox<=1;ox++){ var nx=qx+ox, ny=qy+oy; if(!inb(nx,ny)) continue; var k=idxOf(nx,ny); if(d[k]>nd){ d[k]=nd; q.push(nx,ny); } }
  }
  c.dist=d; return d;
}
function ptCellDist(x,y){ return inb(x,y) ? ptDist()[idxOf(x,y)] : 255; }
function ptSolid(wx, wy, salt){
  var cx=Math.floor(wx), cy=Math.floor(wy), own=ptWallCell(cx,cy);
  var fx=wx-cx, fy=wy-cy;
  var same=true;
  for(var oy=-1;oy<=1 && same;oy++) for(var ox=-1;ox<=1;ox++) if(ptWallCell(cx+ox,cy+oy)!==own){ same=false; break; }
  if(same) return own;
  /* near a boundary: a smooth weighted field over the surrounding cells, gently wobbled, so rock forms large
     connected masses with clean inside and outside corners and never leaves slivers or detached bits */
  var sum=0, wsum=0;
  for(var oy2=-2;oy2<=2;oy2++) for(var ox2=-2;ox2<=2;ox2++){
    var nx=cx+ox2, ny=cy+oy2, dx=wx-(nx+0.5), dy=wy-(ny+0.5), d=Math.sqrt(dx*dx+dy*dy), w=Math.max(0, 1-d/1.35);
    if(!w) continue; w*=w; wsum+=w; if(ptWallCell(nx,ny)) sum+=w;
  }
  var f=wsum ? sum/wsum : (own?1:0);
  var sld = f > 0.5 + (ptVal(wx*0.85, wy*0.85, salt+3)-0.5)*0.34 + (ptVal(wx*2.3, wy*2.3, salt+4)-0.5)*0.1;
  var rc=Math.sqrt((fx-0.5)*(fx-0.5)+(fy-0.5)*(fy-0.5));
  if(!own && sld && rc<0.3) return false;   /* open cells keep a round walkable core */
  if(own && !sld && rc<0.26) return true;
  return sld;
}
/* 0 = open floor, 1 = rock formation, 2 = the dark beyond (rock far from any open ground) */
function ptKind(wx, wy, salt){
  if(!ptSolid(wx, wy, salt)) return 0;
  var cx=Math.floor(wx), cy=Math.floor(wy), best=9;
  for(var oy=-2;oy<=2;oy++) for(var ox=-2;ox<=2;ox++){
    var nx=cx+ox, ny=cy+oy; if(ptCellDist(nx,ny)!==0) continue;
    var dx=Math.max(nx-wx, 0, wx-(nx+1)), dy=Math.max(ny-wy, 0, wy-(ny+1)); var dd=Math.sqrt(dx*dx+dy*dy); if(dd<best) best=dd;
  }
  /* the formation band keeps a steady depth, its back edge gently uneven */
  var band=1.45 + (ptVal(wx*0.6, wy*0.6, salt+5)-0.5)*0.4;
  return best<band ? 1 : 2;
}

/* ---------------------------------------------------------------- one cell */
function ptMix(a, b, t){ return [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t]; }
function ptCellRaster(x, y){
  var M=ptMat(); if(!M) return null;
  var R=PT_R, salt=ptSalt(), c=document.createElement('canvas'); c.width=R; c.height=R;
  var g=c.getContext('2d'), im=g.createImageData(R,R), D=im.data;
  var FACEP=Math.round(M.faceH*R), step=1/R;
  var MH2=R+FACEP+2, kind=new Uint8Array(R*MH2), kcache={};
  for(var v=-1; v<MH2; v++) for(var u=-1; u<=R; u++){ var k2=ptKind(x+(u+0.5)*step, y+(v+0.5)*step, salt); if(u>=0 && u<R && v>=0) kind[v*R+u]=k2; else kcache[u+','+v]=k2; }
  function K0(u,v){ if(u>=0 && u<R && v>=0 && v<MH2) return kind[v*R+u]; var key=u+','+v; if(!(key in kcache)) kcache[key]=ptKind(x+(u+0.5)*step, y+(v+0.5)*step, salt); return kcache[key]; }
  function K(u,v){ var k0=K0(u,v); if(k0===1){ if((K0(u-1,v)===0 && K0(u+1,v)===0) || (K0(u,v-1)===0 && K0(u,v+1)===0) || (K0(u-2,v)===0 && K0(u+2,v)===0 && K0(u,v-1)===0)) return 0; } return k0; }
  for(var v2=0; v2<R; v2++) for(var u2=0; u2<R; u2++){
    var wx=x+(u2+0.5)*step, wy=y+(v2+0.5)*step, p=(v2*R+u2)*4, col, kk=K(u2,v2);
    if(kk===2){
      col=M.void;
      if(K(u2,v2+1)===1 || K(u2-1,v2)===1 || K(u2+1,v2)===1 || K(u2,v2-1)===1) col=M.voidEdge;
    } else if(kk===1){
      var dn=-1;
      for(var k=1;k<=FACEP;k++){ if(K(u2, v2+k)===0){ dn=k; break; } }
      if(dn>0){
        /* cliff face: tall narrow facets, pale at the lip, deepening to the foot */
        var depth=dn/FACEP, cf=ptVor(wx*2.2, wy*0.55, 0.55, salt+21), shade=0.86+0.2*hash2(cf.ix,cf.iy,salt+22);
        col=ptMix(M.faceLo, M.face, Math.min(1, depth*1.1));
        col=[col[0]*shade, col[1]*shade, col[2]*shade];
        if(cf.d2-cf.d1<0.03) col=ptMix(col, M.faceLo, 0.3);
        var fv=ptVor(wx*1.6, wy*0.9, 0.9, salt+23), fmk=ptVal(wx*0.24, wy*0.24, salt+20);
        if(fmk>0.57 && fv.d2-fv.d1<0.026){
          var fw=fv.d2-fv.d1, fgl=hash2(fv.ix, fv.iy, salt+24)<0.32;
          col = fw<0.008 ? ptMix(col, fgl ? M.veinHot : M.vein, 0.9) : fw<0.018 ? ptMix(col, M.vein, fgl?0.85:0.55) : ptMix(col, M.veinDark, 0.5);
        }            /* the vein shows on the cliff face too */
        if(K(u2, v2-1)!==1 || K(u2, v2-2)!==1) col=M.lip;
      } else {
        /* the top of the formation: a few broad lit planes, darker toward the void behind */
        /* big angular masses: each is a low pyramid, its planes lit by which way they face (light from the upper left) */
        var f=ptVor(wx, wy, 1.5, salt+11), ddx=wx-f.sx, ddy=wy-f.sy, ang=Math.atan2(ddy,ddx), turn=hash2(f.ix,f.iy,salt+13)*6.28;
        var facet=Math.floor(((ang+turn)%6.2832+6.2832)%6.2832/1.2566);                      /* five planes per mass */
        var fa=facet*1.2566-turn+0.628, lit=-(Math.cos(fa)*0.7+Math.sin(fa)*0.7);            /* plane facing toward the light = bright */
        col = lit>0.35 ? M.topHi : lit>-0.35 ? M.top : M.topLo;
        col = ptMix(col, M.topLav, 0.25*ptVal(wx*0.35, wy*0.35, salt+14));
        var mot=(ptVal(wx*3.2, wy*3.2, salt+15)-0.5)*9 + (ptVal(wx*7.5, wy*7.5, salt+16)-0.5)*5;   /* soft mottling */
        col=[col[0]+mot, col[1]+mot, col[2]+mot*1.05];
        if(hash2(Math.floor(wx*R), Math.floor(wy*R), salt+17)<0.03) col=ptMix(col, M.topLo, 0.35);   /* sparse pits */
        if(f.d2-f.d1<0.03) col=ptMix(col, M.topLo, 0.5);
        var back=0; for(var b=1;b<=4;b++){ if(K(u2, v2-b*2)===2){ back=1-(b-1)/4; break; } }
        if(back) col=ptMix(col, M.topLo, 0.45*back);
        /* now and then a mineral vein runs through the rock, following the facet seams */
        var rv=ptVor(wx+0.25*ptVal(wx*1.1, wy*1.1, salt+18), wy, 1.1, salt+19), rmk=ptVal(wx*0.24, wy*0.24, salt+20);
        if(rmk>0.55 && rv.d2-rv.d1<0.035 && hash2(rv.ix, rv.iy, salt+21)<0.6){
          /* metal reads as three tones across its width: a hot core, the metal itself, a dark trim */
          var gleam=hash2(rv.ix, rv.iy, salt+22)<0.32, wdt=rv.d2-rv.d1, amt=Math.min(1,(rmk-0.55)*7);
          if(wdt<0.009) col=ptMix(col, gleam ? M.veinHot : M.vein, (gleam?1:0.8)*amt);
          else if(wdt<0.024) col=ptMix(col, M.vein, (gleam?0.95:0.6)*amt);
          else col=ptMix(col, M.veinDark, 0.55*amt);
        }
        if(K(u2-1,v2)===0 || K(u2+1,v2)===0 || K(u2,v2-1)===0) col=ptMix(col, M.edge, 0.55);
      }
    } else {
      /* floor: broad calm slabs; joints on only some edges, low contrast */
      var sl=ptVor(wx, wy, 2.1, salt+31), tone=hash2(sl.ix,sl.iy,salt+32);
      col = ptMix(M.floor, M.floorLav, 0.3*ptVal(wx*0.16, wy*0.16, salt+33) + 0.12*tone);
      var lum=1 + (tone-0.5)*0.035 + (hash2(Math.floor(wx*R), Math.floor(wy*R), salt+34)-0.5)*M.grain*2;
      col=[col[0]*lum, col[1]*lum, col[2]*lum];
      var jd=sl.d2-sl.d1;
      if(jd<0.035 && hash2(sl.ix*7+sl.iy, sl.iy*3-sl.ix, salt+35)<0.5) col=ptMix(col, M.jointCol, M.joint*(1-jd/0.035));
      /* broad regions: cool lavender mineral, pearlescent sheen, exposed mineral bands */
      var cool=ptVal(wx*0.11, wy*0.11, salt+36), ca0=floorMeta.centerAt, ringNear=ca0 ? Math.max(0, 1-Math.abs(Math.hypot(wx-(ca0.x+1), wy-(ca0.y+1))-4.2)/2.6) : 0;
      var coolT=Math.max((cool-0.52)*2.4, ringNear*(ptVal(wx*0.3, wy*0.3, salt+46)-0.35)*1.2);
      if(coolT>0) col=ptMix(col, M.mineralCool, Math.min(0.45, coolT));
      var pearl=ptVal(wx*0.19+7, wy*0.19, salt+37); if(pearl>0.66) col=ptMix(col, M.pearl, Math.min(0.5, (pearl-0.66)*3));
      var bandR=ptVal(wx*0.07, wy*0.07, salt+38);
      if(bandR>0.64){ var bs=Math.sin((wx*0.8+wy*0.45)*4.2 + ptVal(wx*0.5,wy*0.5,salt+39)*2.5); if(bs>0.82) col=ptMix(col, M.band, Math.min(0.55,(bandR-0.64)*4)); }
      /* thin angular cracks of gold, in a few regions */
      var vv=ptVor(wx+0.3*ptVal(wx*1.3,wy*1.3,salt+40), wy, 1.3, salt+41), mk=ptVal(wx*0.26, wy*0.26, salt+42);
      if(mk>0.6 && vv.d2-vv.d1<0.02 && hash2(vv.ix,vv.iy,salt+45)<0.35){
        var fg=hash2(vv.ix,vv.iy,salt+47)<0.32, vw=vv.d2-vv.d1, va=Math.min(1,(mk-0.6)*9);
        col = vw<0.007 ? ptMix(col, fg ? M.veinHot : M.vein, va) : vw<0.015 ? ptMix(col, M.vein, (fg?0.9:0.65)*va) : ptMix(col, M.veinDark, 0.45*va);
      }
      /* a finer network of hairline veins runs through the open floor so the stone is never blank cream */
      var hv=ptVor(wx*1.9+0.4*ptVal(wx*2.2, wy*2.2, salt+48), wy*1.9, 1.15, salt+49), hmk=ptVal(wx*0.5, wy*0.5, salt+50);
      if(hmk>0.42 && hv.d2-hv.d1<0.012){
        var hw=hv.d2-hv.d1, hg=hash2(hv.ix,hv.iy,salt+51)<0.18;
        col = ptMix(col, hg ? M.veinHot : M.vein, (hg?0.6:0.3)*Math.min(1,(hmk-0.42)*5)*(hw<0.005?1:0.6));
      }
      /* around the sun dais: a broken circular inlay, gold fragments, radial veins fading outward */
      var ca=floorMeta.centerAt;
      if(ca){
        var ddx=wx-(ca.x+1), ddy=(wy-(ca.y+1.1))/0.85, rr2=Math.sqrt(ddx*ddx+ddy*ddy), an=Math.atan2(ddy,ddx);
        if(rr2<1.5) col=ptMix(col, M.polish, 0.7);
        else if(rr2<2.6){
          var segs=16, sgf=((an+Math.PI)/(Math.PI*2))*segs, sg=Math.floor(sgf), ring=rr2<2.05 ? 0 : 1;
          var broken=hash2(sg, ring, salt+61)<0.28 || (ring===1 && hash2(sg,7,salt+62)<0.2);
          if(!broken){
            col=ptMix(col, M.inlay, 0.85);
            var edgeA=Math.min(sgf-sg, 1-(sgf-sg))*rr2*(Math.PI*2/segs);
            if(edgeA<0.035 || Math.abs(rr2-2.05)<0.035 || rr2<1.535 || rr2>2.565) col=ptMix(col, M.inlayJoint, 0.8);
            if(hash2(sg, ring, salt+63)<0.22 && edgeA<0.09 && Math.abs(rr2-(ring?2.33:1.78))<0.08) col=M.vein;   /* embedded gold fragment */
          } else if(Math.abs(rr2-2.05)<0.3 && hash2(Math.floor(wx*R), Math.floor(wy*R), salt+64)<0.05) col=ptMix(col, M.inlayJoint, 0.6);   /* grit where a stone is gone */
        } else if(rr2<6){
          var rays=12, rk=((an+Math.PI)/(Math.PI*2))*rays, rd=Math.abs(rk-Math.round(rk))*rr2*(Math.PI*2/rays);
          var fade=1-(rr2-2.6)/3.4;
          if(rd<0.03 && ptVal(wx*1.7,wy*1.7,salt+65)>0.35) col=ptMix(col, M.vein, 0.55*fade*fade);
        }
      }
      /* small worn sun inlays beside a spring */
      (floorMeta.ptSuns||[]).forEach(function(sun){
        var sdx=wx-sun.x, sdy=(wy-sun.y)/0.9, sr=Math.sqrt(sdx*sdx+sdy*sdy); if(sr>1.35) return;
        var wear=ptVal(wx*3.1, wy*3.1, salt+81);
        if(wear<0.3) return;                                                              /* worn away in places */
        var san=Math.atan2(sdy,sdx), rk=((san+Math.PI)/(Math.PI*2))*12, rd=Math.abs(rk-Math.round(rk));
        var gap=ptVal(wx*5.5, wy*5.5, salt+82);                                           /* stone shows through the inlay in places */
        if(M.motif==='moon'){
          var mr=Math.sqrt(sdx*sdx+sdy*sdy), inner=Math.sqrt((sdx-0.42)*(sdx-0.42)+sdy*sdy);
          if(mr<0.95 && inner>0.72 && gap>0.3) col=ptMix(col, M.vein, 0.5);                 /* a crescent */
          else if(sr>1.15 && sr<1.3 && gap>0.35) col=ptMix(col, M.inlay, 0.5);
        } else if(M.motif==='leaf'){
          var lk=((san+Math.PI)/(Math.PI*2))*6, lf=Math.abs(lk-Math.round(lk));
          if(sr<0.22 && gap>0.3) col=ptMix(col, M.vein, 0.5);
          else if(sr<1.0 && lf<0.2-0.12*(sr/1.0) && gap>0.4) col=ptMix(col, M.vein, 0.45*(1-sr));   /* leaves round a seed */
          else if(sr>1.1 && sr<1.26 && gap>0.35) col=ptMix(col, M.inlay, 0.45);
        } else {
          if(sr<0.28){ if(gap>0.3) col=ptMix(col, M.vein, 0.32+0.18*(1-sr/0.28)); }
          else if(sr<0.36){ if(gap>0.25) col=ptMix(col, M.inlayJoint, 0.55); }
          else if(sr<1.1 && rd<0.14*(1-sr/1.1)+0.025){ if(gap>0.42) col=ptMix(col, M.vein, 0.45*(1-sr/1.25)); }
          else if(sr>1.15 && sr<1.3){ if(gap>0.35) col=ptMix(col, M.inlay, 0.5); }
        }
      });
      /* the luminous pool */
      var pf=ptPoolField(wx, wy);
      if(pf>0.3){
        var deep=Math.min(1,(pf-0.34)/0.5), shelfN=ptVal(wx*2.4, wy*2.4, salt+71);
        if(pf<0.4 && shelfN>0.55) col=ptMix(M.poolShelf, M.poolEdge, 0.5);                                  /* submerged stone shelf, in sections */
        else if(pf<0.42) col=ptMix(M.poolShallow, M.poolEdge, (pf-0.3)/0.12);                                 /* pale turquoise shallows */
        else col=ptMix(M.poolEdge, M.pool, Math.max(0,deep));
        var caus=Math.sin(wx*9.1+Math.sin(wy*7.3)*1.4)+Math.sin(wy*8.3+Math.sin(wx*6.1)*1.2);
        if(pf>0.45 && caus>1.6 && hash2(Math.floor(wx*R/2), Math.floor(wy*R/2), salt+72)<0.5) col=ptMix(col, M.poolRim, 0.5);
        if(pf<0.325 && ptVal(wx*3.4, wy*3.4, salt+74)>0.62 && hash2(Math.floor(wx*R), Math.floor(wy*R), salt+73)<0.5) col=ptMix(col, M.poolRim, 0.7);   /* intermittent waterline highlights */
      } else if(pf>0.18){
        var sh2=ptVal(wx*2.4, wy*2.4, salt+71);
        col = sh2>0.62 ? ptMix(col, M.poolShelfDry, 0.45) : ptMix(col, M.poolWet, 0.3*(pf-0.18)/0.12);    /* mostly wet stone; a dry shelf here and there */
        if(sh2>0.62 && pf>0.27) col=ptMix(col, M.edge, 0.25);
      }
      /* scree: broken rock spilling from the foot of a cliff, so the wall meets the ground instead of stopping dead */
      var dUp=0;
      for(var su=1; su<=7; su++){ if(K(u2, v2-su)===1){ dUp=su; break; } }
      if(dUp){
        var scree=ptVal(wx*3.4, wy*5.2, salt+90), grit=hash2(Math.floor(wx*R), Math.floor(wy*R), salt+91);
        var reach=(7-dUp)/7;                                                     /* thickest right at the wall */
        if(scree > 0.62-reach*0.3){
          var lit=grit<0.3;
          col=ptMix(col, lit ? M.topHi : (grit<0.62 ? M.top : M.topLo), 0.75);
          if(grit>0.93) col=ptMix(col, M.edge, 0.5);                             /* a dark chip edge here and there */
        } else if(grit<0.05+reach*0.1) col=ptMix(col, M.topLo, 0.5);            /* stray grit further out */
      }
      /* moss: soft irregular growth wherever the ground is mossy, thicker at the middle of a patch */
      if(M.moss && ground){
        /* moss grows along the cracks in the stone, built up in three layers: a dark damp stain, a diffuse green body,
           then sparse bright specks on top */
        var mfield=ptMossField(wx, wy);
        if(mfield>0.08 && ptPoolField(wx,wy)<0.18){
          var mv=ptVor(wx+0.3*ptVal(wx*1.4, wy*1.4, salt+67), wy, 1.5, salt+61);     /* the crack network the moss follows */
          var along=Math.max(0, 1-(mv.d2-mv.d1)/0.16);                               /* 1 on a crack, 0 away from it */
          var drift=ptVal(wx*1.1, wy*1.1, salt+64)*0.6 + ptVal(wx*2.8, wy*2.8, salt+65)*0.4;
          var damp=mfield*along*(0.55+drift*0.7);
          if(damp>0.1){
            col=ptMix(col, M.moss[2], Math.min(0.6, damp*0.75));                     /* 1: the dark damp stain, broad and soft */
            if(damp>0.26) col=ptMix(col, M.moss[0], Math.min(0.7, (damp-0.26)*1.5)); /* 2: the green body */
            var sp=hash2(Math.floor(wx*R), Math.floor(wy*R), salt+62);
            if(damp>0.34 && sp < (damp-0.34)*0.85) col=M.moss[3];                    /* 3: bright specks catching the light */
            else if(damp>0.2 && sp>0.985) col=M.moss[1];
          }
        }
      }
      /* the floor darkens a little where it runs under rock */
      var occ=0; for(var o=2;o<=7;o+=2){ if(K(u2, v2-o)===1){ occ=Math.max(occ, 1-o/9); } if(K(u2-o,v2)===1 || K(u2+o,v2)===1) occ=Math.max(occ, 0.6*(1-o/9)); }
      if(occ) col=ptMix(col, M.occ, 0.32*occ);
    }
    D[p]=col[0]; D[p+1]=col[1]; D[p+2]=col[2]; D[p+3]=255;
  }
  g.putImageData(im,0,0);
  if(ptWallCell(x,y) && inb(x,y+1) && !ptWallCell(x,y+1) && hash2(x,y,salt+51)<0.16) ptCrystal(g, x, y, salt, M);
  return c;
}
function ptCrystal(g, x, y, salt, M){
  /* crystals in a cliff face grow OUT of the rock at mid height, angled away from it: they must never look as if
     they were standing on the lip at the bottom of the face (that lip is the top of the wall, not a floor) */
  var n=1+Math.floor(hash2(x,y,salt+52)*2), bx=8+hash2(x,y,salt+53)*16, by=Math.round(PT_R*0.66);
  for(var k=0;k<n;k++){
    var h=7+hash2(x,y,salt+60+k)*8, w=1.6+hash2(x,y,salt+70+k)*1.6;
    var lean=(hash2(x,y,salt+80+k)-0.5)*4;                                          /* almost upright, just off the rock */
    var ox=bx+(k-(n-1)/2)*3, oy=by+(hash2(x,y,salt+95+k)-0.5)*3;
    /* a dark socket where the crystal leaves the rock */
    g.fillStyle='rgba(18,14,26,0.5)'; g.beginPath(); g.ellipse(ox, oy, w*1.5, 1.6, 0, 0, 7); g.fill();
    ptShard(g, ox, oy, w, h, lean, hash2(x,y,salt+90+k)<0.35, M);
    /* a couple of chips of rock at the socket, so it reads as broken out of the wall */
    g.fillStyle=M.rockHi; g.fillRect(Math.round(ox-w-1), Math.round(oy-1), 2, 2);
    g.fillStyle=M.rockLo; g.fillRect(Math.round(ox+w-1), Math.round(oy), 2, 1);
  }
}
function ptShard(g, ox, by, w, h, lean, cyan, M){
  /* a hexagonal prism seen three-quarter: a bright lit face, a mid face, a deep shadow face, lit edges picked out */
  var tipX=ox+lean, tipY=by-h, shX=ox+w*0.75+lean*0.6, shY=by-h*0.78, slX=ox-w*0.75+lean*0.6, slY=by-h*0.78, midX=ox+lean*0.25;
  function poly(pts, col){ g.beginPath(); g.moveTo(pts[0],pts[1]); for(var i=2;i<pts.length;i+=2) g.lineTo(pts[i],pts[i+1]); g.closePath(); g.fillStyle=col; g.fill(); }
  /* the shading comes from this plane's crystal palette, so Shadow's shards are violet and Earth's are green */
  var C2=(ptMat()||PT_MAT.light).crystal;
  function dk(h, k){ var n=parseInt(h.slice(1),16), r=((n>>16)&255)*k, g2=((n>>8)&255)*k, b2=(n&255)*k; return 'rgb('+(r|0)+','+(g2|0)+','+(b2|0)+')'; }
  var lit = cyan ? dk(C2[3],1.25) : C2[0], mid = cyan ? C2[3] : C2[1], dark = cyan ? dk(C2[3],0.72) : C2[2], deep = cyan ? dk(C2[3],0.5) : dk(C2[2],0.68);
  poly([ox-w, by, slX, slY, tipX, tipY, shX, shY, ox+w, by], deep);                          /* silhouette, dark on the shadow side */
  poly([ox-w+0.8, by, slX+0.6, slY+0.4, tipX, tipY+1, midX, by], lit);                         /* lit face */
  poly([midX, by, tipX, tipY+1, shX-0.9, shY+0.6, ox+w*0.45, by], mid);                        /* front face */
  poly([ox+w*0.45, by, shX-0.9, shY+0.6, ox+w-1, by], dark);                                   /* shadow face */
  g.fillStyle=C2[0];                                                                             /* selective bright edges */
  g.fillRect(Math.round(slX+0.5), Math.round(slY), 1, Math.max(2, Math.round((by-slY)*0.55)));
  g.fillRect(Math.round(tipX-0.5), Math.round(tipY+1), 1, Math.max(1, Math.round(h*0.22)));
  if(h>14){ g.globalAlpha=0.7; g.fillRect(Math.round(midX), Math.round(by-h*0.55), 1, Math.round(h*0.3)); g.globalAlpha=1; }
}
function ptCrystalCells(){
  var M=ptMat(); if(!M) return [];
  if(floorMeta._ptCrystals) return floorMeta._ptCrystals;
  var salt=ptSalt(), out=[];
  for(var y=0;y<MH;y++) for(var x=0;x<MW;x++) if(ptWallCell(x,y) && inb(x,y+1) && !ptWallCell(x,y+1) && hash2(x,y,salt+51)<0.14) out.push({x:x,y:y});
  Object.defineProperty(floorMeta, '_ptCrystals', {value:out, enumerable:false, configurable:true, writable:true});   /* not saved */
  return out;
}

/* ---------------------------------------------------------------- cache, a few rasters per frame */
var PT_CACHE = {key:null, cells:{}, built:0, dist:null};
function ptCacheObj(){
  var key=(floorMeta && floorMeta.plane)+':'+ptSalt()+':'+(typeof worldSeed==='number'?worldSeed:0)+':'+(map?map.length:0);
  if(PT_CACHE.key!==key || PT_CACHE.map!==map){ PT_CACHE.key=key; PT_CACHE.map=map; PT_CACHE.cells={}; PT_CACHE.dist=null; }
  return PT_CACHE;
}
function ptCache(){ return ptCacheObj().cells; }
function ptTile(x, y){
  var cells=ptCache(), k=x+','+y;
  if(!(k in cells)){
    if(PT_CACHE.built>=PT_BUDGET) return null;
    PT_CACHE.built++; cells[k]=ptCellRaster(x,y);
  }
  return cells[k] ? {img:cells[k], sx:0, sy:0, sw:PT_R, sh:PT_R, crisp:true} : null;
}
var PT_BUDGET = 14;
function ptFlat(x, y){ var M=ptMat(); var c=!ptWallCell(x,y) ? M.floor : ptCellDist(x,y)>=2 ? M.void : M.top; return 'rgb('+c[0]+','+c[1]+','+c[2]+')'; }

/* ---------------------------------------------------------------- hooking the renderer */
var _drawPT = draw;
draw = function(){ PT_CACHE.built=0; var r=_drawPT.apply(this, arguments); if(ptMat() && PT_CACHE.built>=PT_BUDGET) requestAnimationFrame(function(){ draw(); }); return r; };
var _blitTilePT = blitTile;
blitTile = function(o, px, py, alpha){
  if(o && o.flat){ ctx.globalAlpha=alpha; ctx.fillStyle=o.flat; var X2=Math.round(px), Y2=Math.round(py); ctx.fillRect(X2,Y2,Math.round(px+TS)-X2,Math.round(py+TS)-Y2); return true; }
  if(o && o.crisp){ ctx.globalAlpha=alpha; ctx.imageSmoothingEnabled=false; var X=Math.round(px), Y=Math.round(py); ctx.drawImage(o.img,o.sx,o.sy,o.sw,o.sh,X,Y,Math.round(px+TS)-X,Math.round(py+TS)-Y); return true; }   /* exact edges: faded remembered cells must not overlap */
  return _blitTilePT(o, px, py, alpha);
};
var _floorTilePT = floorTile;
floorTile = function(x, y){ if(!ptMat()) return _floorTilePT(x,y); return ptTile(x,y) || {flat:ptFlat(x,y)}; };
var _wallTilePT = wallTile;
wallTile = function(x, y){ if(!ptMat()) return _wallTilePT(x,y); return ptTile(x,y) || {flat:ptFlat(x,y)}; };
/* the dungeon's rims, moss, grit and drains don't belong here */
var _drawWallEdgesPT = drawWallEdges;
drawWallEdges = function(x, y, t, px, py, a){ if(ptMat()) return; return _drawWallEdgesPT(x, y, t, px, py, a); };
var _drawSurfaceDecoPT = drawSurfaceDeco;
drawSurfaceDeco = function(){ if(ptMat()) return; return _drawSurfaceDecoPT(); };
/* crystal glow is handled by the lighting system */
var _gatherLightsPT = gatherLights;
gatherLights = function(now, prp){
  var L=_gatherLightsPT(now, prp), M=ptMat(); if(!M) return L;
  /* a wide, soft fill so the rock around you reads: without it, rock whose neighbours are all rock gets no light at all */
  L.push({x:prp.x, y:prp.y, c:hexRGB(M.fill||'#FFFFFF'), r:13, s:0.34, tx:player.x, ty:player.y});
  ptCrystalCells().forEach(function(c){
    if(c.x<camX-4 || c.x>camX+viewW+4 || c.y<camY-4 || c.y>camY+viewH+4 || !(revealAll||seen[idxOf(c.x,c.y)])) return;
    L.push({x:c.x, y:c.y+0.8, c:hexRGB(M.crystalLight), r:2.6, s:0.55, tx:c.x, ty:c.y+1});
  });
  return L;
};

/* ---------------------------------------------------------------- a test room for judging terrain on its own */
function buildPlaneTestRoom(el){
  var W=MW, H=MH;
  map=new Uint8Array(W*H); seen=new Uint8Array(W*H); vis=new Uint8Array(W*H); ground=new Uint8Array(W*H); fireT=new Uint8Array(W*H);
  if(typeof fireSrc!=='undefined') fireSrc=new Uint8Array(W*H);
  propGrid=new Int16Array(W*H).fill(-1); props=[]; feats=[]; items=[]; ents=[player]; rooms=[]; chestKind={}; levers=[]; plates=null; altars={};
  floorMeta={floor:floorNo, biome:bidx(), plane:el, notes:[], planeLights:[], marks:[], clouds:[]};
  var rows=[
    '############################',
    '############################',
    '######.........#############',
    '#####...........############',
    '####.............###....####',
    '####..............#......###',
    '###...............#......###',
    '###...........##.........###',
    '####..........##.........###',
    '#####.........#####.....####',
    '######.......#######...#####',
    '#######.....#########.######',
    '########...##########.######',
    '#########.###########.######',
    '#########.###########...####',
    '#########.#############.####',
    '#########...............####',
    '############################',
    '############################'];
  var ox=Math.floor((W-rows[0].length)/2), oy=Math.floor((H-rows.length)/2);
  for(var y=0;y<H;y++) for(var x=0;x<W;x++) map[idxOf(x,y)]=WALL;
  rows.forEach(function(r, yy){ for(var xx=0;xx<r.length;xx++) if(r[xx]==='.') map[idxOf(ox+xx, oy+yy)]=FLOOR; });
  player.x=ox+9; player.y=oy+8; player._lx=undefined;
  for(var j=0;j<seen.length;j++) seen[j]=1;
  return {ox:ox, oy:oy};
}

/* ---------------------------------------------------------------- the sun dais (Light's centerpiece), drawn to match the stone
   A broad round platform in three-quarter view: an outer step, a raised inner disc with a carved ring,
   and a gold sunburst inlaid at its heart. 64px for its 2x2 cells. */
var PT_DAIS = null;
function ptDaisRaster(){
  if(PT_DAIS) return PT_DAIS;
  var S=64, c=document.createElement('canvas'); c.width=S; c.height=S;
  var g=c.getContext('2d'), im=g.createImageData(S,S), D=im.data;
  var TOP=[234,226,208], STEP=[216,206,186], SIDE=[176,164,150], SIDE2=[150,138,128], EDGE=[118,106,98], RING=[190,178,160], GOLD=[226,182,82], GOLDHI=[250,226,150];
  function put(u,v,col,a){ if(u<0||v<0||u>=S||v>=S) return; var p=(v*S+u)*4; D[p]=col[0]; D[p+1]=col[1]; D[p+2]=col[2]; D[p+3]=a===undefined?255:a; }
  var cx=32, OUT={cy:34, rx:31, ry:20, h:6}, INN={cy:30, rx:22, ry:14, h:4};
  function inE(u,v,cy,rx,ry){ var dx=(u+0.5-cx)/rx, dy=(v+0.5-cy)/ry; return dx*dx+dy*dy; }
  for(var v=0; v<S; v++) for(var u=0; u<S; u++){
    var col=null;
    /* outer step: side band then top */
    var eo=inE(u,v,OUT.cy,OUT.rx,OUT.ry), eos=inE(u,v-OUT.h,OUT.cy,OUT.rx,OUT.ry);
    if(eos<=1 && v+0.5>OUT.cy-0 ) col = (eos>0.9 ? EDGE : ((u*7+v*3)%23===0 ? SIDE2 : SIDE));
    if(eo<=1){
      col = eo>0.92 ? EDGE : STEP;
      /* a few block joints radiating round the step */
      var ang=Math.atan2((v+0.5-OUT.cy)/OUT.ry, (u+0.5-cx)/OUT.rx), seg=((ang+Math.PI)/(Math.PI*2))*14;
      if(eo>0.55 && Math.abs(seg-Math.round(seg))<0.06) col=RING;
    }
    /* inner disc: side band then top */
    var ei=inE(u,v,INN.cy,INN.rx,INN.ry), eis=inE(u,v-INN.h,INN.cy,INN.rx,INN.ry);
    if(eis<=1 && v+0.5>INN.cy && ei>1) col = eis>0.88 ? EDGE : SIDE;
    if(ei<=1){
      col = ei>0.9 ? [206,196,178] : TOP;
      if(ei>0.62 && ei<0.7) col=RING;                                             /* the carved ring */
      /* the sunburst: eight long and eight short rays, flattened into the view */
      var du=(u+0.5-cx)/INN.rx, dv=(v+0.5-INN.cy)/INN.ry, r=Math.sqrt(du*du+dv*dv), a=Math.atan2(dv,du);
      var k=((a+Math.PI)/(Math.PI*2))*16, frac=Math.abs(k-Math.round(k)), long=Math.round(k)%2===0;
      var reach=long ? 0.56 : 0.36, width=0.5*(1-r/reach);
      if(r<0.16) col = r<0.09 ? GOLDHI : GOLD;
      else if(r<reach && frac<width) col = frac<width*0.35 ? GOLDHI : GOLD;
    }
    if(col) put(u,v,col);
  }
  /* a pale highlight along the inner disc's upper-left rim */
  for(var t=0;t<60;t++){ var an=Math.PI*1.05+t/60*Math.PI*0.6; put(Math.round(cx+Math.cos(an)*(INN.rx-1.2)), Math.round(INN.cy+Math.sin(an)*(INN.ry-1.2)), [250,246,232]); }
  g.putImageData(im,0,0); PT_DAIS=c; return c;
}
var _drawPropSurfacePT = drawPropSurface;
drawPropSurface = function(p, px, py, alpha){
  if(p.name==='sun-dais' && ptMat()){
    var img=ptDaisRaster(), X=Math.round((p.x-camX)*TS), Y=Math.round((p.y-camY)*TS), W=Math.round(TS*2);
    ctx.save(); ctx.globalAlpha=alpha; ctx.imageSmoothingEnabled=false;
    ctx.fillStyle='rgba(60,50,40,0.18)'; ctx.beginPath(); ctx.ellipse(X+W/2, Y+W*0.62, W*0.5, W*0.34, 0, 0, 7); ctx.fill();   /* soft contact shadow */
    ctx.drawImage(img, 0, 0, 64, 64, X, Y, W, W); ctx.restore();
    return true;
  }
  return _drawPropSurfacePT(p, px, py, alpha);
};


/* ---------------------------------------------------------------- Light plane features (planned once at build; saved with the floor)
   - one large ivory crystal outcrop against the upper-right wall of the central chamber (its cells block, matching what you see)
   - one small pale-cyan luminous pool in the chamber's upper left (shallow: walkable), with a route beside it
   - a few asymmetric crystal groups against selected walls elsewhere: one large, a couple small, some fragments */
/* how mossy this spot is, read smoothly from the ground of the cells around it, so moss never stops at a tile edge */
function ptMossField(wx, wy){
  if(!ground) return 0;
  var cx=Math.floor(wx), cy=Math.floor(wy), f=0, tot=0;
  for(var oy=-2;oy<=2;oy++) for(var ox=-2;ox<=2;ox++){
    var nx=cx+ox, ny=cy+oy; if(!inb(nx,ny)) continue;
    var dx=wx-(nx+0.5), dy=wy-(ny+0.5), d=Math.sqrt(dx*dx+dy*dy)/1.9;
    if(d>=1) continue;
    var w=(1-d)*(1-d); tot+=w;
    var g=ground[idxOf(nx,ny)];
    if(g===G_MOSS || g===G_GRASS) f+=w;
  }
  return tot ? f/tot : 0;
}
function ptPoolField(wx, wy){
  var P=floorMeta && floorMeta.ptPool; if(!P) return 0;
  var cx=Math.floor(wx), cy=Math.floor(wy), f=0;
  for(var oy=-2;oy<=2;oy++) for(var ox=-2;ox<=2;ox++){
    if(!P[idxOf(cx+ox,cy+oy)] || !inb(cx+ox,cy+oy)) continue;
    var dx=wx-(cx+ox+0.5), dy=(wy-(cy+oy+0.5))*1.1, d=Math.sqrt(dx*dx+dy*dy)/1.5;
    if(d<1) f+=(1-d)*(1-d);
  }
  return f ? f + (ptVal(wx*1.6, wy*1.6, 977)-0.5)*0.22 : 0;
}
/* after placing features, nothing may cut the cave in two: a blocking piece that seals anything off is moved to a
   better spot, and only left out if there is nowhere sensible for it (never left as a crystal you can walk through) */
function ptFixBlockers(){
  function firstWalkable(){ for(var i=0;i<map.length;i++){ var x=i%MW, y=(i/MW)|0; if(walkable(x,y)) return {x:x,y:y}; } return null; }
  function unreachable(){
    var s0=firstWalkable(); if(!s0) return null;
    var d=bfsFrom(s0.x, s0.y);
    for(var i=0;i<map.length;i++){ var x=i%MW, y=(i/MW)|0; if(walkable(x,y) && d[i]<0) return {x:x,y:y}; }
    return null;
  }
  function goodSpot(p, x, y){
    for(var yy=y; yy<y+(p.h||1); yy++) for(var xx=x; xx<x+(p.w||1); xx++){
      if(!inb(xx,yy) || map[idxOf(xx,yy)]!==FLOOR || itemAt(xx,yy) || occupied(xx,yy)) return false;
      var q=propAt(xx,yy); if(q && q!==p) return false;
      if(nearDoor(xx,yy)) return false;
      if(ptWallCell(xx, y+(p.h||1))) return false;                       /* roots stay on open ground */
      var open=0; for(var oy=-1;oy<=1;oy++) for(var ox=-1;ox<=1;ox++){ if(!ox&&!oy) continue; if(!ptWallCell(xx+ox,yy+oy)) open++; }
      if(open<5) return false;                                           /* not in a passage or a nook */
    }
    return true;
  }
  for(var pass=0; pass<10; pass++){
    var bad=unreachable(); if(!bad) return;
    var blockers=props.filter(function(p){ return (p.name==='pt-cluster' || p.name==='pt-outcrop' || /^rune-stone/.test(p.name)) && p.b; })
                      .sort(function(a,b){ return (Math.abs(a.x-bad.x)+Math.abs(a.y-bad.y))-(Math.abs(b.x-bad.x)+Math.abs(b.y-bad.y)); });
    var p=blockers[0]; if(!p) return;
    var ox0=p.x, oy0=p.y, moved=false;
    for(var r=2; r<=7 && !moved; r++) for(var dy=-r; dy<=r && !moved; dy++) for(var dx=-r; dx<=r; dx++){
      var nx=ox0+dx, ny=oy0+dy; if(Math.abs(dx)+Math.abs(dy)<2) continue;
      if(!goodSpot(p, nx, ny)) continue;
      p.x=nx; p.y=ny; if(p.wallDir) p.wallDir=ptWallDir(nx,ny);
      rebuildPropGrid();
      if(!unreachable()){ moved=true; break; }
      p.x=ox0; p.y=oy0; rebuildPropGrid();
    }
    if(!moved) removeProp(p);                                            /* nowhere to move it: leave it out */
  }
}
function ptWallDir(x,y){ var o=[[0,-1],[-1,0],[1,0]].filter(function(d){ return ptWallCell(x+d[0],y+d[1]); })[0]; return o || null; }   /* never the wall below: that lip is not a floor */
function ptPlanFeatures(rr){
  var M=ptMat()||PT_MAT.light;
  /* the grotto spring: its water cells glow; a worn sun inlay on open floor beside it */
  var water=[]; for(var wi=0;wi<map.length;wi++) if(map[wi]===WATER) water.push(wi);
  if(water.length){
    floorMeta.ptPool=floorMeta.ptPool||{};
    var sx=0, sy=0; water.forEach(function(i){ floorMeta.ptPool[i]=1; sx+=i%MW; sy+=(i/MW)|0; }); sx/=water.length; sy/=water.length;
    floorMeta.planeLights.push({x:sx, y:sy, col:M.poolLight, r:4.4, s:0.9});
    var best2=null, bd2=1e9;
    for(var yy=Math.floor(sy)-5; yy<=Math.floor(sy)+5; yy++) for(var xx=Math.floor(sx)-6; xx<=Math.floor(sx)+6; xx++){
      if(!inb(xx,yy) || map[idxOf(xx,yy)]!==FLOOR) continue;
      var ok2=[[0,0],[1,0],[-1,0],[0,1],[0,-1]].every(function(o){ return inb(xx+o[0],yy+o[1]) && map[idxOf(xx+o[0],yy+o[1])]===FLOOR && !propAt(xx+o[0],yy+o[1]); });
      if(!ok2) continue;
      var dd=Math.abs(Math.hypot(xx+0.5-sx, yy+0.5-sy)-2.5);
      if(dd<bd2){ bd2=dd; best2={x:xx+0.5, y:yy+0.5}; }
    }
    if(best2) floorMeta.ptSuns=(floorMeta.ptSuns||[]).concat([best2]);
  }
  var c=floorMeta.centerAt, cx=c.x+1, cy=c.y+1;
  function floorFree(x,y){ return inb(x,y) && map[idxOf(x,y)]===FLOOR && !propAt(x,y); }
  /* the outcrop: a 3x2 floor block, wall above most of it, open ground around its front */
  var best=null, bs=-1e9;
  for(var y=cy-10;y<=cy;y++) for(var x=cx+1;x<=cx+11;x++){
    var ok=true; for(var yy=y;yy<y+2&&ok;yy++) for(var xx=x;xx<x+3;xx++) if(!floorFree(xx,yy)){ ok=false; break; }
    if(!ok) continue;
    var wallsAbove=0; for(var xx2=x;xx2<x+3;xx2++) if(ptWallCell(xx2,y-1)) wallsAbove++;
    if(wallsAbove<2) continue;
    var front=0; for(var xx3=x-1;xx3<=x+3;xx3++) if(floorFree(xx3,y+2)) front++;
    if(front<4) continue;
    var seenAll=true;   /* every cell of it, and the ground in front, in plain view of the dais */
    for(var ly=y; ly<=y+2 && seenAll; ly++) for(var lx=x; lx<x+3; lx++){ var los=boltPath(cx,cy,lx,ly), le=los[los.length-1]; if(!le || le.x!==lx || le.y!==ly){ seenAll=false; break; } }
    if(!seenAll) continue;
    if(Math.hypot(x+1.5-cx, y+1-cy)>9) continue;
    var sc=(x-cx)*1.0+(cy-y)*1.2-Math.abs(Math.hypot(x+1.5-cx, y+1-cy)-6)*1.5;
    if(sc>bs){ bs=sc; best={x:x,y:y}; }
  }
  if(best){
    var o=addSetPiece(best.x, best.y, 'pt-outcrop', 3, 2, {keep:true});
    if(o){ o.b=1; o.seed=Math.floor(rr()*1e6); floorMeta.planeLights.push({x:best.x+1.5, y:best.y+0.8, col:M.crystalLight, r:4.2, s:0.85}); }
  }
  /* the pool: a blob of 4-6 floor cells in the upper left, all neighbours open so there is always a way past */
  var pbest=null, ps=-1e9;
  for(var y2=cy-9;y2<=cy-1;y2++) for(var x2=cx-11;x2<=cx-2;x2++){
    var clear=true; for(var oy=-1;oy<=2&&clear;oy++) for(var ox=-1;ox<=3;ox++) if(!floorFree(x2+ox,y2+oy)){ clear=false; break; }
    if(!clear) continue;
    var sc2=-(Math.abs(x2+1-(cx-5))+Math.abs(y2+0.5-(cy-4)));
    if(sc2>ps){ ps=sc2; pbest={x:x2,y:y2}; }
  }
  if(pbest){
    floorMeta.ptPool=floorMeta.ptPool||{};
    [[0,0],[1,0],[2,0],[0,1],[1,1],[2,1]].forEach(function(o,k){ if(k<4 || rr()<0.6) floorMeta.ptPool[idxOf(pbest.x+o[0], pbest.y+o[1])]=1; });
    floorMeta.planeLights.push({x:pbest.x+1.2, y:pbest.y+0.6, col:M.poolLight, r:3.6, s:0.8});
  }
  /* wall formations: pick spaced anchors, away from the chamber features */
  var anchors=(floorMeta._anchors||[]).slice(), picked=[];
  for(var i=anchors.length-1;i>0;i--){ var j=Math.floor(rr()*(i+1)); var t=anchors[i]; anchors[i]=anchors[j]; anchors[j]=t; }
  function chokepoint(x,y){
    /* a cell is a passage if its open neighbours sit on opposite sides, or if it has few open neighbours at all */
    var n=!ptWallCell(x,y-1), s2=!ptWallCell(x,y+1), w=!ptWallCell(x-1,y), e=!ptWallCell(x+1,y);
    if((n&&s2&&!w&&!e) || (w&&e&&!n&&!s2)) return true;
    var open=0; for(var oy=-1;oy<=1;oy++) for(var ox=-1;ox<=1;ox++){ if(!ox&&!oy) continue; if(!ptWallCell(x+ox,y+oy)) open++; }
    return open<=4;
  }
  anchors.forEach(function(a){
    if(picked.length>=7 || !floorFree(a.x,a.y)) return;
    if(chokepoint(a.x,a.y)) return;                                   /* never block a narrow way through */
    if(ptWallCell(a.x, a.y+1)) return;                                /* the ground below must be open, or the roots sit on a wall's lip */
    if(Math.hypot(a.x-cx, a.y-cy)<5) return;
    if(picked.some(function(q){ return Math.abs(q.x-a.x)+Math.abs(q.y-a.y)<9; })) return;
    if(floorMeta.ptPool && floorMeta.ptPool[idxOf(a.x,a.y)]) return;
    picked.push(a);
    var big=addSetPiece(a.x, a.y, 'pt-cluster', 1, 1, {keep:true}); if(big){ big.b=1; big.seed=Math.floor(rr()*1e6); big.size=1; big.wallDir=ptWallDir(a.x,a.y); }
    floorMeta.planeLights.push({x:a.x, y:a.y, col:M.crystalLight, r:3, s:0.6});
    /* one or two smaller pieces nearby along the same wall, unevenly spaced */
    var n=1+(rr()<0.5?1:0);
    for(var k=0;k<n;k++){
      var dx=(rr()<0.5?-1:1)*(1+Math.floor(rr()*2)), dy=Math.floor(rr()*3)-1, x3=a.x+dx, y3=a.y+dy;
      var nearWall=[[1,0],[-1,0],[0,1],[0,-1]].some(function(o){ return ptWallCell(x3+o[0],y3+o[1]); });
      if(!floorFree(x3,y3) || !nearWall || ptWallCell(x3,y3+1)) continue;   /* open ground below, so the roots land on floor */
      var sm=addSetPiece(x3, y3, 'pt-cluster', 1, 1, {keep:true}); if(sm){ sm.b=0; sm.flat=1; sm.seed=Math.floor(rr()*1e6); sm.size=k===0 ? 0.6 : 0.35; sm.wallDir=ptWallDir(x3,y3); }
    }
  });
  if(floorMeta.plane==='earth'){
    /* moss creeps over much of the cave: heaviest at the walls, round the pool and under the plants; grass in the damp middle */
    var seeds=[];
    for(var y5=1;y5<MH-1;y5++) for(var x5=1;x5<MW-1;x5++){
      if(map[idxOf(x5,y5)]!==FLOOR) continue;
      var wall=0; for(var oy5=-1;oy5<=1;oy5++) for(var ox5=-1;ox5<=1;ox5++) if(ptWallCell(x5+ox5,y5+oy5)) wall++;
      var wet=(floorMeta.ptPool && [[0,0],[1,0],[-1,0],[0,1],[0,-1],[2,0],[-2,0],[0,2],[0,-2]].some(function(o){ return floorMeta.ptPool[idxOf(x5+o[0],y5+o[1])]; })) ? 1 : 0;
      var pl=propAt(x5,y5), plant=pl && /fern|mushroom|root/.test(pl.name) ? 1 : 0;
      var chance=0.04 + wall*0.05 + wet*0.3 + plant*0.42;
      if(rr()<chance) seeds.push({x:x5, y:y5});
    }
    seeds.forEach(function(c){ blob(c.x, c.y, ri(2,4), function(xx,yy){ if(map[idxOf(xx,yy)]===FLOOR && !gAt(xx,yy)) setG(xx,yy,G_MOSS); }); });
    /* grass grows in streaks beside the moss, following the same cracks in the stone */
    var gsalt=ptSalt();
    for(var gy=1; gy<MH-1; gy++) for(var gx=1; gx<MW-1; gx++){
      if(map[idxOf(gx,gy)]!==FLOOR || gAt(gx,gy)!==G_MOSS || propAt(gx,gy)) continue;
      var wx2=gx+0.5, wy2=gy+0.5;
      var mv2=ptVor(wx2+0.3*ptVal(wx2*1.4, wy2*1.4, gsalt+67), wy2, 1.5, gsalt+61);
      var along2=Math.max(0, 1-(mv2.d2-mv2.d1)/0.16);
      if(along2>0.35 && rr()<0.5+along2*0.4) setG(gx,gy,G_GRASS);
    }
  }
  if(typeof ptFixBlockers==='function') ptFixBlockers();
}

/* the crystal art: drawn once per piece into a cached canvas, taller than its cells (it rises in front of the wall) */
var PT_PIECES = {};
function ptPieceCanvas(p){
  var key=p.name+':'+p.seed+':'+(p.size||1)+':'+p.w+'x'+p.h+':'+(p.wallDir?p.wallDir.join(''):'');
  if(PT_PIECES[key]) return PT_PIECES[key];
  var M=ptMat()||PT_MAT.light, W=p.w*PT_R, H=(p.h+1.4)*PT_R, c=document.createElement('canvas'); c.width=W; c.height=H;
  var g=c.getContext('2d'), rnd=mulberry32(p.seed||1), base=H-4;
  if(p.name==='pt-outcrop'){
    /* a rocky foot and many shards, tallest toward the back middle */
    ptRockBase(g, W, H, base, rnd, true);
    var shards=[]; for(var i=0;i<13;i++){ var t=rnd(); shards.push({x:8+t*(W-16), back:rnd(), h:0, w:0}); }
    shards.forEach(function(s){ var mid=1-Math.abs(s.x-W/2)/(W/2); s.h=(22+mid*48)*(0.55+0.45*s.back)+rnd()*14; s.w=3+mid*6+rnd()*3; s.y=base-6-s.back*16-rnd()*7; s.lean=(rnd()-0.5)*18; s.cyan=rnd()<0.3; s.sink=2+rnd()*4; });
    shards.sort(function(a,b){ return a.y-b.y; });
    shards.forEach(function(s){ ptShard(g, s.x, s.y+s.sink, s.w, s.h+s.sink, s.lean, s.cyan, M); ptBury(g, s.x, s.y, s.w, rnd); });
    (function(){ var r2=mulberry32((p.seed||1)^77); ptRockBaseFront(g, W, base, r2); ptCrystalMound(g, W, base, r2, M, 1, true); })();
    g.fillStyle=M.crystalGold; for(var k=0;k<7;k++){ g.fillRect(Math.round(10+rnd()*(W-20)), Math.round(base-8-rnd()*12), 2, 1); }
  } else {
    var sz=p.size||1, n=sz>=1 ? 5 : sz>0.5 ? 3 : 2;
    /* a light scatter of broken rock at the base: enough to join them to the ground, not a pile */
    if(sz>=0.6) ptCrystalMound(g, W, base, rnd, M, sz*0.8, false);

    for(var k2=0;k2<n;k2++){
      var off=(k2-(n-1)/2)*5*sz + (rnd()-0.5)*4, by=base-2-rnd()*6, sw=(2.5+rnd()*2.5)*Math.max(0.6,sz), sh=(12+rnd()*30)*sz*(k2===Math.floor(n/2)?1.3:1), sink=2+rnd()*4;
      ptShard(g, W/2+off, by+sink, sw, sh+sink, (rnd()-0.5)*16, rnd()<0.3, M);
      ptBury(g, W/2+off, by, sw, rnd);
    }
    g.fillStyle=M.crystalGold; g.fillRect(Math.round(W/2-3*sz), base-3, Math.max(2,Math.round(6*sz)), 1);
  }
  PT_PIECES[key]=c; return c;
}
/* a few angular stone chips heaped over a crystal's foot, so it grows out of the rock instead of standing on a flat base */
/* jagged broken rock the crystals push up through: big angular chunks across the base, lit from the upper left */
function ptCrystalMound(g, W, base, rnd, M, sz, front){
  var n=front ? 2 : (sz>=1 ? 3 : 2), span=W*(sz>=1 ? 0.7 : 0.5);
  for(var i=0;i<n;i++){
    var t=(i+0.5)/n, cx=W/2+(t-0.5)*span + (rnd()-0.5)*3;
    var rw=(front ? 3 : 3.5)+rnd()*(sz>=1?3:2), rh=(front ? 2.4 : 2.8)+rnd()*(sz>=1?2.4:1.6), cy=base-(front?0.5:1.5)-rnd()*1.5;
    var pts=[], k=5+Math.floor(rnd()*2);
    for(var j=0;j<k;j++){ var a=Math.PI*2*j/k+(rnd()-0.5)*0.6; pts.push([cx+Math.cos(a)*rw*(0.7+rnd()*0.45), cy+Math.sin(a)*rh*(0.6+rnd()*0.5)]); }
    g.beginPath(); pts.forEach(function(q,j2){ if(j2) g.lineTo(q[0],q[1]); else g.moveTo(q[0],q[1]); }); g.closePath();
    g.fillStyle=M.rockEdge; g.fill();
    g.save(); g.clip();
    g.fillStyle=M.rockMid; g.fillRect(cx-rw-1, cy-rh-1, rw*2+2, rh*2+2);
    g.fillStyle=M.rockHi; g.beginPath(); g.moveTo(cx-rw, cy-rh); g.lineTo(cx+rw*0.5, cy-rh); g.lineTo(cx-rw*0.2, cy+rh*0.2); g.lineTo(cx-rw, cy+rh*0.5); g.closePath(); g.fill();
    g.fillStyle=M.rockLo; g.beginPath(); g.moveTo(cx+rw, cy-rh*0.2); g.lineTo(cx+rw, cy+rh); g.lineTo(cx-rw*0.3, cy+rh); g.closePath(); g.fill();
    g.restore();
  }
}
function ptBury(g, cx, by, w, rnd){
  /* a tight shadow right where the crystal meets the stone, then chips heaped over the join */
  g.save(); g.globalCompositeOperation='multiply'; g.fillStyle='rgba(120,112,130,0.5)';
  g.beginPath(); g.ellipse(cx+w*0.4, by+0.5, w*1.5, 2.1, 0, 0, 7); g.fill(); g.restore();
  var n=2+Math.floor(rnd()*3);
  for(var i=0;i<n;i++){
    var ox=cx+(rnd()-0.5)*w*2.6, oy=by-1+rnd()*3, rw=1.5+rnd()*w*0.9, rh=1.2+rnd()*2.4;
    g.beginPath(); g.moveTo(ox-rw, oy+rh); g.lineTo(ox-rw*0.6, oy-rh); g.lineTo(ox+rw*0.5, oy-rh*1.15); g.lineTo(ox+rw, oy+rh*0.4); g.closePath();
    g.fillStyle=(ptMat()||PT_MAT.light).rockLo; g.fill();
    g.beginPath(); g.moveTo(ox-rw+0.7, oy+rh-0.5); g.lineTo(ox-rw*0.6+0.4, oy-rh+0.6); g.lineTo(ox+rw*0.5, oy-rh*1.15+0.7); g.closePath();
    g.fillStyle=i%2 ? (ptMat()||PT_MAT.light).rockHi : (ptMat()||PT_MAT.light).rockMid; g.fill();
  }
}
function ptRockBaseFront(g, W, base, rnd){
  [[0.3,5,0.12,5],[0.68,4,0.1,4]].forEach(function(c){
    var cx=W*c[0], cy=base-c[1], rw=W*c[2], rh=c[3];
    g.beginPath(); g.moveTo(cx-rw,cy+rh); g.lineTo(cx-rw*0.7,cy-rh); g.lineTo(cx+rw*0.4,cy-rh*1.1); g.lineTo(cx+rw,cy+rh*0.2); g.lineTo(cx+rw*0.6,cy+rh); g.closePath();
    g.fillStyle=(ptMat()||PT_MAT.light).rockEdge; g.fill();
    g.beginPath(); g.moveTo(cx-rw+1,cy+rh-1); g.lineTo(cx-rw*0.7+0.5,cy-rh+1); g.lineTo(cx+rw*0.4,cy-rh*1.1+1); g.lineTo(cx,cy+rh-1); g.closePath(); g.fillStyle=(ptMat()||PT_MAT.light).rockHi; g.fill();
  });
}
/* angular rock chunks in the stone palette: a back mass that climbs into the wall, a few chunks in front */
function ptRockBase(g, W, H, base, rnd, big){
  var M=ptMat()||PT_MAT.light, hi=M.rockHi, mid=M.rockMid, lo=M.rockLo, edge=M.rockEdge;
  function chunk(cx, cy, rw, rh){
    var n=5+Math.floor(rnd()*2), pts=[];
    for(var i=0;i<n;i++){ var a=Math.PI*2*i/n + (rnd()-0.5)*0.5, rr=0.75+rnd()*0.3; pts.push([cx+Math.cos(a)*rw*rr, cy+Math.sin(a)*rh*rr]); }
    g.beginPath(); pts.forEach(function(q,i){ if(i) g.lineTo(q[0],q[1]); else g.moveTo(q[0],q[1]); }); g.closePath(); g.fillStyle=edge; g.fill();
    /* split into a lit upper-left plane and a shaded lower-right plane */
    g.save(); g.clip();
    g.fillStyle=mid; g.fillRect(cx-rw, cy-rh, rw*2, rh*2);
    g.fillStyle=hi; g.beginPath(); g.moveTo(cx-rw, cy-rh); g.lineTo(cx+rw*0.6, cy-rh); g.lineTo(cx-rw*0.2, cy+rh*0.1); g.lineTo(cx-rw, cy+rh*0.4); g.closePath(); g.fill();
    g.fillStyle=lo; g.beginPath(); g.moveTo(cx+rw, cy-rh*0.2); g.lineTo(cx+rw, cy+rh); g.lineTo(cx-rw*0.2, cy+rh); g.closePath(); g.fill();
    g.restore();
  }
  if(big){
    chunk(W*0.5, base-26, W*0.46, 22);                 /* the back mass, rising into the wall */
    chunk(W*0.22, base-10, W*0.2, 10); chunk(W*0.8, base-9, W*0.19, 9); chunk(W*0.52, base-5, W*0.16, 6);
  } else {
    chunk(W*0.5, base-9, W*0.34, 8);
  }
}
/* rune stones: drawn as wide as their footprint and bottom-anchored, shadow included in the sprite */
var _drawPropSurfaceRune = drawPropSurface;
drawPropSurface = function(p, px, py, alpha){
  if(ptMat() && /^rune-stone/.test(p.name)){
    var o=objArt('props', p.name); if(!o) return _drawPropSurfaceRune(p, px, py, alpha);
    var cells=p.w||1, W=Math.round(cells*TS*0.98), H=Math.round(W*(o.sh/o.sw));
    var X=Math.round((p.x-camX)*TS + (cells*TS-W)/2), Y=Math.round((p.y-camY+(p.h||1))*TS)-H;
    ctx.save(); ctx.globalAlpha=alpha; ctx.imageSmoothingEnabled=false;
    ctx.drawImage(o.img, o.sx, o.sy, o.sw, o.sh, X, Y, W, H); ctx.restore();
    return true;
  }
  return _drawPropSurfaceRune(p, px, py, alpha);
};
var _drawPropSurfacePT2 = drawPropSurface;
drawPropSurface = function(p, px, py, alpha){
  if(p.name==='pt-outcrop' || p.name==='pt-cluster'){
    var img=ptPieceCanvas(p), sc=TS/PT_R, W=Math.round(img.width*sc), H=Math.round(img.height*sc);
    var X=Math.round((p.x-camX)*TS), Y=Math.round((p.y-camY+p.h)*TS)-H;
    if(p.name==='pt-cluster' && p.wallDir) X+=Math.round(p.wallDir[0]*TS*0.4);   /* only sideways: the root stays on its cell's floor line */

    ctx.save(); ctx.globalAlpha=alpha; ctx.imageSmoothingEnabled=false; ctx.drawImage(img, X, Y, W, H); ctx.restore();
    if(!ANIM.reduce) ptSparkle(p, X, Y, W, H, alpha);
    return true;
  }
  return _drawPropSurfacePT2(p, px, py, alpha);
};
PROPS['pt-outcrop']={b:1}; PROPS['pt-cluster']={b:1};

/* the rock band is scenery: anything within two cells of open ground you can see is drawn too */
var _computeFOVPT = computeFOV;
computeFOV = function(radius){
  var r=_computeFOVPT(radius);
  if(!ptMat() || !vis) return r;
  var add=[];
  for(var y=Math.max(0,player.y-12); y<=Math.min(MH-1,player.y+12); y++) for(var x=Math.max(0,player.x-16); x<=Math.min(MW-1,player.x+16); x++){
    var i=idxOf(x,y); if(!vis[i] || ptWallCell(x,y)) continue;
    for(var oy=-2;oy<=2;oy++) for(var ox=-2;ox<=2;ox++){ var nx=x+ox, ny=y+oy; if(inb(nx,ny) && ptWallCell(nx,ny)) add.push(idxOf(nx,ny)); }
  }
  add.forEach(function(i){ vis[i]=1; seen[i]=1; });
  return r;
};

var _drawCharacterPT = drawCharacter;
drawCharacter = function(e, px, py, opts){
  if(e!==player && ptMat()){
    ctx.save(); ctx.shadowColor='rgba(70,60,96,0.35)'; ctx.shadowBlur=Math.max(2, TS*0.06);
    try{ return _drawCharacterPT(e, px, py, opts); } finally { ctx.restore(); }
  }
  return _drawCharacterPT(e, px, py, opts);
};

var _drawWangLayerPT = drawWangLayer;
drawWangLayer = function(key, tileType){ if(ptMat() && key==='water') return; return _drawWangLayerPT(key, tileType); };

/* ---------------------------------------------------------------- plane props take the plane's stone colours
   The shared prop art (stepping stones, boulders, stalagmites) was painted for one plane and clashed in the others,
   so each sprite is remapped by brightness onto this plane's rock ramp and given the same dark edge as the terrain. */
var PT_PROPS = {};
var PT_STONE_PROPS = {'stepping-stone':1, 'mossy-boulder':1, 'stalagmite-light':1, 'stalagmite-shadow':1, 'rune-stone-light':1, 'rune-stone-shadow':1, 'rune-stone-earth':1};
function ptHex(h){ var n=parseInt(h.slice(1),16); return [(n>>16)&255, (n>>8)&255, n&255]; }
function ptPropTint(name, o){
  var M=ptMat(); if(!M) return o;
  var key=floorMeta.plane+':'+name; if(PT_PROPS[key]) return PT_PROPS[key];
  if(!o || !o.img || !o.img.complete || !o.img.naturalWidth) return o;
  var W=o.sw+2, H=o.sh+2, c=document.createElement('canvas'); c.width=W; c.height=H; var g=c.getContext('2d');
  g.drawImage(o.img, o.sx, o.sy, o.sw, o.sh, 1, 1, o.sw, o.sh);
  var im=g.getImageData(0,0,W,H), D=im.data, A=new Uint8Array(W*H);
  var ramp=[ptHex(M.rockEdge), M.faceLo, M.face, M.top, M.topHi, ptHex(M.rockHi)];
  for(var i=0;i<W*H;i++) if(D[i*4+3]>60) A[i]=1;
  for(var y=0;y<H;y++) for(var x=0;x<W;x++){
    var p=(y*W+x)*4, id=y*W+x;
    if(A[id]){
      var l=(0.3*D[p]+0.55*D[p+1]+0.15*D[p+2])/255, sat=(Math.max(D[p],D[p+1],D[p+2])-Math.min(D[p],D[p+1],D[p+2]))/255;
      var glowy = sat>0.3 && l>0.35;
      if(glowy && /rune-stone/.test(name)){                                    /* a carved rune keeps glowing, in this plane's colour */
        var hot=M.veinHot, vn=M.vein, mixk=Math.min(1,(l-0.35)*1.8);
        D[p]=vn[0]+(hot[0]-vn[0])*mixk; D[p+1]=vn[1]+(hot[1]-vn[1])*mixk; D[p+2]=vn[2]+(hot[2]-vn[2])*mixk;
        continue;
      }
      if(glowy && !/rune-stone|stepping-stone|mossy-boulder|stalagmite/.test(name)) continue;   /* leave other coloured art alone */
      var f=Math.max(0, Math.min(0.999, l))*(ramp.length-1), k=Math.floor(f), t=f-k, a=ramp[k], b=ramp[k+1]||ramp[k];
      D[p]=a[0]+(b[0]-a[0])*t; D[p+1]=a[1]+(b[1]-a[1])*t; D[p+2]=a[2]+(b[2]-a[2])*t;
    } else if((x>0&&A[id-1])||(x<W-1&&A[id+1])||(y>0&&A[id-W])||(y<H-1&&A[id+W])){
      var e=ptHex(M.rockEdge); D[p]=e[0]; D[p+1]=e[1]; D[p+2]=e[2]; D[p+3]=235;
    }
  }
  /* moss grows on the stones themselves: dark damp layer, green body, bright specks, thickest on the shaded side and top */
  if(M.moss && /boulder|stepping-stone|stalagmite/.test(name)){
    var minY2=H, maxY2=0;
    for(var i3=0;i3<W*H;i3++) if(A[i3]){ var yy3=(i3/W)|0; if(yy3<minY2) minY2=yy3; if(yy3>maxY2) maxY2=yy3; }
    for(var y3=0;y3<H;y3++) for(var x3=0;x3<W;x3++){
      var id3=y3*W+x3; if(!A[id3]) continue;
      var p3=id3*4, vy3=(y3-minY2)/Math.max(1,maxY2-minY2);
      var f3=ptVal(x3/5.5+name.length, y3/5.5, 991)*0.6 + ptVal(x3/2.2, y3/2.2, 992)*0.4;
      var grow=f3 - 0.42 + (1-vy3)*0.12 + (x3<W*0.45 ? 0.06 : 0);          /* favours the top and the shaded side */
      if(grow<=0) continue;
      var k3=Math.min(0.8, grow*1.8), m3=M.moss[2];
      D[p3]=D[p3]*(1-k3)+m3[0]*k3; D[p3+1]=D[p3+1]*(1-k3)+m3[1]*k3; D[p3+2]=D[p3+2]*(1-k3)+m3[2]*k3;
      if(grow>0.18){ var m4=M.moss[0], k4=Math.min(0.75,(grow-0.18)*2.2);
        D[p3]=D[p3]*(1-k4)+m4[0]*k4; D[p3+1]=D[p3+1]*(1-k4)+m4[1]*k4; D[p3+2]=D[p3+2]*(1-k4)+m4[2]*k4; }
      if(grow>0.26 && hash2(x3,y3,993)<(grow-0.26)*1.3){ var m5=M.moss[3]; D[p3]=m5[0]; D[p3+1]=m5[1]; D[p3+2]=m5[2]; }
    }
  }
  g.putImageData(im,0,0);
  /* a contact shadow baked into the sprite, cast back and to the right, so the piece never looks like it floats */
  var sh=document.createElement('canvas'); sh.width=W; sh.height=H+4; var sg=sh.getContext('2d');
  sg.fillStyle='rgba(24,20,32,0.38)';
  sg.beginPath(); sg.ellipse(W*0.54, H-1.5, W*0.44, 3.2, 0, 0, 7); sg.fill();
  sg.drawImage(c, 0, 0);
  return (PT_PROPS[key]={img:sh, sx:0, sy:0, sw:W, sh:H+4});
}
var _objArtPT = objArt;
objArt = function(group, name){
  var o=_objArtPT(group, name);
  if(o && group==='props' && ptMat() && PT_STONE_PROPS[name]) return ptPropTint(name, o) || o;
  return o;
};

/* ---------------------------------------------------------------- faint glints travelling along the rock's veins */
function ptGlints(){
  var c=ptCacheObj(); if(c.glints) return c.glints;
  var salt=ptSalt(), out=[];
  for(var y=1;y<MH-1;y++) for(var x=1;x<MW-1;x++){
    if(!ptWallCell(x,y) || ptCellDist(x,y)>2) continue;
    if(ptVal(x*0.24, y*0.24, salt+20)<0.6) continue;                          /* only where a vein region runs */
    if(hash2(x,y,salt+61)>0.07) continue;
    out.push({x:x+0.2+hash2(x,y,salt+62)*0.6, y:y+0.25+hash2(x,y,salt+63)*0.5, ph:hash2(x,y,salt+64), sp:0.07+hash2(x,y,salt+65)*0.1});
  }
  c.glints=out; return out;
}
var _drawTelegraphsGlint = drawTelegraphs;
drawTelegraphs = function(now){
  _drawTelegraphsGlint(now);
  var M=ptMat(); if(!M || ANIM.reduce) return;
  var t=(now||performance.now())/1000;
  ctx.save(); ctx.globalCompositeOperation='lighter';
  ptGlints().forEach(function(g){
    if(g.x<camX-1 || g.x>camX+viewW+1 || g.y<camY-1 || g.y>camY+viewH+1) return;
    var i=idxOf(Math.floor(g.x), Math.floor(g.y)); if(!(revealAll||seen[i])) return;
    var ph=((t*g.sp + g.ph)%1);
    if(ph>0.16) return;                                                        /* a brief catch of light, then dark for a while */
    var k=Math.sin(ph/0.16*Math.PI), px=(g.x-camX)*TS, py=(g.y-camY)*TS, r=TS*0.16;
    var grd=ctx.createRadialGradient(px, py, 0, px, py, r);
    grd.addColorStop(0, 'rgba('+M.veinHot[0]+','+M.veinHot[1]+','+M.veinHot[2]+','+(0.45*k).toFixed(3)+')');
    grd.addColorStop(1, 'rgba('+M.vein[0]+','+M.vein[1]+','+M.vein[2]+',0)');
    ctx.fillStyle=grd; ctx.beginPath(); ctx.arc(px, py, r, 0, 7); ctx.fill();
    ctx.globalAlpha=0.45*k; ctx.fillStyle='rgba(255,252,240,0.9)'; ctx.fillRect(px-0.5, py-0.5, Math.max(1,TS*0.04), Math.max(1,TS*0.04)); ctx.globalAlpha=1;
  });
  ctx.restore();
};

/* ---------------------------------------------------------------- crystals twinkle: small four-point stars at their facets */
function ptStar(cx, cy, r, a, col){
  ctx.globalAlpha=a; ctx.fillStyle=col;
  for(var i=0;i<r;i++){
    var w=Math.max(1, Math.round((1-i/r)*2.2));
    ctx.fillRect(cx-i, cy-w/2, 1, w); ctx.fillRect(cx+i, cy-w/2, 1, w);            /* the horizontal arms taper */
    ctx.fillRect(cx-w/2, cy-i, w, 1); ctx.fillRect(cx-w/2, cy+i, w, 1);            /* and the vertical ones */
  }
  ctx.globalAlpha=a*0.8; ctx.fillRect(cx-1, cy-1, 2, 2);
}
function ptSparkle(p, X, Y, W, H, alpha){
  var M=ptMat(); if(!M) return;
  var seed=(p.seed||0)+p.x*31+p.y*17, n=p.name==='pt-outcrop' ? 4 : (p.size>=1 ? 2 : 1);
  var t=performance.now()/1000;
  ctx.save(); ctx.globalCompositeOperation='lighter';
  for(var k=0;k<n;k++){
    var ph=hash2(seed, k, 5), sp=0.1+hash2(seed, k, 6)*0.14, cyc=((t*sp+ph)%1);
    if(cyc>0.2) continue;                                                           /* brief, and rarely two at once */
    var f=Math.sin(cyc/0.2*Math.PI), sx=X+W*(0.2+hash2(seed,k,7)*0.6), sy=Y+H*(0.18+hash2(seed,k,8)*0.45);
    var r=Math.max(3, Math.round(TS*(0.16+0.1*hash2(seed,k,9))));
    ptStar(Math.round(sx), Math.round(sy), r, 0.75*f*alpha, '#FFFFFF');
    ptStar(Math.round(sx), Math.round(sy), Math.round(r*0.6), 0.5*f*alpha, 'rgb('+M.crystal[3].slice(1).match(/../g).map(function(h){ return parseInt(h,16); }).join(',')+')');
  }
  ctx.restore();
  ctx.globalAlpha=1;
}

/* face crystals catch the light too: the same four-point star, over the rock they grow from */
var _drawTelegraphsFaceGlint = drawTelegraphs;
drawTelegraphs = function(now){
  _drawTelegraphsFaceGlint(now);
  var M=ptMat(); if(!M || ANIM.reduce) return;
  var t=(now||performance.now())/1000, salt=ptSalt();
  ctx.save(); ctx.globalCompositeOperation='lighter';
  ptCrystalCells().forEach(function(c){
    if(c.x<camX-1 || c.x>camX+viewW+1 || c.y<camY-1 || c.y>camY+viewH+1) return;
    if(!(revealAll||seen[idxOf(c.x,c.y)])) return;
    var ph=hash2(c.x,c.y,salt+71), sp=0.09+hash2(c.x,c.y,salt+72)*0.1, cyc=((t*sp+ph)%1);
    if(cyc>0.14) return;
    var f=Math.sin(cyc/0.14*Math.PI);
    var px=Math.round((c.x-camX+0.3+0.4*hash2(c.x,c.y,salt+73))*TS), py=Math.round((c.y-camY+0.45)*TS);
    ptStar(px, py, Math.max(3, Math.round(TS*0.13)), 0.6*f, '#FFFFFF');
  });
  ctx.restore(); ctx.globalAlpha=1;
};

/* ---------------------------------------------------------------- big elites are drawn across all their cells
   A 2x2 creature (the Heart of the Mountain) used to draw on its top-left tile only, so it looked one cell wide
   while blocking four. Its sprite is now scaled across the whole footprint and its proxy cells draw nothing. */
var _drawCharacterBig = drawCharacter;
drawCharacter = function(e, px, py, opts){
  if(e && e.base && e.base.big && !e.parent && typeof mobSheet==='function'){
    var n=e.base.big, ms=spriteOn ? mobSheet(e.base.sprite) : null;
    if(ms){
      var fr=clipFrame(ms, e, false), m=ms.m, cell=m.cell, box=m.box||[0,0,cell,cell];
      var target=TS*n*0.98*(e.base.bigScale||1), sc=target/Math.max(box[3], box[2]*0.85);   /* bigScale: a boss can stand taller than its footprint (2026-09-19) */
      var w=cell*sc, h=cell*sc, dx=px+(TS*n)/2-(box[0]+box[2]/2)*sc, dy=py+TS*n*0.97-(box[1]+box[3])*sc;
      ctx.save(); ctx.globalAlpha=opts&&opts.alpha!==undefined?opts.alpha:1; ctx.imageSmoothingEnabled=true;
      ctx.fillStyle='rgba(12,10,18,0.35)'; ctx.beginPath(); ctx.ellipse(px+TS*n/2, py+TS*n-TS*0.18, TS*n*0.36, TS*0.16, 0, 0, 7); ctx.fill();
      if(opts&&opts.flip){ ctx.translate(px+TS*n/2,0); ctx.scale(-1,1); ctx.translate(-(px+TS*n/2),0); }
      ctx.drawImage(ms.img, fr.sx, fr.sy, cell, cell, dx, dy, w, h);
      if(opts&&opts.flash>0){ ctx.globalAlpha*=opts.flash; ctx.drawImage(whiteCut(ms.img,fr.sx,fr.sy,cell,cell), dx,dy,w,h); }
      ctx.restore();
      return true;
    }
  }
  return _drawCharacterBig(e, px, py, opts);
};

/* ---------------------------------------------------------------- swaying grass on the plane floors
   The dungeon's grass art does not belong in a cave, so plane grass is drawn as thin blades in the plane's greens,
   leaning together in a slow breeze. Blades are behind creatures, so nothing is hidden by them. */
function ptGrassBlades(x, y, now){
  var M=ptMat(); if(!M || !M.moss) return;
  var t=ANIM.reduce ? 0 : now/1000, base=(x-camX)*TS, top=(y-camY)*TS;
  var n=5+Math.floor(hash2(x,y,41)*4);
  ctx.save();
  for(var k=0;k<n;k++){
    var fx=0.12+hash2(x,y,50+k)*0.76, fy=0.55+hash2(x,y,60+k)*0.42, h=TS*(0.3+hash2(x,y,70+k)*0.34);
    var px=base+fx*TS, py=top+fy*TS;
    var sway=Math.sin(t*1.1 + hash2(x,y,80+k)*6.28 + x*0.6 + y*0.35)*TS*0.11;
    var col=M.moss[Math.floor(hash2(x,y,90+k)*M.moss.length)];
    ctx.strokeStyle='rgb('+col[0]+','+col[1]+','+col[2]+')';
    ctx.lineWidth=Math.max(1, TS*0.045); ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(px, py); ctx.quadraticCurveTo(px+sway*0.4, py-h*0.6, px+sway, py-h); ctx.stroke();
    if(k%3===0){ ctx.strokeStyle='rgba(220,240,180,0.5)'; ctx.lineWidth=Math.max(1, TS*0.02);
      ctx.beginPath(); ctx.moveTo(px+sway*0.5, py-h*0.55); ctx.lineTo(px+sway, py-h); ctx.stroke(); }
  }
  ctx.restore();
}
var _drawGrassTilePT = drawGrassTile;
drawGrassTile = function(x, y, px, py, alpha, layer, now){
  if(!ptMat()) return _drawGrassTilePT(x, y, px, py, alpha, layer, now);
  if(layer==='front') return;                                  /* blades never cover a creature */
  ctx.globalAlpha=alpha; ptGrassBlades(x, y, now||performance.now()); ctx.globalAlpha=1;
};
