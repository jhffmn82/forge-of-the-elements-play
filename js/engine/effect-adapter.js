/* The single connection between status rules and the existing game world.
 * All hooks are evaluated when an action runs, never while the game loads. */
function effectApplicationCause(e,key,options){
  var action=typeof gameActions!=='undefined'&&gameActions.current();
  var damage=typeof gameDamage!=='undefined'&&gameDamage.current();
  // Ground ownership records an actor side, not the command that happens to
  // be advancing the world now. Its original spell/weapon is not recorded.
  if((options.tags||[]).indexOf('environment')>=0){action=null;damage=null;}
  if(!Object.prototype.hasOwnProperty.call(options,'source')&&damage&&damage.target===e)return damage.cause;
  if(!Object.prototype.hasOwnProperty.call(options,'source')&&action){
    var hits=action.spellResults||[];
    for(var i=hits.length-1;i>=0;i--)if(hits[i].target===e){
      var hit=hits[i];
      return FoteActions.damageCause(hit,{source:hit.source,ability:hit.ability,actionId:hit.actionId,tags:['spell',hit.hit&&hit.hit.singleTarget?'single-target':'area']},null);
    }
  }
  var source=Object.prototype.hasOwnProperty.call(options,'source')?options.source:action&&action.source;
  if(!action&&!source)return null;
  var ability=options.ability||action&&(action.ability||action.options&&action.options.ability);
  var tags=Array.from(action&&action.tags||[]).concat(options.tags||[]);
  if(action&&tags.indexOf(action.kind)<0)tags.push(action.kind);
  return FoteActions.damageCause(action,{source:source||null,ability:ability,actionId:action?action.actionId:null,tags:tags},null);
}
function effectSource(cause){
  if(!cause||!Number.isFinite(cause.sourceId))return null;
  if(player&&player.id===cause.sourceId)return player;
  return ents.find(function(e){return e.id===cause.sourceId;})||null;
}
/* World pulses and movement riders consume the same saved status origin. */
function periodicEffectContext(e,key,tags,extra){
  var status=e.st&&e.st[key]||{},known=Object.prototype.hasOwnProperty.call(status,'applicationCause');
  var source=known?effectSource(status.applicationCause):key==='poison'?null:e.lastHitBy||null;
  var options=Object.assign({tags:tags},extra||{});
  if(known){options.cause=status.applicationCause;options.applicationCause=status.applicationCause;options.actionId=status.applicationCause?status.applicationCause.actionId:null;}
  return {source:source,options:options};
}
var gameEffects=FoteEffects.create({
  applicationCause:effectApplicationCause,
  pendingHit:function(e){return pendingHit(e);},
  getPlayer:function(){return player;},
  now:function(){return typeof worldNow==='function'?worldNow():player.t;},
  hasPerk:function(id){return hasP(id);},
  affinity:function(el){return aff(el);},
  inWater:function(e){return at(e.x,e.y)===WATER;},
  defaultBurnDamage:function(){return sDMG(2);},
  bonusDuration:function(e,key,turns){if(e.shadowClone&&e.cloneStats&&e.cloneStats.passives.ironConst)return Math.max(1,Math.round(turns/2))-turns;return e!==player&&e.foe&&syllaOn()&&godRank()>=5?1:0;},
  onBlocked:function(event){
    if(event.reason==='unstoppable'){
      var info=typeof STATUS_INFO!=='undefined'&&STATUS_INFO[event.key];
      log('Resisted '+(event.requested==='web'||event.requested==='webbed'?'Web':info&&info.name||event.key)+'.','c-good');
    }
  },
  onApplied:function(event,service){
    var e=event.entity,key=event.key,sourceAff=event.options&&event.options.sourceAffinity||event.status.sourceAffinity;
    if(e===player&&key==='blind'&&typeof computeFOV==='function')computeFOV();
    function rank(el){return sourceAff?sourceAff[el]||0:aff(el);}
    function hasCombo(a,b){return combo(a,b,sourceAff?{aff:sourceAff}:undefined);}
    if(['burn','stun','fear','root','blind','poison','bleed','slow'].indexOf(key)>=0)sfx('status-'+key,{from:e});
    if(e===player&&key==='fear'){stopTravel();stopRest();PACING.pending=null;}
    if(e===player||!e.foe||e.hp<=0)return;
    if(key==='root'){
      if(rank('earth')>=6&&event.previous&&!(e.stoneImm>turn)){
        service.apply(e,'stone',2,undefined,{durationModifiers:false,refresh:'replace',applicationCause:event.status.applicationCause});e.stoneImm=turn+4;
        floatText(e.x,e.y,'stone','earth');log(e.name+': Petrified.','c-good');sfx('earth-cast',{from:e});
      }
      if(rank('earth')>=3&&!service.has(e,'poison')){
        if(sourceAff)service.apply(e,'poison',Math.min(3,Math.max(1,rank('earth')-2)),undefined,{durationModifiers:false,refresh:'replace',data:{sourceAffinity:sourceAff},applicationCause:event.status.applicationCause});
        else applyPoison(e,true);
      }
    }
    var cause=event.status.applicationCause;
    var purgingView=cause&&Number.isFinite(cause.sourceId)&&sourceAff?{aff:sourceAff}:null;
    if(key==='burn'&&!purgingView&&cause&&cause.sourceId===player.id){
      // Other actors never borrow the player's combo. Resolve player-owned
      // applications from the selected hit, with current-build fallback for
      // explicit player reactions and ground fire that have no attack view.
      var damage=typeof gameDamage!=='undefined'&&gameDamage.current();
      var action=typeof gameActions!=='undefined'&&gameActions.current();
      var hit=damage&&damage.hit;
      if(hit&&hit.att===player&&hit.view)purgingView=hit.view;
      else if(action&&action.source===player&&action.view)purgingView=action.view;
      else if(action){
        var hits=action.spellResults||[];
        for(var i=hits.length-1;i>=0;i--)if(hits[i].source===player&&hits[i].target===e&&hits[i].actionId===cause.actionId){purgingView=hits[i].view;break;}
      }
      if(!purgingView)purgingView=player;
    }
    var purging=key==='burn'&&purgingView&&combo('fire','light',purgingView);
    var radiant=key==='root'&&hasCombo('earth','light');
    if(purging||radiant){
      // Each successful Burn/Root application also reapplies its Blind rider.
      // Use resolved duration without paying application modifiers twice.
      service.apply(e,'blind',Math.max(1,event.turns),undefined,{durationModifiers:false,applicationCause:event.status.applicationCause});
    }
  },
  onFrozen:function(event){sfx('status-freeze',{from:event.entity});floatText(event.entity.x,event.entity.y,'frozen','ice');},
  onChill:function(event){
    var receipt=event.options&&event.options.hit&&event.options.hit.nativeDamage;
    if(!receipt||receipt.source!==player||receipt.target!==event.entity||!(receipt.damage>0))return;
    var arc=FoteDamage.chillArc(receipt.affinity);
    if(arc.enabled)emitElementArcs(receipt,arc);
  },
  onBeforePulse:function(event,service){
    var e=event.entity,bornAt=event.clock-101;
    if(!service.airborne(e)&&at(e.x,e.y)===WATER){
      if(service.remove(e,'burn','extinguished'))floatText(e.x,e.y,'hiss','ice');
      service.apply(e,'wet',3,undefined,{durationModifiers:false,refresh:'replace',bornAt:bornAt});
    }
    if(!service.airborne(e)&&fireT&&fireT[idxOf(e.x,e.y)]>0){
      if(e.base&&e.base.damageAbsorption&&e.base.damageAbsorption.fire>0){
        // Absorbers take the same incoming ground heat through the damage
        // service. It becomes healing there, without leaving a Burn status.
        dealDirectDamage(e,sDMG(2),'fire',typeof fireSrc!=='undefined'&&fireSrc[idxOf(e.x,e.y)]===1?player:null,{tags:['periodic','environment','ground-fire']});
      }else if(!(e===player&&aff('fire')>=6)&&!(e.base&&e.base.el==='fire'))service.apply(e,'burn',3,sDMG(2),{bornAt:bornAt,source:typeof fireSrc!=='undefined'&&fireSrc[idxOf(e.x,e.y)]===1?player:null,tags:['environment','ground-fire']});
    }
  },
  onTick:function(event,service){
    var e=event.entity,s=event.status,key=event.key,damage=0,context=periodicEffectContext(e,key,['periodic',key]);
    if(key==='bleed'){
      damage=dealDirectDamage(e,Math.max(1,s.d||2),'phys',context.source,context.options);e._hit=performance.now();floatText(e.x,e.y,String(damage),'blood');
      if(e===player)log('Bleed: '+combatDamageNumber(damage,'phys')+'.','c-you');
      if(rng()<.35&&typeof setG==='function'&&gAt(e.x,e.y)===G_NONE)setG(e.x,e.y,G_BLOOD);
    }else if(key==='burn'){
      context.options.resistanceApplied=true;
      damage=dealDirectDamage(e,Math.max(1,Math.round(s.d*resistMult(e,'fire'))),'fire',context.source,context.options);e._hit=performance.now();floatText(e.x,e.y,String(damage),'fire');
      if(e===player)log('Burn: '+combatDamageNumber(damage,'fire')+'.','c-you');
      if(gAt(e.x,e.y)===G_GRASS||gAt(e.x,e.y)===G_SHORT)ignite(e.x,e.y,e===player?'player':null);
    }else if(key==='poison'){
      var poisonScale=Number.isFinite(s.damageScale)&&s.damageScale>0?s.damageScale:1;
      damage=Math.max(1,Math.round(e.maxhp*(e.base&&e.base.boss?.05:.10)*poisonScale));
      damage*=resistMult(e,'poison');
      if(e===player&&((player.buffs&&player.buffs.poisonward>0)||aff('earth')>=6))damage=0;
      if(e.base&&e.base.sporeproof)damage=0;
      context.options.resistanceApplied=true;
      damage=dealDirectDamage(e,damage,'poison',context.source,context.options);floatText(e.x,e.y,String(damage),'poison');
      if(e===player&&damage>0)log('Poison: '+combatDamageNumber(damage,'poison')+'.','c-you');
    }else if(key==='aura'&&e===player){
      ents.slice().forEach(function(o){if(o.foe&&dist(o,player)<=2){var dealt=applyDamage(o,s.d||3,'dark',player);floatText(o.x,o.y,String(dealt),'dark');healPlayer(1);if(o.hp<=0)kill(o,player);}});
    }
    if(e.hp<=0){kill(e,context.source);return false;}
    return true;
  },
  onExpired:function(event){
    if(event.entity===player&&event.key==='blind'&&typeof computeFOV==='function')computeFOV();
    if(event.entity===player&&(event.key==='livingmountain'||event.key==='discipline'))derive(player);
  }
});

function applyStatus(e,key,turns,extra,options){return gameEffects.apply(e,key,turns,extra,options);}
function addChill(e,options){
  options=options||{};var receipt=options.hit&&options.hit.nativeDamage;
  if(receipt&&receipt.source===player&&receipt.target===e)options=Object.assign({},options,{sourceAffinity:receipt.affinity,applicationCause:receipt.cause});
  return gameEffects.addChill(e,options);
}
function effectHasTag(e,tag){return gameEffects.hasTag(e,tag);}

/* Fear consumes this command only. It never schedules another player action. */
var PLAYER_FEAR_ACTING=false;
function playerFearAction(){
  if(PLAYER_FEAR_ACTING||!player||player.hp<=0||RUN.victory||player.tombed||gameTurns.busy()||!gameEffects.hasTag(player,'fear'))return false;
  var fear=player.st.fear||{},source=ents.find(function(e){return e.id===fear.sourceId&&e.hp>0;});
  if(!source&&Number.isFinite(fear.sourceX)&&Number.isFinite(fear.sourceY))source={x:fear.sourceX,y:fear.sourceY};
  if(!source)source=ents.filter(function(e){return e.foe&&e.hp>0;}).sort(function(a,b){return dist(player,a)-dist(player,b);})[0];
  stopTravel();stopRest();if(aiming)cancelAim();BOWAIM=null;PACING.pending=null;
  var held=['root','stun','frozen'].some(function(tag){return gameEffects.hasTag(player,tag);});
  var step=source&&!held&&FoteActors.bestStep(player,function(x,y){return dist({x:x,y:y},source);},function(x,y,dx,dy){
    if(!inb(x,y)||!walkable(x,y)||occupied(x,y))return false;
    var tile=at(x,y);if(tile===CHASM||tile===PORTAL||tile===EXIT||tile===STAIRS||tile===UPSTAIRS)return false;
    return !(dx&&dy&&!walkable(player.x+dx,player.y)&&!walkable(player.x,player.y+dy));
  },true);
  PLAYER_FEAR_ACTING=true;
  try{
    if(step){log('Fear: retreat.','c-info');performPlayerMove(step.dx,step.dy);}
    else {log('Fear: trapped.','c-info');endTurn();}
  }finally{PLAYER_FEAR_ACTING=false;}
  return true;
}
