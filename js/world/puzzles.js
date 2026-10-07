/* =====================================================================
   puzzles.js - level design pass (mechanics review 2026-09-16, docs/design/game-design.md 12 step 10).
   - Search (F, or the Search button): 1 turn, radius 2. Each hidden door or
     trap: 40% + 2% per Agility above 10 + Keen Eyes, +20% per repeat search
     from the same spot. Resting searches at half chance. Searching beside
     the uneven-stone hint always finds its door.
   - Sigil puzzle rooms (~2 per biome) replace the old ice door, thorns,
     plates, elemental lock and lever puzzles. Each is readable from its
     doorway, never traps you, and is solved by one single-mote sigil that is
     always placed (unidentified) on the same floor - or by holding 3 points
     in that element. Costly routes (HP, time, a fight) still exist.
   - The crystal vault: a crystal key opens it; take one of the visible
     treasures and the rest shatter.
   ===================================================================== */

var PUZZLE_KINDS = {
  poisonvault:{el:'fire', sigil:'firestorm',name:'Poison gas vault', note:'Gas deals 8 poison damage per tick and poisons you for 3 turns on entry. A Firestorm sigil lies just inside; fire clears the gas, or Stone Skin protects you while you cross.'},
  offering:{el:'earth',sigil:null,name:'Offering chamber',note:'A green flame burns above an offering bowl. Leave five pieces of gear or sigils at its feet to receive transmutation.'},
  chasm:     {el:'air',    sigil:'levitate', name:'Chasm vault',      note:'A chasm splits a side room with treasure beyond. Floating would carry you over.'},
  drowned:   {el:'air',    sigil:'levitate', name:'Drowned cellar',   note:'A flooded cellar: swimming across is possible, but the cold water takes its toll.'},
  barricade: {el:'water',  sigil:null,name:'Burning chamber', note:''},
  hoard:     {el:'fire',   sigil:'firestorm',name:'Frozen hoard',     note:'Treasure sealed in blocks of ice. Weapons only glance off them; fire will melt them.'},
  everburn:  {el:'water',  sigil:'identify', name:'Everburning door', note:'A doorway wreathed in flame that never dies. Water would put it out.'},
  baths:     {el:'earth',  sigil:null, name:'Scalding baths', note:''},
  spikes:    {el:'earth',  sigil:'stoneskin',name:'Spike gauntlet',   note:'A room bristling with spikes. Skin of stone would shrug them off.'},
  sentinels: {el:'earth',  sigil:'stoneskin',name:'Stone sentinels',  note:'Two stone sentinels guard a hoard. They let their own kind pass.'},
  darktraps: {el:'light',  sigil:'heal',     name:'Lightless room',   note:'A room of perfect darkness, and the smell of old blood. Light would show what waits in it.'},
  sentries:  {el:'shadow', sigil:'vanish',   name:'Sentry gallery',   note:'Statues with glowing eyes watch over a gallery. Unseen, you could pass.'},
  library:   {el:'shadow', sigil:'vanish',   name:'Silent library',   note:'A hushed library. Any sound here would wake what keeps it.'}
};
/* the Sigil of Knowledge (now Identify) is the one that puts out fire: see sigils.js */

/* ---------------------------------------------------------------- the plan: which floors get which room */
function puzzlePlan(){
  var preview=globalThis.FoteRoomPreview;if(RUN.sandbox&&preview&&preview.type==='puzzle'){var forced={};forced[floorNo]=preview.kind==='crystal'?{crystal:true}:{sigilRoom:preview.kind};return forced;}
  var b=bidx();
  if(b===0 && RUN.puzzlePlan) return RUN.puzzlePlan;
  RUN.puzzlePlans=RUN.puzzlePlans||{}; if(b>0 && RUN.puzzlePlans[b]) return RUN.puzzlePlans[b];
  var base=b*5, r=mulberry32(((RUN.seed||worldSeed)^(0x9a221e+b*977))>>>0), floors=[base+2,base+3,base+4];
  for(var i=floors.length-1;i>0;i--){ var j=Math.floor(r()*(i+1)); var t=floors[i]; floors[i]=floors[j]; floors[j]=t; }
  var kinds=Object.keys(PUZZLE_KINDS).filter(function(k){return k!=='everburn'&&(k!=='library'||b<2);}), plan={};
  var k1=kinds[Math.floor(r()*kinds.length)], k2;
  do { k2=kinds[Math.floor(r()*kinds.length)]; } while(PUZZLE_KINDS[k2].el===PUZZLE_KINDS[k1].el);
  plan[floors[0]]={sigilRoom:k1}; plan[floors[1]]={sigilRoom:k2};
  plan[floors[2]]={crystal:true};
  if(b===0) RUN.puzzlePlan=plan; else RUN.puzzlePlans[b]=plan;
  return plan;
}
   /* the old puzzle rooms are retired */


/* last word on a new floor: no prop may share a tile with a chest, stairs, door or the Forge */


/* ---------------------------------------------------------------- building */
function pzCells(room){ return interiorCells(room).concat(edgeCells(room)); }
function mainRoomCell(){
  var o=[]; for(var y=0;y<MH;y++) for(var x=0;x<MW;x++) if(freeCell(x,y) && inRoom(x,y) && roomAt(x,y) && !roomAt(x,y).pocket && roomAt(x,y).role!=='start') o.push({x:x,y:y});
  return o.length ? pick(o) : null;
}
function placeSolution(kind){
  if(kind==='poisonvault')return; // This room supplies its Firestorm inside the entrance.
  var use=PUZZLE_KINDS[kind]&&PUZZLE_KINDS[kind].sigil;
  if(!use||!SIGILS[use])return;
  var c=mainRoomCell(); if(c) items.push({x:c.x, y:c.y, kind:'sigil', use:use});
}
function farFrom(cells, door){ return cells.slice().sort(function(a,b){ return (Math.abs(b.x-door.x)+Math.abs(b.y-door.y))-(Math.abs(a.x-door.x)+Math.abs(a.y-door.y)); }); }
function pzLoot(cells, n){
  for(var i=0;i<n && i<cells.length;i++){
    var p=cells[i], roll=rng();
    items.push(roll<0.45 ? (function(){ var g=randomGear(); g.x=p.x; g.y=p.y; if(g.it.tier!==undefined && g.it.tier<3) g.it.tier++; if(typeof tierNormalize==='function') tierNormalize(g.it); return g; })()
             : roll<0.75 ? {x:p.x,y:p.y,kind:'essence',n:ri(20,35)+floorNo*4}
             : {x:p.x,y:p.y,kind:'mote',el:pick(ELEMENTS)});
  }
}
function puzzlePropKeepsRewardsOpen(room,cell){
  if(!roomFurnitureKeepsOpen(room,cell))return false;
  var door=room.puzzle.door,before=bfsFrom(door.x,door.y),index=idxOf(cell.x,cell.y),old=map[index];
  map[index]=WALL;
  var after=bfsFrom(door.x,door.y);map[index]=old;
  var lever=room.puzzle.switch;
  if(lever&&![[1,0],[-1,0],[0,1],[0,-1]].some(function(d){return after[idxOf(lever.x+d[0],lever.y+d[1])]>=0;}))return false;
  return items.filter(function(it){return it.x>=room.x&&it.x<room.x+room.w&&it.y>=room.y&&it.y<room.y+room.h;}).every(function(it){var i=idxOf(it.x,it.y);return before[i]<0||after[i]>=0;});
}
function guardianRewardCells(cells){
  var chosen=[];
  cells.forEach(function(c){if(chosen.length<3&&!chosen.some(function(p){return dist(p,c)<2;}))chosen.push(c);});
  cells.forEach(function(c){if(chosen.length<3&&!chosen.includes(c))chosen.push(c);});return chosen;
}
function placeChallengeChest(room){
  if(['sentries','sentinels','barricade','baths','library'].indexOf(room.puzzle.kind)<0)return;
  var rewards=items.filter(function(it){return roomAt(it.x,it.y)===room&&at(it.x,it.y)===FLOOR&&!propAt(it.x,it.y);});
  var reward=farFrom(rewards,room.puzzle.door)[0];if(!reward)return;
  items.splice(items.indexOf(reward),1);
  setT(reward.x,reward.y,CHEST);chestKind[idxOf(reward.x,reward.y)]='chest-gold';
  room.puzzle.goldChest={x:reward.x,y:reward.y};
}
function placeGuardianCover(room){
  var horizontal=room.w>=room.h,candidates=[];
  for(var n=-1;n<=1;n+=2)candidates.push(horizontal?{x:room.cx,y:room.cy+n}:{x:room.cx+n,y:room.cy});
  candidates.forEach(function(c){if(freeCell(c.x,c.y)&&puzzlePropKeepsRewardsOpen(room,c))addProp(c.x,c.y,'pillar',{keep:true,pillar:true});});
}
function guardianHasShot(p,target){
  var path=propProjectilePath(p.x,p.y,target.x,target.y),end=path[path.length-1];
  return !!end&&end.x===target.x&&end.y===target.y;
}
function placeSigilRoom(kind){
  // Cached plans from older runs use the same burning-room generator.
  if(kind==='everburn')kind='barricade';
  if(kind==='library'&&bidx()>=2)kind='sentries';
  var gallery=kind==='sentries'||kind==='sentinels'||kind==='library';
  var pk=(gallery&&carvePocket(6,5,7,6))||carvePocket(4,3,6,5)||carvePocket(3,3,5,4); if(!pk) return;
  var room=pk.room, P=PUZZLE_KINDS[kind], door=pk.door;
  room.special='puzzle'; room.puzzle={kind:kind, solved:false, door:door};
  floorMeta.puzzles.push(room);
  setT(door.x,door.y,DOOR);
  var cells=farFrom(pzCells(room).filter(function(p){ return at(p.x,p.y)===FLOOR; }), door);
  if(kind==='offering'){
    var bowlCell=cells.filter(function(c){return freeCell(c.x,c.y)&&dist(c,door)>1&&puzzlePropKeepsRewardsOpen(room,c);}).sort(function(a,b){return dist(a,{x:room.cx,y:room.cy})-dist(b,{x:room.cx,y:room.cy});})[0];
    if(bowlCell){var bowl=addProp(bowlCell.x,bowlCell.y,'brazier-unlit',{keep:true,b:1,br:0,burn:0,offeringBowl:true,light:'#73EE75'});if(bowl)room.puzzle.bowl={x:bowl.x,y:bowl.y};}
  } else if(kind==='poisonvault'){
    pzLoot(cells,3);
    var supply=pzCells(room).filter(function(c){return at(c.x,c.y)===FLOOR&&!propAt(c.x,c.y)&&!items.some(function(it){return it.x===c.x&&it.y===c.y;});}).sort(function(a,b){return dist(a,door)-dist(b,door);})[0];
    if(supply){items.push({x:supply.x,y:supply.y,kind:'sigil',use:'firestorm'});room.puzzle.gasSigil={x:supply.x,y:supply.y};}
    floorMeta.clouds=floorMeta.clouds||[];
    floorMeta.clouds.push({cells:pzCells(room).filter(function(c){return at(c.x,c.y)===FLOOR;}).map(function(c){return idxOf(c.x,c.y);}),until:Number.MAX_SAFE_INTEGER,dmg:8,src:'puzzle-gas',puzzleDoor:{x:door.x,y:door.y}});
  } else if(kind==='chasm'){
    var band=[];
    if(door.y===room.y-1 || door.y===room.y+room.h){ var by = door.y===room.y-1 ? room.y+1 : room.y+room.h-2; for(var x=room.x;x<room.x+room.w;x++){ setT(x,by,CHASM); band.push({x:x,y:by}); } }
    else { var bx = door.x===room.x-1 ? room.x+1 : room.x+room.w-2; for(var y=room.y;y<room.y+room.h;y++){ setT(bx,y,CHASM); band.push({x:bx,y:y}); } }
    cells=farFrom(pzCells(room).filter(function(p){ return at(p.x,p.y)===FLOOR; }), door).slice(0, Math.max(1, Math.floor(room.w*room.h/3)));
    pzLoot(cells, 3);
  } else if(kind==='drowned'){
    var dry=cells.slice(0,3);
    pzCells(room).forEach(function(p){ if(!dry.some(function(d){ return d.x===p.x&&d.y===p.y; })){ setT(p.x,p.y,WATER); setG(p.x,p.y,0); } });
    room.deep=true;
    pzLoot(dry, 3);
  } else if(kind==='barricade'){
    room.burning=true;
    pzLoot(cells, 3);
  } else if(kind==='hoard'){
    var spots=cells.slice(0,3);
    pzLoot(spots, 3);
    spots.forEach(function(p){ addProp(p.x,p.y,'ice-block',{br:0, keep:true, hoard:true, hits:0}); });
    var fuel=cells.filter(function(c){return freeCell(c.x,c.y)&&Math.abs(c.x-door.x)+Math.abs(c.y-door.y)>=3;}).sort(function(a,b){return dist(a,{x:room.cx,y:room.cy})-dist(b,{x:room.cx,y:room.cy});})[0];
    if(fuel){addProp(fuel.x,fuel.y,'barrel-explosive',{keep:true,puzzleSolution:true});room.puzzle.fireBarrel={x:fuel.x,y:fuel.y};}

  } else if(kind==='everburn'){
    floorMeta.everburn={x:door.x, y:door.y};
    pzLoot(cells, 3);
  } else if(kind==='baths'){
    pzCells(room).forEach(function(p){ if(at(p.x,p.y)===FLOOR && !gAt(p.x,p.y)) setG(p.x,p.y,G_PUDDLE); });
    room.hot=true;
    pzLoot(cells, 3);
  } else if(kind==='spikes'){
    var loot=cells.slice(0,3);
    /* 2026-09-18: the gauntlet used to lay every spike out in the open, so the room read as a tiled pattern
       rather than a threat. They are hidden like any other trap now - searching (F) finds them, the floor
       note still warns you the room is out there, and stone skin, Earth 3 or levitation still walk it. */
    pzCells(room).forEach(function(p){ if(!loot.some(function(l){ return l.x===p.x&&l.y===p.y; }) && at(p.x,p.y)===FLOOR) feats.push({x:p.x,y:p.y,kind:'spikes',found:false,puzzle:true}); });
    pzLoot(loot, 3);
  } else if(kind==='sentinels'){
    pzLoot(guardianRewardCells(cells), 3);
    addPuzzleSwitch(room);
    placeGuardianCover(room);
    var guards=0;cells.filter(function(p){return freeCell(p.x,p.y);}).forEach(function(g){if(guards<2&&puzzlePropKeepsRewardsOpen(room,g)&&addProp(g.x,g.y,'statue',{keep:true,guardianStatue:true,sentinel:true}))guards++;});
  } else if(kind==='darktraps'){
    room.dark=true;
    var loot2=cells.slice(0,3);
    pzLoot(loot2, 3);
    shuffled(pzCells(room).filter(function(p){ return !loot2.some(function(l){ return l.x===p.x&&l.y===p.y; }) && Math.abs(p.x-door.x)+Math.abs(p.y-door.y)>1; })).slice(0,5)
      .forEach(function(p){ feats.push({x:p.x,y:p.y,kind:pick(['fire','spark','dart']),found:false,heavy:true,puzzle:true}); });
    addProp(pk.inside.x+(pk.inside.x===door.x?1:0), pk.inside.y+(pk.inside.y===door.y?1:0), 'bones', {});
  } else if(kind==='sentries'){
    pzLoot(guardianRewardCells(cells), 3);
    addPuzzleSwitch(room);
    placeGuardianCover(room);
    var eyes=edgeCells(room).filter(function(p){ return freeCell(p.x,p.y) && Math.abs(p.x-door.x)+Math.abs(p.y-door.y)>2; });
    var eyesPlaced=0;shuffled(eyes).forEach(function(p){if(eyesPlaced<2&&puzzlePropKeepsRewardsOpen(room,p)&&addProp(p.x,p.y,'statue',{keep:true,guardianStatue:true,sentry:true,light:'#FF5A4A'}))eyesPlaced++;});
  } else if(kind==='library'){
    room.dark=true;
    addPuzzleSwitch(room);
    var sleepers=0;
    farFrom(pzCells(room).filter(function(c){return freeCell(c.x,c.y)&&!occupied(c.x,c.y);}),door).forEach(function(c){
      if(sleepers>=2)return;
      var keeper=spawn(bidx()===0?'duskling':'stalker',c.x,c.y);
      keeper.state='asleep';keeper.libraryRoom={x:door.x,y:door.y};sleepers++;
    });
    var lc=cells.filter(function(p){ return freeCell(p.x,p.y); });
    libraryRewards('forbidden',null).forEach(function(item,n){var c=lc[Math.min(n,lc.length-1)]||door;item.x=c.x;item.y=c.y;items.push(item);});
    edgeCells(room).filter(function(p){ return (p.y-room.y)%3===0 && freeCell(p.x,p.y) && Math.abs(p.x-door.x)+Math.abs(p.y-door.y)>2; }).sort(function(a,b){return a.y-b.y||a.x-b.x;}).slice(0,4).forEach(function(p){if(puzzlePropKeepsRewardsOpen(room,p))addProp(p.x,p.y,'bookshelf',{keep:true});});

  }
  if(kind==='baths'||room.burning){
    var supply=pzCells(room).filter(function(c){return freeCell(c.x,c.y)&&Math.abs(c.x-door.x)+Math.abs(c.y-door.y)>=3;}).sort(function(a,b){return dist(a,{x:room.cx,y:room.cy})-dist(b,{x:room.cx,y:room.cy});})[0];
    if(supply){var barrelKind=kind==='baths'?'barrel-poison':'barrel-water',barrel=addProp(supply.x,supply.y,barrelKind,{keep:true,burn:0,puzzleSolution:true});if(barrel)room.puzzle.solution={kind:barrelKind,x:supply.x,y:supply.y};}
    if(room.burning)refreshBurningRoom(room);
  }
  placeChallengeChest(room);
  placeSolution(kind);
  floorMeta.notes.push('<b>'+P.name+'.</b> '+P.note);
  floorMeta.entrances=(floorMeta.entrances||[]);
}
function buildCrystalVault(){
  var pk=carvePocket(4,3,6,4)||carvePocket(3,3,5,4); if(!pk) return;
  var room=pk.room; room.special='crystal';
  setT(pk.door.x,pk.door.y,SEALED); floorMeta.crystalDoor={x:pk.door.x, y:pk.door.y};
  var cells=farFrom(pzCells(room).filter(function(p){ return freeCell(p.x,p.y); }), pk.door).slice(0,3), set=[];
  cells.forEach(function(p,i){
    var it = i===0 ? (function(){ var g=randomGear(); if(g.it.tier!==undefined) g.it.tier=Math.min(3,(g.it.tier||1)+1); g.it.cursed=false; if((g.it.plus||0)<1) g.it.plus=1; if(typeof tierNormalize==='function') tierNormalize(g.it); return g; })()
           : i===1 ? (rng()<0.5 && typeof makeRing==='function' ? {kind:'ring', it:makeRing(null,false)} : typeof makeAmulet==='function' ? {kind:'amulet', it:makeAmulet(null,false)} : {kind:'essence', n:60})
           : (rng()<0.5 ? {kind:'mote', el:pick(ELEMENTS)} : {kind:'essence', n:ri(60,90)+floorNo*10});
    it.x=p.x; it.y=p.y; it.crystal=true; items.push(it); set.push(it);
    addProp(p.x,p.y, 'crystal-violet', {flat:1, light:'#9FE8FF', dim:1, keep:true, crystalVault:true});   /* a crystal marks each treasure */
  });
  var c=mainRoomCell(); if(c) items.push({x:c.x, y:c.y, kind:'key', key:'crystal'});
  floorMeta.notes.push('<b>A crystal vault</b> glints somewhere on this floor. Its crystal key lies about; inside, you may take one treasure.');
}

/* ---------------------------------------------------------------- helpers */
function puzzleRoomAt(x,y){ var r=roomAt(x,y); return r && r.puzzle ? r : null; }
function repairCryptPuzzleGuardians(){
  if(!inCrypt()||!floorMeta||floorMeta.plane)return false;
  var changed=false;
  (floorMeta.puzzles||[]).forEach(function(room){
    var kind=room.puzzle.kind;if(kind!=='sentries'&&kind!=='sentinels')return;
    props.filter(function(p){return p.pillar&&p.cp&&roomAt(p.x,p.y)===room&&(p.name==='pedestal'||p.name==='grave-pillar');}).forEach(function(p){
      p.name='pillar';p.b=1;p.keep=true;p.set=false;p.w=1;p.h=1;
      delete p.cp;delete p.top;delete p.seed;delete p.artName;
      changed=true;
    });
    var candidates=props.filter(function(p){
      return p.x>=room.x&&p.x<room.x+room.w&&p.y>=room.y&&p.y<room.y+room.h&&
        (p.sentry||p.sentinel||p.guardianStatue||(p.cp&&(p.name==='sarc'||p.name==='sarcophagus')));
    });
    /* The old conversion left one or two recognizable tomb stand-ins. Do not guess
       when a saved room contains a different or ambiguous arrangement. */
    if(!candidates.length||candidates.length>2)return;
    candidates.forEach(function(p){
      var field=kind==='sentries'?'sentry':'sentinel';
      var disabled=!!room.puzzle.disabled;
      if(p.name==='statue'&&(disabled?p.guardianStatue&&!p.sentry&&!p.sentinel:p[field])&&!p.set&&(p.w||1)===1&&(p.h||1)===1)return;
      p.name='statue';p.b=1;p.keep=true;p.guardianStatue=true;p.set=false;p.w=1;p.h=1;
      p.sentry=!disabled&&field==='sentry';p.sentinel=!disabled&&field==='sentinel';
      if(disabled){p.light=null;p.dim=true;}else if(field==='sentry')p.light='#FF5A4A';else delete p.light;
      delete p.cp;delete p.horiz;delete p.kind;delete p.top;delete p.seed;delete p.artName;
      changed=true;
    });
  });
  if(changed){rebuildPropGrid();FoteContent.appearanceChanged(floorMeta);}
  return changed;
}
function solvePuzzle(room, how){
  if(room && room.puzzle.kind==='barricade'&&!room.burning){setT(room.puzzle.door.x,room.puzzle.door.y,OPEN);burst(room.puzzle.door.x,room.puzzle.door.y,'fire',24,.06);}
  if(!room || room.puzzle.solved) return;
  var k=room.puzzle.kind, P=PUZZLE_KINDS[k];
  room.puzzle.solved=true;
  if(k==='poisonvault')floorMeta.clouds=(floorMeta.clouds||[]).filter(function(c){return !c.puzzleDoor||c.puzzleDoor.x!==room.puzzle.door.x||c.puzzleDoor.y!==room.puzzle.door.y;});
  if(k==='baths'||room.burning){
    room.cooledUntil=Number.MAX_SAFE_INTEGER;
    pzCells(room).forEach(function(c){var i=idxOf(c.x,c.y);fireT[i]=0;fireSrc[i]=0;if(room.burning&&at(c.x,c.y)===FLOOR){setT(c.x,c.y,WATER);setG(c.x,c.y,0);}});
  }
  if(k==='everburn'){ var e=floorMeta.everburn; if(e){ fireT[idxOf(e.x,e.y)]=0; floorMeta.everburn=null; burst(e.x,e.y,'ice',24,0.06); } }
  if(k==='darktraps'){ room.dark=false; feats.forEach(function(f){ if(f.puzzle && roomAt(f.x,f.y)===room) f.found=true; }); }
  if(k==='hoard'){ props.filter(function(p){ return p.hoard; }).forEach(function(p){ removeProp(p); burst(p.x,p.y,'ice',16,0.05); }); }
  log('<b>'+P.name+':</b> '+how,'c-kill'); sfx('puzzle-solved'); computeFOV();
}
function nearRoom(room, r){ return player.x>=room.x-r && player.x<room.x+room.w+r && player.y>=room.y-r && player.y<room.y+room.h+r; }
function offeringGearDropped(it){
  function accepted(o){return FoteInventory.gear(o.kind)||o.kind==='sigil';}
  if(!accepted(it))return false;
  var bowl=props.find(function(p){return p.offeringBowl&&dist(player,p)===1&&dist(it,p)===1;});if(!bowl)return false;
  var room=puzzleRoomAt(bowl.x,bowl.y);if(!room||room.puzzle.solved)return false;
  var offerings=items.filter(function(o){return accepted(o)&&dist(o,bowl)<=1;});
  if(offerings.length<5)return false;
  offerings.slice(0,5).forEach(removeItem);removeProp(bowl);
  items.push({x:bowl.x,y:bowl.y,kind:'sigil',use:'transmutation'});
  burst(bowl.x,bowl.y,'poison',30,.08);
  solvePuzzle(room,'the bowl and your offerings vanish, leaving transmutation.');return true;
}
function mastered(kind){ return kind!=='drowned'&&kind!=='baths'&&aff(PUZZLE_KINDS[kind].el)>=3; }

/* ---------------------------------------------------------------- sigils solve rooms */


/* ---------------------------------------------------------------- stepping and bumping */


function enterTile(){
  var room=puzzleRoomAt(player.x,player.y), inWater=at(player.x,player.y)===WATER;
  (floorMeta.puzzles||[]).forEach(function(r){if(r.puzzle.kind==='poisonvault'&&r!==room)r.puzzle.gasEntered=false;});
  if(room&&room.puzzle.kind==='poisonvault'&&!room.puzzle.solved&&!room.puzzle.gasEntered){
    room.puzzle.gasEntered=true;
    applyStatus(player,'poison',3,2,{durationModifiers:false});
  }
  if(room&&room.puzzle.kind==='library'&&!room.puzzle.entered){
    room.puzzle.entered=true;
    var keepers=ents.filter(function(e){return e.hp>0&&e.libraryRoom&&e.libraryRoom.x===room.puzzle.door.x&&e.libraryRoom.y===room.puzzle.door.y;});
    keepers.forEach(function(e){FoteEnemyPerception.remember(e,player,'library-entry');});
    if(keepers.length)log('The library guardians wake.','c-info');
  }
  /* the drowned cellar: swimming costs HP */
  if(room && room.deep && inWater && !(player.levitate>0) && player.hp>0){
    var d=Math.max(1,Math.round(player.maxhp*0.08)); dealDirectDamage(player,d,'ice',null,{tags:['environment','drowning']}); floatText(player.x,player.y,String(d),'ice');
    log('The cold water saps you: '+d+' damage.','c-you');
    if(player.hp<=0){  if(player.hp<=0) death(); }
  }
}

/* spikes: harmless on stone skin or with Earth 3; heavy traps in the dark room hurt twice */
var SPIKES_SRC = {name:'Spikes', base:{pierce:99}};


function drawTrap(f,px,py,alpha,now){
  if(!spriteOn){
    var block={dart:['#A69B87','â†—'],fire:['#F58B42','F'],gas:['#91BC61','P'],frost:['#9FD8FF','I'],spark:['#FFE080','ÏŸ'],teleport:['#B58CFF','O'],web:['#D8D5C6','#'],alarm:['#E8B44A','!'],pit:['#94887C','â–¡'],spikes:['#B9B3AA','^']}[f.kind]||['#B9B3AA','^'];
    ctx.save();ctx.globalAlpha=alpha;ctx.fillStyle='#292421';ctx.fillRect(px+TS*.1,py+TS*.1,TS*.8,TS*.8);ctx.strokeStyle=block[0];ctx.lineWidth=Math.max(1,TS*.04);ctx.strokeRect(px+TS*.1,py+TS*.1,TS*.8,TS*.8);glyph(block[1],px,py,block[0]);ctx.restore();return;
  }
  if(f.kind!=='spikes') return drawOrdinaryTrap(f, px, py, alpha, now);
  ctx.save();ctx.globalAlpha=alpha;
  for(var i=0;i<5;i++){
    var sx=px+TS*(.2+.6*hash2(f.x,f.y,701+i)),sy=py+TS*(.25+.55*hash2(f.x,f.y,711+i)),h=TS*(.12+.07*hash2(f.x,f.y,721+i)),w=TS*.045;
    ctx.fillStyle='rgba(21,18,16,.8)';ctx.beginPath();ctx.ellipse(sx,sy,w*1.7,w*.7,0,0,Math.PI*2);ctx.fill();
    var metal=ctx.createLinearGradient(sx-w,sy,sx+w,sy);metal.addColorStop(0,'#514E4B');metal.addColorStop(.45,'#C7C1B2');metal.addColorStop(1,'#77746C');ctx.fillStyle=metal;
    ctx.beginPath();ctx.moveTo(sx-w,sy);ctx.lineTo(sx+TS*.015,sy-h);ctx.lineTo(sx+w,sy);ctx.closePath();ctx.fill();
    ctx.strokeStyle='#DED7C8';ctx.lineWidth=Math.max(.5,TS*.008);ctx.beginPath();ctx.moveTo(sx,sy-h*.86);ctx.lineTo(sx-w*.2,sy-h*.12);ctx.stroke();
  }
  ctx.restore();

}

/* The dormant guardian and its awakened actor share one visual identity.
 * Scene preparation can ask for it without spawning or revealing the enemy. */
function puzzleGuardianSprite(prop){return prop&&prop.sentinel?'m-stoneling':null;}

/* ---------------------------------------------------------------- the turn: rooms that act */

function refreshBurningRoom(room){
  if(!room.burning||room.puzzle.solved)return;
  pzCells(room).forEach(function(c){if(at(c.x,c.y)===FLOOR)fireT[idxOf(c.x,c.y)]=Math.max(fireT[idxOf(c.x,c.y)],3);});
}
function turnPuzzleHazards(context){ (floorMeta.puzzles||[]).forEach(refreshBurningRoom);  if(player.windCarry && at(player.x,player.y)===CHASM) player.levitate=Math.max(player.levitate,1);
  var e=floorMeta.everburn;
  if(e){ fireT[idxOf(e.x,e.y)]=Math.max(fireT[idxOf(e.x,e.y)],3); }
  var room=puzzleRoomAt(player.x,player.y);
  if(!room || room.puzzle.solved) return;
  var k=room.puzzle.kind;
  if(k==='darktraps' && mastered(k)) solvePuzzle(room, 'your inner light shows every trap.');
  else if(k==='baths' && mastered(k)) solvePuzzle(room, 'the scalding stone cannot warm your cool blood.');   /* 2026-09-23 audit: mastery solves this room like the other ten (DESIGN 12, step 10) */
  else if(k==='baths' && !(room.cooledUntil>turn) && !(player.levitate>0)){
    var d=applyDamage(player, roll(1,3)+floorNo, 'fire', null); floatText(player.x,player.y,String(d),'fire'); log('The scalding stone burns you: '+d+' damage.','c-you');
    if(player.hp<=0){  if(player.hp<=0) death(); }
  }
  else if(k==='sentries' && !(player.hidden>0) && aff('shadow')<3){
    props.filter(function(p){ return p.sentry && roomAt(p.x,p.y)===room; }).forEach(function(p){
      if(player.hp<=0||!guardianHasShot(p,player)) return;
      boltFx(p.x,p.y,player.x,player.y,'light');
      var d=applyDamage(player, roll(2,4)+floorNo, 'light', null); floatText(player.x,player.y,String(d),'light');
      log('A sentry\'s eyes flare: '+d+' damage.','c-you');
    });
    if(player.hp<=0){  if(player.hp<=0) death(); }
  }
  else if(k==='sentinels'){
    if(player.hidden>0)return;
    if(player.st.stone || mastered(k)) solvePuzzle(room, 'the sentinels take you for one of their own and sleep on.');
    else {
      room.puzzle.solved=true;
      var woke=props.filter(function(p){ return p.sentinel && roomAt(p.x,p.y)===room; });
      woke.forEach(function(p){
        removeProp(p); var m=spawn('brute',p.x,p.y); m.name='Stone Sentinel';m.sentinelRoom=room.puzzle.door; m.maxhp=m.hp=40+floorNo*6; m.state='hunt'; m.base=Object.assign({},m.base,{armor:6, sprite:puzzleGuardianSprite(p), col:'#8C8C84'}); m.t=player.t;
        burst(p.x,p.y,'earth',20,0.06);
      });
      SHAKE=8; log('<b>The stone sentinels wake!</b>','c-you'); sfx('golem-alert',{from:woke});
    }
  }
  else if(k==='sentries' && (player.hidden>0 || mastered(k))){ solvePuzzle(room, 'the sentries stare straight through you.'); }
  else if(k==='chasm' && (player.levitate>0 || mastered(k)) && at(player.x,player.y)!==CHASM){ var far=farFrom(pzCells(room),room.puzzle.door)[0]; if(far && dist(player,far)<=1) solvePuzzle(room, 'you cross the chasm.'); }
  else if(k==='drowned' && (player.levitate>0 || mastered(k))){ solvePuzzle(room, 'you cross the water untouched.'); }
  else if(k==='spikes' && (player.st.stone || mastered(k))){ solvePuzzle(room, 'the spikes break on your stone skin.'); }

}
/* the dark room hides its tiles from the lightmap too */


/* ---------------------------------------------------------------- the crystal vault */


function crystalVaultMarkers(room){
  return props.filter(function(p){return roomAt(p.x,p.y)===room&&(p.crystalVault||p.light==='#9FE8FF');});
}
function dissolveCrystalVault(room,animate){
  var rest=items.filter(function(it){return it.crystal&&roomAt(it.x,it.y)===room;});
  rest.forEach(function(it){if(animate)burst(it.x,it.y,'ice',20,0.06);removeItem(it);});
  crystalVaultMarkers(room).forEach(removeProp);
  room.crystalClaimed=true;
  if(animate&&rest.length){log('The other treasures shatter.','c-you');sfx('ice-melt');}
}
function claimCrystalVaultTreasure(it){
  if(!it||!it.crystal||items.indexOf(it)>=0)return false;
  var room=roomAt(it.x,it.y);
  if(!room||room.special!=='crystal'||room.crystalClaimed)return false;
  dissolveCrystalVault(room,true);return true;
}
function repairCrystalVaultClaims(){
  var changed=false;
  (rooms||[]).filter(function(room){return room.special==='crystal';}).forEach(function(room){
    var markers=crystalVaultMarkers(room),rewards=items.filter(function(it){return it.crystal&&roomAt(it.x,it.y)===room;});
    /* Older automatic pickups left a marker with no matching reward. */
    var claimed=room.crystalClaimed||markers.some(function(p){return !rewards.some(function(it){return it.x===p.x&&it.y===p.y;});});
    if(claimed&&(markers.length||rewards.length)){dissolveCrystalVault(room,false);changed=true;}
  });
  return changed;
}

/* ---------------------------------------------------------------- Search */
function searchAround(resting, quiet){
  if(gameTurns.busy())return false;
  if(!player || player.hp<=0) return;
  if(playerFearAction())return false;
  var spot=idxOf(player.x,player.y);
  floorMeta.searched=floorMeta.searched||{};
  var prev=floorMeta.searched[spot]||0; floorMeta.searched[spot]=prev+1;
  var ch=(0.40 + 0.02*Math.max(0,player.stats.agi-10) + (typeof ringVal==='function' ? ringVal('keeneyes') : 0) + 0.20*prev) * (resting?0.5:1);
  var nearTell=false;
  for(var ty=-1;ty<=1;ty++) for(var tx=-1;tx<=1;tx++) if(gAt(player.x+tx,player.y+ty)===G_TELL) nearTell=true;
  var found=0;
  for(var dy=-2;dy<=2;dy++) for(var dx=-2;dx<=2;dx++){
    var x=player.x+dx, y=player.y+dy; if(!inb(x,y)) continue;
    if(at(x,y)===SECRET){
      var tellHere=nearTell && [[0,1],[1,0],[-1,0],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]].some(function(d){ return gAt(x+d[0],y+d[1])===G_TELL; });
      if(tellHere || rng()<ch){ setT(x,y,DOOR); found++; log('You find a <b>hidden door</b>!','c-kill'); sfx('door-secret'); sparkleFx(x,y,'light',14); }
    }
  }
  feats.forEach(function(f){ if(!f.found && Math.max(Math.abs(f.x-player.x),Math.abs(f.y-player.y))<=2 && rng()<ch){ f.found=true; found++; log('You find '+(/^[AEIOU]/.test(trapName(f.kind))?'an':'a')+' <b>'+trapName(f.kind)+' trap</b>.','c-info'); sfx('trap-spot'); if(typeof trapSpotFx==='function') trapSpotFx(f); } });
  if(found) computeFOV();
  else if(!quiet) log('You search carefully'+(prev?' again':'')+' and find nothing.','c-info');
  endTurn();
}
window.addEventListener('keydown', function(ev){
  var tgt=ev.target && ev.target.tagName; if(tgt==='INPUT'||tgt==='SELECT') return;
  if(ev.key!=='f' && ev.key!=='F') return;
  if(modalOpen || openSheet || !player || player.hp<=0 || (RUN && (RUN.over||RUN.victory))) return;
  ev.preventDefault(); ev.stopImmediatePropagation();
  if(aiming) cancelAim();
  searchAround(false); updateUI();
}, true);

/* flames on or beside a frozen-hoard block melt that block */

function turnMeltHoard(context){
  if(!props || !props.some(function(p){ return p.hoard; })) return;
  var melted=0, gone=[];
  props.filter(function(p){ return p.hoard; }).forEach(function(p){
    var hot=false;
    for(var dy=-1;dy<=1 && !hot;dy++) for(var dx=-1;dx<=1;dx++){ var x=p.x+dx, y=p.y+dy; if(inb(x,y) && fireT[idxOf(x,y)]){ hot=true; break; } }
    if(hot){ removeProp(p); burst(p.x,p.y,'ice',16,0.05); melted++; gone.push(p); }
  });
  if(melted){ log('Fire melts '+(melted>1?melted+' blocks':'a block')+' of ice.','c-kill'); sfx('ice-melt',{from:gone});
    if(!props.some(function(p){ return p.hoard; })){ var hr=(floorMeta.puzzles||[]).filter(function(r){ return r.puzzle.kind==='hoard' && !r.puzzle.solved; })[0]; if(hr) solvePuzzle(hr, 'the last of the ice runs away as water.'); }
    draw(); }

}

/* Named floor-generation stages; ordered by generation-adapter.js. */
function buildGeneratedPuzzles(seed){

  floorMeta.puzzles=[]; floorMeta.searched={};
  if(floorMeta.boss || !RUN) return;
  var planned=puzzlePlan();
  // Reorder only unbuilt opening slots. Moving a reward into an old cached
  // floor would lose it, and moving its combat room forward would repeat it.
  var committed=RUN.floorStash&&Object.keys(planned).some(function(f){return !!RUN.floorStash[f];});
  if(bidx()===0&&floorNo<=2&&!committed&&planned[2]&&['sentinels','library'].indexOf(planned[2].sigilRoom)>=0){
    var later=[3,4].find(function(f){return planned[f]&&['sentinels','library'].indexOf(planned[f].sigilRoom)<0;});
    if(later){var early=planned[2];planned[2]=planned[later];planned[later]=early;}
  }
  var plan=planned[floorNo]; if(!plan) return;
  var saved=rng; rng=mulberry32(((seed||0)^0x51c1)>>>0);
  try{ if(plan.sigilRoom) buildSigilRoom(plan.sigilRoom); if(plan.crystal) buildCrystalVault(); }
  finally{ rng=saved; }
}

function clearGeneratedObjectProps(seed){

  var n=props.length; props=props.filter(function(p){ return !objectTile(at(p.x,p.y)); });
  if(props.length!==n) rebuildPropGrid();
}

/* Named travel and entry stages; ordered by transition-adapter.js. */
function movePuzzleGate(dx,dy){
  if(!player || player.hp<=0) return false;
  var nx=player.x+dx, ny=player.y+dy, t=at(nx,ny), room=puzzleRoomAt(nx,ny);
  /* Air 3: the wind carries you over a chasm */
  if(t===CHASM && aff('air')>=3 && !(player.levitate>0)){ player.levitate=1; player.windCarry=true; }
  /* Fire 3 burns a barricade on contact */
  if(t===THORNS && aff('fire')>=3){ var br=(floorMeta.puzzles||[]).filter(function(r){ return r.puzzle.kind==='barricade' && r.puzzle.door.x===nx && r.puzzle.door.y===ny; })[0];
    setT(nx,ny,OPEN); burst(nx,ny,'fire',20,0.06); if(br) solvePuzzle(br, 'your fire burns the barricade away.'); else log('Your fire burns the thorns away.','c-kill'); endTurn(); return true; }
  /* ice blocks: only fire melts them (Fire 3 at a touch, a Fire sigil, or flames beside a block); blows glance off */
  var pr=propAt(nx,ny);
  if(pr && pr.hoard){
    var hr=(floorMeta.puzzles||[]).filter(function(r){ return r.puzzle.kind==='hoard'; })[0];
    if(aff('fire')>=3){ if(hr) solvePuzzle(hr, 'the ice melts at your touch.'); endTurn(); return true; }
    sfx('ice-hit'); burst(nx,ny,'ice',6,0.03);
    log('The ice is too hard to break. Only fire will melt it.','c-info');
    return true;   /* bumping costs no turn */
  }
  /* Water 3 walks through the undying flame and puts it out */
  if(floorMeta.everburn && nx===floorMeta.everburn.x && ny===floorMeta.everburn.y && aff('water')>=3){
    var er=(floorMeta.puzzles||[]).filter(function(r){ return r.puzzle.kind==='everburn'; })[0]; if(er) solvePuzzle(er, 'the flame dies at your touch.');
  }
  return false;
}
