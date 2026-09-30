/* Buried Crypt ambushers are floor records, not targetable or blocking actors. */
var FoteGhoul=(function(){
 'use strict';
 MONSTERS.ghoul={name:'Buried Ghoul',sprite:'m-ghoul',col:'#92998b',ch:'g',hp:32,dmg:[4,7],acc:60,eva:12,armor:0,speed:100,range:1,xp:26,
  band:[6,9],biome:[1],w:10,undead:true,ghoul:true,art:.95,artLeft:true,sfx:'zombie',
  hint:'Lies buried and unseen until you pass. Emerges behind you, spending its first action climbing out before it can attack.'};
 MONSTERS.shambler.w=Math.max(0,MONSTERS.shambler.w-6);MONSTERS.gravebeetle.w=Math.max(0,MONSTERS.gravebeetle.w-4);
 DROPS.ghoul={chance:.12,table:{essence:10,food:2}};
 CLIP_MS.emerge=140;if(typeof BASE_CLIP_MS!=='undefined')BASE_CLIP_MS.emerge=140;
 function bury(e){e.ghoulBuried=true;(floorMeta.buriedGhouls||(floorMeta.buriedGhouls=[])).push(e);return e;}
 function emerge(context){
  var step=player.ghoulStep,buried=floorMeta.buriedGhouls||[];
  if(!context.moved||player.hp<=0||!step||player.x!==step.x+step.dx||player.y!==step.y+step.dy)return false;
  var candidates=buried.filter(function(e){
   return e.hp>0&&dist(e,step)<=2&&dist(e,player)<=3&&(e.x-player.x)*step.dx+(e.y-player.y)*step.dy<=0&&FoteEnemyTeamwork.openLine(e,player);
  }).sort(function(a,b){return dist(a,player)-dist(b,player);});
  if(!candidates.length)return false;
  var ideal={x:player.x-step.dx,y:player.y-step.dy};
  var cells=FoteActors.neighbors.filter(function(d){return d[0]*step.dx+d[1]*step.dy<0;}).map(function(d){return {x:player.x+d[0],y:player.y+d[1]};}).filter(function(c){
   return inb(c.x,c.y)&&walkable(c.x,c.y)&&at(c.x,c.y)!==CHASM&&!deepLava(c.x,c.y)&&!occupied(c.x,c.y)&&FoteEnemyTeamwork.openLine(player,c);
  }).sort(function(a,b){return dist(a,ideal)-dist(b,ideal);});
  if(!cells.length)return false;
  var e=candidates[0],cell=cells[0];floorMeta.buriedGhouls=buried.filter(function(o){return o!==e;});
  e.x=cell.x;e.y=cell.y;e.ghoulBuried=false;e.state='hunt';e.lastSeen={x:player.x,y:player.y};e.t=player.t;
  e.facingLeft=player.x<e.x;e._lx=undefined;ents.push(e);betaEnemyBalance(e);setClip(e,'emerge');
  // Called AFTER the enemy schedule. Even a very slow player action cannot
  // give this newly surfaced ghoul an attack before the player's next input.
  if(typeof stopTravel==='function')stopTravel();
  log('A <b>Buried Ghoul</b> claws out of the ground behind you!','c-you');sfx('zombie-alert',{from:e});
  return true;
 }
 return Object.freeze({bury:bury,emerge:emerge});
})();
