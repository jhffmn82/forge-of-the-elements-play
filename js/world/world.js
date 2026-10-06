/* ============================================================================
   world.js - terrain, layers and floor generation for biome 1 (floors 1-5).
   Replaces js/runtime/game.js generate(), walkable() and opaque().
   ========================================================================== */

/* tiles beyond js/runtime/game.js's WALL..OPEN (0-7) */
var CHASM=8, LOCKED=9, SHRINE=10, ICEDOOR=11, THORNS=12, EXIT=13, TOLL=14, SECRET=15, WATER=16, BRIDGE=17, SEALED=18;
/* ground layer */
var G_NONE=0, G_GRASS=1, G_SHORT=2, G_ASH=3, G_PUDDLE=4, G_BLOOD=5, G_SCORCH=6, G_MOSS=7, G_BONES=8, G_ICE=9, G_TELL=10, G_WEB=11;
var GROUND_ART = {1:'grass-tall',2:'grass-short',3:'ash',4:'puddle',5:'blood',6:'scorch',7:'moss',8:'bones-scatter',9:'ice-patch',10:'tell-uneven',11:'web-floor'};

var ground, fireT, props=[], propGrid, chestKind={}, floorMeta={}, levers=[], plates=null, altars={};
var RUN = null;   /* run-wide state: forge floor, shrine floor and god, mote plan, heroic resolve, victory */

function inb(x,y,context){ if(context) return x>=0 && y>=0 && x<context.width && y<context.height; if(FRAME_MAP) return x>=0 && y>=0 && x<FRAME_MW && y<FRAME_MH; return x>=0 && y>=0 && x<MW && y<MH; }   /* FRAME_*: js/runtime/game.js at() */
function idxOf(x,y,context){ return y*(context ? context.width : FRAME_MAP ? FRAME_MW : MW)+x; }
function gAt(x,y){ return inb(x,y) ? ground[idxOf(x,y)] : 0; }
function setG(x,y,v){ if(inb(x,y)){var i=idxOf(x,y),previous=ground[i];ground[i]=v;if(previous!==v&&v&&GROUND_ART[v])FoteContent.introduceAppearance(floorMeta,'ground',v);} }
function propAt(x,y,context){ if(!inb(x,y,context)) return null; var i=(context?context.propGrid:propGrid)[idxOf(x,y,context)]; return i>=0 ? (context?context.props:props)[i] : null; }
function rebuildPropGrid(){
  propGrid.fill(-1);
  for(var i=0;i<props.length;i++)propGrid[idxOf(props[i].x,props[i].y)]=i;
  for(var j=0;j<props.length;j++){var p=props[j];if(!p.set)continue;for(var y=p.y;y<p.y+p.h;y++)for(var x=p.x;x<p.x+p.w;x++)if(inb(x,y))propGrid[idxOf(x,y)]=j;}
}
/* tiles that hold their own object: a prop never shares one (a torch stand once stood inside a chest) */
function objectTile(t){ return t===CHEST || t===STAIRS || t===FORGE || t===DOOR || t===OPEN || (typeof UPSTAIRS!=='undefined' && t===UPSTAIRS) || (typeof PORTAL!=='undefined' && t===PORTAL) || (typeof SHRINE!=='undefined' && t===SHRINE) || (typeof EXIT!=='undefined' && t===EXIT); }
function createProp(x,y,name,extra){
  if(!inb(x,y) || propAt(x,y) || objectTile(at(x,y))) return null;
  var d=PROPS[name]||{}, p={x:x,y:y,name:name};
  for(var k in d) p[k]=d[k];
  for(var e in (extra||{})) p[e]=extra[e];
  if(/mushroom|shroom|fungus/.test(name))p.burn=1;
  if(p.b&&typeof DEEP_GEN!=='undefined'&&DEEP_GEN){
    for(var py=y;py<y+(p.h||1);py++)for(var px=x;px<x+(p.w||1);px++){
      var room=roomAt(px,py);
      if(room&&room.storageAisle&&room.storageAisle.indexOf(idxOf(px,py))>=0)return null;
    }
  }
  props.push(p); propGrid[idxOf(x,y)]=props.length-1; FoteContent.appearanceChanged(floorMeta); return p;
}
function removeProp(p){ var i=props.indexOf(p); if(i<0) return; props.splice(i,1); rebuildPropGrid(); FoteContent.appearanceChanged(floorMeta); if(p.breakReward){var reward=clone(p.breakReward);reward.x=p.x;reward.y=p.y;items.push(reward);delete p.breakReward;} }

/* ---- movement and sight rules ---- */


function isDoorish(t){ return t===DOOR||t===OPEN||t===LOCKED||t===ICEDOOR||t===THORNS||t===TOLL||t===SEALED||t===SECRET; }
function findRectangularRoom(x,y){ for(var i=0;i<rooms.length;i++){ var r=rooms[i]; if(x>=r.x&&x<r.x+r.w&&y>=r.y&&y<r.y+r.h) return r; } return null; }
function inRoom(x,y){ return !!roomAt(x,y); }
function occupied(x,y,ignore,options){
  function blocks(e){return e!==ignore&&entityOccupies(e,x,y)&&(!(options&&options.projectile)||FoteGeometry.projectileBlocker(e));}
  if(ents.some(blocks))return true;
  if(!fx || !fx.length)return false;
  var now=performance.now();
  return fx.some(function(f){return f.k==='d' && f.e && blocks(f.e) && now<f.t0+f.dur;});
}
function itemAt(x,y){ for(var i=0;i<items.length;i++) if(items[i].x===x && items[i].y===y) return items[i]; return null; }
function freeCell(x,y){ return at(x,y)===FLOOR && !propAt(x,y) && !itemAt(x,y) && !occupied(x,y) && !feats.some(function(f){return f.x===x&&f.y===y;}); }

/* ---- biomes: every 5 floors (2026-09-17, biome 2) ---- */
var LAST_FLOOR = 15;   /* the deepest built floor: the Caverns' boss arena (2026-09-19; was 10, the Crypt's boss hall) */
var BIOME_NAMES = ['Dungeon', 'Crypt', 'Caverns', 'Temple', 'Realm of Chaos'];
function bidx(n){ return Math.floor(((n||floorNo)-1)/5); }
function bfloor(n){ return ((n||floorNo)-1)%5+1; }
function biomeName(n){ return BIOME_NAMES[Math.min(BIOME_NAMES.length-1, bidx(n))]; }
/* which elemental planes each biome's portal may open onto, by biome index (docs/design/game-design.md section 17). A biome
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
       Light. docs/design/game-design.md: the Crypt (biome 1) offers Light, Shadow or Earth; biome 4 offers Fire, Air or Water.
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
   shuffle, four cards off the top. Old saves rebuild the same deal from their own seed.
   2026-09-29 (Justin): a new run deals 4 of the 9 ordered by eligibility: the same shuffle, with every god the new
   character could swear to (class, race and court, creationRefuses) moved ahead of the ones who would refuse it.
   Every class and race has at least five gods who take it, so all four shrines offer one you can accept and a
   mage no longer rerolls for a god. Only newRunState passes the choice; a save without a deal rebuilds the old one. */
function godDeal(choice){
  if(RUN.godDeal) return RUN.godDeal;
  var r = mulberry32(((RUN.seed||0) ^ 0x6f5a1c3d)>>>0), ids = Object.keys(GODS);
  for(var i=ids.length-1;i>0;i--){ var j=Math.floor(r()*(i+1)); var t=ids[i]; ids[i]=ids[j]; ids[j]=t; }
  if(choice && typeof creationRefuses==='function'){
    var ok=ids.filter(function(id){ return !creationRefuses(choice, id); });
    ids=ok.concat(ids.filter(function(id){ return ok.indexOf(id)<0; }));
  }
  RUN.godDeal = ids.slice(0, 4);
  return RUN.godDeal;
}

/* Shrine offers belong to accepted floors, not the initial four-card plan.
 * Older saves recover that history from their stored floor metadata. Both this
 * history and a promoted future card live in RUN, so generation rollback and
 * the existing save graph preserve them together. */
function acceptedShrineOffers(){
  var offers=RUN.shrineOffers||(RUN.shrineOffers={});
  Object.keys(RUN.floorStash||{}).forEach(function(key){
    var saved=RUN.floorStash[key],meta=saved&&saved.floorMeta,point=meta&&meta.shrineAt;
    var floor=meta&&meta.floor||Number(key),biome=Math.floor((floor-1)/5);
    if(biome<0||biome>3||offers[biome]||!meta||!meta.shrine||!GODS[meta.shrineGod]||!point||!saved.map)return;
    var width=saved.MW||56;
    if(saved.map[point.y*width+point.x]===SHRINE)offers[biome]={god:meta.shrineGod,floor:floor};
  });
  return offers;
}
function shrinePreviewRun(){
  return !!(RUN.sandbox||typeof SANDBOX!=='undefined'&&SANDBOX.building);
}
function shrineGodAvailable(id,biome,offers,deal){
  if(!GODS[id]||godRefuses(id))return false;
  if(Object.keys(offers).some(function(key){return offers[key].god===id;}))return false;
  var index=deal.indexOf(id);
  return index<0||index>=biome&&!offers[index];
}
function shrineSeededChoice(ids,biome){
  var r=mulberry32(((RUN.seed||0)^0x73a9d641^Math.imul(biome+1,0x51ed27))>>>0);
  return ids[Math.floor(r()*ids.length)];
}
function synchronizeUnbuiltShrinePlans(offers,deal,biome){
  Object.keys(RUN.biomes||{}).forEach(function(key){
    var b=Number(key);if(b>=biome&&b<4&&!offers[b])RUN.biomes[key].god=deal[b];
  });
}
function reconcileAcceptedShrineDeal(offers,deal,biome){
  Object.keys(offers).sort(function(a,b){return Number(a)-Number(b);}).forEach(function(key){
    var b=Number(key),god=offers[key].god;
    if(b<0||b>3||!GODS[god]||deal[b]===god)return;
    var index=deal.indexOf(god),displaced=deal[b];
    // Legacy cached deals are plans. The accepted floor is authoritative; only
    // an unbuilt future slot may receive the displaced planned card.
    if(index>=biome&&!offers[index])deal[index]=displaced;
    deal[b]=god;
  });
  synchronizeUnbuiltShrinePlans(offers,deal,biome);
}
function secondBiomeShrinePriority(offers,deal){
  var priorities=[];
  if((player.aff.light||0)>0)priorities.push(['glimmer']);
  if((player.aff.shadow||0)>0)priorities.push(['murk']);
  if(player.race==='dwarf')priorities.push(['anvil']);
  if(player.cls==='mage')priorities.push(['vellum']);
  if(player.cls==='scoundrel')priorities.push(['sylla','wobbles']);
  if(player.cls==='fighter')priorities.push(['reginald','grumbok']);
  for(var i=0;i<priorities.length;i++){
    var candidates=priorities[i].filter(function(id){return player.god!==id&&shrineGodAvailable(id,1,offers,deal);});
    if(candidates.length)return shrineSeededChoice(candidates,1);
  }
  return null;
}
function generatedShrineGod(plan){
  var deal=godDeal(),biome=bidx(),original=plan.god||deal[biome]||RUN.shrineGod;
  if(shrinePreviewRun())return original;
  var offers=acceptedShrineOffers(),known=offers[biome];
  // Bound Clerics cannot convert. Keep their distinct authored shrine deal.
  if(player.cls==='cleric'&&player.god)return known?known.god:original;
  reconcileAcceptedShrineDeal(offers,deal,biome);
  if(known)return known.god;
  original=plan.god||deal[biome]||RUN.shrineGod;
  // Investment must precede construction of the Crypt shrine. A cached biome
  // plan alone does not freeze the offer; an existing shrine floor does.
  if(biome<0||biome>3||floorNo!==plan.shrine)return original;
  var wanted=biome===1?secondBiomeShrinePriority(offers,deal):null;
  if(!wanted&&shrineGodAvailable(original,biome,offers,deal))wanted=original;
  if(!wanted){
    var future=deal.slice(biome).filter(function(id){return shrineGodAvailable(id,biome,offers,deal);});
    var candidates=future.length?future:Object.keys(GODS).filter(function(id){return shrineGodAvailable(id,biome,offers,deal);});
    if(!candidates.length)throw new Error('No distinct eligible shrine god remains.');
    wanted=shrineSeededChoice(candidates,biome);
  }
  // A future unbuilt card may swap; an absent god replaces this offer. Past
  // accepted offers and committed shrine metadata never change.
  var index=deal.indexOf(wanted);
  if(index>biome){var displaced=deal[biome];deal[index]=displaced;}
  deal[biome]=wanted;if(biome>0)plan.god=wanted;
  synchronizeUnbuiltShrinePlans(offers,deal,biome);
  return wanted;
}
function rememberGeneratedShrineOffer(){
  if(!RUN||shrinePreviewRun()||!floorMeta.shrine||!floorMeta.shrineAt||
      at(floorMeta.shrineAt.x,floorMeta.shrineAt.y)!==SHRINE)return;
  var biome=bidx(),offers=acceptedShrineOffers();
  if(biome>=0&&biome<4&&!offers[biome])offers[biome]={god:floorMeta.shrineGod,floor:floorNo};
}

/* ---- run state ---- */
function newRunState(seed, choice){
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
    cores: 0, coreClaims: [],
    resolveUsed: false, victory: false, bossDead: false, turns: 0, kills: 0
  };
  var deal=godDeal(choice);
  RUN.shrineGod = deal[0];                        /* the first card of the four-god deal */
  if(RUN.shrineFloor===RUN.forgeFloor && r()<0.5) RUN.shrineFloor = RUN.forgeFloor===3 ? 2 : 1;
  // Non-Cleric Gloomlings meet Murk and Dwarves meet Anvil on floor one.
  // Move the card rather than repeating it in a later biome; other planned
  // floors and mote RNG keep their original values. Existing saves are untouched.
  var firstGod=choice&&choice.cls!=='cleric'&&({gloomling:'murk',dwarf:'anvil'})[choice.race];
  if(firstGod){
    var index=deal.indexOf(firstGod);if(index>0)deal[index]=deal[0];
    deal[0]=firstGod;RUN.shrineGod=firstGod;RUN.shrineFloor=1;
  }
  return RUN;
}

/* ============================================================== generation */
function commitGeneratedFloor(floorClock){
  /* Room builders can overwrite earlier placements. Commit only a valid layout. */
  feats=feats.filter(function(f){return at(f.x,f.y)===FLOOR&&!propAt(f.x,f.y);});
  items=items.filter(function(it){return walkable(it.x,it.y)||at(it.x,it.y)===STAIRS;});
  props=props.filter(function(p){return !objectTile(at(p.x,p.y));});rebuildPropGrid();
  /* Carried effects and every new actor keep the run-wide scheduler clock. */
  if(typeof player!=='undefined'&&player)player.t=floorClock;
  ents.forEach(function(e){e.t=floorClock;});
  rememberGeneratedShrineOffer();
}

function generateOnce(seed){
  rng = mulberry32(seed>>>0);
  map=new Uint8Array(MW*MH); seen=new Uint8Array(MW*MH); vis=new Uint8Array(MW*MH);
  ground=new Uint8Array(MW*MH); fireT=new Uint8Array(MW*MH); propGrid=new Int16Array(MW*MH).fill(-1);
  feats=[]; items=[]; ents=[]; props=[]; chestKind={}; levers=[]; plates=null; altars={};
  var BP=biomePlan();
  /* Ordinary crafting forges stay on the biome's planned non-boss floor. */
  floorMeta={ floor:floorNo, biome:bidx(), boss:bfloor()===5, forge:RUN && BP.forge===floorNo && bfloor()!==5, shrine:RUN && BP.shrine===floorNo && floorNo<=20, portal:RUN && BP.portal===floorNo ? BP.plane : null,   /* shrines only in biomes 1-4: four in a run */
              exitOpen:false, keyHolder:false, notes:[] };
  if(RUN){ if(floorMeta.shrine) RUN.shrineGod=generatedShrineGod(BP); floorMeta.shrineGod=RUN.shrineGod; }
  var i, j, x, y;

  /* ---- rooms by BSP ---- */
  /* 2026-09-19: the Caverns (biome 3) lay out cellular-automata caves instead (js/world/biomes/caverns/caverns.js caveLayout) */
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

  var cryptHall = (floorMeta.boss && bidx()===1 && typeof stampCryptBossHall==='function') ? stampCryptBossHall() : null;   /* Morty's hall (js/world/biomes/crypt/cryptset.js) */

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
    var c=rooms.filter(function(r){ return !r.pocket && !used[r.id] && r.w*r.h>=minArea && (!pred||pred(r)); });
    if(!c.length) return null;
    var r=pick(c); used[r.id]=1; return r;
  }

  /* ---- required features ---- */
  if(floorMeta.boss){ if(bidx()===1 && typeof buildMortyHall==='function') buildMortyHall(goal); else buildBossRoom(goal); }
  else { var sEnd=floorNo>5 ? carveDeadEnd(goal) : null; if(!sEnd && floorNo>5){ var alt=rooms.filter(function(r){ return r!==goal && r!==start && !r.pocket; }).sort(function(a,b){ return (Math.abs(a.cx-goal.cx)+Math.abs(a.cy-goal.cy))-(Math.abs(b.cx-goal.cx)+Math.abs(b.cy-goal.cy)); }); for(var ai=0;ai<alt.length && !sEnd;ai++) sEnd=carveDeadEnd(alt[ai]); } if(sEnd){ setT(sEnd.x,sEnd.y,STAIRS); floorMeta.stairsHall=true; } else setT(goal.cx,goal.cy,STAIRS); decorateEdges(goal, ['torch-stand'], 2, true); }
  var roomPreview=RUN.sandbox&&globalThis.FoteRoomPreview;
  if(roomPreview&&roomPreview.type==='role'&&roomPreview.kind==='forge')floorMeta.forge=true;
  if(roomPreview&&roomPreview.type==='role'&&roomPreview.kind==='shrine')floorMeta.shrine=true;
  if(floorMeta.forge){ var fr=freeRoom(16)||freeRoom(9); if(fr){ fr.role='forge'; setT(fr.cx,fr.cy,FORGE); decorateEdges(fr,['brazier-lit','torch-stand'],2,true); floorMeta.forgeAt={x:fr.cx,y:fr.cy}; } }
  if(floorMeta.shrine){ var sr=freeRoom(12)||freeRoom(9); if(sr){ sr.role='shrine'; setT(sr.cx,sr.cy,SHRINE); floorMeta.shrineAt={x:sr.cx,y:sr.cy};
      decorateEdges(sr,['statue','banner-stand'],2,true); } }   /* no braziers: the shrine carries its own glow */

  /* ---- pockets: vaults, puzzles, toll rooms, hidden rooms ---- */
  if(floorNo>=2) buildLockedVault();
  var fb=bfloor();
  /* Preserve the retired puzzle selection draws so published seeds remain stable. */
  var puzzles = fb===1 ? [] : fb===2 ? ['icedoor','plates'] : fb===3 ? ['elemlock','thorns','chasm'] : fb===4 ? ['chasm','plates','elemlock','icedoor'] : ['thorns'];
  if(puzzles.length){ var pz=pick(puzzles); if(fb===4 && rng()<0.5) pick(puzzles.filter(function(p){return p!==pz;})); }
  if(floorNo>=3 && (rng()<0.55||roomPreview&&roomPreview.type==='pocket'&&roomPreview.kind==='toll')) buildTollRoom();
  var hiddenRoll=rng()<0.45,hiddenTheme=hiddenSigilTheme();if(roomPreview&&roomPreview.type==='pocket'&&roomPreview.kind==='hidden'){hiddenRoll=true;hiddenTheme=null;}if(hiddenRoll||hiddenTheme)buildHiddenRoom(hiddenTheme);

  /* ---- special rooms ---- */
  var specials = [
    ['garden',1,9,3], ['storage',1,9,3], ['library',1,12,2], ['nest',1,12,2], ['armory',2,12,2], ['prison',2,12,1.5],
    ['zoo',2,20,1.2], ['sacrifice',2,12,1.2], ['statues',3,16,1], ['treasury',3,16,1], ['barracks',2,16,1.5], ['dark',3,16,0.8], ['traps',2,16,1.3]
  ].filter(function(s){ return floorNo>=s[1] && !(floorMeta.boss && (s[0]==='zoo'||s[0]==='treasury')); });
  if(bidx()===2){
    specials=specials.filter(function(s){return s[0]!=='zoo';});
    specials.push(['flooded-cache',11,20,1.5]);
    if(!floorMeta.boss)specials.push(['survey-camp',11,16,1]);
    if(!floorMeta.boss)specials.push(['myconid-nursery',11,20,.6],['beetle-nest',11,20,.6]);
  }
  if(inDeep()&&!floorMeta.boss){specials=specials.filter(function(s){return s[0]!=='sacrifice';});specials=specials.map(function(s){return s[0]==='barracks'?['watchpost',16,25,s[3]]:s;});specials.push(['ritual',16,25,1.2]);}
  if(bidx()<4&&!floorMeta.boss)specials.push(['bone-vault',2,25,1]);
  if(bidx()<4&&!floorMeta.boss)specials.push(['adventurer-camp',2,20,1],['ruined-treasury',2,25,1]);
  if(bidx()<4&&!floorMeta.boss)specials.push(['greedy-vault',2,25,1]);
  if(bidx()===0&&!floorMeta.boss)specials.push(['goblin-mine',4,25,1]);
  if(bidx()===1&&!floorMeta.boss)specials.push(['heroes-tomb',6,9,1]);
  if(inDeep()&&!floorMeta.boss)specials.push(['harvester-camp',16,20,1]);
  if(bidx()<4&&!floorMeta.boss)specials.push([['portcullis-cache','funeral-bell','crystal-resonance','silk-survivor'][bidx()],2+bidx()*5,20,.4]);
  if(bidx()<4&&!floorMeta.boss&&(bidx()>0||floorNo>=3))Object.keys(ELEMENTAL_ROOM_KINDS).forEach(function(element){specials.push(['elemental-'+element,3+bidx()*5,20,.3]);});
  // The opening Dungeon floors use gentle room rosters; depth 3 unlocks the biome pool.
  if(bidx()===0&&floorNo<=2)specials=specials.filter(function(s){return ['bone-vault','portcullis-cache','zoo','barracks','ruined-treasury'].indexOf(s[0])<0;});
  var ritualDone=false;
  function zooFamily(kind){return kind==='zoo'||kind==='myconid-nursery'||kind==='beetle-nest';}
  var nSpecial = floorMeta.boss ? 1 : (floorNo===1 ? 2 : 2 + (rng()<0.5?1:0));
  var zooDone=false;
  for(i=0;i<nSpecial;i++){
    var pool=specials.filter(function(s){ return !(zooFamily(s[0])&&zooDone)&&!(s[0]==='ritual'&&ritualDone); });
    var tot=pool.reduce(function(a,s){return a+s[3];},0), roll2=rng()*tot, chosen=pool[0];
    for(j=0;j<pool.length;j++){ roll2-=pool[j][3]; if(roll2<=0){ chosen=pool[j]; break; } }
    if(i===0&&cavernMerchantFloor()===floorNo)chosen=['merchant',11,25,1];
    if(i===0&&swordStoneFloor()===floorNo)chosen=['sword-in-stone',2,25,1];
    var rareKind=i===0?uniqueRareKind():null;if(rareKind)chosen=[rareKind,1,25,1];
    if(i===0&&RUN.sandbox&&globalThis.FoteRoomPreview&&globalThis.FoteRoomPreview.type==='special')chosen=[globalThis.FoteRoomPreview.kind,1,25,1];
    var room=freeRoom(chosen[2],chosen[0]==='greedy-vault'?function(r){return !r.cave&&r.w===r.h;}:(chosen[0]==='ritual'||chosen[0]==='watchpost'||chosen[0]==='dark-wizard-library')?function(r){return !r.region;}:null);
    if(!room) continue;
    buildSpecial(chosen[0], room);
    if(zooFamily(chosen[0])) zooDone=true;
    if(chosen[0]==='ritual')ritualDone=true;
  }
  rooms.forEach(function(r){ if(!used[r.id]&&!r.hiddenSigil&&!r.rareEvent) decoratePlain(r); });

  /* ---- terrain patches ---- */
  var gn=ri(2,4); for(i=0;i<gn;i++){ var gr=pick(rooms); blob(gr.x+ri(0,gr.w-1), gr.y+ri(0,gr.h-1), ri(5,14), function(xx,yy){ if(at(xx,yy)===FLOOR && !gAt(xx,yy) && !propAt(xx,yy)) setG(xx,yy,G_GRASS); }); }
  var wn=ri(1,2); for(i=0;i<wn;i++){ var wr=pick(rooms.filter(function(r){ return r.role!=='start' && r.role!=='boss'; }))||pick(rooms);
    blob(wr.x+ri(1,Math.max(1,wr.w-2)), wr.y+ri(1,Math.max(1,wr.h-2)), ri(3,8), function(xx,yy){ if(at(xx,yy)===FLOOR && !propAt(xx,yy) && gAt(xx,yy)!==G_TELL) { setT(xx,yy,WATER); setG(xx,yy,0); } }); }   /* the uneven-stone hint beside a hidden door survives a pool (2026-09-23 audit) */
  for(i=0;i<8;i++){ var pr=pick(rooms), px=pr.x+ri(0,pr.w-1), py=pr.y+ri(0,pr.h-1); if(at(px,py)===FLOOR && !gAt(px,py)) setG(px,py,pick([G_PUDDLE,G_MOSS,G_MOSS,G_BONES,G_BLOOD])); }

  /* ---- chests ---- */
  var nChest = floorNo===1 ? 2 : 2;
  for(i=0;i<nChest;i++){ var cr=pick(rooms.filter(function(r){ return r.role!=='start'&&!r.merchant&&!r.consecratedStone&&!r.hiddenSigil&&!r.rareEvent; })); var cx2=cr.x+ri(0,cr.w-1), cy2=cr.y+ri(0,cr.h-1);
    if(freeCell(cx2,cy2) && !nearDoor(cx2,cy2) && !nearExplosive(cx2,cy2)) { setT(cx2,cy2,CHEST); chestKind[idxOf(cx2,cy2)] = rng()<0.12&&floorNo>=2 ? 'mimic' : 'chest-wood'; } }

  /* ---- traps (in rooms, never in doorways or corridors) ---- */
  var trapKinds=Object.keys(TRAPS).filter(function(k){ return TRAPS[k].minFloor<=floorNo&&(k!=='pit'||!(floorMeta.boss||floorNo%5===0)); });
  var nTraps = Math.round((2 + floorNo*2)*0.8);
  for(i=0;i<nTraps*3 && feats.filter(function(f){ return !f.room; }).length<nTraps;i++){
    var tr=pick(rooms); if(tr.role==='start'||tr.chestAmbush||tr.ritual||tr.residentKinds||tr.merchant||tr.consecratedStone||tr.hiddenSigil||tr.rareEvent||tr.special==='flooded-cache') continue;
    var tx=tr.x+ri(0,tr.w-1), ty=tr.y+ri(0,tr.h-1);
    if(roomAt(tx,ty)!==tr||at(tx,ty)!==FLOOR || propAt(tx,ty) || nearDoor(tx,ty) || (tr.trapBypass&&tr.trapBypass.indexOf(idxOf(tx,ty))>=0) || feats.some(function(f){return Math.abs(f.x-tx)+Math.abs(f.y-ty)<3;})) continue;
    feats.push({x:tx,y:ty,kind:pick(trapKinds),found:false});
  }

  /* ---- items ---- */
  var open=[];
  for(y=0;y<MH;y++) for(x=0;x<MW;x++) if(freeCell(x,y) && !nearDoor(x,y) && inRoom(x,y)&&!roomAt(x,y).merchant&&!roomAt(x,y).hiddenSigil&&!roomAt(x,y).rareEvent) open.push({x:x,y:y});
  if(open.length<(floorMeta.boss?12:30)) return false;
  function drop(it){ var c=pick(open); if(!freeCell(c.x,c.y)) return; it.x=c.x; it.y=c.y; items.push(it); }
  for(i=0;i<3;i++) drop({kind:'essence', n:ri(5,12)+floorNo*2});
  drop(randomGear()); if(rng()<0.6) drop(randomGear());
  if(rng()<0.25) drop({kind:'sigil', use:randomSigilUse()});   /* about one loose sigil every other floor; chests, crates and monsters add the rest */
  /* Guaranteed meals are placed after all room and terrain builders finish. */
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
    var rm=roomAt(s.x,s.y); if(rm && (rm.role==='boss'||rm.special==='zoo'||rm.chestAmbush||rm.ritual||rm.residentKinds||rm.merchant||rm.consecratedStone||rm.hiddenSigil||rm.rareEvent||rm.special==='flooded-cache'||rm.role==='forge'||rm.role==='shrine')) continue;
    var kind=rollMonster(), base=MONSTERS[kind];
    var n = base.pack ? ri(base.pack[0],base.pack[1]) : 1;
    for(var q=0;q<n;q++){
      var spot = q===0 ? s : nearFree(s.x,s.y,2);
      if(!spot) break;
      if(roomAt(spot.x,spot.y)&&(roomAt(spot.x,spot.y).chestAmbush||roomAt(spot.x,spot.y).ritual||roomAt(spot.x,spot.y).residentKinds||roomAt(spot.x,spot.y).merchant||roomAt(spot.x,spot.y).consecratedStone||roomAt(spot.x,spot.y).hiddenSigil||roomAt(spot.x,spot.y).rareEvent))continue;
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
    for(var ra=0; rk && ra<40; ra++){ var rs=pick(open); if(Math.abs(rs.x-player.x)+Math.abs(rs.y-player.y)<14 || !walkable(rs.x,rs.y) || occupied(rs.x,rs.y) || roomAt(rs.x,rs.y)&&(roomAt(rs.x,rs.y).chestAmbush||roomAt(rs.x,rs.y).ritual||roomAt(rs.x,rs.y).residentKinds||roomAt(rs.x,rs.y).merchant||roomAt(rs.x,rs.y).consecratedStone||roomAt(rs.x,rs.y).hiddenSigil||roomAt(rs.x,rs.y).rareEvent)) continue; spawn(rk,rs.x,rs.y).state='wander'; break; }
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
function placeGeneratedFood(){
  /* One meal per floor, plus a 45% chance of a second. Place on the finished map:
     earlier loot can occupy a random tile and room builders can replace it. */
  var reach=bfsFrom(player.x,player.y),cells=[],fallback=[];
  for(var y=0;y<MH;y++)for(var x=0;x<MW;x++){
    if(reach[idxOf(x,y)]<0||!freeCell(x,y)||nearDoor(x,y))continue;
    var room=roomAt(x,y);
    if(room&&(room.puzzle||room.merchant||room.hiddenSigil||room.rareEvent))continue;
    fallback.push({x:x,y:y});if(room)cells.push({x:x,y:y});
  }
  if(!cells.length)cells=fallback;
  var count=rng()<0.45?2:1;
  for(var i=0;i<count;i++){
    var cell=cells.length?cells.splice(ri(0,cells.length-1),1)[0]:{x:player.x,y:player.y};
    items.push({kind:'food',food:randomFood(),x:cell.x,y:cell.y});
  }
}

function bfsFrom(sx,sy,canTraverse){
  var d=new Int32Array(MW*MH).fill(-1), q=[sx,sy], h=0;
  d[idxOf(sx,sy)]=0;
  while(h<q.length){
    var x=q[h++], y=q[h++], cd=d[idxOf(x,y)];
    var nb=[[1,0],[-1,0],[0,1],[0,-1]];
    for(var i=0;i<4;i++){
      var nx=x+nb[i][0], ny=y+nb[i][1];
      if(!inb(nx,ny) || d[idxOf(nx,ny)]>=0) continue;
      var t=at(nx,ny);
      if(!(walkable(nx,ny) || t===DOOR || t===CHEST || canTraverse&&canTraverse(nx,ny,t))) continue;
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
function nearExplosive(x,y){
  for(var dy=-1;dy<=1;dy++)for(var dx=-1;dx<=1;dx++){var p=propAt(x+dx,y+dy);if(p&&(p.ex||p.fluid==='poison'))return true;}
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
function rectangularEdgeCells(r){
  var out=[];
  for(var y=r.y;y<r.y+r.h;y++) for(var x=r.x;x<r.x+r.w;x++){
    if(!(x===r.x||x===r.x+r.w-1||y===r.y||y===r.y+r.h-1)) continue;
    if(at(x,y)!==FLOOR || propAt(x,y) || nearDoor(x,y)) continue;
    if(x===r.cx && y===r.cy) continue;
    out.push({x:x,y:y});
  }
  return out;
}
function rectangularInteriorCells(r){
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

function randomSigilUse(){ return pick(['firestorm','mana','levitate','stoneskin','heal','vanish','heal','identify','mapping','blink']); }

/* ---- pockets: carve a small room off an existing one, behind one door tile ---- */
/* a dead-end hallway 3-5 tiles long leading out of a room, solid rock on both sides; returns its far end.
   From biome 2 on, stairs sit at the end of one (2026-09-17, from the Crypt concept art; biome 1 keeps stairs in the room) */
function carveRectangularPassage(room){
  var sides=shuffled([0,1,2,3]);
  for(var t=0;t<120;t++){
    var side=sides[t%4], len=ri(3,5), sx, sy, dx=0, dy=0;
    if(side===0){ sx=room.x+ri(1,Math.max(1,room.w-2)); sy=room.y-1; dy=-1; }
    else if(side===1){ sx=room.x+ri(1,Math.max(1,room.w-2)); sy=room.y+room.h; dy=1; }
    else if(side===2){ sx=room.x-1; sy=room.y+ri(1,Math.max(1,room.h-2)); dx=-1; }
    else { sx=room.x+room.w; sy=room.y+ri(1,Math.max(1,room.h-2)); dx=1; }
    var inside={x:sx-dx, y:sy-dy};
    if(at(inside.x,inside.y)!==FLOOR || propAt(inside.x,inside.y) || nearExplosive(inside.x,inside.y)) continue;
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
    if(at(inside.x,inside.y)!==FLOOR || propAt(inside.x,inside.y) || nearExplosive(inside.x,inside.y)) continue;
    for(y=ry;y<ry+h;y++) for(x=rx;x<rx+w;x++) setT(x,y,FLOOR);
    var room={x:rx,y:ry,w:w,h:h,cx:rx+(w>>1),cy:ry+(h>>1),id:1000+rooms.length,pocket:true,previewApproach:{x:inside.x,y:inside.y},previewDoor:{x:dx,y:dy}};
    rooms.push(room);
    return {room:room, door:{x:dx,y:dy}, host:host, inside:inside};
  }
  return null;
}
// Old floors may contain a door at a corridor end, with solid rock behind it.
// Keep the walkable alcove (and any occupant), but remove its misleading door.
function repairDeadEndDoors(){
  var repaired=0;
  for(var y=1;y<MH-1;y++)for(var x=1;x<MW-1;x++){
    var t=at(x,y);if(t!==DOOR&&t!==OPEN)continue;
    var exits=[[1,0],[-1,0],[0,1],[0,-1]].filter(function(d){var n=at(x+d[0],y+d[1]);return n!==WALL&&n!==SECRET&&n!==CHASM;});
    if(exits.length<=1){setT(x,y,FLOOR);repaired++;}
  }
  return repaired;
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
  decorateEdges(pk.room, ['torch-stand'], 1, true);
}
function buildTollRoom(){
  var pk=carvePocket(3,3,5,4); if(!pk) return;
  setT(pk.door.x,pk.door.y,TOLL); pk.room.special='toll';
  floorMeta.entrances=(floorMeta.entrances||[]).concat([pk.inside]);
  lootRoom(pk.room, true);
  var c=shuffled(interiorCells(pk.room).concat(edgeCells(pk.room))).filter(function(p){ return freeCell(p.x,p.y); });
  if(c.length) items.push({x:c[0].x,y:c[0].y,kind:'mote',el:pick(ELEMENTS)});
}
function buildUncommonEvent(kind,host){
  var r=host,pk;
  function abandonPocket(){if(!pk)return;for(var y=r.y;y<r.y+r.h;y++)for(var x=r.x;x<r.x+r.w;x++)setT(x,y,WALL);setT(pk.door.x,pk.door.y,WALL);rooms=rooms.filter(function(room){return room!==r;});}
  if(kind==='portcullis-cache'){
    pk=carvePocket(4,4,4,4,function(r){return r!==host;});if(!pk)return;
    r=pk.room;r.special=kind;setT(pk.door.x,pk.door.y,SEALED);
  }
  var plan=specialRoomPlan(r),cells=plan.cells.filter(function(c){return freeCell(c.x,c.y);}).sort(function(a,b){return plan.depth(b)-plan.depth(a);});
  if(cells.length<8){abandonPocket();return;}
  var name={'portcullis-cache':'lever-up','funeral-bell':'crypt-funeral-bell','crystal-resonance':'resonance-crystal','silk-survivor':'silk-wrapped-traveler'}[kind],focus=null;
  if(pk){
    var reachable=bfsFrom(pk.inside.x,pk.inside.y),spots=[];
    rooms.filter(function(candidate){return candidate!==r&&candidate!==host&&!candidate.pocket&&!candidate.role&&!candidate.uncommonEvent;}).forEach(function(candidate){
      for(var y=candidate.y;y<candidate.y+candidate.h;y++)for(var x=candidate.x;x<candidate.x+candidate.w;x++)if(reachable[idxOf(x,y)]>=12&&freeCell(x,y)&&!nearDoor(x,y)&&roomFurnitureKeepsOpen(candidate,{x:x,y:y}))spots.push({x:x,y:y,d:reachable[idxOf(x,y)]});
    });
    spots.sort(function(a,b){return b.d-a.d;});
    if(spots.length){var far=spots.slice(0,Math.max(1,Math.ceil(spots.length/4))),spot=pick(far);focus=addProp(spot.x,spot.y,name,{keep:true,eventRoom:r.id});}
  }
  else cells.some(function(c){focus=plan.furniture(c,name,{keep:true,eventRoom:r.id});return !!focus;});
  if(!focus){abandonPocket();return;}
  r.rareEvent=kind;r.uncommonEvent={kind:kind,used:false,focus:{x:focus.x,y:focus.y},cells:cells.map(function(c){return {x:c.x,y:c.y};}),mouths:plan.mouths};
  if(pk){
    var chest=cells[0];setT(chest.x,chest.y,CHEST);chestKind[idxOf(chest.x,chest.y)]='chest-gold';r.enhancedChest={x:chest.x,y:chest.y};
    host.special=null;
    r.uncommonEvent.door=pk.door;addProp(pk.door.x,pk.door.y,'portcullis-closed',{keep:true,eventGate:true});
  }
  cells.forEach(function(c){plan.reserved.add(idxOf(c.x,c.y));});plan.publish();
}
function interactUncommonEvent(p){
  var r=rooms.find(function(r){return r.id===p.eventRoom&&r.uncommonEvent;}),e=r&&r.uncommonEvent;if(!e)return false;
  if(e.used){log('Its work is done.','c-info');return true;}
  e.used=true;p.used=true;
  if(e.kind==='portcullis-cache'){
    p.name='lever-down';var gate=propAt(e.door.x,e.door.y);if(gate&&gate.eventGate)removeProp(gate);setT(e.door.x,e.door.y,OPEN);sfx('lever');
  }else sfx(e.kind==='funeral-bell'?'crypt-bell':'pickup-item',{from:p});
  var cells=shuffled(e.cells).filter(function(c){return freeCell(c.x,c.y)&&walkable(c.x,c.y)&&!occupied(c.x,c.y)&&dist(c,player)>0;});
  function summon(kind,c){var m=spawn(kind,c.x,c.y,{skipDeep:true});m.state='hunt';m.lastSeen={x:player.x,y:player.y};m.t=player.t+100;return m;}
  var roster=e.kind==='portcullis-cache'?['brute','brute','shaman']:e.kind==='funeral-bell'?['acolyte','acolyte','acolyte']:[];
  roster.forEach(function(kind,i){if(cells[i])summon(kind,cells[i]);});
  if(e.kind==='silk-survivor'){
    removeProp(p);
    var survivor=spawnRaw('silk-survivor-human',p.x,p.y);survivor.foe=false;survivor.ally=true;survivor.state='ally';survivor.t=player.t+100;survivor.escapee=true;survivor.noXp=true;survivor.noLoot=true;
    survivor.silkEscort={roomId:r.id};survivor.escapeExit=prisonExit();e.escort='active';
    cells.filter(function(c){return !occupied(c.x,c.y);}).slice(0,12).forEach(function(c){summon('spiderling',c);});
    var outside=[];e.mouths.forEach(function(m){[[1,0],[-1,0],[0,1],[0,-1]].forEach(function(d){var x=m.x+d[0],y=m.y+d[1];if(roomAt(x,y)===r)return;if(isDoorish(at(x,y))){x+=d[0];y+=d[1];}if(inb(x,y)&&roomAt(x,y)!==r&&walkable(x,y)&&freeCell(x,y)&&!occupied(x,y)&&(player.x!==x||player.y!==y))outside.push({x:x,y:y});});});
    if(outside.length)summon('drider',outside[0]);
  }
  if(e.kind==='crystal-resonance')ents.forEach(function(m){if(m!==player&&m.foe&&m.hp>0&&dist(m,p)<=8){m.state='hunt';m.lastSeen={x:p.x,y:p.y};}});
  resolveUncommonRewards(e.kind,p);
  FoteContent.appearanceChanged(floorMeta);computeFOV();endTurn();return true;
}
function buildHarvesterCamp(r){
  var plan=specialRoomPlan(r),cells=plan.cells.filter(function(c){return freeCell(c.x,c.y);}).sort(function(a,b){return plan.depth(b)-plan.depth(a);});
  if(!cells.length)return;
  var chest=cells.shift();plan.reserve(chest);setT(chest.x,chest.y,CHEST);chestKind[idxOf(chest.x,chest.y)]='crate-supply';
  var food=pick(Object.keys(FOODS).filter(function(k){return FOODS[k].buff&&(FOODS[k].biome===undefined||FOODS[k].biome===3);}));
  r.rareEvent='harvester-camp';r.campChest={chest:{x:chest.x,y:chest.y},loot:[{kind:'food',food:'skewer'},{kind:'food',food:'glowstew'},{kind:'food',food:food}]};
  var decor=[['cocoon-large-1',{hatch:false}],['alchemy-table',{}],['barrel',{}],['barrel',{}],['mushrooms',{}],['mushrooms',{}]];
  decor.forEach(function(entry){cells.some(function(c){
    if(entry[0]==='cocoon-large-1'&&![[0,-1],[-1,0],[1,0],[0,1]].some(function(d){return isWallLike(at(c.x+d[0],c.y+d[1]));}))return false;
    return !!plan.furniture(c,entry[0],Object.assign({keep:true},entry[1]));
  });});
  plan.publish();
}
function buildSurveyCamp(r){
  var plan=specialRoomPlan(r),cells=plan.cells.filter(function(c){return freeCell(c.x,c.y);}).sort(function(a,b){return plan.depth(b)-plan.depth(a);});
  if(!cells.length)return;
  var chest=cells.shift();plan.reserve(chest);setT(chest.x,chest.y,CHEST);chestKind[idxOf(chest.x,chest.y)]='crate-supply';
  r.rareEvent='survey-camp';r.surveyCamp={chest:{x:chest.x,y:chest.y},loot:[{kind:'food',food:'ration'},{kind:'food',food:'ration'},{kind:'sigil',use:randomSigilUse()}]};
  var names=['mine-cart','kobold-pickaxe','kobold-pickaxe','kobold-bedroll-1','cl-lost-miner-1'];
  names.forEach(function(name){cells.some(function(c){return !!plan.furniture(c,name,{keep:true});});});
  plan.publish();
}
function buildAdventurerCamp(r){
  var plan=specialRoomPlan(r),cells=plan.cells.filter(function(c){return freeCell(c.x,c.y);}).sort(function(a,b){return plan.depth(b)-plan.depth(a);});
  if(!cells.length)return;
  var chest=cells.shift();plan.reserve(chest);setT(chest.x,chest.y,CHEST);chestKind[idxOf(chest.x,chest.y)]='crate-supply';
  r.rareEvent='adventurer-camp';r.campChest={chest:{x:chest.x,y:chest.y},loot:[{kind:'food',food:'ration'},{kind:'food',food:'ration'},randomGear()]};
  ['kobold-bedroll-1','kobold-bedroll-1','kobold-campfire','kobold-crate','cl-lost-miner-1'].forEach(function(name){cells.some(function(c){return !!plan.furniture(c,name,{keep:true});});});
  plan.publish();
}
function buildRuinedTreasury(r){
  var plan=specialRoomPlan(r),cells=plan.cells.filter(function(c){return freeCell(c.x,c.y);}).sort(function(a,b){return plan.depth(b)-plan.depth(a);});
  if(!cells.length)return;
  var chest=cells.shift();plan.reserve(chest);setT(chest.x,chest.y,CHEST);chestKind[idxOf(chest.x,chest.y)]='chest-gold';
  r.rareEvent='ruined-treasury';r.enhancedChest={x:chest.x,y:chest.y};
  r.barracks=true;r.residentKinds=[rollMonster(),rollMonster(),rollMonster()];r.residentCount=3;r.residentState='asleep';
  r.residentPosts=cells.filter(function(c){return !nearDoor(c.x,c.y);}).slice(0,3);r.residentPosts.forEach(function(c){plan.reserve(c);});
  cells.forEach(function(c){setG(c.x,c.y,G_BONES);});
  ['statue-broken','statue-broken','rubble','rubble'].forEach(function(name){cells.some(function(c){return !!plan.furniture(c,name,{keep:true});});});
  plan.publish();
}
function buildHeroesTomb(host){
  var pk=carvePocket(3,3,3,3,function(r){return r!==host;});if(!pk)return;
  var r=pk.room;r.special='heroes-tomb';r.rareEvent='heroes-tomb';r.secretDoor=pk.door;r.secretTell=pk.inside;
  setT(pk.door.x,pk.door.y,SECRET);setG(pk.inside.x,pk.inside.y,G_TELL);
  floorMeta.consecratedGround=floorMeta.consecratedGround||{};
  for(var y=r.y;y<r.y+r.h;y++)for(var x=r.x;x<r.x+r.w;x++){
    floorMeta.consecratedGround[idxOf(x,y)]={power:1,damage:3};
    if(x===r.cx&&y===r.cy)addProp(x,y,'coffin',{keep:true});
    else addProp(x,y,'grave-flowers-moss-'+(1+(x+y)%4),{keep:true});
  }
  items.push({x:r.cx-1,y:r.cy,kind:'food',food:'ration'},{x:r.cx+1,y:r.cy,kind:'food',food:'ration'});
  host.special=null;
  floorMeta.notes.push("A hidden hero's tomb offers a consecrated refuge.");
  return pk;
}
function buildHiddenRoom(spec){
  var pk=spec?carvePocket(spec.expedition?5:spec.slimes?4:3,spec.expedition?4:spec.slimes?4:3,spec.expedition?5:spec.slimes?4:5,4,function(host){return !!host.role||!!host.pocket;}):carvePocket(2,2,4,3); if(!pk) return;
  setT(pk.door.x,pk.door.y,SECRET); pk.room.special='hidden';pk.room.secretDoor=pk.door;pk.room.secretTell=pk.inside;
  /* never blind searching: a visible tell on the floor beside the secret wall */
  setG(pk.inside.x,pk.inside.y,G_TELL);
  if(spec){dressHiddenSigil(pk,spec);return pk;}
  var c=shuffled(interiorCells(pk.room).concat(edgeCells(pk.room)));
  if(c.length){ setT(c[0].x,c[0].y,CHEST); chestKind[idxOf(c[0].x,c[0].y)]='chest-wood'; }
  if(c.length>1) items.push({x:c[1].x,y:c[1].y,kind:'essence',n:ri(15,30)});
}


/* ---- special rooms inside ordinary rooms ---- */
function buildStorageRoom(r,edges){
  var cells=[],directions=[[1,0],[-1,0],[0,1],[0,-1]];
  for(var y=r.y;y<r.y+r.h;y++)for(var x=r.x;x<r.x+r.w;x++){var existing=propAt(x,y);if(roomAt(x,y)===r&&at(x,y)===FLOOR&&!(existing&&existing.b))cells.push({x:x,y:y});}
  if(!cells.length)return;
  var available=new Set(cells.map(function(c){return idxOf(c.x,c.y);}));
  var mouths=cells.filter(function(c){return directions.some(function(d){var x=c.x+d[0],y=c.y+d[1];return roomAt(x,y)!==r&&(walkable(x,y)||isDoorish(at(x,y)));});});
  var horizontal=r.w>=r.h,axis=horizontal?r.cy:r.cx;
  var lanes=cells.filter(function(c){var v=horizontal?c.y:c.x;return v===axis||v===axis+1;}),hub=lanes[0]||cells[0];
  function distance(c){return mouths.length?Math.min.apply(null,mouths.map(function(m){return Math.abs(c.x-m.x)+Math.abs(c.y-m.y);})):Math.abs(c.x-hub.x)+Math.abs(c.y-hub.y);}
  var prizes=edges.filter(function(c){return available.has(idxOf(c.x,c.y));}).sort(function(a,b){return distance(b)-distance(a);});
  var chest=prizes[0]||cells.filter(function(c){return freeCell(c.x,c.y);}).sort(function(a,b){return distance(b)-distance(a);})[0];if(!chest)return;
  var reserved=new Set(lanes.map(function(c){return idxOf(c.x,c.y);}));
  // Join entrances and the supply chest to the two-cell service aisle, including
  // irregular cave mouths. Furniture never occupies those connecting paths.
  function route(from,blocked){
    var start=idxOf(from.x,from.y),goal=idxOf(hub.x,hub.y),q=[start],parent=new Map([[start,start]]);
    for(var h=0;h<q.length;h++){
      var i=q[h];if(i===goal)break;
      directions.forEach(function(d){var x=i%MW+d[0],y=Math.floor(i/MW)+d[1],n=idxOf(x,y);
        var prop=propAt(x,y);
        if(available.has(n)&&!(prop&&prop.b)&&!parent.has(n)&&(!blocked||!blocked(x,y))){parent.set(n,i);q.push(n);}
      });
    }
    if(!parent.has(goal))return null;
    var out=[];for(var step=goal;step!==start;step=parent.get(step))out.push(step);out.push(start);return out;
  }
  mouths.concat([chest]).forEach(function(c){(route(c)||[]).forEach(function(i){reserved.add(i);});});
  setT(chest.x,chest.y,CHEST);chestKind[idxOf(chest.x,chest.y)]='crate-supply';
  var bombs=rng()<0.6?1:2,placed=[];
  var powder=cells.filter(function(c){
    if(reserved.has(idxOf(c.x,c.y))||nearDoor(c.x,c.y)||Math.max(Math.abs(c.x-chest.x),Math.abs(c.y-chest.y))<=1)return false;
    for(var yy=c.y-3;yy<=c.y+3;yy++)for(var xx=c.x-3;xx<=c.x+3;xx++)if([STAIRS,UPSTAIRS,EXIT,PORTAL,FORGE,SHRINE].indexOf(at(xx,yy))>=0)return false;
    // A powder blast may threaten one side of the aisle, but never every way
    // between its entrances and reward. The hub itself remains outside it.
    function blast(x,y){return Math.max(Math.abs(x-c.x),Math.abs(y-c.y))<=1;}
    if(blast(hub.x,hub.y))return false;
    return mouths.concat([chest]).every(function(m){return !blast(m.x,m.y)&&!!route(m,blast);});
  }).sort(function(a,b){return Math.abs((horizontal?a.y:a.x)-axis)-Math.abs((horizontal?b.y:b.x)-axis);});
  for(var bi=0;bi<powder.length&&placed.length<bombs;bi++){
    var b=powder[bi];if(placed.some(function(p){return Math.max(Math.abs(p.x-b.x),Math.abs(p.y-b.y))<=2;}))continue;
    if(!freeCell(b.x,b.y)||reserved.has(idxOf(b.x,b.y)))continue;
    function blast(x,y){return Math.max(Math.abs(x-b.x),Math.abs(y-b.y))<=1;}
    var bypasses=mouths.concat([chest]).map(function(m){return route(m,blast);});
    if(bypasses.some(function(path){return !path;}))continue;
    var barrelKind=pick(['barrel-explosive','barrel-poison','barrel-water']);
    if(addProp(b.x,b.y,barrelKind)){
      placed.push(b);bypasses.forEach(function(path){path.forEach(function(i){reserved.add(i);});});
    }
  }
  var stock=edges.filter(function(c){return freeCell(c.x,c.y)&&!reserved.has(idxOf(c.x,c.y));});
  r.storageAisle=Array.from(reserved);
  stock.sort(function(a,b){var av=horizontal?a.y:a.x,bv=horizontal?b.y:b.x;return av-bv||(horizontal?a.x-b.x:a.y-b.y);});
  var names=['barrel','crate','pot','crate','barrel','pot'],count=Math.min(7,Math.floor(edges.length*0.6));
  for(var si=0;si<stock.length&&si<count;si++)addProp(stock[si].x,stock[si].y,names[si%names.length]);
}

function buildArmoryRoom(r){
  var cells=[],dirs=[[1,0],[-1,0],[0,1],[0,-1]],horizontal=r.w>=r.h;
  for(var y=r.y;y<r.y+r.h;y++)for(var x=r.x;x<r.x+r.w;x++)if(roomAt(x,y)===r&&freeCell(x,y))cells.push({x:x,y:y});
  if(!cells.length)return;
  var remaining=new Map(cells.map(function(c){return [idxOf(c.x,c.y),c];})),groups=[];
  while(remaining.size){var first=remaining.keys().next().value,q=[first],group=[];remaining.delete(first);
    for(var h=0;h<q.length;h++){var i=q[h];group.push({x:i%MW,y:Math.floor(i/MW)});dirs.forEach(function(d){var j=idxOf(i%MW+d[0],Math.floor(i/MW)+d[1]);if(remaining.has(j)){remaining.delete(j);q.push(j);}});}groups.push(group);
  }
  cells=groups.sort(function(a,b){return b.length-a.length;})[0];
  var available=new Set(cells.map(function(c){return idxOf(c.x,c.y);})),axis=horizontal?r.cy:r.cx;
  var aisle=cells.filter(function(c){var v=horizontal?c.y:c.x;return v===axis||v===axis+1;}),hub=aisle[0]||cells[0];
  var mouths=cells.filter(function(c){return dirs.some(function(d){return roomAt(c.x+d[0],c.y+d[1])!==r&&(walkable(c.x+d[0],c.y+d[1])||isDoorish(at(c.x+d[0],c.y+d[1])));});});
  function entranceDistance(c){return mouths.length?Math.min.apply(null,mouths.map(function(m){return Math.abs(c.x-m.x)+Math.abs(c.y-m.y);})):Math.abs(c.x-hub.x)+Math.abs(c.y-hub.y);}
  var prizes=cells.slice().sort(function(a,b){return entranceDistance(b)-entranceDistance(a);}),rewards=[prizes[0]];
  if(prizes.length>1)rewards.push(prizes.slice(1).sort(function(a,b){return dist(b,rewards[0])-dist(a,rewards[0])||entranceDistance(b)-entranceDistance(a);})[0]);
  var reserved=new Set(aisle.map(function(c){return idxOf(c.x,c.y);}));
  function reserveRoute(c){
    var start=idxOf(c.x,c.y),goal=idxOf(hub.x,hub.y),q=[start],parent=new Map([[start,start]]);
    for(var h=0;h<q.length&&!parent.has(goal);h++){var i=q[h];dirs.forEach(function(d){var j=idxOf(i%MW+d[0],Math.floor(i/MW)+d[1]);if(available.has(j)&&!parent.has(j)){parent.set(j,i);q.push(j);}});}
    if(!parent.has(goal))return false;
    for(var i=goal;i!==start;i=parent.get(i))reserved.add(i);reserved.add(start);return true;
  }
  mouths.concat(rewards).forEach(reserveRoute);
  r.storageAisle=Array.from(reserved);
  rewards.forEach(function(c){var it=randomGear();it.x=c.x;it.y=c.y;items.push(it);});
  // Two racks sit beside the service aisle. They obstruct shots while both
  // ends of the aisle and the approaches to the displayed gear stay open.
  var stock=cells.filter(function(c){return !reserved.has(idxOf(c.x,c.y))&&!nearDoor(c.x,c.y);});
  stock.sort(function(a,b){return Math.abs((horizontal?a.y:a.x)-axis)-Math.abs((horizontal?b.y:b.x)-axis)||entranceDistance(b)-entranceDistance(a);});
  var racks=[];
  stock.forEach(function(c){if(racks.length<Math.min(6,Math.max(3,Math.floor(cells.length/12)))&&freeCell(c.x,c.y)&&roomFurnitureKeepsOpen(r,c)&&!racks.some(function(p){return dist(p,c)<2;})){var p=addProp(c.x,c.y,'weapon-rack',{keep:true});if(p)racks.push(p);}});
  var banner=stock.slice().reverse().find(function(c){return freeCell(c.x,c.y);});if(banner)addProp(banner.x,banner.y,'banner-stand');
  if(floorNo>=3){r.namedGuardCount=namedRoomPopulation(r,4,7);namedRoomPosts(r,r.namedGuardCount,rewards[0]);}
}

var LIBRARY_THEMES={
  elemental:{motes:ELEMENTS,gear:['tome','orb'],sigils:['firestorm','identify','levitate','stoneskin','heal','vanish','firestorm2','identify2','levitate2','stoneskin2','heal2','vanish2','cinder','magma','sunburst','smoke','storm','mire','purify','mana']},
  holy:{motes:['light','water','earth'],gear:['tome','holy'],sigils:['heal','identify','stoneskin','purify','heal2','stoneskin2','aegis']},
  explorer:{motes:['air','earth','shadow'],gear:['tome'],sigils:['levitate','stoneskin','vanish','mapping','blink','recall','haste','levitate2','stoneskin2','vanish2']},
  forbidden:{motes:['shadow','fire','water'],gear:['tome','orb','dagger'],sigils:['vanish','firestorm','identify','smoke','mana','vanish2','firestorm2','identify2']}
};
function librarySigil(theme,element){
  var pool=LIBRARY_THEMES[theme].sigils.filter(function(k){return SIGILS[k]&&(!element||SIGILS[k].motes.includes(element));});
  if(!pool.length)pool=LIBRARY_THEMES[theme].sigils.filter(function(k){return !!SIGILS[k];});
  var roll=rng(),grade=roll<.85?'singles':roll<.95?'pairs':roll<.99?'plus':'grand';
  var preferred=pool.filter(function(k){return SIGIL_ORDER[grade].includes(k)||(grade==='plus'&&SIGIL_ORDER.triple.includes(k));});
  var singles=pool.filter(function(k){return SIGIL_ORDER.singles.includes(k);});return pick(preferred.length?preferred:singles.length?singles:pool);
}
function libraryRewards(theme,element){
  var first=librarySigil(theme,element),pool=LIBRARY_THEMES[theme].sigils.filter(function(k){return SIGILS[k]&&SIGILS[k].motes.length>=2&&(!element||SIGILS[k].motes.includes(element));});
  if(!pool.length)pool=Object.keys(SIGILS).filter(function(k){return SIGILS[k].motes.length>=2;});
  var distinct=pool.filter(function(k){return k!==first;}),second=pick(distinct.length?distinct:pool);
  return [{kind:'sigil',use:first},{kind:'sigil',use:second},{kind:'off',it:clone(OFFHANDS.tome)}];
}
function buildLibraryRoom(r){
  var theme=pick(Object.keys(LIBRARY_THEMES)),spec=LIBRARY_THEMES[theme],element=theme==='elemental'?pick(ELEMENTS):null;
  r.libraryTheme=theme;r.libraryElement=element;
  var cells=[],dirs=[[1,0],[-1,0],[0,1],[0,-1]];
  for(var y=r.y;y<r.y+r.h;y++)for(var x=r.x;x<r.x+r.w;x++)if(roomAt(x,y)===r&&freeCell(x,y))cells.push({x:x,y:y});
  if(!cells.length)return;
  var available=new Set(cells.map(function(c){return idxOf(c.x,c.y);})),hub=cells.slice().sort(function(a,b){return dist(a,{x:r.cx,y:r.cy})-dist(b,{x:r.cx,y:r.cy});})[0];
  var parent=new Map([[idxOf(hub.x,hub.y),idxOf(hub.x,hub.y)]]),q=[idxOf(hub.x,hub.y)];
  for(var h=0;h<q.length;h++){var i=q[h];dirs.forEach(function(d){var j=idxOf(i%MW+d[0],Math.floor(i/MW)+d[1]);if(available.has(j)&&!parent.has(j)){parent.set(j,i);q.push(j);}});}
  cells=cells.filter(function(c){return parent.has(idxOf(c.x,c.y));});
  var reserved=new Set();function reserve(c){var i=idxOf(c.x,c.y);while(parent.has(i)){reserved.add(i);var next=parent.get(i);if(next===i)break;i=next;}}
  var mouths=cells.filter(function(c){return dirs.some(function(d){return roomAt(c.x+d[0],c.y+d[1])!==r&&(walkable(c.x+d[0],c.y+d[1])||isDoorish(at(c.x+d[0],c.y+d[1])));});});
  cells.forEach(function(c){if(Math.abs(c.x-hub.x)<=1&&Math.abs(c.y-hub.y)<=1)reserve(c);});mouths.forEach(reserve);
  var prizes=cells.slice().sort(function(a,b){return dist(b,hub)-dist(a,hub);});
  var rewards=libraryRewards(theme,element);
  if(rng()<.4)rewards.push({kind:'mote',el:element||pick(spec.motes)});
  rewards.forEach(function(it,n){var c=prizes[Math.min(n,prizes.length-1)];it.x=c.x;it.y=c.y;items.push(it);reserve(c);});
  r.storageAisle=Array.from(reserved);
  // Subjects have different shelf arrangements around the reserved reading area.
  var stock=cells.filter(function(c){if(reserved.has(idxOf(c.x,c.y))||nearDoor(c.x,c.y))return false;
    if(theme==='holy')return c.x===r.x||c.x===r.x+r.w-1;
    if(theme==='explorer')return (c.x-r.x)%3===0;
    if(theme==='forbidden')return c.y< hub.y&&(c.x-r.x)%2===0||c.y===r.y+r.h-1;
    return c.y===r.y||c.y===r.y+r.h-1;
  });
  stock.sort(function(a,b){return a.y-b.y||a.x-b.x;});
  var shelfTarget=Math.min(10,Math.max(4,Math.floor((r.w+r.h)/2))),shelves=0;
  var fallback=cells.filter(function(c){return !reserved.has(idxOf(c.x,c.y))&&!nearDoor(c.x,c.y)&&!stock.some(function(p){return p.x===c.x&&p.y===c.y;});});
  stock.concat(fallback).forEach(function(c){if(shelves<shelfTarget&&freeCell(c.x,c.y)&&roomFurnitureKeepsOpen(r,c)&&addProp(c.x,c.y,'bookshelf',{keep:true}))shelves++;});
  var desk=cells.find(function(c){return !reserved.has(idxOf(c.x,c.y))&&freeCell(c.x,c.y)&&dist(c,hub)<=3;});if(desk)addProp(desk.x,desk.y,'table-candle');
}

function buildPrisonRoom(r){
  var edges=edgeCells(r).filter(function(c){return freeCell(c.x,c.y)&&!nearDoor(c.x,c.y);});
  var cages=[],reserved=new Set(),hub={x:r.cx,y:r.cy};
  edges.sort(function(a,b){return a.y-b.y||a.x-b.x;});
  for(var n=0;n<edges.length&&cages.length<2;n++){
    var c=edges[n];if(cages.some(function(p){return dist(p,c)<3;}))continue;
    var approaches=[[1,0],[-1,0],[0,1],[0,-1]].map(function(d){return {x:c.x+d[0],y:c.y+d[1]};}).filter(function(q){return roomAt(q.x,q.y)===r&&freeCell(q.x,q.y);});
    if(!approaches.length)continue;
    var cage=addProp(c.x,c.y,'cage',{keep:true});if(!cage)continue;cages.push(cage);
    approaches.forEach(function(q){reserved.add(idxOf(q.x,q.y));});
  }
  if(cages.length&&rng()<.85)cages[0].prisoner=pick(['goblin','archer']);
  // Keep release space and connected approaches clear through biome dressing.
  var field=bfsFrom(hub.x,hub.y);
  var targets=Array.from(reserved);
  for(var y=r.y;y<r.y+r.h;y++)for(var x=r.x;x<r.x+r.w;x++){
    if(roomAt(x,y)!==r||!walkable(x,y))continue;
    if(x===r.cx||x===r.cx+1||[[1,0],[-1,0],[0,1],[0,-1]].some(function(d){return roomAt(x+d[0],y+d[1])!==r&&walkable(x+d[0],y+d[1]);}))targets.push(idxOf(x,y));
  }
  targets.forEach(function(i){var limit=MW*MH;while(field[i]>0&&limit-->0){reserved.add(i);var x=i%MW,y=Math.floor(i/MW),next=[[1,0],[-1,0],[0,1],[0,-1]].map(function(d){return idxOf(x+d[0],y+d[1]);}).find(function(j){return field[j]===field[i]-1;});if(next===undefined)break;i=next;}reserved.add(i);});
  r.storageAisle=Array.from(reserved);
  var furniture=['table-candle','chains','bones'];var count=0;
  edges.forEach(function(c){if(count<3&&freeCell(c.x,c.y)&&!reserved.has(idxOf(c.x,c.y))){addProp(c.x,c.y,furniture[count++]);}});
}

/* Furniture plans share the room's actual floor footprint, including caves.
 * Paths connect the entrances and rewards before decoration is placed. */
// Test authored furniture before placement so biome path repair can leave it intact.
function roomFurnitureKeepsOpen(r,c,w,h){
  w=w||1;h=h||1;var blocked=new Set(),dirs=[[1,0],[-1,0],[0,1],[0,-1]],cells=[];
  for(var y=c.y;y<c.y+h;y++)for(var x=c.x;x<c.x+w;x++){if(roomAt(x,y)!==r||!freeCell(x,y)||itemAt(x,y))return false;blocked.add(idxOf(x,y));}
  function pass(x,y){var p=propAt(x,y),t=at(x,y);return roomAt(x,y)===r&&!(p&&p.b&&!p.br)&&(terrainRules.walkable(t,false,true)||isDoorish(t)||t===CHEST);}
  for(var y=r.y;y<r.y+r.h;y++)for(var x=r.x;x<r.x+r.w;x++)if(pass(x,y))cells.push({x:x,y:y});
  var start=cells.find(function(p){return !blocked.has(idxOf(p.x,p.y));});if(!start)return false;
  function reach(avoid){var seen=new Set(),q=[idxOf(start.x,start.y)];for(var head=0;head<q.length;head++){var i=q[head];if(seen.has(i)||avoid&&blocked.has(i))continue;seen.add(i);dirs.forEach(function(d){var x=i%MW+d[0],y=Math.floor(i/MW)+d[1],j=idxOf(x,y);if(pass(x,y)&&!seen.has(j))q.push(j);});}return seen;}
  var before=reach(false),after=reach(true);
  if(cells.some(function(p){var i=idxOf(p.x,p.y);return !blocked.has(i)&&before.has(i)&&!after.has(i);}))return false;
  return props.filter(function(p){return roomAt(p.x,p.y)===r&&(p.lever||p.prisoner||p.altar||p.tablet||p.merchantId!==undefined);}).every(function(p){return dirs.some(function(d){return after.has(idxOf(p.x+d[0],p.y+d[1]));});});
}
function specialRoomPlan(r){
  var cells=[],dirs=[[1,0],[-1,0],[0,1],[0,-1]];
  for(var y=r.y;y<r.y+r.h;y++)for(var x=r.x;x<r.x+r.w;x++){var p=propAt(x,y);if(roomAt(x,y)===r&&at(x,y)===FLOOR&&!(p&&p.b))cells.push({x:x,y:y});}
  var available=new Map(cells.map(function(c){return [idxOf(c.x,c.y),c];})),groups=[],remaining=new Set(available.keys());
  while(remaining.size){var origin=remaining.values().next().value,q=[origin],group=[];remaining.delete(origin);
    for(var h=0;h<q.length;h++){var i=q[h];group.push(available.get(i));dirs.forEach(function(d){var j=idxOf(i%MW+d[0],Math.floor(i/MW)+d[1]);if(remaining.has(j)){remaining.delete(j);q.push(j);}});}groups.push(group);
  }
  cells=groups.sort(function(a,b){return b.length-a.length;})[0]||[];
  available=new Map(cells.map(function(c){return [idxOf(c.x,c.y),c];}));
  var mouths=cells.filter(function(c){return dirs.some(function(d){return roomAt(c.x+d[0],c.y+d[1])!==r&&(walkable(c.x+d[0],c.y+d[1])||isDoorish(at(c.x+d[0],c.y+d[1])));});});
  var hub=mouths[0]||cells[0],reserved=new Set();
  function depth(c){return mouths.length?Math.min.apply(null,mouths.map(function(m){return Math.abs(m.x-c.x)+Math.abs(m.y-c.y);})):dist(c,hub);}
  function route(from,to,perimeter,avoid){
    if(!from||!to)return [];
    var start=idxOf(from.x,from.y),goal=idxOf(to.x,to.y),cost=new Map([[start,0]]),parent=new Map(),pending=[start];
    while(pending.length){pending.sort(function(a,b){return cost.get(a)-cost.get(b);});var i=pending.shift();if(i===goal)break;
      dirs.forEach(function(d){var j=idxOf(i%MW+d[0],Math.floor(i/MW)+d[1]),c=available.get(j);if(!c||avoid&&avoid.has(j)&&j!==goal)return;
        var edge=dirs.some(function(o){return !available.has(idxOf(c.x+o[0],c.y+o[1]));}),n=cost.get(i)+(perimeter&&!edge?6:1);
        if(cost.has(j)&&cost.get(j)<=n)return;cost.set(j,n);parent.set(j,i);pending.push(j);
      });
    }
    if(!cost.has(goal))return [];var result=[goal];for(var step=goal;step!==start;){step=parent.get(step);result.push(step);}return result;
  }
  function reserve(c,perimeter){var path=route(hub,c,perimeter);path.forEach(function(i){reserved.add(i);});return path;}
  mouths.forEach(function(c){reserve(c);});
  function publish(){r.storageAisle=Array.from(reserved);}
  function furniture(c,name,extra){if(!c||reserved.has(idxOf(c.x,c.y))||!freeCell(c.x,c.y)||nearDoor(c.x,c.y)||((PROPS[name]||{}).b&&!roomFurnitureKeepsOpen(r,c,(PROPS[name]||{}).w,(PROPS[name]||{}).h)))return null;return addProp(c.x,c.y,name,extra);}
  return {cells:cells,mouths:mouths,hub:hub,reserved:reserved,depth:depth,reserve:reserve,path:route,publish:publish,furniture:furniture};
}
function cavernMerchantFloor(){
  if(!inCaverns()||floorMeta.boss)return -1;
  var event=mulberry32((rareRunSeed()^0x4D455243)>>>0);
  return event()<.30?11+Math.floor(event()*4):-1;
}
function swordStoneFloor(){
  if(bidx()!==0||floorMeta.plane||floorMeta.boss)return -1;
  var event=mulberry32((rareRunSeed()^0x53574F52)>>>0);
  return event()<.05?2+Math.floor(event()*3):-1;
}
function buildSwordStoneRoom(r){
  var plan=specialRoomPlan(r),cells=plan.cells.filter(function(c){
    if(!freeCell(c.x,c.y)||nearDoor(c.x,c.y)||plan.reserved.has(idxOf(c.x,c.y)))return false;
    var avoid=new Set([idxOf(c.x,c.y)]);
    return plan.cells.every(function(p){return p===c||plan.path(plan.hub,p,false,avoid).length>0;});
  }).sort(function(a,b){return dist(a,{x:r.cx,y:r.cy})-dist(b,{x:r.cx,y:r.cy});}),stone=cells[0];
  if(!stone){r.special='garden';return buildGardenRoom(r);}
  var blade=tierNormalize(Object.assign(clone(WEAPONS.sword),{key:'sword',tier:3,plus:3,enchant:'light',unid:false,cursed:false}));
  var prop=addProp(stone.x,stone.y,'sword-in-stone',{keep:true,b:1,br:1,burn:0,breakReward:{kind:'weapon',it:blade}});
  if(!prop){r.special='garden';return buildGardenRoom(r);}
  floorMeta.consecratedGround=floorMeta.consecratedGround||{};
  var field=[];plan.cells.forEach(function(c){if(dist(c,stone)>2)return;var i=idxOf(c.x,c.y);floorMeta.consecratedGround[i]={power:1,damage:3};field.push(i);if(c!==stone){plan.reserved.add(i);setG(c.x,c.y,G_MOSS);}});
  r.consecratedStone={x:stone.x,y:stone.y,radius:2,cells:field};
  plan.publish();
  plan.cells.filter(function(c){return dist(c,stone)>2;}).slice(0,4).forEach(function(c){plan.furniture(c,'torch-stand',{keep:true});});
}
function merchantStock(){
  var stock=[{item:{kind:'ring',it:makeRing(null,false)},price:5000},{item:{kind:'amulet',it:makeAmulet(null,false)},price:5000}],types=['weapon','armor','off'];
  types.forEach(function(kind){var gear;for(var n=0;n<100;n++){gear=rollEquipmentCandidate();if(gear.kind===kind)break;}gear.it.tier=3;gear.it.unid=false;gear.it.cursed=false;tierNormalize(gear.it);stock.push({item:gear,price:5000});});
  ELEMENTS.forEach(function(el){stock.push({item:{kind:'mote',el:el},price:100});});
  var groups=[SIGIL_ORDER.singles,SIGIL_ORDER.singles,SIGIL_ORDER.pairs,SIGIL_ORDER.plus,SIGIL_ORDER.triple,SIGIL_ORDER.grand],seen=new Set();
  groups.forEach(function(group){var candidates=group.filter(function(k){return SIGILS[k]&&!seen.has(k);});if(!candidates.length)candidates=Object.keys(SIGILS).filter(function(k){return !seen.has(k);});var key=pick(candidates);seen.add(key);stock.push({item:{kind:'sigil',use:key},price:2*sigilEssence(key)});});
  return stock;
}
function buildMerchantCamp(r){
  var plan=specialRoomPlan(r),cells=plan.cells.filter(function(c){return freeCell(c.x,c.y)&&!nearDoor(c.x,c.y)&&!plan.reserved.has(idxOf(c.x,c.y));}).sort(function(a,b){return plan.depth(b)-plan.depth(a);}),stall,vendor,approach;
  function clearAround(a,b){
    var blocked=new Set([idxOf(a.x,a.y),idxOf(b.x,b.y)]),open=new Set(plan.cells.map(function(c){return idxOf(c.x,c.y);})),q=[idxOf(plan.hub.x,plan.hub.y)],seen=new Set();
    for(var h=0;h<q.length;h++){var i=q[h];if(seen.has(i)||blocked.has(i))continue;seen.add(i);[[1,0],[-1,0],[0,1],[0,-1]].forEach(function(d){var j=idxOf(i%MW+d[0],Math.floor(i/MW)+d[1]);if(open.has(j)&&!blocked.has(j)&&!seen.has(j))q.push(j);});}
    return seen.size===open.size-2;
  }
  for(var n=0;n<cells.length&&!stall;n++)for(var j=0;j<cells.length&&!stall;j++)if(dist(cells[n],cells[j])===1&&clearAround(cells[n],cells[j])){
    var a=plan.cells.find(function(c){return dist(c,cells[n])===1&&dist(c,cells[j])>0&&freeCell(c.x,c.y);});if(a){stall=cells[n];vendor=cells[j];approach=a;}
  }
  if(!stall){r.special='storage';return buildStorageRoom(r,shuffled(edgeCells(r)));}
  var blocked=new Set([idxOf(stall.x,stall.y),idxOf(vendor.x,vendor.y)]);
  plan.path(plan.hub,approach,false,blocked).forEach(function(i){plan.reserved.add(i);});plan.reserved.add(idxOf(vendor.x,vendor.y));plan.publish();
  var table=addProp(stall.x,stall.y,'table-candle',{keep:true,merchantId:r.id});if(!table){r.special='storage';return buildStorageRoom(r,shuffled(edgeCells(r)));}
  r.merchant={stock:merchantStock(),stall:{x:stall.x,y:stall.y},vendorPost:vendor};r.merchantRoutes=Array.from(plan.reserved);
  var names=['kobold-campfire','kobold-crate','mushrooms'],placed=0;cells.forEach(function(c){if(placed<names.length&&dist(c,vendor)>0&&plan.furniture(c,names[placed],{keep:true}))placed++;});
}
function buildWatchpostRoom(r){
  r.barracks=true;r.residentKinds=['drowblade'];r.residentCount=8;r.residentState='wander';
  var plan=specialRoomPlan(r),cells=plan.cells.filter(function(c){return freeCell(c.x,c.y);}).sort(function(a,b){return plan.depth(b)-plan.depth(a);}),chest=cells.find(function(c){var main=plan.path(plan.hub,c);var flank=plan.path(plan.hub,c,true,new Set(main.slice(1,-1))),reserved=new Set(Array.from(plan.reserved).concat(main,flank));return main.length>2&&flank.length>0&&cells.some(function(p){return !reserved.has(idxOf(p.x,p.y))&&!nearDoor(p.x,p.y);});});
  if(!chest){r.special='barracks';r.residentKinds=null;r.residentCount=null;r.residentState=null;return buildBarracksRoom(r);}
  r.watchApproach=plan.reserve(chest);var flank=plan.path(plan.hub,chest,true,new Set(r.watchApproach.slice(1,-1)));flank.forEach(function(i){plan.reserved.add(i);});r.watchRoutes=Array.from(plan.reserved);r.watchFlank=flank.filter(function(i){return r.watchApproach.indexOf(i)<0;});plan.publish();
  setT(chest.x,chest.y,CHEST);chestKind[idxOf(chest.x,chest.y)]='crate-supply';r.supplyChest={x:chest.x,y:chest.y};
  var cover=[];cells.slice().sort(function(a,b){return dist(a,{x:r.cx,y:r.cy})-dist(b,{x:r.cx,y:r.cy});}).forEach(function(c){
    if(cover.length<2&&!cover.some(function(p){return dist(p,c)<2;})&&plan.furniture(c,'pillar',{pillar:true,keep:true}))cover.push(c);
  });
  r.watchCover=cover;r.residentPosts=[];
  cells.filter(function(c){return freeCell(c.x,c.y)&&!nearDoor(c.x,c.y)&&dist(c,chest)>1;}).sort(function(a,b){return (cover.length?Math.min.apply(null,cover.map(function(p){return dist(a,p);})):plan.depth(a))-(cover.length?Math.min.apply(null,cover.map(function(p){return dist(b,p);})):plan.depth(b));}).forEach(function(c){if(r.residentPosts.length<namedRoomPopulation(r,6,10)&&!r.residentPosts.some(function(p){return dist(p,c)<2;}))r.residentPosts.push(c);});
  var placed=0;cells.forEach(function(c){if(placed<2&&plan.furniture(c,placed?'weapon-rack':'crate'))placed++;});
}
// Named combat rooms concentrate their residents away from usable entrances.
function buildZooRoom(host){
  var size=Math.min(7,Math.max(4,Math.min(host.w,host.h))),pk=carvePocket(size,size,size,size,function(r){return r!==host;});
  if(!pk){host.special='storage';buildStorageRoom(host,shuffled(edgeCells(host)));return;}
  var r=pk.room;host.special=null;r.special='zoo';r.zoo=true;r.rareEvent='zoo';
  setT(pk.door.x,pk.door.y,LOCKED);floorMeta.vault=true;
  floorMeta.entrances=(floorMeta.entrances||[]).concat([pk.inside]);
  var cells=interiorCells(r).concat(edgeCells(r)).filter(function(c){return freeCell(c.x,c.y);});
  var chest=cells.pop();if(chest){setT(chest.x,chest.y,CHEST);chestKind[idxOf(chest.x,chest.y)]='chest-ornate';}
  if(cells.length){var c=cells[cells.length-1],gear=randomGear();gear.x=c.x;gear.y=c.y;items.push(gear,{x:c.x,y:c.y,kind:'mote',el:pick(ELEMENTS)});}
  var essenceCells=cells.filter(function(c){return freeCell(c.x,c.y);});
  for(var n=0;n<3&&essenceCells.length;){var rewardCell=essenceCells.pop();if(!freeCell(rewardCell.x,rewardCell.y))continue;items.push({x:rewardCell.x,y:rewardCell.y,kind:'essence',n:ri(15,30)});n++;}
  cells.forEach(function(c){setG(c.x,c.y,G_BONES);});setG(pk.inside.x,pk.inside.y,G_BONES);
  floorMeta.notes.push('An iron door confines a room packed with sleeping monsters.');
}
function namedRoomPopulation(r,min,max){
  return Math.min(max,Math.max(min,Math.floor(r.w*r.h/6)));
}
function namedRoomPosts(r,count,focus){
  var cells=interiorCells(r).concat(edgeCells(r)).filter(function(c){return roomAt(c.x,c.y)===r&&freeCell(c.x,c.y)&&!nearDoor(c.x,c.y);});
  cells.sort(function(a,b){return dist(a,focus||{x:r.cx,y:r.cy})-dist(b,focus||{x:r.cx,y:r.cy});});
  r.residentPosts=cells.slice(0,count).map(function(c){return {x:c.x,y:c.y};});
}
function buildNestRoom(r){
  var plan=specialRoomPlan(r);if(!plan.cells.length)return;
  r.nest=true;r.nestCount=floorNo<=2?4:namedRoomPopulation(r,6,10);
  var cells=plan.cells.slice().sort(function(a,b){return plan.depth(b)-plan.depth(a);}),focus=cells[0];
  var reward={kind:'essence',n:ri(10,20),x:focus.x,y:focus.y};items.push(reward);plan.reserve(focus);
  var food=cells.find(function(c){return dist(c,focus)===1;});if(food){items.push({kind:'food',food:'ration',x:food.x,y:food.y});plan.reserve(food);}
  var placed=0;cells.forEach(function(c){if(dist(c,focus)<=3){setG(c.x,c.y,G_BONES);if(placed<4&&plan.furniture(c,'bones',{keep:true}))placed++;}});
  plan.publish();namedRoomPosts(r,r.nestCount,focus);
}
function buildBarracksRoom(r){
  r.barracks=true;r.residentCount=namedRoomPopulation(r,6,10);var plan=specialRoomPlan(r);if(!plan.cells.length)return;
  var horizontal=r.w>=r.h,axis=horizontal?r.cy:r.cx;
  plan.cells.filter(function(c){return (horizontal?c.y:c.x)===axis;}).forEach(function(c){plan.reserve(c);});plan.publish();
  var edges=plan.cells.filter(function(c){return (horizontal?c.y===r.y||c.y===r.y+r.h-1:c.x===r.x||c.x===r.x+r.w-1);}).sort(function(a,b){return plan.depth(b)-plan.depth(a);});
  var names=['weapon-rack','table-candle','crate','barrel'],placed=0;
  edges.concat(plan.cells).forEach(function(c){if(placed<names.length&&plan.furniture(c,names[placed]))placed++;});
  var posts=plan.cells.filter(function(c){return freeCell(c.x,c.y)&&!nearDoor(c.x,c.y);}).sort(function(a,b){return plan.depth(b)-plan.depth(a);});
  r.residentPosts=[];posts.forEach(function(c){if(r.residentPosts.length<namedRoomPopulation(r,6,10)&&!r.residentPosts.some(function(p){return dist(p,c)<2;}))r.residentPosts.push({x:c.x,y:c.y});});
}
function buildTreasuryRoom(r){
  var plan=specialRoomPlan(r);if(!plan.cells.length)return;
  var prizes=plan.cells.filter(function(c){return freeCell(c.x,c.y);}).sort(function(a,b){return plan.depth(b)-plan.depth(a);}),chest=prizes[0];if(!chest)return;plan.reserve(chest);
  setT(chest.x,chest.y,CHEST);chestKind[idxOf(chest.x,chest.y)]='chest-ornate';
  r.guardAt=nearFreeRoomCell(r,chest);
  var rewardCells=prizes.filter(function(c){return freeCell(c.x,c.y)&&!(r.guardAt&&dist(c,r.guardAt)===0);}),rewards=[randomGear(),{kind:'essence',n:ri(20,35)}];
  rewards.forEach(function(it,n){var c=rewardCells[n];if(c){it.x=c.x;it.y=c.y;items.push(it);plan.reserve(c);}});
  if(r.guardAt)plan.reserve(r.guardAt);plan.publish();
  if(floorNo>=3){r.namedGuardCount=namedRoomPopulation(r,3,6);namedRoomPosts(r,r.namedGuardCount,chest);}
  var placed=0;prizes.forEach(function(c){if(placed<2&&plan.furniture(c,'torch-stand'))placed++;});
}
function buildTrapRoom(r){
  r.trapRoom=true;var plan=specialRoomPlan(r);if(!plan.cells.length)return;
  var prizes=plan.cells.filter(function(c){return freeCell(c.x,c.y);}).sort(function(a,b){return plan.depth(b)-plan.depth(a);}),chest=prizes[0];if(!chest)return;
  plan.reserve(chest,true);plan.publish();r.trapBypass=Array.from(plan.reserved);
  setT(chest.x,chest.y,CHEST);chestKind[idxOf(chest.x,chest.y)]=floorNo>=3?'chest-ornate':'chest-iron';
  var kinds=Object.keys(TRAPS).filter(function(k){return TRAPS[k].minFloor<=floorNo&&k!=='teleport'&&(k!=='pit'||!(floorMeta.boss||floorNo%5===0));});

  var reward=prizes.find(function(c){return freeCell(c.x,c.y)&&!plan.reserved.has(idxOf(c.x,c.y));})||prizes.find(function(c){return freeCell(c.x,c.y);});
  if(reward){items.push({x:reward.x,y:reward.y,kind:'essence',n:ri(15,30)});plan.reserve(reward,true);}
  plan.publish();r.trapBypass=Array.from(plan.reserved);
  var trapCells=shuffled(plan.cells.filter(function(c){return at(c.x,c.y)===FLOOR&&!nearDoor(c.x,c.y)&&!propAt(c.x,c.y)&&!plan.reserved.has(idxOf(c.x,c.y))&&!feats.some(function(f){return f.x===c.x&&f.y===c.y;});}));
  var trapCount=Math.min(trapCells.length,Math.max(6,Math.ceil(trapCells.length*.6)));
  if(kinds.length)trapCells.slice(0,trapCount).forEach(function(c,n){feats.push({x:c.x,y:c.y,kind:pick(kinds),found:n%3!==2,room:true});});
  r.authoredTrapCount=kinds.length?trapCount:0;
  // Scorch and bones suggest the risky shortcut, without marking every trap.
  shuffled(plan.cells.filter(function(c){return at(c.x,c.y)===FLOOR&&!plan.reserved.has(idxOf(c.x,c.y));})).slice(0,3).forEach(function(c){setG(c.x,c.y,rng()<.5?G_SCORCH:G_BONES);});
}
function buildGardenRoom(r){
  var plan=specialRoomPlan(r);if(!plan.cells.length)return;
  var pond=plan.cells.filter(function(c){return freeCell(c.x,c.y)&&!plan.reserved.has(idxOf(c.x,c.y));}).sort(function(a,b){return plan.depth(b)-plan.depth(a);})[0];
  if(pond){setT(pond.x,pond.y,WATER);setG(pond.x,pond.y,0);r.gardenPond={x:pond.x,y:pond.y};}
  var food=plan.cells.filter(function(c){return freeCell(c.x,c.y);}).sort(function(a,b){return (pond?dist(a,pond)-dist(b,pond):plan.depth(b)-plan.depth(a));})[0];
  if(rng()<.5&&food){items.push({x:food.x,y:food.y,kind:'food',food:randomFood()});plan.reserve(food);}
  plan.publish();
  plan.cells.forEach(function(c){if(at(c.x,c.y)===FLOOR&&!plan.reserved.has(idxOf(c.x,c.y))&&(pond?dist(c,pond)<=3:true)&&rng()<.65)setG(c.x,c.y,G_GRASS);});
  var names=['mushrooms','vines','mushrooms','vines'],limit=ri(2,4),placed=0;
  plan.cells.slice().sort(function(a,b){return (pond?dist(a,pond)-dist(b,pond):plan.depth(b)-plan.depth(a));}).forEach(function(c){if(placed<limit&&plan.furniture(c,names[placed]))placed++;});
}
function buildStatueRoom(r){
  r.statues=true;var plan=specialRoomPlan(r);if(!plan.cells.length)return;
  var horizontal=r.w>=r.h,axis=horizontal?r.cy:r.cx;
  plan.cells.filter(function(c){return (horizontal?c.y:c.x)===axis;}).forEach(function(c){plan.reserve(c);});
  var reward=plan.cells.filter(function(c){return freeCell(c.x,c.y);}).sort(function(a,b){return plan.depth(b)-plan.depth(a);})[0];
  if(reward){items.push({x:reward.x,y:reward.y,kind:'essence',n:ri(15,25)});plan.reserve(reward);}plan.publish();
  var limit=Math.min(4,Math.floor(interiorCells(r).length/3)),placed=[];
  plan.cells.slice().sort(function(a,b){return Math.abs((horizontal?a.y:a.x)-axis)-Math.abs((horizontal?b.y:b.x)-axis)||plan.depth(b)-plan.depth(a);}).forEach(function(c){
    if(placed.length<limit&&!placed.some(function(p){return dist(p,c)<2;})&&plan.furniture(c,placed.length===1?'statue-broken':'statue'))placed.push(c);
  });
}
function buildRitualRoom(r){
  FoteChaosEnemyArt.ensureAssets(['m-chaos-horned-reaver','m-chaos-gorehound']).catch(function(error){console.error(error);});
  var plan=specialRoomPlan(r),cells=plan.cells.filter(function(c){return freeCell(c.x,c.y)&&!nearDoor(c.x,c.y);}).sort(function(a,b){return plan.depth(b)-plan.depth(a);});
  var captive=cells.find(function(c){return cells.some(function(a){return Math.abs(a.x-c.x)+Math.abs(a.y-c.y)===1;});});
  if(!captive)return;
  var approach=cells.find(function(c){return Math.abs(c.x-captive.x)+Math.abs(c.y-captive.y)===1;});
  plan.reserve(approach);plan.publish();
  var cage=addProp(captive.x,captive.y,'cage',{keep:true,prisoner:'goblin',prisonerOutcome:'escapee',ritual:true,captiveHp:24,captiveMaxhp:24});
  if(!cage)return;
  r.ritual={cage:{x:cage.x,y:cage.y},hp:24,maxhp:24,active:false,finished:false,cells:plan.cells,mouths:plan.mouths};
  var altar=cells.find(function(c){return dist(c,captive)>=2&&dist(c,captive)<=4&&freeCell(c.x,c.y)&&freeCell(c.x+1,c.y)&&roomAt(c.x+1,c.y)===r&&!plan.reserved.has(idxOf(c.x,c.y))&&!plan.reserved.has(idxOf(c.x+1,c.y))&&roomFurnitureKeepsOpen(r,c,2,1);});
  if(altar)addSetPiece(altar.x,altar.y,'drow-altar-blood',2,1,{keep:true,ritualAltar:true,altar:true});
  var post=cells.filter(function(c){return freeCell(c.x,c.y)&&dist(c,approach)>1;}).sort(function(a,b){return dist(a,altar||captive)-dist(b,altar||captive);})[0];
  if(post){r.ritual.priestPost=post;plan.reserve(post);}
  var chest=cells.find(function(c){return freeCell(c.x,c.y)&&dist(c,captive)>1&&!(post&&dist(c,post)===0);});
  if(chest){plan.reserve(chest);setT(chest.x,chest.y,CHEST);chestKind[idxOf(chest.x,chest.y)]='chest-gold';r.enhancedChest={x:chest.x,y:chest.y};}
  plan.publish();
  cells.forEach(function(c){if(at(c.x,c.y)===FLOOR&&dist(c,captive)<=3)setG(c.x,c.y,G_SCORCH);});
  var placed=0;cells.forEach(function(c){if(placed<2&&plan.furniture(c,'brazier-lit'))placed++;});
}
function ritualPriestAvailable(e){return !!(e&&e.hp>0&&!e.ally&&!e.tomb&&!['stun','frozen','stone','fear','silence'].some(function(tag){return gameEffects.hasTag(e,tag);}));}
function ritualChannel(e){
  var r=rooms.find(function(r){return r.ritual&&r.ritual.priestId===e.id&&!r.ritual.finished;});
  if(!r||!ritualPriestAvailable(e))return false;
  if(r.ritual.priestPost&&dist(e,r.ritual.priestPost)>0){stepToward(e,r.ritual.priestPost.x,r.ritual.priestPost.y);return true;}
  return true;
}
function turnRitualRooms(clock){
  rooms.forEach(function(r){var z=r.ritual;if(!z||z.finished||z.lastPulse===clock)return;z.lastPulse=clock;
    var cage=propAt(z.cage.x,z.cage.y),priest=ents.find(function(e){return e.id===z.priestId&&e.hp>0;});
    if(!cage||!cage.prisoner){z.finished=true;z.outcome='rescued';return;}
    if(!priest||priest.ally){z.finished=true;z.outcome='interrupted';if(z.active)log('The ritual breaks. The captive is still alive.','c-good');return;}
    if(!z.active){if(vis[idxOf(cage.x,cage.y)]||vis[idxOf(priest.x,priest.y)]){z.active=true;priest.state='hunt';log('A priestess draws blood from a captive. The ritual has begun.','c-you');}return;}
    if(!ritualPriestAvailable(priest)||dist(priest,z.priestPost)>0)return;
    z.hp=Math.max(0,z.hp-2);cage.captiveHp=z.hp;floatText(cage.x,cage.y,'-2','blood');
    if(z.hp>0)return;
    cage.prisoner=null;z.finished=true;z.outcome='summoned';floorMeta.ritualChaos=true;
    var candidates=shuffled(z.cells).filter(function(c){return freeCell(c.x,c.y)&&walkable(c.x,c.y)&&dist(c,player)>1&&!nearDoor(c.x,c.y)&&!z.mouths.some(function(m){return dist(c,m)<=1;});});
    ['chaos-horned-reaver','chaos-gorehound'].forEach(function(kind){var c=candidates.shift();if(!c)return;var e=FoteChaosEnemies.spawn(kind,c.x,c.y,{state:'hunt'});if(e){e.lastSeen={x:player.x,y:player.y};e.t=clock+100;}});
    log('The captive falls. A Horned Reaver and Gorehound tear through the ritual!','c-you');sfx('portal',{from:cage});
  });
}
function buildCavernCacheRoom(kind,r){
  var plan=specialRoomPlan(r),cells=plan.cells.filter(function(c){return freeCell(c.x,c.y);}).sort(function(a,b){return plan.depth(b)-plan.depth(a);}),chest=cells[0];
  if(!chest)return;
  plan.reserve(chest,true);plan.publish();
  setT(chest.x,chest.y,CHEST);chestKind[idxOf(chest.x,chest.y)]='chest-gold';
  r.cacheChest={x:chest.x,y:chest.y};
  r.chestAmbush={theme:kind,chest:{x:chest.x,y:chest.y},fired:false,cells:plan.cells.map(function(c){return {x:c.x,y:c.y};}),mouths:plan.mouths.map(function(c){return {x:c.x,y:c.y};})};
  if(kind==='flooded-cache'){
    plan.cells.forEach(function(c){if(freeCell(c.x,c.y)&&!plan.reserved.has(idxOf(c.x,c.y))&&!nearDoor(c.x,c.y)){setT(c.x,c.y,WATER);setG(c.x,c.y,0);}});
    cells.forEach(function(c){if(at(c.x,c.y)===FLOOR&&plan.depth(c)>2)plan.furniture(c,'kobold-crate');});
  }else{
    var placed=0;
    cells.forEach(function(c){
      if(placed<3&&plan.furniture(c,kind==='myconid-nursery'?'mushrooms':'rubble'))placed++;
      if(at(c.x,c.y)===FLOOR&&!propAt(c.x,c.y))setG(c.x,c.y,kind==='myconid-nursery'?G_GRASS:G_BONES);
    });
  }
}
function buildGoblinMine(r){
  if(floorMeta.boss||floorNo%5===0)return;
  var plan=specialRoomPlan(r),cells=plan.cells.filter(function(c){return freeCell(c.x,c.y);}).sort(function(a,b){return plan.depth(b)-plan.depth(a);}),chest=cells[0];
  if(!chest)return;
  plan.reserve(chest,true);plan.publish();
  setT(chest.x,chest.y,CHEST);chestKind[idxOf(chest.x,chest.y)]='chest-gold';
  r.chestAmbush={theme:'goblin-mine',chest:{x:chest.x,y:chest.y},fired:false,roster:['skeleton'],cells:cells.map(function(c){return {x:c.x,y:c.y};}),mouths:plan.mouths};
  cells.filter(function(c){return dist(c,chest)>1&&!nearDoor(c.x,c.y);}).slice(0,3).forEach(function(c){plan.reserve(c);});
  var furniture=['mine-cart','kobold-pickaxe','kobold-pickaxe','kobold-campfire'];
  cells.forEach(function(c){if(furniture.length&&plan.furniture(c,furniture[0],{keep:true}))furniture.shift();});
  r.trapBypass=Array.from(plan.reserved);
  plan.cells.forEach(function(c){if(freeCell(c.x,c.y)&&!nearDoor(c.x,c.y)&&!plan.reserved.has(idxOf(c.x,c.y)))feats.push({x:c.x,y:c.y,kind:'pit',found:false,room:true});});
  // Retain trap-free landing space for the skeleton, without exposing the pits.
  var landing=plan.cells.find(function(c){return plan.reserved.has(idxOf(c.x,c.y))&&freeCell(c.x,c.y)&&dist(c,chest)>1&&!nearDoor(c.x,c.y);});
  if(landing)r.chestAmbush.cells=[{x:landing.x,y:landing.y}].concat(r.chestAmbush.cells);
  plan.publish();floorMeta.notes.push('An abandoned goblin mine lies ahead. Mining gear surrounds a fire pit; the ground is unstable.');
}
var BONE_VAULT_GROUPS=[
  null,
  [['burrower','burrower','crystalgolem'],['burrower','burrower','mosstroll'],['dawnsentinel','dawnsentinel','halowisp'],['prismscarab','prismscarab','dawnsentinel'],['stalker','stalker','gloommoth'],['umbralhound','umbralhound','stalker']],
  [['cinderimp','cinderimp','magmacrawler'],['flamedancer','flamedancer','cinderimp'],['drownedone','drownedone','siren'],['tidecrab','tidecrab','drownedone'],['stormhawk','stormhawk','thundertotem'],['windwisp','windwisp','stormhawk']],
  [['drowpriestess','drider','drowblade','thoughteater']]
];
function buildBoneVault(r){
  var plan=specialRoomPlan(r),cells=plan.cells.filter(function(c){return freeCell(c.x,c.y);}).sort(function(a,b){return plan.depth(b)-plan.depth(a);});
  if(cells.length<8)return;
  var chest=cells[0],biome=bidx(),roster=biome===0?[pick(CAVE_ELEMENT_TIERS).kind,pick(CAVE_ELEMENT_TIERS).kind,pick(CAVE_ELEMENT_TIERS).kind]:pick(BONE_VAULT_GROUPS[biome]).slice();
  setT(chest.x,chest.y,CHEST);chestKind[idxOf(chest.x,chest.y)]='chest-gold';
  r.chestAmbush={theme:'bone-vault',chest:{x:chest.x,y:chest.y},fired:false,roster:roster,enhanced:true,cells:cells.map(function(c){return {x:c.x,y:c.y};}),mouths:plan.mouths};
  cells.forEach(function(c){if(at(c.x,c.y)===FLOOR)setG(c.x,c.y,G_BONES);plan.reserved.add(idxOf(c.x,c.y));});plan.publish();
}
function buildGreedyVault(r){
  var plan=specialRoomPlan(r),cells=plan.cells.filter(function(c){return freeCell(c.x,c.y);}).sort(function(a,b){return plan.depth(b)-plan.depth(a);});
  if(cells.length<8)return;
  var first={x:r.cx-1,y:r.cy},second={x:r.cx+1,y:r.cy};if(!freeCell(first.x,first.y)||!freeCell(second.x,second.y))return;
  r.greedyVault={chests:[{x:first.x,y:first.y},{x:second.x,y:second.y}],opened:[],collapsed:false};
  r.rareEvent='greedy-vault'; // Keep incidental monsters and dressing out of the authored room.
  r.greedyVault.chests.forEach(function(c){setT(c.x,c.y,CHEST);chestKind[idxOf(c.x,c.y)]='chest-gold';plan.reserve(c);});
  cells.forEach(function(c){plan.reserved.add(idxOf(c.x,c.y));});plan.publish();
}
function openGreedyVaultChest(x,y){
  var r=rooms.find(function(r){return r.greedyVault&&r.greedyVault.chests.some(function(c){return c.x===x&&c.y===y;});});if(!r)return;
  var v=r.greedyVault,index=v.chests.findIndex(function(c){return c.x===x&&c.y===y;});
  if(v.opened.indexOf(index)>=0)return;v.opened.push(index);
  if(v.opened.length===1)log('The vault trembles. The other chest remains.','c-info');
}
function prepareGreedyVaultChest(x,y){
  var r=rooms.find(function(r){return r.greedyVault&&r.greedyVault.chests.some(function(c){return c.x===x&&c.y===y;});});if(!r)return true;
  var v=r.greedyVault,index=v.chests.findIndex(function(c){return c.x===x&&c.y===y;});
  if(v.opened.length!==1||v.opened.indexOf(index)>=0||v.collapsed)return true;
  v.collapsed=true;
  /* Keep a one-cell bypass inside the existing room walls. The interior still
   * collapses around the two chest platforms, including water and the center. */
  for(var cy=r.y;cy<r.y+r.h;cy++)for(var cx=r.x;cx<r.x+r.w;cx++){
    var tile=at(cx,cy),edge=cx===r.x||cx===r.x+r.w-1||cy===r.y||cy===r.y+r.h-1;
    if((tile===FLOOR||tile===WATER)&&!propAt(cx,cy)&&!edge&&!v.chests.some(function(p){return p.x===cx&&p.y===cy;})){setT(cx,cy,CHASM);setG(cx,cy,0);}
  }
  log('You reach for the second chest. The floor around the chest platforms collapses!','c-you');
  if(roomAt(player.x,player.y)===r&&at(player.x,player.y)===CHASM&&!(player.levitate>0)&&!player.windCarry)fallIntoChasm();
  else{sfx('crate-break',{from:{x:x,y:y}});computeFOV();draw();return true;}
  return false;
}
function enhancedChestAt(x,y){return rooms.find(function(r){var a=r.chestAmbush,c=r.enhancedChest;return c&&c.x===x&&c.y===y||a&&a.enhanced&&a.chest.x===x&&a.chest.y===y;});}
function buildBoneGauntlet(host){
  var pk=carvePocket(5,5,5,5,function(r){return r!==host;});if(!pk){host.special='storage';buildStorageRoom(host,shuffled(edgeCells(host)));return;}
  host.special=null;var r=pk.room;r.special='bone-gauntlet';r.rareEvent='bone-gauntlet';setT(pk.door.x,pk.door.y,DOOR);
  var horizontal=pk.door.x<r.x||pk.door.x>=r.x+r.w,forward=horizontal?(pk.door.x<r.x?1:-1):(pk.door.y<r.y?1:-1);
  function cell(depth,across){return horizontal?{x:forward>0?r.x+depth:r.x+r.w-1-depth,y:r.y+across}:{x:r.x+across,y:forward>0?r.y+depth:r.y+r.h-1-depth};}
  var chest=cell(4,2),plan=specialRoomPlan(r),cells=plan.cells;
  cells.forEach(function(c){setG(c.x,c.y,G_BONES);plan.reserved.add(idxOf(c.x,c.y));});plan.publish();
  for(var depth=1;depth<=3;depth++)for(var across=0;across<5;across++){var c=cell(depth,across);feats.push({x:c.x,y:c.y,kind:'spikes',found:false,room:r.id});}
  setT(chest.x,chest.y,CHEST);chestKind[idxOf(chest.x,chest.y)]='chest-gold';
  host.special=null;
  r.chestAmbush={theme:'bone-gauntlet',chest:chest,fired:false,roster:['shade','shade','acolyte','acolyte'],enhanced:true,cells:cells,mouths:plan.mouths,posts:[cell(4,0),cell(4,4),cell(0,0),cell(0,4)]};
  floorMeta.entrances=(floorMeta.entrances||[]).concat([pk.inside]);
}
function releaseChestAmbush(x,y){
  var r=rooms.find(function(r){var a=r.chestAmbush;return a&&!a.fired&&a.chest.x===x&&a.chest.y===y;});
  if(!r)return 0;
  var a=r.chestAmbush;a.fired=true;
  var cells=shuffled(a.cells).filter(function(c){return freeCell(c.x,c.y)&&walkable(c.x,c.y)&&!occupied(c.x,c.y)&&dist(c,player)>1&&!nearDoor(c.x,c.y)&&!a.mouths.some(function(m){return dist(c,m)<=1;});});
  var flooded=a.theme==='flooded-cache',roster=a.roster||(flooded?['drownedone','rootbound','rootbound']:null);
  if(a.posts){
    var chosen=[];a.posts.forEach(function(post){var available=a.cells.filter(function(c){return freeCell(c.x,c.y)&&walkable(c.x,c.y)&&!occupied(c.x,c.y)&&!chosen.some(function(p){return p.x===c.x&&p.y===c.y;});}).sort(function(p,q){return dist(p,post)-dist(q,post);});if(available.length)chosen.push(available[0]);});cells=chosen;
  }
  if(a.roster&&cells.length<roster.length){var more=shuffled(a.cells).filter(function(c){return freeCell(c.x,c.y)&&walkable(c.x,c.y)&&!occupied(c.x,c.y)&&dist(c,player)>0&&!nearDoor(c.x,c.y)&&!cells.some(function(p){return p.x===c.x&&p.y===c.y;});});cells=cells.concat(more);}
  var count=roster?Math.min(roster.length,cells.length):Math.min(9,3+floorNo+Math.floor(r.w*r.h/16),cells.length),spawned=0;
  for(var i=0;i<count;i++){
    var c=cells[i];if(occupied(c.x,c.y))continue;
    var m=spawn(roster?roster[i]:a.theme==='beetle-nest'?'stormbeetle':i%3===2?'shroomling':'myconid',c.x,c.y,a.roster?{skipDeep:true}:undefined);
    if((a.roster||flooded)&&!a.posts)m.planeEncounter=true;
    m.state='hunt';m.lastSeen={x:player.x,y:player.y};m.t=player.t+100;spawned++;
  }
  if(spawned)log(a.theme==='bone-gauntlet'?'Two wraiths rise beside the treasure. Two acolytes appear at the entrance!':a.theme==='goblin-mine'?'A skeleton rises from the abandoned mine!':a.roster?'The bones stir. Guardians appear around the opened chest!':flooded?'The flooded cache stirs. A Drowned One and Root-bound rise to defend it!':a.theme==='beetle-nest'?'Beetles pour from the nest!':'The nursery stirs. Myconids close in!','c-you');
  return spawned;
}
function buildElementalRoom(element,r){
  var plan=specialRoomPlan(r),theme=PLANE_PROPS[element],tier=bidx()<2?1:bidx(),kind=ELEMENTAL_ROOM_KINDS[element][tier-1];
  r.elementalRoom={element:element,tier:tier};
  r.barracks=true;r.residentKinds=[kind,kind,kind];r.residentCount=3;r.residentState='asleep';
  var cells=plan.cells.slice().sort(function(a,b){return plan.depth(b)-plan.depth(a);}),chest=cells.find(function(c){return freeCell(c.x,c.y)&&!nearDoor(c.x,c.y)&&!plan.reserved.has(idxOf(c.x,c.y));});
  if(chest){plan.reserve(chest);setT(chest.x,chest.y,CHEST);chestKind[idxOf(chest.x,chest.y)]='chest-wood';}
  var posts=cells.filter(function(c){return freeCell(c.x,c.y)&&!nearDoor(c.x,c.y);}).slice(0,3);
  r.residentPosts=posts;posts.forEach(function(c){plan.reserve(c);});
  var decor=cells.filter(function(c){return freeCell(c.x,c.y)&&!plan.reserved.has(idxOf(c.x,c.y));}),rune=decor.shift();
  if(rune)plan.furniture(rune,theme.rune,{keep:true});
  decor.slice(0,Math.min(8,Math.max(3,Math.floor(cells.length/5)))).forEach(function(c,i){plan.furniture(c,i===0?theme.light:theme.decor[i%theme.decor.length],{keep:true});});
  if(element==='earth')cells.forEach(function(c){if(at(c.x,c.y)===FLOOR&&!gAt(c.x,c.y))setG(c.x,c.y,G_MOSS);});
  plan.publish();floorMeta.notes.push(element[0].toUpperCase()+element.slice(1)+' sanctuary: three tier '+tier+' elementalings guard a chest.');
}
function buildDefaultSpecial(kind, r){
  r.special=kind;
  var e=shuffled(edgeCells(r)), inner=shuffled(interiorCells(r)), i;
  function place(list, names, n, extra){ for(var k=0;k<n && list.length;){ var c=list.pop(); if(freeCell(c.x,c.y)&&addProp(c.x,c.y,names[k%names.length],extra))k++; } }
  function put(it){ var c;while(inner.length||e.length){c=inner.pop()||e.pop();if(freeCell(c.x,c.y))break;c=null;}if(!c)return;it.x=c.x;it.y=c.y;items.push(it); }
  if(/^elemental-(fire|water|air|earth|shadow|light)$/.test(kind)){
    buildElementalRoom(kind.slice(10),r);
  } else if(['portcullis-cache','funeral-bell','crystal-resonance','silk-survivor'].includes(kind)){
    buildUncommonEvent(kind,r);
  } else if(kind==='adventurer-camp'){
    buildAdventurerCamp(r);
  } else if(kind==='ruined-treasury'){
    buildRuinedTreasury(r);
  } else if(kind==='harvester-camp'){
    buildHarvesterCamp(r);
  } else if(kind==='survey-camp'){
    buildSurveyCamp(r);
  } else if(kind==='heroes-tomb'){
    buildHeroesTomb(r);
  } else if(kind==='goblin-mine'){
    buildGoblinMine(r);
  } else if(kind==='greedy-vault'){
    buildGreedyVault(r);
  } else if(kind==='bone-vault'){
    buildBoneVault(r);
  } else if(kind==='bone-gauntlet'){
    buildBoneGauntlet(r);
  } else if(['hungry-spider','sealed-lamp','dark-wizard-library','volatile-hoard','drider-lair'].includes(kind)){
    buildUniqueRareRoom(kind,r);
  } else if(kind==='sword-in-stone'){
    buildSwordStoneRoom(r);
  } else if(kind==='merchant'){
    buildMerchantCamp(r);
  } else if(kind==='watchpost'){
    buildWatchpostRoom(r);
  } else if(kind==='ritual'){
    buildRitualRoom(r);
  } else if(kind==='flooded-cache'||kind==='myconid-nursery'||kind==='beetle-nest'){
    buildCavernCacheRoom(kind,r);
  } else if(kind==='garden'){
    buildGardenRoom(r);
  } else if(kind==='storage'){
    buildStorageRoom(r,e);
  } else if(kind==='library'){
    buildLibraryRoom(r);
  } else if(kind==='armory'){
    buildArmoryRoom(r);
  } else if(kind==='nest'){
    buildNestRoom(r);
  } else if(kind==='prison'){
    buildPrisonRoom(r);
  } else if(kind==='zoo'){
    buildZooRoom(r);
  } else if(kind==='sacrifice'){
    addProp(r.cx,r.cy,'altar-spikes',{keep:true});
    altars[idxOf(r.cx,r.cy)]={passes:0};
    place(e,['brazier-lit','chains','brazier-lit'],3);
  } else if(kind==='statues'){
    buildStatueRoom(r);
  } else if(kind==='treasury'){
    buildTreasuryRoom(r);
  } else if(kind==='barracks'){
    buildBarracksRoom(r);
  } else if(kind==='traps'){
    buildTrapRoom(r);
  } else if(kind==='dark'){
    r.dark=true;
    var dc=inner.pop(); if(dc){ setT(dc.x,dc.y,CHEST); chestKind[idxOf(dc.x,dc.y)]='chest-crystal'; }
    put({kind:'essence',n:ri(15,25)});
    floorMeta.notes.push('One room swallows light. Only Light or Fire affinity cuts through it.');
  }
}
function nearFreeRoomCell(r, p){
  var nb=[[1,0],[-1,0],[0,1],[0,-1]]; for(var i=0;i<4;i++){ var x=p.x+nb[i][0], y=p.y+nb[i][1]; if(at(x,y)===FLOOR && roomAt(x,y)===r && !propAt(x,y)) return {x:x,y:y}; } return null;
}
function populateRoomResidents(){
  rooms.forEach(function(r){
    rareRoomResidents(r);
    var cells=shuffled(interiorCells(r).concat(edgeCells(r))).filter(function(p){ return roomAt(p.x,p.y)===r&&walkable(p.x,p.y) && !occupied(p.x,p.y); });
    var posts=(r.residentPosts||[]).slice();
    function sp(kind, state){ var c;while(posts.length&&!c){var post=posts.shift();if(walkable(post.x,post.y)&&!occupied(post.x,post.y))c=post;}while(!c&&cells.length){var next=cells.pop();if(walkable(next.x,next.y)&&!occupied(next.x,next.y))c=next;}if(!c)return null;var m=spawn(kind,c.x,c.y,{skipDeep:!!r.residentKinds});m.state=state||'asleep';return m; }
    if(r.merchant){var post=r.merchant.vendorPost;if(post&&walkable(post.x,post.y)&&!occupied(post.x,post.y)&&!propAt(post.x,post.y)){var trader=spawnRaw('myconid',post.x,post.y);trader.name='Myconid Merchant';trader.state='idle';trader.foe=false;trader.ally=false;trader.noXp=true;trader.noLoot=true;trader.base=Object.assign({},trader.base,{object:true,sprite:'m-myconid-merchant'});trader.merchantRoom=r.id;r.merchant.vendorId=trader.id;}}
    if(r.ritual){
      var post=r.ritual.priestPost;
      if(post&&(!walkable(post.x,post.y)||occupied(post.x,post.y)||propAt(post.x,post.y)))post=r.ritual.cells.filter(function(c){return walkable(c.x,c.y)&&!occupied(c.x,c.y)&&!propAt(c.x,c.y);}).sort(function(a,b){return dist(a,r.ritual.priestPost)-dist(b,r.ritual.priestPost);})[0];
      if(post){r.ritual.priestPost=post;var priest=deepSpawnRaw('drowpriestess',post.x,post.y);priest.state='asleep';priest.guard=true;r.ritual.priestId=priest.id;}
      for(var n=0;n<2;n++){var blade=sp('drowblade');if(blade)blade.guard=true;}
    }
    if(r.zoo){var zooCells=[];for(var zy=r.y;zy<r.y+r.h;zy++)for(var zx=r.x;zx<r.x+r.w;zx++)if(roomAt(zx,zy)===r&&walkable(zx,zy)&&!occupied(zx,zy))zooCells.push({x:zx,y:zy});zooCells.forEach(function(c){var resident=spawn(rollMonster(),c.x,c.y);resident.state='asleep';});}
    if(r.nest){ for(var j=0,n=r.nestCount||4;j<n;j++) sp('rat'); }
    if(r.barracks){var band=r.residentKinds||['goblin','goblin','archer'];for(var k=0,n=r.residentCount||namedRoomPopulation(r,6,10);k<n;k++){var resident=sp(r.residentKinds?band[k%band.length]:pick(band),r.residentState);if(resident&&r.residentKinds)resident.guard=true;}}
    if(r.namedGuardCount){for(var ng=0;ng<r.namedGuardCount;ng++){var guard=sp(pick(['goblin','archer']));if(guard)guard.guard=true;}}
    if(r.guardAt){
      var post=r.guardAt;
      if(!walkable(post.x,post.y)||occupied(post.x,post.y))post=cells.filter(function(c){return walkable(c.x,c.y)&&!occupied(c.x,c.y);}).sort(function(a,b){return dist(a,r.guardAt)-dist(b,r.guardAt);})[0];
      if(post){var g=spawn('brute',post.x,post.y);g.state='asleep';g.name='Vault Guardian';g.elite=true;g.maxhp=g.hp=Math.round(g.hp*1.4);}
    }
    if(r.dark){ for(var d=0;d<2;d++) sp(pick(['goblin','bat'])); }
    if(r.role==='boss'){
      var boss=spawn('warchief', floorMeta.bossAt.x, floorMeta.bossAt.y); boss.state='throne'; boss.elite=true; floorMeta.bossId=boss.id;
      for(var q=0;q<2;q++){ var gd=sp('goblin','asleep'); if(gd) gd.guard=true; }
      var ar=sp('archer','asleep'); if(ar) ar.guard=true;
    }
  });
}
function buildDungeonBossRoom(r){
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
  var pool=deepMobsOn()?deepPool(-1):[];
  if(!pool.length)pool=caveRoster();
  if(!pool.length){
    for(var k in MONSTERS){var b=MONSTERS[k];if(b.rare||!b.w)continue;if(floorNo<b.band[0]||floorNo>b.band[1])continue;pool.push([k,b.w]);}
  }
  return weightedMonster(pool);
}
function weightedMonster(pool){
  var tot=0,i; for(i=0;i<pool.length;i++) tot+=pool[i][1];
  var r=rng()*tot; for(i=0;i<pool.length;i++){ r-=pool[i][1]; if(r<=0) return pool[i][0]; }
  return pool.length ? pool[pool.length-1][0] : 'rat';
}
function rollRare(){
  var out=[]; for(var k in MONSTERS){ var b=MONSTERS[k]; if(b.rare && floorNo>=b.band[0] && floorNo<=b.band[1]) out.push(k); }
  return out.length ? pick(out) : null;
}
function spawnRaw(kind,x,y,options){
  options=options||{};
  var b=options.base||MONSTERS[kind];
  /* Creature stats come from the content table; depth selects the roster. */
  var e={id:nextId++, kind:kind, name:b.name, ch:b.ch, col:b.col, x:x, y:y,
         hp:sHP(b.hp), maxhp:sHP(b.hp), base:b, t:(typeof player!=='undefined' && player && player.t) ? player.t : 0, state:'asleep', st:{}, foe:true,
         dmg:[sDMG(b.dmg[0]), sDMG(b.dmg[1])], castCd:ri(1,3)};
  if(options.ally){e.foe=false;e.ally=true;}
  /* Health tuning waits until callers finish assigning ally/elite roles. */
  if(typeof applyEarlyFloorEnemyTuning==='function')applyEarlyFloorEnemyTuning(e,true);
  FoteContent.appearanceChanged(floorMeta);
  if(b.ghoul&&!e.ally&&typeof FoteGhoul!=='undefined')return FoteGhoul.bury(e);
  ents.push(e); return e;
}
