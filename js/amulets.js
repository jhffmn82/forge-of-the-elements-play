/* =====================================================================
   amulets.js - the amulet set (reworked 2026-09-16): tactical tools, not
   panic buttons. Each is used from the hotbar and stores up to 3 charges;
   kills build the next charge (elites and bosses count 3). Several are aimed like spells.
   Loads after gear.js and replaces its first-draft amulet code.
   ===================================================================== */

var AMULETS = {
  hook:     {name:'Amulet of the Hook',   kills:10, aim:true, range:5, desc:'Aim at an enemy within 5 to drag it next to you, or at a wall or closed door to haul yourself to it (over chasms and water too).'},
  swap:     {name:'Amulet of Exchange',   kills:8, aim:true, range:8, desc:'Trade places with any creature you can see.'},
  tide:     {name:'Amulet of the Tide',   kills:8, aim:true, range:6, desc:'Flood a 3x3 area with water for 20 turns. The wave sets off every trap in that room.'},
  seeking:  {name:'Amulet of Seeking',    kills:10,                    desc:'Reveal the floor within 16 tiles, with every trap and hidden door in it.'},
  pillar:   {name:'Amulet of the Pillar', kills:6, aim:true, range:5, desc:'Raise a stone pillar on an empty tile for 15 turns. It blocks movement and sight.'},
  stillness:{name:'Amulet of Stillness',  kills:15,                    desc:'Freeze time for 3 turns. Moving is free; attacking or any other action breaks the stillness.'},
  echo:     {name:'Amulet of Echoes',     kills:10,                    desc:'Read the last sigil you used again, without using one up.'},
  thorns:   {name:'Amulet of Thorns',     kills:8,                    desc:'Root yourself for 5 turns: a shield of 35% of your max HP, and melee attackers take half of their damage back.'},
  plenty:   {name:'Amulet of Plenty',     kills:20,                   desc:'Conjure a small ration at your feet.'}
};
var AMULET_LOOKS = ['sun','fang','eye','feather','skull','tear','star','knot','wheat'];

var AMULET_MAX_CHARGES = 3;
function amuletKillsNeeded(a){ return Math.max(2, Math.round(AMULETS[a.amulet].kills * (a.cursed ? 1.3 : 1 - 0.15*(a.plus||0)))); }
/* charges: how many uses are stored (0-3); progress: kills toward the next one. a.charge mirrors "kills until usable"
   for older code that only asks whether the amulet is ready. */
function amuletSync(a){ if(a.charges===undefined){ a.charges=1; a.progress=0; } a.charge = a.charges>0 ? 0 : Math.max(1, amuletKillsNeeded(a)-(a.progress||0)); }
makeAmulet = function(type, cursed){
  ensureTrinketLooks();
  /* 2026-09-18: one of each per run. Every drop rolled from the full list independently, so a run could hand
     you three Amulets of Plenty and never show you the Hook. Once all nine have turned up the list opens
     again, so a very long run still drops something. */
  if(!type){
    RUN.amuletsSeen = RUN.amuletsSeen || {};
    var all = Object.keys(AMULETS), fresh = all.filter(function(k){ return !RUN.amuletsSeen[k]; });
    type = pick(fresh.length ? fresh : all);
    RUN.amuletsSeen[type] = 1;
  }
  var plus = cursed ? 0 : (rng()<0.3 ? 1 : 0);
  return {kind:'amulet', amulet:type, name:AMULETS[type].name, plus:plus, cursed:!!cursed, unid:true, charges:1, progress:0, charge:0, uses:0, icon:'item-amulet-'+RUN.amuletLook[type]};
};
/* older saves or items made before the rework */
function amuletOk(a){ return a && AMULETS[a.amulet]; }

var _trinketCardBase = trinketCard;
trinketCard = function(it){
  if(it.kind!=='amulet') return _trinketCardBase(it);
  if(!amuletOk(it)) return '<div class="nm">'+gearName(it)+'</div><div class="hint">This amulet has lost its power.</div>';
  var known=!it.unid || RUN.amuletKnown[it.amulet];
  amuletSync(it);
  return '<div class="nm">'+gearName(it)+'</div>'+(known?'<div class="hint">'+AMULETS[it.amulet].desc+'</div><div class="row"><span>Kills per charge</span><b>'+(it.unid?'?':amuletKillsNeeded(it))+'</b></div>':'')+
    '<div class="row"><span>Charges</span><b>'+it.charges+' / '+AMULET_MAX_CHARGES+'</b></div>'+
    (it.charges<AMULET_MAX_CHARGES && !it.unid?'<div class="row"><span>Next charge</span><b>'+(amuletKillsNeeded(it)-(it.progress||0))+' more kills</b></div>':'')+
    (it.cursed && !it.unid?'<div class="hint" style="color:#D0605A">Cursed: charges build 30% slower, every use costs 10% of your current HP, and it will not come off.</div>':'')+unidHint(it)+
    '<div class="hint">Put it on, then use it from the hotbar. Stores up to 3 charges; kills build them (elites and bosses count 3).</div>';
};

/* ---------------------------------------------------------------- recharge from kills */
var _killAmulet = kill;
kill = function(e, by){
  var counts = e && e!==player && e.foe && (by===player || (by && by.ally)) && ents.indexOf(e)>=0;
  _killAmulet(e, by);
  var a=player.amulet;
  if(counts && a && amuletOk(a)){
    amuletSync(a);
    if(a.charges<AMULET_MAX_CHARGES){
      a.progress=(a.progress||0) + ((e.elite||e.base.elite||e.base.boss)?3:1);
      var need=amuletKillsNeeded(a), gained=0;
      while(a.progress>=need && a.charges<AMULET_MAX_CHARGES){ a.progress-=need; a.charges++; gained++; }
      if(a.charges>=AMULET_MAX_CHARGES) a.progress=0;
      if(gained){ log('Your <b>'+gearName(a)+'</b> gains a charge ('+a.charges+'/'+AMULET_MAX_CHARGES+').','c-good'); sfx('pickup-essence'); }
    }
    amuletSync(a);
  }
};

/* ---------------------------------------------------------------- using one */
function spendAmulet(a){
  amuletSync(a); a.charges=Math.max(0,a.charges-1); amuletSync(a);
  var first=a.unid && !RUN.amuletKnown[a.amulet];
  RUN.amuletKnown[a.amulet]=true;
  a.uses=(a.uses||0)+1; useCount(a, 'amulet');
  refreshBagNames();
  if(first) log('It is an <b>'+AMULETS[a.amulet].name+'</b>!','c-kill');
  if(a.cursed){ var c=Math.max(1, Math.round(player.hp*0.10)); player.hp-=c; floatText(player.x,player.y,String(c),'dark'); log('The cursed amulet drinks '+c+' HP.','c-you'); }
}
useAmulet = function(){
  var a=player.amulet; if(!a){ log('You are not wearing an amulet.','c-info'); return; }
  if(!amuletOk(a)){ log('This amulet has lost its power.','c-info'); return; }
  amuletSync(a);
  if(a.charges<=0){ log('The '+gearName(a)+' has no charges. '+a.charge+' more kill'+(a.charge>1?'s':'')+' for the next.','c-info'); sfx('ui-error'); return; }
  var A=AMULETS[a.amulet];
  if(A.aim){
    if(aiming && aiming.amulet){ cancelAim(); return; }
    aiming={amulet:true, A:{name:A.name, range:A.range, kind:'amulet'}};
    log('<b>'+(a.unid && !RUN.amuletKnown[a.amulet] ? 'The amulet' : A.name)+'</b> &mdash; click a target within '+A.range+' tiles, or press Esc.','c-info');
    abilityBar(); draw(); return;
  }
  var k=a.amulet;
  if(k==='echo' && !player.lastSigil){ log('The amulet has no sigil to echo yet. Read one first.','c-info'); return; }
  spendAmulet(a); setClip(player,'cast'); sfx('sigil-use');
  if(k==='seeking') amuletSeeking();
  else if(k==='stillness'){ player.stillness=3; log('<b>Time stops.</b> Move freely; any other action starts it again.','c-kill'); sparkleFx(player.x,player.y,'ice',30); draw(); updateUI(); return; }
  else if(k==='echo'){ log('The amulet echoes your last sigil.','c-good'); player._echoing=true; useSigil(player.lastSigil); player._echoing=false; }
  else if(k==='plenty'){ items.push({x:player.x, y:player.y, kind:'food', food:'ration'}); log('A ration drops at your feet.','c-good'); sparkleFx(player.x,player.y,'light',16); }
  else if(k==='thorns'){
    applyStatus(player,'root',5); player.buffs.thorns=5; player.buffs.arcaneward=Math.max(player.buffs.arcaneward||0,5);
    player.ward=Math.max(player.ward||0, Math.round(player.maxhp*0.35)); derive(player);
    log('Thorns burst from the ground around your feet. You are rooted and warded ('+player.ward+').','c-good'); sparkleFx(player.x,player.y,'earth',30);
  }
  endTurn();
};

/* aimed amulets resolve through the normal click-to-aim flow */
var _castAtAmulet = castAt;
castAt = function(x,y){
  if(!(aiming && aiming.amulet)) return _castAtAmulet(x,y);
  var a=player.amulet, k=a && a.amulet;
  if(!amuletOk(a)){ aiming=null; return false; }
  if(dist(player,{x:x,y:y})>AMULETS[k].range || !inb(x,y) || !(revealAll||vis[idxOf(x,y)])){ log('Out of range.','c-info'); sfx('ui-error'); return false; }
  var ok = k==='hook' ? amuletHook(x,y,true) : k==='swap' ? amuletSwap(x,y,true) : k==='tide' ? true : k==='pillar' ? amuletPillar(x,y,true) : false;
  if(!ok) return false;
  aiming=null; spendAmulet(a); setClip(player,'cast'); sfx('sigil-use');
  if(k==='hook') amuletHook(x,y); else if(k==='swap') amuletSwap(x,y); else if(k==='tide') amuletTide(x,y); else if(k==='pillar') amuletPillar(x,y);
  abilityBar(); endTurn(); return true;
};

/* Hook: pull an enemy in, or pull yourself to a wall / closed door. check=true only validates. */
/* NOTE: do not add a lineTiles alias here: js/elements.js defines its own lineTiles(dx,dy,len) and loads later,
   which silently broke the Hook. Call boltPathRaw directly. */
function boltPathRaw(x0,y0,x1,y1){
  var out=[], dx=Math.abs(x1-x0), dy=Math.abs(y1-y0), sx=x0<x1?1:-1, sy=y0<y1?1:-1, err=dx-dy, x=x0, y=y0;
  while(!(x===x1&&y===y1)){ var e2=2*err; if(e2>-dy){ err-=dy; x+=sx; } if(e2<dx){ err+=dx; y+=sy; } out.push({x:x,y:y}); }
  return out;
}
function amuletHook(x,y,check){
  var foe=ents.filter(function(e){ return e.x===x && e.y===y && e.foe; })[0];
  var path=boltPathRaw(player.x,player.y,x,y);
  if(foe){
    if(foe.base.boss){ if(!check) return false; log('Grukk is far too heavy to drag.','c-info'); return false; }
    /* the first free tile next to you on the line */
    var land=null;
    for(var i=0;i<path.length-1;i++){ var t=path[i]; if(!walkable(t.x,t.y) || occupied(t.x,t.y)){ break; } land=t; break; }
    for(var j=0;j<path.length-1;j++){ var tt=path[j]; if(!(walkable(tt.x,tt.y) || at(tt.x,tt.y)===WATER || at(tt.x,tt.y)===CHASM)){ if(check) log('Something is in the way.','c-info'); return false; } }
    if(!land){ if(check) log('It is already next to you.','c-info'); return !check ? false : false; }
    if(check) return true;
    sparkleFx(foe.x,foe.y,'phys',10); foe.x=land.x; foe.y=land.y; foe._lx=undefined; foe.state='hunt';
    applyStatus(foe,'stun',1); log('The chain whips out and drags the '+foe.name+' to you.','c-good'); sfx('swing');
    if(at(foe.x,foe.y)===CHASM && !foe.base.flying){ log('The '+foe.name+' tumbles into the chasm!','c-kill'); kill(foe, player); }
    return true;
  }
  var t0=at(x,y);
  var anchor = isWallLike(t0) || t0===DOOR || t0===LOCKED || t0===SEALED || t0===ICEDOOR || (propAt(x,y) && propAt(x,y).b);
  if(!anchor){ if(check) log('The hook needs an enemy, a wall, a closed door or something solid to catch on.','c-info'); return false; }
  var dest=null;
  for(var k=0;k<path.length-1;k++){
    var p=path[k], tt2=at(p.x,p.y);
    if(occupied(p.x,p.y) || isWallLike(tt2) || (propAt(p.x,p.y)&&propAt(p.x,p.y).b)) break;
    if(walkable(p.x,p.y)) dest=p;
  }
  if(!dest || (dest.x===player.x && dest.y===player.y)){ if(check) log('There is no room to haul yourself there.','c-info'); return false; }
  if(check) return true;
  sparkleFx(player.x,player.y,'phys',10); player.x=dest.x; player.y=dest.y; player._lx=undefined;
  log('You hook the '+(isWallLike(t0)?'wall':'far side')+' and haul yourself across.','c-good'); sfx('swing');
  if(typeof stepOn==='function') stepOn();
  computeFOV();
  return true;
}
function amuletSwap(x,y,check){
  var who=ents.filter(function(e){ return e.x===x && e.y===y; })[0];
  if(!who){ if(check) log('Aim at a creature.','c-info'); return false; }
  if(who.base && who.base.boss){ if(check) log('Grukk will not be moved.','c-info'); return false; }
  if(check) return true;
  var px=player.x, py=player.y;
  player.x=who.x; player.y=who.y; who.x=px; who.y=py; player._lx=undefined; who._lx=undefined;
  sparkleFx(px,py,'magic',16); sparkleFx(player.x,player.y,'magic',16); sfx('vanish');
  log('You trade places with the '+who.name+'.','c-good');
  if(typeof stepOn==='function') stepOn();
  computeFOV(); return true;
}
function amuletTide(x,y){
  floorMeta.tides=floorMeta.tides||[];
  var cells=[];
  for(var dy=-1;dy<=1;dy++) for(var dx=-1;dx<=1;dx++){
    var cx=x+dx, cy=y+dy; if(!inb(cx,cy)) continue;
    if(at(cx,cy)===FLOOR){ cells.push([cx,cy,FLOOR,gAt(cx,cy)]); setT(cx,cy,WATER); setG(cx,cy,0); }
    fireT[idxOf(cx,cy)]=0;
    ents.forEach(function(e){ if(e.x===cx && e.y===cy && e.st){ if(e.st.burn) delete e.st.burn; e.st.wet={t:6}; } });
  }
  floorMeta.tides.push({cells:cells, until:turn+20});
  burst(x,y,'ice',40,0.08); sfx('step-water');
  log('Water surges out and floods the floor.','c-good');
  /* the wave runs through the whole room and trips its traps */
  var room=roomAt(x,y); if(!room) return;
  var tripped=0;
  feats.slice().forEach(function(f){
    if(f.x<room.x || f.x>=room.x+room.w || f.y<room.y || f.y>=room.y+room.h) return;
    var victim = (player.x===f.x && player.y===f.y) ? player : ents.filter(function(e){ return e.x===f.x && e.y===f.y; })[0];
    if(victim){ triggerTrap(f, victim); }
    else { f.found=true; burst(f.x,f.y,'ice',10,0.05); if(f.kind==='alarm') ents.forEach(function(e){ if(e.foe && e.state==='asleep' && dist(e,f)<=10) e.state='hunt'; }); feats=feats.filter(function(o){ return o!==f; }); }
    tripped++;
  });
  if(tripped) log('The wave sets off <b>'+tripped+'</b> trap'+(tripped>1?'s':'')+' in the room.','c-kill');
}
function amuletSeeking(){
  var R=16, n=0, doors=0;
  for(var y=player.y-R;y<=player.y+R;y++) for(var x=player.x-R;x<=player.x+R;x++){
    if(!inb(x,y)) continue; seen[idxOf(x,y)]=1;
    if(at(x,y)===SECRET){ setT(x,y,DOOR); doors++; }
  }
  feats.forEach(function(f){ if(!f.found && Math.max(Math.abs(f.x-player.x),Math.abs(f.y-player.y))<=R){ f.found=true; n++; } });
  ringFx(player.x,player.y,'#9FD8FF',5);
  log('The floor around you settles into your mind'+(n?': <b>'+n+'</b> trap'+(n>1?'s':''):'')+(doors?(n?' and ':': ')+'<b>'+doors+'</b> hidden door'+(doors>1?'s':''):'')+'.','c-kill');
  computeFOV();
}
function amuletPillar(x,y,check){
  if(!(at(x,y)===FLOOR || at(x,y)===OPEN) || occupied(x,y) || propAt(x,y) || itemAt(x,y)){ if(check) log('The pillar needs an empty tile.','c-info'); return false; }
  if(check) return true;
  addProp(x,y,'pillar',{b:1, pillar:true, until:turn+15});
  burst(x,y,'earth',24,0.06); SHAKE=4; sfx('crate-break');
  log('A stone pillar grinds up out of the floor.','c-good');
  computeFOV(); return true;
}
/* pillars block sight */
var _opaqueAmulet = opaque;
opaque = function(x,y){ if(_opaqueAmulet(x,y)) return true; var p=propGrid && propAt(x,y); return !!(p && p.pillar); };

/* ---------------------------------------------------------------- the turn: stillness, tides and pillars wearing off, thorns */
var _endTurnAmulet = endTurn;
endTurn = function(){
  if(player && player.stillness>0 && player.hp>0){
    if(player.movedThisTurn){
      player.movedThisTurn=false; player.stillness--;
      if(player.stillness===0) log('Time lurches back into motion.','c-info');
      computeFOV(); draw(); updateUI(); return;       /* the world does not move */
    }
    player.stillness=0; log('Your action breaks the stillness.','c-info');
  }
  _endTurnAmulet();
  if(!floorMeta) return;
  if(floorMeta.tides) floorMeta.tides=floorMeta.tides.filter(function(t){
    if(turn<t.until) return true;
    t.cells.forEach(function(c){ if(at(c[0],c[1])===WATER){ setT(c[0],c[1],c[2]); setG(c[0],c[1], c[3]===G_GRASS?0:G_PUDDLE); } });
    return false;
  });
  props.slice().forEach(function(p){ if(p.pillar && turn>=p.until){ removeProp(p); burst(p.x,p.y,'earth',14,0.05); computeFOV(); } });
};
var _attackAmulet = attack;
attack = function(att, def, mult, label){
  var thorn = def===player && att!==player && att && att.hp>0 && player.buffs && player.buffs.thorns>0 && dist(att,def)<=1;
  var before = player.hp + (player.ward||0) + (player.iceArmor||0);
  var r=_attackAmulet(att, def, mult, label);
  if(thorn){
    var taken = before - (player.hp + (player.ward||0) + (player.iceArmor||0));
    if(taken>0 && att.hp>0){ var back=Math.max(1,Math.round(taken*0.5)); var d=applyDamage(att, back, 'phys', player); floatText(att.x,att.y,String(d),'poison'); if(att.hp<=0) kill(att,player); }
  }
  return r;
};
/* remember the last sigil read from the bag, for Echo */
var _useSigilAmulet = useSigil;
useSigil = function(use){ var r=_useSigilAmulet(use); if(r!==false && !player._echoing) player.lastSigil=use; return r; };

/* ---------------------------------------------------------------- hotbar display: kills to go instead of turns */
var _abilityBarAmulet = abilityBar;
abilityBar = function(){
  _abilityBarAmulet();
  var btns=$('hotbar').querySelectorAll('.slot[data-i]');
  for(var i=0;i<btns.length;i++){
    var idx=+btns[i].getAttribute('data-i'), s=player.hotbar[idx], a=player.amulet;
    if(!s || s.type!=='amulet' || !a) continue;
    var c=btns[i].querySelector('.c'); if(!c) continue;
    amuletSync(a);
    c.textContent = aiming && aiming.amulet ? 'aiming...' : a.charges+'/'+AMULET_MAX_CHARGES+' charges'+(a.charges<AMULET_MAX_CHARGES ? ' · '+(amuletKillsNeeded(a)-(a.progress||0))+' kills' : '');
    btns[i].disabled = a.charges<=0;
    if(aiming && aiming.amulet) btns[i].classList.add('armed');
  }
};
