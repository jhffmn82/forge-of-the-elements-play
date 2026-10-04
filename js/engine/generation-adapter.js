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
  return FoteGeneration.transaction({state:gameState,shared:[EMPTY_OFF],getRandom:function(){return rng;},setRandom:function(value){rng=value;},
    forkRandom:function(value){if(!value||typeof value.state!=='function')throw new Error('Floor generation requires a replayable random stream.');return mulberry32(value.state());},
    validate:function(candidate){
      FoteGeneration.validateFloor(candidate,function(value){return gameState.dimensions(value);});
      if(!walkable(player.x,player.y))throw new Error('Generated floor has an impassable player arrival.');
      var report=inspectGeneratedFloor();FoteGeneration.validateRequiredRoutes(report.targets);afterGeneratedInstall(function(){LAST_GENERATION_REPORT=report;});
    }},build);
}
function generationDomains(){
  return {context:{width:MW,height:MH,floor:floorNo,seed:worldSeed,turn:turn,arrivalX:player.x,arrivalY:player.y,clock:player.t},heroRef:player,hero:player,
    terrain:map,props:props,propGrid:propGrid,ground:ground,fields:{fireT:fireT,fireSrc:fireSrc,iceG:iceG,rootG:rootG,holyG:holyG},
    perception:{seen:seen,vis:vis,raw:DEEP_RAWVIS,blind:BLIND_RAWVIS},schedule:{nextSpawn:nextSpawn,spawnedExtra:spawnedExtra,nextId:nextId},
    fixtures:{chestKind:chestKind,levers:levers,plates:plates,altars:altars},
    floor:floorMeta,rooms:rooms,loot:items,actors:ents,feats:feats,run:RUN};
}
function validateGeneratedMeals(added){
  var reach=bfsFrom(player.x,player.y);
  added.loot.forEach(function(it){
    if(it.kind!=='food'||!inb(it.x,it.y)||!walkable(it.x,it.y)||reach[idxOf(it.x,it.y)]<0)throw new Error('Generated guaranteed meal is not reachable.');
  });
}
var floorGeneration=FoteGeneration.create({
  // Every retained stage declares its actual mutations, including native
  // helper writes and the carried hero alias inside the actor graph. An
  // omitted declaration has no write permission. Destination/clock and the
  // carried hero reference remain protected throughout construction.
  ownership:{read:generationDomains,defaultWrites:[],
    identities:['hero','terrain','props','propGrid','ground','floor','rooms','loot','actors','feats','run'],referenceOnly:['heroRef']},
  begin:function(){DEEP_GEN=true;},
  end:function(){DEEP_GEN=false;},
  clock:function(){return player&&Number.isFinite(player.t)?player.t:0;},
  attempt:function(seed){return generateOnce(seed);},
  commit:commitGeneratedFloor,
  layoutStages:[
    {name:'surface-cache',run:resetGeneratedSurface,writes:[]},
    {name:'trinket-plan',run:placeGeneratedTrinkets,writes:['run','loot']},
    {name:'elemental-ground',run:resetGeneratedElementalGround,writes:['fields','floor']},
    {name:'puzzle-rooms',run:buildGeneratedPuzzles,writes:['terrain','props','propGrid','ground','fields','floor','rooms','loot','actors','feats','fixtures','schedule','run']},
    {name:'object-prop-cleanup',run:clearGeneratedObjectProps,writes:['props','propGrid']},
    {name:'crypt-hall',run:clearGeneratedCryptHall,writes:['feats','loot','terrain','fixtures','ground']},
    {name:'crypt-ooze',run:buildGeneratedCryptOoze,writes:['terrain','ground','floor']},
    {name:'crypt-wall-vegetation',run:growGeneratedCryptWalls,writes:['props','propGrid']},
    {name:'portal-placement',run:placeGeneratedPortal,writes:['terrain','props','floor','rooms']},
    {name:'ranged-gear-migration',run:migrateGeneratedRangedGear,writes:['hero','actors','schedule','floor']},
    {name:'cavern-terrain',run:finishGeneratedCaverns,writes:['ground','floor']},
    {name:'cavern-eels',run:placeGeneratedCavernEels,writes:['floor','actors','schedule']},
    {name:'cavern-clusters',run:trimGeneratedCavernClusters,writes:['props','propGrid']},
    {name:'cavern-prop-clearance',run:clearGeneratedCavernProps,writes:['props','propGrid','floor']},
    {name:'crypt-prop-placement',run:placeGeneratedCryptProps,writes:['props','propGrid','floor','loot']},
    {name:'floor-vegetation',run:growGeneratedVegetation,writes:['ground','rooms','props','propGrid','floor']},
    {name:'vegetation-memory',run:rememberGeneratedVegetation,writes:['floor']},
    {name:'lighting-rules',run:lightGeneratedFloor,writes:['props','propGrid','floor']},
    {name:'deep-regions',run:finishGeneratedDeep,writes:['terrain','ground','rooms','props','propGrid','floor','feats']},
    {name:'crypt-paths',run:openGeneratedCryptPaths,writes:['props','propGrid','loot']}
  ],
  finishStages:[
    {name:'deep-monster-regions',run:regionalizeGeneratedDeep,writes:['actors','schedule','floor']},
    {name:'deep-portal-reachability',run:repairGeneratedDeepPortal,writes:['terrain','props','floor','rooms']},
    {name:'concealment-reset',run:resetGeneratedConcealment,writes:['hero','actors']},
    {name:'wall-memorials',run:repairGeneratedMemorials,writes:['props','propGrid','floor']},
    {name:'biome-balance',run:balanceGeneratedEnemies,writes:['actors']},
    {name:'stair-approach-traps',run:repairStairApproachTraps,writes:['feats']},
    {name:'secret-floor-hints',run:function(){if(typeof repairRareRoomHints==='function')repairRareRoomHints();},writes:['ground']},
    {name:'rare-companion-arrival',run:function(){if(typeof arriveRarePet==='function')arriveRarePet();},writes:['actors','run']},
    {name:'floor-food',run:placeGeneratedFood,writes:['loot'],appends:{loot:{min:1,max:2}},validate:validateGeneratedMeals}
  ]
});
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
    resetMapDimensions();return floorGeneration.generate(seed);
  });
}
