/* =====================================================================
   cryptpack.js - the Crypt and elemental-plane art rebuild (2026-09-19, art/incoming/Crypt-Planes-Rebuild).
   The new pieces are painted square to the grid at 64 px a tile, already in the Crypt's and each plane's palette,
   standing on the bottom of their canvas. So they are drawn as they are:
     - at their natural size (one canvas pixel = TS/64), bottom-centred on their footprint and set down by the
       art's own solid bottom (the few empty rows under a piece would leave it hovering over its shadow);
     - never regraded or tinted: the old tomb regrade (cryptrooms.js crGraded), the plane-stone retint
       (planeterrain.js ptPropTint) and the procedural stone redraws (cryptprops.js: 2-cell sarcophagi, tomb
       pieces, pedestals standing in for grave posts, pillars and sarcophagi) give way to the pack's art;
     - composed groups give way to the pack's clusters: urn groups -> urn-groups-1..4, bones -> bone-piles-1..4,
       the old urn-cluster pair -> urn-groups; the arched wall recess -> the wall niche between two plaques;
     - the planes' procedural crystal groups at the cave walls become the pack's crystals and stalagmites
       (amber crystals and the new earth stalagmite on the Earth plane).
   New scenery on ordinary Crypt floors: candle clusters (with a small warm light), grave flowers and moss in
   joined streaks of 3-4 tiles along walls (never a lone tuft), cobwebs in upper room corners, and the odd plaque or
   burial niche set into a room's upper wall - placed by the designer's rules further down.
   Every piece reports the rect it drew to objFxDraw (objanim.js) for its flicker / glow / twinkle.
   ===================================================================== */

var PACK_CRYPT = {};
['tomb-h','tomb-v','tomb-open-h','tomb-crumbled-h','tomb-crumbled-v','tomb-rune','dais-sarcophagus','grave-monument','grave-post',
 'stairs-wide','rubble','wall-niche','wall-plaque','wall-cobweb','sarcophagus','sarcophagus-open','grave-pillar','coffin'].forEach(function(n){ PACK_CRYPT[n]=1; });
['urn-groups','bone-piles','candles','grave-flowers-moss'].forEach(function(c){ for(var i=1;i<=4;i++) PACK_CRYPT[c+'-'+i]=1; });
var PACK_PLANE = {};
['rune-stone-light','rune-stone-shadow','rune-stone-earth','stalagmite-light','stalagmite-shadow','stalagmite-earth','crystal-gold','crystal-violet',
 'crystal-amber','crystal-gold-small','crystal-violet-small','crystal-amber-small','sun-dais','stepping-stone','mossy-boulder','fern','root-tangle',
 'glow-mushrooms'].forEach(function(n){ PACK_PLANE[n]=1; });

/* the walkable clusters and wall pieces */
['candles-1','candles-2','candles-3','candles-4','grave-flowers-moss-1','grave-flowers-moss-2','grave-flowers-moss-3','grave-flowers-moss-4','wall-cobweb']
  .forEach(function(n){ PROPS[n]={flat:1}; });
PROPS['wall-plaque']={b:1}; PROPS['wall-niche']=PROPS['wall-niche']||{b:1};
['crystal-amber','crystal-amber-small','crystal-violet-small','stalagmite-earth'].forEach(function(n){ PROPS[n]=PROPS[n]||{flat:1}; });

function packCryptOn(){ return typeof inCrypt==='function' && inCrypt() && !(floorMeta && floorMeta.plane); }
function packPlaneOn(){ return !!(floorMeta && floorMeta.plane) && typeof ptMat==='function' && !!ptMat(); }

/* ---------------------------------------------------------------- art lookup: the full canvas, not just the trimmed box */
function packArt(name){
  var g=AS.map && AS.map.set, sheet='map-set.png', b=g && g.items[name];
  if(!b || PACK_PLANE[name]){ g=AS.map && AS.map.planeset; sheet='map-planeset.png'; b=g && g.items[name]; }
  if(!b && PACK_CRYPT[name] && AS.map && AS.map.props && AS.map.props.items[name]){   /* a 64x64 Crypt prop lives in the props grid */
    var c=AS.map.props.items[name], cell=AS.map.props.cell||64, img0=atl('map-props.png'); if(!img0) return null;
    return {img:img0, sx:c[0]+c[2], sy:c[1]+c[3], sw:Math.max(1,c[4]), sh:Math.max(1,c[5]), fullW:cell, fullH:cell, ox:c[2], oy:c[3], nm:name};
  }
  if(!b) return null;
  var img=atl(sheet); if(!img) return null;
  return {img:img, sx:b[0]+b[2], sy:b[1]+b[3], sw:Math.max(1,b[4]), sh:Math.max(1,b[5]), fullW:b[6], fullH:b[7], ox:b[2], oy:b[3], nm:name};
}
/* the pack's pieces come straight from the sheet (no regrade), and the plane sheet answers setArt too */
var _setArtPack = setArt;
setArt = function(name){
  if(PACK_CRYPT[name] || PACK_PLANE[name]){ var o=packArt(name); if(o) return o; }
  return _setArtPack(name);
};
/* the plane stones are painted in each plane's palette now: no retint */
if(typeof PT_STONE_PROPS!=='undefined') for(var _k in PT_STONE_PROPS) delete PT_STONE_PROPS[_k];

/* empty canvas rows under the solid art (canvas px), read once per piece, as caveBottomPad does */
var PACK_PAD = {};
function packBottomPad(o){
  if(PACK_PAD[o.nm]!==undefined) return PACK_PAD[o.nm];
  var pad=0;
  try{
    var c=document.createElement('canvas'); c.width=o.sw; c.height=o.sh; var g=c.getContext('2d');
    g.drawImage(o.img, o.sx, o.sy, o.sw, o.sh, 0, 0, o.sw, o.sh);
    var D=g.getImageData(0,0,o.sw,o.sh).data, lowest=-1;
    for(var y=o.sh-1; y>=0 && lowest<0; y--){ var n=0; for(var x=0;x<o.sw;x++) if(D[(y*o.sw+x)*4+3]>=140) n++; if(n>=3) lowest=y; }
    pad = lowest<0 ? 0 : o.fullH - (o.oy + lowest + 1);
  }catch(e){ pad=0; }
  return (PACK_PAD[o.nm]=Math.max(0, pad));
}

/* ---------------------------------------------------------------- which art a prop draws with */
function packVariant(p, salt){ return 1 + Math.floor(hash2(p.x, p.y, salt)*4) % 4; }
function packNameFor(p){
  var n=p.name;
  if(n==='crystal-violet' && !packPlaneOn() && p.flat) return 'crystal-violet-small';   /* the puzzle-treasure marker: the new crystal-violet is 1.5 tiles tall */
  if(packPlaneOn()){
    if(n==='pt-cluster') return packPlaneCluster(p);
    return PACK_PLANE[n] ? n : null;
  }
  if(!packCryptOn()) return null;
  if(n==='sarc'){
    var h=!!p.horiz, k=p.kind||'intact';
    return k==='open' ? (h ? 'tomb-open-h' : 'tomb-crumbled-v') : k==='cracked' ? (h ? 'tomb-crumbled-h' : 'tomb-crumbled-v') : (h ? 'tomb-h' : 'tomb-v');
  }
  if(n==='urn-group') return 'urn-groups-'+(1+((p.pattern||0)+(p.flip?1:0))%4);
  if(n==='urn-cluster') return 'urn-groups-'+packVariant(p, 61);
  if(n==='bones' || n==='bone-pile'){ var hb=hash2(p.x, p.y, 63); return 'bone-piles-'+(hb<0.35 ? 1 : hb<0.7 ? 3 : hb<0.85 ? 2 : 4); }   /* the two big piles (2, 4) more rarely */
  if(n==='rubble') return p.set ? 'rubble' : null;           /* loose rubble stays a pebble scatter in the floor (surface.js) */
  return PACK_CRYPT[n] ? n : null;
}
/* the planes' wall formations: a crystal or a stalagmite of this plane for the big one, small crystals beside it */
var PACK_PLANE_KIT = {light:['crystal-gold','crystal-gold-small','stalagmite-light'], shadow:['crystal-violet','crystal-violet-small','stalagmite-shadow'], earth:['crystal-amber','crystal-amber-small','stalagmite-earth']};
function packPlaneCluster(p){
  var K=PACK_PLANE_KIT[floorMeta.plane]; if(!K) return null;
  if((p.size||1)<1) return K[1];
  return hash2(p.seed||0, p.x, 67)<0.45 ? K[2] : K[0];
}

/* ---------------------------------------------------------------- drawing at natural size */
function packDraw(p, name, alpha){
  var o=packArt(name); if(!o) return false;
  var s=TS/64, w=p.w||1, h=p.h||1, fw=o.fullW*s, fh=o.fullH*s;
  var left=(p.x-camX)*TS + (w*TS-fw)/2, bottom=(p.y-camY+h)*TS;
  var flip=false, flat=!!p.flat || !p.b;
  if(name==='wall-cobweb'){ flip=!!p.webLeft; }
  else if(/^(grave-flowers-moss|bone-piles)-/.test(name)) flip=hash2(p.x,p.y,65)<0.5;
  if(p.name==='pt-cluster' && p.wallDir) left+=p.wallDir[0]*TS*0.28;       /* leans into the wall it grows from */
  bottom += packBottomPad(o)*s;
  if(p.wall) bottom=(p.y-camY+1)*TS + packBottomPad(o)*s;                   /* set into the wall face, on the floor line */
  var dx=Math.round(left+o.ox*s), dy=Math.round(bottom-fh+o.oy*s), dw=Math.round(o.sw*s), dh=Math.round(o.sh*s);
  ctx.save(); ctx.globalAlpha=alpha; ctx.imageSmoothingEnabled=false;
  if(!flat && !p.wall){   /* the pack paints no cast shadow: a soft contact shadow under what stands on the floor */
    var sy=(p.y-camY+h)*TS-TS*0.08;
    ctx.fillStyle='rgba(8,6,12,0.32)'; ctx.beginPath(); ctx.ellipse(dx+dw/2, sy, dw*0.46, TS*0.13, 0, 0, 7); ctx.fill();
  }
  if(flip){ ctx.translate(dx+dw/2, 0); ctx.scale(-1, 1); ctx.translate(-(dx+dw/2), 0); }
  ctx.drawImage(o.img, o.sx, o.sy, o.sw, o.sh, dx, dy, dw, dh);
  ctx.restore();
  if(typeof objFxDraw==='function') objFxDraw(o, dx, dy, dw, dh, alpha, flip);
  return true;
}
/* crypt recess: the burial niche in the middle of the three wall cells, a memorial plaque either side */
function packDrawRecess(p, alpha){
  var ok=packDraw({x:p.x, y:p.y, w:1, h:1, wall:true, b:1, name:'wall-niche'}, 'wall-niche', alpha);
  if(!ok) return false;
  [-1,1].forEach(function(d){ if(inb(p.x+d,p.y) && isWallLike(at(p.x+d,p.y))) packDraw({x:p.x+d, y:p.y, w:1, h:1, wall:true, b:1, name:'wall-plaque'}, 'wall-plaque', alpha); });
  return true;
}

/* the plane's big crystal outcrop (3x2, planeterrain.js) is built from the pack's pieces instead of procedural shards:
   a stalagmite and two big crystals along the back, two small crystals in front, varied per outcrop */
function packDrawOutcrop(p, alpha){
  var K=PACK_PLANE_KIT[floorMeta.plane]; if(!K || !packArt(K[0])) return false;
  var sd=p.seed||0, back=hash2(sd,1,71)<0.5 ? [K[2],K[0],K[0]] : [K[0],K[0],K[2]];
  function j(k, a){ return (hash2(sd, k, 73)-0.5)*a; }                        /* a little irregularity, fixed per outcrop */
  var parts=[
    {x:p.x+0.15+j(1,0.3), y:p.y-0.1+j(2,0.25), n:back[0]},
    {x:p.x+1+j(3,0.2),    y:p.y+j(4,0.2),      n:back[1]},
    {x:p.x+1.85+j(5,0.3), y:p.y-0.05+j(6,0.25), n:back[2]},
    {x:p.x+0.3+j(7,0.4),  y:p.y+0.9+j(8,0.15), n:K[1]},
    {x:p.x+1.5+j(9,0.5),  y:p.y+1+j(10,0.1),   n:K[1]}
  ];
  parts.forEach(function(q){ packDraw({x:q.x, y:q.y, w:1, h:1, b:1, name:'pt-part'}, q.n, alpha); });
  return true;
}

var _drawPropSurfacePack = drawPropSurface;
drawPropSurface = function(p, px, py, alpha){
  if(p.name==='crypt-recess' && packCryptOn() && packDrawRecess(p, alpha)) return true;
  if(p.name==='pt-outcrop' && packPlaneOn() && packDrawOutcrop(p, alpha)) return true;
  var nm=packNameFor(p);
  if(nm && packDraw(p, nm, alpha)){
    var now=performance.now();
    if(p.wisps && typeof drawSoulWisps==='function') drawSoulWisps(p, now);
    if(p.soulSmoke && typeof drawSoulSmoke==='function') drawSoulSmoke(p, now);
    return true;
  }
  return _drawPropSurfacePack(p, px, py, alpha);
};

/* the older set art (soul urns, single urns, doors) keeps its drawing, and now reports its rect for effects too */
var _drawSetPiecePack = drawSetPiece;
drawSetPiece = function(p, alpha){
  var nm=packNameFor(p);
  if(nm) return packDraw(p, nm, alpha);
  var r=_drawSetPiecePack(p, alpha);
  if(r && typeof objFxDraw==='function' && objFxFor(p.name)){
    var o=setArt(p.name);
    if(o && !p.half){
      var fit=p.wall ? 0.9 : 0.98, sc=Math.min((p.w*TS*fit)/o.sw, (p.h*TS*(p.w===1&&p.h===1?1.15:1.02))/o.sh);
      var dw=o.sw*sc, dh=o.sh*sc, dx=(p.x-camX)*TS+(p.w*TS-dw)/2, dy=p.wall ? (p.y-camY)*TS+(TS-dh)/2 : (p.y-camY+p.h)*TS-dh-TS*0.02;
      o.nm=p.name; objFxDraw(o, dx, dy, dw, dh, alpha, false);
    }
  }
  return r;
};

/* ---------------------------------------------------------------- the procedural stand-ins give way to the art
   cryptprops.js turns grave posts into pedestals, and sarcophagi / coffins / pillars into 2-cell sarcophagi or
   pedestals. Coffins and pillars now keep their own art; a pedestal that stood in for a grave post, a pillar or a
   sarcophagus with no room for two cells takes that piece's name back. Half the coffins still become 2-cell tombs. */
var _addPropPack = addProp;
addProp = function(x, y, name, extra){
  if(!packCryptOn()) return _addPropPack(x, y, name, extra);
  var mapped=(typeof CRYPT_PROP!=='undefined' && CRYPT_PROP[name]) || name;
  if((mapped==='grave-pillar' || (mapped==='coffin' && rng()<0.5)) && packArt(mapped) && !(extra && extra.cp))   /* half the coffins stay coffins: a row of them mixes with tombs */
    return _addPropPack(x, y, name, Object.assign({}, extra||{}, {cp:true}));   /* cp: skip the stand-in */
  var p=_addPropPack(x, y, name, extra);
  if(p && p.name==='pedestal'){
    if(name==='grave-post' && packArt('grave-post')){ p.name='grave-post'; p.set=true; p.w=1; p.h=1; p.b=1; }
    else if((mapped==='sarcophagus' || mapped==='sarcophagus-open' || mapped==='coffin') && packArt(mapped)){ p.name=mapped; p.b=1; }
  }
  return p;
};

/* ---------------------------------------------------------------- tall pieces hide whoever stands behind them
   (props are drawn before the creatures; this redraws a piece rising above its footprint when someone is behind it,
   the way cavefixes.js does for the Caverns) */
function packOccluders(){
  if(typeof props==='undefined' || !props.length) return;
  var bodies=ents.filter(function(e){ return e.hp>0 && (e===player || revealAll || vis[idxOf(e.x,e.y)]); });
  if(!bodies.length) return;
  props.forEach(function(p){
    if(p.flat || p.wall || !(revealAll||seen[idxOf(p.x,p.y)])) return;
    var nm=packNameFor(p); if(!nm) return;
    var o=packArt(nm); if(!o) return;
    var w=p.w||1, h=p.h||1, rise=Math.ceil((o.fullH-o.oy)/64 - 0.25) - h;
    if(rise<1) return;
    var hit=bodies.some(function(e){ var rp=renderPos(e); return rp.x>p.x-0.8 && rp.x<p.x+w-0.2 && rp.y<p.y-0.05 && rp.y>=p.y-rise-0.5; });
    if(!hit) return;
    drawPropSurface(p, (p.x-camX)*TS, (p.y-camY)*TS, (revealAll||vis[idxOf(p.x,p.y+h-1)])?1:0.45);
  });
}
var _drawOccludersPack = typeof drawOccluders==='function' ? drawOccluders : null;
drawOccluders = function(now){ if(_drawOccludersPack) _drawOccludersPack(now); if(packCryptOn() || packPlaneOn()) packOccluders(); };

/* the planes' crystal groups used to twinkle with their own sparkle; the pack's crystals twinkle through objanim */
var _ptSparklePack = typeof ptSparkle==='function' ? ptSparkle : null;
if(_ptSparklePack) ptSparkle = function(p, X, Y, W, H, alpha){ if(p.name==='pt-cluster' && packPlaneCluster(p)) return; return _ptSparklePack(p, X, Y, W, H, alpha); };

/* ---------------------------------------------------------------- new Crypt scenery on ordinary floors
   The designer's placement rules (2026-09-19, first set for the Caverns scatter):
   - scatter (urn groups, bone piles, candles) sits on floor bordering a wall, never out in the middle of a room;
   - grave flowers and moss only in joined streaks of 3-4 tiles, never a lone tuft;
   - big set pieces (tombs, the dais, monuments, stairs; rune stones and the sun dais on the planes) stand alone: no
     cluster or floor decal within one tile of their footprint;
   - sparse and varied: each Crypt floor uses only two of the four scatter kinds, and a room holds at most 0-2
     scatter groups (a flower streak counts as one);
   - what lies flat in the ground casts no contact shadow (packDraw).
   Placement follows them where it can, and packPlacementPass() enforces them once the floor is built, since
   converted props (barrels to urns, the dungeon's bone scatter) slip through. */
function packLight(x, y, col, r, s){ floorMeta.planeLights=floorMeta.planeLights||[]; floorMeta.planeLights.push({x:x, y:y, col:col, r:r, s:s}); }
function packWallAt(x, y){ return inb(x,y) && isWallLike(at(x,y)) && at(x,y)!==DOOR; }
function packFloorFree(x, y){ return inb(x,y) && freeCell(x,y) && !nearDoor(x,y) && !(typeof isOozeAt==='function' && isOozeAt(x,y)); }
function packWallSide(x, y){ return [[1,0],[-1,0],[0,1],[0,-1]].some(function(o){ var t=at(x+o[0],y+o[1]); return isWallLike(t) && !isDoorish(t); }); }
var PACK_BIG = /^(sarc|tomb-|dais-sarcophagus|grave-monument|stairs-wide|rune-stone-|sun-dais|pt-outcrop)/;
/* within one tile (8 ways) of a big set piece's footprint */
function packNearBig(x, y){
  for(var i=0;i<props.length;i++){
    var q=props[i]; if(!PACK_BIG.test(q.name)) continue;
    if(x>=q.x-1 && x<=q.x+(q.w||1) && y>=q.y-1 && y<=q.y+(q.h||1)) return true;
  }
  return false;
}
function packScatterSpot(x, y){ return packFloorFree(x,y) && packWallSide(x,y) && !packNearBig(x,y); }
/* a streak of 3-4 tiles of grave flowers and moss, from (x,y) along a wall; if three do not fit, nothing is put down */
function packMossStreak(x, y, d){
  var n=3+(rng()<0.5?1:0), cells=[];
  for(var i=0;i<n;i++){ var cx=x+d[0]*i, cy=y+d[1]*i; if(!packScatterSpot(cx,cy)) break; cells.push([cx,cy]); }
  if(cells.length<3) return 0;
  var v=Math.floor(rng()*4);
  cells.forEach(function(c, i){ addProp(c[0], c[1], 'grave-flowers-moss-'+(1+(v+i)%4), {keep:false}); });
  return cells.length;
}
function packDecorateRoom(r){
  if(r.w<3 || r.h<3) return;
  var edges=edgeCells(r).filter(function(c){ return packScatterSpot(c.x,c.y); });
  /* candles against a wall */
  if(rng()<0.45 && edges.length){ var s=pick(edges); addProp(s.x, s.y, 'candles-'+(1+Math.floor(rng()*4)), {keep:false}); }
  /* grave flowers and moss: a streak along a wall */
  if(rng()<0.5){
    var starts=edges.filter(function(c){ return packScatterSpot(c.x,c.y); });
    for(var t=0; t<6 && starts.length; t++){
      var c=starts.splice(Math.floor(rng()*starts.length),1)[0];
      var along = (c.y===r.y || c.y===r.y+r.h-1) ? [rng()<0.5?1:-1, 0] : [0, rng()<0.5?1:-1];
      if(packMossStreak(c.x, c.y, along)) break;
    }
  }
  /* a cobweb in an upper corner: drawn on the wall face above the corner, hugging the side wall */
  if(rng()<0.35){
    var right=rng()<0.5, cx=right ? r.x+r.w-1 : r.x, cy=r.y-1;
    if(packWallAt(cx,cy) && packWallAt(cx+(right?1:-1), cy) && packWallAt(cx+(right?1:-1), r.y) && at(cx, r.y)===FLOOR && !propAt(cx,cy))
      addProp(cx, cy, 'wall-cobweb', {wall:true, flat:1, b:0, webLeft:!right});
  }
  /* now and then a memorial plaque or a burial niche set into the upper wall */
  if(rng()<0.25 && r.w>=4){
    for(var k=0;k<5;k++){
      var wx=r.x+1+Math.floor(rng()*(r.w-2)), wy=r.y-1;
      if(!packWallAt(wx,wy) || !packWallAt(wx-1,wy) || !packWallAt(wx+1,wy) || at(wx,r.y)!==FLOOR || propAt(wx,wy) || nearDoor(wx,r.y) || packNearBig(wx,r.y)) continue;
      var kind=rng()<0.55 ? 'wall-plaque' : 'wall-niche';
      if(addProp(wx, wy, kind, {wall:true, b:1, keep:true}) && kind==='wall-plaque') packLight(wx, wy+0.9, '#7CFFA0', 1.8, 0.22);
      break;
    }
  }
}
var _decoratePlainPack = decoratePlain;
decoratePlain = function(r){
  _decoratePlainPack(r);
  if(packCryptOn() && !r.hall && packArt('candles-1')) packDecorateRoom(r);
};
/* the urn chamber: candles either side of the grave slab under the niche */
if(typeof buildUrnChamber==='function'){
  var _buildUrnChamberPack = buildUrnChamber;
  buildUrnChamber = function(r){
    _buildUrnChamberPack(r);
    if(!packCryptOn() || !packArt('candles-1')) return;
    var rec=props.filter(function(p){ return p.name==='crypt-recess' && p.x>=r.x && p.x<r.x+r.w && p.y===r.y-1; })[0];
    if(rec) [-1,1].forEach(function(d){ if(packFloorFree(rec.x+d, r.y) && rng()<0.75) addProp(rec.x+d, r.y, 'candles-'+(1+Math.floor(rng()*4)), {keep:false}); });
  };
}
/* Morty's hall: candles in the top chapel, cobwebs and plaques in the side chapels (the dais and the monument stand alone) */
if(typeof stampCryptHall==='function'){
  var _stampCryptHallPack = stampCryptHall;
  stampCryptHall = function(ox, oy, mode){
    var hall=_stampCryptHallPack(ox, oy, mode);
    if(!packArt('candles-1')) return hall;
    function P(x,y){ return {x:ox+x, y:oy+y}; }
    function put(x,y,name,extra){ var c=P(x,y); if(!inb(c.x,c.y) || propAt(c.x,c.y)) return null; return addProp(c.x, c.y, name, Object.assign({keep:true}, extra||{})); }
    [[10,3],[16,3]].forEach(function(q, i){ var c=put(q[0], q[1], 'candles-'+(i?4:2)); if(c && mode!=='boss') packLight(c.x, c.y+0.2, '#FFC878', 2.2, 0.32); });
    put(5,7,'wall-cobweb',{wall:true, flat:1, b:0, webLeft:false}); put(22,7,'wall-cobweb',{wall:true, flat:1, b:0, webLeft:true});
    if(put(1,7,'wall-plaque',{wall:true, b:1})) packLight(ox+1, oy+7.9, '#7CFFA0', 1.8, 0.22);
    if(put(25,7,'wall-plaque',{wall:true, b:1})) packLight(ox+25, oy+7.9, '#7CFFA0', 1.8, 0.22);
    return hall;
  };
}
/* the rune tomb's rune lights the floor in front of it, a little */
var _addSetPiecePack = addSetPiece;
addSetPiece = function(x, y, name, w, h, extra){
  var p=_addSetPiecePack(x, y, name, w, h, extra);
  if(p && name==='tomb-rune' && packCryptOn() && floorMeta) packLight(x, y+h-0.2, '#7CFFA0', 2.2, 0.3);
  return p;
};

/* ---------------------------------------------------------------- the rules, enforced once the floor is built */
var PACK_KINDS = {urn:/^(urn-group)$/, bone:/^(bones|bone-pile)$/, candle:/^candles-\d$/, moss:/^grave-flowers-moss-\d$/};
function packKindOf(p){ for(var k in PACK_KINDS) if(PACK_KINDS[k].test(p.name)) return k; return null; }
/* an urn group that has to go leaves a single urn behind: it is a breakable with loot, not only scenery */
function packDropScatter(p){
  if(p.name==='urn-group'){ p.name='urn'; delete p.pattern; delete p.kinds; delete p.flip; return; }
  var i=props.indexOf(p); if(i>=0) props.splice(i,1);
}
function packInHall(p){ var R=floorMeta && floorMeta.hallRect; return R && p.x>=R.x && p.x<R.x+R.w && p.y>=R.y && p.y<R.y+R.h; }
function packMossGroups(list){
  var groups=[], seenM=[];
  list.forEach(function(p){
    if(seenM.indexOf(p)>=0) return;
    var comp=[p], i=0; seenM.push(p);
    while(i<comp.length){ var c=comp[i++]; list.forEach(function(q){ if(seenM.indexOf(q)<0 && Math.abs(q.x-c.x)+Math.abs(q.y-c.y)===1){ seenM.push(q); comp.push(q); } }); }
    groups.push(comp);
  });
  return groups;
}
function packPlacementPass(){
  var movedBlocker=false;
  function scatter(){ return props.filter(function(p){ return !p.set && !p.wall && packKindOf(p); }); }
  /* 1. wall-side and clear of the big pieces: moved to the nearest good spot in the same room, or dropped */
  scatter().forEach(function(p){
    var k=packKindOf(p);
    if(k==='moss'){ if(packNearBig(p.x,p.y)) packDropScatter(p); return; }
    if(packWallSide(p.x,p.y) && !packNearBig(p.x,p.y)) return;
    var r=roomAt(p.x,p.y), best=null, bd=1e9;
    propGrid[idxOf(p.x,p.y)]=-1;
    for(var dy=-4;dy<=4;dy++) for(var dx=-4;dx<=4;dx++){
      var x=p.x+dx, y=p.y+dy, d=Math.abs(dx)+Math.abs(dy);
      if(d>=bd || !inb(x,y) || (r && roomAt(x,y)!==r) || (!r && roomAt(x,y)) || !packScatterSpot(x,y)) continue;
      best={x:x,y:y}; bd=d;
    }
    if(best){ p.x=best.x; p.y=best.y; if(p.b) movedBlocker=true; }
    else { var i=props.indexOf(p); if(i>=0) props.splice(i,1); }
    rebuildPropGrid();
  });
  /* 2. two scatter kinds a floor (the boss hall's own arrangement is left as designed) */
  var kinds=['urn','bone','candle','moss'], keep=[];
  while(keep.length<2){ var kk=kinds.splice(Math.floor(rng()*kinds.length),1)[0]; keep.push(kk); }
  floorMeta.scatterKinds=keep;
  scatter().forEach(function(p){ if(keep.indexOf(packKindOf(p))<0 && !packInHall(p)) packDropScatter(p); });
  rebuildPropGrid();
  /* 3. flower streaks shorter than three go; then at most 0-2 scatter groups a room (none loose in corridors) */
  packMossGroups(props.filter(function(p){ return packKindOf(p)==='moss'; })).forEach(function(g){ if(g.length<3) g.forEach(packDropScatter); });
  rebuildPropGrid();
  var byRoom={}, loose=[];
  var mossG=packMossGroups(props.filter(function(p){ return packKindOf(p)==='moss' && !packInHall(p); }));
  var groups=mossG.concat(scatter().filter(function(p){ return packKindOf(p)!=='moss' && !packInHall(p); }).map(function(p){ return [p]; }));
  groups.forEach(function(g){ var r=roomAt(g[0].x, g[0].y); if(!r){ loose.push(g); return; } (byRoom[r.id]=byRoom[r.id]||{r:r, g:[]}).g.push(g); });
  loose.forEach(function(g){ g.forEach(packDropScatter); });
  Object.keys(byRoom).forEach(function(id){
    var e=byRoom[id], cap=[0,1,1,2][Math.floor(rng()*4)];
    var gs=shuffled(e.g);
    gs.slice(cap).forEach(function(g){ g.forEach(packDropScatter); });
  });
  rebuildPropGrid();
  /* 4. the candles that stayed light their bit of floor */
  props.forEach(function(p){ if(packKindOf(p)==='candle') packLight(p.x, p.y+0.2, '#FFC878', 2.2, 0.32); });
  if(movedBlocker && typeof propsKeepOpen==='function' && player) propsKeepOpen();
}
var _generatePackRules = generate;
generate = function(seed){
  var r=_generatePackRules.apply(this, arguments);
  if(packCryptOn() && typeof props!=='undefined' && typeof rebuildPropGrid==='function') packPlacementPass();
  return r;
};
/* the planes: the rune stones and the sun dais stand alone too - plants, small crystals and moss or grass within a tile
   of them are cleared (a light that went with a removed glow-mushroom goes with it) */
function packPlaneClear(){
  var small=/^(fern|root-tangle|glow-mushrooms|crystal-(gold|violet|amber)-small)$/;
  var drop=props.filter(function(p){ return (small.test(p.name) || (p.name==='pt-cluster' && (p.size||1)<1)) && packNearBig(p.x,p.y); });
  if(drop.length){
    props=props.filter(function(p){ return drop.indexOf(p)<0; });
    floorMeta.planeLights=(floorMeta.planeLights||[]).filter(function(l){ return !drop.some(function(p){ return p.name==='glow-mushrooms' && p.x===l.x && p.y===l.y; }); });
    rebuildPropGrid();
  }
  props.forEach(function(q){
    if(!/^(rune-stone-|sun-dais)/.test(q.name)) return;
    for(var y=q.y-1; y<=q.y+(q.h||1); y++) for(var x=q.x-1; x<=q.x+(q.w||1); x++) if(inb(x,y) && ground[idxOf(x,y)]) ground[idxOf(x,y)]=0;
  });
}
if(typeof buildPlaneFloor==='function'){
  var _buildPlaneFloorPack = buildPlaneFloor;
  buildPlaneFloor = function(el, seed){
    var r=_buildPlaneFloorPack.apply(this, arguments);
    if(packPlaneOn()){ packPlaneClear(); if(typeof draw==='function') draw(); }
    return r;
  };
}
