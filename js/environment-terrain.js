/* High-density environment materials. Geometry, world RNG and turn state are
 * owned by the existing terrain generators; this module only caches pixels. */
(function(root){
 'use strict';
 if(root.FoteEnvironmentTerrain)return;
 var manifest=null,manifestPending=null,images=new Map(),loading=new Map(),high=new Map(),cacheMap=null,cacheMeta=null;
 var S=128,builds=0,frameBuilt=0,frameDeadline=0,peakBuildMs=0,frameMs=0,peakFrameMs=0,fireGround=new Map(),rockTops=new Map();
 var elementalPlanes=['light','shadow','earth','fire','water','air'];
 var oldFloor=masonryFloorTile,oldWall=masonryWallTile,oldTile=wallTile,oldFrame=drawFramePasses,oldRaster=cachedRaster;
 function phone(){return document.body.classList.contains('touch');}
 function wrap(v,n){return ((v%n)+n)%n;}
 function canvas(w,h,id){var c=document.createElement('canvas');c.width=w;c.height=h;c.src='environment-terrain:'+id;return c;}
 function redraw(){if(typeof map!=='undefined'&&map&&typeof vis!=='undefined'&&vis&&vis.length===map.length&&typeof requestTerrainRedraw==='function')requestTerrainRedraw();}
 function theme(x,y){
  var chaos=typeof FoteChaosPreviewRenderer!=='undefined'?FoteChaosPreviewRenderer.themeAt(x,y):null;
  if(chaos)return {'prism-archives':'prism','cinder-bastion':'cinder','rot-hollows':'rot','violet-warrens':'violet'}[chaos]||'cinder';
  if(floorMeta&&floorMeta.plane)return floorMeta.plane;
  if(typeof inDeep==='function'&&inDeep()&&floorMeta.deepRegion)return DEEP_REGIONS[deepCellReg(x,y)];
  return typeof bidx==='function'&&bidx()===1?'crypt':'dungeon';
 }
 function fetchManifest(){
  if(manifest)return Promise.resolve(manifest);
  if(!manifestPending)manifestPending=fetch('art/packed/environment-terrain-atlas.json',{cache:'no-cache'}).then(function(r){if(!r.ok)throw Error('Environment terrain metadata failed to load.');return r.json();}).then(function(data){manifest=data;return data;}).catch(function(error){manifestPending=null;throw error;});
  return manifestPending;
 }
 function load(key){
  if(images.has(key))return Promise.resolve(images.get(key));
  if(loading.has(key))return loading.get(key);
  var promise=fetchManifest().then(function(){var spec=manifest.assets[key];if(!spec)return null;
   return new Promise(function(resolve,reject){var img=new Image();img.onload=function(){
    if(img.naturalWidth!==spec.width||img.naturalHeight!==spec.height)return reject(Error('Invalid terrain image dimensions: '+key));
    var entry={img:img,spec:spec,pixels:null,shaded:null};
    if(spec.dim){
     // Shade once in source space: translucent per-tile rectangles leave
     // bright hairlines where a camera/zoom puts their edges between pixels.
     // Keep img/pixels untouched for material mixing and source inspection.
     var shaded=canvas(img.naturalWidth,img.naturalHeight,'shaded-'+key),paint=shaded.getContext('2d');
     paint.drawImage(img,0,0);paint.globalCompositeOperation='source-atop';paint.globalAlpha=spec.dim;paint.fillStyle='#000';paint.fillRect(0,0,shaded.width,shaded.height);
     entry.shaded=shaded;
    }
    // Read master pixels once while preparing assets, never once per painted
    // tile. Repeated drawImage/readback of a large atlas stalls the GPU.
    if(key==='cave-rock'||/-detail$/.test(key)||/^(temple|underdark|volcanic)-(floor|face|top)$/.test(key))bytes(entry);
    images.set(key,entry);resolve(entry);redraw();
   };img.onerror=function(){reject(Error('Could not load terrain material '+key));};img.src='art/packed/'+spec.file;});
  }).finally(function(){loading.delete(key);});loading.set(key,promise);return promise;
 }
 function get(key){if(images.has(key))return images.get(key);if(manifest&&!manifest.assets[key])return null;load(key).catch(function(){});return null;}
 function ensureAssets(themes){
  return fetchManifest().then(function(){
   if(!themes){themes=['dungeon'];if(typeof floorMeta!=='undefined'&&floorMeta){
    if(floorMeta.deepRegion)themes=DEEP_REGIONS.slice();
    else if(floorMeta.chaosPreview)themes=['prism','cinder'];
    else if(typeof player!=='undefined'&&player)themes=[theme(player.x,player.y)];
   }}
   var keys=['stone-detail','fluid-detail'];if(typeof inCaverns==='function'&&inCaverns()||themes.indexOf('underdark')>=0||themes.indexOf('volcanic')>=0||themes.some(function(t){return elementalPlanes.indexOf(t)>=0;}))keys.push('cave-rock');if(typeof floorMeta!=='undefined'&&floorMeta&&floorMeta.lava)keys.push('lava-flow');themes.forEach(function(t){['floor','face','top','rim-n','rim-v'].forEach(function(n){var k=t+'-'+n;if(manifest.assets[k])keys.push(k);});});
   return Promise.all(keys.map(load)).then(function(){return root.FoteEnvironmentTerrain;});
  });
 }
 function sample(name,x,y,t){
  var entry=get((t||theme(x,y))+'-'+name);if(!entry)return null;
  var spec=entry.spec,w=entry.img.naturalWidth/spec.columns,h=entry.img.naturalHeight/spec.rows;
  return {img:entry.shaded||entry.img,sx:wrap(x,spec.columns)*w,sy:wrap(y,spec.rows)*h,sw:w,sh:h,deepDim:entry.shaded?0:spec.dim||0};
 }
 function rim(name,index,x,y){return sample(name,name==='rim-n'?index:0,name==='rim-v'?index:0,theme(x,y));}
 function masonrySample(name,x,y){var t=theme(x,y),deep=t==='temple'||t==='underdark'||t==='volcanic';
  if(t==='volcanic'&&name==='floor'){
   var img=enhance(fireGroundCell(x,y),x,y,'plane');
   return {img:img,sx:0,sy:0,sw:img.width,sh:img.height};
  }
  var ox=deep?surfOff(name==='floor'?0:name==='face'?2:3):0,oy=deep?surfOff(name==='floor'?1:4):0;
  return sample(name,x+ox,name==='face'?0:y+oy,t);
 }
 masonryFloorTile=function(x,y){
  var tile=at(x,y),name=(tile===OPEN||isDoorTile(tile))&&!sideDoor(x,y)?'face':'floor';
  return masonrySample(name,x,y)||oldFloor.apply(this,arguments);
 };
 masonryWallTile=function(x,y){var name=wallFaces(x,y)?'face':'top';return masonrySample(name,x,y)||oldWall.apply(this,arguments);};
 wallTile=function(x,y){var art=oldTile.apply(this,arguments);
  if(inDeep()&&floorMeta.deepRegion&&!DEEP_RC&&DEEP_STYLE[deepCellReg(x,y)]!=='rect'){
   var rock=naturalRockTop(x,y);if(rock)return {img:rock,sx:0,sy:0,sw:rock.width,sh:rock.height,deepDim:wallFaces(x,y)?.5:1-DEEP_TOP_DIM};
   var top=masonrySample('top',x,y);if(top){top.deepDim=wallFaces(x,y)?.5:1-DEEP_TOP_DIM;return top;}
  }return art;
 };
 function bytes(entry){
  if(!entry.pixels){var c=canvas(entry.img.naturalWidth,entry.img.naturalHeight,'read-'+entry.spec.file),g=c.getContext('2d',{willReadFrequently:true});g.drawImage(entry.img,0,0);entry.pixels=g.getImageData(0,0,c.width,c.height).data;}
  return entry.pixels;
 }
 function fireGroundCell(x,y){
  var key=x+','+y;if(fireGround.has(key))return fireGround.get(key);
  var cell=ptGroundRaster(x,y,'fire');fireGround.set(key,cell);
  while(fireGround.size>(phone()?192:384))fireGround.delete(fireGround.keys().next().value);
  return cell;
 }
 function naturalRockTop(x,y){
  var region=deepCellReg(x,y),key=x+','+y+':'+region,base=rockTops.get(key);
  if(!base){
   base=canvas(1,1,'rock-top-'+key);var rgba=new Uint8ClampedArray(DEEP_ROCK[region].top.concat(255));
   base.environmentTerrain={mask:new Uint8Array([2]),regions:new Uint8Array([region]),wallDepth:new Float32Array([-1]),pixels:rgba};
   rockTops.set(key,base);while(rockTops.size>(phone()?192:384))rockTops.delete(rockTops.keys().next().value);
  }
  var image=enhance(base,x,y,'deep');return image.width===S?image:null;
 }
 var axes={};
 function axis(n){if(axes[n])return axes[n];var a={nearest:[],lo:[],hi:[],fraction:[]};for(var i=0;i<S;i++){var p=(i+.5)*n/S-.5,lo=Math.max(0,Math.floor(p));a.nearest.push(Math.min(n-1,Math.floor(i*n/S)));a.lo.push(lo);a.hi.push(Math.min(n-1,Math.floor(p)+1));a.fraction.push(Math.max(0,p-lo));}return axes[n]=a;}
 function mirror(v,n){v=wrap(v,n*2);return v<n?v:n*2-1-v;}
 function planeMinerals(source,mask,palette){
  // Project chroma toward this plane's mineral color. Subtract the strongest
  // native rock chroma, so violet Shadow stone is not mistaken for a vein.
  // Bright hot cores also survive; this is computed once per cached32px mask.
  var mean=(palette.vein[0]+palette.vein[1]+palette.vein[2])/3;
  var axis=palette.vein.map(function(c){return c-mean;});
  function projection(c){return c[0]*axis[0]+c[1]*axis[1]+c[2]*axis[2];}
  var rocks=['topLo','topHi','topLav','face','faceLo','lip','edge'].map(function(k){return palette[k];});
  var edge=Math.max.apply(null,rocks.map(projection)),span=Math.max(1,projection(palette.vein)-edge);
  var peak=Math.max.apply(null,rocks.map(function(c){return Math.max.apply(null,c);})),hotRange=Math.max.apply(null,palette.veinHot)-peak;
  // Light/Air stone already reaches almost white. A clipped grain highlight
  // is not a hot mineral core; their gold tint must identify the accent.
  if(hotRange<12)span=Math.max(1,Math.min(span,projection(palette.veinHot)-edge));
  var result=new Float32Array(mask.length);
  for(var i=0;i<mask.length;i++)if(mask[i]===1){
   var p=i*4,r=source[p],g=source[p+1],b=source[p+2];
   var color=(r*axis[0]+g*axis[1]+b*axis[2]-edge)/span;
   var hot=hotRange>=12?(Math.max(r,g,b)-peak)/hotRange:0;
   result[i]=Math.max(0,Math.min(1,Math.max(color,hot)));
  }
  return result;
 }
 function enhance(base,x,y,mode){
  if(!base)return base;
  if(base.environmentTerrain&&base.environmentTerrain.nativeDetail)return base;
  if(high.has(base)){var cached=high.get(base);high.delete(base);high.set(base,cached);return cached;}
  var translucent=mode==='fluid'||mode==='chasm'||mode==='lava-crust'||mode==='vegetation',detail=get(mode==='fluid'?'fluid-detail':'stone-detail');if(!detail)return base;
  var started=performance.now();if(frameBuilt>=(phone()?3:5)||started>=frameDeadline){redraw();return base;}
  var n=base.width,info=base.environmentTerrain||{},source=info.pixels||base.getContext('2d',{willReadFrequently:true}).getImageData(0,0,n,n).data;
  var mask=info.mask,regions=info.regions,shade=info.shade,faceY=info.faceY,ax=axis(n),fluid=mode==='plane'?get('fluid-detail'):null;
  var plane=mode==='plane'&&floorMeta&&elementalPlanes.indexOf(floorMeta.plane)>=0?PT_MAT[floorMeta.plane]:null;
  if(plane&&ptMat(x,y)!==plane)plane=null;
  var rock=info.naturalWalls||plane||mode==='deep'?get('cave-rock'):null,rockPixels=rock&&bytes(rock),wallDepth=info.wallDepth;
  if((info.naturalWalls||plane||mode==='deep')&&!rock)return base;
  if(mode==='plane'&&!fluid)return base;
  var minerals=plane&&mask?planeMinerals(source,mask,plane):null;
  var material=null;if(mode==='deep'){
   material=DEEP_REGIONS.map(function(t){return {floor:get(t+'-floor'),face:get(t+'-face'),top:get(t+'-top')};});
   if(material.some(function(t){return !t.floor||!t.face||!t.top;}))return base;
  }
  var out=canvas(S,S,mode+'-'+x+'-'+y),g=out.getContext('2d'),image=g.createImageData(S,S),dst=image.data,d=bytes(detail),dw=detail.img.naturalWidth,dh=detail.img.naturalHeight,fd=fluid?bytes(fluid):null;
  var offsets=mode==='deep'?[surfOff(0),surfOff(1),surfOff(2),surfOff(3),surfOff(4)]:null;
  var fire=mode==='deep'&&regions&&regions.indexOf(2)>=0?fireGroundCell(x,y):null;
  var firePixels=fire&&fire.environmentTerrain.pixels,fireAxis=fire&&axis(fire.width);
  for(var v=0;v<S;v++)for(var u=0;u<S;u++){
   var nearestX=ax.nearest[u],nearestY=ax.nearest[v],cell=nearestY*n+nearestX,p=(v*S+u)*4,sp=cell*4,kind=mask?mask[cell]:0;
   var left=ax.lo[u],right=ax.hi[u],top=ax.lo[v],bottom=ax.hi[v],fx=ax.fraction[u],fy=ax.fraction[v];
   var a=top*n+left,b=top*n+right,c=bottom*n+left,e=bottom*n+right;
   var natural=!!rock&&!!mask&&(mode==='plane'&&(info.naturalWalls||plane)&&kind===1||mode==='deep'&&kind!==0&&DEEP_STYLE[regions[cell]]!=='rect');
   var same=!mask||mask[a]===kind&&mask[b]===kind&&mask[c]===kind&&mask[e]===kind;
   var coverage=translucent?(source[a*4+3]*(1-fx)+source[b*4+3]*fx)*(1-fy)+(source[c*4+3]*(1-fx)+source[e*4+3]*fx)*fy:source[sp+3];
   var direct=null,part=null,tx=0,ty=0;
   if(material){var reg=regions[cell],rect=DEEP_STYLE[reg]==='rect';
    if(kind===0){part='floor';tx=x+offsets[0];ty=y+offsets[1];}
    else if(rect&&kind===1){part='face';tx=x+offsets[2];}
    else if(rect&&kind===2){part='top';tx=x+offsets[3];ty=y+offsets[4];}
    if(part&&!(reg===2&&part==='floor'))direct=material[reg][part];
   }
   var dp=(wrap(y*S+v,dh)*dw+wrap(x*S+u,dw))*4,grain=((fd&&info.pool&&info.pool[cell]?fd[dp]:d[dp])-128)*(mode==='vegetation'?.10:.24);
   if(mode==='plane'&&kind===2)grain=0; // The native void stays flat and dark.
   var directPixel=0;if(direct){var dx=wrap(tx*S+u,direct.spec.width),dy=part==='face'?Math.min(S-1,faceY[cell]*S/n+(v%(S/n))):wrap(ty*S+v,direct.spec.height);directPixel=(dy*direct.spec.width+dx)*4;}
   var palette,face=0,depth=0,tone=0,lip=0,edge=0,energy=0;
   if(natural){
    // Real painted surface detail replaces the old broad 32px facets. Only
    // native wall pixels change; floor/void masks and world geometry stay exact.
    palette=plane||(mode==='plane'?PT_MAT.cavern:DEEP_ROCK[regions[cell]]);
    var rx=mirror(x*S+u,rock.spec.width),ry=mirror(y*S+v,rock.spec.height),value=rockPixels[(ry*rock.spec.width+rx)*4]/255;
    // The neutral master's median is near.35. Plane palettes keep their own
    // brightness range, including ivory Light and pale Air, rather than using
    // the intentionally dark Caverns grade.
    tone=Math.max(0,Math.min(1,.55+(value-(plane?.35:.5))*(plane?2:2.2)));
    if(wallDepth){
     var wa=(1-fx)*(1-fy),wb=fx*(1-fy),wc=(1-fx)*fy,we=fx*fy,total=0;
     if(wallDepth[a]>=0){depth+=wallDepth[a]*wa;total+=wa;}if(wallDepth[b]>=0){depth+=wallDepth[b]*wb;total+=wb;}
     if(wallDepth[c]>=0){depth+=wallDepth[c]*wc;total+=wc;}if(wallDepth[e]>=0){depth+=wallDepth[e]*we;total+=we;}
     face=total;depth=total?depth/total:0;lip=Math.max(0,1-depth/.04)*.08*face;
    }
    var cov=(mode==='plane'?mask[a]===1:mask[a]!==0)*(1-fx)*(1-fy)+(mode==='plane'?mask[b]===1:mask[b]!==0)*fx*(1-fy)+(mode==='plane'?mask[c]===1:mask[c]!==0)*(1-fx)*fy+(mode==='plane'?mask[e]===1:mask[e]!==0)*fx*fy;
    edge=(1-cov)*.4;
    energy=minerals?minerals[cell]:mode==='plane'?(source[sp+1]>110&&source[sp+1]>source[sp]*1.35?.72:0):regions[cell]===2?(source[sp]>130&&source[sp]>source[sp+1]*1.45?.8:0):(source[sp]>160?.35:0);
   }
   for(var channel=0;channel<3;channel++){
    var color=source[sp+channel];
    if(natural){
     var topLow=palette.topLo[channel]*(plane?1:.7),faceLow=palette.faceLo[channel]*(plane?1:.65);
     var topColor=topLow+(palette.topHi[channel]-topLow)*tone;
     var faceColor=faceLow+(palette.lip[channel]*.85-faceLow)*tone*(1-depth*.25);
     color=topColor*(1-face)+faceColor*face;
     color=color*(1-lip)+palette.lip[channel]*lip;
     color=color*(1-edge)+palette.edge[channel]*edge;
     color=color*(1-energy)+source[sp+channel]*energy;
    }
    else if(fire&&kind===0&&regions[cell]===2){
     var fl=fireAxis.lo[u],fr=fireAxis.hi[u],ft=fireAxis.lo[v],fb=fireAxis.hi[v],ffx=fireAxis.fraction[u],ffy=fireAxis.fraction[v],fw=fire.width;
     color=((firePixels[(ft*fw+fl)*4+channel]*(1-ffx)+firePixels[(ft*fw+fr)*4+channel]*ffx)*(1-ffy)+(firePixels[(fb*fw+fl)*4+channel]*(1-ffx)+firePixels[(fb*fw+fr)*4+channel]*ffx)*ffy)*(shade?shade[cell]:1);
    }
    else if(direct)color=direct.pixels[directPixel+channel]*(shade?shade[cell]:1);
    else if(translucent)color=coverage?((source[a*4+channel]*source[a*4+3]*(1-fx)+source[b*4+channel]*source[b*4+3]*fx)*(1-fy)+(source[c*4+channel]*source[c*4+3]*(1-fx)+source[e*4+channel]*source[e*4+3]*fx)*fy)/coverage:0;
    else if(same)color=(source[a*4+channel]*(1-fx)+source[b*4+channel]*fx)*(1-fy)+(source[c*4+channel]*(1-fx)+source[e*4+channel]*fx)*fy;
    dst[p+channel]=color+(direct||natural?0:grain*(mode==='chasm'?Math.min(1,color/48):1));
   }
   dst[p+3]=coverage;
  }
  g.putImageData(image,0,0);high.set(base,out);while(high.size>(phone()?192:384))high.delete(high.keys().next().value);
  frameBuilt++;builds++;var elapsed=performance.now()-started;frameMs+=elapsed;peakBuildMs=Math.max(peakBuildMs,elapsed);peakFrameMs=Math.max(peakFrameMs,frameMs);return out;
 }
 cachedRaster=function(kind,x,y,fn){
  var base=oldRaster.apply(this,arguments),mode=fn===waterRaster||fn===oozeRaster?'fluid':fn===chsRaster?'chasm':
   fn===mossRaster||fn===cryptMossRaster||fn===grimeRaster||fn===grassRaster||fn===tramRaster?'vegetation':null;
  return mode?enhance(base,x,y,mode):base;
 };
 function beginFrame(){
  if(cacheMap!==map||cacheMeta!==floorMeta){
   high.clear();fireGround.clear();rockTops.clear();
   // The native renderers keep one cache per terrain family. Drop our auxiliary
   // CPU fields when that family's map is no longer active; native pixels stay.
   [typeof PT_CACHE!=='undefined'?PT_CACHE:null,typeof DC!=='undefined'?DC:null].forEach(function(cache){
    if(cache&&cache.map!==map)Object.keys(cache.cells||{}).forEach(function(key){var cell=cache.cells[key];if(cell)delete cell.environmentTerrain;});
   });
   cacheMap=map;cacheMeta=floorMeta;
  }
  frameBuilt=0;frameMs=0;frameDeadline=performance.now()+(phone()?3:5);
 }
 drawFramePasses=function(){beginFrame();return oldFrame.apply(this,arguments);};
 root.FoteEnvironmentTerrain=Object.freeze({ensureAssets:ensureAssets,ready:function(){return !!manifest&&images.has('stone-detail')&&images.has('fluid-detail');},themeAt:theme,rim:rim,sample:sample,
  floorSample:function(x,y){return masonrySample('floor',x,y);},
  lavaFlow:function(){var entry=get('lava-flow');return entry&&entry.img;},
  surface:function(name,x,y){var entry=get(theme(x,y)+'-'+name);return entry&&entry.img;},metadata:function(){return manifest;},enhance:enhance,
  diagnostics:function(){return {ready:!!manifest,loaded:images.size,pending:loading.size,cachedCells:high.size,builds:builds,peakBuildMs:peakBuildMs,peakFrameMs:peakFrameMs,pixelsPerCell:S};},
  reset:function(){high.clear();fireGround.clear();rockTops.clear();},beginFrame:beginFrame});
 if(typeof FoteLifecycle!=='undefined')FoteLifecycle.whenReady(function(){ensureAssets().catch(function(){/* Original materials remain the load-error fallback. */});});
})(globalThis);
