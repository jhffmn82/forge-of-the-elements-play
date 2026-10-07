/* Explicit presentation composition. Content passes retain their existing art
 * and geometry; this module owns their order, selection, and canvas scopes. */
function renderPass(name,run,when){return {name:name,run:run,when:when};}
var renderProp=FoteRendering.dispatch([
  renderPass('elemental-plane',drawElementPlaneProp),renderPass('underdark',drawUnderdarkProp),
  renderPass('bush',drawBushProp),renderPass('earth-plants',drawEarthPlantProp),renderPass('packed-props',drawPackedProp),
  renderPass('wide-cavern-props',drawWideCaveProp),renderPass('glowing-pool',drawGlowingPoolProp),renderPass('cavern-props',drawCaveProp),
  renderPass('natural-outcrops',drawNaturalOutcropProp),renderPass('rune-stones',drawRuneStoneProp),renderPass('sun-dais',drawSunDaisProp),
  renderPass('crypt-stone',drawCryptStoneProp),
  renderPass('urn-groups',drawUrnGroupProp),renderPass('crypt-rooms',drawCryptRoomProp),renderPass('crypt-wall-plants',drawCryptWallPlantProp),
  renderPass('stone-and-crypt-set',drawSetProp)
]);
var SURFACE_PASSES=[
  renderPass('stone',drawStoneSurface,function(){return !inCaverns()&&!ptMat();}),
  renderPass('crypt-moss',drawCryptMoss,function(){return !inCaverns()&&!ptMat();}),
  // Grime and ooze are floor, under ground decals, traps and props (2026-09-27; they sat in the telegraph pass, over traps).
  renderPass('crypt-grime',function(){drawGrime();}),renderPass('crypt-ooze',function(){drawOoze(performance.now());}),
  renderPass('pool-bubbles',ptPoolBubbles,function(){return !inCaverns();}),
  renderPass('caverns',drawCavernSurface),renderPass('chasm-edges',drawBiomeChasmSurface),renderPass('maw-skirts',drawMawSkirts),
  renderPass('vegetation-moss',function(){drawVegMoss();}),renderPass('vegetation-plants',function(){drawVegSpots(performance.now());}),
  renderPass('sporecaller-mushrooms',function(){FoteSporecaller.ground(performance.now());}),
  renderPass('green-slime-trail',function(){FoteGreenSlime.draw(performance.now());}),
  renderPass('enemy-webs',function(){FoteEnemyFields.draw(performance.now());}),
  renderPass('underdark',drawUnderdarkSurface),renderPass('elemental-plane',drawElementPlaneSurface),
  renderPass('sanctuary',drawSanctuarySurface),renderPass('last-cast',drawLastCastSurface)
];
var renderSurface=FoteRendering.sequence(SURFACE_PASSES);
/* 2026-09-28 (frame cost): which surface passes hold still, drawing the same pixels every frame until the world or the
 * view changes. render.js keeps the ground passes that do in one layer (drawGroundLayer) and draws the rest live; a pass
 * missing here is always drawn live. A function answers for this frame: false while anything it draws is moving. */
var SURFACE_STILL={
  'stone':true,'crypt-moss':true,'crypt-grime':true,'maw-skirts':true,'vegetation-moss':true,'underdark':true,
  'crypt-ooze':function(){return !floorMeta.ooze||ANIM.reduce||!groundRangeAny(function(i,x,y){return isOozeAt(x,y);});},
  'pool-bubbles':function(){var P=ptPoolFx()&&floorMeta.ptPool,V=vis,all=revealAll;return !P||ANIM.reduce||!groundRangeAny(function(i){return P[i]&&(all||V[i]);});},
  'caverns':function(){return !inCaverns();},
  'chasm-edges':function(){var S=seen,all=revealAll;return !biomeChasmsOn()||ANIM.reduce||!groundRangeAny(function(i,x,y){return (all||S[i])&&chsVoidCell(x,y)&&at(x,y)!==BRIDGE&&hash2(x,y,701)<0.16;});},
  'vegetation-plants':function(){var P=floorMeta.vegSpots,S=seen,all=revealAll;return !P||!P.length||!P.some(function(p){return p.x>=camX-1&&p.x<=camX+viewW+1&&p.y>=camY-1&&p.y<=camY+viewH+1&&(all||S[idxOf(p.x,p.y)]);});},
  'elemental-plane':function(){return !inFwa();}
};
var renderTelegraphs=FoteRendering.sequence([
  renderPass('Prism-preview-portals',function(now){if(spriteOn&&typeof FoteChaosPreviewRenderer!=='undefined'&&FoteChaosPreviewRenderer.active())FoteChaosPreviewRenderer.drawPortals(now);}),
  renderPass('boss-windups',drawBossTelegraphs),renderPass('smoke',drawSmokeTelegraphs),
  renderPass('element-ground',drawElementGroundTelegraphs),renderPass('crypt-clouds-and-marks',drawCryptTelegraphs),renderPass('corpses',drawCorpseTelegraphs),renderPass('fallen-creatures',drawDeathRemains),
  renderPass('portal',drawPortalTelegraphs),renderPass('vein-glints',drawVeinGlints),renderPass('crystal-face-glints',drawCrystalFaceGlints),
  renderPass('shock-clouds',drawShockCloudTelegraphs),renderPass('darkness',drawDarknessTelegraphs),
  renderPass('sporecaller-fields',function(now){FoteSporecaller.draw(now);})
]);
var renderLightSources=FoteRendering.sequence([
  renderPass('chaos-currents',function(lights,now){if(typeof FoteChaosCurrentRenderer!=='undefined')FoteChaosCurrentRenderer.addLights(lights,now);}),
  renderPass('Prism-preview-lights',function(lights,now){if(typeof FoteChaosPreviewRenderer!=='undefined'&&FoteChaosPreviewRenderer.active())FoteChaosPreviewRenderer.addLights(lights,now);}),
  renderPass('sigils',addSigilLights),renderPass('crypt',addCryptLights),renderPass('crypt-mushrooms',addCryptMushroomLights),
  renderPass('crypt-rooms',addCryptRoomLights),renderPass('upstairs',addUpstairsLights),renderPass('portal-and-plane',function(lights,now,position){
    if(typeof FoteChaosPreviewRenderer==='undefined'||!FoteChaosPreviewRenderer.mixed())return addPortalLights(lights,now,position);
    // Captured Prism inlay lights share the normal pipeline, but remembered
    // sources cannot illuminate another island in the combined preview.
    var local=[];addPortalLights(local,now,position);local.forEach(function(light){if(revealAll||inb(light.tx,light.ty)&&vis[idxOf(light.tx,light.ty)])lights.push(light);});
  }),
  renderPass('natural-terrain',addNaturalTerrainLights),renderPass('cavern-strength',shadeCavernLights),
  renderPass('stormward',addStormwardLight),renderPass('underdark-strength-and-lava',addUnderdarkLights)
]);
function drawPropSurface(p,x,y,alpha){
  if((p.name==='bones'||p.name==='bone-pile')&&typeof drawStoneProp==='function'){
    var bx=x+TS*.5,by=y+TS*.5;ctx.save();ctx.translate(bx,by);ctx.scale(.5,.5);ctx.translate(-bx,-by);
    try{return drawStoneProp(p,x,y,alpha);}finally{ctx.restore();}
  }
  if(p.eventGate)return true; // The terrain door pass owns this gate sprite and its tile alignment.
  if(p.fluid||p.name==='barrel'){
    var barrel=objArt('props',p.name)||objArt('props','barrel');
    if(barrel)return !!drawObj(barrel,x,y,{feet:true,fit:.9,alpha:alpha});
  }

  // An explicit set-piece sprite owns its appearance before any name-based
  // legacy decoration. Placement and depth remain the ordinary set renderer.
  if(p.artName){
    var authoredFit=FoteEnvironmentProps.fit(p);
    if(!authoredFit)return p.set?drawSetSprite(p,alpha):false;
    var ox=x+TS*.5,oy=y+TS*authoredFit.anchor;
    ctx.save();ctx.translate(ox,oy);ctx.scale(authoredFit.scale,authoredFit.scale);ctx.translate(-ox,-oy);
    try{
      if(p.set)return drawSetSprite(p,alpha);
      var authored=objArt('props',p.artName)||objArt('chests',p.artName)||objArt('structures',p.artName);
      return !!authored&&drawObj(authored,x,y,{feet:authoredFit.anchor!==.5,fit:.9,alpha:alpha,flash:flashOf(p)});
    }finally{ctx.restore();}
  }
  // A few props draw their painted art, or at a size of their own (environment-props.js fit).
  var fit=FoteEnvironmentProps.fit(p);if(!fit)return renderProp(p,x,y,alpha);
  var art=fit.paint&&FoteEnvironmentProps.art('props',p.name);
  function painted(){return !!art&&!!drawObj(art,x,y,{fit:.98,alpha:alpha});}
  if(!fit.scale)return painted()||renderProp(p,x,y,alpha);
  // Shrunk around its floor anchor: the prop's tile, footprint and loot are untouched.
  var ax=x+TS*.5,ay=y+TS*fit.anchor;
  ctx.save();ctx.translate(ax,ay);ctx.scale(fit.scale,fit.scale);ctx.translate(-ax,-ay);
  try{
    if(painted()||renderProp(p,x,y,alpha))return true;
    var o=objArt('props',p.name)||objArt('chests',p.name)||objArt('structures',p.name);
    return !!o&&drawObj(o,x,y,{feet:!p.flat&&fit.anchor!==.5,fit:p.flat?.82:.9,alpha:alpha,flash:flashOf(p)});
  }finally{ctx.restore();}
}
function drawSurfaceDeco(){renderSurface();}
function drawTelegraphs(now){renderTelegraphs(now);}
function gatherLights(now,position){var lights=gatherBaseLights(now,position);renderLightSources(lights,now,position);return lights;}

/* Atlas selection is ordered explicitly. Shrine fallback can re-enter objArt
 * through packedSetArt, so only the shrine redirect has a bounded guard. */
var renderShrineLookup=false;
function objArt(group,name){
  if(group==='chests'&&name==='chest-gold')name='chest-ornate';
  var art=typeof FoteChaosPreviewArt!=='undefined'?FoteChaosPreviewArt.lookup(group,name):null;
  if(!renderShrineLookup&&typeof name==='string'&&name.indexOf('shrine-')===0){
    renderShrineLookup=true;try{art=setArt(name);}finally{renderShrineLookup=false;}
  }
  if(!art){
    art=runeObjectArt(group,name)||packedObjectArt(group,name);
  }
  if(typeof FoteChaosPreviewRenderer!=='undefined'&&typeof FoteChaosPreviewRenderer.objectArt==='function')art=FoteChaosPreviewRenderer.objectArt(art,group,name);
  if(art)art.nm=name;
  return art;
}
function setArt(name){
  var art=(PACK_CRYPT[name]||PACK_PLANE[name])?packArt(name):null;
  if(!art){
    art=gradeCryptSet(packedSetArt(name),name);
    art=art||caveArt(name)||deepArt(name);
  }
  if(typeof FoteChaosPreviewRenderer!=='undefined'&&typeof FoteChaosPreviewRenderer.objectArt==='function')art=FoteChaosPreviewRenderer.objectArt(art,'props',name);
  return art;
}
function caveArt(name){var art=packedCaveArt(name);if(typeof FoteChaosPreviewRenderer!=='undefined')art=FoteChaosPreviewRenderer.objectArt(art,'cave',name);if(art)art.nm=name;return art;}
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
  return ptMat(x,y)?(ptTile(x,y)||{flat:ptFlat(x,y)}):masonryFloorTile(x,y);
}
function wallTile(x,y){
  if(inDeep()&&floorMeta.deepRegion){
    var raster=deepRasterTile(x,y);DEEP_AT=deepCellReg(x,y);DEEP_RC=!!raster&&!deepBuiltWall(x,y);
    // A natural region's wall top (a built wall's too) is its 128px rock or the region's material top.
    var natural=DEEP_STYLE[DEEP_AT]!=='rect'&&!DEEP_RC?FoteEnvironmentTerrain.deepTop(x,y):null;if(natural)return natural;
    if(raster)return raster;
    if(DEEP_STYLE[DEEP_AT]!=='rect'){var top=surfImg('top');if(top)return {img:top,sx:smod(x+surfOff(3))*64,sy:smod(y+surfOff(4))*64,sw:64,sh:64,deepDim:wallFaces(x,y)?.5:1-DEEP_TOP_DIM};}
  }else {DEEP_RC=false;DEEP_AT=-1;}
  return ptMat(x,y)?(ptTile(x,y)||{flat:ptFlat(x,y)}):masonryWallTile(x,y);
}
function tileSprite(x,y,tile){
  if(tile===EXIT&&floorMeta&&floorMeta.caveExit){var caveExit=caveArt('worm-burrow-open');if(caveExit)return caveExit;}
  if(tile===PORTAL){
    if(floorMeta&&floorMeta.chaosPreview){var gateway=propAt(x,y);if(gateway&&gateway.previewPortal)return null;}
    return objArt('structures','portal-arch');
  }
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
  try{if(!ptMat(x,y))return drawMasonryWallEdges(x,y,tile,px,py,alpha);}finally{DEEP_AT=keep;}
}
function drawDeco(piece,x,y,alpha,options){
  var keep=DEEP_AT;
  if(inDeep()&&floorMeta.deepRegion)DEEP_AT=deepCellReg(Math.floor(x/TS+.5)+camX,Math.floor(y/TS+.5)+camY);
  try{
    if(piece===DECO.drain&&(cryptRoomsOn()||(inDeep()&&floorMeta.deepRegion&&DEEP_AT!==0)))return;
    return drawSurfaceDecal(piece,x,y,alpha,options);
  }finally{DEEP_AT=keep;}
}
function wallTorchAt(x,y){if(typeof FoteChaosPreviewRenderer!=='undefined'&&typeof FoteChaosPreviewRenderer.terrainMaterial==='function'&&FoteChaosPreviewRenderer.terrainMaterial(x,y))return false;return masonryTorchAt(x,y)&&(!inDeep()||!floorMeta.deepRegion||(deepCellReg(x,y)!==1&&!deepIsRaster(x,y)));}
function drawWangLayer(key,tile){
  DEEP_RC=false;DEEP_AT=-1;
  var suppressed=key==='water'&&ptMat()||key==='chasm'&&(inCaverns()||biomeChasmsOn());
  var result;
  if(!suppressed)result=key==='water'?drawSurfaceWater(key,tile):drawAtlasWangLayer(key,tile);
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
function drawAutomap(){var result=drawBaseAutomap();drawAutomapLava(result);return result;}
function drawSideDoor(x,y,tile,px,py,alpha){
  if(drawUnderdarkDoor(x,y,tile,px,py,alpha))return true;
  if(tile===BRIDGE&&inCaverns()){drawCaveBridge(x,y,px,py,alpha);return true;}
  return drawMasonryDoor(x,y,tile,px,py,alpha);
}

var renderActor=FoteRendering.layered([
  {name:'actor-concealment',paint:function(job){if(actorConcealed(job.entity))return true;}},
  {name:'glacial-tomb',enter:prepareTombActor},
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
function drawCharacter(entity,x,y,options){
  if(!spriteOn)return actorConcealed(entity)||entity.kind==='mawlimb'||hidePlaneActor({entity:entity})===true;
  return renderActor({entity:entity,x:x,y:y,options:options});
}

var terrainRedrawFrame=null;
function sharedAnimationWillDraw(){
  return !ANIM.reduce||fx.length>0||PARTS.length>0||fxIdleFrames>0;
}
function requestTerrainRedraw(){
  groundLayerDirty();   /* art arrived or terrain cells are still being built: the ground layer is drawn again (render.js) */
  /* fxTick already repaints animated scenes. A second RAF chain repeats the
     entire scene in the same browser frame and multiplies after action draws.
     Only an idle reduced-motion scene needs its own cache-completion frame. */
  if(sharedAnimationWillDraw()||terrainRedrawFrame!==null)return;
  terrainRedrawFrame=requestAnimationFrame(function terrainRedrawTick(){
    terrainRedrawFrame=null;
    if(!sharedAnimationWillDraw())draw();
  });
}
function drawFramePasses(){
  if(DC)DC.built=0;
  var releaseFrame=holdFrameState();
  try{
    speedFxList();PT_CACHE.built=0;
    var restoreVisibility=prepareShadeVisibility();
    try{drawScene();}finally{restoreVisibility();}
    if(AUTOMAP_ON)drawAutomap();
    if((ptMat()||typeof FoteChaosPreviewRenderer!=='undefined'&&FoteChaosPreviewRenderer.mixed())&&PT_CACHE.built>=PT_BUDGET)requestTerrainRedraw();
    drawBowAimOverlay();drawAutoAimOverlay();
  }finally{DEEP_RC=false;DEEP_AT=-1;releaseFrame();}
  if(inDeep()&&DC.built>=DEEP_BUDGET)requestTerrainRedraw();
}
var renderPreviousMap=null,renderPreviousMeta=null;
/* Continue preparing elected art after startup and on each installed scene.
 * Query selectors only: no draw pass, gameplay write, RNG or unseen reveal.
 * A slice yields to input; the existing atlas owner gives these jobs one lane. */
var sceneArtEnabled=false,sceneArtLoading=null;
function sceneArtAvailable(){return !!(sceneArtEnabled&&spriteOn&&player&&map&&map.length&&floorMeta);}
function sceneArtCurrent(scope){return scope.active&&sceneArtAvailable()&&scope.map===map&&scope.meta===floorMeta&&scope.hero===player&&scope.appearanceRevision===FoteContent.appearanceRevision(scope.meta);}
function querySceneArt(task){
  function query(){
    var value=task.value,name;
    if(task.kind==='tile'){
      /* Ground sources belong to this scene too, even when the retained layer
       * means their selectors will not run again for several seconds. */
      if(isWallLike(value))wallTile(task.x,task.y);
      else if(value!==CHASM)floorTile(task.x,task.y);
      tileSprite(task.x,task.y,value);
      /* A disguised chest is not yet an actor. Its reveal sheet must be ready
       * at floor entry, rather than first requested by the reveal frame. */
      if(value===CHEST&&chestKind[idxOf(task.x,task.y)]==='mimic')mobSheet(MONSTERS.mimic.sprite);
      if(value===OPEN){var material=DOOR_ART[openDoorMaterial(task.x,task.y)]||DOOR_ART.wood;objArt('structures',material[0]);objArt('structures',material[1]);}
      if(value===STAIRS&&inDeep())deepArt('stairs-down-drow');
    }else if(task.kind==='prop'){
      name=value.artName||value.name;
      var guardian=typeof puzzleGuardianSprite==='function'&&puzzleGuardianSprite(value);
      if(guardian)mobSheet(guardian);
      if(value.name==='bones'||value.name==='bone-pile'){groundBoneArt(value.x,value.y);return;}
      objArt('props',name)||objArt('structures',name)||objArt('chests',name)||objArt('terrain',name);
      var packed=typeof packNameFor==='function'&&packNameFor(value);if(packed)packArt(packed);
      if(value.set||value.soulSmoke)setArt(name);
      if(value.cave||typeof CAVE_PIECES!=='undefined'&&CAVE_PIECES[value.name])caveArt(value.name);
      if(value.deep||typeof DEEP_PIECES!=='undefined'&&DEEP_PIECES[value.name])deepArt(value.name);
      if(value.name==='stack-group'||value.name==='urn-group'){
        var cluster=sceneryClusterAppearance(value);sceneryClusterSource(cluster.family,cluster.variant);
      }
    }else if(task.kind==='item')objArt('items',itemArtName(value));
    else if(task.kind==='trap'){var trap=TRAPS[value.kind];if(trap)objArt('traps',trap.sprite);}
    else if(task.kind==='plate')objArt('structures',value.pressed?'plate-glow':'trap-plate')||objArt('traps','trap-plate');
    else if(task.kind==='ground'){
      if(value===G_BONES)groundBoneArt(task.x,task.y);
      else if(value===G_GRASS&&cryptShrooms()){
        var mushroom=cryptMushroomAppearance(task.x,task.y);sceneryClusterSource(mushroom.family,mushroom.variant);
      }
      else objArt('terrain',GROUND_ART[value]);
    }
    else if(task.kind==='actor'){
      if(value.shadowClone)castSheet(value.cloneLook);
      else if(value.livingFlame)atl('living-flame.webp');
      else if(typeof isShadeSummon==='function'&&isShadeSummon(value))shadeSummonSheet();
      else if(value.base&&value.base.sprite)mobSheet(value.base.sprite);
    }else if(task.kind==='hero'){
      var look=playerCastLook();castSheet(look);var spec=AS.cast&&AS.cast[look];if(spec&&spec.doll)atl('cast-'+look+'-doll.webp');
    }
  }
  if(typeof FoteChaosPreviewRenderer!=='undefined'&&FoteChaosPreviewRenderer.mixed()&&typeof FoteChaosPreviewRenderer.withCell==='function')return FoteChaosPreviewRenderer.withCell(task.x,task.y,query);
  return query();
}
function electSceneArt(){
  var tasks=[],tiles=new Set(),grounds=new Set(),hero=player;
  function add(kind,value,x,y){if(kind==='tile'||kind==='ground')FoteContent.observeAppearance(floorMeta,kind,value);else if(kind==='plate')FoteContent.observeAppearance(floorMeta,kind,!!value.pressed);tasks.push({kind:kind,value:value,x:Number.isFinite(x)?x:hero.x,y:Number.isFinite(y)?y:hero.y});}
  add('hero',hero,hero.x,hero.y);
  for(var i=0;i<map.length;i++){
    var tile=map[i],key=tile+(tile===CHEST?':'+chestKind[i]:tile===OPEN?':'+openDoorMaterial(i%MW,Math.floor(i/MW)):'');
    if(!tiles.has(key)){tiles.add(key);add('tile',tile,i%MW,Math.floor(i/MW));}
    var material=ground&&ground[i];if(material&&GROUND_ART[material]&&!grounds.has(material)){grounds.add(material);add('ground',material,i%MW,Math.floor(i/MW));}
  }
  props.forEach(function(value){add('prop',value,value.x,value.y);});
  items.forEach(function(value){if(!value.crystal&&value.kind!=='heart'&&value.kind!=='managlobe')add('item',value,value.x,value.y);});
  feats.forEach(function(value){add('trap',value,value.x,value.y);});
  if(plates&&plates.cells)plates.cells.forEach(function(value){add('plate',value,value.x,value.y);});
  var residents=ents.concat(floorMeta.buriedGhouls||[],floorMeta.maw&&floorMeta.maw.ent||[],floorMeta.pendingLich&&floorMeta.pendingLich.entity||[]);
  residents.forEach(function(value){if(value&&value!==hero&&(value.hp>0||floorMeta.pendingLich&&value===floorMeta.pendingLich.entity))add('actor',value,value.x,value.y);});
  tasks.sort(function(a,b){return Math.max(Math.abs(a.x-hero.x),Math.abs(a.y-hero.y))-Math.max(Math.abs(b.x-hero.x),Math.abs(b.y-hero.y));});
  return tasks;
}
function retireSceneArt(scope){
  if(!scope)return;
  if(scope.task!==null){if(scope.idle&&typeof cancelIdleCallback==='function')cancelIdleCallback(scope.task);else clearTimeout(scope.task);scope.task=null;}
  scope.tasks=[];retireBackgroundAtlasRequests(scope);
  if(sceneArtLoading===scope){sceneArtLoading=null;setActiveAtlasScene(null);}
}
function scheduleSceneArt(scope){
  if(!sceneArtCurrent(scope)||!scope.tasks.length)return;
  function slice(){
    scope.task=null;if(!sceneArtCurrent(scope)){retireSceneArt(scope);return;}
    var end=performance.now()+4,count=0;
    while(scope.tasks.length&&count++<8&&performance.now()<end){
      var task=scope.tasks.shift();
      try{withBackgroundAtlasRequests(scope,function(){querySceneArt(task);});scope.elected++;}
      catch(error){scope.errors.push(String(error&&error.message||error));console.error('Current-scene artwork election failed',error);}
    }
    scheduleSceneArt(scope);
  }
  scope.idle=typeof requestIdleCallback==='function';scope.task=scope.idle?requestIdleCallback(slice,{timeout:250}):setTimeout(slice,16);
}
/* Floor entry is a readiness boundary. Warming may continue during ordinary
 * play, but the first frame must not substitute letters for resident sprites. */
function prepareSceneArt(scope){
  if(!scope||!sceneArtCurrent(scope))return Promise.resolve();
  if(scope.task!==null){if(scope.idle&&typeof cancelIdleCallback==='function')cancelIdleCallback(scope.task);else clearTimeout(scope.task);scope.task=null;}
  while(scope.tasks.length){
    var task=scope.tasks.shift();
    withBackgroundAtlasRequests(scope,function(){querySceneArt(task);});scope.elected++;
  }
  /* These are now required entry sources: promote them into the normal queue. */
  return Promise.all(Array.from(scope.atlasFiles).map(function(file){return atlReady(file,{retry:true});}));
}
function continueSceneArtLoading(){
  if(!sceneArtAvailable()){retireSceneArt(sceneArtLoading);return;}
  var scope=sceneArtLoading,appearanceRevision=FoteContent.appearanceRevision(floorMeta),counts=[props.length,items.length,feats.length,ents.length,player.look,player.god].join('|');
  if(scope&&sceneArtCurrent(scope)&&scope.counts===counts)return;
  var retained=scope&&scope.map===map&&scope.meta===floorMeta?scope.atlasFiles:new Set();
  retireSceneArt(scope);
  scope=sceneArtLoading={active:true,map:map,meta:floorMeta,hero:player,appearanceRevision:appearanceRevision,counts:counts,atlasFiles:retained,tasks:electSceneArt(),task:null,idle:false,elected:0,errors:[]};
  setActiveAtlasScene(scope);
  scheduleSceneArt(scope);
}
function startSceneArtLoading(){sceneArtEnabled=true;continueSceneArtLoading();}
function sceneArtLoadingDiagnostics(){var scope=sceneArtLoading;return {enabled:sceneArtEnabled,current:!!scope&&sceneArtCurrent(scope),elected:scope?scope.elected:0,remaining:scope?scope.tasks.length:0,errors:scope?scope.errors.slice():[]};}
if(typeof FoteLifecycle!=='undefined')FoteLifecycle.whenReady(startSceneArtLoading);
/* Floor-entry hold (2026-09-27): a new floor is not painted until its art is ready, so it never shows
 * the old art first. The previous frame stays up (no loading card) and input waits (pacing.js).
 * Startup awaits its current scene. Later entries await terrain and elected
 * object/resident sheets too; no partially prepared floor is made playable. */
var floorArt=null,floorDrawn=[];
/* Terrain hold (2026-09-28): the same, for the natural terrain of a view that is not built yet (a new floor, a
 * portal hop to another island, a zoom or reveal change). Its cells are built first, at full detail, behind the
 * previous frame; then it is drawn once. Walking needs no hold: the cells around the view are built ahead. */
var terrainHold=null,terrainShown={map:null,meta:null,x:0,y:0,w:0,h:0,reveal:false,cw:0,ch:0};
function floorArtPending(){
  return !!floorArt&&!floorArt.done&&floorArt.map===map&&floorArt.meta===floorMeta||
    !!terrainHold&&!terrainHold.done&&terrainHold.map===map&&terrainHold.meta===floorMeta;
}
function whenFloorDrawn(fn){if(floorArtPending())floorDrawn.push(fn);else fn();}
function floorArtMessage(hold,error){
  if(floorArt!==hold||hold.map!==map||hold.meta!==floorMeta)return;
  var node=document.getElementById('floorArtStatus');
  if(!node){node=document.createElement('div');node.id='floorArtStatus';node.setAttribute('role','status');node.style.cssText='position:fixed;z-index:99;bottom:20px;left:50%;transform:translateX(-50%);padding:12px 16px;border:1px solid #79634C;border-radius:8px;background:#17120F;color:#E5D5BD;font:14px sans-serif;text-align:center';document.body.appendChild(node);}
  node.style.fontSize='calc(14px + var(--ui-mobile-text-add,0px))';node.replaceChildren();
  var text=document.createElement('span');text.textContent=error?'Some artwork could not load. ':'Preparing floorâ€¦';node.appendChild(text);
  if(error){var retry=document.createElement('button');retry.textContent='Retry';retry.style.cssText='margin-left:10px;padding:8px 12px;min-width:44px;min-height:44px';retry.onclick=function(){prepareFloorArt(hold);};node.appendChild(retry);}
}
function prepareFloorArt(hold){
  if(hold.loading||floorArt!==hold)return;hold.loading=true;hold.error=null;
  floorArtMessage(hold,null);
  var chaos=hold.meta&&(hold.meta.chaosCampaign||hold.meta.chaosEntryPreview)&&typeof FoteChaosCampaign!=='undefined';
  Promise.all([typeof FoteEnvironmentTerrain!=='undefined'?FoteEnvironmentTerrain.ensureAssets():null,chaos?FoteChaosCampaign.prepare():null])
    .then(function(){if(hold.map!==map||hold.meta!==floorMeta)return;continueSceneArtLoading();return prepareSceneArt(sceneArtLoading);})
    .then(function(){
      hold.loading=false;hold.done=true;
      if(floorArt!==hold||hold.map!==map||hold.meta!==floorMeta)return;
      var notice=document.getElementById('floorArtStatus');if(notice)notice.remove();draw();
    },function(error){hold.loading=false;hold.error=error;console.error('Floor artwork preparation failed',error);floorArtMessage(hold,error);});
}
function holdFloor(){
  if(floorArt&&floorArt.map===map&&floorArt.meta===floorMeta)return !floorArt.done;
  var hold=floorArt={map:map,meta:floorMeta,done:false,loading:false,error:null};
  prepareFloorArt(hold);
  return true;
}
/* The tile window the next frame will draw (drawScene's own camera, from the player's drawn position). */
function terrainViewNow(){
  var camera=sceneCameraPoint(renderPos(player));
  return {x:Math.floor(camera.x),y:Math.floor(camera.y),w:viewW,h:viewH,reveal:!!revealAll};
}
function holdTerrain(changed){
  if(typeof FoteEnvironmentTerrain==='undefined'||!FoteEnvironmentTerrain.bakeView)return false;
  if(terrainHold&&!terrainHold.done){if(terrainHold.map===map&&terrainHold.meta===floorMeta)return true;terrainHold=null;}
  var v=terrainViewNow(),s=terrainShown;
  if(!changed&&s.map===map&&s.meta===floorMeta&&Math.abs(v.x-s.x)<=2&&Math.abs(v.y-s.y)<=2&&v.w===s.w&&v.h===s.h&&v.reveal===s.reveal)return false;
  // A resized canvas has lost its last frame (resize() clears it): on the same floor, draw now rather than hold a blank.
  if(!changed&&(cv.width!==s.cw||cv.height!==s.ch))return false;
  var h=terrainHold;
  if(h&&h.done&&h.map===map&&h.meta===floorMeta&&h.x===v.x&&h.y===v.y&&h.w===v.w&&h.h===v.h&&h.reveal===v.reveal)return false;
  var hold=terrainHold={map:map,meta:floorMeta,x:v.x,y:v.y,w:v.w,h:v.h,reveal:v.reveal,done:false};
  // A floor's first drawn view used to build its cave rasters here, noting the floor's regions (deepPresent) as it did.
  if(inDeep()&&floorMeta.deepRegion&&!floorMeta.deepPresent){
    for(var y=v.y;y<=v.y+v.h&&!floorMeta.deepPresent;y++)for(var x=v.x;x<=v.x+v.w;x++){
      if(inb(x,y)&&(revealAll||seen[idxOf(x,y)]||vis[idxOf(x,y)])&&deepIsRaster(x,y)){deepPresent();break;}
    }
  }
  // the view is taken when the bake starts, after the rest of the entry (arrival stairs, a portal's landing)
  function view(){var now=terrainViewNow();hold.x=now.x;hold.y=now.y;hold.w=now.w;hold.h=now.h;hold.reveal=now.reveal;return now;}
  function done(){hold.done=true;if(terrainHold===hold)draw();}
  FoteEnvironmentTerrain.bakeView(view).then(done,done);
  return true;
}
/* For tools and tests that paint a new floor or view within one task: its terrain is built here, on the page. */
function drawTerrainNow(){
  draw();
  var h=terrainHold;
  if(h&&!h.done&&h.map===map&&h.meta===floorMeta){
    var v=terrainViewNow();FoteEnvironmentTerrain.bakeViewNow(v);
    h.x=v.x;h.y=v.y;h.w=v.w;h.h=v.h;h.reveal=v.reveal;h.done=true;draw();
  }
}
function draw(){
  continueSceneArtLoading();
  var changed=renderPreviousMap!==map||renderPreviousMeta!==floorMeta;
  if(changed&&spriteOn&&map&&holdFloor())return;
  if(spriteOn&&map&&ground&&holdTerrain(changed))return;
  var shake=SHAKE>0.5&&!ANIM.reduce;
  if(shake){ctx.save();ctx.translate((Math.random()-.5)*SHAKE,(Math.random()-.5)*SHAKE);}else SHAKE=0;
  try{
    withSceneAtlasRequests(sceneArtLoading,drawFramePasses);
    if(spriteOn&&map&&ground){ /* the map's ResizeObserver can call draw() before the first world exists */
      if(changed){renderPreviousMap=map;renderPreviousMeta=floorMeta;}
      terrainShown={map:map,meta:floorMeta,x:camX,y:camY,w:viewW,h:viewH,reveal:!!revealAll,cw:cv.width,ch:cv.height};
      if(typeof FoteEnvironmentTerrain!=='undefined'&&FoteEnvironmentTerrain.ahead)FoteEnvironmentTerrain.ahead(terrainShown);
      if(!floorArtPending())floorDrawn.splice(0).forEach(function(fn){fn();});
    }
  }finally{if(shake){ctx.restore();SHAKE*=.86;}}
}
