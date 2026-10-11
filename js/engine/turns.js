/* Explicit action phases. `turn` is a paid-action counter for saved telegraphs;
 * `player.t` is scheduler time. Periodic work requires positive elapsed time. */
function turnInCombat(){return ents.some(function(e){return e.foe&&e.hp>0&&e.state==='hunt'&&vis[idxOf(e.x,e.y)];});}
function turnBeginCombatLog(){if(typeof FoteCombatLog!=='undefined')FoteCombatLog.beginTurn();}
function turnFinishCombatLog(){if(typeof FoteCombatLog!=='undefined')FoteCombatLog.finishTurn();}
function turnPrepareAction(context){
  BOWAIM=null;player.movedLast=context.moved;
  context.smokeHidden=typeof takeSmokeHiddenReceipt==='function'?takeSmokeHiddenReceipt(player,context.from):0;
  if(player.castingSpell){player.hidden=context.smokeHidden?Math.min(player.hidden||0,context.smokeHidden):0;player.syllaDark=0;}
  if(player.stillness>0){
    if(context.moved){context.stillness=true;player.stillness--;if(!player.stillness)log('Time lurches back into motion.','c-info');}
    else {player.stillness=0;log('Your action breaks the stillness.','c-info');}
  }
  FREE_ACTION=FREE_ACTION||(!context.moved&&(player.lastAttack||context.noisy)&&aff('air')>=6&&pRoll(.15));
}
function turnPrepareBuffClocks(context){
  var previous=player._worldBuffPrev||{};player._worldBuffBorn=player._worldBuffBorn||{};
  context.freshBuffs=[];
  Object.keys(player.buffs||{}).forEach(function(key){if(player.buffs[key]>(previous[key]||0)){player._worldBuffBorn[key]=context.from;context.freshBuffs.push(key);}});
  if(player.hidden>(player._worldHiddenPrev||0))player._worldHiddenBorn=context.from;
  if(player.levitate>(player._worldLevitatePrev||0))player._worldLevitateBorn=context.from;
}
function turnRefreshSight(context){if(context.moved)computeFOV();}
function turnAdvanceAction(context){
  player.t=context.to;turn++;RUN.turns++;
  context.actionId=turn;
  context.freshBuffs.forEach(function(key){player._worldBuffBorn[key]=context.to;});
  player._worldFreshBuffs=[];
  if(context.smokeHidden)player._worldHiddenBorn=context.to;
  if(player.blurCd>0)player.blurCd--;
  if(player.fortCd>0)player.fortCd--;
}
function turnHunger(context){
  var before=player.hunger,sustenance=ringVal('sustenance');
  player.hunger=Math.max(0,Math.min(HUNGER_MAX,player.hunger-hungerCost(context.cost)*(1-sustenance)));
  if(before>=300&&player.hunger<300){log('<b>You are getting hungry.</b> Eat something soon.','c-you',{priority:'warning'});sfx('hungry');}
  if(player.hunger<=0&&turn%5===0){
    dealDirectDamage(player,1,'phys',null,{tags:['periodic','starvation']});floatText(player.x,player.y,'1','phys');
    if(turn%25===0){log('You are starving!','c-you',{priority:'warning'});sfx('hungry');}
  }
}
function turnDeepLavaPlayer(){if(inDeep()&&floorMeta.lava&&player.hp>0)deepLavaBurn(player);}
function turnRegeneration(context){
  if(player.hp<=0)return;
  var fighting=turnInCombat(),scale=context.cost/100;
  var mpRate=(.60+.05*Math.max(0,player.stats.foc-10))/100*(1+(hasP('meditation')?.25:0));
  if(hasP('tidalMind')&&player.mp<player.maxmp/2)mpRate*=2;
  var hpRate=(.20+.02*Math.max(0,player.stats.vit-10))/100;
  if(hasP('resilient')&&player.hp<player.maxhp/2)hpRate*=2;
  if(bodyArmor(player).enchant==='light')hpRate*=1+enchantValues('armor','light').hpRegen;
  if(hasGod('grumbok'))hpRate*=1+.20*godRank();
  if(player.hunger<=0||gameEffects.has(player,'poison')||gameEffects.has(player,'rot')||fighting)hpRate=0;
  player.mp=Math.min(player.maxmp,player.mp+player.maxmp*mpRate*scale);
  healPlayer(player.maxhp*hpRate*scale,true,{regen:true});
  if(player.t-(player.lastDamageTime||0)>=500&&player.iceArmor<player.iceArmorMax)player.iceArmor=Math.min(player.iceArmorMax,player.iceArmor+scale);
  var mending=ringVal('mending');
  delete player.mendingDebt; // Retire accumulated drain from older saves.
  if(mending>0&&player.hunger>0&&!gameEffects.has(player,'poison'))healPlayer(player.maxhp*mendingRate(mending)*scale,false,{regen:true});
  if(player.buffs&&player.buffs.manaflow>0)player.mp=Math.min(player.maxmp,player.mp+player.maxmp*.009*scale);
  if(infusion('holy')==='water')player.mp=Math.min(player.maxmp,player.mp+player.maxmp*.006*enchantValues('holy','water').manaRegen*scale);
}
function turnWorldPulse(clock){
  turnDeathRemains(clock);
  turnRitualRooms(clock);
  [player].concat(ents.filter(function(e){return e!==player;})).forEach(function(e){
    if(e.tomb>0){e.tomb--;if(!e.tomb){log('The ice around '+e.name+' shatters.','c-info');sfx('ice-melt',{from:e});}return;}
    worldStatusPulse(e,clock);
    if(typeof FoteShadowClone!=='undefined')FoteShadowClone.pulse(e,clock);
    if(e!==player&&!e.undeadServant){
      var key=e.shadeLife>0?'shadeLife':'life';
      if(e[key]>0){e[key]--;if(e[key]<=0)ents=ents.filter(function(other){return other!==e;});}
    }
  });
  Object.keys(player.buffs||{}).forEach(function(key){
    if(!(player.buffs[key]>0)||(player._worldBuffBorn||{})[key]>=clock)return;
    player.buffs[key]--;
    if(key==='trollblood'&&player.hp>0)healPlayer(player.maxhp*FoteDamage.trollBlood(godRank(),divineStrength()).regenFraction,false,{regen:true});
    if(key==='laststand'&&player.hp>0)healPlayer(player.maxhp*FoteDamage.lastStand(godRank(),divineStrength()).regenFraction,false,{regen:true});
    if(key==='afterglow'&&player.hp>0)healPlayer(Math.max(1,Math.round(player.maxhp*.05)));
  });
  if(player.hidden>0&&!(player._worldHiddenBorn>=clock))player.hidden--;
  // Air 3 is continuous support over the current chasm, not an expiring spell.
  // Refresh before expiry can fall; the later puzzle phase cannot undo a fall.
  var windSupported=player.windCarry&&aff('air')>=3&&at(player.x,player.y)===CHASM;
  if(player.windCarry&&!windSupported)player.windCarry=false;
  if(player.levitate>0&&!(player._worldLevitateBorn>=clock)){
    player.levitate--;if(!player.levitate&&!windSupported&&at(player.x,player.y)===CHASM)fallIntoChasm();
  }
  if(windSupported)player.levitate=Math.max(player.levitate,1);
  groundTick();godsWorldAdvance(clock-100,clock);
  if(typeof FoteChaosEnemies!=='undefined')FoteChaosEnemies.globalPulse(clock);
  if(typeof FoteSporecaller!=='undefined')FoteSporecaller.pulse(clock);
  if(typeof FoteGreenSlime!=='undefined')FoteGreenSlime.pulse(clock);
  if(typeof FoteEnemyFields!=='undefined')FoteEnemyFields.pulse(clock);
  if(typeof FoteUnmakerEncounter!=='undefined')FoteUnmakerEncounter.pulsePylons(clock);
}
function turnExplore(){
  spotTraps();if(!floorMeta.boss)wanderingSpawn();godTick(turnInCombat());
}
function turnFinalizeAction(context){
  player.lastAttack=false;player.movedThisTurn=false;player.castingSpell=false;FREE_ACTION=false;delete player.grassStep;
  delete player.ghoulStep;
  if(player.hp<context.hpBefore)player.lastDamageTime=player.t;
  player._worldBuffPrev=Object.assign({},player.buffs);
  player._buffPrev=Object.assign({},player.buffs);
  player._worldHiddenPrev=player.hidden;player._worldLevitatePrev=player.levitate;
  player._buffSeen=buffTimers();
  player._buffDurationSeen=Object.assign({},player._buffSeen);
  if(player.hp<=0)death();else {derive(player);computeFOV();if(typeof FoteSporecaller!=='undefined')FoteSporecaller.observe();updateUI();draw();}
}
/* One scheduler owns world time and resumable presentation waits. Its phases
 * are the game's fixed action order, not a configurable service registry. */
var gameTurns=(function(){
  var currentClock=null,pending=null,generation=0,flushing=false;
  function clock(value){currentClock=value;WORLD_NOW=value;}
  function alive(){return player&&player.hp>0;}
  function* scheduleFlow(from,to){
    if(!(to>from))return;
    var next=(Math.floor(from/100)+1)*100,steps=0,previous=currentClock;
    try{
      yield turnPlayerAnimationWait();
      while(alive()){
        if(++steps>10000)throw new Error('Actor scheduler exceeded its progress bound');
        var actor=null;
        ents.forEach(function(e){if((e.foe||e.ally)&&e.hp>0&&e.t<to&&(!actor||e.t<actor.t))actor=e;});
        if(next<=to&&(!actor||next<=actor.t)){clock(next);turnWorldPulse(next);next+=100;continue;}
        if(!actor)break;
        clock(Math.max(from,actor.t));
        turnPrimeAnimations(actor);
        aiAct(actor);
        var wait=turnActorAnimationWait(actor);
        // A paused animation is presentation time, never an active world pulse.
        clock(previous);
        yield wait;
      }
    }finally{clock(previous);}
  }
  var beforeWorld=[turnRefreshSight,function(context){FoteEnemyPerception.playerAction(context);},
    turnIdentifyGear,turnDeepLavaPlayer,turnHunger,refreshPlayerDistance];
  var afterWorld=[function(context){FoteGhoul.emerge(context);},
    fireTick,turnRegeneration,turnExplore,turnExpireAmuletTerrain,turnRevealKeenEyes,
    turnExpireSmoke,turnExpireItems,turnClearTomeWard,turnClassRecovery,
    turnElementAfterAction,turnComboAfterAction,turnPuzzleHazards,turnMeltHoard,
    turnCryptClouds,turnCryptCorpses,turnMortyReturn,turnGraveOoze,planeTick,
    planeCreaturesTick,turnShockClouds,turnCaveSpores,eelPlacement,mawTick,
    vegRegrowTick,turnFoodRecovery,turnDeepLavaEnemies,deepHatchTick,
    matronVenomTick,fwaTick,turnLichReturn];
  function whileAlive(phases,context){
    for(var phase of phases){if(!alive())break;phase(context);}
  }
  function* actionFlow(){
    if(!alive())return null;
    var born=generation,context={from:player.t,cost:0,elapsed:false,actionId:turn,
      hpBefore:player.hp,moved:!!player.movedThisTurn,noisy:!!player.noisy};
    try{
      turnBeginCombatLog(context);turnPrepareAction(context);
      turnPrepareHolyBuffs(context);turnPrepareCinder(context);turnPrepareBuffClocks(context);
      context.cost=context.stillness?0:player.tombed?100:context.moved?moveCost():actCost(player);
      if(!Number.isFinite(context.cost)||context.cost<0)throw new Error('Action cost must be finite and non-negative');
      context.to=context.from+context.cost;
      if(context.cost===0)return context;
      context.elapsed=true;
      turnAdvanceAction(context);
      whileAlive(beforeWorld,context);
      if(alive())yield* scheduleFlow(context.from,context.to);
      whileAlive(afterWorld,context);
      return context;
    }finally{
      if(born===generation){turnFinalizeAction(context);turnStartSlides(context);turnFinishCombatLog(context);}
    }
  }
  /* One resumable driver owns the turn. Reduced-motion work remains synchronous;
   * only finite visible animations yield to the browser. Saving can flush them. */
  function run(iterator){
    if(pending)return null;
    var task={iterator:iterator,cancelWait:null,promise:null,resolve:null,reject:null,after:[]};pending=task;
    function step(){
      if(pending!==task)return;
      task.cancelWait=null;
      try{
        for(;;){
          var result;task.running=true;try{result=iterator.next();}finally{task.running=false;}
          if(result.done){pending=null;task.after.forEach(function(fn){fn(result.value);});if(task.resolve)task.resolve(result.value);return result.value;}
          var delay=Number(result.value)||0;
          if(delay>0&&!flushing){
            if(!task.promise)task.promise=new Promise(function(resolve,reject){task.resolve=resolve;task.reject=reject;});
            var timer=setTimeout(step,Math.ceil(delay));
            task.cancelWait=function(){clearTimeout(timer);};return task.promise;
          }
        }
      }catch(error){pending=null;if(task.reject){task.reject(error);if(flushing)throw error;return task.promise;}throw error;}
    }
    task.step=step;return step();
  }
  function flush(){
    if(!pending||pending.running)return;
    var task=pending;if(task.cancelWait)task.cancelWait();
    flushing=true;try{return task.step();}finally{flushing=false;}
  }
  function cancel(){
    generation++;
    var task=pending;if(!task)return;
    pending=null;if(task.cancelWait)task.cancelWait();
    try{task.iterator.return();}finally{clock(null);if(task.resolve)task.resolve(null);}
  }
  return Object.freeze({action:function(){return run(actionFlow());},
    busy:function(){return !!pending;},running:function(){return !!(pending&&pending.running);},
    flushing:function(){return flushing;},flush:flush,cancel:cancel,
    after:function(fn){if(pending){pending.after.push(fn);return pending.promise;}return fn();}});
})();
function endTurn(){
  // Reflection and other action-time damage can kill before scheduling starts.
  // The scheduler rejects dead actors, so finish that death at the action boundary.
  if(player&&player.hp<=0){death();updateUI();draw();turnFinishCombatLog();return;}
  if(!player.movedThisTurn&&!player.lastAttack&&!player.castingSpell&&playerFearAction())return;
  var result=gameActions.suspend(function(){return gameTurns.action();});
  if(result&&typeof result.catch==='function')result.catch(function(error){console.error('Enemy turn failed',error);stopTravel();PACING.pending=null;});
  return result;
}
/* Post-action work must also run after a synchronous save flush. */
function afterTurn(fn){
  var run=RUN,hero=player;
  return gameTurns.after(function(){if(RUN===run&&player===hero)return fn();});
}
