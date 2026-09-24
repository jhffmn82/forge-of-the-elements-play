/* =====================================================================
   elements.js - elemental ranks 3-6 (mechanics review 2026-09-16,
   DESIGN.md 12 steps 1 and 6, and 6.7c "Element ability ladder").
   Rank 3 passive (+ immunity to the element's status), rank 4 area spell
   (70 mana), rank 5 ultimate (100 mana), rank 6 passive (+ immunity to the
   element's damage; Fire, Water, Earth and Light spells mark the ground).
   ===================================================================== */

/* ---------------------------------------------------------------- tables */
ELEMENT_ABILS = {
  fire:  {2:'firebolt',   4:'fireball',     5:'livingflame'},
  water: {2:'frostshard', 4:'frostcone',    5:'glacialtomb'},
  air:   {2:'spark',      4:'chainbolt',    5:'stormform'},
  earth: {2:'root',       4:'earthquake',   5:'upheaval'},
  light: {2:'smite',      4:'radiantbeam',  5:'dawn'},
  shadow:{2:'shadowbolt', 4:'shadowswarm',  5:'umbral'}
};
var AOE_BASE = [14,22];

   /* DESIGN: radius 5 (Justin, 2026-09-22: it was 3) */

var AIM_KINDS = {blast:1, cone:1, chain:1, beam:1, swarm:1, lflame:1, tomb:1, upheaval:1, umbral:1};

var RANK_TEXT = {
  3:{fire:'Searing: Burning enemies take 15% more damage from you. Immune to Burning.',
     water:'Shatter: Frozen enemies take a further +50% physical damage. Immune to Chill and Freeze.',
     air:'Arc: 5% per Air point that any hit or spell arcs to a nearby enemy for 50%. Immune to Stun.',
     earth:'Venom: anything you Root is poisoned as it is pinned (10% of max HP a turn; half on bosses). Immune to Root.',
     light:'Radiance: heal 1 HP per Light point whenever you deal light damage. Immune to Blind.',
     shadow:'Fade: after 50 turns out of combat you are fully hidden. Immune to Fear.'},
  6:{fire:'Wildfire: when a Burning enemy dies its fire leaps to the nearest enemy within 3. Fire spells leave flames for 3 turns. Immune to fire.',
     water:'Deep Freeze: three Chills freeze. Ice spells leave icy ground that Chills for 3 turns. Immune to ice.',
     air:'Lightning Reflexes: 15% of your attacks and spells take no time; lightning damage has a 15% stun chance. Immune to lightning.',
     earth:'Petrify: rooting a rooted enemy turns it to stone for 2 turns. Earth spells leave grasping roots for 3 turns. Immune to poison.',
     light:'Consecration: your Light spells and your Smite sanctify the ground for 3 turns, burning enemies on it (undead double). Immune to light.',
     shadow:'Hollowing: your dark damage stacks Hollow (max 5, 5 turns): +5% damage taken and -1 armor per stack. Immune to dark.'}
};
var IMMUNE_TYPE = {fire:'fire', water:'ice', air:'lightning', earth:'poison', light:'light', shadow:'dark'};
function aff(el){ return (player && player.aff && player.aff[el]) || 0; }

/* Snapshot the same summon values for casting and live descriptions. */
function shadowSwarmStats(A){
  var base=A.summon, power=spellPower(A);
  return {hp:Math.max(1,Math.round(base.hp*power)),damage:Math.max(1,Math.round(base.damage*power)),duration:Math.max(1,Math.round(base.duration*power))};
}

/* ---------------------------------------------------------------- ground effects (rank 6) */
var iceG=null, rootG=null, holyG=null;
function groundReset(){ var n=MW*MH; iceG=new Uint8Array(n); rootG=new Uint8Array(n); holyG=new Uint8Array(n); }
function markGround(tiles, A){
  if(!iceG) groundReset();
  tiles.forEach(function(t){
    var x=t[0], y=t[1]; if(!inb(x,y) || !walkable(x,y)) return; var i=idxOf(x,y);
    if(A.el==='fire' && aff('fire')>=6 && at(x,y)!==WATER){ fireT[i]=Math.max(fireT[i],3); fireSrc[i]=1; }
    if(A.el==='water' && aff('water')>=6) iceG[i]=3;
    if(A.el==='earth' && aff('earth')>=6) rootG[i]=3;
    if(A.el==='light' && aff('light')>=6) holyG[i]=3;
  });
}


function drawElementGroundTelegraphs(now){

  if(!iceG || iceG.length!==MW*MH) return;
  ctx.save();
  for(var i=0;i<iceG.length;i++){
    if(!iceG[i] && !rootG[i] && !holyG[i]) continue;
    var x=i%MW, y=(i/MW)|0; if(!(revealAll||vis[i])) continue;
    var px=(x-camX)*TS, py=(y-camY)*TS;
    if(iceG[i]){ ctx.fillStyle='rgba(150,210,255,0.28)'; ctx.fillRect(px+1,py+1,TS-2,TS-2); }
    if(rootG[i]){ ctx.strokeStyle='rgba(127,160,90,0.8)'; ctx.lineWidth=Math.max(1,TS*0.05); ctx.beginPath(); ctx.moveTo(px+TS*0.2,py+TS*0.8); ctx.lineTo(px+TS*0.45,py+TS*0.35); ctx.moveTo(px+TS*0.55,py+TS*0.85); ctx.lineTo(px+TS*0.75,py+TS*0.3); ctx.stroke(); }
    if(holyG[i]){ ctx.fillStyle='rgba(255,236,160,0.22)'; ctx.fillRect(px+1,py+1,TS-2,TS-2); }
  }
  ents.forEach(function(e){ if(e.tomb>0 && (revealAll||vis[idxOf(e.x,e.y)])){ var rp=renderPos(e), px=(rp.x-camX)*TS, py=(rp.y-camY)*TS; ctx.fillStyle='rgba(170,220,255,0.35)'; ctx.fillRect(px+2,py+2,TS-4,TS-4); ctx.strokeStyle='rgba(220,245,255,0.9)'; ctx.lineWidth=2; ctx.strokeRect(px+3,py+3,TS-6,TS-6); } });
  ctx.restore();

}

/* ---------------------------------------------------------------- statuses: immunities, Deep Freeze, Petrify, poison */
function applyPoison(e, announce, turns){
  if(!e || e.hp<=0 || e===player) return;
  var big=e.base && e.base.boss;
  /* once it is in, the root wearing off does not stop it (2026-09-17); a caller may set the duration (Venom Strike: 3) */
  gameEffects.apply(e,'poison',turns||Math.min(3,Math.max(1,aff('earth')-2)),Math.max(1,Math.round(e.maxhp*0.10*(big?0.5:1))),{durationModifiers:false,refresh:'replace'});
  if(announce){
    if(typeof floatText==='function') floatText(e.x, e.y, 'poisoned', 'poison');
    if(typeof log==='function' && vis[idxOf(e.x,e.y)]) log('<b>Venom.</b> The rooted '+e.name+' is poisoned: '+e.st.poison.d+' a turn for '+e.st.poison.t+' turn'+(e.st.poison.t===1?'':'s')+'.','c-good');
  }
}

/* ---------------------------------------------------------------- damage: immunities, Searing, Hollow, Venom, Arc, Radiance, Reflexes */
var ARCING=false;


/* spell and ability status chances grow with the element */


/* Wildfire */


/* ---------------------------------------------------------------- enemies: tomb, stone, ground */


/* rank 6 ground ticks once a world turn */
function groundTick(){
  if(!iceG || iceG.length!==MW*MH) return;
  ents.slice().forEach(function(e){
    if(!e.foe || e.hp<=0) return; var i=idxOf(e.x,e.y);
    if(iceG[i]) addChill(e);
    if(holyG[i]){ var d=applyDamage(e, sDMG(3+aff('light'))*((e.base.undead||e.base.shadowy)?2:1), 'light', player); floatText(e.x,e.y,String(d),'light'); if(e.hp<=0) kill(e,player); }
  });
  for(var k=0;k<iceG.length;k++){ if(iceG[k]) iceG[k]--; if(rootG[k]) rootG[k]--; if(holyG[k]) holyG[k]--; }
}

/* ---------------------------------------------------------------- the player's turn: Fade, Reflexes, Storm Form, Upheaval */
var FREE_ACTION=false;


function turnElementAfterAction(context){  /* Fade (Shadow 3) */
  var fighting=ents.some(function(e){ return e.foe && e.state==='hunt' && vis[idxOf(e.x,e.y)]; });
  player.calm = fighting || context.noisy ? 0 : (player.calm||0)+1;
  if(aff('shadow')>=3 && player.calm>=(16-2*aff('shadow')) && !(player.hidden>1)) player.hidden=2;
  /* Upheaval walls crumble */
  var up=floorMeta && floorMeta.upheaval;
  if(up && up.length){
    floorMeta.upheaval=up.filter(function(w){
      if(turn<w.until) return true;
      if(at(w.x,w.y)===WALL) setT(w.x,w.y,FLOOR);
      return false;
    });
    if(floorMeta.upheaval.length!==up.length){ log('The raised stone crumbles.','c-info'); computeFOV(); }
  }

}

/* ---------------------------------------------------------------- casting the new spells */
function spellRoll(A){ var b=sDMG(roll(AOE_BASE[0],AOE_BASE[1])) + (aff('fire') && !A.divine ? aff('fire') : 0); return Math.round(b*spellPower(A)); }

function finishHit(f){ if(f && f.hp<=0 && ents.indexOf(f)>=0) kill(f, player); }
function beginCast(A){
  aiming=null;
  spendSpellMana(A);
  if(typeof spellConduct==='function') spellConduct(A);
  player.noisy=true;
  setClip(player,'cast');
  sfx(A.el==='fire'?'fire-cast':A.el==='water'?'ice-cast':A.el==='air'?'lightning-cast':A.el==='earth'?'earth-cast':A.el==='light'?'light-cast':'shadow-cast');
}
function foeAt(x,y){ return ents.filter(function(e){ return e.foe && e.x===x && e.y===y; })[0]; }
function summonCount(){ return ents.filter(function(e){ return e.ally && (e.undeadServant || e.livingFlame); }).length; }


function lineTiles(dx,dy,len){ var out=[], x=player.x, y=player.y; for(var i=0;i<len;i++){ x+=dx; y+=dy; if(!inb(x,y) || opaque(x,y)) break; out.push([x,y]); } return out; }
function bresenham(x0,y0,x1,y1,len){ var pts=[], dx=Math.abs(x1-x0), dy=Math.abs(y1-y0), sx=x0<x1?1:-1, sy=y0<y1?1:-1, err=dx-dy, x=x0, y=y0;
  while(pts.length<len && !(x===x1 && y===y1)){ var e2=2*err; if(e2>-dy){ err-=dy; x+=sx; } if(e2<dx){ err+=dx; y+=sy; } pts.push([x,y]); } return pts; }


/* ranged summons (Living Flame) */

function livingFlameBehavior(e){
  if(!e.rangedAlly) return false;
  if(e.hp<=0)return true; if(e.life<=0){ ents=ents.filter(function(o){ return o!==e; }); log('Your '+e.name+' gutters out.','c-info'); return true; }

  var tgt=ents.filter(function(o){ if(!o.foe || o.hp<=0 || !vis[idxOf(o.x,o.y)] || dist(e,o)>e.rangedAlly) return false; var pth=boltPath(e.x,e.y,o.x,o.y), en=pth[pth.length-1]; return en && en.x===o.x && en.y===o.y; })
    .sort(function(a,b){ return dist(a,e)-dist(b,e); })[0];
  if(tgt){
    setClip(e,'attack'); boltFx(e.x,e.y,tgt.x,tgt.y,'fire');
    var rolled=roll(e.dmg[0],e.dmg[1]);e.flameShots=(e.flameShots||0)+1;
    if(e.flameShots%3===0){ringFx(tgt.x,tgt.y,'#FF943F',1.5);ents.slice().forEach(function(o){if(o!==tgt&&o.foe&&o.hp>0&&dist(o,tgt)<=1){var splash=applyDamage(o,Math.round(rolled*.5),'fire',e);floatText(o.x,o.y,String(splash),'fire');if(o.hp<=0)kill(o,e);}});}
    var d=applyDamage(tgt, rolled, 'fire', e); floatText(tgt.x,tgt.y,String(d),'fire');
    if(tgt.hp>0 && rng()<0.22) applyStatus(tgt,'burn',3,burnDmg());
    if(tgt.hp<=0) kill(tgt,e);
  } else if(dist(e,player)>2 && canActorMove(e)) stepToward(e, player.x, player.y);


}

/* ---------------------------------------------------------------- the character sheet lists rank 3 and 6 passives */


/* Named floor-generation stages; ordered by generation-adapter.js. */
function resetGeneratedElementalGround(seed){  groundReset(); if(floorMeta) floorMeta.upheaval=[]; }

function castElementTarget(x,y){
  var A=aiming.A, cf=faceOf(x-player.x, y-player.y); if(cf) player.face=cf;
  if(!inRange(x,y)){ log(((revealAll||vis[idxOf(x,y)]) ? 'Out of range.' : 'You cannot see that tile.'),'c-info'); sfx('ui-error'); return false; }
  var f=foeAt(x,y);
  if(A.kind==='blast'){
    beginCast(A); boltFx(player.x,player.y,x,y,'fire'); explosionFx(x,y);
    var dmg=spellRoll(A), tiles=[];
    for(var ty=y-A.radius;ty<=y+A.radius;ty++) for(var tx=x-A.radius;tx<=x+A.radius;tx++){ if(!inb(tx,ty)) continue; tiles.push([tx,ty]); ignite(tx,ty,'player'); burnWorld(tx,ty); }
    ents.slice().forEach(function(e){ if(!e.foe || Math.max(Math.abs(e.x-x),Math.abs(e.y-y))>A.radius) return; spellHit(e,A,dmg,'fire'); if(e.hp>0) applyStatus(e,'burn',3,Math.max(1,Math.round(burnDmg()*spellPower(A)))); finishHit(e); });
    markGround(tiles, A);
    log('<b>Fireball!</b>','c-fire');
  }
  else if(A.kind==='cone'){
    var dmg2=spellRoll(A), hitT=effectFootprint(A,x,y);
    beginCast(A);
    hitT.forEach(function(t){ burst(t[0],t[1],'ice',5,0.05); });
    ents.slice().forEach(function(e){ if(!e.foe || !hitT.some(function(t){ return t[0]===e.x&&t[1]===e.y; })) return;
      spellHit(e,A,dmg2,'ice'); if(e.hp>0){ addChill(e);
        var kx=e.x+Math.sign(e.x-player.x), ky=e.y+Math.sign(e.y-player.y);
        if(!e.base.boss && walkable(kx,ky) && !occupied(kx,ky)){ e.x=kx; e.y=ky; } }
      finishHit(e); });
    markGround(hitT, A);
    log('<b>Frost Cone.</b>','c-hit');
  }
  else if(A.kind==='chain'){
    var path=boltPath(player.x,player.y,x,y), end=path.length?path[path.length-1]:{x:x,y:y}, t0=foeAt(end.x,end.y);
    if(!t0){ log('Chain Lightning needs an enemy to strike.','c-info'); return false; }
    beginCast(A);
    var hit=[t0], cur=t0, amt=spellRoll(A), from={x:player.x,y:player.y};
    for(var j=0;j<5 && cur;j++){
      boltFx(from.x,from.y,cur.x,cur.y,'lightning');
      spellHit(cur,A,amt,'lightning');
      from={x:cur.x,y:cur.y}; amt=Math.max(1,Math.round(amt*0.75));
      var nx=ents.filter(function(e){ return e.foe && e.hp>0 && hit.indexOf(e)<0 && dist(e,from)<=3 && vis[idxOf(e.x,e.y)]; }).sort(function(a,b){ return dist(a,from)-dist(b,from); })[0];
      finishHit(cur);
      if(nx) hit.push(nx); cur=nx;
    }
    log('<b>Chain Lightning</b> strikes '+hit.length+' enem'+(hit.length===1?'y':'ies')+'.','c-hit');
  }
  else if(A.kind==='beam'){
    var ddx=Math.sign(x-player.x), ddy=Math.sign(y-player.y);
    if(!ddx && !ddy){ log('Aim the beam away from yourself.','c-info'); return false; }
    var bt=effectFootprint(A,x,y);
    beginCast(A);
    var dmg3=spellRoll(A);
    bt.forEach(function(t){ sparkleFx(t[0],t[1],'light',4); });
    ents.slice().forEach(function(e){ if(!e.foe || !bt.some(function(t){ return t[0]===e.x&&t[1]===e.y; })) return; spellHit(e,A,dmg3,'light'); if(e.hp>0 && rng()<.05*aff('light')) applyStatus(e,'blind',2); finishHit(e); });
    markGround(bt, A);
    log('<b>Radiant Beam.</b>','c-hit');
  }
  else if(A.kind==='swarm'){
    var spots=[];
    for(var sy=y-1;sy<=y+1;sy++) for(var sx=x-1;sx<=x+1;sx++) if(inb(sx,sy) && walkable(sx,sy) && !occupied(sx,sy)) spots.push([sx,sy]);
    if(!spots.length){ log('No room for shadows there.','c-info'); return false; }
    beginCast(A);
    ents=ents.filter(function(e){return !e.swarm;});
    var swarmStats=shadowSwarmStats(A);
    spots.forEach(function(s){ var m=spawn('wisp',s[0],s[1]); m.foe=false; m.ally=true; m.state='ally'; m.name='Shade'; m.base=Object.assign({},m.base,{name:'Shade',sprite:'m-shade',art:.8,dmg:[swarmStats.damage,swarmStats.damage],el:'shadow'});m.maxhp=m.hp=swarmStats.hp; m.dmg=[swarmStats.damage,swarmStats.damage]; m.life=swarmStats.duration; m.noXp=true; m.swarm=true; m.t=player.t+100; sparkleFx(s[0],s[1],'dark',8); });
    log('<b>Shadow Swarm.</b> '+spots.length+' shadows rise.','c-good');
  }
  else if(A.kind==='lflame'){
    if(!walkable(x,y) || occupied(x,y)){ log('The flame needs an empty tile.','c-info'); return false; }
    if(summonCount()>=2){ log('You already command two summons.','c-info'); return false; }
    beginCast(A);
    var sp=spellPower(A), m2=spawn('emberling',x,y);
    m2.kind='emberling'; m2.base=MONSTERS.emberling; m2.foe=false; m2.ally=true; m2.state='ally'; m2.name='Living Flame'; m2.livingFlame=true; m2.rangedAlly=6; m2.noXp=true; m2.t=player.t;
    m2.maxhp=m2.hp=Math.round(28*sp); m2.dmg=[Math.round(5*sp), Math.round(9*sp)]; m2.life=30;
    explosionFx(x,y);
    var land=spellRoll(A);
    ents.slice().forEach(function(e){ if(e.foe && dist(e,m2)<=1){ spellHit(e,A,land,'fire'); finishHit(e); } });
    markGround([[x,y]], A);
    log('<b>Living Flame.</b> A fire elemental answers.','c-fire');
  }
  else if(A.kind==='tomb'){
    if(x===player.x && y===player.y){
      beginCast(A);
      log('<b>Glacial Tomb.</b> Ice closes over you.','c-good'); sfx('status-freeze');
      player.tombed=true;
      var savedConditions=player.st;player.st={};
      try{for(var r=0;r<3 && player.hp>0;r++){player.movedThisTurn=false;endTurn();}}finally{player.st=savedConditions;player.tombed=false;}
      healPlayer(player.maxhp*.25);player.mp=Math.min(player.maxmp,player.mp+Math.round(player.maxmp*.25)); log('The tomb melts away.','c-info');
      return true;
    }
    if(!f){ log('Glacial Tomb needs an enemy, or yourself.','c-info'); return false; }
    beginCast(A);
    f.tomb = f.base.boss ? 2 : (f.elite||f.base.elite) ? 6 : 10;
    ['burn','poison','chill','frozen'].forEach(function(k){ delete f.st[k]; });
    burst(f.x,f.y,'ice',30,0.06); floatText(f.x,f.y,'entombed','ice');
    log('<b>Glacial Tomb.</b> '+f.name+' is sealed in ice for '+f.tomb+' turns.','c-good');
  }
  else if(A.kind==='upheaval'){
    var line=bresenham(player.x,player.y,x,y,7), raised=0;
    beginCast(A); SHAKE=8;
    floorMeta.upheaval=floorMeta.upheaval||[];
    line.forEach(function(t){
      var tx=t[0], ty=t[1];
      if(at(tx,ty)!==FLOOR || occupied(tx,ty) || itemAt(tx,ty) || propAt(tx,ty)) return;
      setT(tx,ty,WALL); raised++; floorMeta.upheaval.push({x:tx,y:ty,until:turn+20}); burst(tx,ty,'earth',10,0.05);
      ents.forEach(function(e){ if(e.foe && dist(e,{x:tx,y:ty})<=1) applyStatus(e,'root',2); });
    });
    markGround(line, A);
    computeFOV();
    log(raised ? '<b>Upheaval.</b> '+raised+' walls of stone tear up out of the floor.' : 'The ground shudders, but there is no open floor to raise.','c-good');
  }
  else if(A.kind==='umbral'){
    if(!walkable(x,y) || occupied(x,y)){ log('You cannot step there.','c-info'); return false; }
    if(ents.some(function(e){ return e.foe && dist(e,{x:x,y:y})<=1; })){ log('An enemy stands beside that spot.','c-info'); return false; }
    beginCast(A);
    sparkleFx(player.x,player.y,'dark',24); player.x=x; player.y=y; player._lx=undefined; sparkleFx(x,y,'dark',24);
    player.hidden=3;
    ents.forEach(function(e){ if(e.foe && e.state==='hunt'){ e.state='wander'; e.lastSeen=null; } });
    computeFOV();
    log('<b>Umbral Passage.</b> You step through the dark.','c-good');
  }
  endTurn(); return true;
}
