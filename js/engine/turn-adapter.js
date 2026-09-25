/* Explicit action phases. `turn` is a paid-action counter for saved telegraphs;
 * `player.t` is scheduler time. Periodic work requires positive elapsed time. */
function turnInCombat(){return ents.some(function(e){return e.foe&&e.hp>0&&e.state==='hunt'&&vis[idxOf(e.x,e.y)];});}
function turnPrepareAction(context){
  BOWAIM=null;player.movedLast=context.moved;
  if(player.castingSpell){player.hidden=0;player.syllaDark=0;}
  if(player.stillness>0){
    if(context.moved){context.stillness=true;player.stillness--;if(!player.stillness)log('Time lurches back into motion.','c-info');}
    else {player.stillness=0;log('Your action breaks the stillness.','c-info');}
  }
  FREE_ACTION=FREE_ACTION||(!context.moved&&(player.lastAttack||context.noisy)&&aff('air')>=6&&rng()<.15);
}
function turnPrepareBuffClocks(context){
  var previous=player._worldBuffPrev||{};player._worldBuffBorn=player._worldBuffBorn||{};
  context.freshBuffs=[];
  Object.keys(player.buffs||{}).forEach(function(key){if(player.buffs[key]>(previous[key]||0)){player._worldBuffBorn[key]=context.from;context.freshBuffs.push(key);}});
  if(player.hidden>(player._worldHiddenPrev||0))player._worldHiddenBorn=context.from;
  if(player.levitate>(player._worldLevitatePrev||0))player._worldLevitateBorn=context.from;
}
function turnAdvanceAction(context){
  player.t=context.to;turn++;RUN.turns++;
  context.actionId=turn;
  context.freshBuffs.forEach(function(key){player._worldBuffBorn[key]=context.to;});
  player._worldFreshBuffs=[];
  if(player.blurCd>0)player.blurCd--;
  if(player.fortCd>0)player.fortCd--;
}
function turnHunger(context){
  var before=player.hunger,sustenance=ringVal('sustenance');
  player.hunger=Math.max(0,Math.min(HUNGER_MAX,player.hunger-hungerCost(context.cost)*(1-sustenance)));
  if(before>=300&&player.hunger<300){log('<b>You are getting hungry.</b> Eat something soon.','c-you');sfx('hungry');}
  if(player.hunger<=0&&turn%5===0){
    dealDirectDamage(player,1,'phys',null);floatText(player.x,player.y,'1','phys');
    if(turn%25===0){log('You are starving!','c-you');sfx('hungry');}
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
  if(hasGod('glimmer'))hpRate*=1+.10*godRank();
  if(player.hunger<=0||gameEffects.has(player,'poison')||gameEffects.has(player,'rot')||fighting)hpRate=0;
  player.mp=Math.min(player.maxmp,player.mp+player.maxmp*mpRate*scale);
  healPlayer(player.maxhp*hpRate*scale,true);
  if(player.t-(player.lastDamageTime||0)>=500&&player.iceArmor<player.iceArmorMax)player.iceArmor=Math.min(player.iceArmorMax,player.iceArmor+scale);
  var mending=ringVal('mending');if(mending&&player.hunger>0&&!gameEffects.has(player,'poison'))healPlayer(player.maxhp*mendingRate(mending)*scale);
  if(player.buffs&&player.buffs.manaflow>0)player.mp=Math.min(player.maxmp,player.mp+player.maxmp*.009*scale);
  if(infusion('holy')==='water'&&isBuffed())player.mp=Math.min(player.maxmp,player.mp+player.maxmp*.006*enchantValues('holy','water').manaRegen*scale);
}
function turnWorldPulse(clock){
  [player].concat(ents.filter(function(e){return e!==player;})).forEach(function(e){
    if(e.tomb>0){e.tomb--;if(!e.tomb){log('The ice around '+e.name+' shatters.','c-info');sfx('ice-melt');}return;}
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
    if(key==='afterglow'&&player.hp>0)healPlayer(Math.max(1,Math.round(player.maxhp*.05)));
  });
  if(player.hidden>0&&!(player._worldHiddenBorn>=clock))player.hidden--;
  if(player.levitate>0&&!(player._worldLevitateBorn>=clock)){
    player.levitate--;if(!player.levitate&&at(player.x,player.y)===CHASM)fallIntoChasm();
  }
  groundTick();godsWorldAdvance(clock-100,clock);
  if(typeof FoteChaosEnemies!=='undefined')FoteChaosEnemies.globalPulse(clock);
}
function turnExplore(){
  spotTraps();if(!floorMeta.boss)wanderingSpawn();godTick(turnInCombat());
}
function turnFinalizeAction(context){
  if(context.freeStep)player.freeStep=false;
  player.lastAttack=false;player.movedThisTurn=false;player.castingSpell=false;FREE_ACTION=false;
  if(player.hp<context.hpBefore)player.lastDamageTime=player.t;
  player._worldBuffPrev=Object.assign({},player.buffs);
  player._buffPrev=Object.assign({},player.buffs);
  player._worldHiddenPrev=player.hidden;player._worldLevitatePrev=player.levitate;
  player._buffSeen=buffTimers();
  if(player.hp<=0)death();else {derive(player);computeFOV();updateUI();draw();}
}
function turnPhase(name,run,aliveOnly){return {name:name,run:run,aliveOnly:!!aliveOnly};}
var gameTurns=FoteTurns.create({
  now:function(){return player.t;},alive:function(){return player&&player.hp>0;},
  setClock:function(clock){WORLD_NOW=clock;},
  snapshot:function(){return {actionId:turn,hpBefore:player.hp,moved:!!player.movedThisTurn,noisy:!!player.noisy,freeStep:!!(player.movedThisTurn&&player.freeStep)};},
  actors:function(){return ents;},active:function(e){return (e.foe||e.ally)&&e.hp>0;},
  beforeSchedule:function(){ents.forEach(betaEnemyBalance);},
  beforeActors:turnPlayerAnimationWait,beforeActor:turnPrimeAnimations,afterActor:turnActorAnimationWait,
  act:function(e){aiAct(e);},
  actorCost:function(e){return actCost(e);},pulse:turnWorldPulse,
  cost:function(context){return context.stillness?0:player.tombed?100:context.moved?moveCost():actCost(player);},
  advanceAction:turnAdvanceAction,
  prepare:[turnPhase('action-flags',turnPrepareAction),turnPhase('holy-buff-gain',turnPrepareHolyBuffs),turnPhase('cinder-trail',turnPrepareCinder),turnPhase('effect-birth-clocks',turnPrepareBuffClocks)],
  beforeWorld:[turnPhase('gear-use',turnIdentifyGear,true),turnPhase('lava-at-player',turnDeepLavaPlayer,true),turnPhase('hunger',turnHunger,true),turnPhase('distance-field',refreshPlayerDistance,true)],
  afterWorld:[
    turnPhase('fire',fireTick,true),turnPhase('regeneration',turnRegeneration,true),turnPhase('exploration',turnExplore,true),
    turnPhase('temporary-terrain',turnExpireAmuletTerrain,true),turnPhase('keen-eyes',turnRevealKeenEyes,true),turnPhase('smoke-expiry',turnExpireSmoke,true),turnPhase('item-expiry',turnExpireItems,true),
    turnPhase('tome-ward',turnClearTomeWard,true),turnPhase('class-recovery',turnClassRecovery,true),turnPhase('element-passives',turnElementAfterAction,true),turnPhase('element-combos',turnComboAfterAction,true),
    turnPhase('puzzle-hazards',turnPuzzleHazards,true),turnPhase('frozen-hoard',turnMeltHoard,true),turnPhase('crypt-clouds',turnCryptClouds,true),turnPhase('crypt-corpses',turnCryptCorpses,true),turnPhase('morty-return',turnMortyReturn,true),turnPhase('grave-ooze',turnGraveOoze,true),
    turnPhase('plane-hazards',planeTick,true),turnPhase('plane-creatures',planeCreaturesTick,true),turnPhase('shock-clouds',turnShockClouds,true),turnPhase('cave-spores',turnCaveSpores,true),turnPhase('eel-placement',eelPlacement,true),turnPhase('maw',mawTick,true),
    turnPhase('vegetation',vegRegrowTick,true),turnPhase('food-regeneration',turnFoodRecovery,true),turnPhase('lava-at-enemies',turnDeepLavaEnemies,true),turnPhase('cocoon-hatching',deepHatchTick,true),turnPhase('matron-venom',matronVenomTick,true),turnPhase('elemental-plane-weather',fwaTick,true),turnPhase('lich-return',turnLichReturn,true)
  ],
  finalize:[turnPhase('finalize-action',turnFinalizeAction)]
});
function endTurn(){
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
function worldAdvance(from,to){return gameTurns.advance(from,to);}
function worldRunActors(from,to){return gameTurns.schedule(from,to);}
