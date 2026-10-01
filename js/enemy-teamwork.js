/* Small local groups share a sighting, never the player's unseen position. */
var FoteEnemyTeamwork=(function(){
 'use strict';
 var goblins=['goblin','archer','brute','shaman'];
 function family(e){
  if(!e||!e.foe||e.ally||e.hp<=0||!e.base||e.base.boss||e.base.object)return null;
  if(goblins.indexOf(e.kind)>=0)return 'goblin';
  if(['acolyte','shambler','ghoul','skeleton','bonearcher','shade','gravebloat'].indexOf(e.kind)>=0)return 'crypt';
  if(['sporecaller','myconid','shroomling','stormbeetle','sparkjelly','shockeel','crystalcrawler','caverat','cavebat','caveslime'].indexOf(e.kind)>=0)return 'cavern';
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
  healed=Math.min(target.maxhp-target.hp,healed);
  target.hp+=healed;
  if(!gameEffects.has(target,'goblinrage'))gameEffects.apply(target,'goblinrage',4,undefined,{durationModifiers:false});
  e.rageReadyAt=worldNow()+600;setClip(e,'attack');sfx('shaman-cast',{from:e});
  boltFx(e.x,e.y,target.x,target.y,'fire');sparkleFx(target.x,target.y,'heal',16);floatText(target.x,target.y,'Rage','fire');
  if(vis[idxOf(e.x,e.y)]||vis[idxOf(target.x,target.y)])log('<b>Goblin Shaman:</b> '+target.name+' gains Rage'+(healed?' and '+healed+' HP':'')+'.','c-you');
  return true;
 }
 function boneWard(e,idle){
  if(!idle&&e.wardCd>0)return false;
  var allies=nearby(e,4).filter(function(o){return o.state==='hunt'&&o.base.undead&&!o.boneWard;});
  if(!allies.length)return false;
  allies.forEach(function(o){o.boneWard=true;sparkleFx(o.x,o.y,'dark',12);});
  e.wardCd=5;setClip(e,'attack');sfx('shaman-cast',{from:e});
  if(vis[idxOf(e.x,e.y)])log('The <b>Necro-Acolyte</b> grants Bone Ward.','c-info');
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
  if(dist(e,target)<=e.base.castRange&&e.castCd<=0&&clearShot(e,target)){
   e.castCd=e.base.castEvery;setClip(e,'attack');sfx('shaman-cast',{from:e});boltFx(e.x,e.y,target.x,target.y,'fire');
   var chance=hitChance(e.base.acc+10,evaOf(target));if(target===player)chance=hostileHitChance(chance,true);
   if(rng()<chance){
    var damage=applyDamage(target,roll(5,8)+floorNo,'fire',e);floatText(target.x,target.y,String(damage),'fire');
    var burn=target.hp>0&&rng()<.5;if(burn)applyStatus(target,'burn',3,sDMG(2));
    log(e.name+' hurls a firebolt'+(target===player?'':' at '+target.name)+': <b>'+damage+'</b> fire'+(burn?'. '+(target===player?'You are':target.name+' is')+' burning':'')+'.','c-you');
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
  if(target===player)log('The <b>Goblin Brute</b> shoulder-checks you back!','c-you');
  else if(vis[idxOf(e.x,e.y)])log('The <b>Goblin Brute</b> shoulder-checks '+target.name+' back!','c-info');
  return true;
 }
 return Object.freeze({family:family,openLine:openLine,nearby:nearby,alert:alert,takeTurn:takeTurn,rally:rally,boneWard:boneWard,retreat:retreat,position:position,shaman:shaman,shoulderCheck:shoulderCheck});
})();
