/* ============================================================================
   render.js - the map renderer: atlases, terrain, decals, props, items, traps,
   animated characters and monsters, lighting. Replaces js/runtime/game.js draw().
   ========================================================================== */

var AS = window.ASSETS || {};
var ATL = {}, ATL_LOADS = 0;   /* ATL_LOADS: atlases loaded so far (the ground layer's key) */
/* Mobile startup must not decode the whole dungeon at once. The synchronous
 * renderer still asks for the same art; this owner queues and retries requests. */
var ATLAS_JOBS=new Map(),ATLAS_QUEUE=[],ATLAS_ACTIVE=0,ATLAS_PROTECTED=new Set(),ATLAS_TRIM=null;
var ATLAS_MAX_ACTIVE=4,ATLAS_BUDGET=96*1024*1024,ATLAS_TIMEOUT=45000;
var ATLAS_BACKGROUND_SCOPE=null,ATLAS_BACKGROUND_ACTIVE=0;
var ATLAS_WATCHERS=new Map();
/* A retained ground layer does not look its source images up every frame.
 * Keep the installed scene's elected/drawn art alive until that scene retires;
 * elapsed lookup time alone is not evidence that an image is unused. */
var ATLAS_SCENE=null,ATLAS_DRAW_SCOPE=null;
function setActiveAtlasScene(scope){ATLAS_SCENE=scope||null;if(scope&&!scope.atlasFiles)scope.atlasFiles=new Set();}
function withSceneAtlasRequests(scope,query){
  var previous=ATLAS_DRAW_SCOPE;ATLAS_DRAW_SCOPE=scope;
  try{return query();}finally{ATLAS_DRAW_SCOPE=previous;}
}
/* Current-scene selectors elect art without starting a second cache or queue.
 * Background work has one lane; visible requests promote their queued jobs. */
function withBackgroundAtlasRequests(scope,query){
  var previous=ATLAS_BACKGROUND_SCOPE;ATLAS_BACKGROUND_SCOPE=scope;
  try{return query();}finally{ATLAS_BACKGROUND_SCOPE=previous;}
}
function retireBackgroundAtlasRequests(scope){
  scope.active=false;
  ATLAS_JOBS.forEach(function(job){
    if(!job.backgroundOwners)return;job.backgroundOwners.delete(scope);
    if(!job.background||job.backgroundOwners.size||job.phase!=='queued')return;
    var index=ATLAS_QUEUE.indexOf(job);if(index>=0)ATLAS_QUEUE.splice(index,1);
    ATLAS_JOBS.delete(job.file);if(ATL[job.file]===job.image)delete ATL[job.file];
    job.phase='retired';var error=new Error('Atlas background scene retired: '+job.file);error.name='AbortError';error.atlasSceneRetired=true;job.reject(error);
  });
  pumpAtlasQueue();
}
/* Subscribers belong to a mounted presentation request, not one load attempt.
 * A failed attempt stays quiet; an explicit retry can notify the same owner. */
function subscribeAtlas(file,ready,failed){
  var watchers=ATLAS_WATCHERS.get(file);if(!watchers)ATLAS_WATCHERS.set(file,watchers=new Set());
  var subscription={ready:ready,failed:failed,active:true};watchers.add(subscription);
  var job=requestAtlas(file);
  if(job.phase==='ready')notifyAtlasSubscribers(job,[subscription]);
  return function(){subscription.active=false;watchers.delete(subscription);if(!watchers.size&&ATLAS_WATCHERS.get(file)===watchers)ATLAS_WATCHERS.delete(file);};
}
function notifyAtlasSubscribers(job,subscribers){
  subscribers=subscribers||Array.from(ATLAS_WATCHERS.get(job.file)||[]);
  Promise.resolve().then(function(){
    if(ATLAS_JOBS.get(job.file)!==job)return;
    subscribers.forEach(function(subscription){
      if(!subscription.active)return;
      var notify=job.phase==='ready'?subscription.ready:subscription.failed;
      if(notify)try{notify(job.image,job.error);}catch(error){console.error('Atlas presentation subscriber failed: '+job.file,error);}
    });
  });
}
function setAtlasProtectedFiles(files){ATLAS_PROTECTED=new Set(files||[]);trimAtlasCache();}
function trimAtlasCache(){
  var bytes=0,now=performance.now(),available=[];
  ATLAS_JOBS.forEach(function(job){if(job.phase==='ready'){bytes+=job.bytes;if(!ATLAS_PROTECTED.has(job.file)&&!(ATLAS_SCENE&&ATLAS_SCENE.active&&ATLAS_SCENE.atlasFiles.has(job.file))&&now-job.used>5000)available.push(job);}});
  available.sort(function(a,b){return a.used-b.used;});
  while(bytes>ATLAS_BUDGET&&available.length){
    var job=available.shift();if(ATLAS_JOBS.get(job.file)!==job)continue;
    ATLAS_JOBS.delete(job.file);if(ATL[job.file]===job.image)delete ATL[job.file];bytes-=job.bytes;
  }
  if(bytes>ATLAS_BUDGET&&!ATLAS_TRIM)ATLAS_TRIM=setTimeout(function(){ATLAS_TRIM=null;trimAtlasCache();},5100);
}
function pumpAtlasQueue(){
  while(ATLAS_ACTIVE<ATLAS_MAX_ACTIVE&&ATLAS_QUEUE.length){
    var index=ATLAS_QUEUE.findIndex(function(job){return !job.background;});
    if(index<0){if(ATLAS_BACKGROUND_ACTIVE>=1)return;index=0;}
    var job=ATLAS_QUEUE.splice(index,1)[0];if(ATLAS_JOBS.get(job.file)!==job||job.phase!=='queued')continue;
    startAtlasJob(job);
  }
}
function startAtlasJob(job){
  ATLAS_ACTIVE++;job.phase='load';var image=job.image,settled=false,background=job.background;
  if(background)ATLAS_BACKGROUND_ACTIVE++;
  function clean(){clearTimeout(job.timer);image.removeEventListener('load',loaded);image.removeEventListener('error',failed);}
  function finish(error){
    if(settled)return;settled=true;clean();ATLAS_ACTIVE--;if(background)ATLAS_BACKGROUND_ACTIVE--;
    if(error){job.phase='failed';job.error=error;job.retryAt=performance.now()+5000;job.reject(error);}
    else{job.phase='ready';job.bytes=image.naturalWidth*image.naturalHeight*4;job.used=performance.now();ATL_LOADS++;job.resolve(image);if(typeof requestTerrainRedraw==='function')requestTerrainRedraw();}
    notifyAtlasSubscribers(job);pumpAtlasQueue();trimAtlasCache();
  }
  function failed(){finish(new Error('Atlas load failed: '+job.file));}
  function loaded(){
    if(settled)return;if(!image.naturalWidth)return failed();job.phase='decode';
    Promise.resolve().then(function(){return typeof image.decode==='function'?image.decode():undefined;}).then(function(){finish();},function(error){finish(new Error('Atlas decode failed: '+job.file+' ('+String(error)+')'));});
  }
  image.addEventListener('load',loaded);image.addEventListener('error',failed);
  job.timer=setTimeout(function(){var phase=job.phase;finish(new Error('Atlas '+phase+' timed out: '+job.file));if(job.phase==='failed')image.src='';},ATLAS_TIMEOUT);
  if(job.adopted){if(image.complete){if(image.naturalWidth)loaded();else failed();}}
  else image.src='art/packed/'+job.file+(window.ASSETS&&ASSETS.build?'?v='+ASSETS.build:'');
}
function requestAtlas(file,options){
  var job=ATLAS_JOBS.get(file),now=performance.now(),scope=ATLAS_BACKGROUND_SCOPE&&ATLAS_BACKGROUND_SCOPE.active?ATLAS_BACKGROUND_SCOPE:null;
  var owner=scope||ATLAS_DRAW_SCOPE;
  if(owner&&owner.active&&owner===ATLAS_SCENE)owner.atlasFiles.add(file);
  if(job&&job.phase==='failed'&&(options&&options.retry||now>=job.retryAt)){ATLAS_JOBS.delete(file);if(ATL[file]===job.image)delete ATL[file];job=null;}
  if(job){
    job.used=now;ATL[file]=job.image;
    if(scope&&job.background)job.backgroundOwners.add(scope);
    else if(!scope&&job.background){job.background=false;job.backgroundOwners.clear();pumpAtlasQueue();}
    return job;
  }
  var image=ATL[file],adopted=!!image;
  if(!image)image=new Image();
  job={file:file,image:image,adopted:adopted,phase:'queued',used:now,bytes:0,error:null,background:!!scope,backgroundOwners:new Set(scope?[scope]:[])};
  job.promise=new Promise(function(resolve,reject){job.resolve=resolve;job.reject=reject;});
  job.promise.catch(function(){});ATLAS_JOBS.set(file,job);ATL[file]=image;ATLAS_QUEUE.push(job);pumpAtlasQueue();return job;
}
function atlReady(file,options){return requestAtlas(file,options).promise;}
function atlasLoadDiagnostics(){
  var files=[],failures=[],bytes=0;
  ATLAS_JOBS.forEach(function(job){files.push({file:job.file,phase:job.phase,bytes:job.bytes});if(job.phase==='ready')bytes+=job.bytes;if(job.error)failures.push({file:job.file,phase:job.phase,message:job.error.message});});
  return {active:ATLAS_ACTIVE,backgroundActive:ATLAS_BACKGROUND_ACTIVE,queued:ATLAS_QUEUE.length,readyBytes:bytes,maxActive:ATLAS_MAX_ACTIVE,budgetBytes:ATLAS_BUDGET,sceneFiles:ATLAS_SCENE&&ATLAS_SCENE.active?Array.from(ATLAS_SCENE.atlasFiles):[],failures:failures,files:files};
}
function atl(file){
  var job=requestAtlas(file);return job.phase==='ready'?job.image:null;
}
function hash2(x,y,s){ var h=(x*374761393 + y*668265263 + (s||0)*2147483647)|0; h=(h^(h>>>13))*1274126177|0; return ((h^(h>>>16))>>>0)/4294967295; }

/* ---- sprite lookups ---- */
var PACKED_OBJECT_GROUPS=['props','chests','structures','traps','items','terrain','icons'];
function packedObjectSpec(group,name){
  if(group==='items'&&name==='item-hawaiian-shirt')group='hawaiian-shirt';
  if(group==='icons'&&AS.map&&AS.map[name]&&AS.map[name].items[name])group=name;
  /* 2026-10-05 (item art): not while the knife has a picture on environment-items.webp. That sheet answers the 'items' group
     only, and the hotbar asks through 'icons', so a knife on the hotbar still loaded the 6 MiB painting and drew from it.
     No packed picture answers for it then: under it on map-items.webp sits the old censer bowl, a different object, which
     showed whenever the new sheet was out of memory. Nothing is drawn until that sheet is back. */
  if(name==='item-censer'){
    if(typeof FoteEnvironmentProps!=='undefined'&&FoteEnvironmentProps.source&&FoteEnvironmentProps.source('items',name))return null;
    group='knife';name='ceremonial-knife';   /* the icon only: the knife in the hand is the 64px held-censer (2026-09-27, D2a) */
  }
  if(group==='structures'&&name==='stairs-up'&&AS.map&&AS.map.stairs)group='stairs';
  if(group==='props'&&name==='weapon-rack'&&AS.map&&AS.map.rack)group='rack';
  var g=AS.map && AS.map[group]; if(!g || !g.items[name]) return null;
  return {file:'map-'+group+'.webp',box:g.items[name],cell:g.cell};
}
function packedObjectReady(group,name,fallback){
  /* Shrine selectors prefer the 256px set art over map-tile thumbnails. */
  var spec=typeof name==='string'&&name.indexOf('shrine-')===0&&AS.map&&AS.map.set&&AS.map.set.items[name]?
    packedObjectSpec('set',name):packedObjectSpec(group,name);
  if(!spec&&fallback)PACKED_OBJECT_GROUPS.some(function(candidate){spec=packedObjectSpec(candidate,name);return !!spec;});
  return spec?atlReady(spec.file):null;
}
/* Use the same metadata/spec owners as synchronous lookup. A preferred source
 * may be pending while a packed thumbnail remains usable. No second cache. */
function packedObjectSources(group,name,fallback,painted){
  var groups=[group],files=[];
  if(typeof name==='string'&&name.indexOf('shrine-')===0&&AS.map&&AS.map.set&&AS.map.set.items[name])groups.unshift('set');
  function sources(candidate){
    var fresh=typeof FoteEnvironmentProps!=='undefined'&&FoteEnvironmentProps.source&&FoteEnvironmentProps.source(candidate,name);
    var spec=packedObjectSpec(candidate,name),out=[];
    if(fresh)out.push(fresh.file);if(spec&&out.indexOf(spec.file)<0)out.push(spec.file);return out;
  }
  groups.forEach(function(candidate){sources(candidate).forEach(function(file){if(files.indexOf(file)<0)files.push(file);});});
  if(!files.length&&fallback)PACKED_OBJECT_GROUPS.some(function(candidate){var found=sources(candidate);if(!found.length)return false;files=found;return true;});
  if(painted){var index=files.findIndex(function(file){return ATL[file]===painted.img;});if(index>=0)files=files.slice(0,index);}
  return files;
}
function packedObjectArt(group, name){
  if(group==='props'&&(name==='lever-up'||name==='lever-down')&&FoteEnvironmentProps.source(group,name)){
    // These two paintings have separate lazy PNGs. Warm the other pose and
    // retain this lever's matching painting while it loads, never an old icon.
    var pose=FoteEnvironmentProps.art(group,name);
    var other=FoteEnvironmentProps.art(group,name==='lever-up'?'lever-down':'lever-up');
    return pose||other||null;
  }
  var fresh=FoteEnvironmentProps.art(group,name); if(fresh) return fresh;   /* the environment-props atlases first */
  var spec=packedObjectSpec(group,name);if(!spec)return null;
  var img=atl(spec.file); if(!img) return null;
  var b=spec.box;
  return {img:img, sx:b[0]+b[2], sy:b[1]+b[3], sw:Math.max(1,b[4]), sh:Math.max(1,b[5]), cell:spec.cell};   /* cell: the atlas cell, for icon framing (ui.js paintIconArt) */
}
function anyObj(name){
  var groups=PACKED_OBJECT_GROUPS;
  for(var i=0;i<groups.length;i++){ var o=objArt(groups[i],name); if(o) return o; }
  return null;
}
/* Cached silhouettes for hit flashes and sprite edges. 2026-09-27: the cache never evicted (16.8 MiB in
   5.5 s of goblin idle frames); it now keeps the 128 most recently drawn. */
var WHITE_CACHE=new Map(), WHITE_CACHE_MAX=128;
function whiteCut(img, sx,sy,sw,sh,color){
  var key=img.src+'|'+sx+','+sy+','+sw+','+sh+'|'+(color||'#fff'), c=WHITE_CACHE.get(key);
  if(c){ WHITE_CACHE.delete(key); WHITE_CACHE.set(key,c); return c; }
  c=document.createElement('canvas'); c.width=sw; c.height=sh;
  var g=c.getContext('2d'); g.drawImage(img,sx,sy,sw,sh,0,0,sw,sh);
  g.globalCompositeOperation='source-in'; g.fillStyle=color||'#fff'; g.fillRect(0,0,sw,sh);
  WHITE_CACHE.set(key,c); if(WHITE_CACHE.size>WHITE_CACHE_MAX) WHITE_CACHE.delete(WHITE_CACHE.keys().next().value);
  return c;
}
/* 2026-10-05 (item art, C1): whole-number nearest-neighbour copies of 64px loot, for drawObjectSprite below. Bounded like
   WHITE_CACHE: the 32 most recently drawn. A copy is the art's trimmed box times k each way, at most (64k)^2 pixels:
   64 KiB at k 2, 144 KiB at k 3. None is made at pixel ratio 1. Measured with 48 different pieces of loot on one
   screen before the 1080p rule below: the full 32 and 1.07 MiB on a pixel-ratio 2 laptop. */
var LOOT_UP=new Map(), LOOT_UP_MAX=64;
function lootCopy(o,k){
  var key=o.img.src+'|'+o.sx+','+o.sy+','+o.sw+','+o.sh+'x'+k, c=LOOT_UP.get(key);
  if(c){ LOOT_UP.delete(key); LOOT_UP.set(key,c); return c; }
  c=document.createElement('canvas'); c.width=o.sw*k; c.height=o.sh*k;
  var g=c.getContext('2d'); g.imageSmoothingEnabled=false; g.drawImage(o.img,o.sx,o.sy,o.sw,o.sh,0,0,c.width,c.height);
  LOOT_UP.set(key,c); if(LOOT_UP.size>LOOT_UP_MAX) LOOT_UP.delete(LOOT_UP.keys().next().value);
  return c;
}
/* draw a trimmed object in a tile. fit: fraction of the tile; feet: stand on the tile's lower edge */
/* Adapted from render/place.js at fb69933: round destination edges together, not each size separately. */
function placementRect(x,y,w,h){
  var left=Math.round(x),top=Math.round(y);
  return {x:left,y:top,w:Math.max(1,Math.round(x+w)-left),h:Math.max(1,Math.round(y+h)-top)};
}
function drawObjectSprite(o, px, py, opt){
  if(!o) return false;
  opt=opt||{};
  var fit=(opt.fit||0.92)*TS, s=Math.min(fit/o.sw, fit/o.sh);
  if(opt.fill){ s=Math.max(TS/o.sw, TS/o.sh); }
  var w=o.sw*s, h=o.sh*s*(1+(opt.sy||0));
  var dx=px+(TS-w)/2, dy= opt.feet ? py+TS*(opt.base||0.96)-h : py+(TS-h)/2;
  var rect=placementRect(dx,dy,w,h); dx=rect.x;dy=rect.y;w=rect.w;h=rect.h;
  ctx.save();
  ctx.globalAlpha=(opt.alpha===undefined?1:opt.alpha);
  ctx.imageSmoothingEnabled = s<1 || (o.res||1)>1;
  /* 2026-10-05 (item art, C1): 64px loot on the floor chose its filter from the CSS scale alone, so on a pixel-ratio 2 or 3
     screen art the page shrinks (s under 1) was blown up through the smoothing filter. When the real device scale enlarges
     such art, it now draws from a whole-number copy, so the one filtered step only shrinks, at 'high' (the rule ui.js
     paintIconArt and equip.js drawHeld already use). Loot in 64px cells only: a rune has no cell and a 128px picture says
     128, so both keep the line above. Art the page itself enlarges (s 1 or more) keeps the hard pixels of the line above:
     a copy there measured softer than today (review, same day), so a pixel-ratio 1 screen draws exactly as before. */
  var src=o;
  if(opt.loot && o.cell===64 && s<1){
    var lt=ctx.getTransform(), lf=s*Math.max(Math.hypot(lt.a,lt.b), Math.hypot(lt.c,lt.d));
    if(lf>1+1e-6){ var lc=lootCopy(o, Math.ceil(lf-1e-6)); src={img:lc, sx:0, sy:0, sw:lc.width, sh:lc.height}; ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality='high'; }
  }
  if(opt.flip){ ctx.translate(dx+w/2,0); ctx.scale(-1,1); ctx.translate(-(dx+w/2),0); }
  if(opt.outline){
    var cut=whiteCut(o.img,o.sx,o.sy,o.sw,o.sh), edge=Math.max(1,Math.round(TS/40));
    ctx.globalAlpha=(opt.alpha===undefined?1:opt.alpha)*0.11;
    [[-edge,0],[edge,0],[0,-edge],[0,edge],[-edge,-edge],[edge,-edge],[-edge,edge],[edge,edge]].forEach(function(d){ctx.drawImage(cut,dx+d[0],dy+d[1],w,h);});
    ctx.globalAlpha=(opt.alpha===undefined?1:opt.alpha);
  }
  ctx.drawImage(src.img, src.sx,src.sy,src.sw,src.sh, dx,dy,w,h);
  if(opt.flash>0){ ctx.globalAlpha*=opt.flash; ctx.drawImage(whiteCut(o.img,o.sx,o.sy,o.sw,o.sh), dx,dy,w,h); }
  ctx.restore();
  return true;
}
function tileFrom(key, i){
  var t=AS[key]; if(!t) return null; var img=atl(key==='floor2'?'floor2.webp':key+'.webp'); if(!img) return null;
  var c=t.tiles[i]; if(!c) return null; return {img:img, sx:c[0], sy:c[1], sw:t.cell, sh:t.cell};
}
/* 2026-09-27 (render plan step 23): a tile covers exactly its own device pixels. Its edges are rounded where they land
   on screen (camera offset, zoom and pixel ratio included), so neighbours share each edge: no seam between them, and no
   0.6px strip painted twice (with Lighting off that drew a lighter grid over remembered floor). */
var TILE_FRAME=null;   /* drawScene's transform, read once per frame (a read per tile cost 4us, 2 ms a frame on a phone) */
function tileRect(px, py){
  var m=TILE_FRAME && TILE_FRAME.ctx===ctx ? TILE_FRAME.m : ctx.getTransform();
  /* the nudge keeps an edge exactly on a half pixel on one side for both tiles that share it (their float sums differ) */
  function edge(v,scale,offset){ return (Math.round(v*scale+offset+1e-6)-offset)/scale; }
  var x0=edge(px,m.a,m.e), y0=edge(py,m.d,m.f);
  return {x:x0, y:y0, w:edge(px+TS,m.a,m.e)-x0, h:edge(py+TS,m.d,m.f)-y0};
}
function blitSpriteTile(o, px, py, alpha){
  if(!o) return false;
  var r=tileRect(px,py);
  ctx.globalAlpha=alpha; ctx.imageSmoothingEnabled=true;
  ctx.drawImage(o.img,o.sx,o.sy,o.sw,o.sh,r.x,r.y,r.w,r.h);
  return true;
}

/* dynamic lighting can be switched off from the sandbox (Light field). 2026-09-28 (frame cost): a frame asks for every
   tile (memA) and each ask read localStorage, 2.6% of a frame; a frame now reads the option once, as it starts. */
var LIGHT_FRAME=null;
function lightingOn(){ if(LIGHT_FRAME!==null) return LIGHT_FRAME; try { return localStorage.getItem('astra-temple-light')!=='off'; } catch(e){ return true; } }
/* what a frame reads once instead of per tile: the lighting option, and map, MW and MH for at(), inb() and idxOf()
   (js/runtime/game.js). Returns the undo, for the frame's finally. */
function holdFrameState(){
  var keep=[FRAME_MAP,FRAME_MW,FRAME_MH,LIGHT_FRAME];
  FRAME_MAP=null; LIGHT_FRAME=null;
  var m=map, w=MW, h=MH, light=lightingOn();
  FRAME_MAP=m||null; FRAME_MW=w; FRAME_MH=h; LIGHT_FRAME=light;
  return function(){ FRAME_MAP=keep[0]; FRAME_MW=keep[1]; FRAME_MH=keep[2]; LIGHT_FRAME=keep[3]; };
}

/* the colour behind each condition's icon: light where the art is dark, deep where the art is pale */
var STATUS_CHIP = {challenged:'#E8B44A', coward:'#E8B44A', burn:'#FFC27A', chill:'#BFE4F0', frozen:'#DCF2FF', root:'#C8E0A0', stun:'#FFE9A8', fear:'#C8B4E0',
                   blind:'#FFFFFF', poison:'#C6E39A', web:'#E4DCF0', slow:'#E4DCF0', bleed:'#F0B0B0'};

/* ---- terrain choices ---- */
var FLOOR_PLAIN=[0,12], FLOOR_ACCENT=[2,2,6,6,14,10,11,15,9,1,3,7,13,5];
function atlasFloorTile(x,y){
  var h=hash2(x,y,floorNo);
  if(h<0.93) return tileFrom('floor', FLOOR_PLAIN[Math.floor(hash2(x,y,7)*FLOOR_PLAIN.length)]);
  return tileFrom('floor', FLOOR_ACCENT[Math.floor(hash2(y,x,3)*FLOOR_ACCENT.length)]);
}
var WALL_TOP=[0,4,3,7], WALL_FACE=[11,13,15,8,11,13], WALL_FACE_RARE=[1,2,6,9,10,12];
function atlasWallTile(x,y){
  var south=at(x,y+1), faceBelow = !(south===WALL || south===SECRET) ;
  if(at(x,y)===SECRET) return faceBelow ? tileFrom('walls',14) : tileFrom('walls',WALL_TOP[0]);
  if(faceBelow){
    var h=hash2(x,y,11);
    if(h<0.12) return tileFrom('walls', WALL_FACE_RARE[Math.floor(hash2(x,y,5)*WALL_FACE_RARE.length)]);
    return tileFrom('walls', WALL_FACE[Math.floor(hash2(x,y,9)*WALL_FACE.length)]);
  }
  return tileFrom('walls', WALL_TOP[Math.floor(hash2(x,y,13)*WALL_TOP.length)]);
}
function isWallLike(t){ return t===WALL || t===SECRET; }
/* 2026-09-19: remembered tiles were faded one tile at a time, which drew the edge of what you can see as a
   staircase of squares. With lighting on, the lightmap's (blurred) memory tone does that darkening smoothly,
   so tiles draw at full strength; with lighting off they keep the old fade. */
function memA(fade){ return (typeof lightingOn==='function' && lightingOn()) ? 1 : fade; }
var TILE_SPRITE = {};
function baseTileSprite(x,y,t){
  /* 2026-09-19: a door set in a wall that runs up-down (walls above and below it) is seen edge-on */
  var sideDoor = (t===DOOR || t===LOCKED) && isWallLike(at(x,y-1)) && isWallLike(at(x,y+1)) && !(isWallLike(at(x-1,y)) && isWallLike(at(x+1,y)));
  if(t===DOOR) return (sideDoor && objArt('structures','door-wood-side')) || objArt('structures','door-wood');
  if(t===OPEN) return null;   /* open doors are drawn as jambs + a swung leaf, see drawOpenDoor */
  if(t===LOCKED) return (sideDoor && objArt('structures','door-iron-side')) || objArt('structures','door-iron');
  if(t===TOLL) return objArt('structures','door-spiked');
  if(t===ICEDOOR) return objArt('structures','door-ice') || objArt('props','ice-block');
  if(t===THORNS) return objArt('structures','door-thorns') || objArt('props','vines');
  if(t===SEALED&&propAt(x,y)&&propAt(x,y).eventGate)return objArt('props','portcullis-closed');
  if(t===SEALED) return (floorMeta && floorMeta.crystalDoor && floorMeta.crystalDoor.x===x && floorMeta.crystalDoor.y===y && objArt('structures','door-crystal')) || objArt('structures','door-iron');
  if(t===STAIRS) return objArt('structures','stairs-down');
  if(t===CHEST) { var k=chestKind[idxOf(x,y)]||'chest-wood'; return objArt('chests', k==='mimic'?'chest-wood':k); }
  if(t===FORGE) return setArt('forge-lit') || objArt('structures','forge-lit') || objArt('structures','forge-cold');
  if(t===SHRINE) return objArt('structures', (GODS[RUN.shrineGod]||{}).sprite) || objArt('structures','shrine');
  if(t===EXIT) return objArt('structures','exit-gate') || objArt('structures','archway');
  if(t===RUBBLE) return objArt('props','rubble');
  if(t===BRIDGE){   /* chasm to the left and right: the bridge runs up-down */
    var lr = (at(x-1,y)===CHASM || at(x+1,y)===CHASM) && !(at(x,y-1)===CHASM || at(x,y+1)===CHASM);
    return (lr && objArt('structures','bridge-v')) || objArt('structures','bridge');
  }
  return null;
}

var OPEN_DOOR_APERTURES=new WeakMap();
function openDoorAperture(art){
  var entries=OPEN_DOOR_APERTURES.get(art.img),key=[art.sx,art.sy,art.sw,art.sh].join(',');
  if(entries&&entries[key])return entries[key];
  if(!entries){entries={};OPEN_DOOR_APERTURES.set(art.img,entries);}
  var c=document.createElement('canvas');c.width=art.sw;c.height=art.sh;
  var g=c.getContext('2d',{willReadFrequently:true});g.drawImage(art.img,art.sx,art.sy,art.sw,art.sh,0,0,c.width,c.height);
  var pixels=g.getImageData(0,0,c.width,c.height).data,path=new Path2D(),mid=Math.floor(c.width/2);
  function clear(x,y){return pixels[(y*c.width+x)*4+3]<32;}
  // Scan once per source crop. Only the transparent space enclosed by both
  // stone jambs is floor; exterior alpha continues to show the wall backing.
  for(var y=0;y<c.height;y++){
    if(!clear(mid,y))continue;
    var left=mid,right=mid;while(left>=0&&clear(left,y))left--;while(right<c.width&&clear(right,y))right++;
    if(left>=0&&right<c.width)path.rect(left+1,y,right-left-1,1);
  }
  entries[key]=path;return path;
}
function drawOpenDoorFloor(art,rect,x,y,px,py,alpha,floor){
  if(!floor)return;
  ctx.save();ctx.beginPath();ctx.rect(px,py,TS,TS);ctx.clip();
  ctx.translate(rect.x,rect.y);ctx.scale(rect.w/art.sw,rect.h/art.sh);ctx.clip(openDoorAperture(art));
  ctx.scale(art.sw/rect.w,art.sh/rect.h);ctx.translate(-rect.x,-rect.y);
  blitTile(floor,px,py,alpha);ctx.restore();
}
/* 2026-09-27 (Justin, render plan Q22): an opened door keeps its closed door's material, recorded by setT (js/runtime/game.js) as
   it opens; every door used to open onto the wooden arch. Wood and iron have painted open states, and a spiked or
   thorn-grown door is a wooden leaf; ice melts away, and crystal and Crypt doors have no painted open state yet, so
   those leave the bare stone arch. [closed art, open art] */
var DOOR_ART = {wood:['door-wood','door-wood-open'], spiked:['door-spiked','door-wood-open'], thorns:['door-thorns','door-wood-open'],
                iron:['door-iron','door-iron-open'], ice:['door-ice','archway'], crystal:['door-crystal','archway'], crypt:['crypt-door','archway']};
function doorMaterial(x, y){
  var t=at(x,y);
  if(t===DOOR) return typeof inCrypt==='function' && inCrypt() ? 'crypt' : 'wood';
  if(t===SEALED) return floorMeta && floorMeta.crystalDoor && floorMeta.crystalDoor.x===x && floorMeta.crystalDoor.y===y ? 'crystal' : 'iron';
  return t===LOCKED ? 'iron' : t===TOLL ? 'spiked' : t===ICEDOOR ? 'ice' : t===THORNS ? 'thorns' : null;
}
/* an open door's material; a floor saved before 2026-09-27 knows only its iron-key doors */
function openDoorMaterial(x, y){ var i=idxOf(x,y); return (floorMeta.doorMaterials && floorMeta.doorMaterials[i]) || (floorMeta.ironDoors && floorMeta.ironDoors[i] ? 'iron' : 'wood'); }
/* an open door: stone jambs flush with the wall, the leaf swung back against one side */
function drawOpenDoor(x, y, px, py, alpha){
  var wallsLR = isWallLike(at(x-1,y)) || isWallLike(at(x+1,y));
  var art = DOOR_ART[openDoorMaterial(x,y)] || DOOR_ART.wood, iron = art[1]==='door-iron-open';
  // The object atlas has matching open arches. Previously OPEN bypassed it
  // entirely, replacing the new stone frame with a solid procedural plank.
  // A matched open arch keeps the closed frame's destination bounds so opening
  // cannot resize or move the doorway; the bare arch keeps its own.
  if(wallsLR&&spriteOn){
    var openArt=objArt('structures',art[1]),closedArt=art[1]==='archway'?openArt:objArt('structures',art[0]);
    if(openArt&&closedArt){
      var scale=Math.max(TS/closedArt.sw,TS/closedArt.sh),w=closedArt.sw*scale,h=closedArt.sh*scale;
      var rect=placementRect(px+(TS-w)/2,py+(TS-h)/2,w,h);
      var floor=typeof FoteEnvironmentTerrain!=='undefined'&&FoteEnvironmentTerrain.floorSample?FoteEnvironmentTerrain.floorSample(x,y):atlasFloorTile(x,y);
      drawOpenDoorFloor(openArt,rect,x,y,px,py,alpha,floor);
      ctx.save();ctx.globalAlpha=alpha;ctx.imageSmoothingEnabled=true;
      ctx.drawImage(openArt.img,openArt.sx,openArt.sy,openArt.sw,openArt.sh,rect.x,rect.y,rect.w,rect.h);
      ctx.restore();return;
    }
  }
  var jamb='#5C554C', jambHi='#7A7266', jambLo='#2A2622', leaf= iron ? '#6E7078' : '#6B4726', leafHi= iron ? '#9A9CA4' : '#8A5E34', band= iron ? '#3A3C44' : '#3A2614';
  ctx.save(); ctx.globalAlpha=alpha;
  var j=Math.max(3, Math.round(TS*0.16));
  if(wallsLR){
    /* passage runs north-south: jambs on the left and right edges */
    [[px,0],[px+TS-j,1]].forEach(function(p){
      ctx.fillStyle=jamb; ctx.fillRect(p[0],py,j,TS);
      ctx.fillStyle=jambHi; ctx.fillRect(p[0],py,j,2);
      ctx.fillStyle=jambLo; ctx.fillRect(p[1]?p[0]:p[0]+j-1,py,1,TS);
    });
    /* the leaf, swung open against the left jamb, seen edge-on as a thick plank */
    var lw=Math.max(3, Math.round(TS*0.14)), lx=px+j;
    ctx.fillStyle='rgba(0,0,0,.35)'; ctx.fillRect(lx+lw,py+TS*0.08,2,TS*0.84);
    ctx.fillStyle=leaf; ctx.fillRect(lx,py+TS*0.06,lw,TS*0.86);
    ctx.fillStyle=leafHi; ctx.fillRect(lx,py+TS*0.06,1,TS*0.86);
    ctx.fillStyle=band; ctx.fillRect(lx,py+TS*0.24,lw,2); ctx.fillRect(lx,py+TS*0.7,lw,2);
  } else {
    /* passage runs east-west: lintel along the top edge and a threshold along the bottom */
    ctx.fillStyle=jamb; ctx.fillRect(px,py,TS,j);
    ctx.fillStyle=jambHi; ctx.fillRect(px,py,TS,2);
    ctx.fillStyle=jambLo; ctx.fillRect(px,py+j-1,TS,1);
    ctx.fillStyle='rgba(0,0,0,.25)'; ctx.fillRect(px,py+TS-3,TS,3);
    /* the leaf swung back along the top wall, seen from above */
    var lh=Math.max(3, Math.round(TS*0.18));
    ctx.fillStyle='rgba(0,0,0,.35)'; ctx.fillRect(px+TS*0.08,py+j+lh,TS*0.8,2);
    ctx.fillStyle=leaf; ctx.fillRect(px+TS*0.06,py+j,TS*0.82,lh);
    ctx.fillStyle=leafHi; ctx.fillRect(px+TS*0.06,py+j,TS*0.82,1);
    ctx.fillStyle=band; ctx.fillRect(px+TS*0.24,py+j,2,lh); ctx.fillRect(px+TS*0.66,py+j,2,lh);
  }
  ctx.restore();
}

/* ---- dual-grid overlays for water and chasm (corner-based wang tiles) ---- */
function drawAtlasWangLayer(key, tileType){
  var set=AS['wang_'+key];
  // Procedural terrain registers a marker, not a loadable atlas. A cold
  // fallback must neither request that nonexistent file nor draw an undecoded image.
  if(!set || set.procedural)return;
  var img=atl('wang-'+key+'.webp');
  if(!img || !img.complete || !img.naturalWidth)return;
  var all=revealAll&&!playerBlind();
  for(var vy=camY; vy<=camY+viewH+1; vy++) for(var vx=camX; vx<=camX+viewW+1; vx++){
    var c=[[vx-1,vy-1],[vx,vy-1],[vx-1,vy],[vx,vy]], any=false, known=false, lit=false, bits='';
    for(var i=0;i<4;i++){
      var cx=c[i][0], cy=c[i][1], on = inb(cx,cy) && (at(cx,cy)===tileType || (tileType===CHASM && at(cx,cy)===BRIDGE));
      if(on) any=true;
      if(inb(cx,cy)){ if(all||seen[idxOf(cx,cy)]) known=true; if(all||vis[idxOf(cx,cy)]) lit=true; }
      bits += on ? '0' : '1';
    }
    if(!any || !known) continue;
    var px=(vx-camX)*TS - TS/2, py=(vy-camY)*TS - TS/2, a=lit?1:memA(0.42);
    if(img && set.tiles[bits]){ var tc=set.tiles[bits]; ctx.globalAlpha=a; ctx.imageSmoothingEnabled=true; ctx.drawImage(img,tc[0],tc[1],64,64,px,py,TS+0.6,TS+0.6); }
  }
  ctx.globalAlpha=1;
}

/* ---- tall grass: procedural blades that sway in a slow wind and part around whoever walks through ---- */
var GRASS_COLS = ['#1F3D1A','#2B5222','#3A6A2B','#4E8434','#6C9F42'];
function grassHash(x, y, k){ var h=(x*73856093) ^ (y*19349663) ^ (k*83492791); h=(h^(h>>>13))*1274126177; return ((h^(h>>>16))>>>0)/4294967296; }
function drawOrdinaryGrass(x, y, px, py, alpha, layer, now){
  var front = layer==='front';
  var stand = null;
  if(front){
    if(player && player.x===x && player.y===y) stand=player;
    else for(var i=0;i<ents.length;i++) if(ents[i].x===x && ents[i].y===y){ stand=ents[i]; break; }
  }
  ctx.save(); ctx.globalAlpha=alpha;
  var n = front ? 6 : 10, t = ANIM.reduce ? 0 : now/1000;
  var gust = Math.sin(t*0.9 + x*0.45 + y*0.2) * 0.5 + Math.sin(t*2.3 + x*1.3) * 0.18;
  ctx.lineCap='round';
  for(var b=0;b<n;b++){
    var r1=grassHash(x,y,b+(front?50:0)), r2=grassHash(x,y,b+100), r3=grassHash(x,y,b+200);
    /* back blades root across the tile, front blades root along its lower edge */
    /* blades grow in three tufts per tile so the patch reads as clumps, not a lawn */
    var tuft = b%3, tx0 = grassHash(x,y,300+tuft), ty0 = grassHash(x,y,400+tuft);
    var bx = px + TS*(0.12 + 0.76*tx0 + (r1-0.5)*0.22);
    var by = front ? py + TS*(0.92 + 0.08*r2) : py + TS*(0.35 + 0.55*ty0 + (r2-0.5)*0.08);
    var h = TS*(front ? 0.16 + 0.14*r3 : 0.26 + 0.24*r3);
    var sway = (gust + Math.sin(t*3.1 + r1*9)*0.12) * TS*0.12;
    if(stand){ sway += (bx < px+TS/2 ? -1 : 1) * TS*0.12; h *= 0.8; }   /* parted around a body */
    var lean = (r2-0.5)*TS*0.14;
    var tipx = bx + lean + sway, tipy = by - h;
    var col = GRASS_COLS[Math.min(4, Math.floor(r3*3) + (front?1:0) + (by>py+TS*0.7?1:0))];
    ctx.strokeStyle=col; ctx.lineWidth=Math.max(1.5, TS*(0.045 + 0.03*r1));
    ctx.beginPath(); ctx.moveTo(bx, by);
    ctx.quadraticCurveTo(bx + lean*0.3, by - h*0.55, tipx, tipy); ctx.stroke();
    if(r1>0.72){ ctx.strokeStyle=GRASS_COLS[4]; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(tipx, tipy); ctx.lineTo(tipx - lean*0.15, tipy + h*0.25); ctx.stroke(); }
  }
  ctx.restore();
}

/* thorny vines creeping across the floor: curling stems with leaves and pale thorns, gently stirring */
function drawVines(x, y, px, py, alpha, now){
  var H=function(k){ return grassHash(x,y,k); }, t=ANIM.reduce?0:now/1000;
  ctx.save(); ctx.globalAlpha=alpha; ctx.lineCap='round'; ctx.lineJoin='round';
  for(var v=0; v<4; v++){
    var ax=px+TS*(0.42+0.12*H(v)), ay=py+TS*(0.48+0.12*H(v+10));
    var bx=px+TS*(0.05+0.9*H(v+20)), by=py+TS*(0.1+0.8*H(v+30));
    var mx=(ax+bx)/2+(H(v+40)-0.5)*TS*0.6 + Math.sin(t*0.8+v)*TS*0.02, my=(ay+by)/2+(H(v+50)-0.5)*TS*0.6;
    ctx.strokeStyle='#263021'; ctx.lineWidth=Math.max(1,TS*0.028);
    ctx.beginPath(); ctx.moveTo(ax,ay); ctx.quadraticCurveTo(mx,my,bx,by); ctx.stroke();
    ctx.strokeStyle='#556043'; ctx.lineWidth=Math.max(0.5,TS*0.012);
    ctx.beginPath(); ctx.moveTo(ax,ay); ctx.quadraticCurveTo(mx,my,bx,by); ctx.stroke();
    for(var k=1;k<8;k++){
      var q=k/8, qx=(1-q)*(1-q)*ax+2*(1-q)*q*mx+q*q*bx, qy=(1-q)*(1-q)*ay+2*(1-q)*q*my+q*q*by;
      if(H(v*10+k+60)<0.85){
        var la=Math.atan2((1-q)*(my-ay)+q*(by-my),(1-q)*(mx-ax)+q*(bx-mx))+(k%2?1:-1)*0.9, lr=TS*(0.032+H(v*10+k+70)*0.025);
        ctx.fillStyle= H(v*10+k+80)<0.5 ? '#667044' : '#46573A';
        ctx.beginPath(); ctx.ellipse(qx+Math.cos(la)*lr*0.8, qy+Math.sin(la)*lr*0.8, lr, lr*0.45, la, 0, Math.PI*2); ctx.fill();
      } else {
        ctx.fillStyle='#8B8861'; var th=Math.max(.5,TS*0.014); ctx.fillRect(qx-th/2, qy-th*1.6, th, th*1.4);
      }
    }
  }
  ctx.restore();
}

/* ---- traps: set into the floor, drawn flat so they sit in the tile like the flagstones around them ---- */
function trapArtworkRect(art,px,py){
  // All trap mechanisms share an 80% tile footprint.
  // Give every discovered mechanism the same footprint, preserving aspect.
  var s=TS/64,w=art.sw/art.res*s,h=art.sh/art.res*s;
  var scale=TS*.8/Math.max(w,h);
  w*=scale;h*=scale;
  return placementRect(px+(TS-w)/2,py+(TS-h)/2,w,h);
}
function drawTrapArtwork(f,px,py,covered,t){
  var info=TRAPS[f.kind];
  if(!info||covered&&/^(dart|fire|gas|frost|spark)$/.test(f.kind))return false;
  var art=objArt('traps',info.sprite);if(!art)return false;
  var u=TS/32,r=trapArtworkRect(art,px,py),x=r.x,y=r.y,w=r.w,h=r.h;
  ctx.save();ctx.imageSmoothingEnabled=true;
  if(f.kind==='alarm'){
    // Separate only the hanging bell from its authored wire and posts. Its
    // existing sway keeps the same period and .8 logical-pixel amplitude.
    var bx=.405,by=.445,bw=.185,bh=1-by,shift=ANIM.reduce?0:Math.sin(t*5)*.8*u;
    ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.rect(x+bx*w,y+by*h,bw*w,bh*h);ctx.clip('evenodd');
    ctx.drawImage(art.img,art.sx,art.sy,art.sw,art.sh,x,y,w,h);ctx.restore();
    ctx.drawImage(art.img,art.sx+bx*art.sw,art.sy+by*art.sh,bw*art.sw,bh*art.sh,x+bx*w+shift,y+by*h,bw*w,bh*h);
  }else ctx.drawImage(art.img,art.sx,art.sy,art.sw,art.sh,x,y,w,h);
  ctx.restore();return true;
}
/* 2026-09-22 (Justin): a trap under a prop (a gas vent under a brazier) drew its sunken plate as a dark box around
   the prop's feet. Under a prop only what leaks out is drawn: a vent's glow and wisps, a spark trap's arc. */
function drawCoveredTrapEmission(f, px, py, alpha, t){
  var H=function(k){ return grassHash(f.x,f.y,k); }, u=TS/32;              /* u: one pixel of a 32px tile */
  var P=function(x,y,w,h,c){ ctx.fillStyle=c; ctx.fillRect(Math.round(px+x*u), Math.round(py+y*u), Math.ceil(w*u), Math.ceil(h*u)); };
  function glowDot(x, y, r, col, a){
    var g=ctx.createRadialGradient(px+x*u,py+y*u,0,px+x*u,py+y*u,r*u); g.addColorStop(0,hexA(col,a)); g.addColorStop(1,hexA(col,0));
    ctx.fillStyle=g; ctx.fillRect(px+(x-r)*u, py+(y-r)*u, 2*r*u, 2*r*u);
  }
  var k=f.kind, pulse=0.5+0.5*Math.sin(t*2.4 + f.x + f.y*1.7);
  if(k==='fire' || k==='gas' || k==='frost'){
    var col = k==='fire' ? '#FF7A30' : k==='gas' ? '#7FC05A' : '#9FD8FF';
    glowDot(16, 16, 9, col, 0.25+0.2*pulse);
    if(!ANIM.reduce) for(var w=0; w<3; w++){
      var ph=((t*0.6 + H(w)) % 1), wx=11+H(w+5)*10 + Math.sin(t*2+w)*1.5, wy=16 - ph*14;
      ctx.globalAlpha=alpha*(1-ph)*0.8; P(wx, wy, 2, 2, k==='frost' ? '#E6F6FF' : col); ctx.globalAlpha=alpha;
    }
  } else if(k==='spark'){
    var sc = pulse>0.75 ? '#FFF1A8' : '#E8B44A';
    [[17,10],[15,13],[18,14],[14,18],[16,21]].forEach(function(q,i2,arr){ if(i2) { var a=arr[i2-1]; ctx.strokeStyle=sc; ctx.lineWidth=Math.max(1.5,1.6*u); ctx.beginPath(); ctx.moveTo(px+a[0]*u,py+a[1]*u); ctx.lineTo(px+q[0]*u,py+q[1]*u); ctx.stroke(); } });
    glowDot(16, 16, 8, '#E8B44A', 0.15+0.25*pulse);
  } else if(k==='dart'){
    /* 2026-09-28 (Justin): a found dart trap under a prop (a bush) drew nothing at all, so spotting it chimed and showed
       no trap. Nothing leaks from a dart trap, so the steel tips of its darts show at the prop's feet, glinting. */
    var tip = pulse>0.7 ? '#FFF8EA' : '#D9D0BE';
    ctx.lineCap='round'; ctx.lineWidth=Math.max(1.5, 1.4*u);
    /* in the strip below a prop's leaves, clear of its trunk: bore x,y and tip x,y (a 32px tile) */
    [[4,31,2.5,27],[9,31.5,8,27.5],[23,31.5,24,27.5],[28,31,29.5,27]].forEach(function(q){
      ctx.fillStyle='rgba(12,9,8,.8)'; ctx.beginPath(); ctx.ellipse(px+q[0]*u, py+q[1]*u, 1.4*u, 0.8*u, 0, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle='#A49C8E'; ctx.beginPath(); ctx.moveTo(px+q[0]*u, py+(q[1]-0.3)*u); ctx.lineTo(px+q[2]*u, py+q[3]*u); ctx.stroke();
      glowDot(q[2], q[3], 2, '#FFF8EA', 0.1+0.3*pulse); P(q[2]-0.6, q[3]-0.6, 1.2, 1.2, tip);
    });
  }
}
/* 2026-09-27: the painted trap is the whole trap. The old procedural plates, grates, rune rings, webs, tripwires
   and pit boards are gone; Block Art glyphs and spikes are drawn by drawTrap (puzzles.js). */
function drawOrdinaryTrap(f, px, py, alpha, now){
  var t = ANIM.reduce ? 0 : now/1000, covered = typeof propAt==='function' && !!propAt(f.x,f.y);
  ctx.save(); ctx.globalAlpha=alpha;
  if(!drawTrapArtwork(f,px,py,covered,t) && covered) drawCoveredTrapEmission(f,px,py,alpha,t);
  ctx.restore();
}

/* a raised stone pillar (Amulet of the Pillar): drawn, with cracks showing as it nears crumbling */
function drawPillar(p, px, py, alpha, now){
  var left = Math.max(0, (p.until||0) - turn), u=TS/32;
  ctx.save(); ctx.globalAlpha=alpha;
  var w=TS*0.56, h=TS*1.05, x=px+(TS-w)/2, y=py+TS*0.92-h;
  var g=ctx.createLinearGradient(x,0,x+w,0); g.addColorStop(0,'#5A544C'); g.addColorStop(0.35,'#8C857A'); g.addColorStop(1,'#46403A');
  ctx.fillStyle=g; ctx.fillRect(x, y+u*3, w, h-u*3);
  ctx.fillStyle='#9C958A'; ctx.fillRect(x-u*2, y, w+u*4, u*4);
  ctx.fillStyle='#3A352F'; ctx.fillRect(x-u*2, y+u*4, w+u*4, u);
  ctx.fillStyle='#6E675D'; ctx.fillRect(x-u*2, py+TS*0.92-u*3, w+u*4, u*3);
  ctx.strokeStyle='rgba(20,16,12,.55)'; ctx.lineWidth=Math.max(1,u);
  for(var i=0;i<3;i++){ var yy=y+h*(0.3+0.22*i); ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x+w, yy+u); ctx.stroke(); }
  if(left<=4){ ctx.beginPath(); ctx.moveTo(x+w*0.3, y+u*5); ctx.lineTo(x+w*0.5, y+h*0.4); ctx.lineTo(x+w*0.35, y+h*0.7); ctx.stroke(); }
  ctx.restore();
}

/* ---- flat ground decals, drawn top-down so they sit in the floor instead of standing on it ---- */
function drawBaseGroundDecal(gv, x, y, px, py, alpha, now){
  var H=function(k){ return grassHash(x,y,k); }, i, a, r, cx, cy;
  ctx.save(); ctx.globalAlpha=alpha; ctx.lineCap='round';
  if(gv===G_SHORT){
    /* trampled grass: a few bent, flattened blades lying across the stone */
    /* the mat under the blades: a ragged cached field (surface.js), never a flat square of colour */
    if(typeof tramRaster==='function') blitRaster(cachedRaster('tr'+tramSig(x,y)+'@', x, y, tramRaster), px, py, alpha);
    else { ctx.fillStyle='rgba(30,52,22,.18)'; ctx.fillRect(px+TS*0.1,py+TS*0.1,TS*0.8,TS*0.8); }
    for(i=0;i<9;i++){
      cx=px+TS*(0.1+0.8*H(i)); cy=py+TS*(0.15+0.75*H(i+20)); a=(H(i+40)-0.5)*1.4 + (H(i+60)<0.5?0:Math.PI);
      r=TS*(0.14+0.14*H(i+80));
      ctx.strokeStyle=['#2B4A22','#3A5F2B','#51773A','#6A7F3E'][Math.floor(H(i+90)*4)];
      ctx.lineWidth=Math.max(1.5, TS*0.04);
      ctx.beginPath(); ctx.moveTo(cx,cy); ctx.quadraticCurveTo(cx+Math.cos(a)*r*0.6, cy+Math.sin(a)*r*0.6-TS*0.04, cx+Math.cos(a)*r, cy+Math.sin(a)*r+TS*0.02); ctx.stroke();
    }
    /* one or two short stubs still upright */
    for(i=0;i<3;i++){ cx=px+TS*(0.15+0.7*H(i+100)); cy=py+TS*(0.3+0.6*H(i+110));
      ctx.strokeStyle='#4E8434'; ctx.lineWidth=Math.max(1.5,TS*0.035); ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(cx+(H(i+120)-0.5)*TS*0.08, cy-TS*0.1); ctx.stroke(); }
  } else if(gv===G_ASH || gv===G_SCORCH){
    var ash = gv===G_ASH;
    var stain=cachedRaster((ash?'ash':'scorch')+'@',x,y,function(xx,yy){return scorchRaster(xx,yy,ash);});
    ctx.save();ctx.beginPath();
    // Burn residue spills onto neighbouring revealed floor, never walls or fog.
    var all=revealAll&&!playerBlind();
    for(var sy=-1;sy<=1;sy++)for(var sx=-1;sx<=1;sx++){
      var nx=x+sx,ny=y+sy,ng=gAt(nx,ny),nt=at(nx,ny);if((sx||sy)&&(ng===G_SCORCH||ng===G_ASH))continue;if(inb(nx,ny)&&nt!==CHASM&&!isWallLike(nt)&&(all||seen[idxOf(nx,ny)]))ctx.rect(px+sx*TS,py+sy*TS,TS,TS);
    }
    ctx.clip();ctx.imageSmoothingEnabled=true;ctx.drawImage(stain,px-TS*.25,py-TS*.25,TS*1.5,TS*1.5);ctx.restore();
    if(ash && !ANIM.reduce){ var glow=0.25+0.25*Math.sin(now/500+x*3+y); ctx.fillStyle='rgba(226,98,43,'+(glow*0.5)+')';
      ctx.fillRect(px+TS*(0.3+0.4*H(90)), py+TS*(0.3+0.4*H(91)), Math.max(1,TS*0.04), Math.max(1,TS*0.04)); }
  } else if(gv===G_PUDDLE){
    for(i=0;i<3;i++){ cx=px+TS*(0.3+0.4*H(i)); cy=py+TS*(0.35+0.3*H(i+10)); r=TS*(0.16+0.14*H(i+20));
      ctx.fillStyle='rgba(38,74,98,.62)'; ctx.beginPath(); ctx.ellipse(cx,cy,r*1.2,r*0.8,0,0,Math.PI*2); ctx.fill(); }
    var sh = ANIM.reduce ? 0 : Math.sin(now/700 + x + y*2)*TS*0.03;
    ctx.fillStyle='rgba(170,215,240,.35)'; ctx.fillRect(px+TS*0.36+sh, py+TS*0.4, TS*0.18, Math.max(1,TS*0.025));
  } else if(gv===G_BLOOD){
    for(i=0;i<6;i++){ cx=px+TS*(0.3+0.4*H(i)); cy=py+TS*(0.3+0.4*H(i+10)); r=TS*(i<2?0.12+0.08*H(i+20):0.03+0.04*H(i+20));
      if(i>=2){ cx+= (H(i+30)-0.5)*TS*0.5; cy+=(H(i+40)-0.5)*TS*0.5; }
      ctx.fillStyle= i<2 ? 'rgba(96,18,20,.75)' : 'rgba(120,24,24,.7)'; ctx.beginPath(); ctx.ellipse(cx,cy,r*1.2,r,H(i)*3,0,Math.PI*2); ctx.fill(); }
  } else if(gv===G_MOSS){
    for(i=0;i<16;i++){ ctx.fillStyle=['rgba(58,92,40,.55)','rgba(78,112,48,.5)','rgba(40,66,30,.6)'][i%3];
      r=TS*(0.05+0.07*H(i+50)); ctx.beginPath(); ctx.arc(px+TS*(0.1+0.8*H(i)), py+TS*(0.1+0.8*H(i+10)), r, 0, Math.PI*2); ctx.fill(); }
  } else if(gv===G_ICE){
    ctx.fillStyle='rgba(150,205,235,.28)'; ctx.beginPath(); ctx.ellipse(px+TS/2,py+TS/2,TS*0.46,TS*0.4,H(7),0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='rgba(230,248,255,.55)'; ctx.lineWidth=1;
    for(i=0;i<3;i++){ ctx.beginPath(); ctx.moveTo(px+TS*H(i), py+TS*H(i+5)); ctx.lineTo(px+TS*H(i+10), py+TS*H(i+15)); ctx.stroke(); }
  } else if(gv===G_TELL){
    for(i=0;i<3;i++){ ctx.strokeStyle='rgba(15,12,10,.45)'; ctx.lineWidth=Math.max(1,TS*0.03);
      cx=px+TS*(0.2+0.6*H(i)); cy=py+TS*(0.2+0.6*H(i+10));
      ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(cx+TS*0.18*(H(i+20)-0.3), cy+TS*0.14); ctx.lineTo(cx+TS*0.22, cy+TS*0.1*(H(i+30)-0.5)); ctx.stroke(); }
  } else if(gv===G_WEB){
    cx=px+TS*(0.4+0.2*H(1)); cy=py+TS*(0.4+0.2*H(2));
    ctx.strokeStyle='rgba(225,225,215,.5)'; ctx.lineWidth=1;
    for(i=0;i<7;i++){ a=i/7*Math.PI*2+H(3); ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(cx+Math.cos(a)*TS*0.5, cy+Math.sin(a)*TS*0.5); ctx.stroke(); }
    for(var ring=1;ring<=3;ring++){ ctx.beginPath(); for(i=0;i<=7;i++){ a=i/7*Math.PI*2+H(3); var rr=TS*0.13*ring; if(i===0) ctx.moveTo(cx+Math.cos(a)*rr, cy+Math.sin(a)*rr); else ctx.lineTo(cx+Math.cos(a)*rr, cy+Math.sin(a)*rr); } ctx.stroke(); }
  } else { ctx.restore(); return false; }   /* bones keep their sprite */
  ctx.restore(); return true;
}

/* ---- characters: cast sheets with clips ---- */
var CLIP_MS = {idle:130, walk:60, cast:65, ranged:65, melee:55, hurt:75, death:95, attack:60};
/* how long each action clip winds up before its projectile leaves or its blow connects */
var CLIP_WINDUP = {melee:170, attack:170, ranged:300, cast:260};
/* 2026-10-05 (Justin: 'the attack animations don't make sense for 2h weapons or spears'): every weapon played the melee
   row's nine frames in order at one speed, so no look had its strike out when the blow lands (the enemy flashes about
   297ms in) and none came back to its stand. A swing may play its row as a list of nine steps instead.
   CLIP_HOLD: how long each step shows, in 99ths of the clip (5ms each at 495ms; none under 34ms, one paint at an even
     30 a second): ready, two of wind-up, launch on the 170ms swing, reach, the strike held across the hit,
     follow-through, two back to the stand. Shares of the clip, so it is exactly as long as it was. At an Animation
     speed above 1x a step that would be shorter than a paint joins the step after it (clipFrame).
   CLIP_PLAY: the frame of the look's own row each step shows, by weapon family: pole (spear, staff), fist (bare hands),
     arm (every other weapon). lead: the rear arm never comes forward on this look, so a pole is thrust from the lead
     fist (equip.js heldSwing; interim, one hand). A look with no entry for a family has no strike frame for it and
     plays its row straight, as before: that is also how a look is put back on the old swing.
     The strike step holds the frame whose fist or weapon is out furthest: on five of the six men a bare lead fist is
     out on frame 7 and tucked again on 8, where the weapon hand's thrust lands. */
var CLIP_HOLD = {melee:[11,13,10,7,7,24,9,9,9], cast:[9,11,11,11,13,13,10,10,11], ranged:[8,8,8,8,9,14,14,15,15], death:[11,11,11,11,11,11,11,11,11]};
/* the step on which the blow lands, the bolt leaves or the arrow is loosed: with Motion off nothing winds up, so a list starts there */
var CLIP_LAUNCH = {melee:3, cast:4, ranged:5};
var CLIP_PLAY = (function(){
  var thrust={f:[0,4,5,6,7,8,7,5,1]}, men={fist:{f:[0,4,5,6,6,7,6,5,1]}, arm:thrust, pole:thrust};
  var lead=function(f){ return {f:f, lead:1}; }, jab={f:[0,2,3,3,4,4,3,2,1]}, lunge={f:[0,2,3,4,4,5,4,2,1]}, guard=lead([0,3,4,7,7,8,7,3,1]);
  return {
    'human-m':{fist:thrust, arm:thrust, pole:thrust}, 'gloomling-m':men, 'fae-air-m':men, 'fae-earth-m':men, 'fae-fire-m':men, 'fae-water-m':men,
    'elf-m':{pole:{f:[0,3,4,5,6,5,7,8,1]}}, 'elf-f':{pole:lead([0,2,3,4,5,6,7,8,1])},
    'dwarf-m':{fist:{f:[0,1,2,3,4,5,7,2,1]}, pole:lead([0,1,2,3,4,5,7,2,1])},
    'dwarf-f':{fist:{f:[0,1,1,2,3,6,7,8,1]}, pole:lead([0,1,1,2,3,6,7,8,1])},
    'fae-air-f':{fist:lunge, pole:guard}, 'fae-earth-f':{fist:lunge, pole:lead([0,3,4,7,8,7,8,3,1])},
    'fae-fire-f':{fist:jab, pole:guard}, 'fae-water-f':{pole:guard}, 'gloomling-f':{pole:guard},   /* fae-fire-f: her frame 5 is painted with a haze */
    'human-f':{pole:lead([0,2,3,6,7,8,7,3,1])},
    /* 2026-10-05 (slice 1c): the Chad looks punch with bare hands only. Seven of the fourteen have a frame whose fist is
       out, and their punch is held on the hit; the other seven have no such frame and play their row straight */
    'human-m-unclad':{fist:men.fist}, 'gloomling-m-unclad':{fist:men.fist},
    'elf-f-unclad':{fist:{f:[0,2,3,4,5,5,6,7,1]}}, 'fae-air-f-unclad':{fist:{f:[0,2,3,4,5,5,6,7,1]}}, 'fae-air-m-unclad':{fist:{f:[0,2,3,4,5,5,6,3,1]}},
    'fae-water-f-unclad':{fist:{f:[0,3,4,5,6,6,7,8,1]}}, 'fae-water-m-unclad':{fist:{f:[0,4,5,6,8,8,7,4,1]}}
  };
})();
/* 2026-10-05 (slice 1c; PLAN 6a item 14 as CRITIC amends it). The other rows play as lists too. Every list was chosen
   look by look from the frames themselves (boards/out/playback/NOTES.md says which and why); a look with no entry plays
   that row straight, as before, and taking an entry out puts the look back.
   cast   - out and back: the gather, the raised hand held across the release (260ms), then down again, so the clip ends
            near the stand and no frame with painted spell light is shown. The peak is the look's last frame with no
            paint on it: 5, 4 or 3, and 2 on the female Dwarf and the Water Fae Chad man, whose frame 3 is already lit.
            The clothed Fae and the Gloomling rows have no paint but drop their arms for one front-facing frame (6) mid-cast.
   ranged - the draw comes early and full draw is held through the release (300ms), then the bow comes down. Where the
            bow and arrow are painted into the row the step after the release goes to a frame with no arrow on the string.
   death  - starts on the look's own first frame of the fall and holds it a beat; the figure used to stand for two to
            five frames after the killing blow. The body lies still for what is left of the clip.
   idle   - the stand, as a loop of its calm frames forward then back (CLIP_MS.idle each; a frame twice is a hold), for
            the looks whose row turns the head to the camera, slides, or jumps where it loops. */
(function(){
  var up45=[0,1,2,3,4,5,4,3,1], up4=[0,1,2,3,4,4,4,3,1], up48=[0,1,2,3,4,4,8,3,1], up3=[0,1,2,2,3,3,2,1,0];
  var late=[0,3,4,5,6,7,8,4,1], lateF=[0,2,3,5,6,7,8,3,1];
  var fall2=[2,2,3,4,5,6,7,8,8], fall3=[3,3,4,5,6,7,8,8,8], fall4=[4,4,5,6,7,8,8,8,8], fall5=[5,5,6,6,7,7,8,8,8];
  var there=[0,1,2,3,4,5,6,7,8,7,6,5,4,3,2,1], calm3=[0,0,1,2,3,3,2,1], calm4=[0,0,1,2,3,4,4,3,2,1];
  var glance=[0,0,1,2,3,4,5,6,7,8,8,7,6,5,4,3,2,1];
  var rows={
    'human-m':{cast:up48, ranged:[0,3,4,5,6,7,3,3,0], death:fall4, idle:[0,0,8,8,7,7,8,8]},
    'human-f':{cast:up45, ranged:[0,2,4,5,6,7,3,2,1], death:fall4},
    'elf-m':{cast:up3, ranged:[0,3,4,5,7,8,7,3,1], death:fall4},
    'elf-f':{cast:up4, ranged:[0,2,3,4,5,6,3,2,1], death:fall3, idle:[0,1,2,3,4,5,6,7,7,6,5,4,3,2,1,0]},
    'dwarf-m':{cast:[0,1,2,2,3,3,7,8,0], ranged:[0,2,3,4,5,6,7,8,8], death:fall4},
    'dwarf-f':{cast:[0,1,1,2,2,2,8,8,0], ranged:[0,1,2,4,5,7,2,2,1], death:fall4, idle:there},
    'gloomling-m':{ranged:late, death:fall2}, 'gloomling-f':{cast:up45, ranged:lateF, death:fall2},
    /* the Air and Fire men's idle rows are the trim Justin approved on 09-27 and 09-28 ('a little turn would be fine'),
       and their sisters' glance at the camera is the gesture he likes on the Water Fae woman: all four rows play as they are */
    'fae-air-m':{cast:up45, ranged:late, death:fall4}, 'fae-air-f':{cast:up45, ranged:lateF, death:fall4},
    'fae-earth-m':{cast:up45, ranged:late, death:fall4, idle:calm3}, 'fae-earth-f':{cast:up45, ranged:lateF, death:fall4},
    'fae-fire-m':{cast:up45, ranged:late, death:fall4}, 'fae-fire-f':{cast:up45, ranged:lateF, death:fall4},
    'fae-water-m':{cast:up45, ranged:late, death:fall4, idle:[1,1,2,3,4,5,5,4,3,2]},
    /* Justin likes her idle: every frame is kept, in its own order, and it runs back instead of snapping to the start */
    'fae-water-f':{cast:up45, ranged:lateF, death:fall4, idle:glance},
    'human-m-unclad':{cast:up48, death:fall4}, 'human-f-unclad':{cast:up45, death:fall4, idle:[1,1,1,2,2,2]},
    'elf-m-unclad':{cast:up3, death:fall4}, 'elf-f-unclad':{cast:up4, death:fall3, idle:there},
    'gloomling-m-unclad':{cast:up45, death:fall4, idle:calm4}, 'gloomling-f-unclad':{cast:up45, death:fall4, idle:[0,0,1,3,4,5,6,7,8,8,7,6,5,4,3,1]},   /* the same glance, kept; frame 2 hops */
    'fae-air-m-unclad':{cast:[0,2,4,5,8,8,8,4,1], death:fall3}, 'fae-air-f-unclad':{cast:up4, death:fall3},
    'fae-earth-m-unclad':{cast:up3, death:fall5, idle:calm3}, 'fae-earth-f-unclad':{cast:up3, death:fall4},
    'fae-fire-m-unclad':{cast:[0,1,2,3,4,4,3,8,0], death:fall5, idle:[0,0,1,2,2,1]}, 'fae-fire-f-unclad':{cast:up3, death:fall4, idle:there},
    'fae-water-m-unclad':{cast:[0,1,1,2,2,2,2,1,0], death:fall4, idle:there}, 'fae-water-f-unclad':{cast:up45, death:fall3, idle:calm3}
  };
  Object.keys(rows).forEach(function(look){
    var r=rows[look], p=CLIP_PLAY[look]=Object.assign({}, CLIP_PLAY[look]);
    Object.keys(r).forEach(function(k){ p[k]=k==='idle' ? r[k] : {f:r[k]}; });
  });
})();
function clipPlay(look, clip){
  var p=CLIP_HOLD[clip.name] && CLIP_PLAY[look];
  if(clip.name!=='melee') return p && p[clip.name] || null;
  /* 2026-10-05: the off-hand swing of a dual wield is a jab of the lead hand, which is where that weapon is */
  return p && clip.art!==undefined && p[clip.off ? 'fist' : clip.art==='spear'||clip.art==='staff' ? 'pole' : clip.art ? 'arm' : 'fist'] || null;
}
/* 2026-10-06 (Justin: 'the attack animations don't make sense for 2h weapons or spears'). Every look's sheet now has
   body rows drawn for the move, under its still (tools/art/install-rows.py; each says which row it stands in for: old).
   The clip keeps its name, so the turn waits what it always did and no caller changes. Which row is drawn is chosen
   in clipFrame, where the play lists are already resolved: the one place that has the sheet, the clip, what swings and
   the clock in hand, and the one every drawer of the hero and his shadow asks for a frame. (These tables sit with
   CLIP_PLAY, above setClip, so the tests that cut the lists out of this file by its text take them along.)
   CLIP_ROW: the row an action plays, by its clip, and for a swing by what swings (fist: bare hands; the off-hand
     swing of a dual wield and every underwear look punch too). A look whose sheet lacks the row (none was picked for
     it, or it was taken out) plays its own row exactly as before, play list and all; a name taken out of this table
     does the same for every look. CLIP_ROW_OFF: a pattern of 'look row' names held back from their new rows (none):
     /-unclad / holds every underwear look back, /^fae-fire-m cast2$/ one row of one look.
   ROW_HOLD: how long each of the nine frames shows, in 99ths of the clip, as CLIP_HOLD (written here in ms of the
     585ms clip). A swing's rows use the swing's own list: wind-up before the launch at 170ms, the contact frame up
     from 240 to 360ms across the hit, the stand by 495. shoot: full draw from 230ms, and the release frame is up from
     298, as the arrow leaves (300ms). cast2: the open palm is out from 235 to 335ms, across the bolt (260ms). No step
     is under a paint (34ms). flinch has no list: it plays at the hurt row's own pace, five steps of 75ms.
   ROW_PLAY: the frame each step shows where that is not the step's own number. off: the off-hand swing of a dual wield
     is the lead hand's jab, frame 2 of the punch row, out by the launch and held across the hit. flinch: its frame
     0 is the stand, so the recoil shows as the blow lands and its deepest frame is held.
   ROW_LAUNCH: the step a list starts on with Motion off, where nothing winds up (by clip).
   2026-10-06, the final picks (Justin: 'Both runs, chosen by what's held'; the underwear looks are one drawing):
   walk   - two run rows, by what the main hand holds: run2, the arm drive, for bare hands, a one-hand weapon, a
            shield or a focus (and a bow, which rides the off hand); run, arms down, for a two-handed sword, an axe,
            a spear or a staff, which a pumping fist would wave about. An underwear look carries nothing: run2.
   idle   - idle2 on every look that has one (28 of 30), and its first frame is the stand with Motion off too.
   death  - death2, the fall of the underwear looks, at the death clip's own holds. Its frame 0 is the stand, so
            the fall starts on frame 1 and holds it a beat, as the old rows' lists do (ROW_PLAY).
   heavy  - on every look the row's frame 1 crosses the arms on the chest (the take 3 track): the wind-up, frame 2,
            is held from that step instead. The holds are the swing's own, so the clip is as long as it was and
            the contact frame is up across the hit as before.
   An underwear look never shows a row of its old drawing: its bellow, which names no weapon, punches too. */
var CLIP_ROW={melee:{fist:'punch', bow:'punch', spear:'thrust', staff:'thrust', longsword:'heavy', axe:'heavy', sword:'strike', mace:'strike', dagger:'strike', censer:'strike', wand:'strike'},
  walk:{fist:'run2', bow:'run2', sword:'run2', mace:'run2', dagger:'run2', censer:'run2', wand:'run2', longsword:'run', axe:'run', spear:'run', staff:'run'},
  ranged:'shoot', cast:'cast2', hurt:'flinch', idle:'idle2', death:'death2'}, CLIP_ROW_OFF=null;
var ROW_HOLD={shoot:[50,60,60,60,68,72,80,70,65], cast2:[45,60,65,65,100,70,60,55,65]}, ROW_PLAY={off:[0,1,1,2,2,2,1,1,0], flinch:[1,2,2,3,4], heavy:[0,2,2,3,4,5,6,7,8], death2:[1,1,2,3,4,5,6,7,8]}, ROW_LAUNCH={melee:3, ranged:5, cast:4};
Object.keys(ROW_HOLD).forEach(function(k){ ROW_HOLD[k]=ROW_HOLD[k].map(function(ms){ return ms*99/585; }); });
/* the added row this clip plays on this sheet (its name), or null: the sheet's own row plays */
function clipRow(sheet, name, clip){
  var r=CLIP_ROW[name], look=sheet.look;
  if(!r || !look) return null;
  var bare=/-unclad$/.test(look), tour=name==='melee' && /-tourist$/.test(look);   /* 2026-10-08: a tourist's old melee row is a plain copy, so a swing that names no weapon (a bellow) plays its punch row, as on the unclad looks */
  if(typeof r!=='string') r=!clip || (clip.art===undefined && !bare && !tour) ? null : r[clip.off || bare ? 'fist' : clip.art||'fist'];
  var c=r && sheet.m.clips && sheet.m.clips[r];
  return c && c.old===name && !(CLIP_ROW_OFF && CLIP_ROW_OFF.test(look+' '+r)) ? r : null;
}
/* the frame of added row r at q 99ths through its clip of T ms; f is the frame a row with no list is on. A row with a
   list names its step (equip.js turns the weapon by it). A step shorter than a paint joins the step after it, and
   what is left for the last steps, when that is shorter than a paint, joins the steps before it (Animation speed
   above 1x). add: the row's name, for the drawer. 2026-10-06: where the row has a frame list of its own (ROW_PLAY:
   heavy, death2) the step it names is the frame on screen, since the weapon is turned by the picture it is drawn on */
function clipRowFrame(m, r, clip, q, T, f){
  var c=m.clips[r], cell=m.cell, hold=ROW_HOLD[r]||CLIP_HOLD[clip.name], list=clip.off ? ROW_PLAY.off : ROW_PLAY[r];
  if(!hold) return {sx:(list ? list[f] : f)*cell, sy:c.row*cell, add:r};
  var min=34*99/T, a=0, i=ANIM.reduce ? ROW_LAUNCH[clip.name]||0 : 0, left=99;
  for(var k=i; k--;) left-=hold[k];
  for(;i<8;i++){ a+=hold[i]; left-=hold[i]; if(a>=min && left>=min){ if(q<a) break; q-=a; a=0; } }
  return {sx:(list ? list[i] : i)*cell, sy:c.row*cell, step:list && !clip.off ? list[i] : i, add:r, off:clip.off};
}
/* wpn: the weapon a melee swing is made with (null: none, the row plays straight); left out, it is the figure's own */
function setClip(e, name, wpn){
  if(!e) return;
  if(e._clip && e._clip.name==='death') return;
  /* clips share the effect queue: an action starts when the previous effect is done, and the lunge,
     bolt, damage number and hurt flash that follow are pushed back until the swing or release frame */
  var nowC=performance.now();
  if(typeof fxClock==='number' && fxClock>nowC+900) fxClock=nowC+900;   /* never fall far behind held keys */
  var t0=Math.max(nowC, typeof fxClock==='number' ? fxClock : 0);
  if(name==='hurt' && e._hit) t0=Math.max(t0, e._hit);
  /* 2026-09-27: a step no longer holds the turn, so a creature that stepped this turn swings once it has landed
     (a pounce's leap, hopHeight 5, already lands with its own bite). 2026-09-28: a swing the player can see first
     starts every step not shown yet (turn-presentation.js turnStartSlides), so the hero lands as the blow does. */
  var seen=CLIP_WINDUP[name] && !ANIM.reduce && typeof fxClock==='number' && turnAnimationVisible(e);   /* an unseen swing queues nothing */
  if(seen) turnStartSlides();
  var slide=CLIP_WINDUP[name] && MOTION_STATE.get(e);
  if(slide && slide.mt && !(slide.hopHeight>1)) t0=Math.max(t0, slide.mt+(slide.dur||MOVE_MS));
  var was=e._clip;
  e._clip={name:name, t0:t0};
  if(name==='melee' && wpn!==null && typeof heldKeyOf==='function') e._clip.art=heldKeyOf(wpn||e.weapon);   /* 2026-10-05: its family, for CLIP_PLAY */
  /* 2026-10-05 (slice 1c): a second swing in the same action (dual wield, Double Strike, Cleave, Lance) starts after the
     first one's lunge and number, and replaced the first clip before a frame of it was painted: the body stood idle
     through the first blow. The swings before it stay queued behind the new clip (prev, three at most) and clipFrame
     shows each until the next begins. The turn still waits for the newest clip only, exactly as long as before.
     The queue never runs more than 900ms ahead (above), so a fifth swing starts when the fourth does: it takes the
     fourth's place and the swings before them stay.
     2026-10-06: the hero and his shadow only. The Rootbound is given a cast clip too, and a second cast queued behind
     its first kept the first one playing where a creature always dropped to its stand. */
  if(was && nowC<t0 && (e===player || e.shadowClone) && name!=='attack' && was.name!=='attack' && CLIP_WINDUP[name] && CLIP_WINDUP[was.name]){
    while(was && was.t0>=t0) was=was.prev;
    if(was){ e._clip.prev=was; if(was.prev && was.prev.prev) delete was.prev.prev.prev; }
  }
  if(name==='melee' && wpn && wpn.kind==='off' && wpn.weapon) e._clip.off=1;
  if(seen) fxClock = t0 + CLIP_WINDUP[name];
}
/* Appearance is derived from current faith; the saved look remains the same
 * race/court/sex identity when joining or leaving Chad.
 * 2026-10-08: and from the class. A Tourist is drawn in the vacation outfit of the same race, court and sex
 * ('<look>-tourist', tools/art/install-rows.py --tourist). The saved look stays the base look, so no save changes.
 * Chad's rule keeps its priority: a Tourist who follows Chad is drawn in underwear like any other follower (the
 * Dwarves have no underwear look, so a Dwarf Tourist of Chad keeps the tourist outfit). */
function castLookFor(look,god,cls){
  var variant=look+'-unclad', tourist=look+'-tourist';
  /* 2026-10-08 (Justin, of a Tourist who follows Chad: 'i think they should stay in tourist geer'): the class goes first */
  if(cls==='tourist' && AS.cast && AS.cast[tourist]) return tourist;
  return god==='grom' && !/^dwarf-[mf]$/.test(look) && AS.cast && AS.cast[variant] ? variant : look;
}
function playerCastLook(){return player && castLookFor(player.look,player.god,player.cls);}
function castSheet(look){
  var m=AS.cast && AS.cast[look], img=m && atl('cast-'+look+'.webp');
  if(img)return {img:img,m:m,look:look};
  if(/-(unclad|tourist)$/.test(look)){
    /* Variant animations load on demand. The preloaded matching doll keeps
     * appearance and attachment anchors stable while that sheet arrives. */
    var doll=m && m.doll && atl('cast-'+look+'-doll.webp');
    if(doll)return {img:doll,m:m.doll,look:look};
    return castSheet(look.replace(/-(unclad|tourist)$/,''));
  }
  return null;
}
/* 2026-09-27 (Justin, render plan Q15): painted new-atlas creatures (goblin family, Shambler, Chaos and Unmaker foes)
   carry their own dark edge, so the pale foe halo is for the older sheets only. A new atlas says which way its art faces,
   or is Chaos art. */
function paintedSheet(sheet){ return !!(sheet && sheet.m && (sheet.m.facing || sheet.m.chaos)); }
/* Preserve native pixels when enlarged, but filter every sheet when reduced.
 * Skipping that reduction made small outlines stair-step and lose detail. */
function spriteSheetSmoothing(sheet,scale){ return scale<1 || !(sheet && sheet.m && sheet.m.sampling==='nearest'); }
function mobSheet(name){if(name==='escort-human-m'){var human=AS.cast&&AS.cast['human-m'],sheet=atl('cast-human-m.webp');return human&&sheet?{img:sheet,m:Object.assign({},human,{box:[32,16,64,108]})}:null;} var preview=typeof FoteChaosEnemyArt!=='undefined'&&FoteChaosEnemyArt.sheet(name);if(preview)return preview;var m=AS.mobs && AS.mobs[name]; if(!m) return null; var img=atl('mob-'+name+'.webp'); return img ? {img:img, m:m} : null; }
/* Share artwork without granting temporary swarms the raised-shade gameplay tag. */
function isShadeSummon(e){return !!(e && e.ally && (e.shade || e.swarm));}
var SHADE_SUMMON_ART=null;
function shadeSummonSheet(){
  var source=mobSheet('m-shade');if(!source)return null;
  if(SHADE_SUMMON_ART&&SHADE_SUMMON_ART.source===source.img)return SHADE_SUMMON_ART.sheet;
  /* Reuse every enemy animation frame; tint once rather than filtering each draw. */
  var canvas=document.createElement('canvas');canvas.width=source.img.width;canvas.height=source.img.height;canvas.src='shade-summon:'+source.img.src;
  var ink=canvas.getContext('2d');ink.filter='grayscale(1) brightness(.72)';ink.drawImage(source.img,0,0);ink.filter='none';
  ink.globalCompositeOperation='source-atop';ink.fillStyle='rgba(27,16,43,.4)';ink.fillRect(0,0,canvas.width,canvas.height);
  var sheet={img:canvas,m:source.m};SHADE_SUMMON_ART={source:source.img,sheet:sheet};return sheet;
}
/* 2026-10-08 (Justin: 'the dwarf idle needs like 10 regular idles into the beer'; 'he only does it when his off hand
   is free'). The Dwarf male tourist's sheet has one more row, beer, with its play order written beside it
   (clips.beer.play: [frame, ms] pairs; clips.beer.after: the idle loops before it). After that many ordinary idle loops
   in a row, with the off hand empty or holding the Camera and no foe in view, the row plays once; then the idle starts again from its first
   frame and the count from nothing. A key, a click, a touch or the wheel, a turn passing, a clip, a step, a foe coming
   into view or another item put in the off hand ends it at once and starts the count again.
   It is a picture only: it reads the clock and the state and writes nothing but BEER, which nothing else reads. It sets
   no clip, so no turn waits for it and input is never held (turnPlayerAnimationWait reads e._clip only).
   A weapon in the main hand keeps the angle and the layer of the row's first frame, as in any idle (equip.js keep), and
   the row's weapon-hand point is one point on every frame (install-rows.py), so it cannot wobble. */
var BEER={from:0, start:null, resume:null, seen:0, input:0, clip:null, turn:undefined};
if(typeof window!=='undefined' && window.addEventListener) ['keydown','pointerdown','touchstart','wheel'].forEach(function(n){
  window.addEventListener(n, function(){ BEER.input=performance.now(); }, {capture:true, passive:true});
});
/* The Camera permits drinking; other offhand items, two-handers and bows occupy the beer hand. */
function beerHandFree(e){
  var off=e.off, key=typeof heldKeyOf==='function' ? heldKeyOf(e.weapon) : null;
  if(e.twoHanded || (key && typeof HELD!=='undefined' && HELD[key] && HELD[key].hand==='l')) return false;
  return !off || (typeof EMPTY_OFF!=='undefined' && off===EMPTY_OFF) || (!off.kind && off.name==='Empty') || off.key==='camera' || off.name==='Camera';
}
/* the standing frame of a look with a beer row: the beer while it plays, else the idle (the same frame clipFrame's own
   idle line gives until a beer has played; after one, the idle restarts where the beer ended) */
/* Select the authored beer row without reading an actor, clock or run state.
 * Once finished, after is the elapsed remainder used to resume ordinary idle. */
function beerPlayFrame(m, elapsed){
  var c=m.clips.beer;
  for(var i=0;i<c.play.length;i++){
    if(elapsed<c.play[i][1])return {sx:c.play[i][0]*m.cell,sy:c.row*m.cell,add:'beer'};
    elapsed-=c.play[i][1];
  }
  return {after:elapsed};
}
function beerFrame(sheet, e, now, rest){
  var m=sheet.m, c=m.clips.beer, id=m.clips.idle2, cell=m.cell, B=BEER;
  if(!c || !c.play || !id || e!==player) return null;
  var L=id.frames*CLIP_MS.idle, t=typeof turn==='number' ? turn : undefined;
  var ok=!ANIM.reduce && e.hp>0 && beerHandFree(e) && !(typeof foesInView==='function' && foesInView()>0);
  if(!ok || B.input>B.from || now-B.seen>250 || B.clip!==(e._clip||null) || B.turn!==t){
    if(B.start!==null){ B.start=null; B.resume=now; }
    B.from=now;
  }
  B.seen=now; B.clip=e._clip||null; B.turn=t;
  var base=rest===undefined ? -(((e.id||0)*97)%500) : rest;
  if(B.resume!==null && B.resume>base) base=B.resume;
  if(B.start===null && ok){
    var due=base+(Math.max(0, Math.ceil((B.from-base)/L))+(c.after||10))*L;
    if(now>=due) B.start=due;
  }
  if(B.start!==null){
    var beer=beerPlayFrame(m,now-B.start);
    if(beer.add)return beer;
    B.resume=base=now-beer.after; B.start=null; B.from=B.resume;
  }
  return {sx:(Math.floor((now-base)/CLIP_MS.idle)%id.frames)*cell, sy:id.row*cell, add:'idle2'};
}
function clipFrame(sheet, e, sliding){
  var m=sheet.m, now=performance.now(), cell=m.cell, rest;
  if(m.chaos&&ANIM.reduce)return {sx:0,sy:m.static_row*cell};
  /* 2026-09-23 (Justin: the Magma Crawler changed art between asleep and awake): a creature whose animation rows
     drifted off its still (packet 04's fire and water five, stillPose in planesfwa.js) holds the still in every
     state, mid-clip included, until it is re-animated on model. */
  if(e.base && e.base.stillPose && !isShadeSummon(e) && m.static_row!==undefined) return {sx:0, sy:m.static_row*cell};
  /* 2026-10-05 (slice 1c): of the swings queued in one action the newest that has begun is the one showing (setClip) */
  var clip=e._clip;
  while(clip && clip.prev && now<clip.t0) clip=clip.prev;
  /* 2026-10-05 (slice 1c): a step taken while an older hurt or cast clip is still running ends that clip for the eye:
     the walk shows, then the stand. The hero glided across the tile in that pose */
  var slide=clip && sheet.look && (clip.name==='hurt' || clip.name==='cast') && typeof MOTION_STATE!=='undefined' && MOTION_STATE.get(e);
  if(clip && !(slide && slide.stepped>clip.t0 && now>=slide.stepped)){
    var c=m.clips[clip.name];
    if(c){
      var ms=CLIP_MS[clip.name]||70, f=Math.floor((now-clip.t0)/ms);
      if(clip.name==='death' && f>=c.frames) f=c.frames-1;
      /* 2026-10-06: a look with the new body row for this action plays that row (CLIP_ROW), by its own holds. (Asked of
         the hero's sheets only, as the lists below: a creature test that cuts this function out alone still runs.) */
      var nr=f>=0 && f<c.frames && sheet.look && clipRow(sheet, clip.name, clip);
      if(nr) return clipRowFrame(m, nr, clip, (now-clip.t0)/(ms*c.frames)*99, ms*c.frames, f);
      /* 2026-10-05: a clip with a play list shows its step's frame and names the step (equip.js turns a swung weapon by it) */
      var play=f>=0 && f<c.frames && sheet.look && clipPlay(sheet.look, clip);
      if(play){
        /* a step shorter than a paint (34ms; Animation speed above 1x) joins the step after it. Motion off lands
           the blow as the clip starts (nothing winds up), so the list starts on its launch step (CLIP_LAUNCH).
           2026-10-06 (the review: at 2x a swing's last step lasted 22ms, and with Motion off its first one 18): what is
           left for the last steps, when that is shorter than a paint, joins the steps before it (left: the 99ths still
           to come), and with Motion off the steps are joined from the launch step on. At 1x nothing changes */
        var hold=CLIP_HOLD[clip.name], T=ms*c.frames, min=34*99/T, q=(now-clip.t0)/T*99, a=0, i=ANIM.reduce ? CLIP_LAUNCH[clip.name]||0 : 0, left=99;
        for(var k=i; k--;) left-=hold[k];
        for(;i<8;i++){ a+=hold[i]; left-=hold[i]; if(a>=min && left>=min){ if(q<a) break; q-=a; a=0; } }
        return {sx:play.f[i]*cell, sy:c.row*cell, step:i, lead:play.lead, off:clip.off};
      }
      /* 2026-10-06: a row played straight says so too when it is the off-hand swing (equip.js keeps the main weapon at its carry) */
      if(f>=0 && f<c.frames) return clip.off ? {sx:f*cell, sy:c.row*cell, off:1} : {sx:f*cell, sy:c.row*cell};
      /* 2026-10-05: the hero's idle picks up from its first frame as an action clip ends, not from wherever the clock is
         (until the next clip is queued: setClip replaces this one and the idle is back on the clock) */
      if(f>=c.frames && sheet.look) rest=clip.t0+c.frames*ms;
    }
    /* Expired clips fall through without mutating the simulation actor. */
  }
  if(ANIM.reduce){
    /* 2026-10-06: a look with a redrawn idle stands on its first frame, the stand every added row starts from */
    var ns=sheet.look && clipRow(sheet,'idle'); if(ns) return {sx:0, sy:m.clips[ns].row*cell, add:ns};
    var st=m.static_row!==undefined ? m.static_row : (m.clips.idle?m.clips.idle.row:0); return {sx:0, sy:st*cell};
  }
  /* 2026-09-19: Justin - a sleeping creature kept playing its idle (the Myconid swayed about with a Z over it).
     Asleep it holds its still pose until something wakes it. */
  if(e.state==='asleep'){ var sr=m.static_row!==undefined ? m.static_row : (m.clips.idle?m.clips.idle.row:0); return {sx:0, sy:sr*cell}; }
  /* 2026-10-06 (Justin picked the run for walking). The run row is a bound a tile, two tiles to its nine frames, and its
     frame follows the time on the move, 4.5 frames a step, counted on through every chained step (game.js slideWalked):
     so a foot that is down stays where it is put and the stride never steps back while a direction is held. The redrawn
     idle of the clothed Fae stands where their new rows stand, so no row pops against it */
  /* 2026-10-06: which of the two runs, by what the main hand holds (CLIP_ROW.walk) */
  var nw=sliding && sheet.look && typeof slideWalked==='function' && clipRow(sheet,'walk',{art:typeof heldKeyOf==='function' && typeof castEquipmentFor==='function' ? heldKeyOf(castEquipmentFor(e).weapon) : null});
  if(nw){ var rn=m.clips[nw]; return {sx:(Math.floor(slideWalked(e,now))%rn.frames)*cell, sy:rn.row*cell, add:nw}; }
  var ni=!sliding && sheet.look && clipRow(sheet,'idle');   /* 2026-10-06: standing only (a look on the move with no run row keeps its walk row) */
  var nb=ni==='idle2' && m.clips.beer && typeof beerFrame==='function' && beerFrame(sheet, e, now, rest);   /* 2026-10-08: the Dwarf male tourist's beer */
  if(nb) return nb;
  if(ni){ var i2=m.clips[ni]; return {sx:(Math.floor((now+(rest===undefined ? ((e.id||0)*97)%500 : -rest))/CLIP_MS.idle)%i2.frames)*cell, sy:i2.row*cell, add:ni}; }
  /* 2026-10-05 (slice 1c; Justin 09-22: walking stuttered, 10-04: 'feet movement during walking isn't there or
     consistent'). The hero's walk frame came off the wall clock: about three frames a tile, starting anywhere in the
     row. It follows the time on the move now, the whole row to two tiles at 1x, counted on through every chained step
     (game.js slideWalked), so the feet keep their place in the stride and never step back while a direction is held */
  if(sliding && m.clips.walk){ var w=m.clips.walk, wf=sheet.look && typeof slideWalked==='function' ? Math.floor(slideWalked(e,now)) : Math.floor(now/CLIP_MS.walk); return {sx:(wf%w.frames)*cell, sy:w.row*cell}; }
  if(m.clips.idle){
    var id=m.clips.idle, ph=rest===undefined ? ((e.id||0)*97)%500 : -rest;
    // Authored wingbeats can run at their own cadence without changing action timing.
    var idleMs=Number.isFinite(id.frameMs)&&id.frameMs>0?id.frameMs:CLIP_MS.idle, n=Math.floor((now+ph)/idleMs);
    var loop=sheet.look && CLIP_PLAY[sheet.look] && CLIP_PLAY[sheet.look].idle;   /* 2026-10-05 (slice 1c): the look's calm loop */
    return {sx:(loop ? loop[n%loop.length] : n%id.frames)*cell, sy:id.row*cell};
  }
  return {sx:0, sy:(m.static_row||0)*cell};
}
function drawActorContactShadow(e,px,py){
  // Large sprites stand across their full footprint. Tall one-cell art keeps
  // its existing shadow; proxy cells and special summons never enlarge it.
  var n=!e.parent&&!isShadeSummon(e)&&!e.livingFlame&&e.base.big||1;
  var scale=n>1?n*(e.base.bigScale||1):(e.base.art||0.9);
  ctx.globalAlpha=0.35;ctx.fillStyle='#000';ctx.beginPath();
  ctx.ellipse(px+TS*n/2,py+TS*0.9*n,TS*0.26*scale,TS*0.09*n,0,0,7);ctx.fill();ctx.globalAlpha=1;
}
/* Optional contrast uses authored sprites and retains the existing visibility policy. */
function phoneActorClarity(){
  return typeof UI_HIGH_CONTRAST!=='undefined'&&UI_HIGH_CONTRAST;
}
function drawCharacterSprite(e, px, py, opts){
  if(!spriteOn)return false;
  if(e.livingFlame)return drawLivingFlame(e,px,py,opts);
  opts=opts||{};
  if(e===player||e.shadowClone){
    var cs = spriteOn ? castSheet(e.shadowClone?e.cloneLook:playerCastLook()) : null;
    if(cs){
      var fr=clipFrame(cs, e, opts.sliding), m=cs.m, cell=m.cell, sc=(TS*1.08)/m.stand;
      /* 2026-10-06: the run row has its own flight (its feet leave the floor line by up to 14 px of the cell), and the slide's
         hop would lift the foot that is down on frames 0, 4 and 5 by up to 10 px more (measured, boards/rows-hop.cjs): the hop
         its caller took off is put back */
      if(fr.add==='run' || fr.add==='run2') py+=renderPos(e).hop*TS*(e===player ? 0.10 : 0.14);   /* 2026-10-06: run2 has the run's legs */
      var w=cell*sc, h=cell*sc, dx=px+TS/2-w/2, dy=py+TS-(cell-m.foot)*sc;
      var rect=placementRect(dx,dy,w,h);dx=rect.x;dy=rect.y;w=rect.w;h=rect.h;
      // Keep the copied hands readable on dark floors: the former .42 brightness
      // combined with .58 opacity buried small weapons inside the silhouette.
      ctx.save(); ctx.globalAlpha=(opts.alpha===undefined?1:opts.alpha)*(e.shadowClone?.72:1); ctx.imageSmoothingEnabled=true;
      if(e.shadowClone)ctx.filter='grayscale(1) brightness(.78) sepia(.6) hue-rotate(205deg) saturate(1.5)';
      if(opts.flip){ ctx.translate(px+TS/2,0); ctx.scale(-1,1); ctx.translate(-(px+TS/2),0); }
      /* Correct a measured authored-cell translation after mirroring, moving
       * body, held gear and flash as one composition in either facing. */
      if(typeof FoteCastFrameAlignment!=='undefined'){
        var anchorShift=FoteCastFrameAlignment.offset(cs.look,m,fr);
        if(anchorShift)ctx.translate(anchorShift*w/cell,0);
      }
      if(e===player&&phoneActorClarity())ctx.filter='brightness(1.2) drop-shadow(0px 0px 0.45px rgba(23,18,15,.55))';
      if(typeof drawCastLayers==='function') drawCastLayers(e, cs, fr, dx, dy, w, h); else ctx.drawImage(cs.img, fr.sx, fr.sy, cell, cell, dx, dy, w, h);
      if(opts.flash>0){ ctx.globalAlpha*=opts.flash; ctx.drawImage(whiteCut(cs.img,fr.sx,fr.sy,cell,cell), dx,dy,w,h); }
      ctx.restore();
      return true;
    }
    return false;
  }
  var isShade=isShadeSummon(e),visualBase=isShade?{art:.9}:e.base;
  var ms = spriteOn ? (isShade?shadeSummonSheet():mobSheet(e.base.sprite)) : null;
  if(ms){
    var f2=clipFrame(ms, e, !!opts.sliding), mm=ms.m, c2=mm.cell, box=mm.box||[0,0,c2,c2];
    var target=TS*(visualBase.art||0.9)*(e.big&&!isShade?1.25:1), s2=target/Math.max(box[3], box[2]*0.8);
    var w2=c2*s2, h2=c2*s2, feet=(box[1]+box[3]);
    var dx2=px+TS/2-(box[0]+box[2]/2)*s2, dy2=py+TS*0.97-feet*s2;
    if(e.base.sprite==='escort-human-m'){s2=TS*1.08/mm.stand;w2=c2*s2;h2=c2*s2;dx2=px+TS/2-w2/2;dy2=py+TS-(c2-mm.foot)*s2;}
    /* Only legacy single-pose sheets need this fallback. Authored clips already
       contain their own breathing and attack motion. */
    var authoredMotion=Object.keys(mm.clips||{}).some(function(name){return mm.clips[name].frames>1;});
    if(!authoredMotion && (visualBase.elementTier || visualBase.stillPose) && !ANIM.reduce && e.state!=='asleep'){
      var msNow=performance.now(), age2=e._clip?msNow-e._clip.t0:9999;
      var action2=e._clip&&e._clip.name==='attack'&&age2>=0&&age2<540?Math.sin(age2/540*Math.PI):0;
      var pulse2=Math.sin(msNow/330+(e.id||0))*.012;
      var sy2=1+pulse2-action2*.08, sx2=1+action2*.05;
      dx2=px+TS/2+(dx2-px-TS/2)*sx2;w2*=sx2;
      dy2=py+TS*.97+(dy2-py-TS*.97)*sy2;h2*=sy2;
    }
    var rect2=placementRect(dx2,dy2,w2,h2);dx2=rect2.x;dy2=rect2.y;w2=rect2.w;h2=rect2.h;
    var actorAlpha=(opts.alpha===undefined?1:opts.alpha)*(isShade ? .62 : 1);
    ctx.save(); ctx.globalAlpha=actorAlpha; ctx.imageSmoothingEnabled=spriteSheetSmoothing(ms,Math.min(w2,h2)/c2);
    if(opts.flip){ ctx.translate(px+TS/2,0); ctx.scale(-1,1); ctx.translate(-(px+TS/2),0); }
    if(opts.outline&&phoneActorClarity())ctx.filter='brightness(1.2) drop-shadow(0px 0px 0.45px rgba(23,18,15,.55))';
    if(mm.edge || (opts.outline && !paintedSheet(ms))){
      var cut2=whiteCut(ms.img,f2.sx,f2.sy,c2,c2,mm.edge),edge2=mm.edge?Math.max(.3,s2*.5):Math.max(.5,TS/80);
      ctx.globalAlpha=actorAlpha*(mm.edge?.24:.07);
      var offsets=[[-edge2,0],[edge2,0],[0,-edge2],[0,edge2]];
      if(!mm.edge)offsets.push([-edge2,-edge2],[edge2,-edge2],[-edge2,edge2],[edge2,edge2]);
      offsets.forEach(function(d){ctx.drawImage(cut2,dx2+d[0],dy2+d[1],w2,h2);});
      ctx.globalAlpha=actorAlpha;
    }
    ctx.drawImage(ms.img, f2.sx, f2.sy, c2, c2, dx2, dy2, w2, h2);
    if(opts.flash>0){ ctx.globalAlpha*=opts.flash; ctx.drawImage(whiteCut(ms.img,f2.sx,f2.sy,c2,c2), dx2,dy2,w2,h2); }
    ctx.restore();
    return true;
  }
  return false;
}

/* ---- item art ---- */
/* hearts and mana globes: drawn, pulsing, fading out in their last turns */
function drawGlobe(it, px, py, alpha, now){
  var left = it.until ? it.until-turn : 99, fade = left<8 ? 0.35+0.65*(ANIM.reduce?1:(0.5+0.5*Math.sin(now/90))) : 1;
  var pulse = ANIM.reduce ? 1 : 1+0.08*Math.sin(now/220+it.x);
  var cx=px+TS/2, cy=py+TS*0.56, r=TS*0.13*pulse;
  ctx.save(); ctx.globalAlpha=alpha*fade;
  var col = it.kind==='heart' ? '#E0443A' : '#4AA8F0', glowC = it.kind==='heart' ? 'rgba(255,90,80,' : 'rgba(110,190,255,';
  var gl=ctx.createRadialGradient(cx,cy,0,cx,cy,TS*0.32); gl.addColorStop(0,glowC+'0.45)'); gl.addColorStop(1,glowC+'0)');
  ctx.fillStyle=gl; ctx.fillRect(cx-TS*0.35,cy-TS*0.35,TS*0.7,TS*0.7);
  ctx.fillStyle=col;
  if(it.kind==='heart'){
    ctx.beginPath(); ctx.moveTo(cx, cy+r*1.1);
    ctx.bezierCurveTo(cx-r*1.9, cy-r*0.2, cx-r*0.9, cy-r*1.6, cx, cy-r*0.55);
    ctx.bezierCurveTo(cx+r*0.9, cy-r*1.6, cx+r*1.9, cy-r*0.2, cx, cy+r*1.1); ctx.fill();
    ctx.fillStyle='rgba(255,220,210,.8)'; ctx.fillRect(cx-r*0.9, cy-r*0.9, Math.max(1,r*0.35), Math.max(1,r*0.35));
  } else {
    ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='rgba(220,240,255,.85)'; ctx.beginPath(); ctx.arc(cx-r*0.35,cy-r*0.35,r*0.28,0,Math.PI*2); ctx.fill();
  }
  ctx.restore();
}

/* how big each kind of loot is on the floor, as a share of a tile: small things stay small */
var ITEM_FIT = {relic:0.5,ring:0.42, amulet:0.46, essence:0.42, mote:0.42, key:0.46, sigil:0.5, food:0.52, off:0.58, armor:0.62, weapon:0.68};   /* between the old full-tile size and the too-small trim */
function itemArtName(it){
  if(it.rareLamp!==undefined)return 'sealed-lamp';
  if(it.kind==='core') return it.name==='Crypt Core' ? 'item-core-crypt' : 'item-core-dungeon';
  if(it.kind==='essence') return 'item-essence';
  if(it.kind==='mote') return 'mote-'+it.el;
  if(it.kind==='food') return (FOODS[it.food]||{}).icon || 'item-ration';
  if(it.kind==='key') return it.key==='crystal' ? 'item-key-crystal' : 'item-key-iron';
  if(it.kind==='sigil') return sigilArtName(it.use);
  if(it.it && it.it.icon) return it.it.icon;
  return 'item-sword';
}

/* ---- lights ---- */
function drawLights(){
  var now=performance.now(),all=revealAll&&!playerBlind();
  ctx.save(); ctx.globalCompositeOperation='lighter';
  function glow(x,y,col,rad,str){
    if(!inb(x,y) || !(all||vis[idxOf(x,y)])) return;
    var cx=(x-camX+0.5)*TS, cy=(y-camY+0.5)*TS, fl=1+0.08*Math.sin(now/170+x*3+y*7)+0.05*Math.sin(now/53+x);
    var g=ctx.createRadialGradient(cx,cy,TS*0.2,cx,cy,TS*rad*fl);
    g.addColorStop(0, hexA(col, str)); g.addColorStop(1, hexA(col, 0));
    ctx.fillStyle=g; ctx.fillRect(cx-TS*rad*1.2, cy-TS*rad*1.2, TS*rad*2.4, TS*rad*2.4);
  }
  props.forEach(function(p){ if(p.light) glow(p.x,p.y,p.light, p.dim?1.6:2.8, p.dim?0.10:0.20); });
  var W=MW, H=MH, M=map, F=fireT;   /* read once a frame (state getters) */
  for(var y=camY;y<=camY+viewH;y++) for(var x=camX;x<=camX+viewW;x++){
    if(x<0||y<0||x>=W||y>=H) continue; var t=M[y*W+x];
    if(F[y*W+x]>0) glow(x,y,'#FF7A30',2.2,0.22);
    else if(t===FORGE) glow(x,y,'#FF8A3A',3.2,0.24);
    else if(t===SHRINE) glow(x,y,(GODS[RUN.shrineGod]||{}).color||'#FFFFFF',3,0.14);
    else if(t===EXIT && floorMeta.exitOpen) glow(x,y,'#9FD8FF',3,0.25);
  }
  if(!lightingOn()) glow(player.x,player.y,'#FFD9A0',3.6,0.07);
  ctx.restore();
}
/* ---------------------------------------------------------------- lightmap
   One texel per tile, built each frame from light sources, then scaled up with smoothing and
   multiplied over the scene. Smoothing gives soft falloff, and darker wall texels shade the floor
   along wall bases for free. Values above 1 feed a small additive bloom pass. */
var LM = {c:null, x:null, bloom:null, bx:null};
function hexRGB(hex){ var n=parseInt((hex||'#FFFFFF').slice(1),16); return [((n>>16)&255)/255, ((n>>8)&255)/255, (n&255)/255]; }
function lightBlocks(x,y){ var t=at(x,y); return t===WALL||t===SECRET||t===DOOR||t===LOCKED||t===ICEDOOR||t===THORNS||t===SEALED||t===TOLL; }
function lightLOS(x0,y0,x1,y1){
  var dx=Math.abs(x1-x0), dy=Math.abs(y1-y0), sx=x0<x1?1:-1, sy=y0<y1?1:-1, err=dx-dy, x=x0, y=y0;
  while(!(x===x1 && y===y1)){
    var e2=2*err; if(e2>-dy){ err-=dy; x+=sx; } if(e2<dx){ err+=dx; y+=sy; }
    if(x===x1 && y===y1) return true;
    if(lightBlocks(x,y)) return false;
  }
  return true;
}
function masonryTorchAt(x,y){
  if(!isWallLike(at(x,y)) || at(x,y)===SECRET) return false;
  var south=at(x,y+1); if(south===WALL || south===SECRET) return false;
  return hash2(x,y,11)<0.12 && WALL_FACE_RARE[Math.floor(hash2(x,y,5)*WALL_FACE_RARE.length)]===12;
}
function gatherBaseLights(now, prp){
  var L=[], x, y,blind=playerBlind();
  function add(lx,ly,col,rad,str,src){ L.push({em:L.length>0, x:lx, y:ly, c:hexRGB(col), r:rad, s:str, tx:src?src[0]:Math.round(lx), ty:src?src[1]:Math.round(ly)}); }
  function fl(k){ return ANIM.reduce ? 1 : 1 + 0.07*Math.sin(now/130 + k*1.7) + 0.04*Math.sin(now/47 + k*3.1); }
  var x0=camX-7, x1=camX+viewW+7, y0=camY-7, y1=camY+viewH+7;
  /* the hero's own torch follows the sliding render position, so light glides with each step */
  var pr = 5.5 + (player.aff && player.aff.light ? 1 : 0) + (player.aff && player.aff.fire ? 0.5 : 0);
  add(prp.x, prp.y, '#FFB066', pr, 1.15*fl(0.3), [player.x, player.y]);
  var W=MW, M=map, S=seen, F=fireT, all=revealAll&&!blind, yEnd=Math.min(MH-1,y1), xEnd=Math.min(W-1,x1);   /* read once a frame (state getters) */
  for(y=Math.max(0,y0); y<=yEnd; y++) for(x=Math.max(0,x0); x<=xEnd; x++){
    var i=y*W+x, t=M[i];
    if(!(all||S[i])) continue;
    if(wallTorchAt(x,y)) add(x, y+0.75, '#FF9A48', 5, 1.2*fl(x*7+y), [x, y+1]);
    else if(F[i]>0) add(x, y, '#FF7A30', 3.2, 0.9*fl(x+y*5));
    else if(t===FORGE) add(x, y, '#FF8A3A', 5.5, 1.15*fl(x*3+y));
    else if(t===SHRINE) add(x, y, (GODS[RUN.shrineGod]||{}).color||'#FFFFFF', 4, 0.5);
    else if(t===EXIT && floorMeta.exitOpen) add(x, y, '#9FD8FF', 4.5, 0.9);
    else if(t===STAIRS) add(x, y, '#9FD8FF', 3.2, 0.7);
    else if(t===CHEST) add(x, y, '#E8B44A', 2.2, 0.45);
  }
  props.forEach(function(pp){ if(pp.light && pp.x>=x0 && pp.x<=x1 && pp.y>=y0 && pp.y<=y1 && (all||S[pp.y*W+pp.x])&&(!blind||vis[pp.y*W+pp.x])) add(pp.x, pp.y, pp.light, pp.dim?2.8:4.8, (pp.dim?0.55:1.0)*fl(pp.x*5+pp.y)); });
  items.forEach(function(it){ if(it.kind==='mote' && (all||vis[idxOf(it.x,it.y)])) add(it.x, it.y, AFF_COL[it.el]||'#FFFFFF', 2.2, 0.55*fl(it.x+it.y)); });
  items.forEach(function(it){ if(it.kind==='key' && (all||(blind?vis:seen)[idxOf(it.x,it.y)])) add(it.x, it.y, it.key==='crystal' ? '#A0E6FF' : '#78BEFF', 2.6, 0.6*fl(it.x+it.y*3)); });
  ents.forEach(function(e){ if(e.base && e.base.glow && (all||vis[idxOf(e.x,e.y)])){ var rp=renderPos(e); add(rp.x, rp.y, e.base.glow, 3, 0.8, [e.x,e.y]); } });
  /* spells and arrows in flight carry their light along the path */
  fx.forEach(function(f){
    if(f.k!=='p') return; var q=(now-f.t0)/f.dur; if(q<0 || q>1) return;
    var col = f.arrow ? null : (DMG_COL[f.type]||'#FFFFFF'); if(!col) return;
    var lx=f.ax+(f.bx-f.ax)*q, ly=f.ay+(f.by-f.ay)*q;
    add(lx, ly, col, 3.2, 1.0);
  });
  return L;
}


/* ---- telegraphs: the floor a boss is about to hit glows red, brighter as the blow gets close ---- */
function drawBossDangerTiles(tiles,due,now){
  var urgent=due<=1,pulse=ANIM.reduce?0.7:0.5+0.5*Math.sin(now/(urgent?110:220));
  ctx.save();ctx.globalCompositeOperation='source-over';ctx.setLineDash([]);
  (tiles||[]).forEach(function(t){
    if(!(revealAll&&!playerBlind()||vis[idxOf(t[0],t[1])]))return;
    var px=(t[0]-camX)*TS,py=(t[1]-camY)*TS;
    ctx.fillStyle='rgba(210,40,30,'+((urgent?0.34:0.2)+0.16*pulse)+')';ctx.fillRect(px+1,py+1,TS-2,TS-2);
    ctx.strokeStyle='rgba(255,120,90,'+(0.55+0.35*pulse)+')';ctx.lineWidth=Math.max(1.5,TS*0.05);ctx.strokeRect(px+2,py+2,TS-4,TS-4);
  });ctx.restore();
}
function drawBossTelegraphs(now){
  if(typeof FoteUnmakerEncounter!=='undefined')FoteUnmakerEncounter.drawTelegraphs(now);
  ents.forEach(function(e){
    if(!e.windup || !e.windup.tiles) return;
    if(e.windup.unmaker)return;
    drawBossDangerTiles(e.windup.tiles,e.windup.due,now);
    var urgent = e.windup.due<=1, pulse = ANIM.reduce ? 0.7 : 0.5+0.5*Math.sin(now/(urgent?110:220));
    ctx.save();
    e.windup.tiles.forEach(function(t){
      if(!(revealAll&&!playerBlind()||vis[idxOf(t[0],t[1])])) return;
      var px=(t[0]-camX)*TS, py=(t[1]-camY)*TS;
      if(e.windup.kind==='charge'){ ctx.fillStyle='rgba(255,210,160,'+(0.5+0.4*pulse)+')'; var cx=px+TS/2, cy=py+TS/2, a=Math.atan2(player.y-e.y+0.0001, player.x-e.x); ctx.beginPath(); ctx.moveTo(cx+Math.cos(a)*TS*0.25, cy+Math.sin(a)*TS*0.25); ctx.lineTo(cx+Math.cos(a+2.4)*TS*0.18, cy+Math.sin(a+2.4)*TS*0.18); ctx.lineTo(cx+Math.cos(a-2.4)*TS*0.18, cy+Math.sin(a-2.4)*TS*0.18); ctx.closePath(); ctx.fill(); }
    });
    ctx.restore();
  });
}

/* screen-edge arrow toward stairs (or the open exit) that you have found but that is off screen */
function drawStairsPointer(now){
  if(!RUN || !map) return;
  var best=null, bd=1e9, M=map, S=seen, all=revealAll, W=MW, open=floorMeta.exitOpen;   /* read once a frame (state getters) */
  for(var i=0;i<M.length;i++){
    var t=M[i]; if(!(t===STAIRS || (t===EXIT && open))) continue;
    if(!(all||S[i])) continue;
    var x=i%W, y=(i/W)|0, d=Math.abs(x-player.x)+Math.abs(y-player.y); if(d<bd){ bd=d; best={x:x,y:y}; }
  }
  if(!best) return;
  var sx=(best.x-camX+0.5)*TS-camOX, sy=(best.y-camY+0.5)*TS-camOY, W=viewW*TS, H=viewH*TS;
  if(sx>TS*0.3 && sx<W-TS*0.3 && sy>TS*0.3 && sy<H-TS*0.3) return;
  var cx=W/2, cy=H/2, dx=sx-cx, dy=sy-cy, m=TS*0.6;
  var k=Math.min((W/2-m)/Math.max(1e-3,Math.abs(dx)), (H/2-m)/Math.max(1e-3,Math.abs(dy)));
  var ax=cx+dx*k, ay=cy+dy*k, ang=Math.atan2(dy,dx), bob=ANIM.reduce?0:Math.sin(now/300)*3;
  ctx.save(); ctx.translate(ax-Math.cos(ang)*bob, ay-Math.sin(ang)*bob); ctx.rotate(ang);
  ctx.globalAlpha=0.9; ctx.fillStyle='#9FD8FF'; ctx.strokeStyle='rgba(0,0,0,.7)'; ctx.lineWidth=2;
  var z=Math.max(8, TS*0.28);
  ctx.beginPath(); ctx.moveTo(z,0); ctx.lineTo(-z*0.7,-z*0.7); ctx.lineTo(-z*0.35,0); ctx.lineTo(-z*0.7,z*0.7); ctx.closePath(); ctx.stroke(); ctx.fill();
  ctx.restore();
  ctx.save(); ctx.font='bold '+Math.max(10,TS*0.26|0)+'px monospace'; ctx.textAlign='center'; ctx.fillStyle='#9FD8FF'; ctx.strokeStyle='rgba(0,0,0,.8)'; ctx.lineWidth=3;
  var lx=ax-Math.cos(ang)*z*2, ly=ay-Math.sin(ang)*z*2+4;
  ctx.strokeText('>', lx, ly); ctx.fillText('>', lx, ly); ctx.restore();
}

function hexA(hex, a){ var n=parseInt(hex.slice(1),16); return 'rgba('+((n>>16)&255)+','+((n>>8)&255)+','+(n&255)+','+a+')'; }

/* ============================================================== the ground layer
   2026-09-28 (frame cost). The scene is drawn again 30 to 60 times a second, and most of the ground in it does not move:
   the terrain with its wall edges, and the ground passes laid over it (moss, grime, chasm lips, water beds...). Those
   passes, in their order, are the ground segments below. Each frame, the leading segments that hold still are drawn
   once into an offscreen layer and blitted while nothing they read changes; the first segment that moves, and all of
   the scene after it, draw live as before (so water glints, ooze, swaying plants and every creature stay animated).
   A resting camera's layer is the canvas's size and is drawn with the frame's own transform, so it holds the same
   pixels. While the camera slides between tiles a second, larger layer is blitted at the nearest whole device pixel
   (under half a pixel off). The key holds everything the segments read (camera tile, view, zoom, pixel ratio, the map,
   sight, memory, ground and props around the view, options, the canvas state they inherit); art that finishes
   loading, or terrain cells still being built, mark the layers stale (requestTerrainRedraw). A shaking frame, or a
   canvas whose drawing calls are being watched, draws its ground directly. */
var GROUND_LAYER_ON=true;   /* false draws every frame's ground directly, as before */
/* two layers: one the canvas's own size, for a resting camera (a GPU canvas rasterizes by its size, so only a layer of
   the same size gives the resting frame's exact pixels), and one a tile wider and taller, for a sliding camera.
   epoch: bumped when art arrives or cells were left unbuilt; a layer drawn in an older epoch is drawn again. */
var GROUND_LAYER={rest:{}, slide:{}, epoch:0, building:false, stats:{kept:0, dirty:0, key:0, map:0, offset:0, direct:0}};
var GROUND_STATE=null;   /* the canvas state a segment can inherit or leave behind */
/* requestTerrainRedraw: art that arrived, or cells a still segment could not build this frame. A request from the live
   passes while a frame draws (their own cells over budget) leaves the layer alone. */
function groundLayerDirty(){ if(GROUND_LAYER.building || !FRAME_MAP) GROUND_LAYER.epoch++; }
/* a context whose drawing calls have been wrapped (a test or a probe watching what is drawn, on the context or on its
   prototype) gets every call itself: a wrapper is a function that is not the browser's own */
var GROUND_CALLS=['drawImage','fillRect','fillText','strokeText','fill','stroke','strokeRect','putImageData','clearRect','save','restore'], GROUND_NATIVE=new WeakMap();
function groundWatched(c){
  for(var i=0;i<GROUND_CALLS.length;i++){
    var f=c[GROUND_CALLS[i]], native=GROUND_NATIVE.get(f);
    if(native===undefined){ native=typeof f==='function' && /\{\s*\[native code\]\s*\}\s*$/.test(Function.prototype.toString.call(f)); GROUND_NATIVE.set(f,native); }
    if(!native) return true;
  }
  return false;
}
/* does any tile the ground passes cover (the view and one tile around it) pass test(i, x, y)? */
function groundRangeAny(test){
  var W=MW, H=MH, x0=Math.max(0,camX-1), x1=Math.min(W-1,camX+viewW+1), y0=Math.max(0,camY-1), y1=Math.min(H-1,camY+viewH+1);
  for(var y=y0;y<=y1;y++) for(var x=x0;x<=x1;x++) if(test(y*W+x,x,y)) return true;
  return false;
}
/* Natural rock blends across cells, but an isolated unseen floor notch must stay
 * concealed. Soften its square omission on the known side of the fog boundary;
 * never sample its terrain or mark it explored. Wider fog keeps its own shape. */
function naturalFogNotch(x,y,W,H,known){
  if(x<1||y<1||x>=W-1||y>=H-1||known[y*W+x]||typeof ptMat!=='function')return false;
  var material=ptMat(x,y);if(!material)return false;
  for(var dy=-1;dy<=1;dy++)for(var dx=-1;dx<=1;dx++){
    if(!dx&&!dy)continue;
    if(!known[(y+dy)*W+x+dx]||ptMat(x+dx,y+dy)!==material)return false;
  }
  return true;
}
function drawNaturalFogNotch(px,py){
  var cx=px+TS*.5,cy=py+TS*.5,inner=TS*.72,outer=TS*1.08;
  ctx.save();ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
  // The opaque radius contains every corner of the undiscovered cell. Only
  // already-known ground in the surrounding ring is additionally darkened.
  var fog=ctx.createRadialGradient(cx,cy,inner,cx,cy,outer);
  fog.addColorStop(0,'rgba(0,0,0,1)');fog.addColorStop(.45,'rgba(0,0,0,.55)');fog.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=fog;ctx.fillRect(cx-outer,cy-outer,outer*2,outer*2);ctx.restore();
}
function drawTerrainPass(){
  var x, y, W=MW, H=MH, M=map, V=vis, S=seen, all=revealAll&&!playerBlind(), x0=camX, y0=camY, fade=memA(0.40),fogNotches=[];
  for(y=y0;y<=y0+viewH;y++) for(x=x0;x<=x0+viewW;x++){
    if(x<0||y<0||x>=W||y>=H) continue;
    var i=y*W+x, lit=all||V[i], known=all||S[i];
    if(!known){if(spriteOn&&naturalFogNotch(x,y,W,H,S))fogNotches.push([(x-x0)*TS,(y-y0)*TS]);continue;}
    var t=M[i], px=(x-x0)*TS, py=(y-y0)*TS, a=lit?1:fade;
    if(spriteOn){
      if(isWallLike(t)) blitTile(wallTile(x,y), px, py, a);
      else if(t===CHASM){ ctx.globalAlpha=a; ctx.fillStyle='#050408'; ctx.fillRect(px,py,TS+1,TS+1); }
      else blitTile(floorTile(x,y), px, py, a);
    } else {
      var B=biome();
      var deepWater=t===WATER&&floorMeta.fwaDeep&&floorMeta.fwaDeep[i];
      ctx.globalAlpha=a; ctx.fillStyle = isWallLike(t) ? B.wall : t===CHASM ? '#050408' : t===LAVA ? '#B94820' : t===WATER ? deepWater?'#123C6C':'#243A4A' : B.floor; ctx.fillRect(px,py,TS,TS);
      if(t===LAVA||deepWater)glyph(t===LAVA?'~':'≈',px,py,t===LAVA?'#FFC05A':'#70BFFF');
      /* Block Art: a wall face shades the floor below it. (2026-09-27, Justin, render plan Q12: the painted walls have
         no such square-edged band; their art and the lightmap own the wall base. Not under Caverns or plane rock.) */
      if(!isWallLike(t) && isWallLike(at(x,y-1)) && t!==CHASM && !(typeof ptMat==='function' && ptMat(x,y))){
        ctx.globalAlpha=0.55*a; var sg=ctx.createLinearGradient(0,py,0,py+TS*0.35); sg.addColorStop(0,'rgba(0,0,0,0.7)'); sg.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle=sg; ctx.fillRect(px,py,TS,TS*0.35);
      }
    }
    /* wall tops get capstone rims where they meet open ground; faces show their ends and fixtures (surface.js) */
    if(spriteOn && isWallLike(t)){
      if(typeof drawWallEdges==='function') drawWallEdges(x, y, t, px, py, a);
      else if(isWallLike(at(x,y+1))){
        ctx.globalAlpha=0.35*a; ctx.fillStyle='#8C8378';
        if(!isWallLike(at(x-1,y))) ctx.fillRect(px,py,2,TS);
        if(!isWallLike(at(x+1,y))) ctx.fillRect(px+TS-2,py,2,TS);
        if(!isWallLike(at(x,y-1))) ctx.fillRect(px,py,TS,2);
      }
    }
  }
  fogNotches.forEach(function(p){drawNaturalFogNotch(p[0],p[1]);});
  ctx.globalAlpha=1;
}
/* fallback water tint where no water tileset exists */
function drawTerrainFallback(now){
  var x, y, W=MW, H=MH, M=map, V=vis, S=seen, all=revealAll&&!playerBlind(), fade=memA(0.4);
  for(y=camY;y<=camY+viewH;y++) for(x=camX;x<=camX+viewW;x++){
    if(x<0||y<0||x>=W||y>=H) continue; var ii=y*W+x; if(!(all||S[ii])) continue;
    var tt=M[ii], ppx=(x-camX)*TS, ppy=(y-camY)*TS, aa=(all||V[ii])?1:fade;
    if(tt===WATER && !(AS.wang_water)){ ctx.globalAlpha=0.55*aa; ctx.fillStyle='#2E5E80'; ctx.fillRect(ppx,ppy,TS,TS);
      ctx.globalAlpha=0.25*aa; ctx.fillStyle='#9FD8FF'; ctx.fillRect(ppx+TS*0.2+Math.sin(now/600+x)*2,ppy+TS*0.3,TS*0.3,1); }
    if(tt===CHASM && !(AS.wang_chasm)){ ctx.globalAlpha=aa; ctx.fillStyle='#000'; ctx.fillRect(ppx+2,ppy+2,TS-4,TS-4); }
  }
  ctx.globalAlpha=1;
}
/* the ground segments in drawing order; still: true, or whether the segment holds still this frame */
var GROUND_SEGMENTS=null;
function groundSegments(){
  if(GROUND_SEGMENTS) return GROUND_SEGMENTS;
  var list=[
    {name:'terrain', run:drawTerrainPass, still:true},
    {name:'water', run:function(){ if(spriteOn) drawWangLayer('water', WATER); }, still:function(){   /* the glints on lit water move */
      if(!spriteOn || ANIM.reduce || ptMat()) return true; var M=map, V=vis, all=revealAll; return !groundRangeAny(function(i){ return M[i]===WATER && (all||V[i]); }); }},
    {name:'chasm', run:function(){ if(spriteOn) drawWangLayer('chasm', CHASM); }, still:function(){   /* the Underdark's lava flows */
      if(!spriteOn || !inDeep() || !floorMeta.lava || ANIM.reduce) return true; var M=map, S=seen, all=revealAll; return !groundRangeAny(function(i){ return M[i]===LAVA && (all||S[i]); }); }},
    {name:'fallback', run:drawTerrainFallback, still:function(){
      if(AS.wang_water) return true; var M=map, S=seen, all=revealAll; return !groundRangeAny(function(i){ return M[i]===WATER && (all||S[i]); }); }}
  ];
  /* moss, grit, drains... (surface.js and the passes after it), the same passes drawSurfaceDeco runs */
  SURFACE_PASSES.forEach(function(p){
    list.push({name:p.name, run:function(){ if(spriteOn && (!p.when || p.when())) p.run(); }, still:function(){
      if(!spriteOn || (p.when && !p.when())) return true;
      var s=SURFACE_STILL[p.name]; return s===true || (typeof s==='function' && !!s()); }});
  });
  list.push({name:'void', run:function(now){
    if(spriteOn&&typeof FoteChaosPreviewRenderer!=='undefined'&&FoteChaosPreviewRenderer.active())FoteChaosPreviewRenderer.drawVoid(now);
    ctx.globalAlpha=1;
  }, still:function(){ return !(spriteOn&&typeof FoteChaosPreviewRenderer!=='undefined'&&FoteChaosPreviewRenderer.active()); }});
  return GROUND_SEGMENTS=list;
}
function groundState(c){
  var out=GROUND_STATE.map(function(k){ return c[k]; }); out.push(c.getLineDash().join(',')); return out;
}
function setGroundState(c, s){
  for(var k=0;k<GROUND_STATE.length;k++) if(c[GROUND_STATE[k]]!==s[k]) c[GROUND_STATE[k]]=s[k];
  if(c.getLineDash().join(',')!==s[k]) c.setLineDash(s[k] ? s[k].split(',').map(Number) : []);
}
/* everything the still segments read, besides the map arrays around the view (compared cell by cell, below) */
function groundLayerKey(n, m, inherit){
  var k=[n, camX, camY, viewW, viewH, TS, m.a, m.d, ctx.canvas, ctx.canvas.width, ctx.canvas.height, spriteOn, lightingOn(), ANIM.reduce, revealAll, floorNo, worldSeed,
    map, vis, seen, ground, propGrid, props, props.length, rooms, floorMeta, floorMeta&&floorMeta.plane, floorMeta&&floorMeta.vegSpots, floorMeta&&floorMeta.vegSpots&&floorMeta.vegSpots.length,
    ATL_LOADS, typeof FoteEnvironmentDeco!=='undefined'&&FoteEnvironmentDeco.ready(),
    typeof FoteEnvironmentProps!=='undefined'&&FoteEnvironmentProps.ready(), typeof FoteEnvironmentVegetation!=='undefined'&&FoteEnvironmentVegetation.ready(),
    typeof FoteChaosPreviewRenderer!=='undefined'&&FoteChaosPreviewRenderer.active(), typeof FoteChaosPreviewRenderer!=='undefined'&&FoteChaosPreviewRenderer.mixed()];
  /* the functions the segments call, so one swapped out (a test's probe, a module's wrapper) redraws the layer */
  k.push(at, inb, idxOf, isWallLike, wallFaces, propAt, objArt, inCaverns, inDeep, ptMat, wallTile, floorTile, blitTile, drawWallEdges, drawWangLayer,
    drawGrime, drawOoze, drawVegMoss, drawVegSpots, drawDeco, drawSurfaceDecal, cachedRaster, blitRaster, memA, masonryFloorTile, masonryWallTile, drawCaveChasms, surfImg);
  /* props near the view, by identity and name (a maw's skirt reaches three tiles out) */
  var x0=camX-5, x1=camX+viewW+5, y0=camY-5, y1=camY+viewH+5;
  for(var i=0;i<props.length;i++){ var p=props[i]; if(p.x>=x0&&p.x<=x1&&p.y>=y0&&p.y<=y1) k.push(p, p.name); }
  return k.concat(inherit);
}
/* the map arrays around the view (four tiles out: the passes read neighbourhoods two tiles out of cells one tile out) */
function groundLayerSnap(out){
  var W=MW, H=MH, M=map, V=vis, S=seen, G=ground, P=propGrid, x0=Math.max(0,camX-4), x1=Math.min(W-1,camX+viewW+4), y0=Math.max(0,camY-4), y1=Math.min(H-1,camY+viewH+4);
  var n=(x1-x0+1)*(y1-y0+1)*2, same=!!out && out.length===n, j=0;
  if(!same) out=new Int32Array(n);
  for(var y=y0;y<=y1;y++) for(var x=x0;x<=x1;x++){
    var i=y*W+x, a=M[i]|V[i]<<8|S[i]<<16|G[i]<<24, b=P?P[i]:0;
    if(same && (out[j]!==a || out[j+1]!==b)) same=false;
    out[j++]=a; out[j++]=b;
  }
  return {same:same, snap:out};
}
/* Draws the still ground segments from the layer, redrawing it first when it no longer fits this frame, and returns
   the first segment left to draw live. m: the frame's transform (the screen's pixel ratio, then the camera offset);
   restX, restY: the camera offset (camOX, camOY) where the hero's slide ends. */
function drawGroundLayer(now, m, restX, restY){
  var segs=groundSegments(), n=0;
  while(n<segs.length && (segs[n].still===true || segs[n].still())) n++;
  var G=GROUND_LAYER, main=ctx, moving=camOX!==restX||camOY!==restY, L=moving ? G.slide : G.rest;
  var margin=moving ? Math.ceil(TS*m.a)+3 : 0, lw=main.canvas.width+margin, lh=main.canvas.height+margin;
  if(!GROUND_STATE) GROUND_STATE=['globalAlpha','globalCompositeOperation','fillStyle','strokeStyle','lineWidth','lineCap','lineJoin','miterLimit','lineDashOffset',
    'shadowOffsetX','shadowOffsetY','shadowBlur','shadowColor','font','textAlign','textBaseline','direction','imageSmoothingEnabled','imageSmoothingQuality',
    'filter','letterSpacing','wordSpacing','fontKerning','fontStretch','fontVariantCaps','textRendering'].filter(function(k){ return k in main; });
  var inherit=groundState(main), key=groundLayerKey(n, m, inherit);
  var why=L.epoch!==G.epoch ? 'dirty' : (!L.key || L.key.length!==key.length || L.c.width!==lw || L.c.height!==lh) ? 'key' : '';
  for(var k=0; !why && k<key.length; k++) if(L.key[k]!==key[k]) why='key';
  var snap=groundLayerSnap(why ? null : L.snap); if(!why && !snap.same) why='map';
  /* a resting camera needs the layer drawn at its exact offset; a sliding one takes it at the nearest whole pixel,
     so long as the layer's margin covers the shift */
  function covers(e){ var dx=Math.round(m.e-e[0]), dy=Math.round(m.f-e[1]); return dx<=0 && dy<=0 && dx>=2-margin && dy>=2-margin; }
  if(!why && !(moving ? covers(L.e) : (L.e[0]===m.e && L.e[1]===m.f))) why='offset';
  G.stats[why||'kept']++;   /* why the layer was redrawn, frame by frame (a diagnostic) */
  if(why){
    var e=[m.e, m.f];
    if(moving){
      main.save(); main.setTransform(m.a,0,0,m.d,0,0); main.translate(-restX,-restY); var r=main.getTransform(); main.restore();
      if(covers([r.e, r.f])) e=[r.e, r.f];
    }
    if(!L.c){ L.c=document.createElement('canvas'); L.g=L.c.getContext('2d'); }
    if(L.c.width!==lw || L.c.height!==lh){ L.c.width=lw; L.c.height=lh; }
    var g=L.g, frame=TILE_FRAME;
    L.key=null; L.epoch=G.epoch;
    g.setTransform(1,0,0,1,0,0); g.globalAlpha=1; g.globalCompositeOperation='source-over'; if('filter' in g) g.filter='none'; g.shadowColor='rgba(0,0,0,0)';
    g.clearRect(0,0,lw,lh); g.fillStyle='#000'; g.fillRect(0,0,lw,lh);   /* cleared first: nothing from its last drawing is left in it */
    setGroundState(g, inherit);
    g.setTransform(m.a,m.b,m.c,m.d,e[0],e[1]);
    ctx=g; TILE_FRAME={ctx:g, m:g.getTransform()}; G.building=true;
    try{ for(var s=0;s<n;s++) segs[s].run(now); }
    finally{ ctx=main; TILE_FRAME=frame; G.building=false; }
    /* terrain cells past this frame's budget were drawn with their stand-ins: draw the layer again next frame */
    if(typeof PT_CACHE!=='undefined' && PT_CACHE.built>=PT_BUDGET || typeof DC!=='undefined' && DC && DC.built>=DEEP_BUDGET) G.epoch++;
    /* the state the segments leave behind: what the blit below disturbs, and what they changed */
    var after=groundState(g), set=[];
    for(var q=0;q<after.length;q++) if(after[q]!==inherit[q] || /^(globalAlpha|globalCompositeOperation|filter|shadowColor|imageSmoothingEnabled)$/.test(GROUND_STATE[q])) set.push(q);
    L.after=after; L.set=set; L.deep=[DEEP_RC, DEEP_AT]; L.e=e; L.key=key; L.snap=snap.snap;
  }
  main.setTransform(1,0,0,1,0,0); main.globalAlpha=1; main.globalCompositeOperation='source-over'; if('filter' in main) main.filter='none';
  main.shadowColor='rgba(0,0,0,0)'; main.imageSmoothingEnabled=false;
  main.drawImage(L.c, Math.round(m.e-L.e[0]), Math.round(m.f-L.e[1]));
  main.setTransform(m.a,m.b,m.c,m.d,m.e,m.f);
  for(var q2=0;q2<L.set.length;q2++){ var at2=L.set[q2]; if(at2<GROUND_STATE.length) main[GROUND_STATE[at2]]=L.after[at2]; else main.setLineDash(L.after[at2] ? L.after[at2].split(',').map(Number) : []); }
  DEEP_RC=L.deep[0]; DEEP_AT=L.deep[1];
  return n;
}

/* The player remains centered at world edges; reveal tools keep their bounded view. */
function sceneCameraPoint(point){
  var preview=typeof sandboxRoomPreviewBounds==='function'&&sandboxRoomPreviewBounds();
  if(preview)return {x:preview.x+preview.w/2-viewW/2,y:preview.y+preview.h/2-viewH/2};
  if(revealAll)return {x:clamp(point.x-(viewW>>1),0,Math.max(0,MW-viewW)),y:clamp(point.y-(viewH>>1),0,Math.max(0,MH-viewH))};
  return {x:point.x-(viewW-1)/2,y:point.y-(viewH-1)/2};
}
function drawMapMargins(){
  var width=viewW*TS,height=viewH*TS,m=ctx.getTransform();
  function edge(v,scale,offset){return (Math.round(v*scale+offset+1e-6)-offset)/scale;}
  var left=clamp(edge(-camX*TS-camOX,m.a,m.e),0,width),top=clamp(edge(-camY*TS-camOY,m.d,m.f),0,height);
  var right=clamp(edge((MW-camX)*TS-camOX,m.a,m.e),0,width),bottom=clamp(edge((MH-camY)*TS-camOY,m.d,m.f),0,height);
  ctx.save();ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';ctx.shadowColor='rgba(0,0,0,0)';
  if('filter' in ctx)ctx.filter='none';ctx.fillStyle='#000';
  if(top>0)ctx.fillRect(0,0,width,top);if(bottom<height)ctx.fillRect(0,bottom,width,height-bottom);
  if(left>0)ctx.fillRect(0,0,left,height);if(right<width)ctx.fillRect(right,0,width-right,height);
  ctx.restore();
}

/* ---- map beacons: compact floor markers for live, meaningful interactions ---- */
function mapBeaconTile(x,y,t){
  if(t!==STAIRS&&t!==EXIT&&t!==CHEST&&t!==FORGE&&t!==SHRINE)return null;
  // Chaos currents have their own gate artwork and cues instead of the underlying tile.
  if(typeof FoteChaosCampaign!=='undefined'&&FoteChaosCampaign.currentInfo(x,y))return null;
  if(t===STAIRS || t===EXIT&&floorMeta.exitOpen)return '#9FD8FF';
  if(t===CHEST){
    var kind=chestKind[idxOf(x,y)];
    if(kind!=='mimic'&&(kind==='chest-gold'||enhancedChestAt(x,y)))return '#E8B44A';
  }
  if(t===FORGE)return '#FF8A3A';
  if(t===SHRINE)return (GODS[RUN.shrineGod]||{}).color||'#E6D9BC';
  return null;
}
function mapBeaconProp(p){
  if(p.used)return null;
  if(p.cleansingShrine)return '#BCA0EF';
  if(p.offeringBowl){
    var room=puzzleRoomAt(p.x,p.y);
    return room&&room.puzzle&&!room.puzzle.solved?'#73EE75':null;
  }
  if(p.eventRoom!==undefined){
    var eventRoom=rooms.find(function(r){return r.id===p.eventRoom;}),event=eventRoom&&eventRoom.uncommonEvent;
    return event&&!event.used&&(event.kind==='portcullis-cache'||event.kind==='silk-survivor')?'#E8D27A':null;
  }
  if(p.altar)return sacrificeNextReward(p)!==null?'#D96A60':null;
  if(p.prisoner)return !p.ritual||p.captiveHp>0?'#E8D27A':null;
  if(p.name==='elemental-lock')return !p.opened?AFF_COL[p.element]||'#C9A8FF':null;
  var lever=leverDetails(p);
  if(lever)return !lever.used?'#E8D27A':null;
  if(p.name==='final-forge'&&typeof FoteUnmakerEncounter!=='undefined'){
    var forge=FoteUnmakerEncounter.forgeInfo(p.x,p.y);
    return forge&&forge.ready?'#FF8A3A':null;
  }
  return null;
}
/* One small texture per color, independent of tile size. No new particles or
 * light sources, and no per-frame gradient allocation for each marker. */
var MAP_BEACON_GLOWS=Object.create(null);
function mapBeaconGlow(color){
  if(MAP_BEACON_GLOWS[color])return MAP_BEACON_GLOWS[color];
  var canvas=document.createElement('canvas');canvas.width=canvas.height=64;
  var ink=canvas.getContext('2d'),glow=ink.createRadialGradient(32,32,0,32,32,32);
  glow.addColorStop(0,hexA(color,.26));glow.addColorStop(.5,hexA(color,.14));glow.addColorStop(1,hexA(color,0));
  ink.fillStyle=glow;ink.fillRect(0,0,64,64);
  MAP_BEACON_GLOWS[color]=canvas;return canvas;
}
function drawMapBeacon(x,y,w,h,color,alpha,now,scale){
  scale=scale||1;
  var cx=(x-camX+w*.5)*TS,cy=(y-camY+h-.18)*TS;
  var pulse=ANIM.reduce||alpha<1?1:.84+.16*Math.sin(now/720+x*1.3+y*.7);
  ctx.save();ctx.globalAlpha=alpha*pulse;ctx.imageSmoothingEnabled=true;
  ctx.drawImage(mapBeaconGlow(color),cx-TS*w*.48*scale,cy-TS*.18*scale,TS*w*.96*scale,TS*.36*scale);
  ctx.globalAlpha=alpha*(.58+.16*pulse);ctx.strokeStyle=color;ctx.lineWidth=Math.max(1,Math.min(2,TS*.018));
  ctx.beginPath();ctx.ellipse(cx,cy,TS*w*.38*scale,TS*.14*scale,0,0,Math.PI*2);ctx.stroke();ctx.restore();
}
function drawMapBeacons(now){
  var W=MW,H=MH,M=map,S=seen,V=vis,blind=playerBlind(),all=revealAll&&!blind;
  var x0=Math.max(0,camX-1),y0=Math.max(0,camY-1),x1=Math.min(W-1,camX+viewW+1),y1=Math.min(H-1,camY+viewH+1);
  // This pass is above the lightmap: memory needs its own steady, dim alpha.
  function admission(x,y){var i=y*W+x;return all||V[i]?1:!blind&&S[i]?.35:0;}
  function paint(x,y,w,h,color,alpha,scale,prop){
    if(!prop&&scale===1){drawMapBeacon(x,y,w,h,color,alpha,now);return;}
    // Larger circles extend beyond the anchor tile, but never into unknown cells.
    var left=Math.floor(Math.min(x,x+w*.5-w*.48*scale)),right=Math.ceil(Math.max(x+w,x+w*.5+w*.48*scale));
    var top=Math.floor(Math.min(y,y+h-.18-.18*scale)),bottom=Math.ceil(Math.max(y+h,y+h-.18+.18*scale));
    ctx.save();ctx.beginPath();
    for(var yy=Math.max(0,top);yy<Math.min(H,bottom);yy++)for(var xx=Math.max(0,left);xx<Math.min(W,right);xx++){
      if(admission(xx,yy))ctx.rect((xx-camX)*TS,(yy-camY)*TS,TS,TS);
    }
    ctx.clip();drawMapBeacon(x,y,w,h,color,alpha,now,scale);ctx.restore();
  }
  for(var y=y0;y<=y1;y++)for(var x=x0;x<=x1;x++){
    var alpha=admission(x,y);if(!alpha)continue;
    var tile=M[y*W+x],color=mapBeaconTile(x,y,tile);
    if(color)paint(x,y,1,1,color,alpha,tile===FORGE?1.8:tile===SHRINE?1.6:1,false);
  }
  props.forEach(function(p){
    var w=p.w||1,h=p.h||1;
    if(p.x+w<x0||p.x>x1||p.y+h<y0||p.y>y1||p.x<0||p.y<0||p.x>=W||p.y>=H)return;
    var alpha=admission(p.x,p.y);if(!alpha)return;
    var color=mapBeaconProp(p);if(!color)return;
    paint(p.x,p.y,w,h,color,alpha,p.name==='final-forge'?1.35:p.cleansingShrine?1.25:1,true);
  });
}

/* ============================================================== draw */
function drawScene(){
  if(!map || !ground) return;
  /* the run state is read through getters (js/engine/state.js); a frame reads it once, here (2026-09-28, frame cost) */
  var x, y, now=performance.now(), W=MW, H=MH, MAP=map, VIS=vis, SEEN=seen, GRD=ground, BLIND=playerBlind(), ALL=revealAll&&!BLIND, FIRE=fireT, fade40=memA(0.4), fade45=memA(0.45);
  var prp=renderPos(player), camera=sceneCameraPoint(prp), rest=sceneCameraPoint(player);
  camX=Math.floor(camera.x);camY=Math.floor(camera.y);
  camOX=(camera.x-camX)*TS;camOY=(camera.y-camY)*TS;
  var restFX=rest.x,restFY=rest.y;
  ctx.globalAlpha=1; ctx.fillStyle='#000';
  /* the layer is kept for the plain screen transform; a shaking frame, or a watched canvas, draws the ground directly */
  var screen=ctx.getTransform(), layered=GROUND_LAYER_ON && screen.b===0 && screen.c===0 && screen.e===0 && screen.f===0 && screen.a===screen.d && !groundWatched(ctx);
  if(!layered){ ctx.fillRect(0,0,viewW*TS,viewH*TS); if(GROUND_LAYER_ON) GROUND_LAYER.stats.direct++; }
  ctx.save(); ctx.translate(-camOX, -camOY); TILE_FRAME={ctx:ctx, m:ctx.getTransform()};

  /* ---- terrain and the ground passes over it (moss, grit, drains: surface.js and after) ---- */
  var segs=groundSegments(), seg=layered ? drawGroundLayer(now, TILE_FRAME.m, (restFX-camX)*TS, (restFY-camY)*TS) : 0;
  for(; seg<segs.length; seg++) segs[seg].run(now);

  /* ---- ground decals ---- */
  for(y=camY;y<=camY+viewH;y++) for(x=camX;x<=camX+viewW;x++){
    if(x<0||y<0||x>=W||y>=H) continue; var gi=y*W+x, gv=GRD[gi]; if(!gv || !(ALL||SEEN[gi])) continue;
    var ga=(ALL||VIS[gi])?1:fade40, gpx=(x-camX)*TS, gpy=(y-camY)*TS, go=objArt('terrain', GROUND_ART[gv]);
    if(!spriteOn){
      ctx.save();ctx.globalAlpha=ga*.4;ctx.fillStyle=gv===G_GRASS||gv===G_SHORT?'#4A6A32':gv===G_ASH||gv===G_SCORCH?'#3A3632':'#A9A08B';ctx.fillRect(gpx+TS*.08,gpy+TS*.08,TS*.84,TS*.84);
      ctx.globalAlpha=ga;glyph(gv===G_GRASS?'"':gv===G_WEB?'#':'.',gpx,gpy,'#B7B49F');ctx.restore();continue;
    }
    if(gv===G_GRASS){ drawGrassTile(x, y, gpx, gpy, ga, 'back', now); continue; }
    if(drawGroundDecal(gv, x, y, gpx, gpy, ga, now)) continue;
    if(go) drawObj(go, gpx, gpy, {fit:0.9, alpha:ga*0.95});
    else if(gv===G_SHORT||gv===G_ASH||gv===G_SCORCH){
      /* not a full tile of flat colour (that read as a grey square under trampled grass): a ragged blotch instead */
      var col={1:'#2F5A24',2:'#4A6A32',3:'#3A3632',6:'#141210'}[gv];
      ctx.globalAlpha=0.3*ga; ctx.fillStyle=col;
      for(var bb=0;bb<7;bb++){
        var bh=hash2(x,y,300+bb), bh2=hash2(x,y,320+bb), br=TS*(0.16+hash2(x,y,340+bb)*0.2);
        ctx.beginPath(); ctx.ellipse(gpx+TS*(0.2+bh*0.6), gpy+TS*(0.2+bh2*0.6), br, br*0.7, bh*3, 0, 7); ctx.fill();
      }
      ctx.globalAlpha=1;
    }
  }
  var upright=[];
  function standing(row,paint){upright.push({row:row,paint:paint,order:upright.length});}
  /* ---- tile objects ---- */
  function paintTileObject(x,y,scoped){
    if(!scoped&&typeof FoteChaosPreviewRenderer!=='undefined'&&FoteChaosPreviewRenderer.mixed())return FoteChaosPreviewRenderer.withCell(x,y,function(){return paintTileObject(x,y,true);});
    if(x<0||y<0||x>=W||y>=H) return; var oi=y*W+x; if(!(ALL||SEEN[oi])) return;
    var ot=MAP[oi]; if(ot===FLOOR||ot===WALL||ot===WATER||ot===CHASM||ot===SECRET||!spriteOn&&ot===LAVA) return;
    // Multi-tile preview gateways are painted once by the ordinary set renderer.
    if(spriteOn&&ot===PORTAL&&floorMeta&&floorMeta.chaosPreview){var gateway=propAt(x,y);if(gateway&&gateway.previewPortal)return;}
    var oa=(ALL||VIS[oi])?1:fade45, opx=(x-camX)*TS, opy=(y-camY)*TS, spr=spriteOn?tileSprite(x,y,ot):null;
    if(!spriteOn){
      ctx.save();ctx.globalAlpha=oa;
      if(ot===OPEN){ctx.strokeStyle='#AD8352';ctx.lineWidth=Math.max(2,TS*.07);ctx.strokeRect(opx+TS*.1,opy+TS*.1,TS*.8,TS*.8);glyph('/',opx,opy,'#AD8352');}
      else {ctx.fillStyle=ot===PORTAL?'#7955A8':ot===FORGE?'#BE663C':ot===SHRINE?'#B3A36E':ot===CHEST?'#B08A48':ot===BRIDGE?'#7A5A34':ot===EXIT||ot===STAIRS||ot===UPSTAIRS?'#436779':'#6B4B2A';ctx.fillRect(opx+TS*.12,opy+TS*.12,TS*.76,TS*.76);
        glyph(ot===PORTAL?'O':ot===FORGE?'F':ot===SHRINE?'A':ot===CHEST?'C':ot===BRIDGE?'=':ot===EXIT||ot===STAIRS?'>':ot===UPSTAIRS?'<':'+',opx,opy,'#F0DFBB');}
      ctx.restore();return;
    }
    if(typeof FoteChaosCurrentRenderer!=='undefined'&&FoteChaosCurrentRenderer.drawGate(x,y,opx,opy,oa))return;
    if(typeof FoteChaosCampaign!=='undefined'&&FoteChaosCampaign.currentInfo(x,y))return;
    if(typeof FoteUnmakerPreview!=='undefined'&&FoteUnmakerPreview.drawGate(x,y,opx,opy,oa))return;
    if(ot===CHEST && typeof propShadow==='function') propShadow(x, y, opx, opy, oa, 'chest');
    if(!(ot===SEALED&&propAt(x,y)&&propAt(x,y).eventGate) && typeof drawSideDoor==='function' && drawSideDoor(x, y, ot, opx, opy, oa)) return;   /* ordinary doors in east/west walls (surface.js); event gates use their fitted art below */
    if(ot===OPEN){ drawOpenDoor(x, y, opx, opy, oa); return; }
    var isDoor=(ot===DOOR||ot===OPEN||ot===LOCKED||ot===TOLL||ot===ICEDOOR||ot===THORNS||ot===SEALED);
    if(spr){
      var big = ot===FORGE||ot===SHRINE||ot===EXIT;   /* 2026-09-19: the god statues are two tiles tall - a shrine stands on its tile and rises above it */
      drawObj(spr, opx, opy, {feet:!isDoor && ot!==CHEST && ot!==STAIRS && ot!==19 && ot!==BRIDGE, fit: isDoor?(propAt(x,y)&&propAt(x,y).eventGate?1.4:1.02) : ot===SHRINE?2.1 : ot===FORGE?2.3 : big?1.18 : (ot===STAIRS||ot===19)?0.95 : 0.85, alpha:oa, fill: isDoor&&!(propAt(x,y)&&propAt(x,y).eventGate)});
      if(ot===EXIT && !floorMeta.exitOpen && !floorMeta.caveExit){ ctx.globalAlpha=0.55*oa; ctx.fillStyle='#000'; ctx.fillRect(opx+TS*0.2,opy+TS*0.1,TS*0.6,TS*0.8); ctx.globalAlpha=1; }
      if(ot===SEALED && !(propAt(x,y)&&propAt(x,y).eventGate) && !(floorMeta.crystalDoor && floorMeta.crystalDoor.x===x && floorMeta.crystalDoor.y===y)){ ctx.globalAlpha=0.35*oa; ctx.fillStyle='#6FB7FF'; ctx.fillRect(opx,opy,TS,TS); ctx.globalAlpha=1; }
    } else {
      ctx.globalAlpha=oa;
      var col={2:'#6B4B2A',7:'#53381F',3:'#E8B44A',4:'#7A5A2A',5:'#E2622B',9:'#8A8A9A',10:'#F6E7B0',11:'#9FD8FF',12:'#3E6B2E',13:'#9FD8FF',14:'#B8453A',17:'#7A5A34',18:'#6FB7FF'}[ot]||'#555';
      ctx.fillStyle=col; ctx.fillRect(opx+TS*0.12,opy+TS*0.12,TS*0.76,TS*0.76); ctx.globalAlpha=1;
    }
  }
  for(y=camY;y<=camY+viewH;y++) for(x=camX;x<=camX+viewW;x++){
    if(x<0||y<0||x>=W||y>=H || !(ALL||SEEN[y*W+x]))continue;
    // A bridge is a walking surface, not an upright obstacle. Interpolated
    // actors approaching from the north must still stand above its deck.
    if(MAP[y*W+x]===BRIDGE){paintTileObject(x,y);continue;}
    (function(tx,ty){standing(ty+1,function(){paintTileObject(tx,ty);});})(x,y);
  }
  /* pressure plates */
  if(plates) plates.cells.forEach(function(p){
    if(!(ALL||SEEN[p.y*W+p.x])) return;
    if(BLIND&&!VIS[p.y*W+p.x])return;
    var ppx=(p.x-camX)*TS, ppy=(p.y-camY)*TS;
    if(spriteOn)drawObj(objArt('structures', p.pressed?'plate-glow':'trap-plate') || objArt('traps','trap-plate'), ppx, ppy, {fit:0.8, alpha:(ALL||VIS[p.y*W+p.x])?1:fade45});
    else {ctx.save();ctx.globalAlpha=(ALL||VIS[p.y*W+p.x])?1:fade45;ctx.fillStyle=p.pressed?'#877444':'#49433D';ctx.fillRect(ppx+TS*.1,ppy+TS*.1,TS*.8,TS*.8);ctx.restore();}
    ctx.fillStyle = p.pressed ? '#FFE9A0' : '#D8CFC0'; ctx.font='700 '+Math.round(TS*0.42)+'px serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText({moon:'\u263E', sun:'\u2600', star:'\u2605'}[p.symbol], ppx+TS/2, ppy+TS/2);
  });
  /* only what the camera shows; a standing piece may rise up to three tiles above its footprint */
  function onCamera(x,y,w,h){ return x+(w||1)>=camX-1 && x<=camX+viewW+1 && y+(h||1)>=camY-1 && y<=camY+viewH+3; }
  /* traps you know about */
  feats.forEach(function(f){
    if(!(ALL||f.found) || !(ALL||SEEN[f.y*W+f.x]) || !onCamera(f.x,f.y)) return;
    if(BLIND&&!VIS[f.y*W+f.x])return;
    var fpx=(f.x-camX)*TS, fpy=(f.y-camY)*TS, fa=(ALL||VIS[f.y*W+f.x])?1:fade45;
    drawTrap(f, fpx, fpy, fa, now);
  });
  drawTelegraphs(now);   /* boss attack markings sit on the floor, under whoever stands there */
  /* props */
  function paintProp(p,scoped){
    if(!scoped&&typeof FoteChaosPreviewRenderer!=='undefined'&&FoteChaosPreviewRenderer.mixed())return FoteChaosPreviewRenderer.withCell(p.x,p.y,function(){return paintProp(p,true);});
    if(!(ALL||SEEN[p.y*W+p.x])) return;
    if(BLIND&&!VIS[p.y*W+p.x])return;
    var ppx=(p.x-camX)*TS, ppy=(p.y-camY)*TS, pa=(ALL||VIS[p.y*W+p.x])?1:fade45;
    if(!spriteOn){
      ctx.save();ctx.globalAlpha=pa;ctx.fillStyle=p.b?'#6A5A48':p.name==='vines'?'#4A6A32':'#4A4038';ctx.fillRect(ppx+TS*.15,ppy+TS*.15,TS*((p.w||1)-.3),TS*((p.h||1)-.3));
      if(p.previewPortal||p.prisoner||p.altar||p.name==='elemental-lock'||p.name==='updraft-vent')glyph(p.previewPortal?'O':p.prisoner?'!':p.altar?'A':p.name==='updraft-vent'?'↑':'+',ppx,ppy,p.name==='updraft-vent'?'#CDEEFF':p.element?AFF_COL[p.element]:'#E8B44A');ctx.restore();return;
    }
    var artName=p.artName||p.name;
    var o=spriteOn ? objArt('props',artName)||objArt('structures',artName)||objArt('chests',artName)||objArt('terrain',artName) : null;   /* an opened chest's art lives with the chests */
    if(o&&o.frames>1&&!ANIM.reduce&&!p.used)o=Object.assign({},o,{sx:o.sx+(Math.floor(now/(o.frameMs||160))%o.frames)*o.sw});
    if(p.name==='elemental-lock' && p.opened) pa*=0.6;
    if(p.name==='vines'){ drawVines(p.x, p.y, ppx, ppy, pa, now); return; }
    if(p.pillar && !o){ drawPillar(p, ppx, ppy, pa, now); return; }
    if(typeof drawPropSurface==='function' && drawPropSurface(p, ppx, ppy, pa)) return;   /* flat bones and rubble (surface.js) */
    if(typeof propShadow==='function' && !p.flat && !/^(soul-urn|soul-brazier|kobold-campfire)$/.test(p.name)) propShadow(p.x, p.y, ppx, ppy, pa, p.name);   /* contact shadow (surface.js) */
    if(!drawObj(o, ppx, ppy, {feet:!p.flat, fit: p.flat?0.82 : (p.name==='bookshelf'||p.name==='statue'||p.name==='boss-throne')?1.12 : /^(urn|coffin|sarcophagus|tomb)/.test(p.name)?1.08 : 0.9, alpha:pa, flash:flashOf(p)})){
      ctx.globalAlpha=pa; ctx.fillStyle=p.b?'#6A5A48':'#4A4038'; ctx.fillRect(ppx+TS*0.2,ppy+TS*0.2,TS*0.6,TS*0.6); ctx.globalAlpha=1;
    }
    if(typeof propFlame==='function') propFlame(p, o, ppx, ppy, pa, now);   /* animated flames (surface.js) */
    if(p.offeringBowl){
      ctx.save();ctx.globalAlpha=pa;var flicker=ANIM.reduce?0:Math.sin(now/130+p.x)*TS*.025;
      ctx.fillStyle='#64DE70';ctx.beginPath();ctx.moveTo(ppx+TS*.35,ppy+TS*.5);ctx.quadraticCurveTo(ppx+TS*.25,ppy+TS*.32,ppx+TS*.49,ppy+TS*.12+flicker);ctx.quadraticCurveTo(ppx+TS*.48,ppy+TS*.32,ppx+TS*.64,ppy+TS*.36);ctx.quadraticCurveTo(ppx+TS*.74,ppy+TS*.58,ppx+TS*.35,ppy+TS*.5);ctx.fill();
      ctx.fillStyle='#D9FFAB';ctx.beginPath();ctx.moveTo(ppx+TS*.44,ppy+TS*.49);ctx.quadraticCurveTo(ppx+TS*.4,ppy+TS*.4,ppx+TS*.52,ppy+TS*.3);ctx.quadraticCurveTo(ppx+TS*.61,ppy+TS*.5,ppx+TS*.44,ppy+TS*.49);ctx.fill();ctx.restore();
    }
    if(p.name==='elemental-lock' && !p.opened){ ctx.globalAlpha=pa*(0.6+0.3*Math.sin(now/300)); ctx.fillStyle=AFF_COL[p.element]; ctx.beginPath(); ctx.arc(ppx+TS/2,ppy+TS*0.25,TS*0.1,0,7); ctx.fill(); ctx.globalAlpha=1; }
    if(p.prisoner && (ALL||VIS[p.y*W+p.x])){ mark('!', ppx+TS*0.72, ppy+TS*0.2, '#E8B44A'); }
  }
  props.forEach(function(p){
    if(!onCamera(p.x,p.y,p.w,p.h))return;
    if(p.flat || p.name==='vines')paintProp(p);
    else standing(p.y+(p.h||1),function(){paintProp(p);});
  });
  // The walkable spore pool and other flat scenery must not cover combat tiles.
  if(typeof FoteChaosEnemyArt!=='undefined')FoteChaosEnemyArt.drawHazards(now);

  /* items: after the flat props, so a pickup dropped on rubble, bones or moss lies on top of them rather than
     under them (2026-09-22, Justin: a mana globe under a rock); standing props and creatures are deferred and
     still cover it */
  items.forEach(function(it){
    if(it.crystal)return;
    if(!(ALL||VIS[it.y*W+it.x])) return;
    var ipx=(it.x-camX)*TS, ipy=(it.y-camY)*TS, ia=(ALL||VIS[it.y*W+it.x])?1:fade45;
    var bob = ANIM.reduce ? 0 : Math.sin(now/400 + it.x*2 + it.y)*TS*0.03;
    if(it.kind==='key'){
      /* 2026-09-17: a key on a stone floor was almost impossible to spot, and missing one locks the vault
         for the rest of the floor. It sits in a blue glow that breathes. */
      var kp = ANIM.reduce ? 1 : 0.75 + 0.25*Math.sin(now/420 + it.x + it.y);
      var kc = it.key==='crystal' ? '160,230,255' : '120,190,255';
      var kg = ctx.createRadialGradient(ipx+TS/2, ipy+TS*0.58, TS*0.05, ipx+TS/2, ipy+TS*0.58, TS*0.62);
      kg.addColorStop(0, 'rgba('+kc+','+(0.55*kp*ia)+')');
      kg.addColorStop(0.55, 'rgba('+kc+','+(0.18*kp*ia)+')');
      kg.addColorStop(1, 'rgba('+kc+',0)');
      ctx.fillStyle=kg; ctx.beginPath(); ctx.arc(ipx+TS/2, ipy+TS*0.58, TS*0.62, 0, 7); ctx.fill();
      if(!ANIM.reduce && Math.random()<0.10) sparkleFx(it.x, it.y, 'ice', 1);
    }
    ctx.save();
    if(phoneActorClarity())ctx.filter='brightness(1.2) drop-shadow(0px 0px 0.45px rgba(23,18,15,.55))';
    if(it.kind==='heart' || it.kind==='managlobe'){ drawGlobe(it, ipx, ipy+bob, ia, now); ctx.restore(); return; }
    var o=spriteOn ? (objArt('items', itemArtName(it))) : null;
    if(o) drawObj(o, ipx, ipy+TS*0.08+bob, {fit: ITEM_FIT[it.kind]||0.5, alpha:ia, loot:true});
    else { ctx.globalAlpha=ia; glyph(it.kind==='essence'?'\u2022':it.kind==='mote'?'\u25C6':it.kind==='food'?'%':it.kind==='sigil'?'?':it.kind==='armor'?'[':'/', ipx, ipy, it.kind==='mote'?AFF_COL[it.el]:it.kind==='essence'?'#B98AF0':'#E8B44A'); ctx.globalAlpha=1; }
    ctx.restore();
    if(it.kind==='mote' && !ANIM.reduce){ ctx.save(); ctx.globalCompositeOperation='lighter'; ctx.globalAlpha=0.18+0.08*Math.sin(now/200+it.x); ctx.fillStyle=AFF_COL[it.el]; ctx.beginPath(); ctx.arc(ipx+TS/2,ipy+TS*0.58,TS*0.2,0,7); ctx.fill(); ctx.restore(); }
  });
  /* fire on the ground */
  for(y=camY;y<=camY+viewH;y++) for(x=camX;x<=camX+viewW;x++){
    if(x<0||y<0||x>=W||y>=H || !FIRE[y*W+x] || !(ALL||VIS[y*W+x])) continue;
    var fpx2=(x-camX)*TS, fpy2=(y-camY)*TS;
    /* 2026-09-20: Justin - the burning-ground flames read as too big; 70% of what they were */
    drawBurningFlame(fpx2+TS*.5,fpy2+TS*.92,TS*.61,now,x*5+y*7,.62);
    if(typeof emitFire==='function') emitFire(x,y);
  }

  /* ---- entities, back to front ---- */
  var list=ents.filter(function(e){ return e!==player && actorVisible(e,true); }).sort(function(a,b){ return a.y-b.y; });
  function drawPlayer(){
    var poff=entOffset(player);
    atTile(prp.x,prp.y,function(px0,py0){
      var px=px0+poff[0]+shakeOf(player), py=py0+poff[1]-prp.hop*TS*0.10;
      ctx.globalAlpha=0.35; ctx.fillStyle='#000'; ctx.beginPath(); ctx.ellipse(px0+TS/2,py0+TS*0.9,TS*0.28,TS*0.1,0,0,7); ctx.fill(); ctx.globalAlpha=1;
      var fade = player.hidden>0 ? 0.5 : 1;
      var flip = heroFlip(player);
      if(!drawCharacter(player, px, py, {alpha:fade, flip:flip, flash:flashOf(player), sliding:motionActive(player,now)})){
        ctx.globalAlpha=fade; ctx.fillStyle=player.col||'#E8B44A'; roundRect(px+TS*0.14,py+TS*0.1,TS*0.72,TS*0.72,TS*0.16); ctx.fill(); glyph('@',px,py,'#120F0D'); ctx.globalAlpha=1;
      }
      if(player.st&&player.st.burn)drawBurningFlame(px+TS*.5,py+TS*.88,TS*.56,now,0,.44);
      var shp = typeof playerShield==='function' ? playerShield() : 0;
      if(shp>0){ var pulseS=ANIM.reduce?0.5:0.5+0.5*Math.sin(now/400); ctx.save(); ctx.globalAlpha=0.18+0.12*pulseS+Math.min(0.2, shp/player.maxhp*0.4);
        var gS=ctx.createRadialGradient(px0+TS/2,py0+TS*0.55,TS*0.2,px0+TS/2,py0+TS*0.55,TS*0.62); gS.addColorStop(0,'rgba(150,215,255,0)'); gS.addColorStop(0.8,'rgba(150,215,255,0.35)'); gS.addColorStop(1,'rgba(200,235,255,0.9)');
        ctx.fillStyle=gS; ctx.beginPath(); ctx.ellipse(px0+TS/2,py0+TS*0.55,TS*0.5,TS*0.62,0,0,7); ctx.fill(); ctx.restore(); }
      if(player.stillness>0){ ctx.save(); ctx.globalAlpha=0.5; ctx.strokeStyle='#9FD8FF'; ctx.setLineDash([3,3]); ctx.beginPath(); ctx.ellipse(px0+TS/2,py0+TS*0.9,TS*0.36,TS*0.12,0,0,7); ctx.stroke(); ctx.restore(); }
      if(player.levitate>0){ ctx.globalAlpha=0.35; ctx.strokeStyle='#E8D27A'; ctx.beginPath(); ctx.ellipse(px0+TS/2,py0+TS*0.92,TS*0.3,TS*0.09,0,0,7); ctx.stroke(); ctx.globalAlpha=1; }
    });
  }
  list.forEach(function(e){
    /* Large creatures stand at the bottom of their footprint, not its first row. */
    standing(renderPos(e).y+(!isShadeSummon(e)&&!e.livingFlame&&e.base.big||1),function(){
    var off=entOffset(e), rp=renderPos(e);
    atTile(rp.x,rp.y,function(px0,py0){
      // Only displayed bats get chest-height flight; summons can retain a bat's base data.
      var px=px0+off[0]+shakeOf(e), py=py0+off[1]-rp.hop*TS*0.14 - (e.base.flying ? TS*(e.base.sprite==='m-bat'&&!isShadeSummon(e)&&!e.livingFlame?0.50:0.12) + (ANIM.reduce?0:Math.sin(now/180+e.id)*TS*0.04) : 0);
      drawActorContactShadow(e,px0,py0);
      /* 2026-09-28: a creature faces the way it last stepped or struck (it used to face the player whatever it did, so a wanderer
         walked backwards); one that has not moved yet faces the player */
      var flip = typeof e.facingLeft==='boolean' ? e.facingLeft : player.x < e.x;
      if(e.base && e.base.artLeft && !isShadeSummon(e) && !e.livingFlame) flip = !flip;   /* respect the artwork actually displayed */
      if(!drawCharacter(e, px, py, {flip:flip, flash:flashOf(e), breath:breathOf(e), sliding:motionActive(e,now), outline:e.foe && !!vis[idxOf(e.x,e.y)]})){
        var bb=breathOf(e)*TS*0.6,blockSize=!spriteOn&&!isShadeSummon(e)&&!e.livingFlame&&e.base.big||1;
        ctx.fillStyle=e.col||'#A98C6C'; roundRect(px+TS*0.14,py+TS*0.1-bb,TS*(blockSize-.28),TS*(blockSize-.28)+bb,TS*0.16); ctx.fill(); glyph(e.ch||'?',px+TS*(blockSize-1)/2,py+TS*(blockSize-1)/2,'#120F0D');
        if(!spriteOn&&e.base.moonbound)drawMoonboundOverlay(e,px,py,{});
      }
      if(e.st&&e.st.burn)drawBurningFlame(px+TS*.5,py+TS*.88,TS*.56,now,e.id||0,.44);
      if(typeof FoteChaosEnemyArt!=='undefined')FoteChaosEnemyArt.drawActorCues(e,px0,py0,now);
      if(e.ally){ ctx.strokeStyle='#7FD08A'; ctx.lineWidth=2; ctx.beginPath(); ctx.ellipse(px0+TS/2,py0+TS*0.9,TS*0.34,TS*0.12,0,0,7); ctx.stroke(); ctx.lineWidth=1; }
      /* health bar only once hurt, or always for bosses */
      /* 2026-09-19: a boss has the bar across the top of the screen (ui.js bossBar) - no second one over its head */
      if(e.hp<e.maxhp && !(e.base && e.base.boss)){
        /* 2026-09-19: Justin - "the Matron's hp bar is on her waist". A big creature is drawn taller than its own
           tile, so the bar goes above what is actually drawn, and spans its whole footprint. */
        var bigN=(e.base && e.base.big) || 1, bScale=(e.base && e.base.bigScale) || 1;
        var artH=(e.base && e.base.art) || 0.9;                    /* tall art (the Matron stands 2.1 tiles) */
        var lift=Math.max(bigN*bScale>1 ? TS*(bigN*0.98*bScale-bigN) : 0, artH>1 ? TS*(artH-1) : 0);
        var barW=TS*0.76*bigN, barX=px0+TS*0.12*bigN;
        var barY=py0-TS*0.02-lift;
        ctx.fillStyle='rgba(0,0,0,.7)'; ctx.fillRect(barX,barY,barW,3);
        ctx.fillStyle = e.ally ? '#7FD08A' : e.hp/e.maxhp>0.5 ? '#C7B04F' : '#C7503F';
        ctx.fillRect(barX,barY,barW*clamp(e.hp/e.maxhp,0,1),3);
      }
      var ix=px0+TS*0.02;
      if(e.merchantRoom!==undefined&&!e.foe&&e.hp>0&&(revealAll||vis[idxOf(e.x,e.y)]))mark('?',px0+TS*.39,py0-TS*.16,'#FFD24A');
      if(e.surprised && e.foe) { mark('!',px0+TS*0.78,py0+TS*0.02,'#FFD24A'); }
      if(e.state==='asleep') { mark('z',px0+TS*0.78,py0+TS*0.08+(ANIM.reduce?0:Math.sin(now/400+e.id)*2),'#CFE0FF'); }
      if(e.keyholder){ if(spriteOn)drawObj(objArt('items','item-key-iron'), px0+TS*0.52, py0-TS*0.34, {fit:0.4, loot:true});else mark('k',px0+TS*.8,py0-TS*.2,'#E8B44A'); }
      /* 2026-09-20: Justin - "we need some art for conditions and not just a black placeholder symbol". The icons
         were drawn straight onto the scene, so a dark one over a dark creature read as a black box. Each sits on a
         small chip of its own colour now, with a dark rim, so it reads against anything. */
      (typeof statusList==='function'?statusList(e):[]).forEach(function(status){
        var k=status.k;
        var col=STATUS_CHIP[k]||'#C8C0B4', cx=ix+TS*0.1, cy=py0-TS*0.3+TS*0.15, rr=TS*0.115;
        ctx.save();
        ctx.fillStyle='rgba(10,8,6,0.85)'; ctx.beginPath(); ctx.arc(cx, cy, rr*1.25, 0, 7); ctx.fill();
        ctx.fillStyle=col; ctx.beginPath(); ctx.arc(cx, cy, rr, 0, 7); ctx.fill();
        ctx.restore();
        if(!spriteOn||!drawObj(objArt('icons',status.icon||'st-'+k), cx-TS/2, cy-TS/2, {fit:0.26})){
          ctx.save();
          ctx.fillStyle='#120F0D'; ctx.font='600 '+Math.max(7,Math.round(TS*0.2))+'px "IBM Plex Mono",monospace';
          ctx.textAlign='center'; ctx.textBaseline='middle';
          ctx.fillText(k.charAt(0).toUpperCase(),cx,cy);
          ctx.restore();
        }
        ix+=TS*0.24;
      });
    });
  });
    });
  standing(prp.y+1,drawPlayer);
  upright.sort(function(a,b){return a.row-b.row || a.order-b.order;}).forEach(function(c){c.paint();});

  /* tall grass sits on top: its front blades are drawn over everything standing on the tile */
  for(y=camY;y<=camY+viewH;y++) for(x=camX;x<=camX+viewW;x++){
    if(x<0||y<0||x>=W||y>=H) continue; var fgi=y*W+x; if(GRD[fgi]!==G_GRASS || !(ALL||SEEN[fgi])) continue;
    if(spriteOn)drawGrassTile(x, y, (x-camX)*TS, (y-camY)*TS, (ALL||VIS[fgi])?1:fade40, 'front', now);
  }

  if(lightingOn()) drawLightmap(now, prp);
  drawLights();
  if(typeof FoteChaosCurrentRenderer!=='undefined')FoteChaosCurrentRenderer.drawAll(now);
  objGlintsFlush();

  drawMapBeacons(now);

  drawFX();
  ctx.restore(); TILE_FRAME=null;

  /* screen-space: vignette */
  var vg=ctx.createRadialGradient(viewW*TS/2, viewH*TS/2, Math.min(viewW,viewH)*TS*0.35, viewW*TS/2, viewH*TS/2, Math.max(viewW,viewH)*TS*0.7);
  vg.addColorStop(0,'rgba(0,0,0,0)'); vg.addColorStop(1,'rgba(0,0,0,0.45)');
  ctx.fillStyle=vg; ctx.fillRect(0,0,viewW*TS,viewH*TS);
  // Aim marks remain legible above the lighting and vignette.
  ctx.save();ctx.translate(-camOX,-camOY);
  drawTargetingCues();
  ctx.restore();
  drawStairsPointer(now);
  // Lighting, particles and ground effects cannot color the empty world margins.
  drawMapMargins();
}
/* 2026-10-05 (slice 1c): the hero's art has two sides. A move, blow or shot with no left or right part names neither
   (game.js faceOf gives north or south), and the hero snapped to face right on every straight step up or down. He keeps
   the side he last had, remembered here at draw time and never saved. (It sits with drawScene, its one caller,
   so the tests that cut drawScene out of this file by its text take it along.) */
var FACE_SIDE=new WeakMap();
function heroFlip(e){
  if(e.face==='west' || e.face==='east') FACE_SIDE.set(e, e.face==='west');
  return !!FACE_SIDE.get(e);
}

/* Compact summoned elemental; all movement respects reduced-motion settings. */
function drawLivingFlame(e,px,py,opts){
  if(!spriteOn)return false;
  opts=opts||{};
  var img=atl('living-flame.webp');if(!img||!img.complete||!img.naturalWidth)return false;
  var t=ANIM.reduce?0:performance.now()/1000,phase=(e.id||0)*1.37;
  var pulse=ANIM.reduce?1:1+.025*Math.sin(t*4+phase);
  var height=TS*.82*pulse,width=height*img.naturalWidth/img.naturalHeight;
  var bob=ANIM.reduce?0:TS*.025*Math.sin(t*3+phase),charged=(e.flameShots||0)%3===2;
  ctx.save();ctx.globalAlpha=opts.alpha===undefined?1:opts.alpha;
  ctx.translate(px+TS/2,py+TS*.88-bob);
  if(opts.flip)ctx.scale(-1,1);
  var glow=ctx.createRadialGradient(0,-height*.45,0,0,-height*.45,height*.65);
  glow.addColorStop(0,charged?'rgba(255,205,85,.30)':'rgba(255,110,25,.13)');glow.addColorStop(1,'rgba(255,70,15,0)');
  ctx.fillStyle=glow;ctx.fillRect(-height*.7,-height*1.1,height*1.4,height*1.4);
  ctx.imageSmoothingEnabled=true;ctx.drawImage(img,-width/2,-height,width,height);
  if(opts.flash>0){ctx.globalAlpha*=opts.flash;ctx.drawImage(whiteCut(img,0,0,img.naturalWidth,img.naturalHeight),-width/2,-height,width,height);}
  if(!ANIM.reduce){
    ctx.fillStyle=charged?'#FFF2AE':'#FFBA62';
    for(var i=0;i<4;i++){var life=(t*.7+i*.27+phase)%1;ctx.globalAlpha=(opts.alpha===undefined?1:opts.alpha)*(1-life)*.55;ctx.fillRect(Math.sin(i*2.3+phase+t)*width*.30,-height*(.15+life*.85),TS*.022,TS*.035);}
  }
  ctx.restore();return true;
}
/* Layered eye-free flames for burning ground and burning creatures. */
function drawBurningFlame(bx,by,height,now,seed,alpha){
  var t=ANIM.reduce?0:now/240+seed;
  var sway=ANIM.reduce?0:Math.sin(t)*1.3,stretch=ANIM.reduce?1:1+.07*Math.sin(t*1.7);
  ctx.save();ctx.translate(bx,by);ctx.scale(height/23,height/23*stretch);
  ctx.globalAlpha=(alpha===undefined?.6:alpha)*(ANIM.reduce?1:.92+.08*Math.sin(t*.8));
  function layer(color,scale){
    ctx.save();ctx.scale(scale,scale);ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(-7,0);ctx.lineTo(-9,-6);ctx.lineTo(-6+sway*.3,-12);ctx.lineTo(-5,-8);ctx.lineTo(-2+sway,-21);ctx.lineTo(2,-14);ctx.lineTo(5-sway*.6,-18);ctx.lineTo(5,-9);ctx.lineTo(8,-12);ctx.lineTo(9,-5);ctx.lineTo(6,0);ctx.closePath();ctx.fill();ctx.restore();
  }
  layer('#CC421C',1);layer('#FF9B32',.78);layer('#FFE49B',.48);ctx.restore();
}
