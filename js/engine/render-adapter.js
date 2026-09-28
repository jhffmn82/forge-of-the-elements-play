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
  renderPass('shock-clouds',drawShockCloudTelegraphs),renderPass('darkness',drawDarknessTelegraphs)
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
  // An explicit set-piece sprite owns its appearance before any name-based
  // legacy decoration. Placement and depth remain the ordinary set renderer.
  if(p.artName)return p.set?drawSetSprite(p,alpha):false;
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
    var o=objArt('props',p.name);
    return !!o&&drawObj(o,x,y,{feet:!p.flat,fit:p.flat?.82:.9,alpha:alpha,flash:flashOf(p)});
  }finally{ctx.restore();}
}
function drawSurfaceDeco(){renderSurface();}
function drawTelegraphs(now){renderTelegraphs(now);}
function gatherLights(now,position){var lights=gatherBaseLights(now,position);renderLightSources(lights,now,position);return lights;}

/* Atlas selection is ordered explicitly. Shrine fallback can re-enter objArt
 * through packedSetArt, so only the shrine redirect has a bounded guard. */
var renderShrineLookup=false;
function objArt(group,name){
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
function drawAutomap(){var result=drawBaseAutomap();drawAutomapLava();return result;}
function drawSideDoor(x,y,tile,px,py,alpha){
  if(drawUnderdarkDoor(x,y,tile,px,py,alpha))return true;
  if(tile===BRIDGE&&inCaverns()){drawCaveBridge(x,y,px,py,alpha);return true;}
  return drawMasonryDoor(x,y,tile,px,py,alpha);
}

var renderActor=FoteRendering.layered([
  {name:'actor-concealment',paint:function(job){if(actorConcealed(job.entity))return true;}},
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
/* Floor-entry hold (2026-09-27): a new floor is not painted until its art is ready, so it never shows
 * the old art first. The previous frame stays up (no loading card) and input waits (pacing.js).
 * The loading screen loads every floor's art (boot.js), so after it this is only a safety net. */
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
function holdFloor(){
  if(floorArt&&floorArt.map===map&&floorArt.meta===floorMeta)return !floorArt.done;
  var chaos=floorMeta&&(floorMeta.chaosCampaign||floorMeta.chaosEntryPreview)&&typeof FoteChaosCampaign!=='undefined';
  if(typeof FoteEnvironmentTerrain==='undefined'||FoteEnvironmentTerrain.ready()&&(!chaos||FoteChaosCampaign.prepared()))return false;
  var hold=floorArt={map:map,meta:floorMeta,done:false};
  Promise.all([FoteEnvironmentTerrain.ensureAssets(),chaos?FoteChaosCampaign.prepare():null]).catch(function(){/* the original materials are the load-error fallback */})
    .then(function(){hold.done=true;if(floorArt===hold)draw();});
  return true;
}
/* The tile window the next frame will draw (drawScene's own camera, from the player's drawn position). */
function terrainViewNow(){
  var prp=renderPos(player);
  return {x:Math.floor(clamp(prp.x-(viewW>>1),0,Math.max(0,MW-viewW))),y:Math.floor(clamp(prp.y-(viewH>>1),0,Math.max(0,MH-viewH))),w:viewW,h:viewH,reveal:!!revealAll};
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
  var changed=renderPreviousMap!==map||renderPreviousMeta!==floorMeta;
  if(changed&&spriteOn&&map&&holdFloor())return;
  if(spriteOn&&map&&ground&&holdTerrain(changed))return;
  var shake=SHAKE>0.5&&!ANIM.reduce;
  if(shake){ctx.save();ctx.translate((Math.random()-.5)*SHAKE,(Math.random()-.5)*SHAKE);}else SHAKE=0;
  try{
    drawFramePasses();
    if(spriteOn&&map&&ground){ /* the map's ResizeObserver can call draw() before the first world exists */
      if(changed){renderPreviousMap=map;renderPreviousMeta=floorMeta;}
      terrainShown={map:map,meta:floorMeta,x:camX,y:camY,w:viewW,h:viewH,reveal:!!revealAll,cw:cv.width,ch:cv.height};
      if(typeof FoteEnvironmentTerrain!=='undefined'&&FoteEnvironmentTerrain.ahead)FoteEnvironmentTerrain.ahead(terrainShown);
      if(!floorArtPending())floorDrawn.splice(0).forEach(function(fn){fn();});
    }
  }finally{if(shake){ctx.restore();SHAKE*=.86;}}
}
