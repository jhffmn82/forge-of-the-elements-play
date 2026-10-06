/* One terrain policy and one visibility order serve movement, targeting and AI. */
var terrainRules=FoteGeometry.terrain({floor:FLOOR,open:OPEN,stairs:STAIRS,rubble:RUBBLE,water:WATER,bridge:BRIDGE,exit:EXIT,
  upstairs:UPSTAIRS,portal:PORTAL,wall:WALL,door:DOOR,locked:LOCKED,iceDoor:ICEDOOR,thorns:THORNS,secret:SECRET,sealed:SEALED,toll:TOLL,chest:CHEST});
function walkable(x,y){if(typeof FoteUnmakerPreview!=='undefined'&&!FoteUnmakerPreview.destinationAllowed(x,y))return false;var p=propGrid?propAt(x,y):null;return terrainRules.walkable(at(x,y),!!(p&&p.b),floorMeta.exitOpen);}
function passable(x,y){if(typeof FoteUnmakerPreview!=='undefined'&&!FoteUnmakerPreview.destinationAllowed(x,y))return false;var p=propGrid?propAt(x,y):null;return terrainRules.passable(at(x,y),!!(p&&p.b),floorMeta.exitOpen);}
function opaque(x,y){var p=propGrid&&propAt(x,y);return terrainRules.opaque(at(x,y),ground&&gAt(x,y)===G_GRASS,cryptShrooms(),p&&p.pillar);}
function visionCast(context){
  var room=roomAt(player.x,player.y),shadow=floorMeta&&floorMeta.plane==='shadow';
  var radius=FoteGeometry.radius(context.radius,{shadowPlane:shadow,snuffed:player.snuffed>0,
    moonlight:shadow&&(floorMeta.planeLights||[]).some(function(l){return Math.abs(l.x-player.x)<=2&&Math.abs(l.y-player.y)<=2;}),
    darkTrapRoom:room&&room.puzzle&&room.puzzle.kind==='darktraps'&&room.dark,darkRoom:room&&room.dark,
    lightAffinity:player.aff.light>0,fireAffinity:player.aff.fire>0});
  context.view={x:player.x,y:player.y,width:MW,height:MH,vis:vis,seen:seen,opaque:opaque,wall:ptWallCell};
  context.blind=playerBlind();
  // Enemies retain the normally masked sight. Its exploration writes are
  // private while Blind; only the player's adjacent cast may learn new cells.
  if(context.blind)context.view=Object.assign({},context.view,{vis:new Uint8Array(MW*MH),seen:seen.slice()});
  FoteGeometry.cast(context.view,radius);
}
function visionSmoke(context){var smoke=smokeActive();if(smoke&&vis)FoteGeometry.mask(context.view,smoke._mask);}
function visionRockBand(context){
  if(!vis)return;
  if(typeof FoteChaosPreviewRenderer!=='undefined'&&FoteChaosPreviewRenderer.mixed()){
    FoteGeometry.revealRock(Object.assign({},context.view,{wall:function(x,y){return !!ptMat(x,y)&&ptWallCell(x,y);}}));
  }else if(ptMat())FoteGeometry.revealRock(context.view);
}
function visionDeepDarkness(context){
  var globes=deepDarkActive();if(!globes.length||!vis){DEEP_RAWVIS=null;return;}
  DEEP_RAWVIS=context.view.vis.slice();var mask=new Uint8Array(MW*MH);globes.forEach(function(globe){globe.cells.forEach(function(i){mask[i]=1;});});FoteGeometry.mask(context.view,mask);
}
function visionBlind(context){
  BLIND_RAWVIS=context.blind?context.view.vis:null;
  if(!context.blind)return;
  context.view=Object.assign({},context.view,{vis:vis,seen:seen});
  FoteGeometry.cast(context.view,1,{adjacentOnly:true});
}
function sandboxRoomPreviewBounds(){
  var preview=RUN&&RUN.sandbox&&RUN.sandbox.previewRoomReveal;
  if(!preview||preview.floor!==floorNo||preview.seed!==worldSeed||!player)return null;
  var x=Math.min(preview.x,player.x-1),y=Math.min(preview.y,player.y-1);
  return {x:x,y:y,w:Math.max(preview.x+preview.w,player.x+2)-x,h:Math.max(preview.y+preview.h,player.y+2)-y};
}
function sandboxRoomPreviewAt(x,y){
  var bounds=sandboxRoomPreviewBounds();return !!(bounds&&x>=bounds.x&&y>=bounds.y&&x<bounds.x+bounds.w&&y<bounds.y+bounds.h);
}
function visionSandboxRoom(){
  var preview=sandboxRoomPreviewBounds();if(!preview||!vis)return;
  for(var y=preview.y;y<preview.y+preview.h;y++)for(var x=preview.x;x<preview.x+preview.w;x++)if(inb(x,y)){var i=idxOf(x,y);vis[i]=1;seen[i]=1;}
}
var visionStages=FoteTransitions.stages([
  {name:'radius-and-sight',run:visionCast},{name:'smoke-mask',run:visionSmoke},
  {name:'plane-rock-band',run:visionRockBand},{name:'darkness-mask-and-darksight',run:visionDeepDarkness},
  {name:'blind-adjacent-sight',run:visionBlind},{name:'sandbox-room-preview',run:visionSandboxRoom}
]);
function computeFOV(radius){visionStages.run({radius:radius});}
/* Actor concealment never changes tile FOV: the floor and its lights remain
 * visible. Spawn invisibility breaks on an attack/cast or actual HP damage;
 * Dawn and authoring reveal can detect it without permanently breaking it. */
function actorConcealed(e){
  return !!(e&&e!==player&&e.base&&e.base.spawnInvisible&&!e.visibilityRevealed&&!revealAll&&!(e.foe&&player&&player.dawnUntil>turn));
}
function playerBlind(){return !!(player&&typeof gameEffects!=='undefined'&&gameEffects.has(player,'blind'));}
function actorVisible(e,allowDawn){
  if(!e||actorConcealed(e))return false;
  if(!playerBlind()&&(revealAll||allowDawn&&e.foe&&player&&player.dawnUntil>turn))return true;
  for(var y=e.y;y<e.y+entitySize(e);y++)for(var x=e.x;x<e.x+entitySize(e);x++)if(inb(x,y)&&vis[idxOf(x,y)])return true;
  return false;
}
function revealActor(e){if(e&&e.base&&e.base.spawnInvisible)e.visibilityRevealed=true;}
function stealthScore(){
  if(!player)return 0;var room=roomAt(player.x,player.y),step=player.grassStep;
  /* 2026-09-28 (Justin): tall grass you stepped into this turn counts though the step trampled it (performPlayerMove) */
  return FoteGeometry.stealth({noisy:player.noisy,unsneaky:hasGod('reginald'),agility:player.stats.agi,scoundrel:isScoundrel(),moved:player.movedLast,
    grass:gAt(player.x,player.y)===G_GRASS||!!(step&&step.x===player.x&&step.y===player.y),darkRoom:room&&room.dark,weight:(player.armorItem||{}).weight,extra:stealthExtra()});
}
