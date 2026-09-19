/* =====================================================================
   cavernmobs.js - biome 3, the Caverns (floors 11-15): creatures and the sub-boss. 2026-09-19.
   Creatures (Justin's GPT art, art/map/biome3/monsters2): Storm Beetle, Spark Jelly, Shock Eel, Myconid
   (and its Shroomlings), Crystal Crawler; Cave Bat and Rock Slime come down from the Dungeon.
   Sub-boss: The Deep Maw (floor 15), a burrowing worm. The world (map, chasms, the arena and its burrow
   mounds) is built elsewhere; the contract with it is:
     floorMeta.bossArena = {x, y, w, h, mounds:[{x,y}, ...]}   (each mound: 2x2 set piece 'worm-burrow-closed', top-left x,y)
     spawnDeepMaw(floorMeta.bossArena)                          (defined here)
     caveBossDown()                                             (defined by the world; called here when the Maw dies)
   Everything here keys off the biome index and floorMeta fields, so floors 1-10 never touch it.
   All numbers are first picks for Justin to tune (see the report of 2026-09-19).
   ===================================================================== */

function inCaverns(){ return typeof bidx==='function' && bidx()===2 && !(floorMeta && floorMeta.plane); }

/* ---------------------------------------------------------------- the bestiary */
(function(){
  var M=MONSTERS;
  /* band = absolute floors (rollMonster reads floorNo). The floor curve (+5% HP, +3% damage a floor) is on
     top of these, so at floor 12 a Storm Beetle is 26*1.55 = 40 HP and hits 6-10. */
  M.stormbeetle   = {name:'Storm Beetle', sprite:'m-storm-beetle', col:'#3A4A7A', ch:'b', hp:26, dmg:[5,8], acc:64, eva:8, armor:5, speed:100, range:1, xp:40,
                     band:[11,15], w:22, arcs:true, grounded:true, living:true, art:0.95, artLeft:true, sfx:'slime'};
  M.sparkjelly    = {name:'Spark Jelly', sprite:'m-spark-jelly', col:'#8FD8FF', ch:'j', hp:16, dmg:[4,6], acc:66, eva:28, armor:0, speed:100, range:1, xp:36,
                     band:[12,15], w:12, flying:true, erratic:true, stingChain:true, el:'air', glow:'#7FD0FF', living:true, art:0.85, sfx:'bat'};
  M.shockeel      = {name:'Shock Eel', sprite:'m-shock-eel', col:'#3F7A6A', ch:'e', hp:24, dmg:[4,7], acc:66, eva:18, armor:1, speed:100, range:1, xp:40,
                     band:[11,14], w:0, aquatic:true, el:'water', living:true, art:0.95, artLeft:true, sfx:'slime'};   /* w:0 - placed in water by eelPlacement() */
  M.myconid       = {name:'Myconid', sprite:'m-myconid', col:'#7FA8A0', ch:'f', hp:22, dmg:[3,6], acc:60, eva:10, armor:1, speed:100, range:1, xp:38,
                     band:[11,15], w:16, spores:true, sporeproof:true, el:'earth', living:true, spellcaster:true, art:0.95, sfx:'shaman'};
  M.shroomling    = {name:'Shroomling', sprite:'m-myconid', col:'#9FC0B0', ch:'f', hp:7, dmg:[2,4], acc:58, eva:12, armor:0, speed:100, range:1, xp:6,
                     band:[0,0], w:0, sporeproof:true, living:true, art:0.5, sfx:'slime'};
  M.crystalcrawler= {name:'Crystal Crawler', sprite:'m-crystal-crawler', col:'#8A6AD0', ch:'c', hp:18, dmg:[4,7], acc:68, eva:20, armor:3, speed:130, range:1, xp:38,
                     band:[13,15], w:9, shatters:true, el:'earth', art:0.95, artLeft:true, sfx:'rat'};   /* the Caverns' one fast creature */
  /* the Dungeon's bat and slime, in their Caverns bands (their own entries stay on floors 1-5) */
  M.cavebat       = Object.assign({}, M.bat, {band:[11,12], w:8});
  M.caveslime     = Object.assign({}, M.slime, {band:[11,15], w:10});
  delete M.cavebat.biome; delete M.caveslime.biome;   /* absolute floor bands like the rest of this table (the Dungeon originals are tagged biome 1) */
  /* The Deep Maw: tuned by hand for floor 15, so no floor curve (fixed, like the plane elites) */
  M.deepmaw       = {name:'The Deep Maw', sprite:'m-deep-maw', col:'#B07A4A', ch:'W', hp:240, dmg:[10,15], acc:70, eva:0, armor:4, speed:100, range:1, xp:600,
                     band:[15,15], w:0, boss:true, elite:true, big:2, fixed:true, living:true, art:2.0, artLeft:true, sfx:'brute'};
  M.mawlimb       = {name:'The Deep Maw', sprite:'m-deep-maw', col:'#B07A4A', ch:'W', hp:9999, dmg:[0,0], acc:0, eva:0, armor:4, speed:100, range:0, xp:0,
                     band:[0,0], w:0, object:true, fixed:true, art:0.1};
  DROPS.stormbeetle   = {chance:0.20, table:{essence:10, gear:3, sigil:1}};
  DROPS.sparkjelly    = {chance:0.20, table:{essence:12, sigil:2}};
  DROPS.shockeel      = {chance:0.30, table:{essence:10, food:3, sigil:1}};
  DROPS.myconid       = {chance:0.30, table:{essence:8, food:3, sigil:3}};
  DROPS.shroomling    = {chance:0, table:{essence:1}};
  DROPS.crystalcrawler= {chance:0.25, table:{essence:14, gear:3}};
  DROPS.cavebat       = DROPS.bat;
  DROPS.caveslime     = DROPS.slime;
  DROPS.deepmaw       = {chance:0, table:{essence:1}};
  DROPS.mawlimb       = {chance:0, table:{essence:1}};
})();

/* special rooms and fallbacks ask for Dungeon kinds by name; in the Caverns they get Caverns ones */
var CAVE_SWAP = {bat:'sparkjelly', goblin:'stormbeetle', archer:'sparkjelly', brute:'stormbeetle', shaman:'myconid'};
var _spawnCaveMobs = spawn;
spawn = function(kind, x, y){ if(CAVE_SWAP[kind] && inCaverns()) kind=CAVE_SWAP[kind]; return _spawnCaveMobs(kind, x, y); };

/* ---------------------------------------------------------------- helpers */
function caveVis(x,y){ return !!(revealAll || (vis && vis[idxOf(x,y)])); }
/* lightning damage with its float and log line; returns the damage dealt */
function caveZap(t, n, src, why, type){
  if(!t || t.hp<=0) return 0;
  var d=applyDamage(t, n, type||'lightning', src);
  floatText(t.x, t.y, String(d), type||'lightning');
  if(t===player){ if(why) log(why+': <b>'+d+'</b>.','c-you'); if(player.hp<=0) kill(player, src); }
  else if(t.hp<=0) kill(t, src && src.foe ? null : src);
  return d;
}
function eelWater(x,y){
  if(!inb(x,y)) return false;
  var t=at(x,y);
  return t===WATER || (typeof DEEPWATER!=='undefined' && t===DEEPWATER) || (typeof DEEP_WATER!=='undefined' && t===DEEP_WATER);
}

/* ---------------------------------------------------------------- damage rules */
var _applyDamageCave = applyDamage;
applyDamage = function(target, amount, type, source){
  if(target && target!==player && target.base){
    /* Storm Beetles are insulated: half damage from lightning */
    if(target.base.grounded && type==='lightning') amount*=0.5;
    /* fungus folk breathe spores: the clouds (source-less poison) do not hurt them. Not base.fumes - the
       Crypt reads that as "vents a cloud when struck" (the Grave Beetle). */
    if(target.base.sporeproof && type==='poison' && !source) return 0;
    /* the Maw's body is four tiles: an area spell that covers several of them hits it once, not four times */
    if(target.parent && target.parent.kind==='deepmaw' && target.parent._hitFlag && target.parent._hitKey===turn) return 0;
    if(target.kind==='deepmaw'){
      target._hitKey=turn;
      if(!target._hitFlag){ target._hitFlag=true; setTimeout(function(){ target._hitFlag=false; }, 0); }
    }
    if(target.kind==='shockeel') target._surfT=turn;
  }
  return _applyDamageCave(target, amount, type, source);
};

/* ---------------------------------------------------------------- attacks: beetle arcs, jelly chains, eel splash */
var _attackCave = attack;
attack = function(att, def, mult, label){
  var hp0 = def ? def.hp : 0;
  var r=_attackCave(att, def, mult, label);
  if(!att || !att.base || !def || !(def.hp<hp0) || player.hp<=0) return r;
  if(att.base.arcs && def===player) beetleArc(att);
  if(att.base.stingChain) jellyChain(att, def);
  if(att.base.aquatic){ att._surfT=turn; if(def===player && eelWater(att.x,att.y)){ applyStatus(player,'wet',3); } }
  return r;
};
/* Storm Beetle: its hit sets every Storm Beetle within 3 tiles crackling, and if another one is standing
   next to you the arc jumps into you too: 3-5 lightning, once a turn however many beetles there are
   (2026-09-19 sim: two arcs per hit per beetle was 25 a turn from three beetles on a level 14 fighter).
   Fight them one at a time, or away from each other. */
var BEETLE_ARC = [3,5];
function beetleArc(b){
  if(floorMeta._arcTurn===turn) return;
  var others=ents.filter(function(o){ return o!==b && o.hp>0 && o.base && o.base.arcs && dist(o,b)<=3; });
  if(!others.length) return;
  floorMeta._arcTurn=turn;
  others.forEach(function(o){ boltFx(b.x,b.y,o.x,o.y,'lightning'); });
  var near=others.filter(function(o){ return dist(o,player)<=1; })[0];
  if(near){ boltFx(near.x,near.y,player.x,player.y,'lightning'); caveZap(player, sDMG(roll(BEETLE_ARC[0],BEETLE_ARC[1])), near, 'Lightning arcs from beetle to beetle and into you'); }
  else if(caveVis(b.x,b.y)) log('Lightning arcs between the <b>Storm Beetles</b>.','c-info');
  sfx('lightning-hit');
}
/* Spark Jelly: the sting jumps to up to two more targets within 2 tiles of whatever it stung */
function jellyChain(j, first){
  var hit=[first], from=first;
  for(var k=0;k<2;k++){
    var nx=ents.filter(function(o){ return hit.indexOf(o)<0 && o!==j && o.hp>0 && o.base && !o.base.object && !o.parent && !o.base.stingChain && dist(o,from)<=2 && caveVis(o.x,o.y); })
               .sort(function(a,z){ return dist(a,from)-dist(z,from); })[0];
    if(!nx) break;
    boltFx(from.x,from.y,nx.x,nx.y,'lightning');
    caveZap(nx, sDMG(roll(3,5)), j, nx===player ? 'The Spark Jelly\'s sting jumps to you' : null);
    hit.push(nx); from=nx;
  }
  if(hit.length>1 && caveVis(j.x,j.y)) log('The <b>Spark Jelly</b>\'s sting crackles on to '+(hit.length-1)+' more.','c-info');
}

/* ---------------------------------------------------------------- monster turns */
var SHROOM_CAP_EACH = 2, SHROOM_CAP_FLOOR = 6;
var _aiActCave = aiAct;
aiAct = function(e){
  var b=e.base||{};
  if(e.kind==='deepmaw') return mawAct(e);
  if(e.kind==='mawlimb'){ e.t+=actCost(e); return; }
  if(b.aquatic && e.state!=='asleep') return eelAct(e);
  if(b.spores && e.state==='hunt' && !e.st.stun && !e.st.frozen && !e.st.fear && canSeePlayer(e)){
    if(myconidAct(e)) return;
  }
  return _aiActCave(e);
};

/* Myconid: lobs a spore cloud onto you every few turns (poison, and it slows you while you stand in it),
   and sprouts Shroomlings (two each, six a floor). Up close it just swats. */
function myconidAct(e){
  var d=dist(e,player);
  e.sporeCd=(e.sporeCd===undefined ? 1 : e.sporeCd)-1;
  e.sproutCd=(e.sproutCd===undefined ? 3 : e.sproutCd)-1;
  if(d>=2 && d<=5 && e.sporeCd<=0){   /* it lobs them: close in and it just swats */
    if(!tickStatus(e)) return true;
    e.sporeCd=4; setClip(e,'attack'); sfx('trap-gas');
    boltFx(e.x,e.y,player.x,player.y,'poison');
    addCloud(player.x, player.y, 1, 3, sDMG(2+Math.floor(floorNo/4)), 'spores');
    log('The <b>Myconid</b> puffs a cloud of spores over you. Get out of it!','c-you');
    e.t+=actCost(e); return true;
  }
  if(e.sproutCd<=0 && d>1){
    var mine=ents.filter(function(o){ return o.kind==='shroomling' && o.owner===e.id; }).length;
    var all=ents.filter(function(o){ return o.kind==='shroomling'; }).length;
    var c=nearFree(e.x,e.y,1);
    if(mine<SHROOM_CAP_EACH && all<SHROOM_CAP_FLOOR && c){
      if(!tickStatus(e)) return true;
      e.sproutCd=6;
      var s=spawn('shroomling', c.x, c.y); s.state='hunt'; s.noXp=true; s.owner=e.id; s.t=e.t;
      setClip(e,'attack'); sparkleFx(c.x,c.y,'poison',16);
      if(caveVis(e.x,e.y)) log('The <b>Myconid</b> shakes its cap and a <b>Shroomling</b> pops up out of the moss.','c-info');
      e.t+=actCost(e); return true;
    }
  }
  return false;
}
/* spores slow: standing in a spore cloud chills you (one stack at a time, it never freezes) */
var _endTurnCaveSpores = endTurn;
endTurn = function(){
  _endTurnCaveSpores();
  if(!floorMeta || !player || player.hp<=0 || typeof cloudAt!=='function') return;
  var c=cloudAt(idxOf(player.x,player.y));
  if(c && c.src==='spores' && !player.st.chill && !player.st.frozen && !(typeof aff==='function' && aff('earth')>=6)){
    player.st.chill={t:2, n:1}; floatText(player.x,player.y,'slowed','poison');
  }
};

/* Shock Eel: lives in water and only moves through it. Mostly under the surface (drawn faint). Every few
   turns it lights up the water around it: the connected water within 4 tiles is marked for one turn, then
   everything standing in it takes lightning (and anything in water is Wet: +50% lightning). */
function eelAct(e){
  if(!tickStatus(e)) return;
  if(e.st.stun || e.st.frozen){ e.t+=actCost(e); return; }
  var see=canSeePlayer(e), d=dist(e,player);
  if(see && e.state!=='hunt'){ e.state='hunt'; e.caughtOff=turn; }
  /* a charge that was marked last turn goes off now */
  if(e.zap){
    var z=e.zap; e.zap=null; floorMeta.marks=(floorMeta.marks||[]).filter(function(m){ return m.kind!=='eel'+e.id; });
    if(turn<=z.at+1){
      setClip(e,'attack'); e._surfT=turn; sfx('lightning-hit'); SHAKE=Math.max(SHAKE||0,3);
      z.cells.forEach(function(i){ if(rng()<0.35) burst(i%MW, (i/MW)|0, 'lightning', 5, 0.05); });
      var hitAny=false;
      ents.slice().forEach(function(t){
        if(t===e || !t.base && t!==player) return;
        if(t!==player && (t.base.aquatic || t.base.object || t.parent)) return;
        if(z.cells.indexOf(idxOf(t.x,t.y))<0) return;
        hitAny=true; caveZap(t, roll(e.dmg[0], e.dmg[1]), e, t===player ? 'The <b>Shock Eel</b> electrifies the water' : null);
      });
      if(!hitAny && caveVis(e.x,e.y)) log('The water crackles with lightning, but nothing is standing in it.','c-info');
      e.t+=actCost(e); return;
    }
  }
  var onLand=!eelWater(e.x,e.y);
  if(e.state==='hunt'){
    if(d<=1 && !e.st.fear){ attack(e,player); e.t+=actCost(e); return; }
    e.zapCd=(e.zapCd===undefined ? 2 : e.zapCd)-1;
    if(!onLand && e.zapCd<=0 && d<=6){
      var cells=eelField(e, 4);
      var playerIn=cells.indexOf(idxOf(player.x,player.y))>=0;
      var allyIn=ents.some(function(o){ return o.ally && cells.indexOf(idxOf(o.x,o.y))>=0; });
      if(playerIn || allyIn){
        e.zapCd=5; e.zap={cells:cells, at:turn+1}; e._surfT=turn;
        floorMeta.marks=(floorMeta.marks||[]).concat([{cells:cells, col:'#7FD8FF', until:turn+1, kind:'eel'+e.id}]);
        setClip(e,'attack');
        log('The water around the <b>Shock Eel</b> starts to crackle and glow. Get out of the water!','c-you');
        e.t+=actCost(e); return;
      }
    }
  }
  /* move: only through water; stranded on land, it flops back to the nearest water */
  if(!e.st.root){
    var nb=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]], best=null, bd=1e9;
    var goal = e.state==='hunt' ? player : (e.goal || null);
    if(!goal || (e.goal && e.x===e.goal.x && e.y===e.goal.y) || (e.state!=='hunt' && rng()<0.1)){
      var opts=eelField(e, 5); if(opts.length){ var gi=opts[Math.floor(rng()*opts.length)]; e.goal={x:gi%MW, y:(gi/MW)|0}; goal=e.goal; }
    }
    for(var i=0;i<nb.length;i++){
      var nx=e.x+nb[i][0], ny=e.y+nb[i][1];
      if(!eelWater(nx,ny) || occupied(nx,ny)) continue;
      var dd = goal ? Math.max(Math.abs(goal.x-nx), Math.abs(goal.y-ny)) + 0.01*(Math.abs(goal.x-nx)+Math.abs(goal.y-ny)) : rng();
      if(e.st.fear) dd=-dd;
      if(dd<bd){ bd=dd; best={x:nx,y:ny}; }
    }
    var here = goal ? Math.max(Math.abs(goal.x-e.x), Math.abs(goal.y-e.y)) : 1e9;
    if(best && (onLand || bd<here || e.state!=='hunt')){ e.x=best.x; e.y=best.y; }
  }
  e.t+=actCost(e);
}
/* the water connected to the eel within r tiles (through water, 8-way) */
function eelField(e, r){
  var out=[], seenW={}, q=[e.x, e.y];
  if(!eelWater(e.x,e.y)) return out;
  seenW[idxOf(e.x,e.y)]=1; out.push(idxOf(e.x,e.y));
  for(var h=0; h<q.length; h+=2){
    var x=q[h], y=q[h+1];
    for(var dy=-1;dy<=1;dy++) for(var dx=-1;dx<=1;dx++){
      var nx=x+dx, ny=y+dy; if(!inb(nx,ny)) continue; var i=idxOf(nx,ny);
      if(seenW[i] || !eelWater(nx,ny) || Math.max(Math.abs(nx-e.x),Math.abs(ny-e.y))>r) continue;
      seenW[i]=1; out.push(i); q.push(nx,ny);
    }
  }
  return out;
}
/* eels go into the floor's pools: one per body of water of 8+ tiles, up to three a floor, never in sight */
function eelPlacement(){
  if(!floorMeta || floorMeta.eelsPlaced || !inCaverns() || floorNo>14 || !map) return;
  floorMeta.eelsPlaced=true;
  var done={}, bodies=[];
  for(var i=0;i<MW*MH;i++){
    var x=i%MW, y=(i/MW)|0; if(done[i] || !eelWater(x,y)) continue;
    var cells=[], q=[i]; done[i]=1;
    while(q.length){ var c=q.pop(); cells.push(c); var cx=c%MW, cy=(c/MW)|0;
      [[1,0],[-1,0],[0,1],[0,-1]].forEach(function(o){ var nx=cx+o[0], ny=cy+o[1]; if(!inb(nx,ny)) return; var j=idxOf(nx,ny); if(!done[j] && eelWater(nx,ny)){ done[j]=1; q.push(j); } }); }
    if(cells.length>=8) bodies.push(cells);
  }
  bodies.sort(function(a,z){ return z.length-a.length; });
  var placed=0;
  bodies.forEach(function(cells){
    if(placed>=3 || rng()>0.75) return;
    var free=cells.filter(function(c){ var x=c%MW, y=(c/MW)|0; return !occupied(x,y) && !(vis && vis[c]) && !(player && dist(player,{x:x,y:y})<8); });
    if(!free.length) return;
    var c=free[Math.floor(rng()*free.length)], e=spawn('shockeel', c%MW, (c/MW)|0);
    e.state = rng()<0.5 ? 'asleep' : 'wander'; e.t=player ? player.t : 0; placed++;
  });
}
var _generateCaveMobs = generate;
generate = function(seed){ var r=_generateCaveMobs.apply(this, arguments); try{ eelPlacement(); }catch(err){ } return r; };
var _endTurnCaveEels = endTurn;
endTurn = function(){ _endTurnCaveEels(); try{ eelPlacement(); }catch(err){ } };

/* ---------------------------------------------------------------- drawing */
var _drawCharacterCave = drawCharacter;
drawCharacter = function(e, px, py, opts){
  if(e && e!==player && e.kind){
    if(e.kind==='mawlimb') return true;                          /* the Maw's other three tiles: nothing drawn */
    if(e.kind==='deepmaw') return drawMaw(e, px, py, opts||{});
    if(e.kind==='shockeel' && eelWater(e.x,e.y) && !revealAll && (e._surfT===undefined || turn-e._surfT>=2)){
      /* under the surface: faint and a little low */
      var o=Object.assign({}, opts||{}); o.alpha=(o.alpha===undefined?1:o.alpha)*0.42;
      return _drawCharacterCave(e, px, py+TS*0.1, o);
    }
  }
  return _drawCharacterCave(e, px, py, opts);
};
/* the Maw stands on its 2x2 block (its entity sits on the top-left tile; planeterrain.js draws base.big
   creatures across their whole footprint) and rises out of the ground when it erupts */
function drawMaw(e, px, py, opts){
  var now=performance.now(), p=e._rise ? Math.min(1, (now-e._rise)/500) : 1, ease=1-Math.pow(1-p,3);
  var ground=py+TS*2, bob=ANIM.reduce ? 0 : Math.sin(now/260)*TS*0.03;
  ctx.save();
  ctx.beginPath(); ctx.rect(px-TS*3, py-TS*5, TS*8, ground-(py-TS*5)); ctx.clip();
  ctx.translate(0, (1-ease)*TS*2.2 + bob);
  var r=_drawCharacterCave(e, px, py, opts);
  ctx.restore();
  return r;
}

/* ---------------------------------------------------------------- The Deep Maw
   Loop (all per turn, driven from endTurn so it runs while the Maw is out of the world):
     dormant - waits under the arena until you step into it
     under   - one turn below ground, then it picks where to come up and marks it (red):
               a ring around one of the burrow mounds, or a 3x3 on the spot where you are standing
     warn    - two turns later it erupts through the marked tiles and bites everything on them
     up      - it stays out for 3 turns (2 below half health): the window to hit it. It bites anything
               touching it. Then it dives, and the loop starts again.
   Below half health each eruption on you also marks the ring around the nearest mound (flying rubble). */
var MAW = {bite:[24,32], biteCap:0.40, rubble:[10,14], warnTurns:2, upTurns:3, upTurnsHurt:2};
function spawnDeepMaw(arena){
  if(!arena || !floorMeta) return null;
  var mounds=(arena.mounds||[]).filter(function(m){ return m && inb(m.x,m.y); });
  var sx=mounds.length ? mounds[0].x : arena.x+Math.floor(arena.w/2), sy=mounds.length ? mounds[0].y : arena.y+Math.floor(arena.h/2);
  var e=spawn('deepmaw', sx, sy);
  ents=ents.filter(function(o){ return o!==e; });                 /* it starts underground: out of the world */
  e.state='hunt'; e.elite=true; e.big=true; e.st={};
  floorMeta.bossId=e.id;
  floorMeta.maw={phase:'dormant', arena:arena, mounds:mounds, ent:e, limbs:[], n:0, at:0, cells:[], rubble:[]};
  return e;
}
function mawState(){ return floorMeta && floorMeta.maw && floorMeta.maw.phase!=='dead' ? floorMeta.maw : null; }
function mawInArena(M, p, pad){ var a=M.arena; pad=pad||0; return p.x>=a.x-pad && p.y>=a.y-pad && p.x<a.x+a.w+pad && p.y<a.y+a.h+pad; }
function mawRing(m){   /* the walkable tiles around a 2x2 mound */
  var out=[]; for(var y=m.y-1;y<=m.y+2;y++) for(var x=m.x-1;x<=m.x+2;x++){ if(x>=m.x && x<=m.x+1 && y>=m.y && y<=m.y+1) continue; if(inb(x,y) && walkable(x,y)) out.push(idxOf(x,y)); }
  return out;
}
function mawBodyFits(x,y,M){
  for(var yy=y;yy<=y+1;yy++) for(var xx=x;xx<=x+1;xx++){ if(!inb(xx,yy) || !walkable(xx,yy) || !mawInArena(M,{x:xx,y:yy})) return false; }
  return true;
}
function mawNearestMound(M, p){ var best=null, bd=1e9; M.mounds.forEach(function(m){ var d=Math.max(Math.abs(m.x+0.5-p.x), Math.abs(m.y+0.5-p.y)); if(d<bd){ bd=d; best=m; } }); return best; }
function mawPlan(M){
  var e=M.ent, hurt=e.hp<e.maxhp/2, pick3 = M.mounds.length && (M.n===0 || (!hurt && M.n%3===2));
  M.rubble=[]; M.site=null;
  if(!pick3){
    /* on you: a 3x3 on your tile; the body comes up inside it */
    var cx=player.x, cy=player.y, spots=[];
    [[-1,-1],[0,-1],[-1,0],[0,0]].forEach(function(o){ if(mawBodyFits(cx+o[0], cy+o[1], M)) spots.push({x:cx+o[0], y:cy+o[1]}); });
    if(spots.length){
      var s=spots[Math.floor(rng()*spots.length)], cells=[];
      for(var y=cy-1;y<=cy+1;y++) for(var x=cx-1;x<=cx+1;x++) if(inb(x,y) && walkable(x,y)) cells.push(idxOf(x,y));
      M.site={x:s.x, y:s.y, mound:null}; M.cells=cells;
      if(hurt && M.mounds.length){ var nm=mawNearestMound(M, player); if(nm) M.rubble=mawRing(nm).filter(function(i){ return cells.indexOf(i)<0; }); }
    }
  }
  if(!M.site){
    if(!M.mounds.length){ M.cells=[]; return false; }
    var m=M.n===0 ? mawNearestMound(M, player) : M.mounds[Math.floor(rng()*M.mounds.length)];
    M.site={x:m.x, y:m.y, mound:m}; M.cells=mawRing(m);
  }
  floorMeta.marks=(floorMeta.marks||[]).filter(function(k){ return k.kind!=='maw'; })
    .concat([{cells:M.cells.concat(M.rubble), col:'#FF3A2A', until:turn+MAW.warnTurns, kind:'maw'}]);
  M.phase='warn'; M.at=turn+MAW.warnTurns;
  SHAKE=Math.max(SHAKE||0, 4); sfx('trap-gas');
  var sc=M.site.mound ? {x:M.site.x+0.5, y:M.site.y+0.5} : {x:player.x, y:player.y};
  burst(Math.round(sc.x), Math.round(sc.y), 'earth', 26, 0.07);
  log(M.site.mound ? 'The ground heaves around a burrow mound. <b>Stay off the red!</b>' : 'The floor bulges and cracks <b>under your feet</b>. Move off the red!','c-you');
  return true;
}
function mawErupt(M){
  var e=M.ent, hurt=e.hp<e.maxhp/2;
  floorMeta.marks=(floorMeta.marks||[]).filter(function(k){ return k.kind!=='maw'; });
  SHAKE=10; sfx('explosion');
  /* the bite */
  ents.slice().forEach(function(t){
    if(t===e || t.parent===e) return;
    var i=idxOf(t.x,t.y), onBite=M.cells.indexOf(i)>=0, onRubble=M.rubble.indexOf(i)>=0;
    if(!onBite && !onRubble) return;
    var raw = onBite ? roll(MAW.bite[0], MAW.bite[1]) : roll(MAW.rubble[0], MAW.rubble[1]);
    if(t===player) raw=Math.min(raw, Math.round(player.maxhp*MAW.biteCap));   /* never a one-shot */
    /* earth, not phys: armour barely matters against a worm the size of a room coming up under you */
    caveZap(t, sDMG(raw), e, t===player ? (onBite ? '<b>The Deep Maw erupts beneath you and bites</b>' : 'Flying rubble hits you') : null, 'earth');
  });
  M.cells.concat(M.rubble).forEach(function(i){ if(rng()<0.5) burst(i%MW, (i/MW)|0, 'earth', 8, 0.06); });
  if(player.hp<=0) return;
  /* come up */
  var s=M.site;
  if(s.mound){
    var mp=props.filter(function(p){ return p.x===s.mound.x && p.y===s.mound.y && /worm-burrow/.test(p.name); })[0];
    if(mp) mp.name='worm-burrow-open';
  }
  e.x=s.x; e.y=s.y; e._lx=undefined; e._ly=undefined; e.t=player.t; e._rise=performance.now(); e.state='hunt';
  if(ents.indexOf(e)<0) ents.push(e);
  M.limbs=[];
  [[1,0],[0,1],[1,1]].forEach(function(o){
    var l=_spawnCaveMobs('mawlimb', s.x+o[0], s.y+o[1]); l.parent=e; l.name=e.name; l.noXp=true; l.state='hunt'; l.t=player.t; M.limbs.push(l);
  });
  /* anything standing where the body comes up is thrown clear */
  ents.slice().forEach(function(t){
    if(t===e || t.parent===e) return;
    if(t.x<s.x || t.x>s.x+1 || t.y<s.y || t.y>s.y+1) return;
    var c=nearFree(t.x,t.y,1) || nearFree(t.x,t.y,2) || nearFree(t.x,t.y,3);
    if(c){ t.x=c.x; t.y=c.y; t._lx=undefined; t._ly=undefined; if(t===player){ log('You are thrown clear.','c-you'); computeFOV(); } }
  });
  ringFx(s.x+1, s.y+1, '#C08A50', 3);
  M.phase='up'; M.at=turn+(hurt ? MAW.upTurnsHurt : MAW.upTurns); M.n++;
  log('<b>The Deep Maw</b> bursts out of the ground! Hit it before it dives again.','c-you');
}
function mawDive(M){
  var e=M.ent;
  ents=ents.filter(function(o){ return o!==e && o.parent!==e; });
  M.limbs=[];
  burst(e.x+0.5|0, e.y+0.5|0, 'earth', 30, 0.08); SHAKE=Math.max(SHAKE||0, 5);
  M.phase='under'; M.at=turn+1;
  log('<b>The Deep Maw</b> dives back into the ground. Watch the floor.','c-info');
}
function mawTick(){
  var M=mawState(); if(!M || !player || player.hp<=0) return;
  var e=M.ent; if(!e) return;
  if(e.hp<=0){ return; }
  if(M.phase==='dormant'){
    if(mawInArena(M, player, 0)){
      M.phase='under'; M.at=turn;
      log('The cave floor trembles. Something enormous is moving <b>under the stone</b>...','c-you');
      if(typeof playMusic==='function') playMusic('boss'); SHAKE=6;
    } else return;
  }
  if(M.phase==='under' && turn>=M.at){ if(!mawPlan(M)) M.at=turn+1; return; }
  if(M.phase==='warn'){
    if(turn>=M.at) mawErupt(M);
    else { var c=M.site.mound ? {x:M.site.x, y:M.site.y} : {x:M.site.x, y:M.site.y}; burst(c.x, c.y, 'earth', 10, 0.05); SHAKE=Math.max(SHAKE||0, 3); }
    return;
  }
  if(M.phase==='up' && turn>=M.at) mawDive(M);
}
var _endTurnMaw = endTurn;
endTurn = function(){ _endTurnMaw(); try{ mawTick(); }catch(err){ if(window.console) console.error(err); } };
/* surfaced: it bites whatever is touching it (you first, then your allies) */
function mawTouching(e, o){ return o.x>=e.x-1 && o.x<=e.x+2 && o.y>=e.y-1 && o.y<=e.y+2; }
function mawAct(e){
  if(!tickStatus(e)) return;
  var M=mawState();
  if(e.st.stun || e.st.frozen || !M || M.phase!=='up'){ e.t+=actCost(e); return; }
  var tgt = mawTouching(e, player) ? player : ents.filter(function(o){ return o.ally && o.hp>0 && mawTouching(e,o); })[0];
  if(tgt){ setClip(e,'attack'); attack(e, tgt); }
  e.t+=actCost(e);
}
var _killCaveMobs = kill;
kill = function(e, by){
  if(e && e.kind==='deepmaw'){
    var M=floorMeta && floorMeta.maw;
    if(M){ M.phase='dead'; }
    floorMeta.marks=(floorMeta.marks||[]).filter(function(k){ return k.kind!=='maw'; });
    if(ents.indexOf(e)<0) ents.push(e);                                          /* the base kill() only removes what is in the world */
    ents=ents.filter(function(o){ return o.parent!==e; });
    SHAKE=12; burst(e.x+1, e.y+1, 'earth', 60, 0.1);
    var r=_killCaveMobs(e, by);
    log('<b>The Deep Maw</b> shudders, groans, and goes still. The Caverns fall quiet.','c-kill');
    if(typeof caveBossDown==='function') caveBossDown();
    return r;
  }
  if(e && e.kind==='shockeel' || e && e.kind==='sparkjelly'){ if(floorMeta && floorMeta.marks) floorMeta.marks=floorMeta.marks.filter(function(k){ return k.kind!=='eel'+e.id; }); }
  return _killCaveMobs(e, by);
};
