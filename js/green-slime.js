/* Dungeon slimes reproduce from full health; green slimes also leave a trail. */
var FoteGreenSlime=(function(){
 'use strict';
 MONSTERS.greenslime={name:'Green Slime',sprite:'m-green-slime',col:'#75a64e',ch:'s',hp:20,dmg:[1,2],acc:48,eva:0,armor:0,speed:70,range:1,xp:10,
  band:[1,4],biome:[0],w:12,living:true,sporeproof:true,greenSlime:true,art:.7,artLeft:true,sfx:'slime',
  hint:'Heals 2 HP per turn. Splits when hit at full health. Leaves a 10-turn poison trail.'};
 DROPS.greenslime={chance:.12,table:{essence:1}};
 if(MONSTERS.pebbleslime)MONSTERS.pebbleslime.w=0;
 function splittingSlime(e){return e.base&&(e.base.greenSlime||e.kind==='slime');}
 function onDamaged(event,hpBefore){
  var e=event.target;
  if(!splittingSlime(e)||event.damage<=0||e.hp<2||hpBefore<e.maxhp||!event.source||event.tags.has('periodic')||event.tags.has('environment'))return;
  var cell=nearFree(e.x,e.y,1);if(!cell)return;
  var hp=Math.floor(e.hp/2);e.hp-=hp;
  var child=spawnRaw(e.kind,cell.x,cell.y);
  child.hp=hp;child.maxhp=e.maxhp;child.noLoot=true;child.noXp=true;child.slimeDescendant=true;child.state='hunt';
  child.name=e.name;child.base=Object.assign({},e.base);child.dmg=(e.dmg||e.base.dmg).slice();child.beta11Balanced=e.beta11Balanced;
  child.greenPulseAt=worldNow();
  child.lastSeen=e.lastSeen?{x:e.lastSeen.x,y:e.lastSeen.y}:null;
  child.t=Math.max(e.t||0,worldNow())+actCost(child);
  if(vis[idxOf(e.x,e.y)]){log('<b>'+e.name+'</b> splits.','c-info');sfx('slime-split',{from:e});}
 }
 function moved(e,x,y){
  if(!e.base||!e.base.greenSlime||e.hp<=0||e.x===x&&e.y===y||!walkable(x,y))return;
  (floorMeta.greenTrail||(floorMeta.greenTrail={}))[idxOf(x,y)]={bornAt:worldNow(),expiresAt:worldNow()+1000,known:!!vis[idxOf(x,y)]};
 }
 function pulse(clock){
  ents.forEach(function(e){
   if(e.hp<=0||!splittingSlime(e)||e.state!=='hunt'||e.greenPulseAt===clock)return;
   e.greenPulseAt=clock;
   if(gameEffects.has(e,'poison')||gameEffects.has(e,'rot'))return;
   e.hp=Math.min(e.maxhp,e.hp+2);
  });
  if(!floorMeta.greenTrail)return;
  var trail=floorMeta.greenTrail;
  Object.keys(trail).forEach(function(i){if(clock>=trail[i].expiresAt)delete trail[i];else if(vis[i])trail[i].known=true;});
  [player].concat(ents.filter(function(e){return e!==player;})).forEach(function(e){
   var ground=trail[idxOf(e.x,e.y)];
   if(!ground||ground.bornAt>=clock||e.hp<=0||gameEffects.airborne(e)||e.base&&e.base.sporeproof||gameEffects.blocked(e,'poison'))return;
   var n=applyDamage(e,1,'poison',null,{tags:['periodic','environment']});
   if(n>0){floatText(e.x,e.y,String(n),'poison');if(e===player)log('Slime trail: '+n+' poison damage.','c-you');}
   if(e.hp<=0)kill(e,null);
  });
 }
 function draw(now){
  if(!floorMeta.greenTrail)return;
  var cells=Object.keys(floorMeta.greenTrail).map(Number).filter(function(i){return vis[i]||floorMeta.greenTrail[i].known&&seen[i];});
  drawGroundMaterial('poison',cells,function(i){
   // The connected pool's soft shore can extend into adjacent stone. Fade it
   // with its neighbouring trail cells rather than cutting it at tile edges.
   var left=0,x=i%MW,y=Math.floor(i/MW);
   for(var dy=-1;dy<=1;dy++)for(var dx=-1;dx<=1;dx++){
    if(!inb(x+dx,y+dy))continue;var t=floorMeta.greenTrail[idxOf(x+dx,y+dy)];
    if(t)left=Math.max(left,t.expiresAt-worldNow());
   }
   return Math.max(0,Math.min(1,left/200));
  },true);
 }
 function wash(x,y){if(floorMeta.greenTrail)delete floorMeta.greenTrail[idxOf(x,y)];}
 return Object.freeze({onDamaged:onDamaged,moved:moved,pulse:pulse,draw:draw,wash:wash});
})();
