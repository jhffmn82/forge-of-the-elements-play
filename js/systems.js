/* ============================================================================
   systems.js - moving and bumping, doors and keys, puzzles, traps, fire, props,
   inventory, hunger, the turn loop, floors, death and victory.
   ========================================================================== */

var BAG_MAX = 20;   /* 2026-09-17: 16 was too tight once sigils, keys and a ranged weapon compete for it */
function hungerCost(cost){ return cost/100 * 2 * (player.race==='gloomling' ? 0.8 : 1); }

function bossNameForFloor(){
  var live=typeof ents!=='undefined' && ents.filter(function(e){return e.foe&&e.base&&e.base.boss&&e.hp>0;})[0];
  if(live)return live.name||(live.base&&live.base.name)||'this floor\'s guardian';
  if(floorNo<=5)return 'Grukk the Warchief';
  if(floorNo<=10)return 'Morty the Mostly-Dead';
  if(floorNo<=15)return 'the Deep Maw';
  if(floorNo<=20)return 'the Matron of the Web';
  return 'this floor\'s guardian';
}

/* ---------------------------------------------------------------- movement */
function performPlayerMove(dx,dy){
  if(player.hp<=0 || RUN.victory) return;
  var f=faceOf(dx,dy); if(f) player.face=f;
  if(player.st.frozen){ log('You are frozen solid.','c-info'); endTurn(); return; }
  if(player.st.stun){ log('You are stunned.','c-info'); endTurn(); return; }
  var nx=player.x+dx, ny=player.y+dy;
  var foe=foeAt(nx,ny);
  if(foe){
    attack(player, foe);
    offHandSwing(foe);
    player.hidden=0; endTurn(); return;
  }
  if(player.st.root){ log('You are rooted in place.','c-info'); endTurn(); return; }
  var friend=ents.filter(function(e){ return e.ally && e.x===nx && e.y===ny; })[0];
  if(friend){ friend.x=player.x; friend.y=player.y; player.x=nx; player.y=ny; player.movedThisTurn=true; stepOn(); endTurn(); return; }
  var pr=propAt(nx,ny);
  if(pr && bumpProp(pr)) return;
  var t=at(nx,ny);
  if(typeof FoteUnmakerPreview!=='undefined'&&FoteUnmakerPreview.bumpGate(nx,ny))return;
  if(t===DOOR){ setT(nx,ny,OPEN); log('You open the door.','c-info'); sfx('door-open'); computeFOV(); endTurn(); return; }
  if(t===CHEST){ openChest(nx,ny); endTurn(); return; }
  if(t===LOCKED){ return bumpLocked(nx,ny); }
  if(t===TOLL){ return bumpToll(nx,ny); }
  if(t===ICEDOOR){ return bumpIce(nx,ny); }
  if(t===THORNS){ return bumpThorns(nx,ny); }
  if(t===SEALED){ return bumpSealed(nx,ny); }
  if(t===SECRET){ return bumpSecret(nx,ny); }
  if(t===FORGE){ if(typeof openForge==='function') openForge(); return; }
  if(t===SHRINE){ if(typeof openShrine==='function') openShrine(); return; }
  if(t===EXIT && !floorMeta.exitOpen){ log('The gate is sealed. It opens when '+bossNameForFloor()+' falls.','c-info'); sfx('door-locked'); return; }
  if(t===CHASM){
    if(player.levitate>0){ player.x=nx; player.y=ny; player.movedThisTurn=true; stepOn(); endTurn(); return; }
    log('A sheer drop into darkness. You would need to float to cross.','c-info'); return;
  }
  if(t===WALL && gAt(player.x,player.y)===G_TELL){ log('A draft whispers through the stones here. Something is behind this wall.','c-info'); }
  if(!walkable(nx,ny)) return;
  player.x=nx; player.y=ny; player.movedThisTurn=true;
  if(gAt(nx,ny)===G_GRASS){ setG(nx,ny,G_SHORT); sfx('step-grass',{vol:0.5}); }   /* 2026-09-23 (Justin): half as loud, like cutting a bush */
  else if(t===WATER) sfx('step-water',{vol:0.8}); else sfx('step-stone',{vol:0.8});
  stepOn(); endTurn();
}
/* close an open door next to you: Shift+C closes every empty adjacent door, right-click closes one */
function doorClosable(x, y){
  if(at(x,y)!==OPEN) return false;
  if(typeof FoteUnmakerPreview!=='undefined'&&FoteUnmakerPreview.gateAt(x,y))return false;
  if(Math.max(Math.abs(x-player.x), Math.abs(y-player.y))!==1) return false;
  if(itemAt(x,y) || propAt(x,y)) return false;
  for(var i=0;i<ents.length;i++) if(ents[i].x===x && ents[i].y===y) return false;
  return true;
}
function closeDoorAt(x, y){
  if(gameTurns.busy())return false;
  if(at(x,y)!==OPEN) return false;
  if(Math.max(Math.abs(x-player.x), Math.abs(y-player.y))!==1){ log('You need to stand next to the door.','c-info'); return true; }
  if(typeof FoteUnmakerPreview!=='undefined'&&FoteUnmakerPreview.gateAt(x,y)){log('The Crucible gates stay raised once opened.','c-info');return true;}
  if(!doorClosable(x,y)){ log(x===player.x&&y===player.y ? 'Step out of the doorway first.' : 'Something is in the way of the door.','c-info'); return true; }
  setT(x,y,DOOR); log('You close the door.','c-info'); sfx('door-close'); computeFOV(); endTurn(); return true;
}
function closeAdjacentDoors(){
  var open=[], blocked=0,crucibleGate=false;
  for(var dy=-1;dy<=1;dy++) for(var dx=-1;dx<=1;dx++){
    if(!dx && !dy) continue; var x=player.x+dx, y=player.y+dy;
    if(at(x,y)!==OPEN) continue;
    if(typeof FoteUnmakerPreview!=='undefined'&&FoteUnmakerPreview.gateAt(x,y)){crucibleGate=true;continue;}
    if(doorClosable(x,y)) open.push([x,y]); else blocked++;
  }
  if(!open.length){ log(crucibleGate?'The Crucible gates stay raised once opened.':at(player.x,player.y)===OPEN ? 'You are standing in the doorway. Step out of it to close the door.' : blocked ? 'Something is in the way of the door.' : 'There is no open door next to you.','c-info'); return; }
  open.forEach(function(c){ setT(c[0],c[1],DOOR); });
  log(open.length>1 ? 'You close the doors.' : 'You close the door.','c-info'); sfx('door-close'); computeFOV(); endTurn();
}

function entryItemsAndTerrain(){
  var here=items.filter(function(it){ return it.x===player.x && it.y===player.y; });
  here.forEach(function(it){
    if(it.kind==='essence'){ removeItem(it); player.essence+=it.n; floatText(player.x,player.y,'+'+it.n,'magic'); log('Picked up '+it.n+' essence.','c-good'); sfx('pickup-essence',{vol:0.5}); }
    else if(it.kind==='mote'){ removeItem(it); player.motes[it.el]=(player.motes[it.el]||0)+1; log('Picked up a <b>'+it.el+' mote</b>. Bring it to the Elemental Forge.','c-kill'); sfx('pickup-mote'); sparkleFx(player.x,player.y,TRAIL_EL(it.el),16); }
    else if(it.kind==='key'){ removeItem(it); player.keys[it.key]=(player.keys[it.key]||0)+1; log('Picked up an <b>'+it.key+' key</b>. It fits a door on this floor.','c-kill'); sfx('pickup-key'); }
    else log('You see <b>'+itemLabel(it)+'</b> here.'+((it.kind==='heart'||it.kind==='managlobe') ? ' <span class="roll">(it waits until you need it)</span>' : ' <span class="roll">(g to pick up)</span>'),'c-info');
  });
  if(!(player.levitate>0)){
    var tr=feats.filter(function(f){ return f.x===player.x && f.y===player.y; })[0];
    if(tr) triggerTrap(tr, player);
  }
  if(plates) pressPlateAt(player.x,player.y,player);
  var t=at(player.x,player.y);
  if(t===STAIRS&&!(typeof FoteChaosCampaign!=='undefined'&&FoteChaosCampaign.entryHint())) log('Stairs down to floor '+(floorNo+1)+'. '+(document.body.classList.contains('touch') ? 'Tap them to descend.' : 'Press <b>&gt;</b> or click <b>Stairs</b> to descend.'),'c-kill');
  if(t===EXIT && floorMeta.exitOpen){ if(floorNo<LAST_FLOOR) descend(); else victory(); }
  if(t===CHASM && !(player.levitate>0)) fallIntoChasm();
}
function removeItem(it){ var i=items.indexOf(it); if(i>=0) items.splice(i,1); }
function fallIntoChasm(){
  log('You fall!','c-you'); sfx('trap-pit');
  var d=Math.round(player.maxhp*0.15); dealDirectDamage(player,d,'phys',null,{tags:['environment','fall']});
  if(player.hp<=0){  if(player.hp<=0){ death(); return; } }
  if(bfloor()<5 && floorNo<LAST_FLOOR) descend(true); else { var s=nearestWalkable(player.x,player.y); player.x=s.x; player.y=s.y; }
}

/* ---------------------------------------------------------------- doors, puzzles */
function bumpLocked(x,y){
  if(player.keys.iron>0){ player.keys.iron--; setT(x,y,OPEN); floorMeta.ironDoors=floorMeta.ironDoors||{}; floorMeta.ironDoors[idxOf(x,y)]=1; log('The iron key turns. The vault opens.','c-kill'); sfx('door-unlock'); computeFOV(); endTurn(); return; }
  log('Locked. An iron key would open it '+(floorMeta.keyHolder?'&mdash; a key holder prowls this floor.':'.'),'c-info'); sfx('door-locked');
}
function bumpToll(x,y){
  var cost=Math.max(1, Math.floor(player.hp*0.5));
  confirmBox('Spiked door', 'The spikes take their due: <b>'+cost+' HP</b> (half your current health) to squeeze through. The room behind holds a real reward.', 'Pay '+cost+' HP', function(){
    dealDirectDamage(player,cost,'phys',null,{tags:['cost','spikes']}); player._hit=performance.now(); floatText(player.x,player.y,String(cost),'phys'); sfx('player-hurt');
    setT(x,y,OPEN); log('You force your way past the spikes.','c-you'); computeFOV(); endTurn();
  });
}
function bumpIce(x,y){
  var d=floorMeta.icedoor||{hits:0}; floorMeta.icedoor=d; d.hits=(d.hits||0)+1;
  setClip(player,'melee'); lungeFx(player,x,y); sfx('ice-hit');
  burst(x,y,'ice',10,0.04);
  if(d.hits>=6){ setT(x,y,OPEN); log('The ice finally cracks apart.','c-kill'); sfx('ice-melt'); computeFOV(); }
  else log('You chip at the ice ('+d.hits+'/6). Fire would be faster.','c-info');
  endTurn();
}
function bumpThorns(x,y){
  var cost=Math.max(1, Math.round(player.maxhp*0.2));
  confirmBox('Thorns', 'Push through the thorns for <b>'+cost+' damage</b>, or burn them away with fire.', 'Push through', function(){
    dealDirectDamage(player,cost,'phys',null,{tags:['environment','thorns']}); player._hit=performance.now(); floatText(player.x,player.y,String(cost),'phys');
    if(player.hp<=0){  if(player.hp<=0){ death(); return; } }
    setT(x,y,OPEN); log('You tear through the thorns, bleeding.','c-you'); computeFOV(); endTurn();
  });
}
function bumpSealed(x,y){
  var room=puzzleAtDoor(x,y);
  if(room&&room.puzzle.kind==='barricade'&&!room.puzzle.solved){
    if(aff('fire')>=3){solvePuzzle(room,'the timber burns away.');endTurn();}
    else{sfx('door-locked');log('The barricade blocks the doorway.','c-info');}
    return;
  }

  var cd=floorMeta.crystalDoor;
  if(cd && cd.x===x && cd.y===y){
    if(player.keys.crystal>0){ player.keys.crystal--; setT(x,y,OPEN); floorMeta.crystalDoor=null; log('The crystal key rings true. <b>Take one treasure</b>; the rest will shatter.','c-kill'); sfx('door-unlock'); sparkleFx(x,y,'ice',30); computeFOV(); endTurn(); return; }
    log('A door of solid crystal. A <b>crystal key</b> on this floor opens it.','c-info'); sfx('door-locked'); return;
  }

  var lock=props.filter(function(p){ return p.name==='elemental-lock' && p.door && p.door.x===x && p.door.y===y; })[0];
  if(lock){ log('Sealed by elemental magic. The pedestal nearby wants a <b>'+lock.element+' mote</b>.','c-info'); return; }
  if(plates && plates.door.x===x && plates.door.y===y){ log('Sealed. Three plates in this room hum faintly; a broken tablet names their order.','c-info'); return; }
  log('Sealed.','c-info');
}
function bumpSecret(x,y){
  var nearTell=[[0,1],[1,0],[-1,0],[0,-1]].some(function(d){ return gAt(x+d[0],y+d[1])===G_TELL; });
  if(nearTell || rng()<0.25){ setT(x,y,DOOR); log('You find a hidden door!','c-kill'); sfx('door-secret'); sparkleFx(x,y,'light',14); computeFOV(); endTurn(); }
}
function pressPlateAt(x,y,e){
  if(!plates || plates.solved) return;
  var p=plates.cells.filter(function(c){ return c.x===x && c.y===y; })[0];
  if(!p || p.pressed) return;
  sfx('plate-press');
  if(plates.order[plates.progress]===p.symbol){
    p.pressed=true; plates.progress++;
    if(e===player) log('The '+p.symbol+' plate sinks with a click.','c-info');
    if(plates.progress>=3){ plates.solved=true; setT(plates.door.x,plates.door.y,OPEN); log('<b>A sealed door grinds open.</b>','c-kill'); sfx('puzzle-solved'); computeFOV(); }
  } else {
    plates.progress=0; plates.cells.forEach(function(c){ c.pressed=false; });
    if(e===player){ var d=applyDamage(player, roll(3,6)+floorNo, 'phys', null); floatText(player.x,player.y,String(d),'phys'); log('Wrong order! Darts hiss from the walls &mdash; '+d+' damage. The plates reset.','c-you'); sfx('trap-dart'); if(player.hp<=0) kill(player,null); }
  }
}

/* ---------------------------------------------------------------- props */
/* Both bridge levers and guardian shutoff switches use the same interaction state.
   Read the connected mechanism too, so older saves with an up-facing used lever
   do not advertise an action that can no longer change anything. */
function leverDetails(p){
  if(!p || !(p.lever || p.puzzleSwitch)) return null;
  var room=p.puzzleSwitch && p.roomDoor && (floorMeta.puzzles||[]).find(function(r){
    return r.puzzle.door.x===p.roomDoor.x && r.puzzle.door.y===p.roomDoor.y;
  });
  var used=!!(p.used || p.name==='lever-down' || (room && room.puzzle.disabled) ||
    (!p.puzzleSwitch && p.bridge && p.bridge.length && p.bridge.every(function(b){return at(b.x,b.y)===BRIDGE;})));
  return {name:p.puzzleSwitch?'Guardian shutoff lever':'Bridge lever', used:used,
    effect:p.puzzleSwitch?'shut off the room\'s guardians':'lower the bridge',
    result:p.puzzleSwitch?'The guardians are shut off.':'The bridge is already lowered.'};
}
function bumpProp(p){
  if(typeof FoteUnmakerEncounter!=='undefined'&&FoteUnmakerEncounter.forgeInfo(p.x,p.y)){
    FoteUnmakerEncounter.interactForge(p.x,p.y);return true;
  }
  if(p.puzzleSwitch)return activatePuzzleSwitch(p);
  if(p.name==='elemental-lock' && !p.opened){
    if(player.motes[p.element]>0){
      confirmBox('Elemental lock', 'Offer a <b>'+p.element+' mote</b> to the lock?', 'Offer the mote', function(){
        player.motes[p.element]--; if(player.motes[p.element]<=0) delete player.motes[p.element];
        p.opened=true; setT(p.door.x,p.door.y,OPEN); log('The lock drinks the mote. The seal dissolves.','c-kill'); sfx('puzzle-solved'); sparkleFx(p.x,p.y,TRAIL_EL(p.element),30); computeFOV(); endTurn();
      }); return true;
    }
    var fee=50+floorNo*5;
    confirmBox('Elemental lock', 'The lock wants a <b>'+p.element+' mote</b>. It will also accept <b>'+fee+' essence</b> (you have '+player.essence+').', player.essence>=fee?'Pay '+fee+' essence':null, function(){
      spendEssence(fee); p.opened=true; setT(p.door.x,p.door.y,OPEN); log('The lock grudgingly accepts the essence.','c-kill'); sfx('puzzle-solved'); computeFOV(); endTurn();
    }); return true;
  }
  if(p.lever){
    if(leverDetails(p).used) return true;
    p.used=true; p.name='lever-down'; sfx('lever');
    (p.bridge||[]).forEach(function(b){ setT(b.x,b.y,BRIDGE); });
    log('You pull the lever. Somewhere, planks thud into place over a chasm.','c-kill'); sfx('bridge'); endTurn(); return true;
  }
  if(p.tablet){ log('The broken tablet reads: <b>first the '+plates.order[0]+', then the '+plates.order[1]+', last the '+plates.order[2]+'</b>.','c-kill'); return true; }
  if(p.altar){ return sacrifice(p); }
  if(p.prisoner){
    var kind=p.prisoner; p.prisoner=null;
    var c=nearFree(p.x,p.y,1)||nearFree(player.x,player.y,2); if(!c) return true;
    var m=spawn(kind,c.x,c.y);
    if(rng()<0.55){ m.foe=false; m.ally=true; m.state='ally'; m.t=player.t; m.name='Freed '+m.name; log('The prisoner staggers out and swears to fight beside you until you leave this floor.','c-good'); }
    else { m.state='hunt'; log('The prisoner lunges at you!','c-you'); }
    sfx('door-open'); endTurn(); return true;
  }
  if(p.drink){ var h=Math.round(player.maxhp*0.1); healPlayer(h); p.drink=false; log('You drink from the fountain. +'+h+' HP.','c-good'); floatText(player.x,player.y,'+'+h,'heal'); sfx('step-water'); endTurn(); return true; }
  if(p.br){ setClip(player,'melee'); lungeFx(player,p.x,p.y); damageProp(p, player, 'phys'); endTurn(); return true; }
  if(p.b){ log('The '+p.name.replace(/-/g,' ')+' is in the way.','c-info'); return true; }
  return false;
}
function damageProp(p, src, type){
  if(p&&p.curtain)return cutWebCurtain(p,src,type);
  if(p&&p.bush)return cutBushProp(p,src,type);
  if(p.ex){ explode(p.x,p.y,src); return; }
  if(p.melt && (type==='fire')){ removeProp(p); log('The ice melts away.','c-info'); sfx('ice-melt'); return; }
  if(!p.br) return;
  removeProp(p); sfx(p.sfx||'crate-break'); burst(p.x,p.y,'earth',12,0.05);
  if(p.loot && rng()<p.loot){
    var roll2=rng(), it = roll2<0.74 ? {kind:'essence', n:ri(4,10)+floorNo} : roll2<0.78 ? {kind:'food', food:randomFood()} : roll2<0.84 ? {kind:'sigil', use:randomSigilUse()} : {kind:'mote', el:pick(ELEMENTS)};
    it.x=p.x; it.y=p.y; items.push(it); log('Something rolls out of the '+p.name+'.','c-good');
  }
}
function explode(x,y,src){
  var p=propAt(x,y); if(p) removeProp(p);
  log('<b>BOOM!</b> The powder barrel explodes.','c-you'); sfx('explosion'); explosionFx(x,y);
  for(var dy=-1;dy<=1;dy++) for(var dx=-1;dx<=1;dx++){
    var tx=x+dx, ty=y+dy; if(!inb(tx,ty)) continue;
    ents.slice().forEach(function(e){ if(e.x===tx && e.y===ty){ var d=applyDamage(e, roll(8,14)+floorNo, 'fire', null); floatText(tx,ty,String(d),'fire'); applyStatus(e,'burn',3,sDMG(2));
      if(e.hp<=0){ if(e===player){  if(player.hp<=0) death(); } else kill(e, src==='player'||src===player ? 'player' : null); } } });
    var q=propAt(tx,ty);
    if(q && (dx||dy)){ if(q.ex) setTimeout(function(qx,qy){ return function(){ if(propAt(qx,qy)) { explode(qx,qy,src); draw(); } }; }(tx,ty), 180); else if(q.br||q.burn) { removeProp(q); setG(tx,ty,G_ASH); } }
    if(at(tx,ty)===FLOOR && !gAt(tx,ty)) setG(tx,ty,G_SCORCH);
    ignite(tx,ty,src);
    burnWorld(tx,ty);
  }
}
function sacrifice(p){
  var a=altars[idxOf(p.x,p.y)]||(altars[idxOf(p.x,p.y)]={passes:0});
  var cost=Math.max(1, Math.round(player.maxhp*0.15)), lethal=player.hp<=cost;
  var nextReward = a.passes<3 ? 3 : a.passes<5 ? 5 : a.passes<7 ? 7 : null;
  if(!nextReward){ log('The altar is sated.','c-info'); return true; }
  confirmBox('Sacrifice altar', 'Press your hand onto the spikes for <b>'+cost+' HP</b>. What it gives, and when, is its own business.'+(lethal?'<br><span class="c-you"><b>This would kill you.</b></span>':''),
    lethal ? 'Offer anyway' : 'Offer blood', function(){
      dealDirectDamage(player,cost,'phys',null,{tags:['cost','sacrifice']}); player._hit=performance.now(); floatText(player.x,player.y,String(cost),'phys'); sfx('player-hurt'); a.passes++;
      if(player.hp<=0){  if(player.hp<=0){ death(); return; } }
      if(a.passes===3||a.passes===5||a.passes===7){
        var c=nearFree(p.x,p.y,1)||{x:player.x,y:player.y};
        var reward = a.passes===3 ? {kind:'essence',n:25+floorNo*5} : a.passes===5 ? {kind:'sigil',use:randomSigilUse()} : (function(){ var g=randomGear(); if(g.it.plus!==undefined) g.it.plus=3; g.it.tier='Trusty'; return g; })();
        if(a.passes===7 && rng()<0.5) reward={kind:'mote',el:pick(ELEMENTS)};
        reward.x=c.x; reward.y=c.y; items.push(reward);
        log('The altar is pleased. A gift appears.','c-kill'); sfx('shrine-convert'); sparkleFx(p.x,p.y,'dark',30);
      } else log('The altar drinks.','c-info');
      endTurn();
    });
  return true;
}

/* ---------------------------------------------------------------- fire */
function ignite(x,y,src){
  if(!inb(x,y)) return;
  var g=gAt(x,y), p=propAt(x,y), t=at(x,y);
  if(t===WATER) return;
  if(g===G_GRASS || g===G_SHORT || g===G_WEB || (p && p.burn)){
    if(!fireT[idxOf(x,y)]) { sfx('fire-ignite'); }
    fireT[idxOf(x,y)] = Math.max(fireT[idxOf(x,y)], g===G_GRASS?5:3);
    fireSrc[idxOf(x,y)] = src==='player'||src===player ? 1 : 0;
  }
  burnWorld(x,y);
}
var fireSrc = new Uint8Array(64*40);
function burnWorld(x,y){
  var puzzle=puzzleAtDoor(x,y);
  if(puzzle&&puzzle.puzzle.kind==='barricade'&&!puzzle.puzzle.solved)solvePuzzle(puzzle,'the timber burns away.');
  var t=at(x,y);
  if(t===ICEDOOR){ setT(x,y,OPEN); log('The ice sealing the door melts away in a cloud of steam.','c-kill'); sfx('ice-melt'); burst(x,y,'ice',24,0.06); computeFOV(); }
  if(t===THORNS){ setT(x,y,OPEN); fireT[idxOf(x,y)]=3; log('The thorns catch and burn away.','c-kill'); sfx('thorns-burn'); computeFOV(); }
  var p=propAt(x,y);
  if(p && p.ex) setTimeout(function(){ if(propAt(x,y)===p){ explode(x,y,'player'); draw(); } }, 250);
  if(p && p.web){ removeProp(p); }
  if(p && p.melt){ removeProp(p); sfx('ice-melt'); }
}
function fireTick(){
  var next=[];
  for(var i=0;i<fireT.length;i++){
    if(!fireT[i]) continue;
    var x=i%MW, y=(i/MW)|0;
    fireT[i]--;
    var p=propAt(x,y);
    if(fireT[i]===0){
      if(p && p.burn && !p.ex){ removeProp(p); }
      var g=ground[i]; if(g===G_GRASS||g===G_SHORT||g===G_WEB||!g) ground[i] = (g? G_ASH : G_SCORCH);
      continue;
    }
    var nb=[[1,0],[-1,0],[0,1],[0,-1]];
    for(var k=0;k<4;k++){
      var nx=x+nb[k][0], ny=y+nb[k][1]; if(!inb(nx,ny)) continue;
      var ni=idxOf(nx,ny), ng=ground[ni], np=propAt(nx,ny);
      if(fireT[ni]) continue;
      var ch = ng===G_GRASS ? 0.45 : ng===G_SHORT ? 0.18 : (np && np.burn) ? 0.25 : 0;
      if(ch && rng()<ch) next.push([nx,ny,fireSrc[i]]);
    }
  }
  next.forEach(function(n){ ignite(n[0],n[1], n[2]?'player':null); });
}

/* a trap may take a quarter of your health, never more: with the 2026-09-17 HP curve a raw roll could nearly
   kill a level 1 character outright */
function trapDmg(e, raw){ return (e===player) ? Math.max(2, Math.min(raw, Math.round(player.maxhp*0.25))) : raw; }
/* ---------------------------------------------------------------- traps */
function trapName(k){ return (TRAPS[k]||{name:k}).name; }
function triggerTrap(tr,e){
  if(tr.kind==='spikes'){
    if(e===player && (player.levitate>0 || player.st.stone || aff('earth')>=3)){ return; }
    /* 2026-09-17: spikes go straight through armor and hit harder (armor had cut them to ~3) */
    var d=applyDamage(e, roll(4,7)+floorNo, 'phys', SPIKES_SRC); floatText(e.x,e.y,String(d),'phys'); sfx('trap-dart');
    if(e===player){ log('Spikes drive up through your boots: '+d+' damage.','c-you'); if(player.hp<=0){  if(player.hp<=0) death(); } }
    else if(e.hp<=0) kill(e,null);
    return;
  }

  var info=TRAPS[tr.kind]||{};
  var isP = e===player, who = isP ? 'You' : 'The '+e.name;
  tr.found = true;
  var d;
  if(tr.kind==='dart'){ d=applyDamage(e, trapDmg(e, roll(4,8)+floorNo), 'phys', null); floatText(e.x,e.y,String(d),'phys'); if(rng()<0.5) applyStatus(e,'poison',4,2);
    log(who+' trigger'+(isP?'':'s')+' a dart trap &mdash; '+d+' damage.', isP?'c-you':'c-info'); sfx('trap-dart'); }
  else if(tr.kind==='fire'){ d=applyDamage(e, roll(4,7)+floorNo, 'fire', null); applyStatus(e,'burn',3,sDMG(2)); floatText(e.x,e.y,String(d),'fire'); ignite(e.x,e.y,null);
    burst(e.x,e.y,'fire',24,0.05); log('A fire vent erupts &mdash; '+d+' fire, burning.', isP?'c-you':'c-info'); sfx('trap-fire'); }
  else if(tr.kind==='frost'){ d=applyDamage(e, roll(3,6)+floorNo, 'ice', null); addChill(e); addChill(e); floatText(e.x,e.y,String(d),'ice'); burst(e.x,e.y,'ice',24,0.05);
    log('A frost jet blasts '+(isP?'you':e.name)+' &mdash; '+d+' ice, chilled.', isP?'c-you':'c-info'); sfx('trap-frost'); }
  else if(tr.kind==='spark'){ d=applyDamage(e, trapDmg(e, roll(4,8)+floorNo), 'lightning', null); if(rng()<0.5) applyStatus(e,'stun',1); floatText(e.x,e.y,String(d),'lightning'); burst(e.x,e.y,'lightning',18,0.06);
    log('A spark plate discharges &mdash; '+d+' lightning.', isP?'c-you':'c-info'); sfx('trap-spark'); }
  else if(tr.kind==='gas'){ for(var gy=-1;gy<=1;gy++) for(var gx=-1;gx<=1;gx++) ents.forEach(function(o){ if(o.x===e.x+gx && o.y===e.y+gy) applyStatus(o,'poison',6,2); });
    burst(e.x,e.y,'poison',40,0.05); log('Poison gas hisses from a vent.', isP?'c-you':'c-info'); sfx('trap-gas'); }
  else if(tr.kind==='web'){ applyStatus(e,'root',3); log('Webs! '+(isP?'You are':'The '+e.name+' is')+' stuck.','c-info'); sfx('trap-web'); }
  else if(tr.kind==='alarm'){ ents.forEach(function(o){ if(o.foe && dist(o,e)<=16){ o.state='hunt'; o.lastSeen={x:e.x,y:e.y}; } }); log('An alarm bell clangs! Everything nearby comes running.','c-you'); sfx('trap-alarm'); }
  else if(tr.kind==='teleport'){ var o2=[]; for(var y=0;y<MH;y++) for(var x=0;x<MW;x++) if(walkable(x,y)&&!occupied(x,y)&&inRoom(x,y)&&!roomAt(x,y).special) o2.push({x:x,y:y});   /* 2026-09-22 (Justin): never into a vault, toll room or hidden pocket - a locked room was an instant game over */
    var s=pick(o2); if(s){ sparkleFx(e.x,e.y,'magic',20); e.x=s.x; e.y=s.y; if(isP){ e._lx=undefined; computeFOV(); } sparkleFx(s.x,s.y,'magic',20); }
    log(who+(isP?' are':' is')+' whisked away by a teleport rune!', isP?'c-you':'c-info'); sfx('trap-teleport'); }
  else if(tr.kind==='pit'){
    if(isP){ log('The floor gives way!','c-you'); fallIntoChasm(); }
    else { log('The '+e.name+' falls into a pit!','c-info'); kill(e,null); }
  }
  if(info.once) feats=feats.filter(function(f){ return f!==tr; });
  if(e.hp<=0){ if(isP){  if(player.hp<=0) death(); } else kill(e,null); }

  if(tr.heavy && e.hp>0){ var hd=applyDamage(e, roll(3,6)+floorNo, 'phys', null); floatText(e.x,e.y,String(hd),'phys'); if(e===player){ log('The trap bites deep: '+hd+' more.','c-you'); if(player.hp<=0){  if(player.hp<=0) death(); } } else if(e.hp<=0) kill(e,null); }
}
function spotTraps(){
  /* 2026-09-17: at most one trap a turn, and traps set on purpose (a trap room, a puzzle) hide far better,
     so a trap room isn't laid bare the moment you look into it; searching still finds them */
  for(var i=0;i<feats.length;i++){
    var f=feats[i];
    if(f.found || !vis[idxOf(f.x,f.y)] || dist(player,f)>3) continue;
    var ch=(0.04 + 0.02*Math.max(0,player.stats.agi-10) + (isScoundrel()?0.12:0)) * ((f.room||f.puzzle) ? 0.2 : 1);
    if(rng()<ch){ f.found=true; log('You spot '+(/^[AEIOU]/.test(trapName(f.kind))?'an':'a')+' <b>'+trapName(f.kind)+' trap</b>.','c-info'); sfx('trap-spot'); break; }
  }
  props.forEach(function(p){});
  /* hidden doors are found by searching (F), not in passing */
}

/* ---------------------------------------------------------------- chests and loot */
function openChest(x,y){
  var kind=chestKind[idxOf(x,y)]||'chest-wood';
  if(kind==='chest-plane')return openPlaneChest(x,y);
  if(kind==='mimic'){
    setT(x,y,FLOOR); var m=spawn('mimic',x,y); m.state='hunt'; log('<b>The chest has teeth!</b> A mimic lunges.','c-you'); sfx('mimic-reveal'); SHAKE=6; return;
  }
  setT(x,y,FLOOR); sfx('chest-open'); sparkleFx(x,y,'light',14);
  addProp(x,y,'chest-wood-open',{flat:false, b:false, openChest:true});
  var rich = kind==='chest-ornate' || kind==='chest-crystal' || kind==='chest-elemental';
  var n = rich ? 3 : 1 + (rng()<0.5?1:0);
  for(var i=0;i<n;i++){
    var r=rng(), it;
    if(kind==='crate-supply') it = r<0.35 ? {kind:'food', food:randomFood()} : r<0.6 ? {kind:'sigil', use:randomSigilUse()} : {kind:'essence', n:ri(10,22)+floorNo*3};
    else if(r<0.22) it={kind:'mote', el:pick(ELEMENTS)};
    else if(r<0.64) it={kind:'essence', n:ri(10,22)+floorNo*3};
    else if(r<0.70) it={kind:'sigil', use:randomSigilUse()};
    else it=randomGear();
    var c = i===0 ? {x:player.x,y:player.y} : (nearFree(x,y,1)||{x:player.x,y:player.y});
    it.x=c.x; it.y=c.y; items.push(it);
  }
  log('The chest holds '+n+' thing'+(n>1?'s':'')+'.','c-kill');
  stepOn();
}


/* ---------------------------------------------------------------- sigils */
function shuffleSigils(){
  sigilLook={}; sigilKnown={};
  var looks=SIGIL_LOOKS.slice(), r=mulberry32((worldSeed^0x1234567)>>>0);
  for(var i=looks.length-1;i>0;i--){ var j=Math.floor(r()*(i+1)); var t=looks[i]; looks[i]=looks[j]; looks[j]=t; }
  RUN.sigilLooks={};
  Object.keys(SIGILS).forEach(function(k,i){ sigilLook[k]=cap(looks[i%looks.length])+' sigil'; RUN.sigilLooks[k]=looks[i%looks.length]; sigilKnown[k]=false; });
}
function sigilName(use){ return sigilKnown[use] ? SIGILS[use].name : sigilLook[use]; }
function identifySigil(use){
  if(sigilKnown[use]) return;
  sigilKnown[use]=true;
  player.bag.forEach(function(b){ if(b.kind==='sigil' && b.data.use===use) b.name=SIGILS[use].name; });
  log('It was a <b>'+SIGILS[use].name+'</b>: '+SIGILS[use].desc,'c-kill'); sfx('identify');
}


/* ---------------------------------------------------------------- inventory */


function grab(){
  if(gameTurns.busy())return false;
  var got=false;
  items.filter(function(it){ return it.x===player.x && it.y===player.y; }).forEach(function(it){
    var e=bagEntryFor(it); if(!e) return;
    if(addBag(e[0],e[1],e[2])){ removeItem(it); got=true; log('You pick up <b>'+itemLabel(it)+'</b>.','c-good'); sfx('pickup-item'); }
  });
  if(!got) log('Nothing here to pick up.','c-info');
  return got;
}
function consume(idx){ var it=player.bag[idx]; if(it.n>1) it.n--; else player.bag.splice(idx,1); }


function shootAt(e,preferred){
  if(!e)return false;
  if(gameTurns.busy()||playerFearAction())return false;
  var direction=reachLen()>=2&&reachDir(e);
  if(direction){lastDir=direction;reachAttack(e,direction);return true;}
  var line=projectileLine(player,e,{target:preferred,visible:true,range:player.range}),edge=line?line.to:entityPoint(e,player);
  if(dist(player,e)<=1){var dx=Math.sign(edge.x-player.x),dy=Math.sign(edge.y-player.y);lastDir=[dx,dy];tryMove(dx,dy);return true;}
  if(player.range<=1 || dist(player,e)>player.range || !actorVisible(e))return false;
  var path=line?line.path:boltPath(player.x,player.y,edge.x,edge.y),end=path[path.length-1];
  if(!end || !entityOccupies(e,end.x,end.y)){
    var front=end&&ents.find(function(other){return entityOccupies(other,end.x,end.y)&&other.hp>0;});
    if(!front||!front.foe){log(front?'Your '+front.name+' is in the way.':'Something is in the way.','c-info');return true;}
    log('The <b>'+front.name+'</b> is in the way and takes the arrow.','c-info');e=front;
  }
  var weapon=isRangedWeapon(player.ranged)?player.ranged:player.weapon;
  attack(player,e,1,weapon.name);
  player.hidden=0; endTurn(); return true;
}

/* ---------------------------------------------------------------- turn loop */


/* ---------------------------------------------------------------- floors */
function generateNextFloor(fell){
  if(floorNo>=LAST_FLOOR) return;
  floorNo++; worldSeed=(worldSeed*1664525+1013904223)>>>0;
  /* carrying your god deeper is itself devotion, and it is worth more the further down you are. This is the
     term that lands a devoted follower of ANY god at rank 5 during biome 4 (2026-09-17). */
  if(player.god && typeof gainPiety==='function') gainPiety(5 + floorNo);
  player.keys={iron:0, crystal:0};
  ents=ents.filter(function(e){ return !e.ally; });
  if(!fell) sfx('stairs');
  player.levitate=0; aiming=null;
  generate(worldSeed);
  if(typeof FoteShadowClone!=='undefined')FoteShadowClone.arrive();
  player._lx=undefined;
  resize();
  floorIntro();
  updateUI();
}

function wanderingSpawn(){
  if(floorMeta && floorMeta.plane)return;
  if(turn < nextSpawn) return;
  nextSpawn = turn + ri(45,75);   /* twice the former wandering encounter rate */
  var alive=ents.filter(function(e){ return e.foe; }).length;
  if(spawnedExtra >= 3 + floorNo || alive >= Math.round((10 + floorNo*2)*0.8)) return;
  var spots=[];
  for(var y=0;y<MH;y++) for(var x=0;x<MW;x++){
    if(!walkable(x,y) || vis[idxOf(x,y)] || dist(player,{x:x,y:y}) < 14 || occupied(x,y)) continue;
    spots.push({x:x,y:y});
  }
  if(!spots.length) return;
  var s=pick(spots);
  var kind = (rng()<0.06 && rollRare()) || rollMonster();
  var m=spawn(kind, s.x, s.y); m.state='wander'; spawnedExtra++;
  log(m.base.rare ? 'Something bright drifts, far off.' : 'Something moves, far off.', m.base.rare ? 'c-kill' : 'c-info');
}

/* ---------------------------------------------------------------- endings */

function victory(){
  if(RUN.victory) return;
  RUN.victory=true; stopMusic(); sfx('victory');   /* the fanfare is the victory sound; no victory music (Justin, 2026-09-22) */
  showEnd(true);
}


function useBagFood(idx){
  var it=player.bag[idx];if(!it||it.kind!=='food')return false;

    var fd=FOODS[it.data.food]; player.hunger=Math.min(HUNGER_MAX, player.hunger+fd.nutrition);
    if(fd.heal){ var h=Math.round(player.maxhp*fd.heal*(hasGod('glimmer')?1+0.10*godRank():1)); healPlayer(h); floatText(player.x,player.y,'+'+h,'heal'); }
    consume(idx); log('You eat the '+fd.name.toLowerCase()+'.','c-good'); sfx('eat');
    if(fd.buff && typeof eatFoodBuff==='function') eatFoodBuff(fd);
    endTurn(); return true;

}

function useBagSigil(idx){
  var it=player.bag[idx];if(!it||it.kind!=='sigil')return false;
 if(it.data.use==='transmutation')return useSigil(it.data.use,{entry:it});
 if(useSigil(it.data.use)===false) return false; consume(idx); endTurn(); return true;
}
