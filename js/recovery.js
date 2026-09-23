/* Owner-settled recovery rules. These extend the original game; no candidate engine is mounted. */
function recoveryInCombat(){return ents.some(function(e){return e.foe && e.hp>0 && vis[idxOf(e.x,e.y)] && e.state==='hunt';});}
GODS.grom.boons[2]='Living Mountain: enchant your fists and body at the Forge. Taking damage grants Hardened for 3 turns: +4 Armour and 15% elemental resistance; refreshes without stacking.';
GODS.grom.rule='No weapons, shields, or body armour, including cloth. Holy Symbol, rings and amulet remain legal.';
GODS.murk.boons[1]='Grave Strength: your servant becomes a Zombie Bruiser at rank 3.';
GODS.murk.boons[2]='Lich: your servant becomes a Lich at rank 5 and returns once, one turn after destruction, at half health.';
GODS.murk.prayers=['raisedead','bonespear'];
GODS.anvil.prayers=['fieldsmelt','anviltoll'];   /* 2026-09-23 (Justin): Anvil's Toll replaces Reforge at rank 4 */
PRAYERS.fieldsmelt={name:'Field Smelt',rank:2,favor:0,desc:'Outside combat, recycle one carried item for its full normal value. Free and instant.'};
PRAYERS.reforge.favor=100;
PRAYERS.anviltoll={name:"Anvil's Toll",rank:4,favor:20,desc:'20 Favor, one action: you bring the hammer down. Every enemy within 2 tiles takes a full weapon attack, is thrown back 2 tiles and stunned for 1 turn.'};
PRAYERS.reforge.desc='Outside combat, spend 100 Favor to permanently add +1 to your main-hand weapon, up to +3.';
PRAYERS.bonespear={name:'Bone Spear',rank:4,favor:5,desc:'A piercing straight-line spell: 10–16 Dark damage, range 6. Costs 5 Favor and one action.'};
// Old hotbar entries retain usable links after the approved prayer replacements.
PRAYERS.corpsefeast=PRAYERS.bonespear;
PRAYERS.offering=PRAYERS.fieldsmelt;
ABILITIES.temper.favor=8;ABILITIES.unholyaura.favor=8;if(ABILITIES.arcaneward){ABILITIES.arcaneward.favor=8;ABILITIES.arcaneward.cost=0;}   /* 2026-09-22 audit: the card said 8 Favor, the code took 8 mana */
ABILITIES.temper.desc='Invoke (Old Anvil): 8 Favor, instant. +2 base damage and +4 Armour for 12 turns.';
ABILITIES.unholyaura.desc='Invoke (Mother Murk): 8 Favor, one action. For 8 turns, enemies within 2 take (5 + rank) × divine scaling Dark damage; heal 1 HP per enemy.';

var _deriveRecovery=derive;
derive=function(p){
  _deriveRecovery(p);
  if(p!==player)return;
  if(livingMountain(p) && p.weapon.unarmed)p.weapon=Object.assign({},p.weapon,{enchant:p.gromFistEnchant||null});
  if(livingMountain(p) && buff('hardened'))p.armor+=4;
  if(buff('temper'))p.armor+=4;
};
var _resistRecovery=resistMult;
resistMult=function(target,type){
  var m=_resistRecovery(target,type);
  if(target===player && livingMountain(player) && buff('hardened') && ['fire','ice','lightning','poison','light','dark'].indexOf(type)>=0)m=Math.max(0,m-0.15);
  return m;
};
var _damageRecovery=applyDamage;
function refreshHardened(){
  if(player.hp<=0 || !livingMountain(player))return;
  player.buffs.hardened=3;
  player._buffPrev=player._buffPrev||{};player._buffPrev.hardened=0;
  derive(player);
}
applyDamage=function(target,amount,type,source){
  var d=_damageRecovery(target,amount,type,source);
  if(target===player && d>0)refreshHardened();
  return d;
};
var _tickStatusRecovery=tickStatus;
tickStatus=function(e){
  var hp=e.hp,r=_tickStatusRecovery(e);
  if(e===player && e.hp<hp)refreshHardened();
  return r;
};
if(typeof STATUS_INFO!=='undefined')STATUS_INFO.hardened={name:'Hardened',icon:'st-stone',d:'+4 Armour and 15% elemental resistance. Damage refreshes its three-turn duration.'};

var _useAbilityRecovery=useAbility;
useAbility=function(i){
  var key=player.abilities[i];
  if(key==='arcaneward'){ if((player.favor||0)<8){log('Not enough Favor (8 required).','c-info');return;} player.favor-=8; return _useAbilityRecovery(i); }
  if(key!=='temper' && key!=='unholyaura')return _useAbilityRecovery(i);
  if((player.favor||0)<8){log('Not enough Favor (8 required).','c-info');return;}
  player.favor-=8;setClip(player,'cast');
  if(key==='temper'){player.buffs.temper=divineDuration(12);derive(player);log('Temper: +2 base damage and +4 Armour for 12 turns.','c-good');sfx('forge-enchant');}
  else {
    var div=divineStrength()+0.03*Math.max(0,player.stats.foc-10);
    player.st.aura={t:divineDuration(8),d:Math.round((5+godRank())*div)};
    log('Unholy Aura surrounds you.','c-good');sfx('shadow-cast');endTurn();
  }
  updateUI();
};
/* Anvil's Toll: a weapon attack on everything within two tiles, each thrown back and stunned (2026-09-23) */
var _usePrayerToll=usePrayer;
usePrayer=function(pid){
  if(pid!=='anviltoll') return _usePrayerToll.apply(this, arguments);
  if(!canPray(pid)){ log('You cannot offer that prayer right now.','c-info'); sfx('ui-error'); return; }
  player.favor-=PRAYERS.anviltoll.favor;
  sfx('forge-craft'); setClip(player,'melee'); ringFx(player.x,player.y,GODS.anvil.color,2.5); if(typeof SHAKE!=='undefined') SHAKE=8;
  var foes=ents.filter(function(e){ return e.foe && e.hp>0 && dist(e,player)<=2; }), struck=0;
  foes.forEach(function(e){
    attack(player, e, 1, "Anvil's Toll"); struck++;
    if(e.hp>0){ knockback(e, e.x-player.x, e.y-player.y, 2); applyStatus(e,'stun',1); }
  });
  log("<b>Anvil's Toll.</b> The hammer comes down"+(struck ? ' on '+struck+(struck===1?' foe.':' foes.') : ', and nothing is near enough to feel it.'),'c-good');
  player.hidden=0; endTurn(); updateUI();
};
var _canPrayRecovery=canPray;
canPray=function(pid){
  if(pid==='corpsefeast')pid='bonespear';
  if(pid==='offering')pid='fieldsmelt';
  if((pid==='fieldsmelt'||pid==='reforge') && recoveryInCombat())return false;
  if(pid==='reforge' && (!player.weapon || player.weapon.unarmed || (player.weapon.plus||0)>=3))return false;
  return _canPrayRecovery(pid);
};
var BONE_SPEAR={name:'Bone Spear',kind:'bolt',type:'dark',el:'shadow',range:6,base:[10,16],divine:true,cost:0};
var _usePrayerRecovery=usePrayer;
usePrayer=function(pid){
  if(pid==='corpsefeast')pid='bonespear';
  if(pid==='offering')pid='fieldsmelt';
  if(pid==='fieldsmelt'){
    if(!canPray(pid)){log('Field Smelt requires rank 2 and safety from combat.','c-info');return;}
    var choices=player.bag.map(function(b,i){return {b:b,i:i,v:recycleValue(b)};}).filter(function(o){return o.v>0;});
    if(!choices.length){log('No recyclable items in your bag.','c-info');return;}
    openModal('Field Smelt','Choose one carried item to destroy for its full recycling value.',choices.map(function(o){return {label:o.b.name+' → '+o.v+' essence',fn:function(){
      if(!canPray('fieldsmelt') || player.bag[o.i]!==o.b)return;
      player.bag.splice(o.i,1);player.essence+=recycleValue(o.b);closeModal();updateUI();
    }};}));return;
  }
  if(pid==='bonespear'){
    if(!canPray(pid)){log('Bone Spear requires rank 4 and 5 Favor.','c-info');return;}
    aiming={A:BONE_SPEAR,prayer:'bonespear'};if(openSheet)showSheet(openSheet);
    log('Bone Spear: choose a target within 6 tiles.','c-info');draw();return;
  }
  return _usePrayerRecovery(pid);
};
function spearPath(ax,ay,bx,by){
  var pts=[],x=ax,y=ay,dx=Math.abs(bx-ax),dy=Math.abs(by-ay),sx=ax<bx?1:-1,sy=ay<by?1:-1,err=dx-dy;
  if(ax===bx&&ay===by)return pts;
  while(pts.length<6){var e2=2*err;if(e2>-dy){err-=dy;x+=sx;}if(e2<dx){err+=dx;y+=sy;}if(!inb(x,y)||opaque(x,y))break;pts.push({x:x,y:y});}
  return pts;
}
var _castAtRecovery=castAt;
castAt=function(x,y){
  if(!aiming || aiming.prayer!=='bonespear')return _castAtRecovery(x,y);
  if(!canPray('bonespear') || !inb(x,y) || dist(player,{x:x,y:y})>6 || !(revealAll||vis[idxOf(x,y)]))return false;
  var path=spearPath(player.x,player.y,x,y);if(!path.length)return false;
  player.favor-=5;aiming=null;setClip(player,'cast');sfx('shadow-cast');
  var end=path[path.length-1];boltFx(player.x,player.y,end.x,end.y,'dark');
  path.forEach(function(p){ents.slice().forEach(function(e){if(e.foe&&e.x===p.x&&e.y===p.y && combatRoll(hitChance(player.acc+10,evaOf(e)),true)){spellHit(e,BONE_SPEAR,Math.round(sDMG(roll(10,16))*spellPower(BONE_SPEAR)*divineStrength()),'dark');finishHit(e);}});});
  endTurn();return true;
};

// Save the pending resurrection with the floor, using the existing graph-aware save system.
var _killRecovery=kill;
kill=function(e,by){
  // The sole player receives hostile-death credit, including environmental and status deaths.
  if(e && e.foe && !(by && by.ally))by=player;
  var rises=e&&e.ally&&e.undeadServant&&!e.revived&&capstone('murk')&&ents.indexOf(e)>=0;
  if(rises)e.revived=true; // Prevent the superseded immediate, full-health capstone from firing.
  _killRecovery(e,by);
  if(rises)floorMeta.pendingLich={entity:e,at:turn+1};
};
var _endTurnRecovery=endTurn;
endTurn=function(){
  _endTurnRecovery();
  // Damage during enemy actions already used this turn's refresh exemption.
  if(player._buffPrev)player._buffPrev.hardened=player.buffs.hardened||0;
  var pending=floorMeta.pendingLich;
  if(pending&&turn>=pending.at){
    var e=pending.entity,c=!occupied(e.x,e.y)?{x:e.x,y:e.y}:nearFree(e.x,e.y,2);
    if(c){e.x=c.x;e.y=c.y;e.hp=Math.max(1,Math.round(e.maxhp*0.5));e.st={};e.t=player.t;e.life=undefined;ents.push(e);delete floorMeta.pendingLich;log('Your Lich rises again at half health.','c-good');}
  }
};
var _raiseRecovery=prayRaiseDead;
prayRaiseDead=function(){if(floorMeta.pendingLich){log('Your Lich is returning.','c-info');return;}return _raiseRecovery();};

var _targetsRecovery=enchantTargets;
enchantTargets=function(){
  var list=_targetsRecovery();if(!livingMountain(player))return list;
  list.push({slot:'fists',label:'Living Mountain · fists',it:{name:'Fists',enchant:player.gromFistEnchant},text:ENCHANT_TEXT.weapon});
  list.push({slot:'body',label:'Living Mountain · body',it:{name:'Body',enchant:player.gromBodyEnchant},text:ENCHANT_TEXT.armor});return list;
};
var _enchantRecovery=enchantItem;
enchantItem=function(slot,el){
  if(slot!=='fists'&&slot!=='body'){
    var before=Object.assign({},player.motes),r=_enchantRecovery(slot,el);
    if(slot==='ranged'||(slot==='off'&&offHandIsWeapon()))secondHeat(before);
    return r;
  }
  if(!livingMountain(player)||ELEMENTS.indexOf(el)<0||!(player.motes[el]>0))return;
  var field=slot==='fists'?'gromFistEnchant':'gromBodyEnchant';if(player[field]===el)return;
  player.motes[el]--;player[field]=el;derive(player);updateUI();renderForge();
};
