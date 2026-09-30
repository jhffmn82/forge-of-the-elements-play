/* Skeletons close a short, clear gap with one normal weapon attack. */
var FoteSkeletonCharge=(function(){
 'use strict';
 function act(e,target){
  if(e.kind!=='skeleton'||e.castSpell||!target||target.hp<=0||!canActorMove(e)||e.skeletonChargeReadyAt>worldNow())return false;
  var d=dist(e,target);if(d<2||d>3)return false;
  if(e.foe?!FoteEnemyPerception.sees(e,target):!actorVisible(target)||!FoteEnemyTeamwork.openLine(e,target))return false;
  var point=entityPoint(target,e),path=boltPath(e.x,e.y,point.x,point.y),end=path[path.length-1];
  if(!end||!entityOccupies(target,end.x,end.y))return false;
  var run=path.slice(0,-1),previous={x:e.x,y:e.y};if(!run.length)return false;
  for(var i=0;i<run.length;i++){
   var tile=run[i],dx=tile.x-previous.x,dy=tile.y-previous.y;
   if(!actorFootprintAllowed(e,tile.x,tile.y,{avoidFire:true})||dx&&dy&&!walkable(tile.x,previous.y)&&!walkable(previous.x,tile.y))return false;
   previous=tile;
  }
  e.skeletonChargeReadyAt=worldNow()+400;
  if(actorVisible(e)||e.ally)log((e.ally?'Your ':'The <b>')+e.name+(e.ally?'':'</b>')+' charges!','c-info');
  for(var j=0;j<run.length&&e.hp>0&&canActorMove(e);j++){
   var p=run[j];if(!stepEnt(e,p.x-e.x,p.y-e.y))break;
   if(typeof FoteEnemyFields!=='undefined')FoteEnemyFields.enter(e);
   if(typeof FoteSporecaller!=='undefined')FoteSporecaller.trample(e);
  }
  if(e.hp>0&&target.hp>0&&dist(e,target)<=1&&!FoteActors.blocked(e,gameEffects))attack(e,target,1,'Bone Rush');
  return true;
 }
 return Object.freeze({act:act});
})();
MONSTERS.skeleton.hint='Bone Rush: charges from up to 3 tiles away along a clear path, then makes a normal attack. Recovers for 4 turns.';
