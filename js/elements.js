/* =====================================================================
   elements.js - elemental ranks 3-6 (mechanics review 2026-09-16,
   DESIGN.md 12 steps 1 and 6, and 6.7c "Element ability ladder").
   Rank 3 passive (+ immunity to the element's status), rank 4 area spell
   (35 mana), rank 5 ultimate (50 mana), rank 6 passive (+ immunity to the
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
ABILITIES.fireball    = {name:'Fireball', cost:35, kind:'blast', range:6, radius:2, type:'fire', el:'fire', icon:'ic-fireball', desc:'Pick a tile in sight: a 5x5 blast of fire damage that sets everything in it Burning.'};
ABILITIES.frostcone   = {name:'Frost Cone', cost:35, kind:'cone', range:6, type:'ice', el:'water', icon:'ic-tidal-surge', desc:'A 45-degree cone of ice 6 tiles long: damage, Chill, and a 1-tile knockback.'};
ABILITIES.chainbolt   = {name:'Chain Lightning', cost:35, kind:'chain', range:6, type:'lightning', el:'air', icon:'ic-chain-lightning', desc:'Lightning jumps from the target to 4 more enemies within 3 tiles, each jump 75% of the last.'};
ABILITIES.earthquake  = {name:'Earthquake', cost:35, kind:'quake', radius:3, type:'phys', el:'earth', icon:'ic-earthquake', desc:'The ground heaves 3 tiles around you: physical damage to everything but you, your own summons included.'};
ABILITIES.radiantbeam = {name:'Radiant Beam', cost:35, kind:'beam', range:6, type:'light', el:'light', icon:'ic-radiant-lance', desc:'A beam 3 tiles wide along a row, column or diagonal: light damage (+50% to undead and shadow), 25% Blind.'};
ABILITIES.shadowswarm = {name:'Shadow Swarm', cost:35, kind:'swarm', range:6, type:'dark', el:'shadow', icon:'ic-shadow-swarm', desc:'Fill a 3x3 area with shadows (3 HP, 2 damage per Shadow point) that stall enemies for 6 turns.'};
ABILITIES.livingflame = {name:'Living Flame', cost:50, kind:'lflame', range:6, type:'fire', el:'fire', icon:'ic-living-flame', desc:'Call a fire elemental onto a tile: it scorches enemies beside it as it lands and hurls fire (range 6) for 20 turns. Grows with Focus; counts toward the 2-summon limit.'};
ABILITIES.glacialtomb = {name:'Glacial Tomb', cost:50, kind:'tomb', range:6, type:'ice', el:'water', icon:'ic-glacial-tomb', desc:'Encase an enemy in ice: it cannot act or be hurt for 10 turns (6 for elites, 2 for bosses). Target yourself for 3 untouchable turns of regeneration.'};
ABILITIES.stormform   = {name:'Storm Form', cost:50, kind:'storm', type:'lightning', el:'air', icon:'ic-storm-form', desc:'Instant. For 6 turns of world time your actions take half the time and your steps a quarter.'};
ABILITIES.upheaval    = {name:'Upheaval', cost:50, kind:'upheaval', range:7, type:'phys', el:'earth', icon:'ic-upheaval', desc:'Raise a line of stone walls up to 7 tiles toward a tile for 20 turns. Enemies next to a rising wall are rooted.'};
ABILITIES.dawn        = {name:'Dawn', cost:50, kind:'dawn', type:'light', el:'light', icon:'ic-dawn', desc:'Every enemy in sight is Blinded for 3 turns, and every enemy on the floor is revealed to you for 20 turns.'};
ABILITIES.umbral      = {name:'Umbral Passage', cost:50, kind:'umbral', type:'dark', el:'shadow', icon:'ic-umbral-passage', desc:'Step to any tile you have seen on this floor that no enemy stands beside, and arrive hidden for 2 turns.'};
ABILITIES.spark.desc = 'Lightning damage with a 5% chance per Air point to stun. +50% against targets standing in water.';
ABILITIES.smite.desc = 'Light damage with a 10% chance per Light point to Blind. +50% against undead and shadow creatures.';
var AIM_KINDS = {blast:1, cone:1, chain:1, beam:1, swarm:1, lflame:1, tomb:1, upheaval:1, umbral:1};

var RANK_TEXT = {
  3:{fire:'Searing: Burning enemies take 15% more damage from you. Immune to Burning.',
     water:'Shatter: Frozen enemies take a further +50% physical damage. Immune to Chill and Freeze.',
     air:'Arc: 5% per Air point that any hit or spell arcs to a nearby enemy for 50%. Immune to Stun.',
     earth:'Venom: your hits and spells poison rooted enemies (10% of max HP a turn for 3 turns; half on elites and bosses). Immune to Root.',
     light:'Radiance: heal 1 HP per Light point whenever you deal light damage. Immune to Blind.',
     shadow:'Fade: after 50 turns out of combat you are fully hidden. Immune to Fear.'},
  6:{fire:'Wildfire: when a Burning enemy dies its fire leaps to the nearest enemy within 3. Fire spells leave flames for 3 turns. Immune to fire.',
     water:'Deep Freeze: two Chills freeze. Ice spells leave icy ground that Chills for 3 turns. Immune to ice.',
     air:'Lightning Reflexes: 15% of your attacks and spells take no time; lightning damage has a 15% stun chance. Immune to lightning.',
     earth:'Petrify: rooting a rooted enemy turns it to stone for 2 turns. Earth spells leave grasping roots for 3 turns. Immune to poison.',
     light:'Consecration: Light spells sanctify the ground for 3 turns, burning enemies on it (undead double). Immune to light.',
     shadow:'Hollowing: your dark damage stacks Hollow (max 5, 5 turns): +5% damage taken and -1 armor per stack. Immune to dark.'}
};
var STATUS_EL = {burn:'fire', chill:'water', frozen:'water', stun:'air', root:'earth', blind:'light', fear:'shadow'};
var IMMUNE_TYPE = {fire:'fire', water:'ice', air:'lightning', earth:'poison', light:'light', shadow:'dark'};
function aff(el){ return (player && player.aff && player.aff[el]) || 0; }

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
var _generateEl = generate;
generate = function(seed){ _generateEl(seed); groundReset(); if(floorMeta) floorMeta.upheaval=[]; };
var _drawTelegraphsEl = drawTelegraphs;
drawTelegraphs = function(now){
  _drawTelegraphsEl(now);
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
};

/* ---------------------------------------------------------------- statuses: immunities, Deep Freeze, Petrify, poison */
var _applyStatusEl = applyStatus;
applyStatus = function(e, key, turns, extra){
  if(!e || e.hp<=0) return;
  if(e===player && STATUS_EL[key] && aff(STATUS_EL[key])>=3) return;
  if(e===player && key==='poison' && aff('earth')>=6) return;
  if(e!==player && key==='root' && aff('earth')>=6 && e.st.root && !(e.stoneImm>turn)){
    e.st.stone={t:2}; e.stoneImm=turn+4; floatText(e.x,e.y,'stone','earth'); log(e.name+' turns to stone.','c-good'); sfx('earth-cast');
  }
  return _applyStatusEl(e, key, turns, extra);
};
addChill = function(e){
  if(!e || e.hp<=0) return;
  if(e===player && aff('water')>=3) return;
  if(e.tomb>0) return;
  var need = (e!==player && aff('water')>=6) ? 2 : 3;
  var c=e.st.chill, n=(c?c.n:0)+1;
  if(n>=need && !(e.st.imm_frozen)){ delete e.st.chill; applyStatus(e,'frozen',2); if(e!==player) e.st.imm_frozen={t:5}; sfx('status-freeze'); floatText(e.x,e.y,'frozen','ice'); }
  else e.st.chill={t:4, n:Math.min(n, need-1)};
};
function applyPoison(e, announce){
  if(!e || e.hp<=0 || e===player) return;
  var big=e.elite || e.base.elite || e.base.boss;
  /* 3 turns of its own: once it is in, the root wearing off does not stop it (2026-09-17) */
  e.st.poison={t:3, d:Math.max(1, Math.round(e.maxhp*0.10*(big?0.5:1)))};
  if(announce){
    if(typeof floatText==='function') floatText(e.x, e.y, 'poisoned', 'poison');
    if(typeof log==='function' && vis[idxOf(e.x,e.y)]) log('<b>Venom.</b> The rooted '+e.name+' is poisoned: '+e.st.poison.d+' a turn for 3 turns.','c-good');
  }
}

/* ---------------------------------------------------------------- damage: immunities, Searing, Hollow, Venom, Arc, Radiance, Reflexes */
var ARCING=false;
var _applyDamageEl = applyDamage;
applyDamage = function(target, amount, type, source){
  if(target===player && player.tombed) return 0;
  if(target && target.tomb>0) return 0;
  if(target===player){ for(var el in IMMUNE_TYPE) if(IMMUNE_TYPE[el]===type && aff(el)>=6){ floatText(player.x,player.y,'immune','miss'); return 0; } }
  var byPlayer = source===player || source==='player';
  if(target && target!==player){
    if(byPlayer && aff('fire')>=3 && target.st && target.st.burn) amount*=1.15;
    if(target.st && target.st.hollow) amount*=1+0.05*target.st.hollow.n;
  }
  var d=_applyDamageEl(target, amount, type, source);
  if(!target || target===player || !byPlayer || d<=0) return d;
  if(type==='dark' && aff('shadow')>=6 && target.hp>0){ var h=target.st.hollow; target.st.hollow={t:5, n:Math.min(5,(h?h.n:0)+1)}; }
  if(type==='light' && aff('light')>=3){ player.hp=Math.min(player.maxhp, player.hp+aff('light')); }
  if(type==='lightning' && aff('air')>=6 && target.hp>0 && rng()<0.15) applyStatus(target,'stun',1);
  if(aff('earth')>=3 && target.hp>0 && target.st.root && !target.st.poison) applyPoison(target, true);
  if(aff('air')>=3 && !ARCING && rng()<0.05*aff('air')){
    var o=ents.filter(function(e){ return e.foe && e!==target && e.hp>0 && dist(e,target)<=3 && vis[idxOf(e.x,e.y)]; }).sort(function(a,b){ return dist(a,target)-dist(b,target); })[0];
    if(o){ ARCING=true; var ad=applyDamage(o, Math.max(1,Math.round(d*0.5)), 'lightning', player); ARCING=false; boltFx(target.x,target.y,o.x,o.y,'lightning'); floatText(o.x,o.y,String(ad),'lightning'); if(o.hp<=0) kill(o,player); }
  }
  return d;
};
var _resistMultEl = resistMult;
resistMult = function(target, type){
  if(target===player){ for(var el in IMMUNE_TYPE) if(IMMUNE_TYPE[el]===type && aff(el)>=6) return 0; }
  return _resistMultEl(target, type);
};
/* spell and ability status chances grow with the element */
var _deriveEl = derive;
derive = function(p){
  _deriveEl(p);
  if(p!==player) return;
  ABILITIES.spark.stunChance = 0.05*aff('air');
  ABILITIES.smite.blindChance = 0.10*aff('light');
};

/* Wildfire */
var _killEl = kill;
kill = function(e, by){
  var burning = e && e!==player && e.foe && e.st && e.st.burn && aff('fire')>=6 && ents.indexOf(e)>=0;
  _killEl(e, by);
  if(burning){
    var o=ents.filter(function(n){ return n.foe && n.hp>0 && dist(n,e)<=3; }).sort(function(a,b){ return dist(a,e)-dist(b,e); })[0];
    if(o){ applyStatus(o,'burn',3,burnDmg()); boltFx(e.x,e.y,o.x,o.y,'fire'); log('Wildfire leaps to '+o.name+'.','c-fire'); }
  }
};

/* ---------------------------------------------------------------- enemies: tomb, stone, ground */
var _aiActEl = aiAct;
aiAct = function(e){
  if(e.tomb>0){ e.tomb--; if(e.tomb===0){ log('The ice around '+e.name+' shatters.','c-info'); sfx('ice-melt'); } e.t+=actCost(e); return; }
  if(e.st && e.st.stone){ tickStatus(e); e.t+=actCost(e); return; }
  var ox=e.x, oy=e.y;
  _aiActEl(e);
  if(!iceG || ents.indexOf(e)<0) return;
  var i=idxOf(e.x,e.y);
  if((e.x!==ox || e.y!==oy) && rootG[i]) applyStatus(e,'root',1);
};
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
var _actCostEl = actCost;
actCost = function(e){
  var c=_actCostEl(e);
  if(e===player){
    if(FREE_ACTION) return 0;
    if(player.stormUntil>player.t) c=Math.max(20, Math.round(c*0.5));
  }
  return c;
};
var _moveCostEl = moveCost;
moveCost = function(){ var c=_moveCostEl(); if(player.stormUntil>player.t) c=Math.round(c*0.25); return c; };
var _endTurnEl = endTurn;
endTurn = function(){
  if(!player || player.hp<=0) return _endTurnEl();
  FREE_ACTION = FREE_ACTION || (!player.movedThisTurn && (player.lastAttack || player.noisy) && aff('air')>=6 && rng()<0.15);
  var before=turn;
  _endTurnEl();
  FREE_ACTION=false;
  if(!player || player.hp<=0 || turn===before) return;
  groundTick();
  /* Fade (Shadow 3) */
  var fighting=ents.some(function(e){ return e.foe && e.state==='hunt' && vis[idxOf(e.x,e.y)]; });
  player.calm = fighting || player.noisy ? 0 : (player.calm||0)+1;
  if(aff('shadow')>=3 && player.calm>=50 && !(player.hidden>1)) player.hidden=2;
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
};

/* ---------------------------------------------------------------- casting the new spells */
function spellRoll(A){ var b=sDMG(roll(AOE_BASE[0],AOE_BASE[1])) + (aff('fire') && !A.divine ? aff('fire') : 0); return Math.round(b*spellPower(A)); }
function spellHit(f, A, amount, type){
  if(!f || f.hp<=0) return 0;
  var crit = rng()<player.crit, base=amount;
  if(crit) base=Math.round(base*1.6);
  LAST_HIT={att:player, def:f, crit:crit, surprise:f.state==='asleep'||player.hidden>0, spell:true};
  if(A.el==='light' && (f.base.undead||f.base.shadowy)) base=Math.round(base*1.5);
  if(f.state==='asleep') f.state='hunt';
  var d=applyDamage(f, base, type, player);
  floatText(f.x,f.y,String(d), type==='phys'?'phys':type, crit);
  f.lastHitBy=player;
  if(typeof spellOnHit==='function') spellOnHit(f, d, crit, A);
  return d;
}
function finishHit(f){ if(f && f.hp<=0 && ents.indexOf(f)>=0) kill(f, player); }
function beginCast(A){
  aiming=null;
  player.mp-=costOf(A);
  if(typeof spellConduct==='function') spellConduct(A);
  player.noisy=true;
  setClip(player,'cast');
  sfx(A.el==='fire'?'fire-cast':A.el==='water'?'ice-cast':A.el==='air'?'lightning-cast':A.el==='earth'?'earth-cast':A.el==='light'?'light-cast':'shadow-cast');
}
function foeAt(x,y){ return ents.filter(function(e){ return e.foe && e.x===x && e.y===y; })[0]; }
function summonCount(){ return ents.filter(function(e){ return e.ally && (e.undeadServant || e.livingFlame); }).length; }

var _useAbilityEl = useAbility;
useAbility = function(i){
  var key=player.abilities[i], A=ABILITIES[key];
  if(!A || !(AIM_KINDS[A.kind] || A.kind==='quake' || A.kind==='storm' || A.kind==='dawn')) return _useAbilityEl(i);
  if(player.mp < costOf(A)){ log('Not enough mana for '+A.name+' ('+costOf(A)+').','c-info'); sfx('no-mana'); return; }
  if(AIM_KINDS[A.kind]){
    if(aiming && aiming.i===i){ cancelAim(); return; }
    aiming={i:i, A:A};
    log('<b>'+A.name+'</b> &mdash; '+(A.kind==='umbral'?'click any tile you have seen':A.kind==='tomb'?'click an enemy, or yourself':'click a target within '+spellRange(A)+' tiles')+', or press Esc.','c-info');
    abilityBar(); draw(); return;
  }
  beginCast(A);
  if(A.kind==='quake'){
    SHAKE=10; var tiles=[];
    for(var y=player.y-A.radius;y<=player.y+A.radius;y++) for(var x=player.x-A.radius;x<=player.x+A.radius;x++){ if(!inb(x,y)) continue; tiles.push([x,y]); burst(x,y,'earth',3,0.04); }
    var dmg=spellRoll(A);
    ents.slice().forEach(function(e){ if(e===player || e.hp<=0 || dist(e,player)>A.radius) return;
      if(e.foe){ spellHit(e, A, dmg, 'phys'); finishHit(e); }
      else if(e.ally){ var ad=applyDamage(e, dmg, 'phys', player); floatText(e.x,e.y,String(ad),'phys'); if(e.hp<=0) kill(e,null); } });
    markGround(tiles, A);
    log('<b>Earthquake.</b> The ground heaves.','c-hit');
  } else if(A.kind==='storm'){
    player.stormUntil=player.t+600;
    sparkleFx(player.x,player.y,'lightning',40); ringFx(player.x,player.y,'#E8D27A',2.5);
    log('<b>Storm Form.</b> The world slows around you.','c-good');
    updateUI(); draw(); return;   /* instant: no time passes */
  } else if(A.kind==='dawn'){
    var n=0;
    ents.forEach(function(e){ if(e.foe && vis[idxOf(e.x,e.y)]){ applyStatus(e,'blind',3); n++; } });
    player.dawnUntil=turn+20;
    sparkleFx(player.x,player.y,'light',60); ringFx(player.x,player.y,'#F6E7B0',5);
    log('<b>Dawn.</b> '+n+' enem'+(n===1?'y is':'ies are')+' blinded, and nothing on this floor can hide from you.','c-good');
  }
  endTurn();
};
var _inRangeEl = inRange;
inRange = function(x,y){
  if(aiming && aiming.A.kind==='umbral') return inb(x,y) && !!seen[idxOf(x,y)];
  if(aiming && aiming.A.kind==='upheaval') return dist(player,{x:x,y:y})<=7 && inb(x,y) && (revealAll||vis[idxOf(x,y)]);
  return _inRangeEl(x,y);
};
function lineTiles(dx,dy,len){ var out=[], x=player.x, y=player.y; for(var i=0;i<len;i++){ x+=dx; y+=dy; if(!inb(x,y) || opaque(x,y)) break; out.push([x,y]); } return out; }
function bresenham(x0,y0,x1,y1,len){ var pts=[], dx=Math.abs(x1-x0), dy=Math.abs(y1-y0), sx=x0<x1?1:-1, sy=y0<y1?1:-1, err=dx-dy, x=x0, y=y0;
  while(pts.length<len && !(x===x1 && y===y1)){ var e2=2*err; if(e2>-dy){ err-=dy; x+=sx; } if(e2<dx){ err+=dx; y+=sy; } pts.push([x,y]); } return pts; }

var _castAtEl = castAt;
castAt = function(x,y){
  if(!aiming || !AIM_KINDS[aiming.A.kind]) return _castAtEl(x,y);
  var A=aiming.A, cf=faceOf(x-player.x, y-player.y); if(cf) player.face=cf;
  if(!inRange(x,y)){ log('Out of range.','c-info'); sfx('ui-error'); return false; }
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
    var ang=Math.atan2(y-player.y, x-player.x), dmg2=spellRoll(A), hitT=[];
    for(var cy=player.y-6;cy<=player.y+6;cy++) for(var cx=player.x-6;cx<=player.x+6;cx++){
      if(!inb(cx,cy) || (cx===player.x&&cy===player.y) || !vis[idxOf(cx,cy)]) continue;
      var d=dist(player,{x:cx,y:cy}); if(d>6) continue;
      var a=Math.atan2(cy-player.y, cx-player.x), diff=Math.abs(Math.atan2(Math.sin(a-ang), Math.cos(a-ang)));
      if(diff<=Math.PI/8 + 0.12/d) hitT.push([cx,cy]);
    }
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
    var perp = ddx && ddy ? [[0,0],[ddx,0],[0,ddy]] : [[0,0],[-ddy,ddx],[ddy,-ddx]], bt=[];
    perp.forEach(function(o){ var bx=player.x+o[0], by=player.y+o[1]; for(var k=0;k<6;k++){ bx+=ddx; by+=ddy; if(!inb(bx,by) || opaque(bx,by)) break; if(!bt.some(function(t){ return t[0]===bx&&t[1]===by; })) bt.push([bx,by]); } });
    beginCast(A);
    var dmg3=spellRoll(A);
    bt.forEach(function(t){ sparkleFx(t[0],t[1],'light',4); });
    ents.slice().forEach(function(e){ if(!e.foe || !bt.some(function(t){ return t[0]===e.x&&t[1]===e.y; })) return; spellHit(e,A,dmg3,'light'); if(e.hp>0 && rng()<0.25) applyStatus(e,'blind',2); finishHit(e); });
    markGround(bt, A);
    log('<b>Radiant Beam.</b>','c-hit');
  }
  else if(A.kind==='swarm'){
    var spots=[];
    for(var sy=y-1;sy<=y+1;sy++) for(var sx=x-1;sx<=x+1;sx++) if(inb(sx,sy) && walkable(sx,sy) && !occupied(sx,sy)) spots.push([sx,sy]);
    if(!spots.length){ log('No room for shadows there.','c-info'); return false; }
    beginCast(A);
    var p=Math.max(1,aff('shadow'));
    spots.forEach(function(s){ var m=spawn('wisp',s[0],s[1]); m.foe=false; m.ally=true; m.state='ally'; m.name='Shadow'; m.maxhp=m.hp=3; m.dmg=[2*p,2*p]; m.life=6; m.noXp=true; m.swarm=true; m.t=player.t; sparkleFx(s[0],s[1],'dark',8); });
    log('<b>Shadow Swarm.</b> '+spots.length+' shadows rise.','c-good');
  }
  else if(A.kind==='lflame'){
    if(!walkable(x,y) || occupied(x,y)){ log('The flame needs an empty tile.','c-info'); return false; }
    if(summonCount()>=2){ log('You already command two summons.','c-info'); return false; }
    beginCast(A);
    var sp=spellPower(A), m2=spawn('emberling',x,y);
    m2.foe=false; m2.ally=true; m2.state='ally'; m2.name='Living Flame'; m2.livingFlame=true; m2.rangedAlly=6; m2.noXp=true; m2.t=player.t;
    m2.maxhp=m2.hp=Math.round(20*sp); m2.dmg=[Math.round(4*sp), Math.round(8*sp)]; m2.life=20;
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
      for(var r=0;r<3 && player.hp>0;r++){ player.hp=Math.min(player.maxhp, player.hp+player.maxhp*0.05); player.movedThisTurn=false; endTurn(); }
      player.tombed=false; log('The tomb melts away.','c-info');
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
};

/* ranged summons (Living Flame) */
var _allyActEl = allyAct;
allyAct = function(e){
  if(!e.rangedAlly) return _allyActEl(e);
  if(!tickStatus(e)) return;
  e.life--; if(e.life<=0){ ents=ents.filter(function(o){ return o!==e; }); log('Your '+e.name+' gutters out.','c-info'); return; }
  if(e.st.stun || e.st.frozen){ e.t+=actCost(e); return; }
  var tgt=ents.filter(function(o){ if(!o.foe || o.hp<=0 || !vis[idxOf(o.x,o.y)] || dist(e,o)>e.rangedAlly) return false; var pth=boltPath(e.x,e.y,o.x,o.y), en=pth[pth.length-1]; return en && en.x===o.x && en.y===o.y; })
    .sort(function(a,b){ return dist(a,e)-dist(b,e); })[0];
  if(tgt){
    setClip(e,'attack'); boltFx(e.x,e.y,tgt.x,tgt.y,'fire');
    var d=applyDamage(tgt, roll(e.dmg[0],e.dmg[1]), 'fire', e); floatText(tgt.x,tgt.y,String(d),'fire');
    if(tgt.hp>0 && rng()<0.22) applyStatus(tgt,'burn',3,burnDmg());
    if(tgt.hp<=0) kill(tgt,e);
  } else if(dist(e,player)>2 && !e.st.root) stepToward(e, player.x, player.y);
  e.t+=actCost(e);
};

/* ---------------------------------------------------------------- the character sheet lists rank 3 and 6 passives */
var _panesEl = panes;
panes = function(){
  _panesEl();
  if(openSheet!=='Char' || !$('mChar')) return;
  var add='';
  for(var el in player.aff){ [3,6].forEach(function(r){ if(player.aff[el]>=r) add+='<div style="font-size:11px;color:'+AFF_COL[el]+';margin:2px 0">T'+r+': <span style="color:var(--ash)">'+RANK_TEXT[r][el]+'</span></div>'; }); }
  if(!add) return;
  var subs=$('mChar').querySelectorAll('.sub');
  for(var i=0;i<subs.length;i++) if(/^Race/.test(subs[i].textContent)){ subs[i].insertAdjacentHTML('beforebegin', add); break; }
};
