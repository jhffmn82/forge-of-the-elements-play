/* Public travel actions use one floor store and one explicit entry pipeline. */
function stashFloor(){
  if(!RUN)return;
  (RUN.floorStash||(RUN.floorStash={}))[floorNo]=FoteTransitions.capture(gameState);
}
function restoreFloor(n,arrival){
  var saved=RUN&&RUN.floorStash&&RUN.floorStash[n];if(!saved)return false;
  FoteTransitions.restore(gameState,saved,n);delete RUN.floorStash[n];
  presentRestoredFloor(arrival);return true;
}
function descend(fell){
  if(floorMeta&&floorMeta.plane){
    log('There are no stairs in '+PLANE_TITLE[floorMeta.plane]+'. The portal is the way home.','c-info');
  }else if(!RUN||floorNo>=LAST_FLOOR&&!(RUN.floorStash&&RUN.floorStash[floorNo+1])){
    generateNextFloor(fell);
  }else{
    var target=floorNo+1,saved=RUN.floorStash&&RUN.floorStash[target];
    stashFloor();
    if(saved){
      if(!fell)sfx('stairs');player.levitate=0;
      restoreFloor(target,saved.floorMeta&&saved.floorMeta.upAt);
      log('You climb back down to <b>floor '+floorNo+'</b>. It is as you left it.','c-kill');playSceneMusic();
    }else{generateNextFloor(fell);placeArrivalStairs();}
  }
  if(RUN&&!RUN.over)writeSlot('auto','floor '+floorNo);
}
function ascend(){
  if(at(player.x,player.y)!==UPSTAIRS){log('No stairs up here.','c-info');return;}
  if(!RUN.floorStash||!RUN.floorStash[floorNo-1]){log('The way up has collapsed.','c-info');return;}
  stashFloor();sfx('stairs');player.levitate=0;
  var target=floorNo-1,saved=RUN.floorStash[target],arrival=findTileIn(saved,STAIRS)||findTileIn(saved,EXIT);
  restoreFloor(target,arrival);
  log('You climb back up to <b>floor '+floorNo+'</b>. It is as you left it.','c-kill');
  if(floorMeta.forge)log('The Elemental Forge still burns on this floor.','c-info');
  playSceneMusic();if(!RUN.over)writeSlot('auto','floor '+floorNo);
}
function enterPlane(el){
  if(!el||!PLANE_ROSTER[el]){log('The portal flickers and will not hold. Nothing lies beyond it yet.','c-info');sfx('ui-error');return false;}
  closeModal&&modalOpen&&closeModal();
  var from={x:player.x,y:player.y};floorMeta.portalUsed=true;stashFloor();
  RUN.planeStash=RUN.floorStash[floorNo];delete RUN.floorStash[floorNo];
  RUN.planeFrom=from;RUN.planesVisited=(RUN.planesVisited||[]).concat([el]);
  buildPlaneFloor(el,(worldSeed^0x7A11E5^floorNo*131)>>>0);
  sfx('stairs');SHAKE=6;log('You step through the portal into <b>'+PLANE_TITLE[el]+'</b>.','c-kill');log(PLANE_HAZARD_TEXT[el],'c-info');
  writeSlot('auto','plane');
}
function leavePlane(){
  var saved=RUN.planeStash;if(!saved){log('The portal flickers but nothing happens.','c-info');return;}
  (RUN.floorStash||(RUN.floorStash={}))[floorNo]=saved;RUN.planeStash=null;
  restoreFloor(floorNo,RUN.planeFrom);floorMeta.portalUsed=true;
  log('You step back into the '+biomeName()+'. Behind you the portal gutters and goes dark.','c-kill');playSceneMusic();writeSlot('auto','floor '+floorNo);
}

var planeGeneration=FoteTransitions.stages([
  {name:'plane-layout-and-actors',run:function(c){generatePlaneBase(c.element,c.seed);}},
  {name:'plane-prop-clearance',run:function(c){clearBuiltPlaneProps(c.element,c.seed);}},
  {name:'plane-clusters',run:function(c){dressPlaneClusters(c.element,c.seed);}},
  {name:'elemental-plane-hazards',run:function(c){dressElementalPlane(c.element,c.seed);}}
]);
function buildPlaneFloor(element,seed){planeGeneration.run({element:element,seed:seed});}

var tileEntry=FoteTransitions.stages([
  {name:'collect-core',run:entryCollectCores},
  {name:'collect-globes',run:entryCollectGlobes},
  {name:'scale-essence',run:entryScaleEssence},
  {name:'items-traps-plates-and-exits',run:entryItemsAndTerrain},
  {name:'upstairs-hint',run:entryUpstairsHint},
  {name:'portal-prompt',run:entryPortalPrompt},
  {name:'healing-stanches-bleed',run:function(c){if(player.hp>c.hpBefore)deepStanch(player);}}
]);
function stepOn(){tileEntry.run({hpBefore:player.hp});}

var movementEntry=FoteTransitions.stages([
  {name:'plane-terrain',run:function(c){return movePlaneTerrain(c.dx,c.dy);}},
  {name:'deep-terrain',run:function(c){return moveDeepTerrain(c.dx,c.dy);}},
  {name:'reach-attack',run:function(c){return moveReachAttack(c.dx,c.dy);}},
  {name:'corpse-bump',run:function(c){return moveCorpse(c.dx,c.dy);}},
  {name:'core-gate',run:function(c){return moveCoreGate(c.dx,c.dy);}},
  {name:'puzzle-bump',run:function(c){c.puzzleEntry=!!(player&&player.hp>0);return movePuzzleGate(c.dx,c.dy);}},
  {name:'move-or-interact',run:function(c){
    var x=player.x,y=player.y;performPlayerMove(c.dx,c.dy);
    if(!c.puzzleEntry)return;
    if(player.windCarry&&at(player.x,player.y)!==CHASM)player.windCarry=false;
    // Puzzle water damage historically follows the movement's elapsed turn.
    if(player.x!==x||player.y!==y)afterTurn(enterTile);
  }}
]);
function tryMove(dx,dy){if(!gameTurns.busy())movementEntry.run({dx:dx,dy:dy});}
