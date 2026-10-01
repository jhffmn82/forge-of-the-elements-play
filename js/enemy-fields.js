/* Persistent enemy ground effects use the world clock and shared status rules. */
var FoteEnemyFields=(function(){
 'use strict';
 function table(key){return floorMeta[key]||(floorMeta[key]={});}
 function active(key,x,y,clock){var f=(floorMeta[key]||{})[idxOf(x,y)];return f&&f.expiresAt>(clock===undefined?worldNow():clock)?f:null;}
 function spread(x,y,source,place){
  var origin={x:x,y:y},region=source&&source.chaosRegionId;
  for(var yy=y-1;yy<=y+1;yy++)for(var xx=x-1;xx<=x+1;xx++){
   if(!inb(xx,yy)||!walkable(xx,yy)||at(xx,yy)===CHASM||at(xx,yy)===WATER||deepLava(xx,yy)||!FoteEnemyTeamwork.openLine(origin,{x:xx,y:yy}))continue;
   var i=idxOf(xx,yy);
   if(region&&floorMeta.chaosPreview&&floorMeta.chaosPreview.regionByCell[i]!==region)continue;
   place(xx,yy,i);
  }
 }
 function web(x,y,source){var tiles=table('webGround'),now=worldNow();spread(x,y,source,function(xx,yy,i){tiles[i]={bornAt:now,expiresAt:now+1000,known:!!vis[i]};});}
 function enter(e){
  if(!e||e.hp<=0||!active('webGround',e.x,e.y)||gameEffects.airborne(e))return false;
  // Silk already clinging to a creature cannot stack into permanent pinning.
  if(gameEffects.hasTag(e,'root')||gameEffects.hasTag(e,'slow'))return false;
  var result=gameEffects.apply(e,'web',1,undefined,{sourceAffinity:{},durationModifiers:false});
  if(!result.applied)return false;
  e.syllaWeb=3;floatText(e.x,e.y,'webbed','phys');
  if(e===player)log('Webbed: Root, then Slow.','c-you');
  else if(vis[idxOf(e.x,e.y)])log('The webbing catches the <b>'+e.name+'</b>.','c-info');
  return true;
 }
 function restore(){
  // Earlier local review saves used a separate flame field. Migrate it into
  // the existing fire grid once; all fire then uses normal rendering, dousing,
  // spreading, damage, and floor-save ownership.
  var old=floorMeta.magmaFlames;if(!old)return;
  Object.keys(old).forEach(function(i){var left=Math.max(0,Math.min(3,Math.ceil((old[i].expiresAt-worldNow())/100)));fireT[i]=Math.max(fireT[i]||0,left);});
  delete floorMeta.magmaFlames;
 }
 function burn(x,y){if(floorMeta.webGround)delete floorMeta.webGround[idxOf(x,y)];}
 function wash(x,y){restore();burn(x,y);}
 function onDamaged(event){
  var e=event.target;
  if(e.kind!=='magmacrawler'||event.damage<=0||!event.source||event.tags.has('periodic')||event.tags.has('environment'))return;
  spread(e.x,e.y,e,function(x,y,i){if(!fireT[i])fireSrc[i]=0;fwaBurnGround(x,y);burn(x,y);});
  if(vis[idxOf(e.x,e.y)])log('<b>Magma Crawler:</b> nearby ground burns.','c-you');
 }
 function pulse(clock){
  restore();
  ['webGround'].forEach(function(key){var tiles=floorMeta[key]||{};Object.keys(tiles).forEach(function(i){
   if(tiles[i].expiresAt<=clock)delete tiles[i];else if(vis[i])tiles[i].known=true;
  });});
 }
 function draw(now){
  ['webGround'].forEach(function(key){var tiles=floorMeta[key]||{};Object.keys(tiles).forEach(function(k){
   var i=Number(k),f=tiles[k],x=i%MW,y=Math.floor(i/MW),remaining=f.expiresAt-worldNow();
   if(remaining<=0||x<camX-1||y<camY-1||x>camX+viewW+1||y>camY+viewH+1||!(vis[i]||f.known&&seen[i]))return;
   var px=(x-camX)*TS,py=(y-camY)*TS,alpha=(vis[i]?1:memA(.4))*Math.min(1,remaining/100);
   drawBaseGroundDecal(G_WEB,x,y,px,py,alpha,now);
  });});
 }
 return Object.freeze({web:web,enter:enter,restore:restore,burn:burn,wash:wash,onDamaged:onDamaged,pulse:pulse,draw:draw});
})();
