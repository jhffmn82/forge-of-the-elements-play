/* Public travel actions use one floor store and one explicit entry pipeline. */
function stashFloor(){
  if(!RUN)return;
  if(typeof FoteChaosCampaign!=='undefined'&&FoteChaosCampaign.stashEntry())return;
  (RUN.floorStash||(RUN.floorStash={}))[floorNo]=FoteTransitions.capture(gameState);
}
function restoreFloor(n,arrival){
  var saved=RUN&&RUN.floorStash&&RUN.floorStash[n];if(!saved)return false;
  FoteTransitions.restore(gameState,saved,n);delete RUN.floorStash[n];
  removeBossFloorForges();
  if(typeof FoteChaosCampaign!=='undefined')FoteChaosCampaign.restore();
  if(typeof FoteEnemyFields!=='undefined')FoteEnemyFields.restore();
  presentRestoredFloor(arrival);return true;
}
function randomPitArrival(){
  var reachable=bfsFrom(player.x,player.y),cells=[];
  for(var y=0;y<MH;y++)for(var x=0;x<MW;x++){
    var r=roomAt(x,y),i=idxOf(x,y);
    if(reachable[i]>=0&&freeCell(x,y)&&walkable(x,y)&&r&&!r.special&&!r.pocket&&r.role!=='boss'&&!fireT[i]&&!cloudAt(i))cells.push({x:x,y:y});
  }
  var spot=pick(cells);if(!spot)return;
  player.x=spot.x;player.y=spot.y;player._lx=undefined;player._ly=undefined;
  computeFOV();updateUI();draw();
}
function descend(fell,randomArrival){
  if(typeof FoteChaosCampaign!=='undefined'&&FoteChaosCampaign.descend(fell)){if(randomArrival){randomPitArrival();if(RUN&&!RUN.over)writeSlot('auto','floor '+floorNo);}return;}
  var sourceFloor=floorNo;
  if(floorMeta&&floorMeta.plane){
    log('There are no stairs in '+PLANE_TITLE[floorMeta.plane]+'. The portal is the way home.','c-info');
  }else if(!RUN||floorNo>=LAST_FLOOR&&!(RUN.floorStash&&RUN.floorStash[floorNo+1])){
    generateNextFloor(fell);
  }else{
    var target=floorNo+1,saved=RUN.floorStash&&RUN.floorStash[target];
    if(saved){
      stashFloor();
      if(!fell)sfx('stairs');player.levitate=0;
      restoreFloor(target,saved.floorMeta&&saved.floorMeta.upAt);
      log((floorMeta.chaosCampaign?'The current carries you back to ':'You climb back down to ')+'<b>floor '+floorNo+'</b>. It is as you left it.','c-kill');playSceneMusic();
    }else{
      try{generationTransaction(function(){stashFloor();generateNextFloor(fell);placeArrivalStairs();});}
      catch(error){if(!error||error.code!=='GENERATION_PRESENTATION_FAILED')log('The next floor could not be prepared. You remain on floor '+floorNo+'. Try the stairs again.','c-info');throw error;}
    }
  }
  if(randomArrival&&floorNo!==sourceFloor)randomPitArrival();
  if(RUN&&!RUN.over)writeSlot('auto','floor '+floorNo);
}
function ascend(){
  if(at(player.x,player.y)!==UPSTAIRS&&!(typeof FoteChaosCampaign!=='undefined'&&FoteChaosCampaign.materialPortalInfo(player.x,player.y))){log('No stairs up here.','c-info');return;}
  if(typeof FoteChaosCampaign!=='undefined'&&FoteChaosCampaign.ascend())return;
  if(!RUN.floorStash||!RUN.floorStash[floorNo-1]){log('The way up has collapsed.','c-info');return;}
  stashFloor();sfx('stairs');player.levitate=0;
  var target=floorNo-1,saved=RUN.floorStash[target],arrival=findTileIn(saved,STAIRS)||findTileIn(saved,EXIT);
  restoreFloor(target,arrival);
  log((floorMeta.chaosCampaign?'The current carries you back to ':'You climb back up to ')+'<b>floor '+floorNo+'</b>. It is as you left it.','c-kill');
  if(floorMeta.forge)log('The Elemental Forge still burns on this floor.','c-info');
  playSceneMusic();if(!RUN.over)writeSlot('auto','floor '+floorNo);
}
function enterPlane(el){
  if(!el||!PLANE_ROSTER[el]){log('The portal flickers and will not hold. Nothing lies beyond it yet.','c-info');sfx('ui-error');return false;}
  try{return generationTransaction(function(){return enterPlaneCandidate(el);});}
  catch(error){if(!error||error.code!=='GENERATION_PRESENTATION_FAILED')log('The plane could not be prepared. You remain on floor '+floorNo+'. Try the portal again.','c-info');throw error;}
}
function enterPlaneCandidate(el){
  afterGeneratedInstall(function(){if(typeof closeModal==='function'&&modalOpen)closeModal();});
  var from={x:player.x,y:player.y};floorMeta.portalUsed=true;stashFloor();
  RUN.planeStash=RUN.floorStash[floorNo];delete RUN.floorStash[floorNo];
  RUN.planeFrom=from;RUN.planesVisited=(RUN.planesVisited||[]).concat([el]);
  buildPlaneFloor(el,(worldSeed^0x7A11E5^floorNo*131)>>>0);
  afterGeneratedInstall(function(){sfx('stairs');SHAKE=6;log('You step through the portal into <b>'+PLANE_TITLE[el]+'</b>.','c-kill');log(PLANE_HAZARD_TEXT[el],'c-info');writeSlot('auto','plane');});
}
function leavePlane(){
  var saved=RUN.planeStash;if(!saved){log('The portal flickers but nothing happens.','c-info');return;}
  (RUN.floorStash||(RUN.floorStash={}))[floorNo]=saved;RUN.planeStash=null;
  restoreFloor(floorNo,RUN.planeFrom);floorMeta.portalUsed=true;
  log('You step back into the '+biomeName()+'. Behind you the portal gutters and goes dark.','c-kill');playSceneMusic();writeSlot('auto','floor '+floorNo);
}

function buildPlaneFloor(element,seed){
  return generationTransaction(function(){
    resetMapDimensions();generatePlaneBase(element,seed);
    clearBuiltPlaneProps(element,seed);dressPlaneClusters(element,seed);dressElementalPlane(element,seed);
    FoteShadowClone.arrive();arriveRarePet();afterGeneratedInstall(presentGeneratedPlane);
  });
}

/* Entry order is gameplay: collection precedes traps and prompts. An entry
 * handler returns true only when it has completed or interrupted the step. */
function stepOn(){
  var hpBefore=player.hp;
  FoteEnemyFields.enter(player);FoteSporecaller.trample(player);
  if(player.hp<=0)return;
  if(entryCollectCores()===true||entryCollectGlobes()===true||entryScaleEssence()===true)return;
  if(entryItemsAndTerrain()===true||entryUpstairsHint()===true||entryPortalPrompt()===true)return;
  if(player.hp>hpBefore)deepStanch(player);
}
function tryMove(dx,dy){
  if(gameTurns.busy()||playerFearAction()||!player||player.hp<=0||RUN.victory)return;
  // Bumps turn too, including terrain actions that finish before movement.
  var face=faceOf(dx,dy);if(face)player.face=face;
  if(floorMeta&&floorMeta.impassableVoid&&at(player.x+dx,player.y+dy)===CHASM){log('The void cannot be crossed. Use a bridge or portal.','c-info');return;}
  if(movePlaneTerrain(dx,dy)===true||moveDeepTerrain(dx,dy)===true||moveReachAttack(dx,dy)===true||
    moveCorpse(dx,dy)===true||moveCoreGate(dx,dy)===true)return;
  var puzzleEntry=!!(player&&player.hp>0);
  if(movePuzzleGate(dx,dy)===true)return;
  var x=player.x,y=player.y;performPlayerMove(dx,dy);
  if(!puzzleEntry)return;
  if(player.windCarry&&at(player.x,player.y)!==CHASM)player.windCarry=false;
  // Puzzle water damage historically follows the movement's elapsed turn.
  if(player.x!==x||player.y!==y)afterTurn(enterTile);
}
