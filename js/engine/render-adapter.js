/* Explicit presentation composition. Content passes retain their existing art
 * and geometry; this module owns their order, selection, and canvas scopes. */
function renderPass(name,run,when){return {name:name,run:run,when:when};}
var renderProp=FoteRendering.dispatch([
  renderPass('elemental-plane',drawElementPlaneProp),renderPass('underdark',drawUnderdarkProp),
  renderPass('bush',drawBushProp),renderPass('earth-plants',drawEarthPlantProp),renderPass('packed-props',drawPackedProp),
  renderPass('wide-cavern-props',drawWideCaveProp),renderPass('glowing-pool',drawGlowingPoolProp),renderPass('cavern-props',drawCaveProp),
  renderPass('natural-outcrops',drawNaturalOutcropProp),renderPass('rune-stones',drawRuneStoneProp),renderPass('sun-dais',drawSunDaisProp),
  renderPass('straw',drawStrawProp),renderPass('chains',drawChainProp),renderPass('crypt-stone',drawCryptStoneProp),
  renderPass('urn-groups',drawUrnGroupProp),renderPass('crypt-rooms',drawCryptRoomProp),renderPass('crypt-wall-plants',drawCryptWallPlantProp),
  renderPass('stone-and-crypt-set',drawSetProp)
]);
var renderSurface=FoteRendering.sequence([
  renderPass('stone',drawStoneSurface,function(){return !inCaverns()&&!ptMat();}),
  renderPass('grass-bed',drawGrassBed,function(){return !inCaverns()&&!ptMat();}),
  renderPass('crypt-moss',drawCryptMoss,function(){return !inCaverns()&&!ptMat();}),
  renderPass('pool-bubbles',ptPoolBubbles,function(){return !inCaverns();}),
  renderPass('caverns',drawCavernSurface),renderPass('chasm-edges',drawBiomeChasmSurface),renderPass('maw-skirts',drawMawSkirts),
  renderPass('vegetation',drawVegetationSurface),renderPass('underdark',drawUnderdarkSurface),renderPass('elemental-plane',drawElementPlaneSurface),
  renderPass('sanctuary',drawSanctuarySurface),renderPass('last-cast',drawLastCastSurface)
]);
var renderTelegraphs=FoteRendering.sequence([
  renderPass('crypt-floor-stains',drawCryptFloorStains),renderPass('boss-windups',drawBossTelegraphs),renderPass('smoke',drawSmokeTelegraphs),
  renderPass('element-ground',drawElementGroundTelegraphs),renderPass('crypt-clouds-and-marks',drawCryptTelegraphs),renderPass('corpses',drawCorpseTelegraphs),
  renderPass('portal',drawPortalTelegraphs),renderPass('vein-glints',drawVeinGlints),renderPass('crystal-face-glints',drawCrystalFaceGlints),
  renderPass('shock-clouds',drawShockCloudTelegraphs),renderPass('darkness',drawDarknessTelegraphs)
]);
var renderLightSources=FoteRendering.sequence([
  renderPass('sigils',addSigilLights),renderPass('crypt',addCryptLights),renderPass('crypt-mushrooms',addCryptMushroomLights),
  renderPass('crypt-rooms',addCryptRoomLights),renderPass('upstairs',addUpstairsLights),renderPass('portal-and-plane',addPortalLights),
  renderPass('natural-terrain',addNaturalTerrainLights),renderPass('cavern-strength',shadeCavernLights),
  renderPass('stormward',addStormwardLight),renderPass('underdark-strength-and-lava',addUnderdarkLights)
]);
function drawPropSurface(p,x,y,alpha){return renderProp(p,x,y,alpha);}
function drawSurfaceDeco(){renderSurface();}
function drawTelegraphs(now){renderTelegraphs(now);}
function gatherLights(now,position){var lights=gatherBaseLights(now,position);renderLightSources(lights,now,position);return lights;}

/* Atlas selection is ordered explicitly. Shrine fallback can re-enter objArt
 * through packedSetArt, so only the shrine redirect has a bounded guard. */
var renderShrineLookup=false;
function objArt(group,name){
  var art=null;
  if(!renderShrineLookup&&typeof name==='string'&&name.indexOf('shrine-')===0){
    renderShrineLookup=true;try{art=setArt(name);}finally{renderShrineLookup=false;}
  }
  if(!art){
    art=runeObjectArt(group,name)||packedObjectArt(group,name);
    art=tintCryptObject(art,group,name);art=weatherDungeonObject(art,group,name);art=tintPlaneObject(art,group,name);
  }
  if(art)art.nm=name;
  return art;
}
function setArt(name){
  var art=(PACK_CRYPT[name]||PACK_PLANE[name])?packArt(name):null;
  if(art)return art;
  art=gradeCryptSet(packedSetArt(name),name);art=tintCryptSet(art,name);
  return art||caveArt(name)||deepArt(name);
}
function caveArt(name){var art=packedCaveArt(name);if(art)art.nm=name;return art;}
function drawObj(art,x,y,options){var drawn=drawObjectSprite(art,x,y,options);if(drawn)drawObjectAnimation(art,x,y,options);return drawn;}
function drawCaveArt(art,center,bottom,alpha,flip){
  var adjusted=bottom,opacity=alpha;
  if(art&&art.nm&&art.nm!=='kobold-crate'&&CAVE_STANDING.test(art.nm))adjusted+=caveBottomPad(art)*caveArtScale(art);
  if(art&&art.nm&&/^cl-cave-pearls/.test(art.nm))opacity*=.3;
  var result=drawCaveSprite(art,center,adjusted,opacity,flip);drawCaveAnimation(art,center,bottom,alpha,flip);return result;
}
function floorTile(x,y){
  if(inDeep()&&floorMeta.deepRegion){var raster=deepRasterTile(x,y);DEEP_RC=!!raster;DEEP_AT=deepCellReg(x,y);if(raster)return raster;}
  else {DEEP_RC=false;DEEP_AT=-1;}
  return ptMat()?(ptTile(x,y)||{flat:ptFlat(x,y)}):masonryFloorTile(x,y);
}
function wallTile(x,y){
  if(inDeep()&&floorMeta.deepRegion){
    var raster=deepRasterTile(x,y);DEEP_AT=deepCellReg(x,y);DEEP_RC=!!raster&&!deepBuiltWall(x,y);if(raster)return raster;
    if(DEEP_STYLE[DEEP_AT]!=='rect'){var top=surfImg('top');if(top)return {img:top,sx:smod(x+surfOff(3))*64,sy:smod(y+surfOff(4))*64,sw:64,sh:64,deepDim:wallFaces(x,y)?.5:1-DEEP_TOP_DIM};}
  }else {DEEP_RC=false;DEEP_AT=-1;}
  return ptMat()?(ptTile(x,y)||{flat:ptFlat(x,y)}):masonryWallTile(x,y);
}
function tileSprite(x,y,tile){
  if(tile===EXIT&&floorMeta&&floorMeta.caveExit){var caveExit=caveArt('worm-burrow-open');if(caveExit)return caveExit;}
  if(tile===PORTAL)return objArt('structures','portal-arch');
  if(tile===UPSTAIRS)return objArt('structures','stairs-up')||objArt('structures','stairs-down');
  if(inCrypt()&&tile===DOOR){var door=setArtAsObj('crypt-door');if(door)return door;}
  return baseTileSprite(x,y,tile);
}
function blitTile(art,x,y,alpha){
  var drawn;
  if(art&&art.flat){ctx.globalAlpha=alpha;ctx.fillStyle=art.flat;var fx=Math.round(x),fy=Math.round(y);ctx.fillRect(fx,fy,Math.round(x+TS)-fx,Math.round(y+TS)-fy);drawn=true;}
  else if(art&&art.crisp){ctx.globalAlpha=alpha;ctx.imageSmoothingEnabled=false;var cx=Math.round(x),cy=Math.round(y);ctx.drawImage(art.img,art.sx,art.sy,art.sw,art.sh,cx,cy,Math.round(x+TS)-cx,Math.round(y+TS)-cy);drawn=true;}
  else drawn=blitSpriteTile(art,x,y,alpha);
  if(art&&art.deepDim){ctx.globalAlpha=alpha*art.deepDim;ctx.fillStyle='#000';ctx.fillRect(x,y,TS+.6,TS+.6);ctx.globalAlpha=alpha;}
  return drawn;
}
function drawWallEdges(x,y,tile,px,py,alpha){
  var keep=DEEP_AT;if(inDeep()&&floorMeta.deepRegion)DEEP_AT=deepCellReg(x,y);
  try{if(!ptMat())return drawMasonryWallEdges(x,y,tile,px,py,alpha);}finally{DEEP_AT=keep;}
}
function drawDeco(piece,x,y,alpha,options){
  var keep=DEEP_AT;
  if(inDeep()&&floorMeta.deepRegion)DEEP_AT=deepCellReg(Math.floor(x/TS+.5)+camX,Math.floor(y/TS+.5)+camY);
  try{
    if(piece===DECO.drain&&(cryptRoomsOn()||(inDeep()&&floorMeta.deepRegion&&DEEP_AT!==0)))return;
    return drawSurfaceDecal(piece,x,y,alpha,options);
  }finally{DEEP_AT=keep;}
}
function wallTorchAt(x,y){return masonryTorchAt(x,y)&&(!inDeep()||!floorMeta.deepRegion||(deepCellReg(x,y)!==1&&!deepIsRaster(x,y)));}
function drawWangLayer(key,tile){
  DEEP_RC=false;DEEP_AT=-1;
  var suppressed=key==='water'&&ptMat()||key==='chasm'&&(inCaverns()||biomeChasmsOn());
  var result;
  if(!suppressed){if(key==='water'&&surfImg('floor'))result=drawSurfaceWater(key,tile);else result=drawAtlasWangLayer(key,tile);}
  if(key==='chasm'&&inDeep())drawDeepLava(performance.now());
  return result;
}
var renderGroundDecal=FoteRendering.dispatch([
  renderPass('vegetation',drawVegetationGroundDecal),renderPass('crypt-mushrooms',drawMushroomGroundDecal),
  renderPass('stone',drawStoneGroundDecal),renderPass('ordinary-ground',drawBaseGroundDecal)
]);
function drawGroundDecal(kind,x,y,px,py,alpha,now){return renderGroundDecal(kind,x,y,px,py,alpha,now);}
function drawGrassTile(x,y,px,py,alpha,layer,now){
  var vegetation=vegSet();
  if(vegetation&&vegetation!=='crypt')return drawVegetationGrass(x,y,px,py,alpha,layer,now);
  if(ptMat())return drawNaturalGrass(x,y,px,py,alpha,layer,now);
  if(cryptShrooms())return drawMushroomGrass(x,y,px,py,alpha,layer,now);
  return drawOrdinaryGrass(x,y,px,py,alpha,layer,now);
}
function drawVegSpots(now){return inDeep()?drawUnderdarkPlants(now):drawOrdinaryPlants(now);}
function drawAutomap(){var result=drawBaseAutomap();drawAutomapLava();return result;}
function drawSideDoor(x,y,tile,px,py,alpha){
  if(drawUnderdarkDoor(x,y,tile,px,py,alpha))return true;
  if(tile===BRIDGE&&inCaverns()){drawCaveBridge(x,y,px,py,alpha);return true;}
  return drawMasonryDoor(x,y,tile,px,py,alpha);
}

var renderActor=FoteRendering.layered([
  {name:'underdark-pose',enter:prepareUnderdarkActor},
  {name:'maw-and-eels',enter:prepareMawActor,paint:drawCavernActor},
  {name:'large-creature',paint:function(job){return drawLargeCreature(job.entity,job.x,job.y,job.options)?true:undefined;}},
  {name:'natural-terrain-outline',enter:prepareNaturalActor},
  {name:'moonbound-overlay',enter:prepareMoonboundActor},
  {name:'plane-visibility',paint:hidePlaneActor},
  {name:'mountain-heart-pose',enter:prepareMountainHeartActor},
  {name:'crypt-outline',enter:prepareCryptActor},
  {name:'character-sprite',paint:function(job){return drawCharacterSprite(job.entity,job.x,job.y,job.options);}}
]);
function drawCharacter(entity,x,y,options){return renderActor({entity:entity,x:x,y:y,options:options});}

function drawFramePasses(){
  if(DC&&DEEP_RAF===null)DC.built=document.body.classList.contains('touch')?DEEP_BUDGET-8:0;
  try{
    speedFxList();PT_CACHE.built=0;
    var restoreVisibility=prepareShadeVisibility();
    try{drawScene();}finally{restoreVisibility();}
    if(AUTOMAP_ON)drawAutomap();
    if(ptMat()&&PT_CACHE.built>=PT_BUDGET)requestAnimationFrame(function(){draw();});
    drawBowAimOverlay();drawAutoAimOverlay();
  }finally{DEEP_RC=false;DEEP_AT=-1;}
  if(inDeep()&&DC.built>=DEEP_BUDGET&&DEEP_RAF===null)DEEP_RAF=requestAnimationFrame(function(){DEEP_RAF=null;draw();});
}
var renderPreviousMap=null,renderPreviousMeta=null;
function draw(){
  var shake=SHAKE>0.5&&!ANIM.reduce;
  if(shake){ctx.save();ctx.translate((Math.random()-.5)*SHAKE,(Math.random()-.5)*SHAKE);}else SHAKE=0;
  try{
    var changed=renderPreviousMap!==map||renderPreviousMeta!==floorMeta;
    drawFramePasses();
    if(changed){
      var ptBudget=PT_BUDGET,deepBudget=DEEP_BUDGET;
      try{
        PT_BUDGET=DEEP_BUDGET=1000000;PT_CACHE.built=0;DC.built=0;
        for(var y=camY;y<=camY+viewH;y++)for(var x=camX;x<=camX+viewW;x++){
          if(!inb(x,y)||!(revealAll||seen[idxOf(x,y)]||vis[idxOf(x,y)]))continue;
          if(isWallLike(at(x,y)))wallTile(x,y);else floorTile(x,y);
        }
        DEEP_RC=false;DEEP_AT=-1;renderPreviousMap=map;renderPreviousMeta=floorMeta;drawFramePasses();
      }finally{PT_BUDGET=ptBudget;DEEP_BUDGET=deepBudget;}
    }
  }finally{if(shake){ctx.restore();SHAKE*=.86;}}
}
