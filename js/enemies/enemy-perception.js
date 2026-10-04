/* Pursuit follows evidence: a sighting, a sound, or a witnessed attack.
 * lastSeen is always a copied location, never a reference to a moving actor. */
var FoteEnemyPerception=(function(){
 'use strict';
 var MEMORY=1200,SEARCH=600;
 function hostile(e){return !!(e&&e.foe&&!e.ally&&e.hp>0&&!e.parent&&!(e.base||{}).object);}
 function libraryDormant(e){
  if(!e||!e.libraryRoom)return false;
  var room=(floorMeta.puzzles||[]).find(function(r){return r.puzzle.kind==='library'&&r.puzzle.door.x===e.libraryRoom.x&&r.puzzle.door.y===e.libraryRoom.y;});
  if(!room||room.puzzle.entered)return false;
  if(roomAt(player.x,player.y)===room){room.puzzle.entered=true;return false;}
  e.state='asleep';e.lastSeen=null;e.teamSearchUntil=0;
  return true;
 }
 function line(a,b){return FoteEnemyTeamwork.openLine(a,b);}
 function sees(e,target){
  if(libraryDormant(e)||!target||target.hp<=0||e.st&&e.st.blind)return false;
  if(target===player)return canSeePlayer(e);
  return dist(e,target)<=7&&line(e,target)&&!actorConcealed(target);
 }
 function remember(e,point,reason,clock){
  if(!hostile(e)||libraryDormant(e)||!point||!Number.isFinite(point.x)||!Number.isFinite(point.y))return false;
  var fresh=e.state!=='hunt';
  var previous=e.lastSeen||e,dx=point.x-previous.x,dy=point.y-previous.y;
  if(dx||dy)e.searchDirection={x:Math.sign(dx),y:Math.sign(dy)};
  e.state='hunt';e.lastSeen={x:point.x,y:point.y};
  e.teamSearchUntil=(clock===undefined?worldNow():clock)+MEMORY;
  delete e.searchUntil;delete e.searchGoal;delete e.searchVisited;e.noticeReason=reason||'sight';
  if(fresh)e.caughtOff=turn;
  return true;
 }
 function forget(e){
  e.state='wander';e.lastSeen=null;e.goal=null;e.teamSearchUntil=0;
  e.teamCalled=false;e.teamAlertWait=false;e.chaosAlerted=false;e.chaosAlertWait=false;
  delete e.searchUntil;delete e.searchGoal;delete e.searchVisited;delete e.searchDirection;delete e.noticeWait;delete e.petAggressor;
 }
 function pursuing(e){
  var now=worldNow();
  return e.state==='hunt'&&!!e.lastSeen&&(!e.teamSearchUntil||now<e.teamSearchUntil)&&
   (e.searchUntil===undefined||now<e.searchUntil);
 }
 function notice(e){
  if(!sees(e,player))return false;
  if(e.state!=='hunt'){
   if(!e.challenged&&rng()>=noticeChance(e,true,dist(e,player),e.state==='asleep'))return false;
   if(player.x!==e.x)e.facingLeft=player.x<e.x;
   log(e.name+' notices you.','c-info');if(e.base.sfx)sfx(e.base.sfx+'-alert',{from:e});
  }
  remember(e,player,'sight');return true;
 }
 function searchStep(e){
  var anchor=e.lastSeen,visited=e.searchVisited||(e.searchVisited=[]),i=idxOf(e.x,e.y);
  if(visited.indexOf(i)<0)visited.push(i);
  if(!e.searchGoal||dist(e,e.searchGoal)===0){
   var queue=[{x:e.x,y:e.y,n:0}],checked=new Set([i]),best=null,score=-Infinity,direction=e.searchDirection||{x:0,y:0};
   for(var head=0;head<queue.length;head++){
    var p=queue[head],pi=idxOf(p.x,p.y);
    if(p.n>0&&visited.indexOf(pi)<0){
     // Prefer a new vantage beyond the corner and along the last observed
     // direction. This score never reads the hidden player's coordinates.
     var value=(!line(anchor,p)?12:0)+2*((p.x-anchor.x)*direction.x+(p.y-anchor.y)*direction.y)-p.n;
     if(value>score){score=value;best={x:p.x,y:p.y};}
    }
    if(p.n>=4)continue;
    FoteActors.neighbors.forEach(function(d){
     var x=p.x+d[0],y=p.y+d[1],ni=idxOf(x,y);
     if(!inb(x,y)||checked.has(ni)||dist(anchor,{x:x,y:y})>4||
       !actorFootprintAllowed(e,x,y,{terrainOnly:true,doors:true,avoidFire:true}))return;
     if(d[0]&&d[1]&&!walkable(x,p.y)&&!walkable(p.x,y))return;
     checked.add(ni);queue.push({x:x,y:y,n:p.n+1});
    });
   }
   e.searchGoal=best;
  }
  if(!e.searchGoal||!canActorMove(e))return;
  if(e.base.phases&&cryptCreatureBehavior(e))return;
  var goal=e.searchGoal;
  if(!stepToward(e,goal.x,goal.y)){visited.push(idxOf(goal.x,goal.y));e.searchGoal=null;}
 }
 function investigate(e){
  var now=worldNow();
  if(!e.lastSeen){forget(e);return true;}
  // Old saves and scripted spawns may have a location but no deadline yet.
  if(!e.teamSearchUntil)e.teamSearchUntil=now+MEMORY;
  if(!pursuing(e)){forget(e);return true;}
  if(e.searchUntil!==undefined){searchStep(e);return true;}
  var p=e.lastSeen;
  if(dist(e,p)===0||dist(e,p)<=1&&(!walkable(p.x,p.y)||occupied(p.x,p.y,e))){
   e.searchUntil=now+SEARCH;searchStep(e);
   return true;
  }
  if(canActorMove(e)){
   if(e.base.phases&&cryptCreatureBehavior(e))return true;
   stepToward(e,p.x,p.y);
  }
  return true;
 }
 function petTarget(e){
  var pets=ents.filter(function(o){return o.ally&&o.hp>0&&sees(e,o);});
  pets.sort(function(a,b){return (a.id===e.petAggressor?-1:0)-(b.id===e.petAggressor?-1:0)||dist(e,a)-dist(e,b);});
  return pets[0]||null;
 }
 function committed(e){
  // A committed attack keeps its marked tiles, even if the target moves away.
  return !!(e.windup||e.pebbleSlam||e.zap||e.erupt||e.channel||e.grasp||
   e.kind==='matron'&&floorMeta.matron&&floorMeta.matron.rit||
   e.base.encounterId==='unmaker'&&floorMeta.unmakerEncounter&&floorMeta.unmakerEncounter.warning);
 }
 function takeTurn(e){
  if(!hostile(e))return false;
  if(libraryDormant(e))return true;
  // Legacy alert flags no longer spend an action. Perception selects a target;
  // the ordinary behavior pipeline owns the one move, attack, or support act.
  delete e.noticeWait;delete e.teamAlertWait;delete e.chaosAlertWait;
  if(e.state!=='hunt'){
   // Bosses remain in their arenas after losing the trail. Their opening
   // throne/ambush staging still belongs to the encounter script.
   if(e.base.boss&&e.state==='wander'){
    if(sees(e,player))remember(e,player,'sight');else return true;
   }else if(!e.base.boss&&(e.state==='asleep'||e.state==='wander')){
    if(!notice(e))return e.state==='asleep';
   }else return false;
  }
  if(sees(e,player))remember(e,player,'sight');
  else {
   var pet=petTarget(e);
   if(pet){e.petAggressor=pet.id;remember(e,pet,'sight');}
   else {
    if(committed(e))return false;
    return investigate(e);
   }
  }
  return false;
 }
 // Sound travels along passages; closed doors damp it, solid walls block it.
 // Build one small field per sound, rather than testing a live player position
 // independently on every creature action.
 function soundField(point,radius){
  var costs=new Map(),queue=[{x:point.x,y:point.y,cost:0}];costs.set(idxOf(point.x,point.y),0);
  for(var n=0;n<queue.length;n++){
   var p=queue[n];
   FoteActors.neighbors.forEach(function(d){
    var x=p.x+d[0],y=p.y+d[1];if(!inb(x,y))return;
    var tile=at(x,y);if(opaque(x,y)&&tile!==DOOR)return;
    if(d[0]&&d[1]&&opaque(x,p.y)&&opaque(p.x,y))return;
    var cost=p.cost+(tile===DOOR?3:d[0]&&d[1]?1.4:1),i=idxOf(x,y);
    if(cost>radius||costs.has(i)&&costs.get(i)<=cost)return;
    costs.set(i,cost);queue.push({x:x,y:y,cost:cost});
   });
  }
  return costs;
 }
 function hear(point,radius,loud,clock){
  var field=soundField(point,radius);
  ents.forEach(function(e){
   if(!hostile(e)||libraryDormant(e)||e.state==='throne'||!field.has(idxOf(e.x,e.y)))return;
   // Sight is more precise than a sound elsewhere in the room.
   if(e.state==='hunt'&&sees(e,player))return;
   var fresh=e.state!=='hunt';
   if(fresh&&rng()>=noticeChance(e,loud,dist(e,point),true))return;
   remember(e,point,'sound',clock);
  });
 }
 function playerAction(context){
  var loud=!!(context.noisy||player.lastAttack||player.castingSpell);
  if(!loud&&!context.moved)return;
  hear({x:player.x,y:player.y},loud?6:isScoundrel()?1:3,loud,context.from);
  // The buried Maw hears footfalls in its arena, but cannot track a silent,
  // stationary player or floating footsteps through the earth.
  var maw=floorMeta.maw;
  if(maw&&maw.ent&&maw.phase!=='dead'&&maw.phase!=='up'&&mawInArena(maw,player)&&
    (loud||context.moved&&!(player.levitate>0)))remember(maw.ent,player,'tremor',context.from);
 }
 function observeMove(x,y){
  // A hunter can see which way a visible player steps around a corner. Record
  // that single step before sight is broken, never later unseen movement.
  var destination={x:x,y:y};if(dist(player,destination)!==1)return;
  ents.forEach(function(e){if(hostile(e)&&e.state==='hunt'&&sees(e,player))remember(e,destination,'movement');});
 }
 function attacked(target,source,tags){
  if(!target||!target.foe||target.ally||tags&&(tags.has('periodic')||tags.has('environment')))return;
  source=source==='player'?player:source;
  if(!source||source!==player&&!source.ally)return;
  // Seeing the victim is enough to investigate the attack site, but does not
  // reveal an unseen attacker. Witnesses do not relay this alert to others.
  ents.forEach(function(e){
   if(!hostile(e)||e===target||e.st&&e.st.blind||dist(e,target)>7||!line(e,target))return;
   remember(e,sees(e,source)?source:target,'witness');
   if(source.ally&&sees(e,source))e.petAggressor=source.id;
  });
 }
 function damaged(event){
  var e=event.target,source=event.source==='player'?player:event.source;
  if(event.damage>0&&hostile(e)&&!libraryDormant(e)){
   e.state='hunt';e.caughtOff=-1;
   if(!event.tags.has('periodic')&&!event.tags.has('environment')){
    remember(e,sees(e,source)?source:e,'attacked');
    if(source&&source.ally&&sees(e,source))e.petAggressor=source.id;
   }else if(!e.lastSeen)remember(e,e,'hurt');
  }
  attacked(e,source,event.tags);
 }
 return Object.freeze({libraryDormant:libraryDormant,remember:remember,forget:forget,notice:notice,investigate:investigate,takeTurn:takeTurn,sees:sees,petTarget:petTarget,hear:hear,observeMove:observeMove,playerAction:playerAction,attacked:attacked,damaged:damaged});
})();
