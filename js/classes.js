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
CLASSES.fighter.passive = 'Guard: a shield of overhealth (12% of your max HP) that refills out of combat.';
CLASSES.cleric.passive  = 'Starts sworn to a god (rank 1, 20 piety). Gains piety 25% faster.';
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
   /* 2026-09-17: techniques cost 7 so martials keep their rhythm on the leaner mana pool */

/* 2026-09-17: Sap reaches 2 tiles whatever you hold (a bow no longer makes it a 6-tile knockout), and an enemy
   that has been sapped is immune to stuns from then on */
 delete ABILITIES.sap.useWeaponRange;


/* ---------------------------------------------------------------- creation */
var _renderCreateCls = renderCreate;
renderCreate = function(){
  _renderCreateCls();
  var c=CHOICE, el=$('create'); if(!el) return;
  var sum=el.querySelector('.summary');
  if(c.cls==='scoundrel') c.kit='melee';   /* 2026-09-20: one kit, so the picker is gone */
  el.querySelectorAll('.summary .kv span').forEach(function(sp){ if(sp.textContent==='Starting kit' && sp.nextElementSibling) sp.nextElementSibling.textContent=kitNames(c).join(', '); });
};

/* ---------------------------------------------------------------- a new run */


/* ---------------------------------------------------------------- derived */


/* Cleric: piety 25% faster.
   2026-09-20 (Justin): the per-rank discount on a divine invoke is gone. An invoke never gets cheaper as your
   piety grows - it gets stronger. Saint Glimmer's Heal already scales (+5% a rank, combat.js castSelf) and
   Sylla's Into the Dark does the same; that is what rank buys. */


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


/* ---------------------------------------------------------------- Shadowstep and cooldowns */
function cdLeft(key){ return Math.max(0, ((player.cds||{})[key]||0) - turn); }


/* ---------------------------------------------------------------- Charge (2026-09-22)
   Justin: warriors need a charge - in an open space anything ranged just kites them forever, and there has to be a
   reason to play a Fighter over a Cleric. The Fighter rushes up to five tiles in a straight line at an enemy, the
   blow cannot miss, and every enemy next to where they land is stunned for two turns. No mana; a 20-turn cooldown.
   The run has to be a clear straight line (boltPath's, the same line an arrow flies) over walkable, empty tiles. */

function chargeLane(f, ground){
  /* Justin, 2026-09-22: Charge also targets open ground, so a warrior can break away from a crowd. */
  var path=boltPath(player.x,player.y,f.x,f.y), end=path[path.length-1];
  if(!end || end.x!==f.x || end.y!==f.y) return null;                 /* something stands in the line */
  var run=ground ? path : path.slice(0,-1);                           /* to the tile itself, or every tile short of the enemy */
  if(run.length>ABILITIES.charge.range-1) return null;
  for(var i=0;i<run.length;i++){ var t=run[i]; if(!walkable(t.x,t.y) || occupied(t.x,t.y)) return null; }
  return run;
}


/* ---------------------------------------------------------------- Double Strike is one attack action */
/* (attack() flags player.lastAttack, so the turn already costs attack time) */

/* ---------------------------------------------------------------- Fighter guard refills out of combat */

function turnClassRecovery(context){
  if(!player || player.hp<=0) return;
  player.noisy=false;
  if(player.guardMax>0 && (player.guard||0)<player.guardMax){
    var fighting=player.t-(player.lastDamageTime||0)<500;
    if(!fighting) player.guard=Math.min(player.guardMax, (player.guard||0)+context.cost/100);
  }

}

/* ---------------------------------------------------------------- Sap: the waking hit is a surprise crit */


/* Magic Missile used to roll its own rider for every affinity point (25% + 5% per point to Burn, Chill,
   Root, Blind, Fear or chain a bolt). Weapon enchantments proc on spells now (js/spellench.js), so that
   second, invisible chance is gone: what your missiles do to a target is what your focus is enchanted with.
   Magic Missile keeps what makes it Magic Missile - it always hits, nothing resists it, and its damage still
   grows with every affinity point. (2026-09-17) */

/* ---------------------------------------------------------------- stealth: everyone has a stealth score */

/* chance per turn that an unaware enemy notices you; hunting enemies are unaffected */
function noticeChance(e, see, d, asleep){
  var cut = isScoundrel() ? 2 : 0, ch=0;
  if(asleep) ch = see && d<=Math.max(1,7-cut) ? 0.55 : d<=Math.max(1,3-cut) ? 0.2 : 0;
  else ch = see && d<=Math.max(1,9-cut) ? 0.7 : 0;
  if(isScoundrel()) ch*=0.5;
  return ch*(1-stealthScore());
}

function castChargeTarget(x,y){
  var f=ents.filter(function(e){ return e.foe && e.hp>0 && e.x===x && e.y===y; })[0];
  if(!inRange(x,y)){ log('Too far to charge.','c-info'); sfx('ui-error'); return false; }
  if(!f && (x===player.x && y===player.y || !walkable(x,y) || occupied(x,y))){ log('Charge at an enemy or onto open ground.','c-info'); sfx('ui-error'); return false; }
  if(!f && dist(player,{x:x,y:y})>ABILITIES.charge.range-1){ log('Too far to charge.','c-info'); sfx('ui-error'); return false; }
  var run=chargeLane(f||{x:x,y:y}, !f);
  if(!run){ log(f ? 'No clear straight run at the '+f.name+'.' : 'No clear straight run to that tile.','c-info'); sfx('ui-error'); return false; }
  aiming=null; player.cds=player.cds||{}; player.cds.charge=turn+ABILITIES.charge.cd;
  var from={x:player.x,y:player.y};
  if(run.length){ var stop=run[run.length-1]; player.x=stop.x; player.y=stop.y; if(typeof computeFOV==='function') computeFOV(); }
  if(typeof faceOf==='function'){ var cf=faceOf(x-from.x, y-from.y); if(cf) player.face=cf; }
  sfx('charge'); if(typeof SHAKE!=='undefined') SHAKE=5; if(typeof ringFx==='function') ringFx(player.x,player.y,'#E8B44A',1.6);
  if(f)attack(player,f,1,'Charge',{sureHit:true});
  var stunned=0; ents.forEach(function(e){ if(e.foe && e.hp>0 && dist(e,player)<=1){ applyStatus(e,'stun',2); stunned++; } });
  log('<b>Charge!</b>'+(stunned ? ' Everything around you reels.' : f ? '' : ' You break away.'),'c-good');
  player.hidden=0; endTurn(); return true;
}
