/* =====================================================================
   planesfwa.js - the Fire, Water and Air planes (2026-09-19). DESIGN.md section 17.
   The Crypt's portal opens onto Light, Shadow or Earth; biome 4's (the Underdark, floors 16-20) opens onto
   Fire, Water or Air. Those three are built here, to the same shape as the first three: one cave floor of pure
   element (js/planes.js layouts, js/planeterrain.js terrain), three regular creatures, an elite guardian in
   the central chamber, a rune chest in the treasure grotto, the plane's own light and its own hazard.

   What lives where:
     PT_MAT.fire/.water/.air, PT_POOL_FX  planeterrain.js (palettes only - the renderer is unchanged)
     BIOME_PLANES                         world.js (which planes each biome's portal may open onto)
     everything else                      here: layout themes, props, roster, hazards, AI, placeholder art.

   HAZARDS, one per plane, all reusing what already exists:
     Fire   lava (biome 4's LAVA tile, guarded with typeof) in seams through the cave and a lake round the
            guardian; it is impassable and scorches whoever ends a turn beside it. Every few turns the roof
            rains embers on telegraphed cells.
     Water  deep water in the middle of the pools: walkable, but you sink - damage and a Chill every turn you
            end in it. Every few turns a surge floods telegraphed cells and washes you a tile.
     Air    updraft vents: stand on one and the gust throws you a tile. Every few turns a gale telegraphs and
            then shoves everything in those cells two tiles.

   ART IS A STAND-IN. Packet 04 (art/reference/packets/04-planes-fire-water-air.md) has been requested and has
   not landed: nothing here was generated, every creature borrows an existing sprite and every piece of scenery
   is drawn from the plane's own terrain palette in code. FWA_ART below is the swap list - each creature names
   the file it is waiting for (m-cinder-imp.png and so on) and the sprite it wears until then, and it picks the
   real one automatically the moment the pack carries it. The rune stones, the lava, the deep water and the
   updraft vents are code-drawn here and give way to rune-stone-fire / the hazard tiles when those arrive.

   ALL NUMBERS ARE PLACEHOLDERS for Justin's balance pass. These planes hang off floors 16-20, so they are
   tuned against the Underdark (a Drow Blade is 52 HP and hits 9-13 there; the Drider elite about 110), not
   against the Crypt's planes.
   ===================================================================== */

var FWA_PLANES = {fire:1, water:1, air:1};
function inFwa(){ return !!(floorMeta && floorMeta.plane && FWA_PLANES[floorMeta.plane]); }
function fwaIsLava(x,y){ return typeof LAVA!=='undefined' && inb(x,y) && at(x,y)===LAVA; }
function fwaLavaBeside(x,y){ return fwaIsLava(x-1,y) || fwaIsLava(x+1,y) || fwaIsLava(x,y-1) || fwaIsLava(x,y+1); }
function fwaDeepAt(x,y){ var D=floorMeta && floorMeta.fwaDeep; return !!(D && inb(x,y) && D[idxOf(x,y)]); }
function fwaVentAt(x,y){ var p=propAt(x,y); return !!(p && p.name==='updraft-vent'); }

/* ---------------------------------------------------------------- the layouts (planes.js tables)
   Fire and Air take the plain 2x2 centre (their guardians want open ground); Water takes the Shadow plane's
   'voidpool', which digs a broad pool through the central chamber - the Leviathan Eel is coiled in it. */
PLANE_THEMES.fire  = {name:'Cinder Reach', rock:'#2C2628', floor:'#4A4244', water:'#C8340A', center:'#FF7A26', decor:'#FF9A50', light:'#FFC27A', block:'#3A3234',
                      centerKind:'dais', decorKind:'crystal', lightKind:'sunvein'};
PLANE_THEMES.water = {name:'Sunken Deep', rock:'#4E667C', floor:'#7A94A8', water:'#10346E', center:'#2E86A8', decor:'#5CC8D8', light:'#9FF0E8', block:'#5E7488',
                      centerKind:'voidpool', decorKind:'crystal', lightKind:'moonpool'};
PLANE_THEMES.air   = {name:'Skyvault', rock:'#A6B4CA', floor:'#D2DCEA', water:'#60ACE8', center:'#E2BE60', decor:'#B8CCE8', light:'#E8F4FF', block:'#BCC8DC',
                      centerKind:'dais', decorKind:'crystal', lightKind:'sunvein'};

/* the props buildPlaneFloor() asks for. decor/light are only read on the Earth plane, but they are filled in
   with the names packet 04 will deliver so the swap is one line when the art lands. */
PLANE_PROPS.fire  = {decor:['crystal-fire-small','stalagmite-fire','crystal-fire-small'], light:'crystal-fire', lightCol:'#FF8A3A', rune:'rune-stone-fire',  center:'lava-fountain', stone:null}   /* packet 04's signature piece, 2x2 */;
PLANE_PROPS.water = {decor:['crystal-water-small','stalagmite-water','crystal-water-small'], light:'crystal-water', lightCol:'#7CC8FF', rune:'rune-stone-water', center:'signature-water', stone:'stepping-stone'}   /* packet 04: the giant clam */;
PLANE_PROPS.air   = {decor:['crystal-air-small','stalagmite-air','crystal-air-small'], light:'crystal-air', lightCol:'#E8F4FF', rune:'rune-stone-air',   center:'signature-air', stone:null}      /* packet 04: the wind shrine */;
['rune-stone-fire','rune-stone-water','rune-stone-air'].forEach(function(n){ PROPS[n]={b:1}; });
['crystal-fire','crystal-fire-small','stalagmite-fire','crystal-water','crystal-water-small','stalagmite-water',
 'crystal-air','crystal-air-small','stalagmite-air'].forEach(function(n){ PROPS[n]=PROPS[n]||{flat:1}; });
/* 2026-09-19: packet 04's Fire art is in - the lava fountain stands in the central chamber and the ember-and-slag
   clusters scatter along the wall feet (the scenery rules: wall-adjacent, in streaks, never lone) */
PROPS['lava-fountain']={b:1, w:2, h:2, light:'#FF7A26'};
PROPS['signature-water']={b:1, w:2, h:2, light:'#7CC8FF'};
PROPS['signature-air']={b:1, w:2, h:2, light:'#E8F4FF'};
['embers-slag-1','embers-slag-2','embers-slag-3','embers-slag-4',
 'scatter-water-1','scatter-water-2','scatter-water-3','scatter-water-4',
 'scatter-air-1','scatter-air-2','scatter-air-3','scatter-air-4'].forEach(function(n){ PROPS[n]={flat:1}; });
var FWA_CLUSTERS = {fire:['embers-slag-1','embers-slag-2','embers-slag-3','embers-slag-4'],
                    water:['scatter-water-1','scatter-water-2','scatter-water-3','scatter-water-4'],
                    air:['scatter-air-1','scatter-air-2','scatter-air-3','scatter-air-4']};
var _buildPlaneFloorFwaClu = buildPlaneFloor;
buildPlaneFloor = function(el, seed){
  var r=_buildPlaneFloorFwaClu.apply(this, arguments);
  try{
    var list=FWA_CLUSTERS[el]; if(!list || !list.length || typeof setArt!=='function' || !setArt(list[0])) return r;
    var spots=[];
    for(var y=1;y<MH-1;y++) for(var x=1;x<MW-1;x++){
      if(at(x,y)!==FLOOR || propAt(x,y) || (typeof LAVA!=='undefined' && at(x,y)===LAVA)) continue;
      if(Math.max(Math.abs(x-player.x), Math.abs(y-player.y))<3) continue;
      var wall=0; for(var d=0;d<4;d++){ var o=[[1,0],[-1,0],[0,1],[0,-1]][d]; if(isWallLike(at(x+o[0],y+o[1]))) wall++; }
      if(wall) spots.push({x:x, y:y});
    }
    spots=shuffled(spots);
    for(var k=0, put=0; k<spots.length && put<5; k++){
      var sp=spots[k], run=ri(3,4);                     /* streaks of 3-4, never a lone piece */
      for(var j=0;j<run;j++){
        var cx=sp.x+j, cy=sp.y; if(at(cx,cy)!==FLOOR || propAt(cx,cy)) break;
        addProp(cx, cy, list[Math.floor(rng()*list.length)], {flat:1});
      }
      put++;
    }
  }catch(e){ if(window.console) console.warn('fwa clusters', e); }
  return r;
};
PROPS['updraft-vent']={flat:1};

PLANE_HAZARD_TEXT.fire  = 'The basalt is split with molten rock: it cannot be crossed, and standing beside it scorches you. When the roof glows, get out from under it.';
PLANE_HAZARD_TEXT.water = 'The deep water drags you down: cross it only if you must. When the water starts to draw back, a surge is coming.';
PLANE_HAZARD_TEXT.air   = 'Updraft vents throw you off your feet, and the gales here come with a warning. Watch where you are standing.';

/* ---------------------------------------------------------------- the creatures (packet 04)
   Fixed stats, like the other planes' creatures: spawn() puts no floor curve on top of them. */
var PLANE_ROSTER_FWA = {
  fire:  {mobs:['cinderimp','magmacrawler','flamedancer'], elite:'emberlord'},
  water: {mobs:['tidecrab','siren','drownedone'],          elite:'leviathaneel'},
  air:   {mobs:['stormhawk','thundertotem','windwisp'],    elite:'tempestdjinn'}
};
/* the sprite each creature is waiting for, and the existing one it wears until the pack carries it.
   fwaSprite() picks the real file the moment it is packed, so this needs no second edit. */
var FWA_ART = {
  cinderimp:    ['m-cinder-imp',    'm-fire-imp'],        /* a fire imp: the closest thing already drawn */
  magmacrawler: ['m-magma-crawler', 'm-ember-spider'],    /* an armoured burning crawler */
  flamedancer:  ['m-flame-dancer',  'm-emberling'],       /* a fire spirit */
  emberlord:    ['m-emberlord',     'm-radiant-warden'],  /* a crowned warden, in roughly the right heat */
  tidecrab:     ['m-tide-crab',     'm-crystal-crawler'], /* a low, armoured crawler */
  siren:        ['m-siren',         'm-drow-priestess'],  /* a singing caster */
  drownedone:   ['m-drowned-one',   'm-shambler'],        /* a shambling drowned thing */
  leviathaneel: ['m-leviathan-eel', 'm-shock-eel'],       /* the Caverns' eel, stood in for the Leviathan */
  stormhawk:    ['m-storm-hawk',    'm-bat'],             /* the only swooping flier already drawn */
  thundertotem: ['m-thunder-totem', 'm-phylactery'],      /* a thing that stands still and does not move */
  windwisp:     ['m-wind-wisp',     'm-galeling'],        /* the air elementaling */
  tempestdjinn: ['m-tempest-djinn', 'm-night-warden']     /* a tall floating guardian */
};
function fwaSprite(kind){
  var a=FWA_ART[kind]; if(!a) return null;
  return (typeof AS!=='undefined' && AS.mobs && AS.mobs[a[0]]) ? a[0] : a[1];
}
(function(){
  var M=MONSTERS;
  function mk(o){ o.band=[0,0]; o.w=0; o.speed=o.speed||100; o.range=o.range||1; o.fixed=true; return o; }
  /* --- Fire ------------------------------------------------------------------------------------- */
  M.cinderimp    = mk({name:'Cinder Imp', sprite:fwaSprite('cinderimp'), col:'#FF8A3A', ch:'i', hp:70, dmg:[8,11], acc:72, eva:30, armor:1, xp:85,
                       fwa:'hop', el:'fire', living:true, art:0.75, sfx:'bat'});
  M.magmacrawler = mk({name:'Magma Crawler', sprite:fwaSprite('magmacrawler'), col:'#D8541E', ch:'c', hp:130, dmg:[11,15], acc:68, eva:4, armor:12, speed:70, xp:110,
                       fwa:'crawler', magmaBurst:true, el:'fire', art:0.95, sfx:'rat'});
  M.flamedancer  = mk({name:'Flame Dancer', sprite:fwaSprite('flamedancer'), col:'#FFB066', ch:'f', hp:70, dmg:[8,11], acc:76, eva:38, armor:2, xp:100,
                       fwa:'dancer', kindles:true, el:'fire', art:0.95, sfx:'elementaling'});
  M.emberlord    = mk({name:'The Emberlord', sprite:fwaSprite('emberlord'), col:'#FF6A18', ch:'E', hp:230, dmg:[13,18], acc:78, eva:14, armor:7, xp:700,
                       fwa:'emberlord', elite:true, el:'fire', art:1.5, sfx:'brute'});
  /* --- Water ------------------------------------------------------------------------------------ */
  M.tidecrab     = mk({name:'Tide Crab', sprite:fwaSprite('tidecrab'), col:'#5CC8D8', ch:'C', hp:130, dmg:[11,15], acc:70, eva:8, armor:10, xp:105,
                       fwa:'crab', shellGuard:true, living:true, art:1.0, sfx:'rat'});
  M.siren        = mk({name:'Siren', sprite:fwaSprite('siren'), col:'#9FF0E8', ch:'S', hp:70, dmg:[8,11], acc:72, eva:26, armor:1, range:5, xp:110,
                       fwa:'siren', living:true, spellcaster:true, art:0.95, sfx:'shaman'});
  M.drownedone   = mk({name:'Drowned One', sprite:fwaSprite('drownedone'), col:'#4E667C', ch:'d', hp:70, dmg:[8,11], acc:70, eva:14, armor:4, xp:100,
                       fwa:'drowned', art:0.95, sfx:'goblin'});
  M.leviathaneel = mk({name:'The Leviathan Eel', sprite:fwaSprite('leviathaneel'), col:'#2E86A8', ch:'L', hp:230, dmg:[13,18], acc:76, eva:18, armor:5, xp:700,
                       fwa:'leviathan', elite:true, living:true, el:'water', art:1.5, sfx:'brute'});
  /* --- Air -------------------------------------------------------------------------------------- */
  M.stormhawk    = mk({name:'Storm Hawk', sprite:fwaSprite('stormhawk'), col:'#BFE4FF', ch:'h', hp:70, dmg:[8,11], acc:74, eva:34, armor:0, speed:130, xp:95,
                       fwa:'hawk', flying:true, hover:true, living:true, art:0.85, sfx:'bat'});
  M.thundertotem = mk({name:'Thunder Totem', sprite:fwaSprite('thundertotem'), col:'#E2BE60', ch:'T', hp:130, dmg:[11,15], acc:70, eva:0, armor:8, range:6, xp:90,
                       fwa:'totem', rooted:true, art:1.0, sfx:'shaman'});
  M.windwisp     = mk({name:'Wind Wisp', sprite:fwaSprite('windwisp'), col:'#E8F4FF', ch:'w', hp:30, dmg:[5,7], acc:68, eva:40, armor:0, speed:140, xp:85,
                       fwa:'wisp', flying:true, erratic:true, el:'air', art:0.75, sfx:'elementaling'});
  M.tempestdjinn = mk({name:'The Tempest Djinn', sprite:fwaSprite('tempestdjinn'), col:'#A8D8FF', ch:'D', hp:230, dmg:[13,18], acc:78, eva:22, armor:4, xp:700,
                       fwa:'djinn', elite:true, flying:true, hover:true, el:'air', art:1.5, sfx:'warchief'});
  Object.keys(FWA_ART).forEach(function(k){ DROPS[k]=DROPS[k] || (MONSTERS[k].elite ? {chance:0.6, table:{essence:6, gear:8, sigil:2}} : {chance:0.3, table:{essence:8, sigil:2, gear:3}}); });
  for(var el in PLANE_ROSTER_FWA) PLANE_ROSTER[el]=PLANE_ROSTER_FWA[el];
})();
/* hover-card lines: what each one does, in a sentence (the same treatment the Underdark's creatures get) */
var FWA_HINT = {
  cinderimp:'Hops the last few tiles at you and leaves the ground burning behind it.',
  magmacrawler:'Slow and heavily armoured. It bursts when it dies - do not be standing next to it.',
  flamedancer:'Hard to hit, and its touch sets you alight.',
  emberlord:'Calls up eruptions where you stand, and below half health the ground around him catches fire.',
  tidecrab:'Its shell turns the first blow of every turn. Slow, and it hits hard.',
  siren:'Her song drags you a step toward her and costs you the turn. Kill her first, or break her line of sight.',
  drownedone:'Drags you a tile toward it - and into the deep water, if that is where it is standing.',
  leviathaneel:'Submerges in the pool where nothing can touch it, and comes up beside you. Its tail throws you across the chamber.',
  stormhawk:'Swoops in from range and knocks you back a tile.',
  thundertotem:'Cannot move. Zaps anything standing in a straight line from it - step out of the line.',
  windwisp:'Shoves you about. Harmless on its own, dangerous beside a vent or a drop.',
  tempestdjinn:'Pulls you into the whirlwind and stuns you, and throws lightning at anything it can see.'
};

/* ---------------------------------------------------------------- the portal tile in biome 4
   portals.js puts the arch in a plain room 4x4 or bigger, furthest from where you start. In the Underdark that
   misses in two ways: about one floor in twenty has no room that passes at all, and about one in ten puts the
   arch in a pocket the stairs cannot reach (lava channels split those caves into more than one piece). Either
   way the side branch is unreachable for that run. This checks the arch can actually be walked to from the
   stairs and moves it if not - only in biome 4; the Crypt's placement is untouched. */
function fwaFromStairs(){
  var st=null;
  for(var i=0;i<map.length;i++) if(map[i]===STAIRS){ st={x:i%MW, y:(i/MW)|0}; break; }
  if(!st) return null;
  var d=new Int32Array(MW*MH).fill(-1), q=[st.x,st.y], h=0; d[idxOf(st.x,st.y)]=0;
  while(h<q.length){
    var x=q[h++], y=q[h++], cd=d[idxOf(x,y)];
    for(var k=0, nb=[[1,0],[-1,0],[0,1],[0,-1]]; k<4; k++){
      var nx=x+nb[k][0], ny=y+nb[k][1]; if(!inb(nx,ny) || d[idxOf(nx,ny)]>=0) continue;
      var t=at(nx,ny); if(!(walkable(nx,ny) || isDoorish(t) || t===CHEST || t===PORTAL)) continue;
      d[idxOf(nx,ny)]=cd+1; q.push(nx,ny);
    }
  }
  return d;
}
var _fwaGenerate = generate;
generate = function(seed){
  var r=_fwaGenerate(seed);
  if(!floorMeta || !floorMeta.portal || floorMeta.boss || bidx()!==3) return r;
  var reach=fwaFromStairs(); if(!reach) return r;
  var p=floorMeta.portalAt;
  if(p && reach[idxOf(p.x,p.y)]>=0) return r;                              /* placed, and you can walk to it */
  var best=null, bs=-1;
  for(var y=1;y<MH-1;y++) for(var x=1;x<MW-1;x++){
    if(at(x,y)!==FLOOR || reach[idxOf(x,y)]<0) continue;
    if(propAt(x,y) || itemAt(x,y) || occupied(x,y) || nearDoor(x,y)) continue;
    if(feats.some(function(f){ return f.x===x && f.y===y; })) continue;
    var open=0; for(var oy=-1;oy<=1;oy++) for(var ox=-1;ox<=1;ox++) if(walkable(x+ox,y+oy)) open++;
    if(open<7) continue;                                                   /* not in a passage or a corner */
    if(typeof deepLavaAdjacent==='function' && deepLavaAdjacent(x,y)) continue;
    if(reach[idxOf(x,y)]>bs){ bs=reach[idxOf(x,y)]; best={x:x, y:y}; }     /* the furthest walk from the stairs */
  }
  if(!best) return r;
  if(p && at(p.x,p.y)===PORTAL) setT(p.x, p.y, FLOOR);
  setT(best.x, best.y, PORTAL); floorMeta.portalAt=best;
  var rm=roomAt(best.x,best.y); if(rm) rm.role=rm.role||'portal';
  if(!(floorMeta.notes||[]).some(function(n){ return /portal to/.test(n); }))
    floorMeta.notes.push('Something hums on this floor: <b>a portal to '+PLANE_TITLE[floorMeta.portal]+'</b> stands open.');
  return r;
};

/* ---------------------------------------------------------------- building the floor
   buildPlaneFloor() (portals.js) does the whole floor including the creatures, so the hazards go in after it:
   they have to know where everything already stands, and a lava seam may not seal a creature - or the treasure
   - away from the portal. Everything written here is plain data on floorMeta or in map, so it saves and loads
   with the floor like any other terrain. */
var _fwaBuildPlaneFloor = buildPlaneFloor;
buildPlaneFloor = function(el, seed){
  var r=_fwaBuildPlaneFloor(el, seed);
  if(FWA_PLANES[el]) fwaDress(el, seed);
  return r;
};
/* is every walkable cell still reachable from where the player stands? */
function fwaAllReachable(){
  var d=bfsFrom(player.x, player.y);
  for(var i=0;i<map.length;i++){ var x=i%MW, y=(i/MW)|0; if(walkable(x,y) && d[i]<0) return false; }
  return true;
}
/* turn a set of cells into lava, and take it all back if that cut the cave in two */
function fwaLavaBlock(cells){
  if(typeof LAVA==='undefined' || !cells.length) return 0;
  var old=cells.map(function(i){ return map[i]; });
  cells.forEach(function(i){ map[i]=LAVA; });
  if(fwaAllReachable()) return cells.length;
  cells.forEach(function(i, k){ map[i]=old[k]; });
  return 0;
}
function fwaDress(el, seed){
  var rr=mulberry32((seed ^ 0x2B8F5C1)>>>0), c=floorMeta.centerAt;
  floorMeta.fwaHz=0; floorMeta.fwaPending=null;
  function free(x,y){ return inb(x,y) && map[idxOf(x,y)]===FLOOR && !propAt(x,y) && !itemAt(x,y) &&
                             !(floorMeta.portalAt && Math.abs(x-floorMeta.portalAt.x)+Math.abs(y-floorMeta.portalAt.y)<=2) &&
                             !(floorMeta.treasureAt && Math.abs(x-floorMeta.treasureAt.x)+Math.abs(y-floorMeta.treasureAt.y)<=2); }
  if(el==='fire'){
    /* nothing on this plane is water: the grotto's pool is dry rock until the lava is poured into it. If it
       were left as WATER it would be painted in PT_MAT.fire's pool colours - molten to look at, walkable in
       fact - and on a plane where the orange kills you that is the one thing it must never be. */
    var oldPool=[];
    for(var wi=0; wi<map.length; wi++) if(map[wi]===WATER){ map[wi]=FLOOR; oldPool.push(wi); if(floorMeta.ptPool) delete floorMeta.ptPool[wi]; }
    /* a lake in the far half of the central chamber, so the Emberlord has his pool to rise from, then a few
       seams of molten rock elsewhere. Each is laid one blob at a time and rolled back if it seals anything. */
    var lit=[], poured=0;
    function pour(cx, cy, rad, wob){
      var cells=[];
      for(var y=cy-rad-1; y<=cy+rad+1; y++) for(var x=cx-rad-1; x<=cx+rad+1; x++){
        if(!free(x,y)) continue;
        var a=Math.atan2(y-cy, x-cx), rw=rad*(1+wob*Math.sin(a*3+cx)+wob*0.6*Math.sin(a*5+cy));
        if(Math.hypot(x-cx, (y-cy)*1.35) <= rw) cells.push(idxOf(x,y));
      }
      var n2=fwaLavaBlock(cells);
      if(n2){ poured+=n2; lit.push({x:cx, y:cy, r:Math.max(3.5, rad*1.8)}); }
      return n2;
    }
    pour(c.x + (rr()<0.5?-5:5), c.y - 3, 2 + Math.floor(rr()*2), 0.22);
    /* seams elsewhere. A blob that would pinch the only way past is rolled back, so a tight cave can take
       very few: keep trying smaller ones until the plane has enough molten rock to read as Fire. */
    for(var s=0; s<70 && (lit.length<8 || poured<10); s++){
      var sx=2+Math.floor(rr()*(MW-4)), sy=2+Math.floor(rr()*(MH-4));
      if(!free(sx,sy) || Math.hypot(sx-c.x, sy-c.y)<4) continue;
      pour(sx, sy, (s<40 ? 1 + Math.floor(rr()*2) : 1), 0.3);
    }
    /* the grotto's pool becomes a lava pool: its middle only, so its shore is still somewhere to stand */
    var mid=oldPool.filter(function(i2){
      var mx=i2%MW, my=(i2/MW)|0;
      return oldPool.indexOf(idxOf(mx-1,my))>=0 && oldPool.indexOf(idxOf(mx+1,my))>=0 &&
             oldPool.indexOf(idxOf(mx,my-1))>=0 && oldPool.indexOf(idxOf(mx,my+1))>=0 && free(mx,my);
    });
    if(mid.length && fwaLavaBlock(mid)){ var m0=mid[0]; lit.push({x:m0%MW, y:(m0/MW)|0, r:4.5}); }
    /* every lava cell joins the pool field, so planeterrain paints the flow in PT_MAT.fire's molten colours
       with soft, organic edges instead of my drawing square orange tiles over the rock */
    floorMeta.ptPool=floorMeta.ptPool||{};
    if(typeof LAVA!=='undefined') for(var li=0; li<map.length; li++) if(map[li]===LAVA) floorMeta.ptPool[li]=1;
    /* one light per flow: the lava lights its own chamber, and it is saved with the floor */
    lit.forEach(function(l){ floorMeta.planeLights.push({x:l.x, y:l.y, col:'#FF7A2A', r:l.r, s:1.0}); });
    /* nothing may be left standing in the molten rock */
    ents.slice().forEach(function(e){ if(e!==player && fwaIsLava(e.x,e.y)){ var sp=nearFree(e.x,e.y,4); if(sp){ e.x=sp.x; e.y=sp.y; } else ents=ents.filter(function(o){ return o!==e; }); } });
    if(fwaIsLava(player.x,player.y)){ var ps=nearFree(player.x,player.y,5); if(ps){ player.x=ps.x; player.y=ps.y; player._lx=undefined; } }
  }
  if(el==='water'){
    /* the central chamber floods into a lagoon round the Leviathan's pool - planes.js digs the same 9x5
       'voidpool' the Shadow plane uses, which is too small to have a middle you can drown in */
    floorMeta.ptPool=floorMeta.ptPool||{};
    for(var ly=c.y-4; ly<=c.y+4; ly++) for(var lx=c.x-7; lx<=c.x+7; lx++){
      if(!free(lx,ly)) continue;
      var an=Math.atan2(ly-c.y, lx-c.x), wob=1+0.18*Math.sin(an*3+c.x)+0.1*Math.sin(an*5+c.y);
      if(Math.hypot((lx-c.x)/(6.5*wob), (ly-c.y)/(3.4*wob))>1) continue;
      map[idxOf(lx,ly)]=WATER; floorMeta.ptPool[idxOf(lx,ly)]=1;
    }
    /* deep water: everything with water on all four sides. Walkable, so nothing can be sealed off by it -
       it is a place you can cross and would rather not. */
    var D={}, n=0;
    for(var y2=1;y2<MH-1;y2++) for(var x2=1;x2<MW-1;x2++){
      if(at(x2,y2)!==WATER) continue;
      if(at(x2-1,y2)!==WATER || at(x2+1,y2)!==WATER || at(x2,y2-1)!==WATER || at(x2,y2+1)!==WATER) continue;
      D[idxOf(x2,y2)]=1; n++;
    }
    if(n){ floorMeta.fwaDeep=D; floorMeta.planeLights.push({x:c.x, y:c.y, col:'#4FA8E8', r:5.5, s:0.7}); }
    /* coral creeps out of the water onto the stone (planeterrain draws PT_MAT.water.moss on G_MOSS) */
    for(var y3=1;y3<MH-1;y3++) for(var x3=1;x3<MW-1;x3++){
      if(map[idxOf(x3,y3)]!==FLOOR || gAt(x3,y3)) continue;
      var near=0;
      for(var oy3=-2;oy3<=2;oy3++) for(var ox3=-2;ox3<=2;ox3++) if(at(x3+ox3,y3+oy3)===WATER) near++;
      if(near && rr() < Math.min(0.75, near*0.09)) setG(x3, y3, G_MOSS);
    }
  }
  if(el==='air'){
    /* updraft vents: out in the open, never in a doorway or under a creature, spread out */
    var vents=[], tries=0;
    while(vents.length<7 && tries++<900){
      var vx=2+Math.floor(rr()*(MW-4)), vy=2+Math.floor(rr()*(MH-4));
      if(!free(vx,vy) || occupied(vx,vy)) continue;
      var open=0; for(var oy4=-1;oy4<=1;oy4++) for(var ox4=-1;ox4<=1;ox4++) if(walkable(vx+ox4,vy+oy4)) open++;
      if(open<8) continue;                                                  /* never in a passage: it would be a wall */
      if(vents.some(function(v){ return Math.abs(v.x-vx)+Math.abs(v.y-vy)<7; })) continue;
      var p=addProp(vx, vy, 'updraft-vent', {flat:1});
      if(p){ vents.push({x:vx, y:vy}); floorMeta.planeLights.push({x:vx, y:vy, col:'#CFE8FF', r:2.6, s:0.5}); }
    }
    floorMeta.fwaVents=vents;
  }
  /* the terrain rasters were built before any of this: throw them away so the pool field is read again */
  if(typeof PT_CACHE!=='undefined') PT_CACHE.key=null;
  computeFOV(); resize(); draw();
}

/* ---------------------------------------------------------------- the hazards, turn by turn */
/* push a creature (or you) n tiles along a direction. Returns how far it actually went. */
function fwaPush(t, dx, dy, n){
  dx=Math.sign(dx); dy=Math.sign(dy); if(!dx && !dy) return 0;
  var moved=0;
  for(var i=0;i<n;i++){
    var nx=t.x+dx, ny=t.y+dy;
    if(!inb(nx,ny) || !walkable(nx,ny) || occupied(nx,ny)) break;
    t.x=nx; t.y=ny; moved++;
  }
  if(moved){ t._lx=undefined; if(t===player){ t._mt=null; computeFOV(); } }
  return moved;
}
function fwaHurt(t, n, type, src, why){
  if(!t || t.hp<=0) return 0;
  var d=applyDamage(t, n, type, src); floatText(t.x, t.y, String(d), type);
  if(t===player){ if(why) log(why+': <b>'+d+'</b>.','c-you'); if(player.hp<=0){ heroicResolve(); if(player.hp<=0) death(); } }
  else if(t.hp<=0) kill(t, src);
  return d;
}
/* creatures of the plane are at home in it: its own hazard never touches them */
function fwaNative(t){
  var el=floorMeta && floorMeta.plane, R=el && PLANE_ROSTER[el];
  return !!(R && t!==player && t.base && (R.mobs.indexOf(t.kind)>=0 || t.kind===R.elite));
}
var FWA_HZ = {fire:5, water:6, air:5};                    /* turns between telegraphs (placeholders) */
function fwaTick(){
  var el=floorMeta && floorMeta.plane;
  if(!FWA_PLANES[el] || !player || player.hp<=0) return;
  /* standing damage: lava beside you, deep water under you, a vent under your feet */
  if(el==='fire'){
    if(!(player.levitate>0) && fwaLavaBeside(player.x, player.y)){
      fwaHurt(player, sDMG(4+Math.floor(floorNo/4)), 'fire', null, 'The lava beside you scorches you');
      if(player.hp<=0) return;
    }
    ents.slice().forEach(function(e){
      if(e===player || e.hp<=0 || fwaNative(e) || !fwaLavaBeside(e.x,e.y)) return;
      fwaHurt(e, sDMG(4+Math.floor(floorNo/4)), 'fire', null, null);
    });
  } else if(el==='water'){
    if(fwaDeepAt(player.x, player.y) && !(player.levitate>0)){
      fwaHurt(player, sDMG(4+Math.floor(floorNo/4)), 'ice', null, 'The deep water drags you under');
      if(player.hp<=0) return;
      addChill(player);
    }
    ents.slice().forEach(function(e){ if(e!==player && e.hp>0 && !fwaNative(e) && !(e.base&&e.base.flying) && fwaDeepAt(e.x,e.y)) fwaHurt(e, sDMG(4), 'ice', null, null); });
  } else if(el==='air'){
    if(fwaVentAt(player.x, player.y) && !player.st.root){
      var a=rng()*6.283, m=fwaPush(player, Math.cos(a), Math.sin(a), 1);
      if(m){ log('The vent catches you and throws you off your feet.','c-you'); sfx('trap-spark'); burst(player.x, player.y, 'lightning', 14, 0.05); }
    }
  }
  /* the telegraphed hazard: marked cells, then it lands two turns later */
  floorMeta.fwaHz=(floorMeta.fwaHz||0)+1;
  var pend=floorMeta.fwaPending;
  if(pend && turn>=pend.at){
    floorMeta.fwaPending=null;
    floorMeta.marks=(floorMeta.marks||[]).filter(function(mk){ return mk.kind!=='fwa'; });
    if(el==='air') SHAKE=6; else if(el==='fire') SHAKE=5;
    /* a wave that shoves you along can shove you into the next cell of itself: nothing is caught twice */
    var struck=[];
    pend.cells.forEach(function(i){
      var x=i%MW, y=(i/MW)|0;
      burst(x, y, el==='fire' ? 'fire' : el==='water' ? 'ice' : 'lightning', 10, 0.05);
      ents.slice().forEach(function(t){
        if(t.x!==x || t.y!==y || t.hp<=0 || fwaNative(t) || struck.indexOf(t)>=0) return;
        struck.push(t);
        if(el==='fire'){ fwaHurt(t, roll(7,11)+Math.floor(floorNo/2), 'fire', null, t===player?'Burning rock rains down on you':null); if(t.hp>0) applyStatus(t,'burn',3,sDMG(3)); }
        else if(el==='water'){ fwaHurt(t, roll(6,10)+Math.floor(floorNo/2), 'ice', null, t===player?'The surge crashes over you':null); if(t.hp>0){ fwaPush(t, pend.dx, pend.dy, 1); if(t===player) addChill(player); } }
        else { fwaHurt(t, roll(5,9)+Math.floor(floorNo/2), 'phys', null, t===player?'The gale slams into you':null); if(t.hp>0) fwaPush(t, pend.dx, pend.dy, 2); }
      });
      if(el==='fire' && rng()<0.4) fireT[i]=Math.max(fireT[i], 3);
    });
    return;
  }
  if(floorMeta.fwaHz % FWA_HZ[el] !== 0 || floorMeta.fwaPending) return;
  var cells=[], k;
  if(el==='fire'){
    for(k=0;k<3;k++){ var bx=player.x+ri(-4,4), by=player.y+ri(-3,3);
      for(var yy=by-1;yy<=by+1;yy++) for(var xx=bx-1;xx<=bx+1;xx++) if(inb(xx,yy) && walkable(xx,yy) && rng()<0.7) cells.push(idxOf(xx,yy)); }
    if(rng()<0.6) cells.push(idxOf(player.x,player.y));
  } else {
    /* Water and Air both come at you as a wave: a band across its own direction, centred a little to one side
       of you so stepping out of it is a real choice and not a coin toss. Water is broader and shallower. */
    var dirs=[[1,0],[-1,0],[0,1],[0,-1]], dd=dirs[Math.floor(rng()*4)], ax=dd[0]?0:1, ay=dd[0]?1:0;
    var wide = el==='water' ? 4 : 3, deep = el==='water' ? 1 : 1, off = ri(-1,1);
    for(k=-wide;k<=wide;k++) for(var j=-deep;j<=deep;j++){
      var gx=player.x+ax*(k+off)+dd[0]*j, gy=player.y+ay*(k+off)+dd[1]*j;
      if(inb(gx,gy) && walkable(gx,gy)) cells.push(idxOf(gx,gy));
    }
    floorMeta._fwaDir=dd;
  }
  var dir=floorMeta._fwaDir||[1,0]; delete floorMeta._fwaDir;
  cells=cells.filter(function(v,i,a){ return a.indexOf(v)===i; });
  if(!cells.length) return;
  floorMeta.fwaPending={cells:cells, at:turn+2, dx:dir[0], dy:dir[1]};
  floorMeta.marks=(floorMeta.marks||[]).concat([{cells:cells, col: el==='fire' ? '#FF7A2A' : el==='water' ? '#5CC8FF' : '#DCEEFF', until:turn+2, kind:'fwa'}]);
  log(el==='fire' ? 'The roof above you glows red...' : el==='water' ? 'The water draws back around you...' : 'The air goes still, and then it starts to move...','c-you');
}
var _fwaEndTurn = endTurn;
endTurn = function(){ var r=_fwaEndTurn.apply(this, arguments); fwaTick(); return r; };

/* molten rock is not something you walk into by accident */
var _fwaTryMove = tryMove;
tryMove = function(dx, dy){
  if(inFwa() && player && fwaIsLava(player.x+dx, player.y+dy) && !ents.some(function(e){ return e.foe && e.x===player.x+dx && e.y===player.y+dy; })){
    log('Molten rock. You cannot cross it.','c-info'); return;
  }
  return _fwaTryMove.apply(this, arguments);
};

/* ---------------------------------------------------------------- the creatures' turns
   Each of these returns after spending the creature's action; anything they do not handle falls through to
   the AI the rest of the game uses. */
function fwaSees(e){ var p=boltPath(e.x,e.y,player.x,player.y), end=p[p.length-1]; return !!(end && end.x===player.x && end.y===player.y); }
function fwaBurnGround(x,y){ if(inb(x,y) && walkable(x,y) && at(x,y)!==WATER) fireT[idxOf(x,y)]=Math.max(fireT[idxOf(x,y)], 3); }
var _fwaAiAct = aiAct;
aiAct = function(e){
  var b=e&&e.base||{};
  if(!inFwa() || !b.fwa) return _fwaAiAct(e);
  if(typeof MAPVIEW!=='undefined' && MAPVIEW.on) return _fwaAiAct(e);
  var kind=b.fwa, d=dist(e,player), see=canSeePlayer(e);

  /* the Thunder Totem never moves: it wakes when it sees you and zaps down its row or column */
  if(kind==='totem'){
    if(e.st.stun || e.st.frozen){ e.t+=actCost(e); return; }
    if(e.state!=='hunt'){ if(see && d<=7){ e.state='hunt'; log('The <b>Thunder Totem</b> hums awake.','c-info'); } e.t+=actCost(e); return; }
    var inLine=(e.x===player.x || e.y===player.y);
    e.zapCd=(e.zapCd||0)-1;
    if(inLine && see && d<=6 && e.zapCd<=0){
      e.zapCd=2; setClip(e,'attack');
      if(typeof boltFx==='function') boltFx(e.x, e.y, player.x, player.y, 'lightning', {});
      fwaHurt(player, roll(e.dmg[0], e.dmg[1]), 'lightning', e, 'The totem discharges down the line');
      if(player.hp>0 && rng()<0.25) applyStatus(player,'stun',1);
      e.t+=actCost(e); return;
    }
    e.t+=actCost(e); return;
  }
  if(e.state==='asleep' || e.st.stun || e.st.frozen || e.st.fear) return _fwaAiAct(e);

  if(kind==='hop' && e.state==='hunt' && d>=2 && d<=4 && see && (e.hopCd=(e.hopCd||0)-1)<=0){
    var land=nearFree(player.x, player.y, 1);
    if(land){
      fwaBurnGround(e.x, e.y);                                         /* it leaves the ground burning behind it */
      e.x=land.x; e.y=land.y; e._lx=undefined; e.hopCd=3;
      fwaBurnGround(e.x, e.y);
      burst(e.x, e.y, 'fire', 14, 0.05);
      if(vis[idxOf(e.x,e.y)]) log('The <b>Cinder Imp</b> hops at you, and the stone burns where it lands.','c-you');
      e.t+=actCost(e); return;
    }
  }
  if(kind==='dancer' && e.state==='hunt' && d<=1 && rng()<0.35){
    /* it will not stand and trade: a step aside, then it comes back in */
    var side=[[1,1],[1,-1],[-1,1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]].filter(function(o){ return walkable(e.x+o[0],e.y+o[1]) && !occupied(e.x+o[0],e.y+o[1]) && dist({x:e.x+o[0],y:e.y+o[1]}, player)<=2; });
    if(side.length){ var o2=side[Math.floor(rng()*side.length)]; e.x+=o2[0]; e.y+=o2[1]; e._lx=undefined;
      if(vis[idxOf(e.x,e.y)]) log('The <b>Flame Dancer</b> spins out of reach.','c-info');
      e.t+=actCost(e); return; }
  }
  if(kind==='siren' && e.state==='hunt' && see && d>=2 && d<=5 && (e.songCd=(e.songCd||0)-1)<=0 && fwaSees(e)){
    e.songCd=4; setClip(e,'attack');
    sparkleFx(player.x, player.y, 'magic', 20);
    var step=fwaPush(player, e.x-player.x, e.y-player.y, 1);
    applyStatus(player, 'stun', 1);
    log('The <b>Siren</b> sings. You take a step toward her'+(step?'':' but your feet will not move')+' and lose your turn.','c-you');
    e.t+=actCost(e); return;
  }
  if(kind==='drowned' && e.state==='hunt' && d>=2 && d<=4 && see && (e.pullCd=(e.pullCd||0)-1)<=0 && fwaSees(e)){
    e.pullCd=4; setClip(e,'attack');
    var got=fwaPush(player, e.x-player.x, e.y-player.y, 2);
    if(got){ log('The <b>Drowned One</b> hauls you '+got+' tile'+(got>1?'s':'')+' toward it.','c-you'); sfx('trap-web'); }
    e.t+=actCost(e); return;
  }
  if(kind==='hawk' && e.state==='hunt' && d>=3 && d<=5 && see && (e.swoopCd=(e.swoopCd||0)-1)<=0){
    var spot=nearFree(player.x, player.y, 1);
    if(spot){
      e.swoopCd=4; e.x=spot.x; e.y=spot.y; e._lx=undefined; setClip(e,'attack');
      var hd=fwaHurt(player, roll(e.dmg[0], e.dmg[1]), 'phys', e, 'The <b>Storm Hawk</b> stoops on you');
      if(player.hp>0 && hd>0) fwaPush(player, player.x-e.x, player.y-e.y, 1);
      e.t+=actCost(e); return;
    }
  }
  if(kind==='wisp' && e.state==='hunt' && d<=2 && (e.gustCd=(e.gustCd||0)-1)<=0){
    e.gustCd=3;
    var g=fwaPush(player, player.x-e.x, player.y-e.y, 1);
    if(g){ log('The <b>Wind Wisp</b> shoves you back a tile.','c-you'); burst(player.x, player.y, 'lightning', 10, 0.04); }
    e.t+=actCost(e); return;
  }
  /* --- the elites ------------------------------------------------------------------------------- */
  if(kind==='emberlord' && e.state==='hunt'){
    if(e.hp <= e.maxhp*0.5 && !e.kindled){ e.kindled=true; log('<b>The Emberlord</b> flares white-hot. The floor around him catches.','c-you'); SHAKE=8; }
    if(e.kindled) for(var ky=-1;ky<=1;ky++) for(var kx=-1;kx<=1;kx++) fwaBurnGround(e.x+kx, e.y+ky);
    e.eruptCd=(e.eruptCd||0)-1;
    if(e.erupt && turn>=e.erupt.at){
      var cells=e.erupt.cells; e.erupt=null;
      floorMeta.marks=(floorMeta.marks||[]).filter(function(mk){ return mk.kind!=='erupt'; });
      SHAKE=10;
      cells.forEach(function(i){
        var ex=i%MW, ey=(i/MW)|0; burst(ex, ey, 'fire', 18, 0.06);
        ents.slice().forEach(function(t){ if(t.x===ex && t.y===ey && t.hp>0 && !fwaNative(t)){
          fwaHurt(t, roll(14,20)+Math.floor(floorNo/2), 'fire', e, t===player?'<b>The Emberlord\'s eruption</b> tears up through the floor':null);
          if(t.hp>0) applyStatus(t,'burn',3,sDMG(4)); } });
        if(rng()<0.5) fireT[i]=Math.max(fireT[i], 3);
      });
      e.t+=actCost(e); return;
    }
    if(!e.erupt && e.eruptCd<=0 && see && d<=8){
      var ec=[]; for(var ey2=player.y-1; ey2<=player.y+1; ey2++) for(var ex2=player.x-1; ex2<=player.x+1; ex2++) if(inb(ex2,ey2) && walkable(ex2,ey2)) ec.push(idxOf(ex2,ey2));
      if(ec.length){
        e.erupt={cells:ec, at:turn+2}; e.eruptCd=6; setClip(e,'attack');
        floorMeta.marks=(floorMeta.marks||[]).concat([{cells:ec, col:'#FF5A10', until:turn+2, kind:'erupt'}]);
        log('<b>The Emberlord</b> drives a fist into the basalt. The ground under you splits.','c-you');
        e.t+=actCost(e); return;
      }
    }
  }
  if(kind==='leviathan' && e.state==='hunt'){
    e.diveCd=(e.diveCd||0)-1;
    if(e.submerged){
      /* it comes up beside you; while it is under, nothing can reach it (applyDamage below) */
      var up=nearFree(player.x, player.y, 1) || nearFree(e.x, e.y, 2);
      if(up){ e.x=up.x; e.y=up.y; e._lx=undefined; }
      e.submerged=false; e.diveCd=5; SHAKE=6;
      burst(e.x, e.y, 'ice', 30, 0.07);
      log('<b>The Leviathan Eel</b> bursts up out of the water beside you!','c-you');
      e.t+=actCost(e); return;
    }
    if(e.diveCd<=0 && at(e.x,e.y)===WATER && d>1){
      e.submerged=true; e.diveCd=2; burst(e.x, e.y, 'ice', 20, 0.05);
      log('<b>The Leviathan Eel</b> slides under the water. Nothing can touch it down there.','c-info');
      e.t+=actCost(e); return;
    }
    e.sweepCd=(e.sweepCd||0)-1;
    if(d<=1 && e.sweepCd<=0){
      e.sweepCd=4; setClip(e,'attack'); SHAKE=7;
      fwaHurt(player, roll(e.dmg[0], e.dmg[1]), 'phys', e, '<b>The Leviathan\'s tail</b> sweeps you off your feet');
      if(player.hp>0){ fwaPush(player, player.x-e.x, player.y-e.y, 3); applyStatus(player,'stun',1); }
      e.t+=actCost(e); return;
    }
  }
  if(kind==='djinn' && e.state==='hunt'){
    e.cycloneCd=(e.cycloneCd||0)-1; e.boltCd=(e.boltCd||0)-1;
    if(d>=3 && d<=7 && see && e.cycloneCd<=0 && fwaSees(e)){
      e.cycloneCd=6; setClip(e,'attack');
      var pulled=fwaPush(player, e.x-player.x, e.y-player.y, 3);
      applyStatus(player,'stun',1); burst(player.x, player.y, 'lightning', 24, 0.06); SHAKE=6;
      log('<b>The Tempest Djinn</b> opens the whirlwind and drags you '+pulled+' tile'+(pulled===1?'':'s')+' in. You cannot keep your feet.','c-you');
      e.t+=actCost(e); return;
    }
    if(d>=2 && see && e.boltCd<=0 && fwaSees(e)){
      e.boltCd=3; setClip(e,'attack');
      if(typeof boltFx==='function') boltFx(e.x, e.y, player.x, player.y, 'lightning', {});
      fwaHurt(player, roll(e.dmg[0], e.dmg[1]), 'lightning', e, '<b>The Tempest Djinn</b> throws lightning at you');
      e.t+=actCost(e); return;
    }
  }
  return _fwaAiAct(e);
};

/* ---------------------------------------------------------------- damage rules */
var _fwaApplyDamage = applyDamage;
applyDamage = function(target, amount, type, source){
  var b=target && target.base;
  if(b && target!==player && inFwa()){
    if(b.fwa==='leviathan' && target.submerged){
      if(source===player) log('The water closes over <b>the Leviathan Eel</b>. Wait for it to come up.','c-info');
      return 0;
    }
    /* the Tide Crab turns the first blow of each turn on its shell */
    if(b.shellGuard && target._shellTurn!==turn && amount>0){
      target._shellTurn=turn; floatText(target.x, target.y, 'shell', 'miss');
      if(vis[idxOf(target.x,target.y)]) log('The <b>Tide Crab</b> takes it on the shell.','c-info');
      return 0;
    }
  }
  var d=_fwaApplyDamage(target, amount, type, source);
  /* the Flame Dancer's touch sets you alight */
  if(target===player && source && source.base && source.base.kindles && d>0 && player.hp>0){
    applyStatus(player, 'burn', 3, sDMG(3));
    if(!player._fwaLitMsg || player._fwaLitMsg<turn-8){ player._fwaLitMsg=turn; log('The <b>Flame Dancer</b> sets you alight.','c-you'); }
  }
  return d;
};
/* the Magma Crawler bursts when it dies */
var _fwaKill = kill;
kill = function(e, by){
  if(e && e.base && e.base.magmaBurst && e.hp<=0 && ents.indexOf(e)>=0 && inFwa()){
    burst(e.x, e.y, 'fire', 34, 0.09); SHAKE=6;
    if(vis[idxOf(e.x,e.y)]) log('The <b>Magma Crawler</b> bursts open.','c-kill');
    ents.slice().forEach(function(o){
      if(o===e || o.hp<=0 || dist(o,e)>1) return;
      if(o!==player && fwaNative(o)) return;                        /* its own kin are at home in fire */
      fwaHurt(o, roll(8,13), 'fire', null, o===player ? 'Molten rock sprays over you' : null);
      if(o.hp>0) applyStatus(o, 'burn', 2, sDMG(3));
    });
    for(var ky=-1;ky<=1;ky++) for(var kx=-1;kx<=1;kx++) if(rng()<0.5) fwaBurnGround(e.x+kx, e.y+ky);
  }
  return _fwaKill(e, by);
};

/* ---------------------------------------------------------------- placeholder art, all drawn from the terrain
   None of packet 04's pieces exist yet, so the rune stone, the lava, the deep water and the updraft vents are
   drawn here out of the plane's own PT_MAT palette. Each check defers to real art the moment it is packed. */
function fwaRGB(c, a){ return 'rgba('+(c[0]|0)+','+(c[1]|0)+','+(c[2]|0)+','+(a===undefined?1:a)+')'; }
var FWA_RUNE = {};
function fwaRuneCanvas(el){
  if(FWA_RUNE[el]) return FWA_RUNE[el];
  var M=PT_MAT[el], S=128, c=document.createElement('canvas'); c.width=S; c.height=S;
  var g=c.getContext('2d'), base=S-6, w=S*0.34;
  /* a squared monolith in the plane's rock: a lit left plane, a shaded right plane, a dark cap and a glowing rune */
  g.fillStyle='rgba(10,8,14,0.3)'; g.beginPath(); g.ellipse(S/2, base+2, w*1.5, 7, 0, 0, 7); g.fill();
  function face(pts, col){ g.beginPath(); g.moveTo(pts[0],pts[1]); for(var i=2;i<pts.length;i+=2) g.lineTo(pts[i],pts[i+1]); g.closePath(); g.fillStyle=col; g.fill(); }
  var top=S*0.16, lx=S/2-w, rx=S/2+w;
  face([lx,base, lx+5,top+10, S/2,top, rx-5,top+12, rx,base], fwaRGB(M.faceLo));
  face([lx,base, lx+5,top+10, S/2,top, S/2,base], fwaRGB(M.face));
  face([S/2,top, rx-5,top+12, rx,base, S/2,base], fwaRGB(M.faceLo));
  face([lx+5,top+10, S/2,top, rx-5,top+12, S/2,top+22], fwaRGB(M.lip));
  /* chipped edges, so it reads as cut stone and not a box */
  var r=mulberry32(({fire:11,water:22,air:33})[el]||7);
  for(var i=0;i<26;i++){
    var y=top+18+r()*(base-top-24), side=r()<0.5;
    g.fillStyle = r()<0.5 ? fwaRGB(M.topHi) : fwaRGB(M.topLo);
    g.fillRect(Math.round(side ? lx+2+r()*10 : rx-12+r()*10), Math.round(y), 2+Math.round(r()*3), 2);
  }
  /* the rune itself: three strokes of the plane's hot vein colour, with a glow */
  g.save(); g.shadowColor=fwaRGB(M.veinHot, 0.9); g.shadowBlur=10;
  g.strokeStyle=fwaRGB(M.veinHot); g.lineWidth=4; g.lineCap='round';
  var cy=S*0.52, r2=S*0.16;
  if(el==='fire'){                                         /* a flame: a curl rising out of a bar */
    g.beginPath(); g.moveTo(S/2-r2*0.7, cy+r2); g.lineTo(S/2+r2*0.7, cy+r2); g.stroke();
    g.beginPath(); g.moveTo(S/2, cy+r2*0.8); g.quadraticCurveTo(S/2-r2, cy-r2*0.2, S/2, cy-r2); g.quadraticCurveTo(S/2+r2*0.8, cy-r2*0.1, S/2+r2*0.2, cy+r2*0.6); g.stroke();
  } else if(el==='water'){                                 /* three waves */
    for(var k=0;k<3;k++){ var yy=cy-r2*0.7+k*r2*0.7;
      g.beginPath(); g.moveTo(S/2-r2, yy); g.quadraticCurveTo(S/2-r2*0.5, yy-r2*0.45, S/2, yy); g.quadraticCurveTo(S/2+r2*0.5, yy+r2*0.45, S/2+r2, yy); g.stroke(); }
  } else {                                                 /* a spiral of wind */
    g.beginPath();
    for(var t=0;t<Math.PI*3.4;t+=0.12){ var rr2=r2*0.18+t*r2*0.17, px=S/2+Math.cos(t)*rr2, py=cy+Math.sin(t)*rr2*0.8; if(!t) g.moveTo(px,py); else g.lineTo(px,py); }
    g.stroke();
  }
  g.restore();
  g.strokeStyle=fwaRGB(M.vein, 0.5); g.lineWidth=1;
  FWA_RUNE[el]=c; return c;
}
var _fwaDrawPropSurface = drawPropSurface;
drawPropSurface = function(p, px, py, alpha){
  if(inFwa() && p && /^rune-stone-(fire|water|air)$/.test(p.name) && !(typeof packArt==='function' && packArt(p.name))){
    var img=fwaRuneCanvas(floorMeta.plane), cells=p.w||1, W=Math.round(cells*TS*0.95), H=W;
    var X=Math.round((p.x-camX)*TS + (cells*TS-W)/2), Y=Math.round((p.y-camY+(p.h||1))*TS)-H;
    ctx.save(); ctx.globalAlpha=alpha; ctx.imageSmoothingEnabled=false; ctx.drawImage(img, 0, 0, 128, 128, X, Y, W, H); ctx.restore();
    return true;
  }
  if(inFwa() && p && p.name==='updraft-vent' && !(typeof packArt==='function' && packArt('updraft-vent'))){
    var M=PT_MAT.air, cx=(p.x-camX+0.5)*TS, cy=(p.y-camY+0.5)*TS, t=ANIM.reduce ? 0 : performance.now()/1000;
    ctx.save(); ctx.globalAlpha=alpha;
    /* a dark throat in the stone with a pale ring, and three streaks of air rising out of it */
    ctx.fillStyle=fwaRGB(M.void, 0.85); ctx.beginPath(); ctx.ellipse(cx, cy, TS*0.3, TS*0.18, 0, 0, 7); ctx.fill();
    ctx.fillStyle=fwaRGB(M.faceLo, 0.9); ctx.beginPath(); ctx.ellipse(cx, cy+TS*0.03, TS*0.22, TS*0.12, 0, 0, 7); ctx.fill();   /* the throat, lit from inside */
    ctx.strokeStyle=fwaRGB(M.lip, 0.9); ctx.lineWidth=Math.max(1, TS*0.05); ctx.beginPath(); ctx.ellipse(cx, cy, TS*0.32, TS*0.2, 0, 0, 7); ctx.stroke();
    /* the column of air standing over it, so the hole reads as blowing and not as a pit */
    var gv=ctx.createLinearGradient(0, cy-TS*0.9, 0, cy);
    gv.addColorStop(0, 'rgba(226,240,255,0)'); gv.addColorStop(1, 'rgba(226,240,255,'+(0.22+0.07*Math.sin(t*2.2+cx)).toFixed(3)+')');
    ctx.fillStyle=gv; ctx.beginPath(); ctx.moveTo(cx-TS*0.26, cy); ctx.lineTo(cx-TS*0.4, cy-TS*0.9); ctx.lineTo(cx+TS*0.4, cy-TS*0.9); ctx.lineTo(cx+TS*0.26, cy); ctx.closePath(); ctx.fill();
    ctx.strokeStyle='rgba(226,240,255,0.7)'; ctx.lineWidth=Math.max(1, TS*0.035); ctx.lineCap='round';
    for(var k=0;k<3;k++){
      var ph=((t*0.7 + k/3) % 1), rise=TS*(0.1+ph*0.6), sx=cx+(k-1)*TS*0.17;
      ctx.globalAlpha=alpha*(1-ph)*0.9;
      ctx.beginPath(); ctx.moveTo(sx, cy-rise+TS*0.1); ctx.quadraticCurveTo(sx+TS*0.1*Math.sin(t*3+k), cy-rise, sx, cy-rise-TS*0.14); ctx.stroke();
    }
    ctx.restore(); ctx.globalAlpha=1;
    return true;
  }
  return _fwaDrawPropSurface(p, px, py, alpha);
};
/* lava, deep water and the vents' glow go down with the floor, under everything that stands on it */
/* the lava's base colour is painted by planeterrain (the cells are in floorMeta.ptPool, PT_MAT.fire's pool
   palette is molten rock). This only adds what a still raster cannot: crust drifting on the flow, and a soft
   heat glow over it. Nothing is drawn square, so the flow keeps the organic edge the rasters give it. */
function fwaDrawLava(){
  var M=PT_MAT.fire, t=ANIM.reduce ? 0 : performance.now()/1000, salt=(typeof ptSalt==='function'?ptSalt():floorNo*31);
  ctx.save();
  for(var y=camY-1; y<=camY+viewH+1; y++) for(var x=camX-1; x<=camX+viewW+1; x++){
    if(!fwaIsLava(x,y)) continue; var i=idxOf(x,y); if(!(revealAll||seen[i])) continue;
    var px=(x-camX)*TS, py=(y-camY)*TS, a=(revealAll||vis[i]) ? 1 : 0.5;
    var open=0, nb=[[1,0],[-1,0],[0,1],[0,-1]];
    for(var n=0;n<4;n++) if(!fwaIsLava(x+nb[n][0], y+nb[n][1])) open++;
    /* crust: dark plates drifting on the flow, a bright seam where they part. Only well inside the flow, so
       the shore keeps the clean molten edge the raster drew. */
    if(!open) for(var k=0;k<3;k++){
      var h1=hash2(x*2+k, y*2, salt+7), h2=hash2(x*2+k, y*2+1, salt+9);
      var ox=px+((h1 + t*0.03*(1+k*0.3)) % 1)*TS, oy=py+h2*TS*0.7+TS*0.15;
      ctx.globalAlpha=a*0.8; ctx.fillStyle=fwaRGB(M.topLo);
      ctx.beginPath(); ctx.ellipse(ox, oy, TS*(0.14+h1*0.11), TS*(0.07+h2*0.05), h1*3, 0, 7); ctx.fill();
      ctx.globalAlpha=a*0.45; ctx.fillStyle=fwaRGB(M.poolEdge);
      ctx.fillRect(Math.round(ox-TS*0.1), Math.round(oy-TS*0.09), Math.max(1,Math.round(TS*0.2)), 1);
    }
    /* the heat: a soft pulse over the flow, strongest where it laps against the rock */
    ctx.globalCompositeOperation='lighter';
    var cxp=px+TS/2, cyp=py+TS/2, gr=ctx.createRadialGradient(cxp, cyp, 0, cxp, cyp, TS*0.8);
    var k2=(0.16+0.07*Math.sin(t*1.6 + x*0.7 + y*0.5)) * a * (open ? 1.5 : 1);
    gr.addColorStop(0, fwaRGB(M.poolRim, k2)); gr.addColorStop(1, fwaRGB(M.vein, 0));
    ctx.globalAlpha=1; ctx.fillStyle=gr; ctx.fillRect(px-TS*0.3, py-TS*0.3, TS*1.6, TS*1.6);
    ctx.globalCompositeOperation='source-over';
  }
  ctx.restore(); ctx.globalAlpha=1;
}
/* Where the bottom drops away. A per-cell fill would draw the deep as a staircase of squares (and stacking
   soft edges cell by cell paints a grid over the pool), so every visible deep cell goes into ONE path as a
   circle a little wider than its tile: overlapping circles filled in a single pass give the drop-off an
   organic outline, and the pale line round that same path is the waterline. */
function fwaDrawDeep(){
  var D=floorMeta.fwaDeep; if(!D) return;
  var M=PT_MAT.water, t=ANIM.reduce ? 0 : performance.now()/1000, lit=[], mem=[];
  for(var y=camY-1; y<=camY+viewH+1; y++) for(var x=camX-1; x<=camX+viewW+1; x++){
    if(!inb(x,y)) continue; var i=idxOf(x,y); if(!D[i] || !(revealAll||seen[i])) continue;
    ((revealAll||vis[i]) ? lit : mem).push([x,y]);
  }
  if(!lit.length && !mem.length) return;
  ctx.save();
  [[mem,0.5],[lit,1]].forEach(function(set){
    var cells=set[0], a=set[1]; if(!cells.length) return;
    function ring(r){ var p=new Path2D(); cells.forEach(function(c){ var cx=(c[0]-camX+0.5)*TS, cy=(c[1]-camY+0.5)*TS; p.moveTo(cx+r, cy); p.arc(cx, cy, r, 0, 6.2832); }); return p; }
    /* the wider path first: what still shows round the edge of the narrower one is the waterline */
    ctx.globalAlpha=0.3*a; ctx.fillStyle=fwaRGB(M.poolRim); ctx.fill(ring(TS*0.84));
    ctx.globalAlpha=0.42*a; ctx.fillStyle=fwaRGB(M.pool); ctx.fill(ring(TS*0.74));
  });
  /* a slow band of cyan light travelling over the deep */
  ctx.globalCompositeOperation='lighter';
  lit.forEach(function(c){
    var sh=((t*0.12 + hash2(c[0],c[1],301))%1); if(sh>=0.6) return;
    ctx.globalAlpha=0.13*Math.sin(sh/0.6*Math.PI); ctx.fillStyle=M.poolLight;
    ctx.beginPath(); ctx.ellipse((c[0]-camX+sh*1.2)*TS, (c[1]-camY+0.5)*TS, TS*0.3, TS*0.07, -0.3, 0, 7); ctx.fill();
  });
  ctx.restore(); ctx.globalAlpha=1;
}
/* wind streaks: the one thing that makes pale stone read as the Plane of Air rather than a bright cave.
   Thin pale strokes drift across the open floor along a slowly turning wind, each on its own clock. They are
   derived from position and the floor seed, held outside floorMeta (nothing to save) and never drawn over rock. */
var FWA_WIND = {key:null, list:null};
function fwaWindStreaks(){
  var key=floorNo+':'+(typeof worldSeed==='number'?worldSeed:0)+':'+(map?map.length:0);
  if(FWA_WIND.key===key) return FWA_WIND.list;
  var r=mulberry32((typeof ptSalt==='function'?ptSalt():floorNo*31)^0x5A17), out=[];
  for(var i=0;i<90;i++) out.push({x:r()*MW, y:r()*MH, ph:r(), sp:0.25+r()*0.5, len:0.7+r()*1.6, a:0.25+r()*0.45});
  FWA_WIND.key=key; FWA_WIND.list=out; return out;
}
function fwaDrawWind(){
  if(ANIM.reduce) return;
  var t=performance.now()/1000, ang=Math.sin(t*0.07)*0.6 - 0.35, dx=Math.cos(ang), dy=Math.sin(ang)*0.55;
  ctx.save(); ctx.lineCap='round'; ctx.globalCompositeOperation='lighter';
  fwaWindStreaks().forEach(function(s){
    var travel=((t*s.sp + s.ph) % 1), span=14;
    var wx=s.x + dx*(travel-0.5)*span, wy=s.y + dy*(travel-0.5)*span;
    if(wx<camX-1 || wx>camX+viewW+1 || wy<camY-1 || wy>camY+viewH+1) return;
    var cx=Math.floor(wx), cy=Math.floor(wy);
    if(!inb(cx,cy) || !(revealAll||vis[idxOf(cx,cy)]) || isWallLike(at(cx,cy))) return;
    var fade=Math.sin(travel*Math.PI);                                        /* in and out at the ends of its run */
    ctx.globalAlpha=s.a*fade*0.5;
    ctx.strokeStyle='rgba(232,244,255,0.9)'; ctx.lineWidth=Math.max(1, TS*0.035);
    var px=(wx-camX)*TS, py=(wy-camY)*TS, lx=dx*s.len*TS, ly=dy*s.len*TS;
    ctx.beginPath(); ctx.moveTo(px, py); ctx.quadraticCurveTo(px+lx*0.5, py+ly*0.5-TS*0.12, px+lx, py+ly); ctx.stroke();
  });
  ctx.restore(); ctx.globalAlpha=1;
}
var _fwaDrawSurfaceDeco = drawSurfaceDeco;
drawSurfaceDeco = function(){
  var r=_fwaDrawSurfaceDeco.apply(this, arguments);
  if(!inFwa()) return r;
  if(floorMeta.plane==='fire') fwaDrawLava();
  else if(floorMeta.plane==='water') fwaDrawDeep();
  else if(floorMeta.plane==='air') fwaDrawWind();
  return r;
};

/* ---------------------------------------------------------------- words */
var _fwaInspectHTML = inspectHTML;
inspectHTML = function(mx, my){
  var h=_fwaInspectHTML(mx, my);
  if(!inFwa() || !inb(mx,my)) return h;
  var e=ents.filter(function(o){ return o.x===mx && o.y===my && o!==player; })[0];
  if(e && h && e.base && FWA_HINT[e.kind] && (revealAll||vis[idxOf(mx,my)])){
    var line='<div class="hint">'+FWA_HINT[e.kind]+'</div>', at2=h.indexOf('<div class="odds">');
    return at2>=0 ? h.slice(0,at2)+line+h.slice(at2) : h+line;
  }
  if(!e && (revealAll||seen[idxOf(mx,my)])){
    if(fwaIsLava(mx,my)) return '<div class="nm">Molten rock</div><div class="hint">Impassable. It scorches anything that ends a turn beside it.</div>';
    if(fwaDeepAt(mx,my)) return '<div class="nm">Deep water</div><div class="hint">You can cross it, but it drags you down: damage and a chill every turn you end in it.</div>';
    if(fwaVentAt(mx,my)) return '<div class="nm">Updraft vent</div><div class="hint">The gust throws you a tile off it.</div>';
  }
  return h;
};
