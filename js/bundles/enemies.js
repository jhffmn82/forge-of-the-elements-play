;
/* js/enemies/enemy-teamwork.js */
/* Small local groups share a sighting, never the player's unseen position. */
var FoteEnemyTeamwork=(function(){
 'use strict';
 var goblins=['goblin','archer','brute','shaman'];
 function family(e){
  if(!e||!e.foe||e.ally||e.hp<=0||!e.base||e.base.boss||e.base.object)return null;
  if(goblins.indexOf(e.kind)>=0)return 'goblin';
  if(['acolyte','shambler','ghoul','skeleton','bonearcher','shade','gravebloat'].indexOf(e.kind)>=0)return 'crypt';
  if(['sporecaller','myconid','shroomling','stormbeetle','sparkjelly','shockeel','crystalcrawler','rootbound','caverat','cavebat','caveslime'].indexOf(e.kind)>=0)return 'cavern';
  if(['drowpriestess','drowblade','drider','webspitter','spiderling','thoughteater'].indexOf(e.kind)>=0)return 'underdark';
  return null;
 }
 function openLine(a,b){
  return FoteGeometry.traceLine(a,b,function(x,y){return !inb(x,y)||opaque(x,y);}).clear;
 }
 function nearby(e,radius){
  var group=family(e);if(!group)return [];
  return ents.filter(function(o){return o!==e&&family(o)===group&&dist(e,o)<=radius&&openLine(e,o);});
 }
 function alert(e){
  // The opening floor keeps its gentle individual encounters.
  if(floorNo<=1||!family(e)||e.state!=='hunt'||e.teamCalled||!e.lastSeen)return false;
  // Only support units call. Other group members can respond, never relay.
  if(e.kind!=='shaman'&&e.kind!=='acolyte'&&e.kind!=='sporecaller'&&e.kind!=='drowpriestess')return false;
  e.teamCalled=true;
  var allies=nearby(e,5).filter(function(o){return o.state==='asleep'||o.state==='wander';});
  allies.sort(function(a,b){return dist(e,a)-dist(e,b);});allies=allies.slice(0,2);
  allies.forEach(function(o){
   o.state='hunt';o.lastSeen={x:e.lastSeen.x,y:e.lastSeen.y};o.caughtOff=turn;o._lostFor=0;
   o.teamCalled=true;
   if(typeof FoteEnemyPerception!=='undefined')FoteEnemyPerception.remember(o,e.lastSeen,'call');
  });
  if(!allies.length)return false;
  if(vis[idxOf(e.x,e.y)]){log('<b>'+e.name+'</b> calls for help.','c-you');floatText(e.x,e.y,e.kind==='sporecaller'?'Spore call':'Help!','miss');}
  if(e.base.sfx)sfx(e.base.sfx+'-alert',{from:e});
  return true;
 }
 function takeTurn(e){
  if(!family(e))return false;
  if(e.state!=='hunt'){e.teamCalled=false;e.teamAlertWait=false;e.teamSearchUntil=0;return false;}
  // The actor perception behavior owns memory and pursuit for every family.
  return alert(e);
 }
 function rally(e,idle){
  if(e.kind!=='shaman'||!idle&&e.rageReadyAt>worldNow())return false;
  var allies=nearby(e,4).filter(function(o){return o.state==='hunt'&&(o.hp<o.maxhp||!gameEffects.has(o,'goblinrage'));});
  allies.sort(function(a,b){return a.hp/a.maxhp-b.hp/b.maxhp||dist(a,player)-dist(b,player);});
  var target=allies[0];if(!target)return false;
  var healed=Math.max(1,Math.round(target.maxhp*.50));
  if(gameEffects.has(target,'rot'))healed=Math.floor(healed*.5);
  healed=gameDamage.heal(target,healed,e).restored;
  if(!gameEffects.has(target,'goblinrage'))gameEffects.apply(target,'goblinrage',4,undefined,{durationModifiers:false});
  e.rageReadyAt=worldNow()+600;setClip(e,'attack');sfx('shaman-cast',{from:e});
  boltFx(e.x,e.y,target.x,target.y,'fire');sparkleFx(target.x,target.y,'heal',16);floatText(target.x,target.y,'Rage','fire');
  if(vis[idxOf(e.x,e.y)]||vis[idxOf(target.x,target.y)])log('<b>Goblin Shaman:</b> '+target.name+': Rage'+(healed?'; +'+healed+' HP':'')+'.','c-you');
  return true;
 }
 function boneWard(e,idle){
  if(!idle&&e.wardCd>0)return false;
  var allies=nearby(e,4).filter(function(o){return o.state==='hunt'&&o.base.undead&&!o.boneWard;});
  if(!allies.length)return false;
  allies.forEach(function(o){o.boneWard=true;sparkleFx(o.x,o.y,'dark',12);});
  e.wardCd=5;setClip(e,'attack');sfx('shaman-cast',{from:e});
  if(vis[idxOf(e.x,e.y)])log('Necro-Acolyte: Bone Ward.','c-info');
  return true;
 }
 function retreat(e,target){
  var threats=ents.filter(function(o){return o.ally&&o.hp>0&&dist(e,o)<3&&openLine(e,o);}).concat([target]);
  threats.sort(function(a,b){return dist(e,a)-dist(e,b);});
  return dist(e,threats[0])<3&&fleeStep(e,threats[0]);
 }
 function position(e,target,range,tactical){
  if(!canActorMove(e))return false;
  if(dist(e,target)>range)return stepToward(e,target.x,target.y);
  var allies=nearby(e,6).filter(function(o){return o.state==='hunt'&&o.kind!=='shaman'&&o.kind!=='acolyte'&&o.kind!=='sporecaller'&&o.kind!=='drowpriestess';});
  allies.sort(function(a,b){return dist(e,a)-dist(e,b);});
  var ally=allies[0];if(!tactical&&(!ally||dist(e,ally)<=3))return false;
  function score(x,y){
   var cell={x:x,y:y},d=dist(cell,target);
   if(!tactical)return dist(cell,ally);
   // Improve the next shot or take cover behind an escort. Once well placed,
   // hold ground instead of shuffling back and forth on every cooldown turn.
   return Math.abs(d-Math.min(4,range))*2+(clearShot(cell,target)?0:12)+
    (ally?Math.abs(dist(cell,ally)-2)+Math.max(0,dist(ally,target)+1-d)*3:0);
  }
  var best=FoteActors.bestStep(e,score,function(x,y,dx,dy){
   var d=dist({x:x,y:y},target);
   return d>=3&&d<=range&&actorCellAllowed(e,x,y,dx,dy,{avoidFire:true});
  });
  return best?stepEnt(e,best.dx,best.dy):false;
 }
 function shaman(e,target){
  e.castCd=(e.castCd||0)-1;
  if(retreat(e,target))return true;
  if(target.x!==e.x)e.facingLeft=target.x<e.x;   /* 2026-10-06 (Justin: 'the goblin shamans are facing away from the player'): it backed off facing the way it stepped, and cast with its back turned */
  if(dist(e,target)<=e.base.castRange&&e.castCd<=0&&clearShot(e,target)){
   e.castCd=e.base.castEvery;setClip(e,'attack');sfx('shaman-cast',{from:e});boltFx(e.x,e.y,target.x,target.y,'fire');
   var chance=hitChance(accOf(e)+10,evaOf(target));if(target===player)chance=hostileHitChance(chance,true);
   if(rng()<chance){
    var damage=applyDamage(target,roll(5,8)+floorNo,'fire',e);floatText(target.x,target.y,String(damage),'fire');
    var burn=target.hp>0&&rng()<.5;if(burn)applyStatus(target,'burn',3,sDMG(2));
    log(combatText(e.name)+' → '+(target===player?'you':combatText(target.name))+': '+combatDamageNumber(damage,'fire')+(burn?'; Burning':'')+'.','c-you');
    if(target.hp<=0)kill(target,e);
   }else{log(e.name+'\'s firebolt misses.','c-miss');floatText(target.x,target.y,'miss','miss');}
   return true;
  }
  if(rally(e))return true;
  if(position(e,target,e.base.castRange,true))return true;
  // A cooldown must not turn a useful healing/buff action into an idle turn.
  rally(e,true);return true;
 }
 function shoulderCheck(e,target){
  if(e.kind!=='brute'||e.ally||e.hp<=0||target.hp<=0||target!==player&&!target.ally||dist(e,target)>1||e.brutePushReadyAt>worldNow())return false;
  e.brutePushReadyAt=worldNow()+400;
  var dx=Math.sign(target.x-e.x),dy=Math.sign(target.y-e.y),cell={x:target.x+dx,y:target.y+dy};
  if(!inb(cell.x,cell.y)||at(cell.x,cell.y)===CHASM||!openLine(target,cell))return false;
  if(!knockback(target,dx,dy,1))return false;
  if(target===player)log('Goblin Brute: you pushed back.','c-you');
  else if(vis[idxOf(e.x,e.y)])log('Goblin Brute: '+target.name+' pushed back.','c-info');
  return true;
 }
 return Object.freeze({family:family,openLine:openLine,nearby:nearby,alert:alert,takeTurn:takeTurn,rally:rally,boneWard:boneWard,retreat:retreat,position:position,shaman:shaman,shoulderCheck:shoulderCheck});
})();

;
/* js/enemies/enemy-perception.js */
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

;
/* js/enemies/skeleton-charge.js */
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

;
/* js/enemies/sporecaller.js */
/* Caverns support caster. Warnings use both clocks: even a slow player action
 * cannot resolve a warning born during that same action. Fields use world time. */
var FoteSporecaller=(function(){
 'use strict';
 MONSTERS.sporecaller=Object.assign({},MONSTERS.myconid,{
  name:'Myconid Sporecaller',sprite:'m-sporecaller',spores:false,sporecaller:true,
  dmg:[3,5],xp:40,w:8,
  hint:'Marks a root-and-poison field that sprouts two Shroomlings. Retreats, heals allies and grants Sporecoat.'
 });
 DROPS.sporecaller=DROPS.myconid;
 // Sporecaller and Root-bound share the retired vermin's combined weight of 16.
 MONSTERS.caverat.w=0;MONSTERS.cavebat.w=0;
 var RANGE=5,FIELD_LIFE=300,FIELD_COOLDOWN=600,SUPPORT_COOLDOWN=500;
 var FIELD_ABILITY=Object.freeze({id:'spore-field',name:'Spore Field'});
 function fieldCause(source){
  var action=gameActions.current();
  if(!action||action.source!==source)action=null;
  return FoteActions.damageCause(action,{source:source,ability:FIELD_ABILITY,
   actionId:action?action.actionId:null,tags:['environment','spore-field']},null);
 }
 function fields(){return floorMeta.sporeFields||(floorMeta.sporeFields=[]);}
 function growth(){return floorMeta.sporeGrowth||(floorMeta.sporeGrowth={});}
 function visible(e,visibility){return inb(e.x,e.y)&&!!(visibility||vis)[idxOf(e.x,e.y)];}
 function targets(){return [player].concat(ents.filter(function(e){return e!==player&&e.ally&&e.hp>0;}));}
 function cellsAt(target){
  var cells=[];
  for(var y=target.y-1;y<=target.y+1;y++)for(var x=target.x-1;x<=target.x+1;x++){
   if(inb(x,y)&&walkable(x,y)&&at(x,y)!==CHASM&&FoteEnemyTeamwork.openLine(target,{x:x,y:y}))cells.push(idxOf(x,y));
  }
  return cells;
 }
 function warn(e,target){
  if(e.sporeFieldReadyAt>worldNow()||dist(e,target)>RANGE||!FoteEnemyTeamwork.openLine(e,target))return false;
  if(fields().filter(function(f){return !f.expiresAt||f.expiresAt>worldNow();}).length>=2)return false;
  // Put the target on the near edge, so one ordinary step can leave a 3x3 field.
  var center={x:target.x+Math.sign(e.x-target.x),y:target.y+Math.sign(e.y-target.y)};
  var cells=cellsAt(center);if(!cells.length||cells.indexOf(idxOf(target.x,target.y))<0)return false;
  fields().push({owner:e.id,applicationCause:fieldCause(e),x:center.x,y:center.y,cells:cells,armedTurn:turn,fireAt:worldNow()+100,rooted:[]});
  e.sporeFieldReadyAt=worldNow()+FIELD_COOLDOWN;
  if(target.x!==e.x)e.facingLeft=target.x<e.x;
  setClip(e,'attack');sfx('shaman-cast',{from:e});
  if(visible(e)||visible(target))log('<b>Spore field:</b> leave marked ground!','c-you',{priority:'warning'});
  return true;
 }
 function support(e,idle){
  if(!idle&&e.sporeSupportReadyAt>worldNow())return false;
  var allies=FoteEnemyTeamwork.nearby(e,4).filter(function(o){return o.state==='hunt'&&!o.base.sporecaller&&(o.hp<o.maxhp||!gameEffects.has(o,'sporecoat'));});
  allies.sort(function(a,b){return a.hp/a.maxhp-b.hp/b.maxhp||dist(a,e)-dist(b,e);});
  var target=allies[0];if(!target)return false;
  var healing=Math.max(1,Math.round(target.maxhp*.50));
  if(gameEffects.has(target,'rot'))healing=Math.floor(healing*.5);
  healing=gameDamage.heal(target,healing,e).restored;
  if(!gameEffects.has(target,'sporecoat'))gameEffects.apply(target,'sporecoat',3,undefined,{durationModifiers:false,data:{n:Math.min(12,Math.max(3,Math.round(target.maxhp*.15)))}});
  e.sporeSupportReadyAt=worldNow()+SUPPORT_COOLDOWN;
  if(target.x!==e.x)e.facingLeft=target.x<e.x;
  setClip(e,'attack');sfx('shaman-cast',{from:e});boltFx(e.x,e.y,target.x,target.y,'poison');sparkleFx(target.x,target.y,'heal',12);
  floatText(target.x,target.y,'Sporecoat','heal');
  if(visible(e)||visible(target))log('<b>Sporecaller:</b> '+target.name+': Sporecoat'+(healing?'; +'+healing+' HP':'')+'.','c-you');
  return true;
 }
 function act(e,target){
  if(e.state!=='hunt')return false;
  target=target||(canSeePlayer(e)?player:null);
  if(!target){if(e.lastSeen)stepToward(e,e.lastSeen.x,e.lastSeen.y);return true;}
  if(FoteEnemyTeamwork.retreat(e,target))return true;
  if(warn(e,target))return true;
  if(support(e))return true;
  if(FoteEnemyTeamwork.position(e,target,RANGE))return true;
  support(e,true);return true;
 }
 function pulse(clock){
  if(!floorMeta||!floorMeta.sporeFields)return;
  floorMeta.sporeFields=fields().filter(function(f){
   if(!f.expiresAt){
    var caster=ents.find(function(e){return e.id===f.owner&&e.hp>0&&e.foe&&!e.ally;});
    if(!caster||caster.state!=='hunt'||FoteActors.blocked(caster,gameEffects)||gameEffects.has(caster,'fear'))return false;
    if(turn<=f.armedTurn||clock<f.fireAt)return true;
    f.expiresAt=clock+FIELD_LIFE;
    f.cells.forEach(function(i){growth()[i]={known:!!vis[i]};});
    var sprouts=sproutShroomlings(caster,f.cells.map(function(i){return {x:i%MW,y:Math.floor(i/MW)};}),2,clock);
    if(typeof burst==='function'&&f.cells.some(function(i){return vis[i];}))burst(f.x,f.y,'poison',24,.05);
    if(f.cells.some(function(i){return vis[i];})){sfx('trap-gas',{from:f});log('Spore field: Root, Poison'+(sprouts.length?'; '+sprouts.length+' Shroomling'+(sprouts.length===1?'':'s')+' summoned':'')+'.','c-you');}
   }
   if(clock>=f.expiresAt)return false;
   // Older saves retain the field owner even after the caster is removed.
   // Capture facts, not an actor reference or the command advancing this pulse.
   if(!Object.prototype.hasOwnProperty.call(f,'applicationCause'))f.applicationCause=fieldCause({id:f.owner});
   targets().forEach(function(e){
    if(e.hp<=0||e.tomb>0||gameEffects.airborne(e)||f.cells.indexOf(idxOf(e.x,e.y))<0)return;
    var id=e===player?'player':e.id;
    if(f.rooted.indexOf(id)<0){
     f.rooted.push(id);
     gameEffects.apply(e,'root',1,undefined,{durationModifiers:false,applicationCause:f.applicationCause});
    }
    // Do not overwrite a stronger poison or bypass Earth/Unstoppable immunity.
    if(!gameEffects.has(e,'poison'))gameEffects.apply(e,'poison',2,undefined,{data:{damageScale:.25},applicationCause:f.applicationCause});
   });
   return true;
  });
 }
 function observe(){
  if(!floorMeta||!floorMeta.sporeGrowth)return;
  Object.keys(floorMeta.sporeGrowth).forEach(function(i){if(vis[i])floorMeta.sporeGrowth[i].known=true;});
 }
 function wash(x,y){
  var i=idxOf(x,y);if(floorMeta.sporeGrowth)delete floorMeta.sporeGrowth[i];
  if(floorMeta.sporeFields)floorMeta.sporeFields=floorMeta.sporeFields.filter(function(f){f.cells=f.cells.filter(function(cell){return cell!==i;});return f.cells.length>0;});
 }
 function trample(e){
  if(!floorMeta||!floorMeta.sporeGrowth||!e||e.hp<=0||gameEffects.airborne(e))return false;
  var n=typeof entitySize==='function'?entitySize(e):1,crushed=false;
  for(var y=e.y;y<e.y+n;y++)for(var x=e.x;x<e.x+n;x++){
   var i=idxOf(x,y);if(!floorMeta.sporeGrowth[i])continue;
   delete floorMeta.sporeGrowth[i];crushed=true;
   if(vis[i]&&typeof burst==='function')burst(x,y,'poison',10,.035);
  }
  if(!crushed)return false;
  if(visible(e))sfx('step-grass',{from:e,vol:.5});
  if(e.base&&e.base.sporeproof||gameEffects.blocked(e,'poison')||e===player&&player.buffs&&player.buffs.poisonward>0)return true;
  var damage=applyDamage(e,2,'poison',null,{tags:['environment','movement']});
  if(damage>0){floatText(e.x,e.y,String(damage),'poison');if(e===player)log('Mushrooms: '+combatDamageNumber(damage,'poison')+'.','c-you');}
  if(e.hp<=0)kill(e,null);
  return true;
 }
 function absorb(event){
  var e=event.target,s=e.st&&e.st.sporecoat;if(!s||!(s.n>0)||!(event.amount>0))return;
  var n=Math.min(s.n,event.amount);s.n-=n;event.amount-=n;
  floatText(e.x,e.y,'-'+Math.round(n),'heal');
  if(s.n<=0){gameEffects.remove(e,'sporecoat','depleted');if(visible(e))log(e.name+': Sporecoat broken.','c-good');}
  return n;
 }
 var greenPlants={};
 function plant(i,scale,alpha,now){
  var x=i%MW,y=Math.floor(i/MW);
  if(!spriteOn){
   var px=(x-camX)*TS,py=(y-camY)*TS;
   ctx.save();ctx.globalAlpha=alpha;blockGlyph('"',px,py,'#ABD87D');ctx.restore();return;
  }
  var v=(x*3+y*7)%5,o=FoteEnvironmentVegetation.clusterArt('mushroom-crypt',v);if(!o)return;
  // Combat growth uses the original full-size Crypt clusters, independently of scenery spreads, tinted at native
  // resolution. No newly generated mushroom silhouettes or finer detail.
  if(!greenPlants[v]||greenPlants[v].source!==o.img){
   var canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;
   var ink=canvas.getContext('2d');ink.imageSmoothingEnabled=false;ink.filter='hue-rotate(180deg) saturate(.72)';
   ink.drawImage(o.img,o.sx,o.sy,128,128,0,0,128,128);greenPlants[v]={source:o.img,canvas:canvas};
  }
  var sway=ANIM.reduce?0:Math.sin((now||0)/900+x*.7+y)*.018;
  ctx.save();ctx.globalAlpha=alpha;ctx.imageSmoothingEnabled=false;
  ctx.translate((x-camX+.5)*TS,(y-camY+.92)*TS);ctx.transform(1,0,sway,1,0,0);
  ctx.drawImage(greenPlants[v].canvas,0,0,128,128,-TS*.5*scale,-TS*scale,TS*scale,TS*scale);ctx.restore();
 }
 function ground(now){
  if(!floorMeta||!floorMeta.sporeGrowth)return;
  Object.keys(floorMeta.sporeGrowth).forEach(function(key){
   var i=Number(key),x=i%MW,y=Math.floor(i/MW);
   if(x<camX-1||y<camY-1||x>camX+viewW+1||y>camY+viewH+1)return;
   if(sceneVisibility()[i]||floorMeta.sporeGrowth[key].known&&seen[i])plant(i,.72,sceneVisibility()[i]?.88:memA(.4),now);
  });
 }
 function draw(now){
  if(!floorMeta)return;ctx.save();
  (floorMeta.sporeFields||[]).forEach(function(f){
   var active=!!f.expiresAt;
   if(!active)drawGroundWarning(f.cells,'#96B75F',now,.8);
   drawGroundMaterial('roots',f.cells,active?.55:.28);
   drawFieldMist(f.cells,'#a6b884',now,active?.15:.22);
   if(active)drawGroundRoots(f.cells,.48);
   f.cells.forEach(function(i){
    if(!sceneVisibility()[i])return;
    if(!active)plant(i,.28,.82,now);
   });
  });
  ents.forEach(function(e){
   if(e.hp<=0||!visible(e,sceneVisibility())||!gameEffects.has(e,'sporecoat'))return;
   var pos=renderPos(e),p=Math.max(1,Math.round(TS/32)),phase=ANIM.reduce?0:(now||0)/600;
   ctx.globalAlpha=.85;ctx.fillStyle='#b3d39c';
   for(var n=0;n<4;n++){
    var a=phase+n*Math.PI/2,x=(pos.x-camX+.5+Math.cos(a)*.37)*TS,y=(pos.y-camY+.52+Math.sin(a)*.34)*TS;
    ctx.fillRect(Math.round(x),Math.round(y),2*p,2*p);
   }
  });ctx.restore();
 }
 return Object.freeze({act:act,warn:warn,support:support,pulse:pulse,observe:observe,wash:wash,trample:trample,absorb:absorb,ground:ground,draw:draw});
})();

;
/* js/enemies/green-slime.js */
/* Source slimes reproduce from full health. One owner resolves poison trails,
 * including allied Shades and the stronger Rot Hollows trail. */
var FoteGreenSlime=(function(){
 'use strict';
 var trails=Object.freeze({slime:Object.freeze({name:'Slime trail',damage:1,duration:1000}),plague:Object.freeze({name:'Plague trail',damage:6,duration:1000})});
 MONSTERS.greenslime={name:'Green Slime',sprite:'m-green-slime',col:'#75a64e',ch:'s',hp:20,dmg:[1,2],acc:48,eva:0,armor:0,speed:70,range:1,xp:10,
  band:[1,4],biome:[0],w:12,living:true,sporeproof:true,greenSlime:true,art:.7,artLeft:true,sfx:'slime',
  hint:''};
 DROPS.greenslime={chance:.12,table:{essence:1}};
 if(MONSTERS.pebbleslime)MONSTERS.pebbleslime.w=0;
 function sourceBody(e){return !!(e&&e.base&&!e.swarm&&!e.shadowClone);}
 function splittingSlime(e){return sourceBody(e)&&(e.base.greenSlime||e.kind==='slime');}
 function trailKind(e){
  if(!sourceBody(e))return null;
  if(e.base.greenSlime)return 'slime';
  if(e.base.poisonTrail==='plague'||e.kind==='chaos-plague-bloat'&&e.base.chaosAI)return 'plague';
  return null;
 }
 function trailDescription(e){
  var kind=trailKind(e);if(!kind)return '';var rule=trails[kind];
  return 'Leaves poison for '+rule.duration/100+' turns: '+rule.damage+' damage per turn.'+(e.ally?' Harms foes only.':'');
 }
 function traitsHint(e){
  if(!sourceBody(e))return '';
  return (splittingSlime(e)?'Heals 2 HP per turn. Splits when hit at full health.'+(e.shade?' Two-Shade limit.':'')+' ':'')+trailDescription(e);
 }
 MONSTERS.greenslime.hint=traitsHint({kind:'greenslime',base:MONSTERS.greenslime});
 function onDamaged(event,hpBefore){
  var e=event.target;
  if(!splittingSlime(e)||event.damage<=0||e.hp<2||hpBefore<e.maxhp||!event.source||event.tags.has('periodic')||event.tags.has('environment'))return;
  // Failed reproduction at the existing summon limit cannot consume HP.
  if(e.ally&&e.shade&&ents.filter(function(actor){return actor.ally&&actor.shade&&actor.hp>0;}).length>=2)return;
  var cell=nearFree(e.x,e.y,1);if(!cell)return;
  var hp=Math.floor(e.hp/2);e.hp-=hp;
  var child=spawnRaw(e.kind,cell.x,cell.y,{base:Object.assign({},e.base),ally:!!e.ally});
  child.hp=hp;child.maxhp=e.maxhp;child.noLoot=true;child.noXp=true;child.slimeDescendant=true;child.state='hunt';
  child.name=e.name;child.base=Object.assign({},e.base);child.dmg=(e.dmg||e.base.dmg).slice();child.beta11Balanced=e.beta11Balanced;
  // The copied damage already includes any applied Underdark bonus.
  if(e.underdarkDamage3Adjusted)child.underdarkDamage3Adjusted=true;
  if(e.ally){
   child.foe=false;child.ally=true;child.state='ally';child.col=e.col;
   ['shade','shadeOwnerId','shadeSourceKind','shadeRootId','shadeLife','life','murkBaseHp','noReward'].forEach(function(key){if(e[key]!==undefined)child[key]=e[key];});
  }
  child.greenPulseAt=worldNow();
  child.lastSeen=e.lastSeen?{x:e.lastSeen.x,y:e.lastSeen.y}:null;
  child.t=Math.max(e.t||0,worldNow())+actCost(child);
  if(vis[idxOf(e.x,e.y)]){log('<b>'+e.name+'</b> splits.','c-info');sfx('slime-split',{from:e});}
 }
 function moved(e,x,y){
  var kind=trailKind(e);if(!kind||e.hp<=0||e.x===x&&e.y===y||!walkable(x,y))return;
  var clock=worldNow(),rule=trails[kind],i=idxOf(x,y),trail=floorMeta.greenTrail||(floorMeta.greenTrail={});
  var packet={bornAt:clock,expiresAt:clock+rule.duration,known:!!vis[i],kind:kind,damage:rule.damage,
    side:e.ally?'ally':kind==='plague'?'foe':'all',sourceId:e.id,sourceName:e.name,sourceX:e.x,sourceY:e.y};
  if(e.shade){packet.shade=true;packet.shadeOwnerId=e.shadeOwnerId;packet.shadeSourceKind=e.shadeSourceKind;packet.shadeRootId=e.shadeRootId;}
  var live=packets(trail[i]).filter(function(previous){return previous.expiresAt>clock&&!(packetKind(previous)===kind&&packetSide(previous)===packet.side);});
  live.push(packet);trail[i]=cell(live);
  if(kind==='plague'&&!e.ally&&!e.poisonTrailWarned&&vis[i]){e.poisonTrailWarned=true;log(e.name+' leaves '+rule.damage+' poison damage per turn.','c-info');}
 }
 function packets(ground){return ground?Array.isArray(ground.packets)?ground.packets:[ground]:[];}
 function packetKind(packet){return packet.kind==='plague'?'plague':'slime';}
 function packetSide(packet){return packet.side==='ally'?'ally':packet.side==='foe'?'foe':'all';}
 function packetDamage(packet){return Number.isFinite(packet.damage)&&packet.damage>0?packet.damage:trails[packetKind(packet)].damage;}
 function cell(list){
  if(list.length===1)return list[0];
  return {bornAt:Math.min.apply(null,list.map(function(p){return p.bornAt;})),expiresAt:Math.max.apply(null,list.map(function(p){return p.expiresAt;})),known:list.some(function(p){return p.known;}),packets:list};
 }
 function affects(packet,e){
  var side=packetSide(packet);if(side==='all')return true;
  return side==='ally'?e!==player&&e.foe&&!e.ally:e===player||e.ally;
 }
 function sourceFor(packet){
  // Native/legacy slime ground retains its neutral environmental rules.
  if(packetSide(packet)==='all')return null;
  return ents.find(function(actor){return actor.id===packet.sourceId;})||{id:packet.sourceId,name:packet.sourceName||trails[packetKind(packet)].name,
    ally:packetSide(packet)==='ally',foe:packetSide(packet)==='foe',hp:0,base:{},x:packet.sourceX,y:packet.sourceY,
    shade:!!packet.shade,shadeOwnerId:packet.shadeOwnerId,shadeSourceKind:packet.shadeSourceKind,shadeRootId:packet.shadeRootId};
 }
 function trailAt(x,y){
  var index=idxOf(x,y),ground=floorMeta.greenTrail&&floorMeta.greenTrail[index],clock=worldNow();
  var live=packets(ground).filter(function(p){return p.expiresAt>clock&&(vis[index]||p.known);}).sort(function(a,b){return Number(affects(b,player))-Number(affects(a,player))||packetDamage(b)-packetDamage(a);});
  if(!live.length)return null;var packet=live[0],rule=trails[packetKind(packet)];
  return {name:rule.name,damage:packetDamage(packet),turns:Math.ceil((packet.expiresAt-clock)/100),side:packetSide(packet),known:!!ground.known};
 }
 function hazardAt(e,x,y){return packets(floorMeta.greenTrail&&floorMeta.greenTrail[idxOf(x,y)]).some(function(packet){return packet.expiresAt>worldNow()&&affects(packet,e);});}
 function pulse(clock){
  ents.forEach(function(e){
   if(e.hp<=0||!splittingSlime(e)||e.state!=='hunt'&&!(e.ally&&e.state==='ally')||e.greenPulseAt===clock)return;
   e.greenPulseAt=clock;
   if(gameEffects.has(e,'poison')||gameEffects.has(e,'rot'))return;
   gameDamage.heal(e,2,e,{natural:true,regen:true});
  });
  if(!floorMeta.greenTrail)return;
  var trail=floorMeta.greenTrail;
  Object.keys(trail).forEach(function(i){
   var live=packets(trail[i]).filter(function(p){return clock<p.expiresAt;});
   if(!live.length){delete trail[i];return;}if(vis[i])live.forEach(function(p){p.known=true;});trail[i]=cell(live);
  });
  [player].concat(ents.filter(function(e){return e!==player;})).forEach(function(e){
   if(e.hp<=0||gameEffects.airborne(e)||e.base&&e.base.sporeproof||gameEffects.blocked(e,'poison'))return;
   var live=packets(trail[idxOf(e.x,e.y)]).filter(function(p){return p.bornAt<clock&&affects(p,e);}).sort(function(a,b){return packetDamage(b)-packetDamage(a);});
   if(!live.length)return;var packet=live[0],source=sourceFor(packet),options={tags:['periodic','environment','poison-trail']};
   if(packetSide(packet)!=='all')options.tags.push('area');
   var n=applyDamage(e,packetDamage(packet),'poison',source,options);
   if(n>0){floatText(e.x,e.y,String(n),'poison');if(e===player)log(trails[packetKind(packet)].name+': '+n+' poison damage.','c-you');}
   if(e.hp<=0)kill(e,source);
  });
 }
 function draw(now){
  if(!floorMeta.greenTrail)return;
  var cells=Object.keys(floorMeta.greenTrail).map(Number).filter(function(i){return sceneVisibility()[i]||floorMeta.greenTrail[i].known&&seen[i];});
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
 return Object.freeze({onDamaged:onDamaged,moved:moved,pulse:pulse,draw:draw,wash:wash,trailAt:trailAt,hazardAt:hazardAt,trailDescription:trailDescription,traitsHint:traitsHint});
})();

;
/* js/enemies/ghoul.js */
/* Buried Crypt ambushers are floor records, not targetable or blocking actors. */
var FoteGhoul=(function(){
 'use strict';
 MONSTERS.ghoul={name:'Buried Ghoul',sprite:'m-ghoul',col:'#988398',ch:'g',hp:77,dmg:[8,12],acc:60,eva:12,armor:0,speed:130,range:1,xp:26,
  band:[6,9],biome:[1],w:10,undead:true,ghoul:true,bleeds:1,bleedTurns:3,bleedDamage:2,art:.85,artLeft:true,sfx:'zombie',
  hint:'Emerges behind you and pursues quickly. Hits cause Bleed: 2 HP per turn for 3 turns. Healing stops it.'};
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
  log('A <b>Buried Ghoul</b> emerges behind you.','c-you');sfx('zombie-alert',{from:e});
  return true;
 }
 return Object.freeze({bury:bury,emerge:emerge});
})();

;
/* js/enemies/enemy-fields.js */
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
   if(remaining<=0||x<camX-1||y<camY-1||x>camX+viewW+1||y>camY+viewH+1||!(sceneVisibility()[i]||f.known&&seen[i]))return;
   var px=(x-camX)*TS,py=(y-camY)*TS,alpha=(sceneVisibility()[i]?1:memA(.4))*Math.min(1,remaining/100);
   if(!spriteOn)drawGroundMaterial('web',[i],Math.min(1,remaining/100),true);
   else drawBaseGroundDecal(G_WEB,x,y,px,py,alpha,now);
  });});
 }
 return Object.freeze({web:web,enter:enter,restore:restore,burn:burn,wash:wash,onDamaged:onDamaged,pulse:pulse,draw:draw});
})();

