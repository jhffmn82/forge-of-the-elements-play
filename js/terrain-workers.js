/* terrain-workers.js - natural terrain cells built in parallel (2026-09-28).
 * The Caverns, the elemental planes, the Chaos rock islands and the Underdark's caves draw each cell from a small
 * raster (planeterrain.js ptCellRaster, deeprender.js deepCellRaster) upgraded to 128px (environment-terrain.js
 * enhanceKernel): pure arithmetic on the floor's map. A small pool of Web Workers runs those same functions, their
 * source text taken from this page at start-up, so a worker's pixels are the page's pixels. The page keeps what
 * needs a canvas or is cheaper at home: crystal cells (canvas paths), shared deep-rock cells, masonry and overlays.
 * Without Worker support, or after any worker error, the page builds every cell itself as before. */
(function(root){
 'use strict';
 if(root.FoteTerrainWorkers)return;
 var KINDS=['plane','deep','rock'];
 var ET=null,pool=null,failed=false,sentFloor=null,deepSent=false,urgent=[],later=[],inflight=new Map(),waiting=[],stats={sent:0,installed:0,empty:0,dropped:0,failed:0,workerMs:0};
 function phone(){return document.body.classList.contains('touch');}
 function supported(){return typeof Worker==='function'&&typeof Blob==='function'&&typeof URL!=='undefined'&&typeof URL.createObjectURL==='function'&&typeof ImageData==='function';}
 function size(){
  var n=root.FOTE_TERRAIN_WORKERS;if(typeof n==='number'&&n>=0)return n|0;
  // Each worker costs 20-25 MB of memory; with the page helping, more than four barely helped on a desktop
  // (2026-09-28), and a phone keeps two.
  var cores=navigator.hardwareConcurrency||4;return Math.max(1,Math.min(cores-1,phone()?2:4));
 }
 function deepFloor(){return typeof inDeep==='function'&&inDeep()&&!!floorMeta&&!!floorMeta.deepRegion;}
 // Underdark cells read a cave floor master (4 MB): each worker holds a copy on the Underdark's floors only.
 function deepWorkers(){return 64;}
 /* ---- the worker: page functions by their source text, and a stand-in for the page state they read */
 function workerMain(){
  var TEX={},DEEPMAT=null,DIST=null,SLOW=1,MATS=[],MAT_INDEX=null,MAT_ALL=-1,ROT=null;
  var textures={get:function(key){return TEX[key]||DEEPMAT&&DEEPMAT[key]||null;},fire:function(x,y){return ptGroundRaster(x,y,'fire');}};
  self.onmessage=function(e){
   var m=e.data;
   try{
    if(m.type==='init'){TEX=m.textures;PT_MAT=m.PT_MAT;PT_POOL_FX=m.PT_POOL_FX;DEEP_ROCK=m.DEEP_ROCK;SLOW=m.slow||1;warmUp();return;}
    if(m.type==='deepTextures'){DEEPMAT=m.textures;return;}
    if(m.type==='floor'){
     map=m.map;MW=m.W;MH=m.H;ground=m.ground;floorMeta=m.meta;floorNo=m.floorNo;worldSeed=m.worldSeed;CAVERNS=m.caverns;DIST=m.dist;
     MATS=m.mats.map(function(v){return typeof v==='string'?PT_MAT[v]:v;});MAT_INDEX=m.matIndex;MAT_ALL=m.matAll;ROT=m.rot;
     DC=m.deep?{lock:m.deep.lock,rmix:m.deep.rmix,tex:m.deep.tex}:{lock:null,rmix:null,tex:{}};
     return;
    }
    if(m.type==='cells'){
     var sent=[];
     for(var i=0;i<m.list.length;i+=3){
      var x=m.list[i],y=m.list[i+1],kind=m.list[i+2],t0=performance.now(),out=null,none=false,info=null,n=0,mode=kind===0?'plane':'deep';
      if(kind===2){info=rockTopInfo(deepCellReg(x,y));n=1;}
      else{var c=kind===0?ptCellRaster(x,y):deepCellRaster(x,y);if(!c)none=true;else{info=c.environmentTerrain;n=c.width;}}
      // a cave cell that reaches a built region draws its masonry masters, which only the page holds
      if(info&&kind===1&&builtRegion(info.regions))info=null;
      if(info){var o=kernelInputs(info.pixels,info,n,x,y,mode,textures);if(o){o.dst=new Uint8ClampedArray(S*S*4);enhanceKernel(o);out=o.dst;}}
      if(SLOW>1){var until=performance.now()+(performance.now()-t0)*(SLOW-1);while(performance.now()<until){}}
      sent.push(deliver(m.keys[i/3],out,none,performance.now()-t0));
     }
     Promise.all(sent).then(function(){self.postMessage({type:'batch'});});
    }
   }catch(error){self.postMessage({type:'error',message:String(error&&error.stack||error)});}
  };
  // Before the first floor: a few cells of a made-up cave, so the first real floor runs compiled code, not cold
  // code. Nothing is kept; the floor state is cleared again.
  function warmUp(){
   var W=24,H=16,room=new Uint8Array(W*H).fill(WALL),dist=new Uint8Array(W*H).fill(255),q=[];
   for(var y=4;y<12;y++)for(var x=4;x<20;x++)if(!(x>10&&x<14&&y<7))room[y*W+x]=FLOOR;
   for(var i=0;i<room.length;i++)if(room[i]!==WALL){dist[i]=0;q.push(i);}
   for(var h=0;h<q.length;h++){var c=q[h],cx=c%W,cy=(c/W)|0;for(var oy=-1;oy<=1;oy++)for(var ox=-1;ox<=1;ox++){var nx=cx+ox,ny=cy+oy;if(nx<0||ny<0||nx>=W||ny>=H)continue;var k=ny*W+nx;if(dist[k]>dist[c]+1){dist[k]=dist[c]+1;q.push(k);}}}
   map=room;MW=W;MH=H;ground=new Uint8Array(W*H);floorMeta={};floorNo=11;worldSeed=1;CAVERNS=true;DIST=dist;MATS=[];MAT_INDEX=null;MAT_ALL=-1;ROT=null;
   try{for(var n=0;n<14;n++){var wx=3+(n*5)%18,wy=3+(n*3)%10,c2=ptCellRaster(wx,wy);if(!c2)continue;var inf=c2.environmentTerrain,o=kernelInputs(inf.pixels,inf,c2.width,wx,wy,'plane',textures);if(o){o.dst=new Uint8ClampedArray(S*S*4);enhanceKernel(o);}}}
   catch(e){}
   map=null;MW=MH=0;ground=null;floorMeta=null;CAVERNS=false;DIST=null;
  }
  // A cell goes back as its pixels (transferred, not copied); the page puts them on a canvas like enhance() does.
  // (An ImageBitmap costs the page less, but kept GPU copies alive: 250 MB more on a phone.)
  function deliver(key,out,none,ms){
   if(!out)self.postMessage({type:'cell',key:key,none:none,ms:ms});
   else self.postMessage({type:'cell',key:key,pixels:out,ms:ms},[out.buffer]);
   return null;
  }
  function builtRegion(regions){for(var i=0;i<regions.length;i++)if(DEEP_STYLE[regions[i]]==='rect')return true;return false;}
  FoteChaosPreviewRenderer={
   terrainMaterial:function(x,y){
    if(!MAT_INDEX||x===undefined)return MAT_ALL>=0?MATS[MAT_ALL]:null;
    if(!(x>=0&&y>=0&&x<MW&&y<MH))return null;var k=MAT_INDEX[Math.floor(y)*MW+Math.floor(x)];return k>=0?MATS[k]:null;
   },
   themeAt:function(x,y){return ROT&&x>=0&&y>=0&&x<MW&&y<MH&&ROT[Math.floor(y)*MW+Math.floor(x)]?'rot-hollows':null;}
  };
  ptDist=function(){return DIST;};
  // A deep raster reads its old surface textures only where the 128px cell then draws a new master (floors, built
  // faces and tops) or fire, so their pixels never reach the screen: a worker gets their sizes, not 19 MB of pixels.
  var EMPTY=new Uint8ClampedArray(4);
  deepTex=function(reg,name){var t=DC.tex[reg]&&DC.tex[reg][name];return t?{w:t.w,h:t.h,d:EMPTY}:null;};
 }
 function source(){
  var page=[hash2,inb,idxOf,at,isWallLike,ptWallCell,ptVal,ptVor,ptFieldTables,ptSub,ptSolid,ptJag,ptKind,ptMix,ptFloorColor,ptGroundRaster,ptCellRaster,
   ptMossField,ptPoolField,ptFieldContext,ptPoolFx,ptMat,ptSalt,surfSalt,surfOff,ptCrystalAt,
   deepRegionAt,deepCellReg,deepContext,deepWallCell,deepPixReg,deepSolid,deepMix,deepRockCol,deepTexel,deepPresent,deepCellRaster];
  return [
   'var map=null,MW=0,MH=0,ground=null,floorMeta=null,floorNo=0,worldSeed=0,CAVERNS=false,DEEP_RC=false,PT_MAT=null,PT_POOL_FX=null,DEEP_ROCK=null,DC=null,FoteChaosPreviewRenderer=null;',
   'var WALL='+WALL+',FLOOR='+FLOOR+',SECRET='+SECRET+',G_MOSS='+G_MOSS+',G_GRASS='+G_GRASS+',PT_R='+PT_R+',SURF_P='+SURF_P+',DEEP_RF='+DEEP_RF+';',
   'var DEEP_REGIONS='+JSON.stringify(DEEP_REGIONS)+',DEEP_STYLE='+JSON.stringify(DEEP_STYLE)+';',
   'var PT_VAL_MEMO=new Float64Array('+PT_VAL_MEMO.length+').fill(NaN),PT_VOR_MEMO=new Float64Array('+PT_VOR_MEMO.length+').fill(NaN),PT_FIELD=null;',
   'function inCaverns(){return CAVERNS;}',
   'function roomAt(){return null;}',
   'function ptDist(){return null;}',
   'function deepTex(){return null;}',
   'function deepCache(){return DC;}',
   'function ptCrystal(){throw Error("crystal cells are drawn on the page");}',
   // the rasters' canvas: pixels in, the same pixels out (a crystal cell never reaches a worker)
   'function FakeCanvas(){this.width=0;this.height=0;this._im=null;}',
   'FakeCanvas.prototype.getContext=function(){var c=this;return {canvas:c,createImageData:function(w,h){return {data:new Uint8ClampedArray(w*h*4),width:w,height:h};},putImageData:function(im){c._im=im;},getImageData:function(){return {data:new Uint8ClampedArray(c._im.data)};}};};',
   'var document={createElement:function(){return new FakeCanvas();}};',
   page.map(String).join('\n'),
   ET.kernelSource(),
   String(workerMain),'workerMain();'
  ].join('\n');
 }
 function fail(reason){
  if(failed)return;failed=true;stats.failed++;
  if(root.console)console.warn('Terrain workers stopped; the page builds terrain itself.',reason);
  if(pool)pool.forEach(function(w){try{w.worker.terminate();}catch(e){}});pool=[];
  urgent=[];later=[];inflight.clear();settle();
 }
 function start(){
  if(pool||failed)return !!pool;
  if(!supported()||size()<1||typeof FoteEnvironmentTerrain==='undefined'||!FoteEnvironmentTerrain.kernelSource){failed=true;return false;}
  ET=FoteEnvironmentTerrain;   // the provider whose kernels the workers run, and the only one they install into
  var textures=ET.workerTextures();if(!textures['stone-detail']||!textures['fluid-detail']||!textures['cave-rock'])return false;
  try{
   var url=URL.createObjectURL(new Blob([source()],{type:'text/javascript'}));pool=[];
   for(var i=0;i<size();i++){
    var w={worker:new Worker(url),busy:0,id:i};
    w.worker.onmessage=message.bind(null,w);w.worker.onerror=function(e){fail(e&&e.message||'worker error');};
    w.worker.postMessage({type:'init',textures:textures,PT_MAT:PT_MAT,PT_POOL_FX:PT_POOL_FX,DEEP_ROCK:DEEP_ROCK,slow:Number(root.FOTE_TERRAIN_WORKER_SLOWDOWN)||1});
    pool.push(w);
   }
  }catch(error){fail(error);return false;}
  return true;
 }
 function post(message,transfer){pool.forEach(function(w){w.worker.postMessage(message,transfer||[]);});}
 /* ---- the floor as the workers see it: sent when it changes (a new floor, a door, trampled grass) */
 function cacheNow(){return deepFloor()?deepCache().cells:ptCache();}
 function floorState(){
  var deep=deepFloor(),cells=cacheNow(),s=sentFloor;
  if(s&&s.cells===cells&&s.meta===floorMeta&&s.mapRef===map&&same(s.map,map)&&same(s.ground,ground))return s;
  if(deep&&!deepSent){var dt=ET.workerDeepTextures();pool.forEach(function(w,i){if(i<deepWorkers())w.worker.postMessage({type:'deepTextures',textures:dt});});deepSent=true;}
  if(!deep&&deepSent){pool.forEach(function(w,i){if(i<deepWorkers())w.worker.postMessage({type:'deepTextures',textures:null});});deepSent=false;}   // the Underdark's masters leave with it
  var preview=typeof FoteChaosPreviewRenderer!=='undefined'&&FoteChaosPreviewRenderer.active&&FoteChaosPreviewRenderer.active();
  var mats=[],matIndex=null,matAll=-1,rot=null,names={};Object.keys(PT_MAT).forEach(function(k){names[k]=PT_MAT[k];});
  function index(M){if(!M)return -1;var i=mats.indexOf(M);if(i<0){mats.push(M);i=mats.length-1;}return i;}
  if(preview){
   matIndex=new Int8Array(MW*MH);rot=new Uint8Array(MW*MH);
   for(var y=0;y<MH;y++)for(var x=0;x<MW;x++){var i=y*MW+x;matIndex[i]=index(FoteChaosPreviewRenderer.terrainMaterial(x,y));rot[i]=FoteChaosPreviewRenderer.themeAt(x,y)==='rot-hollows'?1:0;}
   matAll=index(FoteChaosPreviewRenderer.terrainMaterial());
  }
  var sendMats=mats.map(function(M){for(var k in names)if(names[k]===M)return k;return M;});
  var meta=floorMeta,cp=meta.chaosPreview,deepData=null;
  if(deep){
   var C=deepCache(),tex={};
   function size(t){return t?{w:t.w,h:t.h}:null;}
   for(var r=0;r<DEEP_REGIONS.length;r++)tex[r]={floor:size(deepTex(r,'floor')),top:size(deepTex(r,'top')),face:size(deepTex(r,'face'))};
   deepData={lock:C.lock,rmix:C.rmix,tex:tex};
  }
  s=sentFloor={cells:cells,meta:floorMeta,mapRef:map,map:new Uint8Array(map),ground:ground?new Uint8Array(ground):null};
  post({type:'floor',map:s.map,W:MW,H:MH,ground:s.ground,dist:deep?null:ptDist(),floorNo:floorNo,worldSeed:worldSeed,caverns:inCaverns(),
   meta:{plane:meta.plane,ptPool:meta.ptPool,centerAt:meta.centerAt,ptSuns:meta.ptSuns,deepRegion:meta.deepRegion,chaosPreview:cp?{biome:cp.biome,mossMask:cp.mossMask}:undefined},
   mats:sendMats,matIndex:matIndex,matAll:matAll,rot:rot,deep:deepData});
  return s;
 }
 function same(a,b){if(!a||!b)return a===b;if(a.length!==b.length)return false;for(var i=0;i<a.length;i++)if(a[i]!==b[i])return false;return true;}
 /* ---- which cells go to a worker, as [kind, cache key]: cells not built yet whose input is pure arithmetic */
 function job(x,y,cells){
  if(x<0||y<0||x>=MW||y>=MH)return null;var t=at(x,y);if(t===CHASM)return null;
  if(deepFloor()){
   var sig=deepSig(x,y);
   if(deepNeedsRaster(x,y,sig)){var dk=x+','+y+':'+sig;return dk in cells||inflight.has('d'+dk)||nearBuilt(x,y)?null:[1,dk];}
   if(isWallLike(t)&&DEEP_STYLE[deepCellReg(x,y)]!=='rect')return ET.rockTopReady(x,y)||inflight.has('r'+x+','+y)?null:[2,x+','+y];
   return null;   // masonry and volcanic ground: the page
  }
  var k=x+','+y;if(k in cells||inflight.has('p'+k))return null;
  var M=ptMat(x,y);if(!M)return null;
  var shared=ptVoidTile(x,y);if(shared){cells[k]=shared;return null;}
  return ptCrystalAt(x,y,M,ptSalt())?null:[0,k];
 }
 // A cave cell's raster samples regions up to two cells away (deeprender.js deepPixReg) over the cell and the rows
 // below it: one near a built (temple) region needs that region's masonry masters, so the page builds it.
 function nearBuilt(x,y){
  var R=floorMeta.deepRegion;
  for(var yy=y-3;yy<=y+4;yy++)for(var xx=x-3;xx<=x+3;xx++){if(xx<0||yy<0||xx>=MW||yy>=MH)continue;if(DEEP_STYLE[R[yy*MW+xx]]==='rect')return true;}
  return false;
 }
 function request(list,now){
  var taken=new Set();
  if(failed||!list.length)return {taken:taken,done:Promise.resolve()};
  if(!pool&&!start()||FoteEnvironmentTerrain!==ET)return {taken:taken,done:Promise.resolve()};
  var cells=cacheNow(),queue=[];
  list.forEach(function(c){var j=job(c[0],c[1],cells);if(j){queue.push({x:c[0],y:c[1],kind:j[0],key:'pdr'[j[0]]+j[1],slot:j[1],urgent:!!now});taken.add(c[0]+','+c[1]);}});
  if(!now){later=queue;later.cells=cells;later.map=map;}
  else urgent.push({list:queue,cells:cells,map:map});
  // an urgent request resolves once each of its cells is in the cache or given up
  var done=now&&queue.length?new Promise(function(resolve){waiting.push({keys:queue.map(function(q){return q.key;}),resolve:resolve});}):Promise.resolve();
  if(queue.length){floorState();pump();}
  return {taken:taken,done:done};
 }
 // The next job still worth sending: urgent (a held view) first, then the ring ahead of the view.
 function nextJob(current,deepOk){
  if(!deepOk&&deepFloor())return null;
  while(urgent.length){var u=urgent[0];while(u.list.length){var q=u.list.shift();if(u.cells===current&&u.map===map&&!inflight.has(q.key)){q.cells=u.cells;q.map=u.map;return q;}}urgent.shift();}
  while(later.length){var q2=later.shift();if(later.cells===current&&later.map===map&&!inflight.has(q2.key)){q2.cells=later.cells;q2.map=later.map;return q2;}}
  return null;
 }
 // The page helps with a held view once its own share is done: it takes the queued job farthest from the view's
 // centre (the workers take the nearest), builds it itself, and the job leaves the queue.
 function steal(){
  var current=cacheNow();
  for(var i=urgent.length-1;i>=0;i--){var u=urgent[i];while(u.list.length){var q=u.list.pop();if(u.cells===current&&u.map===map&&!inflight.has(q.key)){settle();return q;}}}
  return null;
 }
 function pump(){
  if(failed||!pool)return;
  var current=cacheNow();
  pool.forEach(function(w,i){
   while(w.busy<2){
    var list=[],keys=[],max=3,q;
    while(keys.length<max&&(q=nextJob(current,i<deepWorkers()))){list.push(q.x,q.y,q.kind);keys.push(q.key);inflight.set(q.key,q);}
    if(!keys.length)break;
    w.busy++;stats.sent+=keys.length;w.worker.postMessage({type:'cells',list:list,keys:keys});
   }
  });
 }
 function message(w,e){
  var m=e.data;
  if(m.type==='error'){fail(m.message);return;}
  if(m.type==='batch'){w.busy--;pump();settle();return;}
  if(m.type!=='cell')return;
  var q=inflight.get(m.key);inflight.delete(m.key);
  var image=m.pixels;
  stats.workerMs+=m.ms||0;
  if(image&&q){
   // a held view's cells go in at once; the ring ahead goes in in idle time, or just before a frame that needs it
   if(q.urgent)place(q,image);else{ready.push({q:q,image:image});schedule();}
  }
  else{
   if(!image&&m.none&&q&&live(q)&&q.kind===0&&!(q.slot in q.cells))q.cells[q.slot]=null;
   if(!image)stats.empty++;
  }
  settle();
 }
 function live(q){return q.cells===cacheNow()&&q.map===map&&FoteEnvironmentTerrain===ET;}
 function place(q,image){
  if(live(q)&&(q.kind===2?!ET.rockTopReady(q.x,q.y):!(q.slot in q.cells))){
   ET.install(image,q.x,q.y,KINDS[q.kind],q.kind===2?null:q.cells,q.slot);stats.installed++;
  }
 }
 var ready=[],scheduled=false;
 function schedule(){
  if(scheduled)return;scheduled=true;
  var run=function(deadline){
   scheduled=false;var t0=performance.now(),budget=phone()?6:4;
   if(deadline&&typeof deadline.timeRemaining==='function'&&!deadline.didTimeout)budget=Math.max(2,Math.min(budget,deadline.timeRemaining()));
   while(ready.length&&performance.now()-t0<budget){var r=ready.shift();place(r.q,r.image);}
   if(ready.length)schedule();
  };
  if(typeof requestIdleCallback==='function')requestIdleCallback(run,{timeout:100});else setTimeout(run,16);
 }
 // Before a frame: the finished cells it may draw (the tile window and a cell around it) go in now.
 function flush(x0,y0,x1,y1){
  if(!ready.length)return;
  ready=ready.filter(function(r){var q=r.q;if(q.x>=x0&&q.x<=x1&&q.y>=y0&&q.y<=y1){place(q,r.image);return false;}return true;});
 }
 // A waiting request is done when none of its cells is still queued or in flight.
 function settle(){
  if(!waiting.length)return;
  var queued=new Set();urgent.forEach(function(u){u.list.forEach(function(q){queued.add(q.key);});});
  waiting=waiting.filter(function(wt){
   if(!failed&&wt.keys.some(function(k){return inflight.has(k)||queued.has(k);}))return true;
   wt.resolve();return false;
  });
 }
 root.FoteTerrainWorkers=Object.freeze({
  request:request,flush:flush,steal:steal,
  // start early, once the terrain masters are in (the loading screen loads them), so the first floor pays nothing
  warm:function(){if(!pool&&!failed)start();return !!pool;},
  info:function(){return {workers:pool?pool.length:0,failed:failed,supported:supported(),size:size(),stats:Object.assign({},stats)};}
 });
 if(typeof FoteLifecycle!=='undefined')FoteLifecycle.whenReady(function(){
  if(typeof FoteEnvironmentTerrain==='undefined')return;
  FoteEnvironmentTerrain.ensureAssets('all').then(function(){setTimeout(function(){root.FoteTerrainWorkers.warm();},0);},function(){});
 });
})(globalThis);
