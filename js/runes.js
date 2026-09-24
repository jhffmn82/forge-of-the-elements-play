/* =====================================================================
   runes.js - sigils are rune stones (2026-09-17).
   Each sigil type is a pale stone carved with an Elder Futhark rune that glows blue, and gives off a soft
   blue light on the floor. The rune for each sigil is shuffled every run. The three rarest sigils (Aegis,
   Ascension, Wisdom) are dark stones carved with bind-runes: made-up glyphs fused from two runes.
   All art is drawn here into one canvas atlas, so ground, bag and hotbar share it.
   ===================================================================== */

/* glyphs on a 10 x 14 grid, as polylines */
var RUNES = {
  fehu:[[[3,1],[3,13]],[[3,5],[7,1]],[[3,8],[7,4]]],
  uruz:[[[3,13],[3,1],[8,5],[8,13]]],
  thurisaz:[[[3,1],[3,13]],[[3,4],[7,7],[3,10]]],
  ansuz:[[[4,1],[4,13]],[[4,1],[8,4]],[[4,5],[8,8]]],
  raidho:[[[3,13],[3,1],[7,4],[3,7],[7,13]]],
  kenaz:[[[7,2],[3,7],[7,12]]],
  gebo:[[[2,2],[8,12]],[[8,2],[2,12]]],
  wunjo:[[[3,13],[3,1],[7,4],[3,7]]],
  hagalaz:[[[2,1],[2,13]],[[8,1],[8,13]],[[2,5],[8,9]]],
  nauthiz:[[[5,1],[5,13]],[[2,5],[8,9]]],
  isa:[[[5,1],[5,13]]],
  jera:[[[5,1],[8,4],[5,7]],[[5,7],[2,10],[5,13]]],
  eihwaz:[[[5,1],[5,13]],[[5,1],[8,4]],[[5,13],[2,10]]],
  perthro:[[[8,2],[5,4],[3,1],[3,13],[5,10],[8,12]]],
  elhaz:[[[5,1],[5,13]],[[5,6],[2,2]],[[5,6],[8,2]]],
  sowilo:[[[7,1],[3,6],[7,8],[3,13]]],
  tiwaz:[[[5,1],[5,13]],[[5,1],[2,5]],[[5,1],[8,5]]],
  berkana:[[[3,1],[3,13]],[[3,1],[7,4],[3,7],[7,10],[3,13]]],
  ehwaz:[[[2,13],[2,1],[5,5],[8,1],[8,13]]],
  mannaz:[[[2,13],[2,1],[8,7]],[[8,13],[8,1],[2,7]]],
  laguz:[[[3,1],[3,13]],[[3,1],[7,5]]],
  ingwaz:[[[3,1],[7,5],[3,9],[7,13]],[[7,1],[3,5],[7,9],[3,13]]],
  dagaz:[[[2,2],[2,12],[8,2],[8,12],[2,2]]],
  othala:[[[5,1],[8,5],[2,13]],[[5,1],[2,5],[8,13]]],
  /* bind-runes (invented) */
  starbind:[[[5,1],[5,13]],[[5,1],[2,4]],[[5,1],[8,4]],[[8,6],[3,9],[8,12]]],
  crossbind:[[[2,2],[8,12]],[[8,2],[2,12]],[[5,1],[5,13]],[[2,7],[8,7]]],
  rootbind:[[[5,1],[5,13]],[[5,5],[2,1]],[[5,5],[8,1]],[[5,9],[2,13]],[[5,9],[8,13]]]
};
var FUTHARK = ['fehu','uruz','thurisaz','ansuz','raidho','kenaz','gebo','wunjo','hagalaz','nauthiz','isa','jera','eihwaz','perthro','elhaz','sowilo','tiwaz','berkana','ehwaz','mannaz','laguz','ingwaz','dagaz','othala'];
var BIND_RUNES = ['starbind','crossbind','rootbind'];
var BIND_NAMES = {starbind:'Star-bound', crossbind:'Cross-bound', rootbind:'Root-bound'};
var RARE_SIGILS = ['aegis','ascension','wisdom'];
function runeTitle(look){ return BIND_NAMES[look] ? BIND_NAMES[look]+' rune' : cap(look)+' rune'; }

/* ---------------------------------------------------------------- the atlas */
var RUNE_ATLAS = null, RUNE_CELL = 64;
function runeAtlas(){
  if(RUNE_ATLAS) return RUNE_ATLAS;
  var names=FUTHARK.concat(BIND_RUNES), C=RUNE_CELL, cv2=document.createElement('canvas');
  cv2.width=C*names.length; cv2.height=C;
  var g=cv2.getContext('2d'), pos={};
  names.forEach(function(n, i){
    var ox=i*C, dark=BIND_RUNES.indexOf(n)>=0, h=function(k){ var v=Math.sin((i+1)*12.9898+k*78.233)*43758.5453; return v-Math.floor(v); };
    /* the stone: a rounded, slightly uneven tablet */
    var w=C*0.62, hh=C*0.78, x0=ox+(C-w)/2, y0=(C-hh)/2+1, r=C*0.13;
    function tablet(inset){
      var jx=[h(1),h(2),h(3),h(4)].map(function(v){ return (v-0.5)*2.2; });
      g.beginPath();
      g.moveTo(x0+r+inset, y0+inset+jx[0]);
      g.lineTo(x0+w-r-inset, y0+inset+jx[1]*0.5); g.quadraticCurveTo(x0+w-inset+jx[1]*0.4, y0+inset, x0+w-inset+jx[1]*0.4, y0+r+inset);
      g.lineTo(x0+w-inset+jx[2]*0.4, y0+hh-r-inset); g.quadraticCurveTo(x0+w-inset, y0+hh-inset+jx[2]*0.4, x0+w-r-inset, y0+hh-inset+jx[2]*0.4);
      g.lineTo(x0+r+inset, y0+hh-inset+jx[3]*0.4); g.quadraticCurveTo(x0+inset+jx[3]*0.4, y0+hh-inset, x0+inset+jx[3]*0.4, y0+hh-r-inset);
      g.lineTo(x0+inset+jx[0]*0.4, y0+r+inset); g.quadraticCurveTo(x0+inset, y0+inset, x0+r+inset, y0+inset+jx[0]);
      g.closePath();
    }
    /* no tablet: the sigil is a glyph of light, so only the faintest wash sits behind it for contrast */
    g.save();
    var wash=g.createRadialGradient(x0+w/2, y0+hh/2, 1, x0+w/2, y0+hh/2, Math.max(w,hh)*0.6);
    wash.addColorStop(0, dark ? 'rgba(40,30,60,0.32)' : 'rgba(24,40,58,0.26)');
    wash.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle=wash; g.fillRect(x0, y0, w, hh);
    g.restore();
    /* the rune: a carved groove, then the glow inside it */
    var gx=x0+w*0.18, gy=y0+hh*0.12, sx=(w*0.64)/10, sy=(hh*0.76)/14;
    function strokeRune(){ RUNES[n].forEach(function(line){ g.beginPath(); line.forEach(function(p, j){ var X=gx+p[0]*sx, Y=gy+p[1]*sy; if(j) g.lineTo(X,Y); else g.moveTo(X,Y); }); g.stroke(); }); }
    g.save(); g.lineCap='round'; g.lineJoin='round'; g.globalCompositeOperation='lighter';
    /* three passes: a wide soft haze, the body of the glyph, then a bright core */
    g.shadowColor = dark ? '#B9A2FF' : '#6FC4FF'; g.shadowBlur=C*0.34;
    g.globalAlpha=0.38; g.strokeStyle = dark ? '#7A5CD8' : '#3D8FD8'; g.lineWidth=C*0.1; strokeRune();
    g.shadowBlur=C*0.18; g.globalAlpha=0.8; g.strokeStyle = dark ? '#C9B8FF' : '#8FD6FF'; g.lineWidth=C*0.05; strokeRune();
    g.shadowBlur=C*0.06; g.globalAlpha=0.95; g.strokeStyle = dark ? 'rgba(248,244,255,0.95)' : 'rgba(232,250,255,0.95)'; g.lineWidth=C*0.018; strokeRune();
    g.restore();
    pos[n]=ox;
  });
  RUNE_ATLAS={img:cv2, pos:pos};
  return RUNE_ATLAS;
}

function runeObjectArt(group, name){
  if(name && name.indexOf('rune-')===0){
    var A=runeAtlas(), n=name.slice(5);
    if(A.pos[n]===undefined) return false;   /* not a sigil rune (rune-stone-light and friends are props) */
    return {img:A.img, sx:A.pos[n]+RUNE_CELL*0.16, sy:RUNE_CELL*0.08, sw:RUNE_CELL*0.68, sh:RUNE_CELL*0.84};
  }
  return false;

}

/* ---------------------------------------------------------------- which rune each sigil wears this run */
function assignRunes(r){
  var fut=FUTHARK.slice(), bind=BIND_RUNES.slice();
  function shuffle(a){ for(var i=a.length-1;i>0;i--){ var j=Math.floor(r()*(i+1)), t=a[i]; a[i]=a[j]; a[j]=t; } }
  shuffle(fut); shuffle(bind);
  var looks={}, fi=0, bi=0;
  Object.keys(SIGILS).forEach(function(k){ looks[k] = RARE_SIGILS.indexOf(k)>=0 ? bind[bi++ % bind.length] : fut[fi++ % fut.length]; });
  return looks;
}
shuffleSigils = function(){
  sigilLook={}; sigilKnown={};
  RUN.sigilLooks = assignRunes(mulberry32((worldSeed^0x1234567)>>>0));
  Object.keys(SIGILS).forEach(function(k){ sigilLook[k]=runeTitle(RUN.sigilLooks[k]); sigilKnown[k]=false; });
};
/* an older save still wearing the old looks: give it runes, keep what the player had learned */
function ensureRuneLooks(){
  if(!RUN) return;
  var ok = RUN.sigilLooks && Object.keys(SIGILS).every(function(k){ return RUNES[RUN.sigilLooks[k]]; });
  if(!ok) RUN.sigilLooks = assignRunes(mulberry32((worldSeed^0x1234567)>>>0));
  Object.keys(SIGILS).forEach(function(k){ sigilLook[k]=runeTitle(RUN.sigilLooks[k]); if(sigilKnown[k]===undefined) sigilKnown[k]=false; });
  (player.bag||[]).forEach(function(b){ if(b.kind==='sigil' && b.data) b.name=sigilName(b.data.use); });
}
sigilArtName = function(use){ var look=RUN && RUN.sigilLooks && RUN.sigilLooks[use]; return look && RUNES[look] ? 'rune-'+look : 'item-sigil'; };

/* soft blue light around a rune stone lying on the floor */

function addSigilLights(L, now, prp){
  items.forEach(function(it){
    if(it.kind!=='sigil' || !(revealAll||vis[idxOf(it.x,it.y)])) return;
    var use=it.use || (it.it && it.it.use), rare=RARE_SIGILS.indexOf(use)>=0, fl=ANIM.reduce ? 1 : 1+0.08*Math.sin(now/400+it.x*2+it.y);
    L.push({x:it.x, y:it.y, c:hexRGB(rare ? '#B9A2FF' : '#6FC4FF'), r:2.4, s:0.6*fl, tx:it.x, ty:it.y});
  });
  return L;

}
ITEM_FIT.sigil = 0.56;
