/* objanim.js - small animations on map objects (2026-09-19).
   Every art object now carries its name, and the two routines that draw objects (drawObj for the dungeon's
   props, traps, chests and structures; drawCaveArt for the Caverns pieces) report the rectangle they drew.
   An object whose name matches a rule below gets its effect drawn on top: a pulsing glow, twinkling glints,
   a live flame, rising mist or embers, lightning arcs, drips.
   The effects find their own anchors by reading the art: the brightest pixels are the glints and the glow's
   centre and colour, the warm ones are where a flame burns, the lowest tips are where drips fall from - so
   new art gets the right placement without measuring each sprite by hand. Respects Options > Motion. */
var OBJ_FX_RULES = [
  [/^table-candle$/,                           ['flicker']],            /* the art paints its own flame: flicker its light */
  [/^kobold-campfire$/,                        ['flicker', 'embers']],
  [/^plate-glow$/,                             ['glow']],
  [/^trap-fire$/,                              ['flicker', 'embers']],
  [/^trap-gas$/,                               ['mist']],
  [/^(elemental-lock|chest-crystal|chest-elemental)$/, ['twinkle']],
  [/^ice-block$/,                              ['twinkle']],
  [/^(giant-mushroom|mushroom-pair)/,          ['glow', 'spores']],
  [/^(cl-small-mushrooms|cl-glow-moss)/,       ['glow']],
  [/^(cl-crystal-shards|geode|cl-cave-pearls)/,['twinkle']],
  [/^pylon/,                                   ['glow', 'arcs']],
  [/^wf-glowworm-curtain/,                     ['twinkle']],
  [/^wf-stalactite-drapery/,                   ['drip']],
  [/^glowing-pool/,                            ['twinkle', 'glow']]
];
function objFxFor(name){
  if(!name) return null;
  for(var i=0;i<OBJ_FX_RULES.length;i++) if(OBJ_FX_RULES[i][0].test(name)) return OBJ_FX_RULES[i][1];
  return null;
}

/* ---------------------------------------------------------------- reading the art once per object */
var OBJ_FX_INFO = {};
function objFxInfo(o){
  var key=o.nm; if(OBJ_FX_INFO[key]) return OBJ_FX_INFO[key];
  var W=Math.max(1,o.sw|0), H=Math.max(1,o.sh|0), info={bright:[], warm:null, green:null, tips:[], glow:null};
  try{
    var c=document.createElement('canvas'); c.width=W; c.height=H;
    var g=c.getContext('2d'); g.drawImage(o.img, o.sx, o.sy, o.sw, o.sh, 0, 0, W, H);
    var D=g.getImageData(0,0,W,H).data, cand=[], wx=0, wy=0, wn=0, wtop=H, gx=0, gy=0, gn=0, sr=0, sg=0, sb=0, sw=0, lowest={};
    for(var y=0;y<H;y++) for(var x=0;x<W;x++){
      var p=(y*W+x)*4, r=D[p], gg=D[p+1], b=D[p+2], a=D[p+3]; if(a<160) continue;
      lowest[x]=y;
      var mx=Math.max(r,gg,b), mn=Math.min(r,gg,b), v=mx, sat=mx ? (mx-mn)/mx : 0;
      if(v>170 && (sat>0.35 || v>225)){ cand.push([x,y,v]); sr+=r*v; sg+=gg*v; sb+=b*v; sw+=v; }
      if(r>200 && gg>110 && b<120 && r>b+80){ wx+=x; wy+=y; wn++; if(y<wtop) wtop=y; }
      if(gg>r+25 && gg>b+10 && v>90){ gx+=x; gy+=y; gn++; }
    }
    cand.sort(function(A,B){ return B[2]-A[2]; });
    for(var k=0;k<cand.length && info.bright.length<7;k++){      /* spaced-out glints */
      var q=cand[k]; if(info.bright.every(function(e){ return Math.abs(e[0]-q[0])+Math.abs(e[1]-q[1])>=4; })) info.bright.push([q[0]/W, q[1]/H]);
    }
    if(sw){ var mxs=0, mys=0; cand.forEach(function(q){ mxs+=q[0]*q[2]; mys+=q[1]*q[2]; });
      info.glow={x:mxs/sw/W, y:mys/sw/H, col:[Math.round(sr/sw), Math.round(sg/sw), Math.round(sb/sw)], n:cand.length/(W*H)}; }
    if(wn) info.warm={x:wx/wn/W, y:wtop/H};
    if(gn) info.green={x:gx/gn/W, y:gy/gn/H};
    var cols=Object.keys(lowest).map(Number).sort(function(A,B){ return lowest[B]-lowest[A]; });
    for(var j=0;j<cols.length && info.tips.length<3;j++){ var cx=cols[j]; if(info.tips.every(function(e){ return Math.abs(e[0]*W-cx)>=5; })) info.tips.push([cx/W, (lowest[cx]+1)/H]); }
  }catch(e){ /* a tainted or missing image just means no effect */ }
  return (OBJ_FX_INFO[key]=info);
}

/* ---------------------------------------------------------------- drawing the effects */
function objFxDraw(o, dx, dy, w, h, alpha, flip){
  if(!o || !o.nm || typeof ANIM==='undefined' || ANIM.reduce || !(alpha>0.5)) return;
  var fx=objFxFor(o.nm); if(!fx) return;
  var I=objFxInfo(o), now=performance.now(), t=now/1000;
  var seed=hash2(Math.round(dx/TS+camX), Math.round(dy/TS+camY), 77)*100;
  function X(f){ return dx + (flip ? 1-f : f)*w; } function Y(f){ return dy + f*h; }
  var u=Math.max(1, Math.round(TS/32));
  ctx.save();
  fx.forEach(function(k){
    if((k==='glow' || k==='flicker') && I.glow){
      var puls = k==='flicker' ? 0.55+0.25*Math.sin(t*9+seed)+0.2*Math.sin(t*23+seed*2) : 0.6+0.4*Math.sin(t*1.7+seed);
      var r=Math.max(w,h)*(0.35+Math.min(0.4, I.glow.n*3)), c=I.glow.col;
      var gr=ctx.createRadialGradient(X(I.glow.x), Y(I.glow.y), 0, X(I.glow.x), Y(I.glow.y), r);
      gr.addColorStop(0, 'rgba('+c[0]+','+c[1]+','+c[2]+','+(0.28*puls*alpha)+')'); gr.addColorStop(1, 'rgba('+c[0]+','+c[1]+','+c[2]+',0)');
      ctx.globalCompositeOperation='lighter'; ctx.fillStyle=gr; ctx.fillRect(X(I.glow.x)-r, Y(I.glow.y)-r, r*2, r*2); ctx.globalCompositeOperation='source-over';
    }
    if(k==='twinkle'){
      I.bright.forEach(function(b, i){
        var ph=((t*0.45 + hash2(i, seed|0, 5)) % 1), a=Math.pow(Math.sin(Math.PI*ph), 6);
        if(a<0.05) return;
        var x=Math.round(X(b[0])), y=Math.round(Y(b[1]));
        ctx.globalAlpha=a*alpha; ctx.fillStyle='#FFFFFF';
        ctx.fillRect(x-u/2, y-u*1.5, u, u*3); ctx.fillRect(x-u*1.5, y-u/2, u*3, u);
      });
    }
    if(k==='flame' && I.warm && typeof drawPixelFlame==='function'){
      var fh = /campfire/.test(o.nm) ? TS*0.42 : TS*0.16;
      drawPixelFlame(X(I.warm.x), Y(I.warm.y)+u*2, fh, /campfire/.test(o.nm) ? 1.6 : 0.8, alpha, now, seed);
    }
    if(k==='embers' || k==='spores' || k==='mist'){
      var src = k==='mist' ? (I.green||I.glow) : k==='embers' ? (I.warm||I.glow) : I.glow; if(!src) return;
      var n = k==='mist' ? 5 : 3, col = k==='mist' ? '#7CE08A' : k==='embers' ? '#FFB050' : (I.glow ? 'rgb('+I.glow.col.join(',')+')' : '#CFF');
      for(var i=0;i<n;i++){
        var ph=((t*(k==='mist'?0.35:0.5) + i/n + seed*0.013) % 1);
        var x=X(src.x) + Math.sin(t*1.3 + i*2.1 + seed)*w*0.12*(k==='mist'?1.6:1), y=Y(src.y) - ph*h*(k==='mist'?0.6:0.8);
        ctx.globalAlpha=(1-ph)*(k==='mist'?0.35:0.8)*alpha; ctx.fillStyle=col;
        if(k==='mist'){ ctx.beginPath(); ctx.arc(x, y, u*(2+ph*4), 0, 7); ctx.fill(); } else ctx.fillRect(Math.round(x), Math.round(y), u, u);
      }
    }
    if(k==='arcs' && I.bright.length>=2){
      if(((t*2.2+seed) % 1) < 0.35){                         /* a crackle now and then */
        var a0=I.bright[0], a1=I.bright[1+Math.floor(((t*7)|0) % (I.bright.length-1))];
        ctx.globalAlpha=0.9*alpha; ctx.strokeStyle='#F4F8FF'; ctx.lineWidth=Math.max(1,u); ctx.beginPath();
        var x0=X(a0[0]), y0=Y(a0[1]), x1=X(a1[0]), y1=Y(a1[1]); ctx.moveTo(x0,y0);
        for(var s=1;s<5;s++){ var f=s/5; ctx.lineTo(x0+(x1-x0)*f+(hash2(s,(t*20)|0,9)-0.5)*TS*0.18, y0+(y1-y0)*f+(hash2(s,(t*20)|0,11)-0.5)*TS*0.18); }
        ctx.lineTo(x1,y1); ctx.stroke();
      }
    }
    if(k==='drip'){
      I.tips.forEach(function(tp, i){
        var period=2.4+hash2(i, seed|0, 3)*2.5, ph=((t/period + hash2(i, seed|0, 4)) % 1);
        if(ph>0.35) return;                                   /* most of the time the drop is gathering */
        var fall=ph/0.35;
        ctx.globalAlpha=(1-fall*0.6)*0.9*alpha; ctx.fillStyle='#9FD8FF';
        ctx.fillRect(Math.round(X(tp[0])), Math.round(Y(tp[1]) + fall*fall*TS*0.9), u, u*2);
      });
    }
  });
  ctx.restore();
}

/* ---------------------------------------------------------------- hooks */
var _objArtFx = objArt;
objArt = function(group, name){ var o=_objArtFx(group, name); if(o) o.nm=name; return o; };
var _drawObjFx = drawObj;
drawObj = function(o, px, py, opt){
  var r=_drawObjFx(o, px, py, opt);
  if(r && o && o.nm && objFxFor(o.nm)){
    opt=opt||{};
    var fit=(opt.fit||0.92)*TS, s=Math.min(fit/o.sw, fit/o.sh); if(opt.fill) s=Math.max(TS/o.sw, TS/o.sh);
    var w=o.sw*s, h=o.sh*s*(1+(opt.sy||0)), dx=px+(TS-w)/2, dy= opt.feet ? py+TS*(opt.base||0.96)-h : py+(TS-h)/2;
    objFxDraw(o, dx, dy, w, h, opt.alpha===undefined?1:opt.alpha, !!opt.flip);
  }
  return r;
};
if(typeof caveArt==='function'){
  var _caveArtFx = caveArt;
  caveArt = function(name){ var o=_caveArtFx(name); if(o) o.nm=name; return o; };
  var _drawCaveArtFx = drawCaveArt;
  drawCaveArt = function(o, cx, bottom, alpha, flipX){
    var r=_drawCaveArtFx(o, cx, bottom, alpha, flipX);
    if(o && o.nm && objFxFor(o.nm)){
      var s=TS/64, left=cx-o.fullW*s/2, top=bottom-o.fullH*s, dx=left+o.ox*s, w=o.sw*s;
      if(flipX) dx = 2*cx - (dx+w);
      objFxDraw(o, dx, top+o.oy*s, w, o.sh*s, alpha, !!flipX);
    }
    return r;
  };
}
/* the new candle-table art paints its own candle: the live flame finds the painted one instead of a fixed spot */
if(typeof FLAME_AT!=='undefined') delete FLAME_AT['table-candle'];
