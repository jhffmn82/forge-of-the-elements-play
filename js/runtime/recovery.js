/* Owner-settled recovery rules. These extend the original game; no candidate engine is mounted. */
function recoveryInCombat(){return ents.some(function(e){return e.foe && e.hp>0 && vis[idxOf(e.x,e.y)] && e.state==='hunt';});}

   /* 2026-09-23 (Justin): Anvil's Toll replaces Reforge at rank 4 */

var LANCE={name:'Lance',kind:'beam',type:'phys',range:FoteActions.reginaldLance().range,fixedRange:true,divine:true,cost:0};


// Old hotbar entries retain usable links after the approved prayer replacements.




function stackLivingMountain(){
  if(player.hp<=0 || !livingMountain(player))return;
  // One shared status holds all stacks. Every future global pulse spends one
  // turn; the triggering attack does not add a separate fresh-status grace turn.
  gameEffects.apply(player,'livingmountain',fullDivineDuration(6),undefined,
    {data:{n:Math.min(10,livingMountainStacks(player)+1)},durationModifiers:false,refresh:'replace',bornAt:worldNow()-100});
  derive(player);
}

if(typeof STATUS_INFO!=='undefined')STATUS_INFO.livingmountain={name:'Living Mountain',icon:'ic-iron-body',d:'+2% crit, +2% accuracy and +2 damage per stack (max 10). Unarmed attacks add and refresh stacks, even on misses.'};

/* Anvil's Toll: a weapon attack on everything within two tiles, each thrown back and stunned (2026-09-23) */

var BONE_SPEAR={name:'Bone Spear',kind:'bolt',piercing:true,type:'dark',el:'shadow',range:6,base:[10,16],divine:true,cost:0};


function spearPath(ax,ay,bx,by){
  var pts=[],x=ax,y=ay,dx=Math.abs(bx-ax),dy=Math.abs(by-ay),sx=ax<bx?1:-1,sy=ay<by?1:-1,err=dx-dy;
  if(ax===bx&&ay===by)return pts;
  while(pts.length<6){var e2=2*err;if(e2>-dy){err-=dy;x+=sx;}if(e2<dx){err+=dx;y+=sy;}if(!inb(x,y)||opaque(x,y))break;pts.push({x:x,y:y});}
  return pts;
}


// Save the pending resurrection with the floor, using the existing graph-aware save system.


function turnLichReturn(context){
  var pending=floorMeta.pendingLich;
  if(pending&&turn>=pending.at){
    var e=pending.entity,c=!occupied(e.x,e.y)?{x:e.x,y:e.y}:nearFree(e.x,e.y,2);
    if(c){e.x=c.x;e.y=c.y;e.hp=Math.max(1,Math.round(e.maxhp*0.5));e.st={};e.t=player.t;e.life=undefined;ents.push(e);delete floorMeta.pendingLich;log('Your Lich rises again at half health.','c-good');}
  }

}


function castReginaldLance(x,y){
    var rules=FoteActions.reginaldLance(),damageMultiplier=rules.multiplier*divineStrength();
    if(!canPray('lance') || !inb(x,y) || dist(player,{x:x,y:y})>rules.range || !(revealAll||vis[idxOf(x,y)]) || (x===player.x && y===player.y))return false;
    var tiles=FoteGeometry.beamTiles(player,{x:x,y:y},{range:rules.range,width:rules.width,inBounds:inb,opaque:opaque});if(!tiles.length)return false;
    if(!spendPrayer('lance'))return false;aiming=null;setClip(player,'melee');sfx('swing');
    beamFx(tiles,'phys',{col:'#E8D9A8'});
    var struck=0,hit=new Set();tiles.forEach(function(p){ents.slice().forEach(function(e){if(e.foe&&!e.ally&&e.hp>0&&!hit.has(e)&&entityOccupies(e,p[0],p[1])){hit.add(e);attack(player,e,damageMultiplier,'Lance',{weapon:player.weapon,tags:['area']});struck++;}});if(spellPropHit(p[0],p[1],'phys'))struck++;});
    if(!struck)log('Lance: no targets.','c-info');
    player.hidden=0;endTurn();return true;
  }
function castBoneSpear(x,y){  if(!canPray('bonespear') || !inb(x,y) || dist(player,{x:x,y:y})>6 || !(revealAll||vis[idxOf(x,y)]))return false;
  var path=spearPath(player.x,player.y,x,y);if(!path.length)return false;
  if(!spendPrayer('bonespear'))return false;player.castingSpell=true;aiming=null;setClip(player,'cast');sfx('shadow-cast');
  var end=path[path.length-1];boltFx(player.x,player.y,end.x,end.y,'blood');
  var hit=new Set();path.forEach(function(p){ents.slice().forEach(function(e){if(!e.foe||e.hp<=0||hit.has(e)||!entityOccupies(e,p.x,p.y))return;hit.add(e);if(combatRoll(hitChance(player.acc+10,evaOf(e)),true)){spellHit(e,BONE_SPEAR,Math.round(roll(5*godRank(),5*godRank()+6)*divineStrength()),'dark');finishHit(e);}});spellPropHit(p.x,p.y,'dark');});
  endTurn();return true;
}
