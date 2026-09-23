/* ============================================================================
   world.js - terrain, layers and floor generation for biome 1 (floors 1-5).
   Replaces game.js generate(), walkable() and opaque().
   ========================================================================== */

/* tiles beyond game.js's WALL..OPEN (0-7) */
var CHASM=8, LOCKED=9, SHRINE=10, ICEDOOR=11, THORNS=12, EXIT=13, TOLL=14, SECRET=15, WATER=16, BRIDGE=17, SEALED=18;
/* ground layer */
var G_NONE=0, G_GRASS=1, G_SHORT=2, G_ASH=3, G_PUDDLE=4, G_BLOOD=5, G_SCORCH=6, G_MOSS=7, G_BONES=8, G_ICE=9, G_TELL=10, G_WEB=11;
var GROUND_ART = {1:'grass-tall',2:'grass-short',3:'ash',4:'puddle',5:'blood',6:'scorch',7:'moss',8:'bones-scatter',9:'ice-patch',10:'tell-uneven',11:'web-floor'};

var ground, fireT, props=[], propGrid, chestKind={}, floorMeta={}, levers=[], plates=null, altars={};
var RUN = null;   /* run-wide state: forge floor, shrine floor and god, mote plan, heroic resolve, victory */

function inb(x,y){ return x>=0 && y>=0 && x<MW && y<MH; }
function idxOf(x,y){ return y*MW+x; }
function gAt(x,y){ return inb(x,y) ? ground[idxOf(x,y)] : 0; }
function setG(x,y,v){ if(inb(x,y)) ground[idxOf(x,y)]=v; }
function propAt(x,y){ if(!inb(x,y)) return null; var i=propGrid[idxOf(x,y)]; return i>=0 ? props[i] : null; }
function rebuildPropGrid(){ propGrid.fill(-1); for(var i=0;i<props.length;i++) propGrid[idxOf(props[i].x,props[i].y)]=i; }
/* tiles that hold their own object: a prop never shares one (a torch stand once stood inside a chest) */
function objectTile(t){ return t===CHEST || t===STAIRS || t===FORGE || t===DOOR || t===OPEN || (typeof SHRINE!=='undefined' && t===SHRINE) || (typeof EXIT!=='undefined' && t===EXIT); }
function addProp(x,y,name,extra){
  if(!inb(x,y) || propAt(x,y) || objectTile(at(x,y))) return null;
  var d=PROPS[name]||{}, p={x:x,y:y,name:name};
  for(var k in d) p[k]=d[k];
  for(var e in (extra||{})) p[e]=extra[e];
  props.push(p); propGrid[idxOf(x,y)]=props.length-1; return p;
}
function removeProp(p){ var i=props.indexOf(p); if(i<0) return; props.splice(i,1); rebuildPropGrid(); }

/* ---- movement and sight rules ---- */
function walkable(x,y){
  var t=at(x,y);
  if(!(t===FLOOR||t===OPEN||t===STAIRS||t===RUBBLE||t===WATER||t===BRIDGE||(t===EXIT&&floorMeta.exitOpen))) return false;
  var p=propGrid ? propAt(x,y) : null;
  return !(p && p.b);
}
function passable(x,y){ var t=at(x,y); return walkable(x,y) || t===DOOR || t===CHEST; }
function opaque(x,y){
  var t=at(x,y);
  if(t===WALL||t===DOOR||t===LOCKED||t===ICEDOOR||t===THORNS||t===SECRET||t===SEALED||t===TOLL) return true;
  if(ground && gAt(x,y)===G_GRASS) return true;
  return false;
}
function isDoorish(t){ return t===DOOR||t===OPEN||t===LOCKED||t===ICEDOOR||t===THORNS||t===TOLL||t===SEALED||t===SECRET; }
function roomAt(x,y){ for(var i=0;i<rooms.length;i++){ var r=rooms[i]; if(x>=r.x&&x<r.x+r.w&&y>=r.y&&y<r.y+r.h) return r; } return null; }
function inRoom(x,y){ return !!roomAt(x,y); }
function occupied(x,y){ return ents.some(function(e){ return e.x===x && e.y===y; }); }
function itemAt(x,y){ for(var i=0;i<items.length;i++) if(items[i].x===x && items[i].y===y) return items[i]; return null; }
function freeCell(x,y){ return at(x,y)===FLOOR && !propAt(x,y) && !itemAt(x,y) && !occupied(x,y) && !feats.some(function(f){return f.x===x&&f.y===y;}); }

/* ---- biomes: every 5 floors (2026-09-17, biome 2) ---- */
var LAST_FLOOR = 15;   /* the deepest built floor: the Caverns' boss arena (2026-09-19; was 10, the Crypt's boss hall) */
var BIOME_NAMES = ['Dungeon', 'Crypt', 'Caverns', 'Temple', 'Realm of Chaos'];
function bidx(n){ return Math.floor(((n||floorNo)-1)/5); }
function bfloor(n){ return ((n||floorNo)-1)%5+1; }
function biomeName(n){ return BIOME_NAMES[Math.min(BIOME_NAMES.length-1, bidx(n))]; }
/* which elemental planes each biome's portal may open onto, by biome index (DESIGN.md section 17). A biome
   that is not listed here never rolls a portal. The two branches are deliberately disjoint: one run can reach
   at most one plane from each. */
var BIOME_PLANES = {1:['light','shadow','earth'], 3:['fire','water','air']};
/* each biome's Forge, shrine, portal and mote floors, rolled once per run (biome 1 keeps its original fields) */
function biomePlan(b){
  if(b===undefined) b=bidx();
  if(!RUN) return {};
  if(b===0) return {forge:RUN.forgeFloor, shrine:RUN.shrineFloor, motes:RUN.motePlan, portal:null};
  RUN.biomes = RUN.biomes || {};
  if(RUN.biomes[b]) return RUN.biomes[b];
  var r=mulberry32(((RUN.seed||1) ^ (0x51ed27 * (b+1)))>>>0), base=b*5;
  var forge=base+(r()<0.5?3:4), shrine, portal=null;
  do { shrine=base+1+Math.floor(r()*4); } while(shrine===forge && r()<0.7);
  var els=ELEMENTS.slice(); for(var i=els.length-1;i>0;i--){ var j=Math.floor(r()*(i+1)); var t=els[i]; els[i]=els[j]; els[j]=t; }
  var motes={}; motes[base+1]=[els[0]]; motes[base+2]=[els[1],els[2]]; motes[base+3]=[els[3]]; motes[base+4]=[els[4],els[5]]; motes[base+5]=[];
  var planeEl=null;
  if(BIOME_PLANES[b]){
    do { portal=base+1+Math.floor(r()*4); } while(portal===forge);
    /* 2026-09-19: the two branches are now written down rather than inferred. The pool used to be every plane
       with a roster minus whatever the Crypt had offered, which was the only way to keep them apart while only
       three planes existed; with all six built that would let the Crypt send you to Fire and the Underdark to
       Light. DESIGN.md: the Crypt (biome 1) offers Light, Shadow or Earth; biome 4 offers Fire, Air or Water.
       A plane only enters the pool once it has a roster, so a half-built one is skipped rather than opened
       onto an undefined roster, and an empty pool means no portal rather than a broken one. */
    var pool = BIOME_PLANES[b].filter(function(e){ return typeof PLANE_ROSTER!=='undefined' && !!PLANE_ROSTER[e]; });
    planeEl = pool.length ? pool[Math.floor(r()*pool.length)] : null;
    if(!planeEl) portal = null;
  }
  RUN.biomes[b] = {forge:forge, shrine:b<=3 ? shrine : null, motes:motes, portal:portal, plane:planeEl, god:godDeal()[b]};
  return RUN.biomes[b];
}

/* ---------------------------------------------------------------- the shrine gods: four, all different
   2026-09-18: each biome used to draw its god at random from everyone but the first shrine's, independently,
   so 39% of runs repeated one - you could walk past a god you did not want and be offered the same god again
   two biomes later, and the odds of finding the one you wanted never improved as the run went on. One
   shuffle, four cards off the top. Old saves rebuild the same deal from their own seed. */
function godDeal(){
  if(RUN.godDeal) return RUN.godDeal;
  var r = mulberry32(((RUN.seed||0) ^ 0x6f5a1c3d)>>>0), ids = Object.keys(GODS);
  for(var i=ids.length-1;i>0;i--){ var j=Math.floor(r()*(i+1)); var t=ids[i]; ids[i]=ids[j]; ids[j]=t; }
  RUN.godDeal = ids.slice(0, 4);
  return RUN.godDeal;
}

/* ---- run state ---- */
function newRunState(seed){
  var r = mulberry32((seed ^ 0x5bd1e995)>>>0);
  var godIds=Object.keys(GODS);
  var els=ELEMENTS.slice();
  for(var i=els.length-1;i>0;i--){ var j=Math.floor(r()*(i+1)); var t=els[i]; els[i]=els[j]; els[j]=t; }
  RUN = {
    seed: seed>>>0,
    forgeFloor: r()<0.5 ? 3 : 4,
    shrineFloor: 1 + Math.floor(r()*4),
    shrineGod: godIds[Math.floor(r()*godIds.length)],
    /* one mote of every element somewhere in floors 1-4, plus a spare */
    motePlan: {1:[els[0]], 2:[els[1],els[2]], 3:[els[3]], 4:[els[4],els[5]], 5:[]},
    resolveUsed: false, victory: false, bossDead: false, turns: 0, kills: 0
  };
  RUN.shrineGod = godDeal()[0];                    /* the first card of the four-god deal */
  if(RUN.shrineFloor===RUN.forgeFloor && r()<0.5) RUN.shrineFloor = RUN.forgeFloor===3 ? 2 : 1;
  return RUN;
}

/* ============================================================== generation */
function generate(seed){
  /* Status/buff timing uses this scheduler clock across the whole run.  Resetting
     it on every new floor left carried effects with timestamps far in the future,
     so they stopped counting down and affected saves preserved the mismatch. */
  var floorClock=(typeof player!=='undefined' && player && Number.isFinite(player.t))?player.t:0;
  for(var attempt=0; attempt<8; attempt++){
    if(generateOnce((seed + attempt*7919)>>>0)){
      /* later room builders can wall over a cell chosen earlier: drop traps and loot left inside walls */
      feats = feats.filter(function(f){ return at(f.x,f.y)===FLOOR && !propAt(f.x,f.y); });
      items = items.filter(function(it){ return walkable(it.x,it.y) || at(it.x,it.y)===STAIRS; });
      /* a chest, stairs or door placed after a prop takes the tile */
      props = props.filter(function(p){ return !objectTile(at(p.x,p.y)); }); rebuildPropGrid();
      /* everyone on a fresh floor starts on the same, run-wide clock */
      if(typeof player!=='undefined' && player) player.t=floorClock;
      ents.forEach(function(e){ e.t=floorClock; });
      return;
    }
  }
}

function generateOnce(seed){
  rng = mulberry32(seed>>>0);
  map=new Uint8Array(MW*MH); seen=new Uint8Array(MW*MH); vis=new Uint8Array(MW*MH);
  ground=new Uint8Array(MW*MH); fireT=new Uint8Array(MW*MH); propGrid=new Int16Array(MW*MH).fill(-1);
  feats=[]; items=[]; ents=[]; props=[]; chestKind={}; levers=[]; plates=null; altars={};
  var BP=biomePlan();
  /* 2026-09-17: every boss floor carries a Forge as well as the biome's own. Without one you have to climb
     back up to spend a mote or an upgrade before descending, every single biome. */
  floorMeta={ floor:floorNo, biome:bidx(), boss:bfloor()===5, forge:RUN && (BP.forge===floorNo || bfloor()===5), shrine:RUN && BP.shrine===floorNo && floorNo<=20, portal:RUN && BP.portal===floorNo ? BP.plane : null,   /* shrines only in biomes 1-4: four in a run */
              exitOpen:false, keyHolder:false, notes:[] };
  if(RUN){ if(BP.god && floorMeta.shrine) RUN.shrineGod=BP.god; floorMeta.shrineGod=RUN.shrineGod; }
  var i, j, x, y;

  /* ---- rooms by BSP ---- */
  /* 2026-09-19: the Caverns (biome 3) lay out cellular-automata caves instead (js/caverns.js caveLayout) */
  rooms=[];
  if(typeof caveLayout==='function' && caveLayout()){ /* map and rooms[] are built */ } else {
  /* the boss floor is a short approach to the throne room: build it in a small corner of the map */ var leaves=[ floorMeta.boss ? {x:1,y:1,w:(bidx()===1 && typeof stampCryptBossHall==='function') ? 25 : 30,h:22} : {x:1,y:1,w:MW-2,h:MH-2} ];
  for(i=0;i<6;i++){
    var next=[];
    for(j=0;j<leaves.length;j++){
      var L=leaves[j], min=8;
      var horiz = L.w < L.h*1.25 ? true : (L.h < L.w*1.25 ? false : rng()<0.5);
      if(horiz && L.h>min*2){ var cy=ri(min,L.h-min); next.push({x:L.x,y:L.y,w:L.w,h:cy},{x:L.x,y:L.y+cy,w:L.w,h:L.h-cy}); }
      else if(!horiz && L.w>min*2){ var cx=ri(min,L.w-min); next.push({x:L.x,y:L.y,w:cx,h:L.h},{x:L.x+cx,y:L.y,w:L.w-cx,h:L.h}); }
      else next.push(L);
    }
    if(next.length===leaves.length) break;
    leaves=next;
  }
  for(i=0;i<leaves.length;i++){
    var A=leaves[i];
    var w=ri(4,Math.max(4,A.w-3)), h=ri(4,Math.max(4,A.h-3));
    if(rng()<0.25 && A.w>10 && A.h>9){ w=Math.max(w, A.w-4); h=Math.max(h, A.h-4); }   /* a few big halls */
    var rx=A.x+ri(1,Math.max(1,A.w-w-2)), ry=A.y+ri(1,Math.max(1,A.h-h-2));
    w=Math.min(w, MW-2-rx); h=Math.min(h, MH-2-ry);
    for(y=ry;y<ry+h;y++) for(x=rx;x<rx+w;x++) setT(x,y,FLOOR);
    rooms.push({x:rx,y:ry,w:w,h:h,cx:rx+(w>>1),cy:ry+(h>>1),id:i});
  }
  rooms.sort(function(p,q){ return p.cx-q.cx; });
  var joined=[rooms[0]];
  for(i=1;i<rooms.length;i++){
    var target=rooms[i], best=joined[0], bd=1e9;
    for(j=0;j<joined.length;j++){ var dd=Math.abs(joined[j].cx-target.cx)+Math.abs(joined[j].cy-target.cy); if(dd<bd){ bd=dd; best=joined[j]; } }
    carveCorridor(target.cx,target.cy,best.cx,best.cy);
    joined.push(target);
  }
  /* a couple of extra loops so the map is not a pure tree */
  for(i=0;i<2;i++){ var ra=pick(rooms), rb=pick(rooms); if(ra!==rb) carveCorridor(ra.cx,ra.cy,rb.cx,rb.cy); }
  for(i=1;i<rooms.length;i++) if(!reachable(rooms[0].cx,rooms[0].cy,rooms[i].cx,rooms[i].cy)) carveCorridor(rooms[i].cx,rooms[i].cy,rooms[0].cx,rooms[0].cy,true);
  for(i=0;i<rooms.length;i++){
    var r=rooms[i];
    for(var k=r.x;k<r.x+r.w;k++){
      if(doorSpot(k,r.y-1,true) && rng()<0.7) setT(k,r.y-1,DOOR);
      if(doorSpot(k,r.y+r.h,true) && rng()<0.7) setT(k,r.y+r.h,DOOR);
    }
    for(var m=r.y;m<r.y+r.h;m++){
      if(doorSpot(r.x-1,m,false) && rng()<0.7) setT(r.x-1,m,DOOR);
      if(doorSpot(r.x+r.w,m,false) && rng()<0.7) setT(r.x+r.w,m,DOOR);
    }
  }
  }   /* end of the BSP layout (2026-09-19) */

  var cryptHall = (floorMeta.boss && bidx()===1 && typeof stampCryptBossHall==='function') ? stampCryptBossHall() : null;   /* Morty's hall (js/cryptset.js) */

  /* ---- roles: start far from the exit ---- */
  var start=rooms[0], dists=bfsFrom(start.cx,start.cy);
  var far=rooms.slice().sort(function(a,b){ return (dists[idxOf(b.cx,b.cy)]||0)-(dists[idxOf(a.cx,a.cy)]||0); });
  var goal = far[0]===start ? far[1] : far[0];
  if(floorMeta.boss){
    var big=rooms.filter(function(r){ return r!==start; }).sort(function(a,b){ return b.w*b.h-a.w*a.h; })[0];
    goal=cryptHall||big; goal.role='boss';
  } else { goal.role='stairs'; }
  start.role='start';
  var used={}; used[start.id]=1; used[goal.id]=1;
  function freeRoom(minArea, pred){
    var c=rooms.filter(function(r){ return !used[r.id] && r.w*r.h>=minArea && (!pred||pred(r)); });
    if(!c.length) return null;
    var r=pick(c); used[r.id]=1; return r;
  }

  /* ---- required features ---- */
  if(floorMeta.boss){ if(bidx()===1 && typeof buildMortyHall==='function') buildMortyHall(goal); else buildBossRoom(goal); }
  else { var sEnd=floorNo>5 ? carveDeadEnd(goal) : null; if(!sEnd && floorNo>5){ var alt=rooms.filter(function(r){ return r!==goal && r!==start && !r.pocket; }).sort(function(a,b){ return (Math.abs(a.cx-goal.cx)+Math.abs(a.cy-goal.cy))-(Math.abs(b.cx-goal.cx)+Math.abs(b.cy-goal.cy)); }); for(var ai=0;ai<alt.length && !sEnd;ai++) sEnd=carveDeadEnd(alt[ai]); } if(sEnd){ setT(sEnd.x,sEnd.y,STAIRS); floorMeta.stairsHall=true; } else setT(goal.cx,goal.cy,STAIRS); decorateEdges(goal, ['torch-stand'], 2, true); }
  if(floorMeta.forge){ var fr=freeRoom(16)||freeRoom(9); if(fr){ fr.role='forge'; setT(fr.cx,fr.cy,FORGE); decorateEdges(fr,['brazier-lit','torch-stand'],2,true); floorMeta.forgeAt={x:fr.cx,y:fr.cy}; } }
  if(floorMeta.shrine){ var sr=freeRoom(12)||freeRoom(9); if(sr){ sr.role='shrine'; setT(sr.cx,sr.cy,SHRINE); floorMeta.shrineAt={x:sr.cx,y:sr.cy};
      decorateEdges(sr,['statue','banner-stand'],2,true); } }   /* no braziers: the shrine carries its own glow */

  /* ---- pockets: vaults, puzzles, toll rooms, hidden rooms ---- */
  if(floorNo>=2) buildLockedVault();
  var fb=bfloor();
  var puzzles = fb===1 ? [] : fb===2 ? ['icedoor','plates'] : fb===3 ? ['elemlock','thorns','chasm'] : fb===4 ? ['chasm','plates','elemlock','icedoor'] : ['thorns'];
  if(puzzles.length){ var pz=pick(puzzles); buildPuzzle(pz); if(fb===4 && rng()<0.5) buildPuzzle(pick(puzzles.filter(function(p){return p!==pz;}))); }
  if(floorNo>=3 && rng()<0.55) buildTollRoom();
  if(rng()<0.45) buildHiddenRoom();

  /* ---- special rooms ---- */
  var specials = [
    ['garden',1,9,3], ['storage',1,9,3], ['library',1,12,2], ['nest',1,12,2], ['armory',2,12,2], ['prison',2,12,1.5],
    ['zoo',2,20,1.2], ['sacrifice',2,12,1.2], ['statues',3,16,1], ['treasury',3,16,1], ['barracks',2,16,1.5], ['dark',3,16,0.8], ['traps',2,16,1.3]
  ].filter(function(s){ return floorNo>=s[1] && !(floorMeta.boss && (s[0]==='zoo'||s[0]==='treasury')); });
  var nSpecial = floorMeta.boss ? 1 : (floorNo===1 ? 2 : 2 + (rng()<0.5?1:0));
  var zooDone=false;
  for(i=0;i<nSpecial;i++){
    var pool=specials.filter(function(s){ return !(s[0]==='zoo'&&zooDone); });
    var tot=pool.reduce(function(a,s){return a+s[3];},0), roll2=rng()*tot, chosen=pool[0];
    for(j=0;j<pool.length;j++){ roll2-=pool[j][3]; if(roll2<=0){ chosen=pool[j]; break; } }
    var room=freeRoom(chosen[2]);
    if(!room) continue;
    buildSpecial(chosen[0], room);
    if(chosen[0]==='zoo') zooDone=true;
  }
  rooms.forEach(function(r){ if(!used[r.id]) decoratePlain(r); });

  /* ---- terrain patches ---- */
  var gn=ri(2,4); for(i=0;i<gn;i++){ var gr=pick(rooms); blob(gr.x+ri(0,gr.w-1), gr.y+ri(0,gr.h-1), ri(5,14), function(xx,yy){ if(at(xx,yy)===FLOOR && !gAt(xx,yy) && !propAt(xx,yy)) setG(xx,yy,G_GRASS); }); }
  var wn=ri(1,2); for(i=0;i<wn;i++){ var wr=pick(rooms.filter(function(r){ return r.role!=='start' && r.role!=='boss'; }))||pick(rooms);
    blob(wr.x+ri(1,Math.max(1,wr.w-2)), wr.y+ri(1,Math.max(1,wr.h-2)), ri(3,8), function(xx,yy){ if(at(xx,yy)===FLOOR && !propAt(xx,yy)) { setT(xx,yy,WATER); setG(xx,yy,0); } }); }
  for(i=0;i<8;i++){ var pr=pick(rooms), px=pr.x+ri(0,pr.w-1), py=pr.y+ri(0,pr.h-1); if(at(px,py)===FLOOR && !gAt(px,py)) setG(px,py,pick([G_PUDDLE,G_MOSS,G_MOSS,G_BONES,G_BLOOD])); }

  /* ---- chests ---- */
  var nChest = floorNo===1 ? 2 : 2;
  for(i=0;i<nChest;i++){ var cr=pick(rooms.filter(function(r){ return r.role!=='start'; })); var cx2=cr.x+ri(0,cr.w-1), cy2=cr.y+ri(0,cr.h-1);
    if(freeCell(cx2,cy2) && !nearDoor(cx2,cy2)) { setT(cx2,cy2,CHEST); chestKind[idxOf(cx2,cy2)] = rng()<0.12&&floorNo>=2 ? 'mimic' : 'chest-wood'; } }

  /* ---- traps (in rooms, never in doorways or corridors) ---- */
  var trapKinds=Object.keys(TRAPS).filter(function(k){ return TRAPS[k].minFloor<=floorNo; });
  var nTraps = Math.round((2 + floorNo*2)*0.8);
  for(i=0;i<nTraps*3 && feats.filter(function(f){ return !f.room; }).length<nTraps;i++){
    var tr=pick(rooms); if(tr.role==='start') continue;
    var tx=tr.x+ri(0,tr.w-1), ty=tr.y+ri(0,tr.h-1);
    if(at(tx,ty)!==FLOOR || propAt(tx,ty) || nearDoor(tx,ty) || feats.some(function(f){return Math.abs(f.x-tx)+Math.abs(f.y-ty)<3;})) continue;
    feats.push({x:tx,y:ty,kind:pick(trapKinds),found:false});
  }

  /* ---- items ---- */
  var open=[];
  for(y=0;y<MH;y++) for(x=0;x<MW;x++) if(freeCell(x,y) && !nearDoor(x,y) && inRoom(x,y)) open.push({x:x,y:y});
  if(open.length<(floorMeta.boss?12:30)) return false;
  function drop(it){ var c=pick(open); if(!freeCell(c.x,c.y)) return; it.x=c.x; it.y=c.y; items.push(it); }
  for(i=0;i<3;i++) drop({kind:'essence', n:ri(5,12)+floorNo*2});
  drop(randomGear()); if(rng()<0.6) drop(randomGear());
  if(rng()<0.25) drop({kind:'sigil', use:randomSigilUse()});   /* about one loose sigil every other floor; chests, crates and monsters add the rest */
  /* 2026-09-22 (Justin, starving all game): one meal on every floor and a 45% chance of a second. Hunger is a
     reason to keep moving, not a clock you lose to; the meals themselves are unchanged (a Ration is 47%). */
  drop({kind:'food', food: randomFood()}); if(rng()<0.45) drop({kind:'food', food: randomFood()});
  ((biomePlan().motes||{})[floorNo]||[]).forEach(function(el){ drop({kind:'mote', el:el}); });

  /* ---- start ---- */
  player.x=start.cx; player.y=start.cy;
  if(!walkable(player.x,player.y)){ var sp=nearestWalkable(player.x,player.y); player.x=sp.x; player.y=sp.y; }
  ents=[player]; spawnedExtra=0; nextSpawn=turn + ri(45,75);

  /* ---- monsters ---- */
  var count = floorMeta.boss ? 9 : 12 + bfloor()*3 + bidx()*2;   /* 2026-09-17: roughly double the old density so a full clear levels you steadily; the boss floor is a shorter approach */
  for(i=0;i<count*4 && ents.filter(function(e){return e.foe;}).length<count;i++){
    var s=pick(open); if(!walkable(s.x,s.y) || occupied(s.x,s.y)) continue;
    if(Math.abs(s.x-player.x)+Math.abs(s.y-player.y) < 12) continue;
    var rm=roomAt(s.x,s.y); if(rm && (rm.role==='boss'||rm.special==='zoo'||rm.role==='forge'||rm.role==='shrine')) continue;
    var kind=rollMonster(), base=MONSTERS[kind];
    var n = base.pack ? ri(base.pack[0],base.pack[1]) : 1;
    for(var q=0;q<n;q++){
      var spot = q===0 ? s : nearFree(s.x,s.y,2);
      if(!spot) break;
      var mm=spawn(kind, spot.x, spot.y);
      mm.state = inRoom(spot.x,spot.y) ? (rng()<0.8?'asleep':'wander') : 'wander';
    }
  }
  if(floorMeta.vault && !floorMeta.keyHolder){
    /* 2026-09-17: the key must be OUTSIDE the door it opens. The holder used to be picked from every foe on
       the floor, so one sleeping in the vault locked the floor for good (16% of vault floors), and on later
       biomes the goblin/archer/brute list was empty so no holder spawned at all. Now: reachable foes only,
       any kind, and if there are none the key is simply left on the floor where you can walk to it. */
    var freeSide = keyReachable();
    var cands=ents.filter(function(e){ return e.foe && !e.base.boss && freeSide[idxOf(e.x,e.y)]; });
    var pref=cands.filter(function(e){ return e.kind==='goblin'||e.kind==='archer'||e.kind==='brute'; });
    var holder = pref.length ? pick(pref) : (cands.length ? pick(cands) : null);
    if(holder){ holder.keyholder=true; holder.name=holder.name+' (key holder)'; floorMeta.keyHolder=true; }
    else {
      for(var kt=0; kt<80 && !floorMeta.keyHolder; kt++){
        var hs=pick(open);
        if(!freeSide[idxOf(hs.x,hs.y)] || !walkable(hs.x,hs.y) || occupied(hs.x,hs.y) || itemAt(hs.x,hs.y)) continue;
        items.push({x:hs.x, y:hs.y, kind:'key', key:'iron'});
        floorMeta.keyHolder=true;
      }
    }
  }
  if(rng() < 0.30 + 0.05*floorNo && !floorMeta.boss){
    var rk=rollRare();
    for(var ra=0; rk && ra<40; ra++){ var rs=pick(open); if(Math.abs(rs.x-player.x)+Math.abs(rs.y-player.y)<14 || !walkable(rs.x,rs.y) || occupied(rs.x,rs.y)) continue; spawn(rk,rs.x,rs.y).state='wander'; break; }
  }
  populateSpecialMonsters();

  /* ---- validate: everything that matters must be reachable ---- */
  var need=[];
  if(floorMeta.boss) need.push(floorMeta.bossAt); else need.push({x:goal.cx,y:goal.cy});
  if(floorMeta.forgeAt) need.push(adjacentWalkable(floorMeta.forgeAt));
  if(floorMeta.shrineAt) need.push(adjacentWalkable(floorMeta.shrineAt));
  (floorMeta.entrances||[]).forEach(function(e){ need.push(e); });
  var reach=bfsFrom(player.x,player.y);
  for(i=0;i<need.length;i++){
    var n2=need[i]; if(!n2) continue;
    if(reach[idxOf(n2.x,n2.y)]<0){
      /* try clearing blocking decoration, then give up on this seed */
      props=props.filter(function(p){ return !p.b || p.keep; }); rebuildPropGrid();
      reach=bfsFrom(player.x,player.y);
      if(reach[idxOf(n2.x,n2.y)]<0) return false;
    }
  }
  computeFOV();
  return true;
}

/* ============================================================== helpers */
function bfsFrom(sx,sy){
  var d=new Int32Array(MW*MH).fill(-1), q=[sx,sy], h=0;
  d[idxOf(sx,sy)]=0;
  while(h<q.length){
    var x=q[h++], y=q[h++], cd=d[idxOf(x,y)];
    var nb=[[1,0],[-1,0],[0,1],[0,-1]];
    for(var i=0;i<4;i++){
      var nx=x+nb[i][0], ny=y+nb[i][1];
      if(!inb(nx,ny) || d[idxOf(nx,ny)]>=0) continue;
      var t=at(nx,ny);
      if(!(walkable(nx,ny) || t===DOOR || t===CHEST)) continue;
      d[idxOf(nx,ny)]=cd+1; q.push(nx,ny);
    }
  }
  return d;
}
function reachable(ax,ay,bx,by){ return bfsFrom(ax,ay)[idxOf(bx,by)]>=0; }
function nearestWalkable(x,y){
  for(var r=1;r<8;r++) for(var dy=-r;dy<=r;dy++) for(var dx=-r;dx<=r;dx++) if(walkable(x+dx,y+dy) && !occupied(x+dx,y+dy)) return {x:x+dx,y:y+dy};
  return {x:x,y:y};
}
function adjacentWalkable(p){ var nb=[[0,1],[1,0],[-1,0],[0,-1]]; for(var i=0;i<4;i++) if(walkable(p.x+nb[i][0],p.y+nb[i][1])) return {x:p.x+nb[i][0],y:p.y+nb[i][1]}; return null; }
function nearFree(x,y,r){
  var c=[]; for(var dy=-r;dy<=r;dy++) for(var dx=-r;dx<=r;dx++){ var nx=x+dx, ny=y+dy; if((dx||dy) && walkable(nx,ny) && !occupied(nx,ny)) c.push({x:nx,y:ny}); }
  return c.length ? pick(c) : null;
}
function nearDoor(x,y){
  for(var dy=-1;dy<=1;dy++) for(var dx=-1;dx<=1;dx++){ var t=at(x+dx,y+dy); if(isDoorish(t)) return true; }
  /* corridor mouths too: a floor cell outside every room next to this one */
  var nb=[[1,0],[-1,0],[0,1],[0,-1]];
  for(var i=0;i<4;i++){ var nx=x+nb[i][0], ny=y+nb[i][1]; if((at(nx,ny)===FLOOR) && !inRoom(nx,ny) && inRoom(x,y)) return true; }
  return false;
}
function blob(x,y,size,paint){
  var cells=[[x,y]], seenB={};
  for(var i=0;i<cells.length && i<size*3 && Object.keys(seenB).length<size;i++){
    var c=cells[Math.floor(rng()*cells.length)], k=c[0]+','+c[1];
    if(!seenB[k]){ seenB[k]=1; paint(c[0],c[1]); }
    var nb=[[1,0],[-1,0],[0,1],[0,-1]][Math.floor(rng()*4)];
    if(inb(c[0]+nb[0],c[1]+nb[1])) cells.push([c[0]+nb[0],c[1]+nb[1]]);
  }
}
/* edge cells: inside a room, on its border, not in front of an entrance */
function edgeCells(r){
  var out=[];
  for(var y=r.y;y<r.y+r.h;y++) for(var x=r.x;x<r.x+r.w;x++){
    if(!(x===r.x||x===r.x+r.w-1||y===r.y||y===r.y+r.h-1)) continue;
    if(at(x,y)!==FLOOR || propAt(x,y) || nearDoor(x,y)) continue;
    if(x===r.cx && y===r.cy) continue;
    out.push({x:x,y:y});
  }
  return out;
}
function interiorCells(r){
  var out=[];
  for(var y=r.y+1;y<r.y+r.h-1;y++) for(var x=r.x+1;x<r.x+r.w-1;x++) if(at(x,y)===FLOOR && !propAt(x,y) && !(x===r.cx&&y===r.cy)) out.push({x:x,y:y});
  return out;
}
function shuffled(a){ a=a.slice(); for(var i=a.length-1;i>0;i--){ var j=Math.floor(rng()*(i+1)); var t=a[i]; a[i]=a[j]; a[j]=t; } return a; }
function decorateEdges(r, names, n, lightOnly){
  var e=shuffled(edgeCells(r));
  for(var i=0;i<Math.min(n,e.length);i++) addProp(e[i].x,e[i].y,names[i%names.length]);
}
function decoratePlain(r){
  var roll=rng();
  if(roll<0.35) decorateEdges(r, pick([['torch-stand'],['brazier-lit'],['brazier-unlit','torch-stand']]), ri(1,2));
  var n=ri(0,3), inner=shuffled(interiorCells(r));
  for(var i=0;i<Math.min(n,inner.length);i++){
    var nm=pick(['rubble','bones','rubble','chains','barrel','crate','pot','mushrooms']);
    if(PROPS[nm].b && nearDoor(inner[i].x,inner[i].y)) continue;
    if(PROPS[nm].b){ var e=shuffled(edgeCells(r))[0]; if(e) addProp(e.x,e.y,nm); }
    else addProp(inner[i].x,inner[i].y,nm);
  }
}

/* ---- gear, sigils ---- */
function randomGear(){
  var roll=rng();
  var it;
  if(roll<0.5){ var k=pick(['sword','dagger','mace','longsword','axe','bow','staff','wand','spear','censer']); it={kind:'weapon', it:clone(WEAPONS[k])}; }
  else if(roll<0.8){ var a=pick(['leather','chain','plate','robe']); it={kind:'armor', it:clone(ARMORS[a])}; }
  else { var o=pick(['buckler','kite','orb','tome','holy']); it={kind:'off', it:clone(OFFHANDS[o])}; }   /* daggers drop as weapons and can be worn in either hand */
  var tierRoll=rng();
  if(floorNo>=3 && tierRoll<0.25){ it.it.tier='Trusty'; } else it.it.tier='Rusty';
  it.it.plus = rollEnhancement(0);
  if(it.kind!=='off'){
    if(rng()<0.15+floorNo*0.03) it.it.enchant=pick(ELEMENTS);
  }
  return it;
}
function randomSigilUse(){ return pick(['firestorm','mana','levitate','stoneskin','heal','vanish','heal','identify','mapping','blink']); }

/* ---- pockets: carve a small room off an existing one, behind one door tile ---- */
/* a dead-end hallway 3-5 tiles long leading out of a room, solid rock on both sides; returns its far end.
   From biome 2 on, stairs sit at the end of one (2026-09-17, from the Crypt concept art; biome 1 keeps stairs in the room) */
function carveDeadEnd(room){
  var sides=shuffled([0,1,2,3]);
  for(var t=0;t<120;t++){
    var side=sides[t%4], len=ri(3,5), sx, sy, dx=0, dy=0;
    if(side===0){ sx=room.x+ri(1,Math.max(1,room.w-2)); sy=room.y-1; dy=-1; }
    else if(side===1){ sx=room.x+ri(1,Math.max(1,room.w-2)); sy=room.y+room.h; dy=1; }
    else if(side===2){ sx=room.x-1; sy=room.y+ri(1,Math.max(1,room.h-2)); dx=-1; }
    else { sx=room.x+room.w; sy=room.y+ri(1,Math.max(1,room.h-2)); dx=1; }
    var inside={x:sx-dx, y:sy-dy};
    if(at(inside.x,inside.y)!==FLOOR || propAt(inside.x,inside.y)) continue;
    var ok=true, cells=[];
    for(var i=0;i<len && ok;i++){
      var cx=sx+dx*i, cy=sy+dy*i;
      if(cx<2||cy<2||cx>MW-3||cy>MH-3){ ok=false; break; }
      if(at(cx,cy)!==WALL){ ok=false; break; }
      /* both sides of the hall stay rock (the first cell may touch the room's own wall line) */
      var px=dy!==0?1:0, py=dx!==0?1:0;
      if(at(cx+px,cy+py)!==WALL || at(cx-px,cy-py)!==WALL){ ok=false; break; }
      cells.push({x:cx,y:cy});
    }
    if(!ok) continue;
    var end=cells[cells.length-1], bx=end.x+dx, by=end.y+dy;
    if(at(bx,by)!==WALL || at(bx+(dy!==0?1:0),by+(dx!==0?1:0))!==WALL || at(bx-(dy!==0?1:0),by-(dx!==0?1:0))!==WALL) continue;
    cells.forEach(function(c){ setT(c.x,c.y,FLOOR); });
    return end;
  }
  return null;
}
function carvePocket(minW,minH,maxW,maxH, avoid){
  for(var t=0;t<260;t++){
    var host=pick(rooms);
    if(host.role==='start' || host.role==='boss' || (avoid && avoid(host))) continue;
    var w=ri(minW,maxW), h=ri(minH,maxH), side=Math.floor(rng()*4), rx, ry, dx, dy;
    if(side===0){ dx=host.x+ri(0,host.w-1); dy=host.y-1; rx=dx-ri(0,w-1); ry=dy-h; }
    else if(side===1){ dx=host.x+ri(0,host.w-1); dy=host.y+host.h; rx=dx-ri(0,w-1); ry=dy+1; }
    else if(side===2){ dx=host.x-1; dy=host.y+ri(0,host.h-1); rx=dx-w; ry=dy-ri(0,h-1); }
    else { dx=host.x+host.w; dy=host.y+ri(0,host.h-1); rx=dx+1; ry=dy-ri(0,h-1); }
    if(rx<2||ry<2||rx+w>MW-2||ry+h>MH-2) continue;
    if(at(dx,dy)!==WALL) continue;
    var ok=true;
    for(var y=ry-1;y<=ry+h && ok;y++) for(var x=rx-1;x<=rx+w;x++){ if(x===dx&&y===dy) continue; if(at(x,y)!==WALL){ ok=false; break; } }
    if(!ok) continue;
    /* the door must sit between the pocket and the host only */
    var inside = side===0 ? {x:dx,y:dy+1} : side===1 ? {x:dx,y:dy-1} : side===2 ? {x:dx+1,y:dy} : {x:dx-1,y:dy};
    if(at(inside.x,inside.y)!==FLOOR || propAt(inside.x,inside.y)) continue;
    for(y=ry;y<ry+h;y++) for(x=rx;x<rx+w;x++) setT(x,y,FLOOR);
    var room={x:rx,y:ry,w:w,h:h,cx:rx+(w>>1),cy:ry+(h>>1),id:1000+rooms.length,pocket:true};
    rooms.push(room);
    return {room:room, door:{x:dx,y:dy}, host:host, inside:inside};
  }
  return null;
}
function lootRoom(r, rich){
  var inner=shuffled(interiorCells(r).concat(edgeCells(r)));
  if(!inner.length) return;
  var c=inner.pop(); setT(c.x,c.y,CHEST); chestKind[idxOf(c.x,c.y)] = rich ? 'chest-ornate' : 'chest-iron';
  var n=rich?3:2;
  for(var i=0;i<n && inner.length;i++){
    var p=inner.pop();
    var roll=rng();
    items.push(roll<0.4 ? (function(){ var g=randomGear(); g.x=p.x; g.y=p.y; if(g.it.plus!==undefined) g.it.plus=Math.max(g.it.plus,1); return g; })()
             : roll<0.7 ? {x:p.x,y:p.y,kind:'essence',n:ri(12,25)+floorNo*3}
             : roll<0.93 ? {x:p.x,y:p.y,kind:'mote',el:pick(ELEMENTS)} : {x:p.x,y:p.y,kind:'sigil',use:randomSigilUse()});
  }
}
/* which cells you can reach from where you start without opening an iron door: the iron key, and whoever
   carries it, has to be on this side of it (2026-09-17) */
function keyReachable(){
  var ok=new Uint8Array(MW*MH), q=[idxOf(player.x, player.y)];
  if(!walkable(player.x, player.y)){
    q.length=0;
    for(var i0=0;i0<map.length;i0++){ if(map[i0]!==LOCKED && walkable(i0%MW,(i0/MW)|0)){ q.push(i0); break; } }
  }
  while(q.length){
    var i=q.pop(); if(ok[i]) continue;
    var x=i%MW, y=(i/MW)|0, t=map[i];
    if(t===LOCKED) continue;                       /* the door itself is the wall for this test */
    if(!walkable(x,y) && !isDoorish(t)) continue;
    ok[i]=1;
    if(x>0) q.push(i-1);
    if(x<MW-1) q.push(i+1);
    if(y>0) q.push(i-MW);
    if(y<MH-1) q.push(i+MW);
  }
  return ok;
}
function buildLockedVault(){
  var pk=carvePocket(3,3,5,4); if(!pk) return;
  setT(pk.door.x,pk.door.y,LOCKED); pk.room.special='vault';
  floorMeta.vault=true; floorMeta.entrances=(floorMeta.entrances||[]).concat([pk.inside]);
  lootRoom(pk.room, true);
  addProp(pk.room.x, pk.room.y, 'torch-stand');
}
function buildTollRoom(){
  var pk=carvePocket(3,3,5,4); if(!pk) return;
  setT(pk.door.x,pk.door.y,TOLL); pk.room.special='toll';
  floorMeta.entrances=(floorMeta.entrances||[]).concat([pk.inside]);
  lootRoom(pk.room, true);
  var c=shuffled(interiorCells(pk.room).concat(edgeCells(pk.room))).filter(function(p){ return freeCell(p.x,p.y); });
  if(c.length) items.push({x:c[0].x,y:c[0].y,kind:'mote',el:pick(ELEMENTS)});
}
function buildHiddenRoom(){
  var pk=carvePocket(2,2,4,3); if(!pk) return;
  setT(pk.door.x,pk.door.y,SECRET); pk.room.special='hidden';
  /* never blind searching: a visible tell on the floor beside the secret wall */
  setG(pk.inside.x,pk.inside.y,G_TELL);
  var c=shuffled(interiorCells(pk.room).concat(edgeCells(pk.room)));
  if(c.length){ setT(c[0].x,c[0].y,CHEST); chestKind[idxOf(c[0].x,c[0].y)]='chest-wood'; }
  if(c.length>1) items.push({x:c[1].x,y:c[1].y,kind:'essence',n:ri(15,30)});
}
function buildPuzzle(kind){
  var pk=carvePocket(3,3,5,4); if(!pk) return;
  pk.room.special='puzzle-'+kind;
  var ent=pk.inside;
  if(kind==='icedoor'){
    setT(pk.door.x,pk.door.y,ICEDOOR); floorMeta.icedoor={x:pk.door.x,y:pk.door.y,hits:0};
    floorMeta.notes.push('A doorway sealed in thick ice. Fire would melt it; enough blows would crack it.');
    lootRoom(pk.room, false);
  } else if(kind==='thorns'){
    setT(pk.door.x,pk.door.y,THORNS);
    floorMeta.notes.push('A doorway choked with thorns. Fire clears it; pushing through hurts.');
    lootRoom(pk.room, false);
  } else if(kind==='elemlock'){
    setT(pk.door.x,pk.door.y,SEALED);
    var el=pick(ELEMENTS);
    var host=pk.host, spots=edgeCells(host).filter(function(p){ return Math.abs(p.x-ent.x)+Math.abs(p.y-ent.y)<=3 && !(p.x===ent.x&&p.y===ent.y); });
    var s=spots.length ? pick(spots) : null;
    if(!s) { setT(pk.door.x,pk.door.y,DOOR); return; }
    addProp(s.x,s.y,'elemental-lock',{element:el, door:{x:pk.door.x,y:pk.door.y}, keep:true});
    /* the answer is guaranteed on this floor */
    var o=[]; for(var y=0;y<MH;y++) for(var x=0;x<MW;x++) if(freeCell(x,y) && inRoom(x,y) && !roomAt(x,y).pocket) o.push({x:x,y:y});
    if(o.length){ var m=pick(o); items.push({x:m.x,y:m.y,kind:'mote',el:el}); }
    var c=shuffled(interiorCells(pk.room).concat(edgeCells(pk.room)));
    if(c.length){ setT(c[0].x,c[0].y,CHEST); chestKind[idxOf(c[0].x,c[0].y)]='chest-elemental'; }
    for(var i=1;i<3 && i<c.length;i++) items.push({x:c[i].x,y:c[i].y,kind:'mote',el:el});
  } else if(kind==='plates'){
    setT(pk.door.x,pk.door.y,SEALED);
    var hostCells=shuffled(interiorCells(pk.host).filter(function(p){ return freeCell(p.x,p.y) && !nearDoor(p.x,p.y); }));
    if(hostCells.length<4){ setT(pk.door.x,pk.door.y,DOOR); return; }
    var symbols=shuffled(['moon','sun','star']);
    var order=shuffled([0,1,2]);
    plates={cells:[], order:order.map(function(i){ return symbols[i]; }), progress:0, door:{x:pk.door.x,y:pk.door.y}, solved:false};
    for(var p2=0;p2<3;p2++){ var pc=hostCells[p2]; plates.cells.push({x:pc.x,y:pc.y,symbol:symbols[p2],pressed:false}); }
    var tab=edgeCells(pk.host).filter(function(p){ return freeCell(p.x,p.y); });
    if(tab.length){ var tb=pick(tab); addProp(tb.x,tb.y,'statue-broken',{tablet:true, keep:true}); }
    var c2=shuffled(interiorCells(pk.room).concat(edgeCells(pk.room)));
    if(c2.length){ setT(c2[0].x,c2[0].y,CHEST); chestKind[idxOf(c2[0].x,c2[0].y)]='chest-crystal'; }
    if(c2.length>1){ var g=randomGear(); g.x=c2[1].x; g.y=c2[1].y; items.push(g); }
  } else if(kind==='chasm'){
    /* a chasm band splits the pocket room; a lever elsewhere lowers a bridge, an Air sigil floats you over */
    setT(pk.door.x,pk.door.y,DOOR);
    var r=pk.room, band=[];
    if(r.h>=4 && r.w>=3){
      var by = (ent.y < r.y) ? r.y+1 : (ent.y >= r.y+r.h ? r.y+r.h-2 : r.cy);
      if(pk.door.y===r.y-1) by=r.y+1; else if(pk.door.y===r.y+r.h) by=r.y+r.h-2;
      else { /* door on a side: split vertically instead */ var bx = pk.door.x===r.x-1 ? r.x+1 : r.x+r.w-2; for(var yy=r.y;yy<r.y+r.h;yy++){ setT(bx,yy,CHASM); band.push({x:bx,y:yy}); } }
      if(!band.length) for(var xx=r.x;xx<r.x+r.w;xx++){ setT(xx,by,CHASM); band.push({x:xx,y:by}); }
    } else { for(var yy2=r.y;yy2<r.y+r.h;yy2++){ setT(r.cx,yy2,CHASM); band.push({x:r.cx,y:yy2}); } }
    var mid=band[Math.floor(band.length/2)];
    /* loot on the far side */
    var farCells=interiorCells(r).concat(edgeCells(r)).filter(function(p){ return at(p.x,p.y)===FLOOR && Math.abs(p.x-pk.door.x)+Math.abs(p.y-pk.door.y) > Math.abs(mid.x-pk.door.x)+Math.abs(mid.y-pk.door.y); });
    if(farCells.length){ var fc=pick(farCells); setT(fc.x,fc.y,CHEST); chestKind[idxOf(fc.x,fc.y)]='chest-ornate'; }
    farCells.forEach(function(p,i){ if(i<2 && freeCell(p.x,p.y)) items.push({x:p.x,y:p.y,kind:i===0?'mote':'essence', el:pick(ELEMENTS), n:ri(15,25)}); });
    var leverRooms=rooms.filter(function(rr){ return !rr.pocket && rr!==pk.host && rr.role!=='boss'; });
    var lr=pick(leverRooms), le=lr ? shuffled(edgeCells(lr))[0] : null;
    if(le){ addProp(le.x,le.y,'lever-up',{lever:true, bridge:[mid], keep:true}); }
    var o2=[]; for(var y2=0;y2<MH;y2++) for(var x2=0;x2<MW;x2++) if(freeCell(x2,y2) && inRoom(x2,y2) && !roomAt(x2,y2).pocket) o2.push({x:x2,y:y2});
    if(o2.length){ var a=pick(o2); items.push({x:a.x,y:a.y,kind:'sigil',use:'levitate'}); }
    floorMeta.notes.push('A chasm splits a side room. Somewhere a lever creaks; an Air sigil would float you across.');
    return;
  }
  floorMeta.entrances=(floorMeta.entrances||[]).concat([ent]);
}

/* ---- special rooms inside ordinary rooms ---- */
function buildSpecial(kind, r){
  r.special=kind;
  var e=shuffled(edgeCells(r)), inner=shuffled(interiorCells(r)), i;
  function place(list, names, n, extra){ for(var k=0;k<n && list.length;k++){ var c=list.pop(); addProp(c.x,c.y,names[k%names.length],extra); } }
  function put(it){ var c=inner.pop()||e.pop(); if(!c||!freeCell(c.x,c.y)) return; it.x=c.x; it.y=c.y; items.push(it); }
  if(kind==='garden'){
    for(i=0;i<inner.length;i++) if(rng()<0.65) setG(inner[i].x,inner[i].y,G_GRASS);
    place(e,['mushrooms','vines'],ri(2,4));
    if(rng()<0.5) put({kind:'food',food:randomFood()});
    if(inner.length) { var w=inner.pop(); setT(w.x,w.y,WATER); setG(w.x,w.y,0); }
  } else if(kind==='storage'){
    place(e,['barrel','crate','pot','crate','barrel','pot'],Math.min(7,Math.floor(e.length*0.6)));
    place(e,['barrel-explosive'],rng()<0.6?1:2);
    if(e.length){ var sc=e.pop(); setT(sc.x,sc.y,CHEST); chestKind[idxOf(sc.x,sc.y)]='crate-supply'; }
  } else if(kind==='library'){
    var top=e.filter(function(c){ return c.y===r.y; }); e=e.filter(function(c){ return c.y!==r.y; });
    place(top,['bookshelf'],top.length);
    place(e,['table-candle'],1);
    put({kind:'sigil',use: rng()<0.5 ? 'identify' : randomSigilUse()});   /* one sigil among the books */
    if(rng()<0.3) put({kind:'off',it:clone(OFFHANDS.tome)});
  } else if(kind==='armory'){
    place(e,['weapon-rack','weapon-rack','banner-stand'],3);
    put(randomGear()); put(randomGear());
  } else if(kind==='nest'){
    place(inner,['bones','bones'],2);   /* 2026-09-19: the straw bedding looked bad - gone */
    put({kind:'essence',n:ri(10,20)});
    r.nest=true;
  } else if(kind==='prison'){
    place(e,['cage','cage','chains'],3);
    place(inner,['bones','chains'],2);
    var cages=props.filter(function(p){ return p.name==='cage' && roomAt(p.x,p.y)===r; });
    if(cages.length) cages[0].prisoner=pick(['goblin','archer']);
  } else if(kind==='zoo'){
    r.zoo=true;
    for(i=0;i<3 && inner.length;i++) put({kind:'essence',n:ri(15,30)});
    put({kind:'mote',el:pick(ELEMENTS)}); put(randomGear());
    var cc=inner.pop(); if(cc){ setT(cc.x,cc.y,CHEST); chestKind[idxOf(cc.x,cc.y)]='chest-ornate'; }
    /* the clue: bones scattered at the thresholds */
    for(var yy=r.y-1;yy<=r.y+r.h;yy++) for(var xx=r.x-1;xx<=r.x+r.w;xx++){
      if(isDoorish(at(xx,yy))){ var nb=[[1,0],[-1,0],[0,1],[0,-1]]; for(var k2=0;k2<4;k2++){ var ox=xx+nb[k2][0], oy=yy+nb[k2][1]; if(at(ox,oy)===FLOOR && !roomAt(ox,oy)) setG(ox,oy,G_BONES); } }
    }
    floorMeta.notes.push('Bones and claw marks litter one doorway. Something big sleeps behind it.');
  } else if(kind==='sacrifice'){
    addProp(r.cx,r.cy,'altar-spikes',{keep:true});
    altars[idxOf(r.cx,r.cy)]={passes:0};
    place(e,['brazier-lit','chains','brazier-lit'],3);
  } else if(kind==='statues'){
    place(inner,['statue','statue-broken','statue'],Math.min(4,Math.floor(inner.length/3)));
    put({kind:'essence',n:ri(15,25)});
    r.statues=true;
  } else if(kind==='treasury'){
    var t2=inner.pop(); if(t2){ setT(t2.x,t2.y,CHEST); chestKind[idxOf(t2.x,t2.y)]='chest-ornate'; r.guardAt=nearFreeRoomCell(r,t2); }
    put(randomGear()); put({kind:'essence',n:ri(20,35)});
    place(e,['torch-stand','torch-stand'],2);
  } else if(kind==='barracks'){
    place(e,['weapon-rack','table-candle','crate','barrel'],4);
    r.barracks=true;
  } else if(kind==='traps'){
    r.trapRoom=true;
    var kinds=Object.keys(TRAPS).filter(function(k){ return TRAPS[k].minFloor<=floorNo && k!=='teleport'; });
    /* the prize goes against the far wall */
    var far=null, fd=-1;
    interiorCells(r).forEach(function(c){ var d=Math.min.apply(null, [c.y-r.y, r.y+r.h-1-c.y, c.x-r.x, r.x+r.w-1-c.x]); if(d>fd && !nearDoor(c.x,c.y)){ fd=d; far=c; } });
    if(far){ setT(far.x,far.y,CHEST); chestKind[idxOf(far.x,far.y)]= floorNo>=3 ? 'chest-ornate' : 'chest-iron'; }
    interiorCells(r).forEach(function(c){
      if((far && c.x===far.x && c.y===far.y) || nearDoor(c.x,c.y) || at(c.x,c.y)!==FLOOR) return;
      if(rng()<0.34) feats.push({x:c.x, y:c.y, kind:pick(kinds), found:false, room:true});
    });
    put({kind:'essence',n:ri(15,30)});
    for(i=0;i<3 && inner.length;i++){ var sc=inner.pop(); if(at(sc.x,sc.y)===FLOOR) setG(sc.x,sc.y, rng()<0.5?G_SCORCH:G_BONES); }
  } else if(kind==='dark'){
    r.dark=true;
    var dc=inner.pop(); if(dc){ setT(dc.x,dc.y,CHEST); chestKind[idxOf(dc.x,dc.y)]='chest-crystal'; }
    put({kind:'essence',n:ri(15,25)});
    floorMeta.notes.push('One room swallows light. Only a lantern, fire or Light affinity cuts through it.');
  }
}
function nearFreeRoomCell(r, p){
  var nb=[[1,0],[-1,0],[0,1],[0,-1]]; for(var i=0;i<4;i++){ var x=p.x+nb[i][0], y=p.y+nb[i][1]; if(at(x,y)===FLOOR && roomAt(x,y)===r && !propAt(x,y)) return {x:x,y:y}; } return null;
}
function populateSpecialMonsters(){
  rooms.forEach(function(r){
    var cells=shuffled(interiorCells(r).concat(edgeCells(r))).filter(function(p){ return walkable(p.x,p.y) && !occupied(p.x,p.y); });
    function sp(kind, state){ var c=cells.pop(); if(!c) return null; var m=spawn(kind,c.x,c.y); m.state=state||'asleep'; return m; }
    if(r.zoo){ var n=Math.min(9, 3+floorNo+Math.floor(r.w*r.h/16)); for(var i=0;i<n;i++) sp(rollMonster()); }
    if(r.nest){ for(var j=0;j<ri(3,4);j++) sp('rat'); }
    if(r.barracks){ for(var k=0;k<ri(2,3);k++) sp(pick(['goblin','goblin','archer'])); }
    if(r.guardAt){ var g=spawn('brute',r.guardAt.x,r.guardAt.y); g.state='asleep'; g.name='Vault Guardian'; g.elite=true; g.maxhp=g.hp=Math.round(g.hp*1.4); }
    if(r.dark){ for(var d=0;d<2;d++) sp(pick(['goblin','bat'])); }
    if(r.role==='boss'){
      var boss=spawn('warchief', floorMeta.bossAt.x, floorMeta.bossAt.y); boss.state='throne'; boss.elite=true; floorMeta.bossId=boss.id;
      for(var q=0;q<2;q++){ var gd=sp('goblin','asleep'); if(gd) gd.guard=true; }
      var ar=sp('archer','asleep'); if(ar) ar.guard=true;
    }
  });
}
function buildBossRoom(r){
  floorMeta.bossAt={x:r.cx, y:r.y+1};
  addProp(r.cx, r.y, 'boss-throne', {keep:true});
  decorateEdges(r, ['brazier-lit','banner-stand','torch-stand'], 5);
  /* the exit gate: opens when the warchief falls */
  var gx=r.cx, gy=r.y+r.h-1;
  setT(gx,gy,EXIT); floorMeta.exitAt={x:gx,y:gy};
  for(var i=0;i<6;i++){ var c=pick(interiorCells(r)); if(c) setG(c.x,c.y,pick([G_BONES,G_BLOOD,G_SCORCH])); }
}

/* ---- the monster table, floor-banded ---- */
function rollMonster(){
  var d=floorNo, pool=[];
  for(var k in MONSTERS){ var b=MONSTERS[k]; if(b.rare||!b.w) continue; if(d<b.band[0]||d>b.band[1]) continue; pool.push([k,b.w]); }
  var tot=0,i; for(i=0;i<pool.length;i++) tot+=pool[i][1];
  var r=rng()*tot; for(i=0;i<pool.length;i++){ r-=pool[i][1]; if(r<=0) return pool[i][0]; }
  return pool.length ? pool[pool.length-1][0] : 'rat';
}
function rollRare(){
  var out=[]; for(var k in MONSTERS){ var b=MONSTERS[k]; if(b.rare && floorNo>=b.band[0] && floorNo<=b.band[1]) out.push(k); }
  return out.length ? pick(out) : null;
}
function spawn(kind,x,y){
  var b=MONSTERS[kind];
  /* the plane creatures are tuned by hand for the plane they guard (js/portals.js), so the floor curve that
     grows dungeon monsters does not apply to them - it was turning a 110 HP boss into 207 (2026-09-17) */
  /* 2026-09-18 (Justin): +5% HP and +3% damage a floor, from +8% / +5% - biomes 1-2 ramped faster than a
     build outside the strong early combos could keep up with. */
  /* 2026-09-20: no curve. Justin, after his first full run: every creature's health, damage and armour is set by
     hand (DESIGN §20), so a Goblin is a Goblin on floor 1 and floor 5; a floor gets harder because nastier
     creatures appear in its band, not because the same ones quietly inflate. */
  var hpScale = 1, dmgScale = 1;
  var e={id:nextId++, kind:kind, name:b.name, ch:b.ch, col:b.col, x:x, y:y,
         hp:sHP(b.hp*hpScale), maxhp:sHP(b.hp*hpScale), base:b, t:(typeof player!=='undefined' && player && player.t) ? player.t : 0, state:'asleep', st:{}, foe:true,
         dmg:[sDMG(b.dmg[0]*dmgScale), sDMG(b.dmg[1]*dmgScale)], castCd:ri(1,3)};
  ents.push(e); return e;
}
