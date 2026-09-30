/* Dungeon slimes reproduce from full health; green slimes also leave a trail. */
var FoteGreenSlime=(function(){
 'use strict';
 MONSTERS.greenslime={name:'Green Slime',sprite:'m-green-slime',col:'#75a64e',ch:'s',hp:12,dmg:[1,2],acc:48,eva:0,armor:0,speed:70,range:1,xp:10,
  band:[1,4],biome:[0],w:12,living:true,sporeproof:true,greenSlime:true,art:.7,artLeft:true,sfx:'slime',
  hint:'Regenerates 2 HP per world turn. A damaging hit from full health divides its remaining HP between two full-sized slimes. Both can split again after healing to full. Its poison trail fades after 10 world turns.'};
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
  if(vis[idxOf(e.x,e.y)]){log('The <b>'+e.name+'</b> divides into two slimes! Both can reproduce again at full health.','c-info');sfx('slime-split',{from:e});}
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
   if(n>0){floatText(e.x,e.y,String(n),'poison');if(e===player)log('The slime trail stings: <b>'+n+'</b> poison damage.','c-you');}
   if(e.hp<=0)kill(e,null);
  });
 }
 function draw(now){
  if(!floorMeta.greenTrail)return;ctx.save();
  Object.keys(floorMeta.greenTrail).forEach(function(key){
   var i=Number(key),t=floorMeta.greenTrail[key],x=i%MW,y=Math.floor(i/MW);
   if(x<camX-1||y<camY-1||x>camX+viewW+1||y>camY+viewH+1||!(vis[i]||t.known&&seen[i]))return;
   var px=(x-camX)*TS,py=(y-camY)*TS,fade=Math.min(1,(t.expiresAt-worldNow())/200);
   ctx.globalAlpha=(vis[i]?.82:memA(.4))*fade;ctx.fillStyle='#4f7939';
   ctx.beginPath();ctx.ellipse(px+TS*.48,py+TS*.74,TS*.37,TS*.16,.16,0,Math.PI*2);ctx.fill();
   ctx.fillStyle='#91b562';ctx.globalAlpha*=.65;
   for(var n=0;n<4;n++){
    var h=hash2(x,y,n+551),p=Math.max(1,Math.round(TS/40));
    ctx.fillRect(Math.round(px+TS*(.23+h*.5)),Math.round(py+TS*(.66+hash2(x,y,n+631)*.12)),p*2,p);
   }
  });ctx.restore();
 }
 function wash(x,y){if(floorMeta.greenTrail)delete floorMeta.greenTrail[idxOf(x,y)];}
 return Object.freeze({onDamaged:onDamaged,moved:moved,pulse:pulse,draw:draw,wash:wash});
})();
