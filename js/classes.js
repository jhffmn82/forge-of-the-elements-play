/* =====================================================================
   classes.js - classes, races and stealth (mechanics review 2026-09-16,
   DESIGN.md 12 steps 4a-4e and 9).
   Fighter guard, Double Strike, Cleric kits and piety, Mage staff kit and
   Missile riders, Scoundrel kits / Sap / Shadowstep, Tourist and Human
   bonuses, and the stealth score every character has.
   Loads before tiers.js, so the kits it hands out become T0 gear there.
   ===================================================================== */

var FIGHTER_NO_BLOCK = true;   /* Shield Training is gone; tiers.js reads this */

/* ---------------------------------------------------------------- tables */
CLASSES.fighter.passive = 'Guard: a shield of overhealth (5 + half your level) that refills out of combat.';
CLASSES.cleric.passive  = 'Starts sworn to a god (rank 1, 20 piety). Gains piety 25% faster, and Invoke costs 1 less mana per piety rank.';
CLASSES.mage.passive    = 'Deep Reserves: +30% max mana.';
CLASSES.mage.blurb      = 'A staff and a robe. Magic Missile always hits, and can carry your elements’ effects.';
CLASSES.mage.kit        = {main:'staff', alt:null, armor:'robe', off:null};
CLASSES.scoundrel.passive = 'Sneaky: surprise attacks x2. Enemies notice you 2 tiles closer and half as often. Shadowstep hides you when no enemy is adjacent.';
CLASSES.scoundrel.blurb = 'A dagger in each hand and a bow across the back. Sap knocks a target out; the hit that wakes it is a surprise critical.';
CLASSES.tourist.passive = 'Well-Traveled: +1 stat point every 2 levels, +25% experience, and 1 free stat point to start.';
RACES.human.blurb = 'Adaptable. +1 to every stat, +1 stat point every 3 levels, piety +25%.';
RACES.fae.blurb   = RACES.fae.blurb + ' Takes 25% more damage from the element opposite its court.';

/* 2026-09-20: Justin - "scoundrel shouldn't have two paths, the starting set should just be 2 daggers and a bow".
   One kit: a dagger in each hand and a bow slung, which the ranged slot fires without swapping. */
var SCOUNDREL_KITS = {
  melee: {main:'dagger', armor:'leather', off:'dagger', alt:'bow', label:'Knife work', d:'Two daggers, a short bow, leather armor'}
};
function kitFor(c){
  if(c.cls==='cleric') return startingKit(c);
  if(c.cls==='scoundrel') return SCOUNDREL_KITS.melee;   /* one kit, always */
  return CLASSES[c.cls].kit;
}
function kitNames(c){
  var k=kitFor(c), out=[];
  out.push(k.main ? WEAPONS[k.main].name : 'Fists');
  if(k.alt) out.push(WEAPONS[k.alt].name);
  if(k.armor) out.push(ARMORS[k.armor].name);
  if(k.off) out.push(offKitItem(k.off).name);
  return out;
}

/* abilities */
ABILITIES.double.cost = 7;   /* 2026-09-17: techniques cost 7 so martials keep their rhythm on the leaner mana pool */
ABILITIES.sap.cost = 7;
/* 2026-09-17: Sap reaches 2 tiles whatever you hold (a bow no longer makes it a 6-tile knockout), and an enemy
   that has been sapped is immune to stuns from then on */
ABILITIES.sap.range = 2; delete ABILITIES.sap.useWeaponRange;
ABILITIES.sap.desc = 'Range 2: knocks the target out for 3 turns (6 if it was unaware). The hit that wakes it is a surprise critical. A target can only be Sapped once; other Stuns still work.';
ABILITIES.double.desc = 'An attack: two weapon hits on an adjacent enemy for the time of one attack.';
ABILITIES.missile.desc = 'Always hits; magic damage nothing resists. +1 base damage per affinity point. For each element you hold, a 25% chance (+5% per point) to add its effect: Burning, Chill, an arc, Root, Blind or Fear.';
ABILITIES.shadowstep = {name:'Shadowstep', cost:0, cd:15, kind:'self', tech:true, icon:'ic-shadowstep', desc:'With no enemy next to you, slip into hiding for 3 turns; hunting enemies lose you. 15-turn cooldown.'};
['firebolt','frostshard','spark','root','smite','shadowbolt'].forEach(function(k){ ABILITIES[k].cost=20; ABILITIES[k].base=[14,22]; });

/* ---------------------------------------------------------------- creation */
var _statsForCls = statsFor;
statsFor = function(c){ var s=_statsForCls(c); if(c.race==='human') for(var k in s) s[k]++; return s; };
var _renderCreateCls = renderCreate;
renderCreate = function(){
  _renderCreateCls();
  var c=CHOICE, el=$('create'); if(!el) return;
  var sum=el.querySelector('.summary');
  if(c.cls==='scoundrel') c.kit='melee';   /* 2026-09-20: one kit, so the picker is gone */
  el.querySelectorAll('.summary .kv span').forEach(function(sp){ if(sp.textContent==='Starting kit' && sp.nextElementSibling) sp.nextElementSibling.textContent=kitNames(c).join(', '); });
};

/* ---------------------------------------------------------------- a new run */
var _newRunCls = newRun;
newRun = function(seed, choice){
  _newRunCls(seed, choice);
  var c=window.LAST_CHOICE || choice || CHOICE, k=kitFor(c);
  function item(table, key){ if(!key) return null; var g=clone(table[key]); g.key=key; g.tier=0; g.plus=0; return g; }
  /* the alt weapon goes in the ranged slot if it has reach, else into the bag (js/rangedslot.js) */
  player.sets=[item(WEAPONS,k.main), null]; player.activeSet=0;
  var alt=item(WEAPONS,k.alt);
  player.ranged = (alt && (alt.range||0)>1) ? alt : null;
  if(alt && !player.ranged && typeof addBag==='function') addBag('⚔', gearName(alt), {kind:'weapon', data:alt});
  player.armorItem=item(ARMORS,k.armor);
  /* an off-hand kit slot may name a light weapon now that there is no separate off-hand dagger */
  player.off = k.off ? (OFFHANDS[k.off] ? item(OFFHANDS, k.off)
                        : (WEAPONS[k.off] ? offHandWeapon(item(WEAPONS, k.off)) : EMPTY_OFF))
                     : EMPTY_OFF;
  player.kit=c.kit;
  if(c.cls==='tourist') player.points=(player.points||0)+1;
  RUN.xpCurveVersion=XP_CURVE_VERSION;
  player.cds={}; player.xpNext=xpToNext(1);
  derive(player);
  player.hp=player.maxhp; player.mp=player.maxmp; player.guard=player.guardMax||0;
  player.hotbar=null; updateUI();
};

/* ---------------------------------------------------------------- derived */
var _deriveCls = derive;
derive = function(p){
  _deriveCls(p);
  if(p!==player) return;
  p.guardMax = p.cls==='fighter' ? Math.max(3, Math.round(p.maxhp*0.12)) : 0;   /* a share of the pool, not a flat slab */
  if(p.guard===undefined) p.guard=p.guardMax;
  p.guard=Math.min(p.guard, p.guardMax);
  if(p.cls==='scoundrel' && p.abilities.indexOf('shadowstep')<0) p.abilities.splice(1, 0, 'shadowstep');
  if(p.cls==='fighter' && p.abilities.indexOf('charge')<0) p.abilities.splice(1, 0, 'charge');
};
var _playerShieldCls = playerShield;
playerShield = function(){ return _playerShieldCls() + Math.max(0, Math.floor(player.guard||0)); };

/* Cleric: piety 25% faster.
   2026-09-20 (Justin): the per-rank discount on a divine invoke is gone. An invoke never gets cheaper as your
   piety grows - it gets stronger. Saint Glimmer's Heal already scales (+5% a rank, combat.js castSelf) and
   Sylla's Into the Dark does the same; that is what rank buys. */
var _gainPietyCls = gainPiety;
gainPiety = function(n, why){ return _gainPietyCls(n, why); };

/* Experience curve (level cap 20). The former 1.55 growth stranded a full-clear
   floor-18 character at level 12. Growth 1.267 mapped that same lifetime XP to
   level 18 and put level 20 before the end of biome four.
   2026-09-22 (Justin): level 20 should land on the biome-4 boss. Iris's full-clear
   export reached the Matron's death with 18,409 lifetime XP, having hit 20 some
   1,800 earlier; growth 1.275 asks 18,210 for level 20, so that run dings 20 as
   the Matron falls. Each version's curve is kept so an older save can be
   re-levelled from its lifetime XP; a save is never demoted by a steeper curve. */
var XP_CURVE_VERSION=3, XP_GROWTH=1.275;
var XP_GROWTH_BY_VERSION={1:1.55, 2:1.267, 3:XP_GROWTH};
function xpToNextAt(growth, level){ return Math.round(50*Math.pow(growth, level-1)/5)*5; }
function xpToNext(level){ return xpToNextAt(XP_GROWTH, level); }
function legacyXpToNext(level){ return xpToNextAt(1.55, level); }
function lifetimeXp(p, cost){
  var total=p.xp||0;for(var level=1;level<(p.level||1);level++)total+=cost(level);return total;
}
function migrateXpCurve(){
  if(!RUN||!player)return false;
  if((RUN.xpCurveVersion||0)>=XP_CURVE_VERSION){player.xpNext=xpToNext(player.level);return false;}
  var was=XP_GROWTH_BY_VERSION[RUN.xpCurveVersion||1]||1.55;
  var total=lifetimeXp(player,function(l){ return xpToNextAt(was,l); }),oldLevel=player.level||1,newLevel=1;
  while(newLevel<20&&total>=xpToNext(newLevel)){total-=xpToNext(newLevel);newLevel++;}
  for(var level=oldLevel+1;level<=newLevel;level++)player.points=(player.points||0)+levelStatPoints(player,level);
  if(newLevel<oldLevel){newLevel=oldLevel;total=0;}   /* stat points are spent; the level stays, the bar restarts */
  player.level=newLevel;player.xp=newLevel>=20?Math.min(total,xpToNext(20)-1):total;player.xpNext=xpToNext(newLevel);
  RUN.xpCurveVersion=XP_CURVE_VERSION;
  return newLevel!==oldLevel;
}

/* Tourist: +25% experience */
var _gainXPCls = gainXP;
gainXP = function(n){
  player.xpNext = xpToNext(player.level);
  var lv=player.level, r=_gainXPCls(player.cls==='tourist' ? Math.round(n*1.25) : n);
  if(player.level!==lv) player.xpNext=xpToNext(player.level);
  return r;
};

/* ---------------------------------------------------------------- Shadowstep and cooldowns */
function cdLeft(key){ return Math.max(0, ((player.cds||{})[key]||0) - turn); }
var _useAbilityCls = useAbility;
useAbility = function(i){
  var key=player.abilities[i];
  if(key==='shadowstep'){
    if(cdLeft(key)>0){ log('Shadowstep is not ready ('+cdLeft(key)+' turns).','c-info'); sfx('ui-error'); return; }
    if(ents.some(function(e){ return e.foe && dist(e,player)<=1; })){ log('Not with an enemy right next to you.','c-info'); sfx('ui-error'); return; }
    player.cds=player.cds||{}; player.cds.shadowstep=turn+ABILITIES.shadowstep.cd;
    player.hidden=4;
    ents.forEach(function(e){ if(e.foe && e.state==='hunt'){ e.state='wander'; e.lastSeen=null; e.goal=null; } });
    setClip(player,'cast'); sfx('vanish'); sparkleFx(player.x,player.y,'dark',18);
    log('You <b>Shadowstep</b> into hiding.','c-good');
    endTurn(); return;
  }
  return _useAbilityCls(i);
};
var _abilityBarCls = abilityBar;
abilityBar = function(){
  _abilityBarCls();
  if(!player || !player.hotbar || !$('hotbar')) return;
  $('hotbar').querySelectorAll('.slot[data-i]').forEach(function(b){
    var s=player.hotbar[+b.getAttribute('data-i')];
    if(s && s.type==='ability' && ABILITIES[s.key] && ABILITIES[s.key].cd){ var c=b.querySelector('.c'), left=cdLeft(s.key); if(c) c.textContent = left ? left+' turns' : 'ready'; if(left) b.style.opacity='0.6'; }
  });
};

/* ---------------------------------------------------------------- Charge (2026-09-22)
   Justin: warriors need a charge - in an open space anything ranged just kites them forever, and there has to be a
   reason to play a Fighter over a Cleric. The Fighter rushes up to five tiles in a straight line at an enemy, the
   blow cannot miss, and every enemy next to where they land is stunned for two turns. No mana; a 20-turn cooldown.
   The run has to be a clear straight line (boltPath's, the same line an arrow flies) over walkable, empty tiles. */
ABILITIES.charge = {name:'Charge', cost:0, cd:20, kind:'charge', range:6, tech:true, icon:'ic-charge',
  desc:'Rush up to 5 tiles in a straight line, at an enemy or to open ground. A blow on the target cannot miss, and every enemy next to you where you land is stunned for 2 turns. 20-turn cooldown.'};
function chargeLane(f, ground){
  /* Justin, 2026-09-22: Charge also targets open ground, so a warrior can break away from a crowd. */
  var path=boltPath(player.x,player.y,f.x,f.y), end=path[path.length-1];
  if(!end || end.x!==f.x || end.y!==f.y) return null;                 /* something stands in the line */
  var run=ground ? path : path.slice(0,-1);                           /* to the tile itself, or every tile short of the enemy */
  if(run.length>ABILITIES.charge.range-1) return null;
  for(var i=0;i<run.length;i++){ var t=run[i]; if(!walkable(t.x,t.y) || occupied(t.x,t.y)) return null; }
  return run;
}
var _useAbilityCharge = useAbility;
useAbility = function(i){
  var key=player.abilities[i];
  if(key!=='charge') return _useAbilityCharge(i);
  if(cdLeft(key)>0){ log('Charge is not ready ('+cdLeft(key)+' turns).','c-info'); sfx('ui-error'); return; }
  if(player.st.root || player.st.frozen){ log('You cannot charge while held fast.','c-info'); sfx('ui-error'); return; }
  if(aiming && aiming.i===i){ cancelAim(); return; }
  aiming={i:i, A:ABILITIES.charge};
  log('<b>Charge</b> &mdash; click an enemy, or open ground, within 5 tiles in a straight line; Esc cancels.','c-info');
  abilityBar(); draw();
};
var _inRangeCharge = inRange;
inRange = function(x,y){
  if(aiming && aiming.A.kind==='charge') return dist(player,{x:x,y:y})<=ABILITIES.charge.range && inb(x,y) && (revealAll || vis[idxOf(x,y)]);
  return _inRangeCharge(x,y);
};
var _castAtCharge = castAt;
castAt = function(x,y){
  if(!aiming || aiming.A.kind!=='charge') return _castAtCharge(x,y);
  var f=ents.filter(function(e){ return e.foe && e.hp>0 && e.x===x && e.y===y; })[0];
  if(!inRange(x,y)){ log('Too far to charge.','c-info'); sfx('ui-error'); return false; }
  if(!f && (x===player.x && y===player.y || !walkable(x,y) || occupied(x,y))){ log('Charge at an enemy or onto open ground.','c-info'); sfx('ui-error'); return false; }
  var run=chargeLane(f||{x:x,y:y}, !f);
  if(!run){ log(f ? 'No clear straight run at the '+f.name+'.' : 'No clear straight run to that tile.','c-info'); sfx('ui-error'); return false; }
  aiming=null; player.cds=player.cds||{}; player.cds.charge=turn+ABILITIES.charge.cd;
  var from={x:player.x,y:player.y};
  if(run.length){ var stop=run[run.length-1]; player.x=stop.x; player.y=stop.y; if(typeof computeFOV==='function') computeFOV(); }
  if(typeof faceOf==='function'){ var cf=faceOf(x-from.x, y-from.y); if(cf) player.face=cf; }
  sfx('charge'); if(typeof SHAKE!=='undefined') SHAKE=5; if(typeof ringFx==='function') ringFx(player.x,player.y,'#E8B44A',1.6);
  if(f){ player._sureHit=true; try{ attack(player, f, 1, 'Charge'); } finally{ player._sureHit=false; } }
  var stunned=0; ents.forEach(function(e){ if(e.foe && e.hp>0 && dist(e,player)<=1){ applyStatus(e,'stun',2); stunned++; } });
  log('<b>Charge!</b>'+(stunned ? ' Everything around you reels.' : f ? '' : ' You break away.'),'c-good');
  player.hidden=0; endTurn(); return true;
};

/* ---------------------------------------------------------------- Double Strike is one attack action */
/* (attack() flags player.lastAttack, so the turn already costs attack time) */

/* ---------------------------------------------------------------- Fighter guard refills out of combat */
var _endTurnCls = endTurn;
endTurn = function(){
  _endTurnCls();
  if(!player || player.hp<=0) return;
  player.noisy=false;
  if(player.guardMax>0 && (player.guard||0)<player.guardMax){
    var fighting=player.t-(player.lastDamageTime||0)<500;
    if(!fighting) player.guard=Math.min(player.guardMax, (player.guard||0)+1);
  }
};

/* ---------------------------------------------------------------- Sap: the waking hit is a surprise crit */
var _castAtCls = castAt;
castAt = function(x,y){
  var key=aiming && player.abilities[aiming.i];
  var f=ents.filter(function(e){ return e.foe && e.x===x && e.y===y; })[0];
  var saved=player.crit, sapped=f && f.sapped;
  if(sapped) player.crit=1;
  if(aiming) player.noisy=true;
  var r=_castAtCls(x,y);
  player.crit=saved;
  if(r && key==='sap' && f && f.hp>0 && f.st.stun && !f.stunImmune){ f.sapped=true; f.stunImmune=true; }
  return r;
};
var _attackCls = attack;
attack = function(att, def, mult, label){
  if(att===player) player.noisy=true;
  if(att===player && def && def.sapped){
    var saved=player.crit; player.crit=1;
    _attackCls(att, def, mult, label);
    player.crit=saved; return;
  }
  return _attackCls(att, def, mult, label);
};
var _applyDamageCls = applyDamage;
applyDamage = function(target, amount, type, source){
  var d=_applyDamageCls(target, amount, type, source);
  if(target && target!==player && target.sapped && d>0){ target.sapped=false; if(target.st) delete target.st.stun; }
  return d;
};

/* Magic Missile used to roll its own rider for every affinity point (25% + 5% per point to Burn, Chill,
   Root, Blind, Fear or chain a bolt). Weapon enchantments proc on spells now (js/spellench.js), so that
   second, invisible chance is gone: what your missiles do to a target is what your focus is enchanted with.
   Magic Missile keeps what makes it Magic Missile - it always hits, nothing resists it, and its damage still
   grows with every affinity point. (2026-09-17) */

/* ---------------------------------------------------------------- stealth: everyone has a stealth score */
function stealthScore(){
  if(!player || player.noisy) return 0;
  if(typeof hasGod==='function' && hasGod('reginald')) return 0;   /* 2026-09-22 (Justin): the Unsneaky cannot sneak; not written on any card */
  var s=0.02*Math.max(0, player.stats.agi-10);
  if(isScoundrel()) s+=0.25;
  if(!player.movedLast) s+=0.20;
  if(gAt(player.x,player.y)===G_GRASS) s+=0.25;
  var rm=roomAt(player.x,player.y); if(rm && rm.dark) s+=0.25;
  var w=(player.armorItem||{}).weight; if(w==='medium') s-=0.10; else if(w==='heavy') s-=0.25;
  if(typeof stealthExtra==='function') s+=stealthExtra();
  return Math.max(0, Math.min(0.9, s));
}
/* chance per turn that an unaware enemy notices you; hunting enemies are unaffected */
function noticeChance(e, see, d, asleep){
  var cut = isScoundrel() ? 2 : 0, ch=0;
  if(asleep) ch = see && d<=Math.max(1,7-cut) ? 0.55 : d<=Math.max(1,3-cut) ? 0.2 : 0;
  else ch = see && d<=Math.max(1,9-cut) ? 0.7 : 0;
  if(isScoundrel()) ch*=0.5;
  return ch*(1-stealthScore());
}

/* a sapped enemy shrugs off every later stun (Sap, Spark, Bellow, Pummel...) */
var _applyStatusSap = applyStatus;
applyStatus = function(e, key, turns, extra){ return _applyStatusSap(e, key, turns, extra); };
