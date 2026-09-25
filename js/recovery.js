/* Owner-settled recovery rules. These extend the original game; no candidate engine is mounted. */
function recoveryInCombat(){return ents.some(function(e){return e.foe && e.hp>0 && vis[idxOf(e.x,e.y)] && e.state==='hunt';});}

   /* 2026-09-23 (Justin): Anvil's Toll replaces Reforge at rank 4 */

var LANCE={name:'Lance',kind:'bolt',type:'phys',range:5,divine:true,cost:0};


// Old hotbar entries retain usable links after the approved prayer replacements.


if(ABILITIES.arcaneward){}   /* 2026-09-22 audit: the card said 8 Favor, the code took 8 mana */


function stackLivingMountain(){
  if(player.hp<=0 || !livingMountain(player))return;
  // One shared status holds all stacks. Every future global pulse spends one
  // turn; the triggering attack does not add a separate fresh-status grace turn.
  gameEffects.apply(player,'livingmountain',Math.max(1,Math.round(6*divineStrength())),undefined,
    {data:{n:Math.min(10,livingMountainStacks(player)+1)},durationModifiers:false,refresh:'replace',bornAt:worldNow()-100});
  derive(player);
}

if(typeof STATUS_INFO!=='undefined')STATUS_INFO.livingmountain={name:'Living Mountain',icon:'ic-iron-body',d:'Each stack grants +2 percentage points of all-damage resistance and critical-hit chance, +2% Accuracy and Evasion, and +2 flat attack damage before Might scaling. Up to 10 stacks; each unarmed attack refreshes all stacks for 6 × Divine Power global turns.'};

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
    var struck=0,hit=new Set();lpath.forEach(function(p){ents.slice().forEach(function(e){if(e.foe&&e.hp>0&&!hit.has(e)&&entityOccupies(e,p.x,p.y)){hit.add(e);attack(player,e,divineStrength(),'Lance');struck++;}});});
    log('<b>Lance.</b> '+(struck?'Your weapon runs through '+struck+(struck===1?' foe.':' foes.'):'Nothing stood in the line.'),'c-good');
    player.hidden=0;endTurn();return true;
  }
function castBoneSpear(x,y){  if(!canPray('bonespear') || !inb(x,y) || dist(player,{x:x,y:y})>6 || !(revealAll||vis[idxOf(x,y)]))return false;
  var path=spearPath(player.x,player.y,x,y);if(!path.length)return false;
  spendDivineSpell(5);aiming=null;setClip(player,'cast');sfx('shadow-cast');
  var end=path[path.length-1];boltFx(player.x,player.y,end.x,end.y,'dark');
  var hit=new Set();path.forEach(function(p){ents.slice().forEach(function(e){if(!e.foe||e.hp<=0||hit.has(e)||!entityOccupies(e,p.x,p.y))return;hit.add(e);if(combatRoll(hitChance(player.acc+10,evaOf(e)),true)){spellHit(e,BONE_SPEAR,Math.round(roll(5*godRank(),5*godRank()+6)*divineStrength()),'dark');finishHit(e);}});});
  endTurn();return true;
}
