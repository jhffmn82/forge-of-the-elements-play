/* ============================================================================
   systems.js - moving and bumping, doors and keys, puzzles, traps, fire, props,
   inventory, hunger, the turn loop, floors, death and victory.
   ========================================================================== */

var BAG_MAX = 20;   /* 2026-09-17: 16 was too tight once sigils, keys and a ranged weapon compete for it */

/* ---------------------------------------------------------------- movement */
function tryMove(dx,dy){
  if(player.hp<=0 || RUN.victory) return;
  var f=faceOf(dx,dy); if(f) player.face=f;
  if(player.st.frozen){ log('You are frozen solid.','c-info'); endTurn(); return; }
  if(player.st.stun){ log('You are stunned.','c-info'); endTurn(); return; }
  var nx=player.x+dx, ny=player.y+dy;
  var foe=ents.filter(function(e){ return e.foe && e.x===nx && e.y===ny; })[0];
  if(foe){
    if(player.st.fear && rng()<0.5){ log('You are too afraid to attack.','c-info'); endTurn(); return; }
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
  if(t===EXIT && !floorMeta.exitOpen){ log('The gate is sealed. Grukk the Warchief holds its key in his will.','c-info'); sfx('door-locked'); return; }
  if(t===CHASM){
    if(player.levitate>0){ player.x=nx; player.y=ny; player.movedThisTurn=true; stepOn(); endTurn(); return; }
    log('A sheer drop into darkness. You would need to float to cross.','c-info'); return;
  }
  if(t===WALL && gAt(player.x,player.y)===G_TELL){ log('A draft whispers through the stones here. Something is behind this wall.','c-info'); }
  if(!walkable(nx,ny)) return;
  player.x=nx; player.y=ny; player.movedThisTurn=true;
  if(gAt(nx,ny)===G_GRASS){ setG(nx,ny,G_SHORT); sfx('step-grass'); }
  else if(t===WATER) sfx('step-water'); else sfx('step-stone',{vol:0.5});
  stepOn(); endTurn();
}
/* close an open door next to you: Shift+C closes every empty adjacent door, right-click closes one */
function doorClosable(x, y){
  if(at(x,y)!==OPEN) return false;
  if(Math.max(Math.abs(x-player.x), Math.abs(y-player.y))!==1) return false;
  if(itemAt(x,y) || propAt(x,y)) return false;
  for(var i=0;i<ents.length;i++) if(ents[i].x===x && ents[i].y===y) return false;
  return true;
}
function closeDoorAt(x, y){
  if(at(x,y)!==OPEN) return false;
  if(Math.max(Math.abs(x-player.x), Math.abs(y-player.y))!==1){ log('You need to stand next to the door.','c-info'); return true; }
  if(!doorClosable(x,y)){ log(x===player.x&&y===player.y ? 'Step out of the doorway first.' : 'Something is in the way of the door.','c-info'); return true; }
  setT(x,y,DOOR); log('You close the door.','c-info'); sfx('door-close'); computeFOV(); endTurn(); return true;
}
function closeAdjacentDoors(){
  var open=[], blocked=0;
  for(var dy=-1;dy<=1;dy++) for(var dx=-1;dx<=1;dx++){
    if(!dx && !dy) continue; var x=player.x+dx, y=player.y+dy;
    if(at(x,y)!==OPEN) continue;
    if(doorClosable(x,y)) open.push([x,y]); else blocked++;
  }
  if(!open.length){ log(at(player.x,player.y)===OPEN ? 'You are standing in the doorway. Step out of it to close the door.' : blocked ? 'Something is in the way of the door.' : 'There is no open door next to you.','c-info'); return; }
  open.forEach(function(c){ setT(c[0],c[1],DOOR); });
  log(open.length>1 ? 'You close the doors.' : 'You close the door.','c-info'); sfx('door-close'); computeFOV(); endTurn();
}

function stepOn(){
  var here=items.filter(function(it){ return it.x===player.x && it.y===player.y; });
  here.forEach(function(it){
    if(it.kind==='essence'){ removeItem(it); player.essence+=it.n; floatText(player.x,player.y,'+'+it.n,'magic'); log('Picked up '+it.n+' essence.','c-good'); sfx('pickup-essence'); }
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
  if(t===STAIRS) log('Stairs down to floor '+(floorNo+1)+'. Press <b>&gt;</b> or click <b>Stairs</b> to descend.','c-kill');
  if(t===EXIT && floorMeta.exitOpen){ if(floorNo<LAST_FLOOR) descend(); else victory(); }
  if(t===CHASM && !(player.levitate>0)) fallIntoChasm();
}
function removeItem(it){ var i=items.indexOf(it); if(i>=0) items.splice(i,1); }
function fallIntoChasm(){
  log('You fall!','c-you'); sfx('trap-pit');
  var d=Math.round(player.maxhp*0.15); player.hp-=d;
  if(player.hp<=0){ heroicResolve(); if(player.hp<=0){ death(); return; } }
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
    player.hp-=cost; player._hit=performance.now(); floatText(player.x,player.y,String(cost),'phys'); sfx('player-hurt');
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
    player.hp-=cost; player._hit=performance.now(); floatText(player.x,player.y,String(cost),'phys');
    if(player.hp<=0){ heroicResolve(); if(player.hp<=0){ death(); return; } }
    setT(x,y,OPEN); log('You tear through the thorns, bleeding.','c-you'); computeFOV(); endTurn();
  });
}
function bumpSealed(x,y){
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
function bumpProp(p){
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
    p.name = p.name==='lever-up' ? 'lever-down' : 'lever-up'; sfx('lever');
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
  if(p.drink){ var h=Math.round(player.maxhp*0.1); player.hp=Math.min(player.maxhp,player.hp+h); p.drink=false; log('You drink from the fountain. +'+h+' HP.','c-good'); floatText(player.x,player.y,'+'+h,'heal'); sfx('step-water'); endTurn(); return true; }
  if(p.br){ setClip(player,'melee'); lungeFx(player,p.x,p.y); damageProp(p, player, 'phys'); endTurn(); return true; }
  if(p.b){ log('The '+p.name.replace(/-/g,' ')+' is in the way.','c-info'); return true; }
  return false;
}
function damageProp(p, src, type){
  if(p.ex){ explode(p.x,p.y,src); return; }
  if(p.melt && (type==='fire')){ removeProp(p); log('The ice melts away.','c-info'); sfx('ice-melt'); return; }
  if(!p.br) return;
  removeProp(p); sfx(p.sfx||'crate-break'); burst(p.x,p.y,'earth',12,0.05);
  if(p.loot && rng()<p.loot){
    var roll2=rng(), it = roll2<0.74 ? {kind:'essence', n:ri(4,10)+floorNo} : roll2<0.78 ? {kind:'food', food:'bread'} : roll2<0.84 ? {kind:'sigil', use:randomSigilUse()} : {kind:'mote', el:pick(ELEMENTS)};
    it.x=p.x; it.y=p.y; items.push(it); log('Something rolls out of the '+p.name+'.','c-good');
  }
}
function explode(x,y,src){
  var p=propAt(x,y); if(p) removeProp(p);
  log('<b>BOOM!</b> The powder barrel explodes.','c-you'); sfx('explosion'); explosionFx(x,y);
  for(var dy=-1;dy<=1;dy++) for(var dx=-1;dx<=1;dx++){
    var tx=x+dx, ty=y+dy; if(!inb(tx,ty)) continue;
    ents.slice().forEach(function(e){ if(e.x===tx && e.y===ty){ var d=applyDamage(e, roll(8,14)+floorNo, 'fire', null); floatText(tx,ty,String(d),'fire'); applyStatus(e,'burn',3,sDMG(2));
      if(e.hp<=0){ if(e===player){ heroicResolve(); if(player.hp<=0) death(); } else kill(e, src==='player'||src===player ? 'player' : null); } } });
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
  confirmBox('Sacrifice altar', 'Press your hand onto the spikes for <b>'+cost+' HP</b>. Offerings so far: <b>'+a.passes+'</b>. Rewards at 3, 5 and 7.'+(lethal?'<br><span class="c-you"><b>This would kill you.</b></span>':''),
    lethal ? 'Offer anyway' : 'Offer blood', function(){
      player.hp-=cost; player._hit=performance.now(); floatText(player.x,player.y,String(cost),'phys'); sfx('player-hurt'); a.passes++;
      if(player.hp<=0){ heroicResolve(); if(player.hp<=0){ death(); return; } }
      if(a.passes===3||a.passes===5||a.passes===7){
        var c=nearFree(p.x,p.y,1)||{x:player.x,y:player.y};
        var reward = a.passes===3 ? {kind:'essence',n:25+floorNo*5} : a.passes===5 ? {kind:'sigil',use:randomSigilUse()} : (function(){ var g=randomGear(); if(g.it.plus!==undefined) g.it.plus=3; g.it.tier='Trusty'; return g; })();
        if(a.passes===7 && rng()<0.5) reward={kind:'mote',el:pick(ELEMENTS)};
        reward.x=c.x; reward.y=c.y; items.push(reward);
        log('The altar is pleased. A gift appears.','c-kill'); sfx('shrine-convert'); sparkleFx(p.x,p.y,'dark',30);
      } else log('The altar drinks. ('+a.passes+' offerings)','c-info');
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
  else if(tr.kind==='teleport'){ var o2=[]; for(var y=0;y<MH;y++) for(var x=0;x<MW;x++) if(walkable(x,y)&&!occupied(x,y)&&inRoom(x,y)) o2.push({x:x,y:y});
    var s=pick(o2); if(s){ sparkleFx(e.x,e.y,'magic',20); e.x=s.x; e.y=s.y; if(isP){ e._lx=undefined; computeFOV(); } sparkleFx(s.x,s.y,'magic',20); }
    log(who+(isP?' are':' is')+' whisked away by a teleport rune!', isP?'c-you':'c-info'); sfx('trap-teleport'); }
  else if(tr.kind==='pit'){
    if(isP){ log('The floor gives way!','c-you'); fallIntoChasm(); }
    else { log('The '+e.name+' falls into a pit!','c-info'); kill(e,null); }
  }
  if(info.once) feats=feats.filter(function(f){ return f!==tr; });
  if(e.hp<=0){ if(isP){ heroicResolve(); if(player.hp<=0) death(); } else kill(e,null); }
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
  if(kind==='mimic'){
    setT(x,y,FLOOR); var m=spawn('mimic',x,y); m.state='hunt'; log('<b>The chest has teeth!</b> A mimic lunges.','c-you'); sfx('mimic-reveal'); SHAKE=6; return;
  }
  setT(x,y,FLOOR); sfx('chest-open'); sparkleFx(x,y,'light',14);
  addProp(x,y,'chest-wood-open',{flat:false, b:false, openChest:true});
  var rich = kind==='chest-ornate' || kind==='chest-crystal' || kind==='chest-elemental';
  var n = rich ? 3 : 1 + (rng()<0.5?1:0);
  for(var i=0;i<n;i++){
    var r=rng(), it;
    if(kind==='crate-supply') it = r<0.35 ? {kind:'food', food:pick(['ration','bread'])} : r<0.6 ? {kind:'sigil', use:randomSigilUse()} : {kind:'essence', n:ri(10,22)+floorNo*3};
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
function itemLabel(it){
  if(it.kind==='essence') return it.n+' essence';
  if(it.kind==='mote') return 'a '+it.el+' mote';
  if(it.kind==='key') return 'an '+it.key+' key';
  if(it.kind==='food') return FOODS[it.food].name;
  if(it.kind==='sigil') return sigilName(it.use);
  return gearName(it.it);
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
function useSigil(use){
  var s=SIGILS[use];
  if(typeof sigilConduct==='function' && sigilConduct(use)===false) return false;
  sfx('sigil-use'); setClip(player,'cast');
  if(use==='firestorm'){ burst(player.x,player.y,'fire',60,0.12); ents.slice().forEach(function(e){ if(e.foe && dist(player,e)<=3){ var fd=applyDamage(e,8+floorNo,'fire',player); floatText(e.x,e.y,String(fd),'fire'); applyStatus(e,'burn',3,sDMG(2)); if(e.hp<=0) kill(e,player); } });
    for(var dy=-2;dy<=2;dy++) for(var dx=-2;dx<=2;dx++) if(dx||dy) ignite(player.x+dx,player.y+dy,'player'); log('Flames burst out around you.','c-fire'); }
  else if(use==='mana'){ var m=Math.round(player.maxmp*0.5); player.mp=Math.min(player.maxmp,player.mp+m); floatText(player.x,player.y,'+'+m,'ice'); log('Cool water fills your mind. +'+m+' mana.','c-good'); }
  else if(use==='levitate'){ player.levitate=25; log('You float a hand\'s width off the floor. (25 turns)','c-good'); sparkleFx(player.x,player.y,'lightning',20); }
  else if(use==='stoneskin'){ applyStatus(player,'stone',15); log('Your skin turns to stone.','c-good'); }
  else if(use==='heal'){ var q=Math.round(player.maxhp*0.35*(hasGod('glimmer')?1+0.10*godRank():1));
    if(player.race==='gloomling'){ var hd=applyDamage(player,Math.round(q/2),'light',null); floatText(player.x,player.y,String(hd),'light'); log('The Light sigil burns you! Gloomlings are hurt by holy light.','c-you'); if(player.hp<=0) death(); }
    else { player.hp=Math.min(player.maxhp,player.hp+q); floatText(player.x,player.y,'+'+q,'heal'); sparkleFx(player.x,player.y,'heal',24); log('Light mends you. +'+q+' HP.','c-good'); } }
  else if(use==='vanish'){ player.hidden=6; ents.forEach(function(e){ if(e.foe && e.state==='hunt'){ e.state='wander'; e.lastSeen=null; } }); log('Shadows swallow you.','c-good'); sfx('vanish'); }
  else if(use==='identify'){ Object.keys(SIGILS).forEach(function(k){ if(player.bag.some(function(b){ return b.kind==='sigil' && b.data.use===k; })) identifySigil(k); }); }
  else if(use==='mapping'){ for(var i=0;i<seen.length;i++) if(map[i]!==WALL || true) seen[i]=1; log('The shape of the whole floor settles into your mind.','c-good'); }
  else if(use==='blink'){ var spots=[]; for(var y=0;y<MH;y++) for(var x=0;x<MW;x++) if(walkable(x,y) && vis[idxOf(x,y)] && dist(player,{x:x,y:y})<=6 && dist(player,{x:x,y:y})>=3 && !occupied(x,y)) spots.push({x:x,y:y});
    if(spots.length){ var s2=pick(spots); sparkleFx(player.x,player.y,'magic',20); player.x=s2.x; player.y=s2.y; player._lx=undefined; sparkleFx(s2.x,s2.y,'magic',20); log('You blink away.','c-good'); } }
  identifySigil(use);
  return true;
}

/* ---------------------------------------------------------------- inventory */
function addBag(icon,name,extra){
  extra=extra||{};
  /* a weapon carried in the off hand goes back into the bag as a weapon, so it can be wielded again */
  if(extra.kind==='off' && extra.data && extra.data.kind==='weapon') extra={kind:'weapon', data:extra.data, uid:extra.uid};
  var uid=extra.uid || (extra.kind==='weapon'||extra.kind==='armor'||extra.kind==='off' ? 'g'+(nextId++) : name);
  var hit=player.bag.filter(function(b){ return b.uid===uid; })[0];
  if(hit){ hit.n++; return hit; }
  if(player.bag.length>=BAG_MAX){ log('Your bag is full.','c-info'); sfx('inventory-full'); return null; }
  var entry={icon:icon,name:name,n:1,uid:uid,kind:extra.kind,data:extra.data};
  player.bag.push(entry); return entry;
}
function bagEntryFor(it){
  if(it.kind==='weapon') return ['\u2694', gearName(it.it), {kind:'weapon', data:it.it}];
  if(it.kind==='armor') return ['\u26E8', gearName(it.it), {kind:'armor', data:it.it}];
  if(it.kind==='off') return ['\u26E8', gearName(it.it), {kind:'off', data:it.it}];
  if(it.kind==='sigil') return ['\u2726', sigilName(it.use), {kind:'sigil', data:{use:it.use}, uid:'sigil:'+it.use}];
  if(it.kind==='food') return ['\u{1F356}', FOODS[it.food].name, {kind:'food', data:{food:it.food}, uid:'food:'+it.food}];
  return null;
}
function grab(){
  var got=false;
  items.filter(function(it){ return it.x===player.x && it.y===player.y; }).forEach(function(it){
    var e=bagEntryFor(it); if(!e) return;
    if(addBag(e[0],e[1],e[2])){ removeItem(it); got=true; log('You pick up <b>'+itemLabel(it)+'</b>.','c-good'); sfx('pickup-item'); }
  });
  if(!got) log('Nothing here to pick up.','c-info');
  return got;
}
function consume(idx){ var it=player.bag[idx]; if(it.n>1) it.n--; else player.bag.splice(idx,1); }
function dropBagItem(idx){
  var b=player.bag[idx]; if(!b) return;
  var it = b.kind==='weapon'||b.kind==='armor'||b.kind==='off' ? {kind:b.kind, it:b.data} : b.kind==='sigil' ? {kind:'sigil', use:b.data.use} : b.kind==='food' ? {kind:'food', food:b.data.food} : null;
  if(!it) return;
  it.x=player.x; it.y=player.y; items.push(it); consume(idx); log('You drop '+itemLabel(it)+'.','c-info');
}
function equipConduct(kind, data){
  if(!player.god || typeof godConductEquip!=='function') return true;
  return godConductEquip(kind, data);
}
function useBagItem(idx){
  var it=player.bag[idx]; if(!it) return;
  if(it.kind==='off'){
    if(player.twoHanded){ log('Both hands are on the '+player.weapon.name+'.','c-info'); return; }
    equipConduct('off', it.data);
    var prevOff=player.off; player.off=it.data; player.bag.splice(idx,1);
    if(prevOff && prevOff!==EMPTY_OFF) addBag('\u26E8', gearName(prevOff), {kind:'off', data:prevOff});
    derive(player); log('You take up the <b>'+gearName(it.data)+'</b>.','c-good'); sfx('equip-weapon'); endTurn(); return;
  }
  if(it.kind==='weapon'){
    equipConduct('weapon', it.data);
    var old=player.sets[player.activeSet];
    player.sets[player.activeSet]=it.data; player.bag.splice(idx,1);
    if(old) addBag('\u2694', gearName(old), {kind:'weapon', data:old});
    derive(player); log('You equip the <b>'+gearName(it.data)+'</b>.','c-good'); sfx('equip-weapon');
    enforceHands(); endTurn(); return;
  }
  if(it.kind==='armor'){
    equipConduct('armor', it.data);
    var oldA=player.armorItem; player.armorItem=it.data; player.bag.splice(idx,1);
    if(oldA) addBag('\u26E8', gearName(oldA), {kind:'armor', data:oldA});
    derive(player); log('You put on the <b>'+gearName(it.data)+'</b>.','c-good'); sfx('equip-armor'); endTurn(); return;
  }
  if(it.kind==='food'){
    var fd=FOODS[it.data.food]; player.hunger=Math.min(HUNGER_MAX, player.hunger+fd.nutrition);
    if(fd.heal){ var h=Math.round(player.maxhp*fd.heal*(hasGod('glimmer')?1+0.10*godRank():1)); player.hp=Math.min(player.maxhp,player.hp+h); floatText(player.x,player.y,'+'+h,'heal'); }
    consume(idx); log('You eat the '+fd.name.toLowerCase()+'.','c-good'); sfx('eat'); endTurn(); return;
  }
  if(it.kind==='sigil'){ if(useSigil(it.data.use)===false) return; consume(idx); endTurn(); return; }
}
function equipFromBag(idx, slot){
  var it=player.bag[idx]; if(!it) return;
  if(slot==='main'){ if(it.kind!=='weapon'){ log('That is not a weapon.','c-info'); return; } useBagItem(idx); return; }
  if(slot==='armor'){ if(it.kind!=='armor'){ log('That is not armor.','c-info'); return; } useBagItem(idx); return; }
  if(slot==='off'){
    if(it.kind==='off') { useBagItem(idx); return; }
    if(it.kind!=='weapon' || it.data.hands===2 || !it.data.light){ log('Only a light weapon, shield or focus fits your off hand.','c-info'); return; }
    if(player.twoHanded){ log('Both hands are on the '+player.weapon.name+'.','c-info'); return; }
    /* 2026-09-17: the weapon itself goes into the off hand, keeping its tier, upgrades, enchantment, curse and identity */
    var old=player.off, d=it.data;
    offHandWeapon(d);
    player.off=d;
    player.bag.splice(idx,1); if(old && old!==EMPTY_OFF) addBag('\u26E8', gearName(old), {kind:'off', data:old});
    derive(player); log('You take the <b>'+it.data.name+'</b> in your off hand.','c-good'); endTurn();
  }
}
function enforceHands(){
  if(!player.twoHanded || !player.off || player.off===EMPTY_OFF) return;
  if(!(player.off.block || player.off.weapon)) return;
  var prev=player.off; player.off=EMPTY_OFF; derive(player);
  addBag('\u26E8', gearName(prev), {kind:'off', data:prev});
  log('Both hands are on the '+player.weapon.name+' &mdash; the '+prev.name+' goes into your bag.','c-info');
}
function swapWeapon(){
  if(!player.sets[1-player.activeSet]){ log('You have nothing stowed to swap to.','c-info'); return; }
  player.activeSet = 1 - player.activeSet;
  derive(player); log('You ready your <b>'+gearName(player.weapon)+'</b>.','c-info'); sfx('equip-weapon');
  enforceHands(); endTurn();
}
function shootAt(e){
  if(player.range<=1) return false;
  if(dist(player,e) > player.range || !vis[idxOf(e.x,e.y)]) return false;
  var path=boltPath(player.x,player.y,e.x,e.y), end=path[path.length-1];
  if(!end || end.x!==e.x || end.y!==e.y){ log('Something is in the way.','c-info'); return true; }
  var f=faceOf(e.x-player.x,e.y-player.y); if(f) player.face=f;
  attack(player, e, 1, gearName(player.weapon));
  player.hidden=0; endTurn(); return true;
}

/* ---------------------------------------------------------------- turn loop */
function endTurn(){
  if(player.hp<=0) return;
  if(player.hidden>0) player.hidden--;
  tickStatus(player);
  if(player.hp<=0){ heroicResolve(); if(player.hp<=0){ death(); return; } }
  var cost = player.movedThisTurn ? moveCost() : actCost(player);
  player.lastAttack=false;
  player.t += cost;
  player.movedThisTurn=false;
  turn++; RUN.turns++;
  if(player.blurCd>0) player.blurCd--;
  if(player.fortCd>0) player.fortCd--;
  var changed=false;
  for(var b in player.buffs){ if(player.buffs[b]>0){ player.buffs[b]--; if(player.buffs[b]===0){ changed=true; log(cap(b)+' fades.','c-info'); } } }
  if(changed) derive(player);
  if(player.levitate>0){ player.levitate--; if(player.levitate===0){ log('Your feet touch the ground again.','c-info'); if(at(player.x,player.y)===CHASM) fallIntoChasm(); } }
  /* hunger */
  var hungerRate = cost/100 * (player.race==='gloomling' ? 0.8 : 1);
  var before=player.hunger; player.hunger=Math.max(0, player.hunger-hungerRate);
  if(before>=300 && player.hunger<300) log('<b>You are getting hungry.</b> Eat something soon.','c-you');
  if(player.hunger<=0 && turn%5===0){ player.hp-=1; floatText(player.x,player.y,'1','phys'); if(turn%25===0) log('You are starving!','c-you'); }
  /* the world moves */
  refreshPlayerDistance();
  ents.slice().forEach(function(e){
    if(!e.foe && !e.ally) return;
    var guard=0;
    while(e.t < player.t && guard++ < 4 && ents.indexOf(e)>=0 && player.hp>0) (e.ally ? allyAct : aiAct)(e);
  });
  if(player.hp<=0){ death(); return; }
  fireTick();
  /* regeneration */
  var seesFoe = ents.some(function(e){ return e.foe && vis[idxOf(e.x,e.y)] && e.state==='hunt'; });
  /* regen per 100-speed turn, as a share of the max: HP refills in roughly 300 turns and mana in about 170 at 10 in the stat */
  var mpRate = (0.60 + 0.05*Math.max(0,player.stats.foc-10)) / 100 * (1 + (hasP('meditation')?0.25:0));
  if(hasP('tidalMind') && player.mp < player.maxmp/2) mpRate *= 2;
  var hpRate = (0.20 + 0.02*Math.max(0,player.stats.vit-10)) / 100;   /* slower: a full refill is ~500 turns at VIT 10 */
  if(hasP('resilient') && player.hp < player.maxhp/2) hpRate *= 2;
  if((player.armorItem||{}).enchant==='light') hpRate *= 1 + 0.5*enchantScale('light');
  if(hasGod('grumbok')) hpRate *= 1 + 0.25*godRank();
  if(hasGod('glimmer')) hpRate *= 1 + 0.10*godRank();
  if(player.hunger<=0 || player.st.poison || player.st.rot) hpRate=0;   /* Rot (Grave Bloat) stops regeneration */
  if(seesFoe) hpRate=0;                                                 /* wounds do not close while something hunts you */
  var scale=cost/100;
  player.mp = Math.min(player.maxmp, player.mp + player.maxmp*mpRate*scale);
  player.hp = Math.min(player.maxhp, player.hp + player.maxhp*hpRate*scale);
  if(!seesFoe && player.iceArmor<player.iceArmorMax) player.iceArmor=Math.min(player.iceArmorMax, player.iceArmor+0.25);
  spotTraps();
  if(!floorMeta.boss) wanderingSpawn();
  if(typeof godTick==='function') godTick(seesFoe);
  computeFOV(); draw(); updateUI();
  if(player.hp<=0) death();
}
function computeFOV(radius){
  radius = radius || 9;
  var r=roomAt(player.x,player.y);
  if(r && r.dark && !(player.aff.light>0) && !(player.aff.fire>0)) radius=2;
  vis.fill(0);
  vis[idxOf(player.x,player.y)]=1; seen[idxOf(player.x,player.y)]=1;
  for(var i=0;i<OCT.length;i++) castLight(player.x,player.y,1,1,0,OCT[i][0],OCT[i][1],OCT[i][2],OCT[i][3],radius);
}

/* ---------------------------------------------------------------- floors */
function descend(fell){
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
  player._lx=undefined;
  resize();
  floorIntro();
  updateUI();
}
function floorIntro(){
  log('<b>Floor '+floorNo+'</b> of the '+biomeName()+'.'+(bfloor()===1 && floorNo>1 ? ' The air turns cold and still.' : ''),'c-kill');
  if(floorMeta.forge) log('You feel heat in the stones. <b>The Elemental Forge</b> is on this floor.','c-kill');
  if(floorMeta.shrine) log('A distant hum of prayer: a <b>shrine to '+GODS[RUN.shrineGod].name+'</b> is on this floor.','c-kill');
  if(floorMeta.vault) log('Somewhere an iron vault is locked. Its key walks with one of the monsters.','c-info');
  if(floorMeta.boss) log('<b>The Warchief\'s hall.</b> Grukk waits on his throne. Kill him to open the way on.','c-you');
  (floorMeta.notes||[]).forEach(function(n){ log(n,'c-info'); });
  playMusic(floorMeta.boss ? 'dungeon' : floorMeta.forge ? 'forge' : 'dungeon');
}
function wanderingSpawn(){
  if(turn < nextSpawn) return;
  nextSpawn = turn + ri(90,150);
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
function death(){
  if(RUN.over) return;
  RUN.over=true;
  setClip(player,'death'); sfx('player-death'); stopMusic();
  setTimeout(function(){
    showEnd(false);
  }, 1300);
}
function victory(){
  if(RUN.victory) return;
  RUN.victory=true; sfx('victory'); playMusic('victory');
  showEnd(true);
}
function showEnd(won){
  var el=$('over'); if(!el) return;
  $('overT').textContent = won ? 'The '+biomeName()+' is behind you' : 'You died';
  $('overP').innerHTML = (won ? (floorNo>=10 ? player.name+' laid Morty the Mostly-Dead to rest for good. The Caverns wait below.<br><br>' : player.name+' cut through the Dungeon and threw down Grukk the Warchief. The Crypt waits below.<br><br>') :
    'Floor '+floorNo+' of the '+biomeName()+' claimed '+player.name+'.<br><br>') +
    '<b>'+player.who+'</b> &middot; level '+player.level+' &middot; '+RUN.turns+' turns &middot; '+RUN.kills+' kills'+
    (player.god ? '<br>Piety with '+GODS[player.god].name+': rank '+godRank() : '') +
    '<br>Affinity: '+(Object.keys(player.aff).map(function(k){ return cap(k)+' '+player.aff[k]; }).join(', ')||'none');
  el.style.display='flex';
}
