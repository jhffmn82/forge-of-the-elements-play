/* One documented order for floor construction. DEEP_GEN covers the layout and
 * its dressing passes, then clears before regional monster replacements. */
var floorGeneration=FoteGeneration.create({
  begin:function(){DEEP_GEN=true;},
  end:function(){DEEP_GEN=false;},
  clock:function(){return player&&Number.isFinite(player.t)?player.t:0;},
  attempt:function(seed){return generateOnce(seed);},
  commit:commitGeneratedFloor,
  layoutStages:[
    {name:'surface-cache',run:resetGeneratedSurface},
    {name:'trinket-plan',run:placeGeneratedTrinkets},
    {name:'elemental-ground',run:resetGeneratedElementalGround},
    {name:'puzzle-rooms',run:buildGeneratedPuzzles},
    {name:'object-prop-cleanup',run:clearGeneratedObjectProps},
    {name:'crypt-hall',run:clearGeneratedCryptHall},
    {name:'crypt-ooze',run:buildGeneratedCryptOoze},
    {name:'crypt-wall-vegetation',run:growGeneratedCryptWalls},
    {name:'crypt-paths',run:openGeneratedCryptPaths},
    {name:'portal-placement',run:placeGeneratedPortal},
    {name:'ranged-gear-migration',run:migrateGeneratedRangedGear},
    {name:'cavern-terrain',run:finishGeneratedCaverns},
    {name:'cavern-eels',run:placeGeneratedCavernEels},
    {name:'cavern-clusters',run:trimGeneratedCavernClusters},
    {name:'cavern-prop-clearance',run:clearGeneratedCavernProps},
    {name:'crypt-prop-placement',run:placeGeneratedCryptProps},
    {name:'floor-vegetation',run:growGeneratedVegetation},
    {name:'vegetation-memory',run:rememberGeneratedVegetation},
    {name:'lighting-rules',run:lightGeneratedFloor},
    {name:'deep-regions',run:finishGeneratedDeep}
  ],
  finishStages:[
    {name:'deep-monster-regions',run:regionalizeGeneratedDeep},
    {name:'deep-portal-reachability',run:repairGeneratedDeepPortal},
    {name:'concealment-reset',run:resetGeneratedConcealment},
    {name:'wall-memorials',run:repairGeneratedMemorials},
    {name:'biome-balance',run:balanceGeneratedEnemies}
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
  if(typeof FoteChaosCampaign!=='undefined'&&FoteChaosCampaign.handles(floorNo))return FoteChaosCampaign.build(floorNo,seed);
  resetMapDimensions();return floorGeneration.generate(seed);
}
