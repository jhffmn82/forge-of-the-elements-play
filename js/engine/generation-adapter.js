/* One documented order for floor construction. DEEP_GEN covers the layout and
 * its dressing passes, then clears before regional monster replacements. */
var LAST_GENERATION_REPORT=null;
function afterGeneratedInstall(fn,key){FoteGeneration.afterInstall(gameState,fn,key);}
function generationRouteCell(x,y,tile){
  // deepCurtains deliberately closes a tunnel with a web that the ordinary
  // prop interaction cuts in one paid action. No other closed terrain is open.
  var p=propAt(x,y);
  return !!(p&&p.curtain&&p.br&&terrainRules.passable(tile,false,floorMeta.exitOpen));
}
function inspectGeneratedFloor(){
  // Required ordinary routes use the same cardinal door/chest traversal as
  // generateOnce. Treasure pockets and linked Chaos islands have other rules.
  var reach=typeof bfsFrom==='function'?bfsFrom(player.x,player.y,generationRouteCell):null,targets=[];
  function target(kind,point,required,tile){
    var valid=!!point&&inb(point.x,point.y),reachable=valid&&reach?reach[idxOf(point.x,point.y)]>=0:null;
    if(required&&(!valid||tile!==undefined&&at(point.x,point.y)!==tile))reachable=false;
    targets.push({kind:kind,x:valid?point.x:null,y:valid?point.y:null,tile:valid?at(point.x,point.y):null,required:!!required,reachable:reachable});
  }
  function approach(point){
    if(!point)return null;
    var candidates=[[0,1],[1,0],[-1,0],[0,-1]].map(function(d){return {x:point.x+d[0],y:point.y+d[1]};});
    return candidates.find(function(p){return inb(p.x,p.y)&&(walkable(p.x,p.y)||generationRouteCell(p.x,p.y,at(p.x,p.y)))&&reach&&reach[idxOf(p.x,p.y)]>=0;})||null;
  }
  var linked=!!(floorMeta.chaosCampaign||floorMeta.chaosEntryPreview),ordinary=!floorMeta.plane&&!linked,stairs=[];
  for(var i=0;i<map.length;i++)if([STAIRS,UPSTAIRS,EXIT,PORTAL].includes(map[i])){
    var point={x:i%MW,y:Math.floor(i/MW)};target('travel',point);if(map[i]===STAIRS)stairs.push(point);
  }
  if(ordinary){
    if(floorMeta.boss)target('boss approach',floorMeta.bossAt,true);
    else target('departure stairs',stairs.find(function(p){return reach&&reach[idxOf(p.x,p.y)]>=0;}),true,STAIRS);
    if(floorMeta.forgeAt){target('forge',floorMeta.forgeAt,false);target('forge approach',at(floorMeta.forgeAt.x,floorMeta.forgeAt.y)===FORGE&&approach(floorMeta.forgeAt),true);}
    if(floorMeta.shrineAt){target('shrine',floorMeta.shrineAt,false);target('shrine approach',at(floorMeta.shrineAt.x,floorMeta.shrineAt.y)===SHRINE&&approach(floorMeta.shrineAt),true);}
  }
  if(floorMeta.plane)target('return portal',floorMeta.portalAt,true,PORTAL);
  else if(ordinary&&floorMeta.portalAt)target('elemental portal',floorMeta.portalAt,true,PORTAL);
  items.filter(function(it){return it.kind==='food';}).forEach(function(it){target('food',it);});
  return {floor:floorNo,kind:floorMeta.chaosCampaign?'chaos':floorMeta.plane?'plane':'ordinary',targets:targets,
    policy:'structural, arrival, ordinary departure/boss/service routes and plane return enforced through open terrain, doors/chests and one-action cuttable web curtains; optional locked treasure, sealed boss exits and Chaos portal/phase routes observed'};
}
function generationTransaction(build){
  // Construction reads shrine/discovery history but never edits visited floors.
  // The stash container is still drafted, so adding the outgoing floor or
  // moving it to planeStash remains part of the transaction and can roll back.
  var retained=[EMPTY_OFF];
  if(RUN)retained=retained.concat(Object.values(RUN.floorStash||{}),RUN.planeStash,RUN.chaosEntryStash);
  return FoteGeneration.transaction({state:gameState,shared:retained,getRandom:function(){return rng;},setRandom:function(value){rng=value;},
    forkRandom:function(value){if(!value||typeof value.state!=='function')throw new Error('Floor generation requires a replayable random stream.');return mulberry32(value.state());},
    validate:function(candidate){
      FoteGeneration.validateFloor(candidate,function(value){return gameState.dimensions(value);});
      if(!walkable(player.x,player.y))throw new Error('Generated floor has an impassable player arrival.');
      var report=inspectGeneratedFloor();FoteGeneration.validateRequiredRoutes(report.targets);afterGeneratedInstall(function(){LAST_GENERATION_REPORT=report;});
    }},build);
}
function generateOrdinaryFloor(seed){
  // Builders share the transaction's candidate. Their order is part of map
  // generation; the finished floor is checked once before it becomes live.
  DEEP_GEN=true;
  try{
    var clock=player&&Number.isFinite(player.t)?player.t:0,accepted=false;
    for(var attempt=0;attempt<8;attempt++){
      if(generateOnce((seed+attempt*7919)>>>0)){
        commitGeneratedFloor(clock);
        accepted=true;
        break;
      }
    }
    if(!accepted)throw new Error('Floor generation exhausted all 8 layout attempts.');
    resetGeneratedSurface(seed);
    placeGeneratedTrinkets(seed);
    resetGeneratedElementalGround(seed);
    buildGeneratedPuzzles(seed);
    clearGeneratedObjectProps(seed);
    clearGeneratedCryptHall(seed);
    buildGeneratedCryptOoze(seed);
    cryptGrowWallVeg();
    placeGeneratedPortal(seed);
    finishGeneratedCaverns(seed);
    eelPlacement();
    trimGeneratedCavernClusters(seed);
    clearGeneratedCavernProps(seed);
    placeGeneratedCryptProps(seed);
    vegGrow();
    vegRemember();
    lightRulesPass();
    finishGeneratedDeep(seed);
    openGeneratedCryptPaths(seed);
  }finally{DEEP_GEN=false;}
  regionalizeGeneratedDeep(seed);
  repairGeneratedDeepPortal(seed);
  resetGeneratedConcealment(seed);
  repairWallMemorials();
  repairStairApproachTraps();
  repairRareRoomHints();
  arriveRarePet();
  // The food producer chooses reachable cells on this completed map.
  placeGeneratedFood();
}
// Dimension changes never allocate floor arrays. Builders install a new map
// immediately afterwards, which also invalidates map-identity render caches.
function setMapDimensions(width,height){
  var size=FoteState.dimensions({MW:width,MH:height});
  MW=size.width;MH=size.height;return size;
}
function resetMapDimensions(){return setMapDimensions(FoteState.defaultDimensions.width,FoteState.defaultDimensions.height);}
function generate(seed){
  return generationTransaction(function(){
    if(typeof FoteChaosCampaign!=='undefined'&&FoteChaosCampaign.handles(floorNo))return FoteChaosCampaign.build(floorNo,seed);
    resetMapDimensions();return generateOrdinaryFloor(seed);
  });
}
