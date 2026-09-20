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
CLASSES.scoundrel.blurb = 'Dagger and parrying dagger, or a bow. Sap knocks a target out; the hit that wakes it is a surprise critical.';
CLASSES.tourist.passive = 'Well-Traveled: +1 stat point every 2 levels, +25% experience, and 1 free stat point to start.';
RACES.human.blurb = 'Adaptable. +1 to every stat, +1 stat point every 3 levels, piety +25%, and once per biome survives a killing blow at 1 HP.';
RACES.fae.blurb   = RACES.fae.blurb + ' Takes 25% more damage from the element opposite its court.';

var CLERIC_KITS = {
  grom:    {main:null,     armor:'robe'},
  grumbok: {main:'axe',    armor:'leather'},
  glimmer: {main:'mace',   armor:'leather', off:'holy'},
  murk:    {main:'censer', armor:'robe'},
  reginald:{main:'sword',  armor:'leather', off:'kite'},
  anvil:   {main:'mace',   armor:'chain'},
  vellum:  {main:'staff',  armor:'robe'}
};
var SCOUNDREL_KITS = {
  melee:  {main:'dagger', armor:'leather', off:'dagger', label:'Knife work', d:'Two daggers, leather armor'},
  ranged: {main:'bow',    armor:'leather', label:'Bowman', d:'Short bow and leather armor'}
};
function kitFor(c){
  if(c.cls==='cleric'){ var g=c.god==='wobbles' ? pick(Object.keys(CLERIC_KITS)) : c.god; return CLERIC_KITS[g] || CLASSES.cleric.kit; }
  if(c.cls==='scoundrel') return SCOUNDREL_KITS[c.kit||'melee'];
  return CLASSES[c.cls].kit;
}
function kitNames(c){
  if(c.cls==='cleric' && c.god==='wobbles') return ['A random god-given kit'];
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
ABILITIES.sap.desc = 'Range 2: knocks the target out for 3 turns (6 if it was unaware). The hit that wakes it is a surprise critical. A sapped enemy can never be stunned again.';
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
  if(c.cls==='scoundrel' && sum){
    if(!SCOUNDREL_KITS[c.kit]) c.kit='melee';
    var h='<div class="step">Scoundrel kit</div><div class="cards" style="grid-template-columns:repeat(auto-fill,minmax(200px,1fr))">';
    Object.keys(SCOUNDREL_KITS).forEach(function(k){ var K=SCOUNDREL_KITS[k]; h+='<button class="card'+(c.kit===k?' on':'')+'" data-kit="'+k+'"><b>'+K.label+'</b><span>'+K.d+'</span></button>'; });
    sum.insertAdjacentHTML('beforebegin', h+'</div>');
    el.querySelectorAll('[data-kit]').forEach(function(b){ b.onclick=function(){ sfx('ui-click'); c.kit=b.getAttribute('data-kit'); renderCreate(); }; });
  }
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
  player.armorItem=item(ARMORS,k.armor) || item(ARMORS,'robe');
  /* an off-hand kit slot may name a light weapon now that there is no separate off-hand dagger */
  player.off = k.off ? (OFFHANDS[k.off] ? item(OFFHANDS, k.off)
                        : (WEAPONS[k.off] ? offHandWeapon(item(WEAPONS, k.off)) : EMPTY_OFF))
                     : EMPTY_OFF;
  player.kit=c.kit;
  if(c.cls==='tourist') player.points=(player.points||0)+1;
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
};
var _playerShieldCls = playerShield;
playerShield = function(){ return _playerShieldCls() + Math.max(0, Math.floor(player.guard||0)); };

/* Cleric: piety 25% faster.
   2026-09-20 (Justin): the per-rank discount on a divine invoke is gone. An invoke never gets cheaper as your
   piety grows - it gets stronger. Saint Glimmer's Heal already scales (+5% a rank, combat.js castSelf) and
   Sylla's Into the Dark does the same; that is what rank buys. */
var _gainPietyCls = gainPiety;
gainPiety = function(n, why){ return _gainPietyCls(player && player.cls==='cleric' ? n*1.25 : n, why); };

/* Experience curve (level cap 20), refit 2026-09-17 after doubling monster density: XP for the next level =
   50 x 1.55^(level-1), rounded to 5 (50, 80, 120, 185, 290, 450, 695, 1075 ...). Measured biome 1 full clears on the
   56x34 floors average about 135/240/400/660/620 XP (floor 5 includes the 330 XP boss), cumulative 135/375/775/1435/2055:
   level 3 on floor 1, 4 after floor 2, 6 after floor 3, 7 after floor 4 and 8 after the boss. */
function xpToNext(level){ return Math.round(50*Math.pow(1.55, level-1)/5)*5; }

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
    if(s && s.key==='shadowstep'){ var c=b.querySelector('.c'), left=cdLeft('shadowstep'); if(c) c.textContent = left ? left+' turns' : 'ready'; if(left) b.style.opacity='0.6'; }
  });
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
    var fighting=ents.some(function(e){ return e.foe && e.state==='hunt' && vis[idxOf(e.x,e.y)]; });
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
applyStatus = function(e, key, turns, extra){ if(key==='stun' && e && e!==player && e.stunImmune) return; return _applyStatusSap(e, key, turns, extra); };
