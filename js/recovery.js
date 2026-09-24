/* Owner-settled recovery rules. These extend the original game; no candidate engine is mounted. */
function recoveryInCombat(){return ents.some(function(e){return e.foe && e.hp>0 && vis[idxOf(e.x,e.y)] && e.state==='hunt';});}

   /* 2026-09-23 (Justin): Anvil's Toll replaces Reforge at rank 4 */

var LANCE={name:'Lance',kind:'bolt',type:'phys',range:5,divine:true,cost:0};


// Old hotbar entries retain usable links after the approved prayer replacements.


if(ABILITIES.arcaneward){}   /* 2026-09-22 audit: the card said 8 Favor, the code took 8 mana */


function refreshHardened(){
  if(player.hp<=0 || !livingMountain(player))return;
  player.buffs.hardened=3;
  player._buffPrev=player._buffPrev||{};player._buffPrev.hardened=0;
  derive(player);
}

if(typeof STATUS_INFO!=='undefined')STATUS_INFO.hardened={name:'Hardened',icon:'st-stone',d:'Divine-Power-scaled armor and elemental resistance. Taking damage refreshes the duration without stacking.'};

/* Anvil's Toll: a weapon attack on everything within two tiles, each thrown back and stunned (2026-09-23) */

var ARCANE_NOVA={name:'Arcane Nova',kind:'aoe',range:6,radius:1,divine:true,cost:0};
var BONE_SPEAR={name:'Bone Spear',kind:'bolt',type:'dark',el:'shadow',range:6,base:[10,16],divine:true,cost:0};


function spearPath(ax,ay,bx,by){
  var pts=[],x=ax,y=ay,dx=Math.abs(bx-ax),dy=Math.abs(by-ay),sx=ax<bx?1:-1,sy=ay<by?1:-1,err=dx-dy;
  if(ax===bx&&ay===by)return pts;
  while(pts.length<6){var e2=2*err;if(e2>-dy){err-=dy;x+=sx;}if(e2<dx){err+=dx;y+=sy;}if(!inb(x,y)||opaque(x,y))break;pts.push({x:x,y:y});}
  return pts;
}


// Save the pending resurrection with the floor, using the existing graph-aware save system.


function turnLichReturn(context){
  // Damage during enemy actions already used this turn's refresh exemption.
  if(player._buffPrev)player._buffPrev.hardened=player.buffs.hardened||0;
  var pending=floorMeta.pendingLich;
  if(pending&&turn>=pending.at){
    var e=pending.entity,c=!occupied(e.x,e.y)?{x:e.x,y:e.y}:nearFree(e.x,e.y,2);
    if(c){e.x=c.x;e.y=c.y;e.hp=Math.max(1,Math.round(e.maxhp*0.5));e.st={};e.t=player.t;e.life=undefined;ents.push(e);delete floorMeta.pendingLich;log('Your Lich rises again at half health.','c-good');}
  }

}


function castReginaldLance(x,y){
    /* Reginald's Lance (2026-09-23): a weapon attack on every enemy along a straight line to any tile within 5 */
    if(!canPray('lance') || !inb(x,y) || dist(player,{x:x,y:y})>5 || !(revealAll||vis[idxOf(x,y)]) || (x===player.x && y===player.y))return false;
    var lpath=spearPath(player.x,player.y,x,y).slice(0,5);if(!lpath.length)return false;
    player.favor-=PRAYERS.lance.favor;aiming=null;setClip(player,'melee');sfx('swing');
    var lend=lpath[lpath.length-1];boltFx(player.x,player.y,lend.x,lend.y,'phys');
    var struck=0;lpath.forEach(function(p){ents.slice().forEach(function(e){if(e.foe&&e.hp>0&&e.x===p.x&&e.y===p.y){attack(player,e,divineStrength(),'Lance');struck++;}});});
    log('<b>Lance.</b> '+(struck?'Your weapon runs through '+struck+(struck===1?' foe.':' foes.'):'Nothing stood in the line.'),'c-good');
    player.hidden=0;endTurn();return true;
  }
function castBoneSpear(x,y){  if(!canPray('bonespear') || !inb(x,y) || dist(player,{x:x,y:y})>6 || !(revealAll||vis[idxOf(x,y)]))return false;
  var path=spearPath(player.x,player.y,x,y);if(!path.length)return false;
  spendDivineSpell(5);aiming=null;setClip(player,'cast');sfx('shadow-cast');
  var end=path[path.length-1];boltFx(player.x,player.y,end.x,end.y,'dark');
  path.forEach(function(p){ents.slice().forEach(function(e){if(e.foe&&e.x===p.x&&e.y===p.y && combatRoll(hitChance(player.acc+10,evaOf(e)),true)){spellHit(e,BONE_SPEAR,Math.round(roll(5*godRank(),5*godRank()+6)*divineStrength()),'dark');finishHit(e);}});});
  endTurn();return true;
}
