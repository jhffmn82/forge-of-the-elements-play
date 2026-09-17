/* =====================================================================
   puzzles.js - level design pass (mechanics review 2026-09-16, DESIGN.md 12 step 10).
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
  chasm:     {el:'air',    sigil:'levitate', name:'Chasm vault',      note:'A chasm splits a side room with treasure beyond. Floating would carry you over.'},
  drowned:   {el:'air',    sigil:'levitate', name:'Drowned cellar',   note:'A flooded cellar: swimming across is possible, but the cold water takes its toll.'},
  barricade: {el:'fire',   sigil:'firestorm',name:'Barricade',        note:'A doorway choked with dry thorns and timber. Fire would clear it; pushing through hurts.'},
  hoard:     {el:'fire',   sigil:'firestorm',name:'Frozen hoard',     note:'Treasure sealed in blocks of ice. Weapons only glance off it; fire will melt it.'},
  everburn:  {el:'water',  sigil:'identify', name:'Everburning door', note:'A doorway wreathed in flame that never dies. Water would put it out.'},
  baths:     {el:'water',  sigil:'identify', name:'Scalding baths',   note:'Steam rolls from a room of scalding stone. Something cold would let you cross.'},
  spikes:    {el:'earth',  sigil:'stoneskin',name:'Spike gauntlet',   note:'A room bristling with spikes. Skin of stone would shrug them off.'},
  sentinels: {el:'earth',  sigil:'stoneskin',name:'Stone sentinels',  note:'Two stone sentinels guard a hoard. They let their own kind pass.'},
  darktraps: {el:'light',  sigil:'heal',     name:'Lightless room',   note:'A room of perfect darkness, and the smell of old blood. Light would show what waits in it.'},
  sentries:  {el:'shadow', sigil:'vanish',   name:'Sentry gallery',   note:'Statues with glowing eyes watch over a gallery. Unseen, you could pass.'},
  library:   {el:'shadow', sigil:'vanish',   name:'Silent library',   note:'A hushed library. Any sound here would wake what keeps it.'}
};
/* the Water sigil (now Identify) is the one that puts out fire: see sigils.js */

/* ---------------------------------------------------------------- the plan: which floors get which room */
function puzzlePlan(){
  var b=bidx();
  if(b===0 && RUN.puzzlePlan) return RUN.puzzlePlan;
  RUN.puzzlePlans=RUN.puzzlePlans||{}; if(b>0 && RUN.puzzlePlans[b]) return RUN.puzzlePlans[b];
  var base=b*5, r=mulberry32(((RUN.seed||worldSeed)^(0x9a221e+b*977))>>>0), floors=[base+2,base+3,base+4];
  for(var i=floors.length-1;i>0;i--){ var j=Math.floor(r()*(i+1)); var t=floors[i]; floors[i]=floors[j]; floors[j]=t; }
  var kinds=Object.keys(PUZZLE_KINDS), plan={};
  var k1=kinds[Math.floor(r()*kinds.length)], k2;
  do { k2=kinds[Math.floor(r()*kinds.length)]; } while(PUZZLE_KINDS[k2].el===PUZZLE_KINDS[k1].el);
  plan[floors[0]]={sigilRoom:k1}; plan[floors[1]]={sigilRoom:k2};
  plan[floors[2]]={crystal:true};
  if(b===0) RUN.puzzlePlan=plan; else RUN.puzzlePlans[b]=plan;
  return plan;
}
buildPuzzle = function(){};   /* the old puzzle rooms are retired */

var _generatePz = generate;
generate = function(seed){
  _generatePz(seed);
  floorMeta.puzzles=[]; floorMeta.searched={};
  if(floorMeta.boss || !RUN) return;
  var plan=puzzlePlan()[floorNo]; if(!plan) return;
  var saved=rng; rng=mulberry32(((seed||0)^0x51c1)>>>0);
  try{ if(plan.sigilRoom) buildSigilRoom(plan.sigilRoom); if(plan.crystal) buildCrystalVault(); }
  finally{ rng=saved; }
};
/* last word on a new floor: no prop may share a tile with a chest, stairs, door or the Forge */
var _generatePropSweep = generate;
generate = function(seed){
  _generatePropSweep(seed);
  var n=props.length; props=props.filter(function(p){ return !objectTile(at(p.x,p.y)); });
  if(props.length!==n) rebuildPropGrid();
};

/* ---------------------------------------------------------------- building */
function pzCells(room){ return interiorCells(room).concat(edgeCells(room)); }
function mainRoomCell(){
  var o=[]; for(var y=0;y<MH;y++) for(var x=0;x<MW;x++) if(freeCell(x,y) && inRoom(x,y) && roomAt(x,y) && !roomAt(x,y).pocket && roomAt(x,y).role!=='start') o.push({x:x,y:y});
  return o.length ? pick(o) : null;
}
function placeSolution(kind){
  var c=mainRoomCell(); if(c) items.push({x:c.x, y:c.y, kind:'sigil', use:PUZZLE_KINDS[kind].sigil});
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
function buildSigilRoom(kind){
  var pk=carvePocket(4,3,6,5)||carvePocket(3,3,5,4); if(!pk) return;
  var room=pk.room, P=PUZZLE_KINDS[kind], door=pk.door;
  room.special='puzzle'; room.puzzle={kind:kind, solved:false, door:door};
  floorMeta.puzzles.push(room);
  setT(door.x,door.y,DOOR);
  var cells=farFrom(pzCells(room).filter(function(p){ return at(p.x,p.y)===FLOOR; }), door);
  if(kind==='chasm'){
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
    setT(door.x,door.y,THORNS);
    pzLoot(cells, 3);
  } else if(kind==='hoard'){
    var spots=cells.slice(0,3);
    pzLoot(spots, 3);
    spots.forEach(function(p){ addProp(p.x,p.y,'ice-block',{br:0, keep:true, hoard:true, hits:0}); });
  } else if(kind==='everburn'){
    floorMeta.everburn={x:door.x, y:door.y};
    pzLoot(cells, 3);
  } else if(kind==='baths'){
    pzCells(room).forEach(function(p){ if(at(p.x,p.y)===FLOOR && !gAt(p.x,p.y)) setG(p.x,p.y,G_PUDDLE); });
    room.hot=true;
    pzLoot(cells, 3);
  } else if(kind==='spikes'){
    var loot=cells.slice(0,3);
    pzCells(room).forEach(function(p){ if(!loot.some(function(l){ return l.x===p.x&&l.y===p.y; }) && at(p.x,p.y)===FLOOR) feats.push({x:p.x,y:p.y,kind:'spikes',found:true,puzzle:true}); });
    pzLoot(loot, 3);
  } else if(kind==='sentinels'){
    pzLoot(cells.slice(0,3), 3);
    var guard=cells.slice(3).filter(function(p){ return freeCell(p.x,p.y); }).slice(0,2);
    guard.forEach(function(g){ addProp(g.x,g.y,'statue',{keep:true, sentinel:true}); });
  } else if(kind==='darktraps'){
    room.dark=true;
    var loot2=cells.slice(0,3);
    pzLoot(loot2, 3);
    shuffled(pzCells(room).filter(function(p){ return !loot2.some(function(l){ return l.x===p.x&&l.y===p.y; }) && Math.abs(p.x-door.x)+Math.abs(p.y-door.y)>1; })).slice(0,5)
      .forEach(function(p){ feats.push({x:p.x,y:p.y,kind:pick(['fire','spark','dart']),found:false,heavy:true,puzzle:true}); });
    addProp(pk.inside.x+(pk.inside.x===door.x?1:0), pk.inside.y+(pk.inside.y===door.y?1:0), 'bones', {});
  } else if(kind==='sentries'){
    pzLoot(cells.slice(0,3), 3);
    var eyes=edgeCells(room).filter(function(p){ return freeCell(p.x,p.y) && Math.abs(p.x-door.x)+Math.abs(p.y-door.y)>2; });
    shuffled(eyes).slice(0,2).forEach(function(p){ addProp(p.x,p.y,'statue',{keep:true, sentry:true, light:'#FF5A4A'}); });
  } else if(kind==='library'){
    edgeCells(room).filter(function(p){ return freeCell(p.x,p.y) && Math.abs(p.x-door.x)+Math.abs(p.y-door.y)>2; }).slice(0,4).forEach(function(p){ addProp(p.x,p.y,'bookshelf',{keep:true}); });
    var lc=cells.filter(function(p){ return freeCell(p.x,p.y); });
    for(var i=0;i<3 && i<lc.length;i++) items.push(i===0 ? {x:lc[i].x,y:lc[i].y,kind:'sigil',use:randomSigilUse()} : {x:lc[i].x,y:lc[i].y,kind:'essence',n:ri(25,40)+floorNo*4});
  }
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
    addProp(p.x,p.y, objArt('props','crystal-violet') ? 'crystal-violet' : 'mushrooms', {flat:1, light:'#9FE8FF', dim:1, keep:true});   /* a crystal marks each treasure */
  });
  var c=mainRoomCell(); if(c) items.push({x:c.x, y:c.y, kind:'key', key:'crystal'});
  floorMeta.notes.push('<b>A crystal vault</b> glints somewhere on this floor. Its crystal key lies about; inside, you may take one treasure.');
}

/* ---------------------------------------------------------------- helpers */
function puzzleRoomAt(x,y){ var r=roomAt(x,y); return r && r.puzzle ? r : null; }
function solvePuzzle(room, how){
  if(!room || room.puzzle.solved) return;
  var k=room.puzzle.kind, P=PUZZLE_KINDS[k];
  room.puzzle.solved=true;
  if(k==='barricade'){ var d=room.puzzle.door; if(at(d.x,d.y)===THORNS){ setT(d.x,d.y,OPEN); burst(d.x,d.y,'fire',24,0.06); } }
  if(k==='everburn'){ var e=floorMeta.everburn; if(e){ fireT[idxOf(e.x,e.y)]=0; floorMeta.everburn=null; burst(e.x,e.y,'ice',24,0.06); } }
  if(k==='darktraps'){ room.dark=false; feats.forEach(function(f){ if(f.puzzle && roomAt(f.x,f.y)===room) f.found=true; }); }
  if(k==='hoard'){ props.filter(function(p){ return p.hoard; }).forEach(function(p){ removeProp(p); burst(p.x,p.y,'ice',16,0.05); }); }
  log('<b>'+P.name+':</b> '+how,'c-kill'); sfx('puzzle-solved'); computeFOV();
}
function nearRoom(room, r){ return player.x>=room.x-r && player.x<room.x+room.w+r && player.y>=room.y-r && player.y<room.y+room.h+r; }
function mastered(kind){ return aff(PUZZLE_KINDS[kind].el)>=3; }

/* ---------------------------------------------------------------- sigils solve rooms */
var _useSigilPz = useSigil;
useSigil = function(use){
  var r=_useSigilPz(use);
  if(r===false) return r;
  if(use==='identify') douseAround(3);
  var solveAs = use==='identify2' ? 'identify' : use;   /* the Water sigil+ works on water puzzles too */
  (floorMeta.puzzles||[]).forEach(function(room){
    var k=room.puzzle.kind; if(room.puzzle.solved || PUZZLE_KINDS[k].sigil!==solveAs) return;
    if(k==='everburn' && floorMeta.everburn && dist(player, floorMeta.everburn)<=3) solvePuzzle(room, 'the undying flame gutters out.');
    else if(k==='barricade' && dist(player, room.puzzle.door)<=2) solvePuzzle(room, 'the barricade goes up in flames.');
    else if(k==='hoard' && nearRoom(room, 1)) solvePuzzle(room, 'the ice runs away as water.');
    else if(k==='darktraps' && nearRoom(room, 2)) solvePuzzle(room, 'light floods the room and shows every trap.');
    else if(k==='baths' && nearRoom(room, 2)){ room.cooledUntil=turn+10; log('<b>Scalding baths:</b> the stone cools for 10 turns.','c-kill'); sfx('ice-melt'); }
  });
  return r;
};

/* ---------------------------------------------------------------- stepping and bumping */
var _tryMovePz = tryMove;
tryMove = function(dx, dy){
  if(!player || player.hp<=0) return _tryMovePz(dx,dy);
  var nx=player.x+dx, ny=player.y+dy, t=at(nx,ny), room=puzzleRoomAt(nx,ny);
  /* Air 3: the wind carries you over a chasm */
  if(t===CHASM && aff('air')>=3 && !(player.levitate>0)){ player.levitate=1; player.windCarry=true; }
  /* Fire 3 burns a barricade on contact */
  if(t===THORNS && aff('fire')>=3){ var br=(floorMeta.puzzles||[]).filter(function(r){ return r.puzzle.kind==='barricade' && r.puzzle.door.x===nx && r.puzzle.door.y===ny; })[0];
    setT(nx,ny,OPEN); burst(nx,ny,'fire',20,0.06); if(br) solvePuzzle(br, 'your fire burns the barricade away.'); else log('Your fire burns the thorns away.','c-kill'); endTurn(); return; }
  /* ice blocks: only fire melts them (Fire 3 at a touch, a Fire sigil, or flames beside a block); blows glance off */
  var pr=propAt(nx,ny);
  if(pr && pr.hoard){
    var hr=(floorMeta.puzzles||[]).filter(function(r){ return r.puzzle.kind==='hoard'; })[0];
    if(aff('fire')>=3){ if(hr) solvePuzzle(hr, 'the ice melts at your touch.'); endTurn(); return; }
    sfx('ice-hit'); burst(nx,ny,'ice',6,0.03);
    log('The ice is too hard to break. Only fire will melt it.','c-info');
    return;   /* bumping costs no turn */
  }
  /* Water 3 walks through the undying flame and puts it out */
  if(floorMeta.everburn && nx===floorMeta.everburn.x && ny===floorMeta.everburn.y && aff('water')>=3){
    var er=(floorMeta.puzzles||[]).filter(function(r){ return r.puzzle.kind==='everburn'; })[0]; if(er) solvePuzzle(er, 'the flame dies at your touch.');
  }
  var px=player.x, py=player.y;
  _tryMovePz(dx,dy);
  if(player.windCarry && at(player.x,player.y)!==CHASM){ player.windCarry=false; }
  if(player.x!==px || player.y!==py) enterTile();
};
function enterTile(){
  var room=puzzleRoomAt(player.x,player.y), inWater=at(player.x,player.y)===WATER;
  /* the drowned cellar: swimming costs HP */
  if(room && room.deep && inWater && !(player.levitate>0) && aff('air')<3 && player.hp>0){
    var d=Math.max(1,Math.round(player.maxhp*0.08)); player.hp-=d; floatText(player.x,player.y,String(d),'ice');
    log('The cold water saps you: '+d+' damage.','c-you');
    if(player.hp<=0){ heroicResolve(); if(player.hp<=0) death(); }
  }
}

/* spikes: harmless on stone skin or with Earth 3; heavy traps in the dark room hurt twice */
var SPIKES_SRC = {name:'Spikes', base:{pierce:99}};
var _triggerTrapPz = triggerTrap;
triggerTrap = function(tr, e){
  if(tr.kind==='spikes'){
    if(e===player && (player.levitate>0 || player.st.stone || aff('earth')>=3)){ return; }
    /* 2026-09-17: spikes go straight through armor and hit harder (armor had cut them to ~3) */
    var d=applyDamage(e, roll(4,7)+floorNo, 'phys', SPIKES_SRC); floatText(e.x,e.y,String(d),'phys'); sfx('trap-dart');
    if(e===player){ log('Spikes drive up through your boots: '+d+' damage.','c-you'); if(player.hp<=0){ heroicResolve(); if(player.hp<=0) death(); } }
    else if(e.hp<=0) kill(e,null);
    return;
  }
  _triggerTrapPz(tr, e);
  if(tr.heavy && e.hp>0){ var hd=applyDamage(e, roll(3,6)+floorNo, 'phys', null); floatText(e.x,e.y,String(hd),'phys'); if(e===player){ log('The trap bites deep: '+hd+' more.','c-you'); if(player.hp<=0){ heroicResolve(); if(player.hp<=0) death(); } } else if(e.hp<=0) kill(e,null); }
};
var _drawTrapPz = drawTrap;
drawTrap = function(f, px, py, alpha, now){
  if(f.kind!=='spikes') return _drawTrapPz(f, px, py, alpha, now);
  var u=TS/32; ctx.save(); ctx.globalAlpha=alpha;
  ctx.fillStyle='#2A2522'; ctx.fillRect(px+4*u,py+4*u,24*u,24*u);
  ctx.fillStyle='#B9B3AA';
  for(var i=0;i<3;i++) for(var j=0;j<3;j++){ var sx=px+(7+i*8)*u, sy=py+(9+j*8)*u; ctx.beginPath(); ctx.moveTo(sx,sy+5*u); ctx.lineTo(sx+2.5*u,sy-2*u); ctx.lineTo(sx+5*u,sy+5*u); ctx.closePath(); ctx.fill(); }
  ctx.restore();
};

/* ---------------------------------------------------------------- the turn: rooms that act */
var _endTurnPz = endTurn;
endTurn = function(){
  var before=turn;
  _endTurnPz();
  if(!player || player.hp<=0 || turn===before) return;
  if(player.windCarry && at(player.x,player.y)===CHASM) player.levitate=Math.max(player.levitate,1);
  var e=floorMeta.everburn;
  if(e){ fireT[idxOf(e.x,e.y)]=Math.max(fireT[idxOf(e.x,e.y)],3); }
  var room=puzzleRoomAt(player.x,player.y);
  if(!room || room.puzzle.solved) return;
  var k=room.puzzle.kind;
  if(k==='darktraps' && mastered(k)) solvePuzzle(room, 'your inner light shows every trap.');
  else if(k==='baths' && !(room.cooledUntil>turn) && !(player.levitate>0) && aff('water')<3){
    var d=applyDamage(player, roll(1,3)+floorNo, 'fire', null); floatText(player.x,player.y,String(d),'fire'); log('The scalding stone burns you: '+d+'.','c-you');
    if(player.hp<=0){ heroicResolve(); if(player.hp<=0) death(); }
  }
  else if(k==='sentries' && !(player.hidden>0) && aff('shadow')<3){
    props.filter(function(p){ return p.sentry && roomAt(p.x,p.y)===room; }).forEach(function(p){
      if(player.hp<=0) return;
      boltFx(p.x,p.y,player.x,player.y,'light');
      var d=applyDamage(player, roll(2,4)+floorNo, 'light', null); floatText(player.x,player.y,String(d),'light');
      log('A sentry’s eyes flare: '+d+' damage.','c-you');
    });
    if(player.hp<=0){ heroicResolve(); if(player.hp<=0) death(); }
  }
  else if(k==='sentinels'){
    if(player.st.stone || mastered(k)) solvePuzzle(room, 'the sentinels take you for one of their own and sleep on.');
    else {
      room.puzzle.solved=true;
      props.filter(function(p){ return p.sentinel && roomAt(p.x,p.y)===room; }).forEach(function(p){
        removeProp(p); var m=spawn('brute',p.x,p.y); m.name='Stone Sentinel'; m.maxhp=m.hp=40+floorNo*6; m.state='hunt'; m.base=Object.assign({},m.base,{armor:6, sprite:'m-stoneling', col:'#8C8C84'}); m.t=player.t;
        burst(p.x,p.y,'earth',20,0.06);
      });
      SHAKE=8; log('<b>The stone sentinels wake!</b>','c-you'); sfx('warchief-roar');
    }
  }
  else if(k==='library' && !(player.hidden>0) && aff('shadow')<3 && player.movedLast){
    room.puzzle.solved=true;
    ents.forEach(function(o){ if(o.foe && dist(o,player)<=20){ o.state='hunt'; o.lastSeen={x:player.x,y:player.y}; } });
    for(var i=0;i<2;i++){ var c=nearFree(player.x,player.y,3); if(c){ var w=spawn('wisp',c.x,c.y); w.name='Library Shade'; w.state='hunt'; w.t=player.t; } }
    log('<b>Your footsteps echo through the library.</b> Its keepers come for you.','c-you'); sfx('trap-alarm');
  }
  else if(k==='library' && (player.hidden>0 || mastered(k))){ solvePuzzle(room, 'you move through the stacks without a sound.'); }
  else if(k==='sentries' && (player.hidden>0 || mastered(k))){ solvePuzzle(room, 'the sentries stare straight through you.'); }
  else if(k==='chasm' && (player.levitate>0 || mastered(k)) && at(player.x,player.y)!==CHASM){ var far=farFrom(pzCells(room),room.puzzle.door)[0]; if(far && dist(player,far)<=1) solvePuzzle(room, 'you cross the chasm.'); }
  else if(k==='drowned' && (player.levitate>0 || mastered(k))){ solvePuzzle(room, 'you cross the water untouched.'); }
  else if(k==='spikes' && (player.st.stone || mastered(k))){ solvePuzzle(room, 'the spikes break on your stone skin.'); }
};
/* the dark room hides its tiles from the lightmap too */
var _computeFOVPz = computeFOV;
computeFOV = function(radius){
  var r=roomAt(player.x,player.y);
  if(r && r.puzzle && r.puzzle.kind==='darktraps' && r.dark) return _computeFOVPz(1);
  return _computeFOVPz(radius);
};

/* ---------------------------------------------------------------- the crystal vault */
var _bumpSealedPz = bumpSealed;
bumpSealed = function(x,y){
  var cd=floorMeta.crystalDoor;
  if(cd && cd.x===x && cd.y===y){
    if(player.keys.crystal>0){ player.keys.crystal--; setT(x,y,OPEN); floorMeta.crystalDoor=null; log('The crystal key rings true. <b>Take one treasure</b>; the rest will shatter.','c-kill'); sfx('door-unlock'); sparkleFx(x,y,'ice',30); computeFOV(); endTurn(); return; }
    log('A door of solid crystal. A <b>crystal key</b> on this floor opens it.','c-info'); sfx('door-locked'); return;
  }
  return _bumpSealedPz(x,y);
};
var _grabPz = grab;
grab = function(){
  var here=items.filter(function(it){ return it.x===player.x && it.y===player.y && it.crystal; });
  var got=_grabPz();
  if(got && here.length && here.some(function(it){ return items.indexOf(it)<0; })){
    var rest=items.filter(function(it){ return it.crystal; });
    rest.forEach(function(it){ burst(it.x,it.y,'ice',20,0.06); removeItem(it); });
    props.filter(function(p){ return p.light==='#9FE8FF'; }).forEach(function(p){ removeProp(p); });   /* match the marker light, not the prop name */
    if(rest.length){ log('The other treasures shatter into glittering dust.','c-you'); sfx('ice-melt'); }
  }
  return got;
};

/* ---------------------------------------------------------------- Search */
function searchAround(resting, quiet){
  if(!player || player.hp<=0) return;
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
  feats.forEach(function(f){ if(!f.found && Math.max(Math.abs(f.x-player.x),Math.abs(f.y-player.y))<=2 && rng()<ch){ f.found=true; found++; log('You find a <b>'+trapName(f.kind)+' trap</b>.','c-info'); sfx('trap-spot'); } });
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
(function(){ var b=$('bSearch'); if(b) b.onclick=function(){ if(!player || player.hp<=0) return; searchAround(false); updateUI(); }; })();

/* flames on or beside a frozen-hoard block melt that block */
var _endTurnIce = endTurn;
endTurn = function(){
  _endTurnIce();
  if(!props || !props.some(function(p){ return p.hoard; })) return;
  var melted=0;
  props.filter(function(p){ return p.hoard; }).forEach(function(p){
    var hot=false;
    for(var dy=-1;dy<=1 && !hot;dy++) for(var dx=-1;dx<=1;dx++){ var x=p.x+dx, y=p.y+dy; if(inb(x,y) && fireT[idxOf(x,y)]){ hot=true; break; } }
    if(hot){ removeProp(p); burst(p.x,p.y,'ice',16,0.05); melted++; }
  });
  if(melted){ log('Fire melts '+(melted>1?melted+' blocks':'a block')+' of ice.','c-kill'); sfx('ice-melt');
    if(!props.some(function(p){ return p.hoard; })){ var hr=(floorMeta.puzzles||[]).filter(function(r){ return r.puzzle.kind==='hoard' && !r.puzzle.solved; })[0]; if(hr) solvePuzzle(hr, 'the last of the ice runs away as water.'); }
    draw(); }
};
