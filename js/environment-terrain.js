/* High-density environment materials. Geometry, world RNG and turn state are
 * owned by the existing terrain generators; this module only caches pixels. */
(function(root){
 'use strict';
 if(root.FoteEnvironmentTerrain)return;
 var manifest=null,manifestPending=null,images=new Map(),loading=new Map(),high=new Map(),cacheMap=null,cacheMeta=null;
 var S=128,builds=0,frameBuilt=0,frameDeadline=0,peakBuildMs=0,frameMs=0,peakFrameMs=0,fireGround=new Map(),rockTops=new Map();
 var elementalPlanes=['light','shadow','earth','fire','water','air'];
 var oldFrame=drawFramePasses;
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
 // The current floor's materials by default; 'caverns' or a plane name asks for the natural rock; 'all' is every biome.
 function assetKeys(themes){
  if(themes==='all')return Object.keys(manifest.assets);
  if(!themes){themes=['dungeon'];if(typeof floorMeta!=='undefined'&&floorMeta){
   if(floorMeta.deepRegion)themes=DEEP_REGIONS.slice();
   else if(floorMeta.chaosPreview)themes=['prism','cinder'];
   else if(typeof player!=='undefined'&&player)themes=[theme(player.x,player.y)];
  }}
  var keys=['stone-detail','fluid-detail'];if(typeof inCaverns==='function'&&inCaverns()||themes.some(function(t){return t==='caverns'||t==='underdark'||t==='volcanic'||elementalPlanes.indexOf(t)>=0;}))keys.push('cave-rock');if(typeof floorMeta!=='undefined'&&floorMeta&&floorMeta.lava)keys.push('lava-flow');themes.forEach(function(t){['floor','face','top','rim-n','rim-v'].forEach(function(n){var k=t+'-'+n;if(manifest.assets[k])keys.push(k);});});
  return keys;
 }
 function ensureAssets(themes){
  return fetchManifest().then(function(){return Promise.all(assetKeys(themes).map(load));}).then(function(){return root.FoteEnvironmentTerrain;});
 }
 function ready(themes){return !!manifest&&assetKeys(themes).every(function(key){return images.has(key);});}
 // Every cell on screen, twice over (layers), fits the caches, or cells flip back to the crisp raster.
 function cacheCells(){return 2*(viewW+3)*(viewH+3);}
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
 // The top of an Underdark wall in a natural region, or of a built wall there: its 128px rock, else the region's
 // material top (render-adapter.js wallTile). Null when neither is ready.
 function deepTop(x,y){
  var rock=naturalRockTop(x,y);if(rock)return {img:rock,sx:0,sy:0,sw:rock.width,sh:rock.height,deepDim:wallFaces(x,y)?.5:1-DEEP_TOP_DIM};
  var top=masonrySample('top',x,y);if(top){top.deepDim=wallFaces(x,y)?.5:1-DEEP_TOP_DIM;return top;}
  return null;
 }
 function bytes(entry){
  if(!entry.pixels){var c=canvas(entry.img.naturalWidth,entry.img.naturalHeight,'read-'+entry.spec.file),g=c.getContext('2d',{willReadFrequently:true});g.drawImage(entry.img,0,0);entry.pixels=g.getImageData(0,0,c.width,c.height).data;}
  return entry.pixels;
 }
 // The detail and rock masters are only ever read in their red channel.
 function red(entry){
  if(!entry.red){var b=bytes(entry),r=new Uint8Array(b.length>>2);for(var i=0;i<r.length;i++)r[i]=b[i*4];entry.red=r;}
  return entry.red;
 }
 function fireGroundCell(x,y){
  var key=x+','+y;if(fireGround.has(key))return fireGround.get(key);
  var cell=ptGroundRaster(x,y,'fire');fireGround.set(key,cell);
  while(fireGround.size>cacheCells())fireGround.delete(fireGround.keys().next().value);
  return cell;
 }
 // The one-pixel input of a natural rock top: its region's rock colour, all "beyond" (a worker builds the same).
 function rockTopInfo(region){return {mask:new Uint8Array([2]),regions:new Uint8Array([region]),wallDepth:new Float32Array([-1]),pixels:new Uint8ClampedArray(DEEP_ROCK[region].top.concat(255))};}
 function rockTopBase(x,y){
  var region=deepCellReg(x,y),key=x+','+y+':'+region,base=rockTops.get(key);
  if(!base){
   base=canvas(1,1,'rock-top-'+key);base.environmentTerrain=rockTopInfo(region);
   rockTops.set(key,base);while(rockTops.size>cacheCells())rockTops.delete(rockTops.keys().next().value);
  }
  return base;
 }
 function naturalRockTop(x,y){
  var image=enhance(rockTopBase(x,y),x,y,'deep');return image.width===S?image:null;
 }
 // Is the rock top at x,y built already (so a worker need not)?
 function rockTopReady(x,y){var base=rockTops.get(x+','+y+':'+deepCellReg(x,y));return !!base&&high.has(base);}
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
 /* One 128px cell from its input raster (2026-09-28). Pure: it reads only its arguments and wrap/mirror, so a Web
  * Worker can run this same text. Per pixel the arithmetic is the original's, in the original order. What depends
  * only on the row or the column (texture wraps and mirrors), or only on the input pixel an output pixel is nearest
  * to (natural rock, its palette and mineral glow, the master it samples, fire, shade), is worked out once. */
 function enhanceKernel(o){
  var S=o.S,n=o.n,source=o.source,mask=o.mask,regions=o.regions,shade=o.shade,faceY=o.faceY,wallDepth=o.wallDepth,pool=o.pool;
  var x=o.x,y=o.y,mode=o.mode,ax=o.axis,d=o.detail,dw=o.dw,dh=o.dh,fd=o.fluid,rockPixels=o.rock,rw=o.rockWidth,rh=o.rockHeight;
  var plane=o.plane,naturalWalls=o.naturalWalls,minerals=o.minerals,material=o.material,offsets=o.offsets,cavern=o.cavern;
  var firePixels=o.firePixels,fireAxis=o.fireAxis,fw=o.fireWidth,DEEP_STYLE=o.deepStyle,DEEP_ROCK=o.deepRock,dst=o.dst;
  var translucent=mode==='fluid'||mode==='chasm'||mode==='lava-crust'||mode==='vegetation';
  var isPlane=mode==='plane',isDeep=mode==='deep',chasm=mode==='chasm',grainScale=mode==='vegetation'?.10:.24;
  var nearest=ax.nearest,lo=ax.lo,hi=ax.hi,fraction=ax.fraction,i;
  var detailRow=new Int32Array(S),detailCol=new Int32Array(S),rockRow=null,rockCol=null,directCols=[],directRows=[],PARTS={floor:0,face:1,top:2};
  for(i=0;i<S;i++){detailRow[i]=wrap(y*S+i,dh)*dw;detailCol[i]=wrap(x*S+i,dw);}
  if(rockPixels){rockRow=new Int32Array(S);rockCol=new Int32Array(S);for(i=0;i<S;i++){rockRow[i]=mirror(y*S+i,rh)*rw;rockCol[i]=mirror(x*S+i,rw);}}
  function directCol(key,tx,w){var a=directCols[key];if(!a){a=directCols[key]=new Int32Array(S);for(var k=0;k<S;k++)a[k]=wrap(tx*S+k,w);}return a;}
  function directRow(key,ty,h){var a=directRows[key];if(!a){a=directRows[key]=new Int32Array(S);for(var k=0;k<S;k++)a[k]=wrap(ty*S+k,h);}return a;}
  // A palette's channel constants, by the same expressions the pixel loop used.
  var rows=[],rowOf=[];
  function palRow(palette){
   var k=rowOf.indexOf(palette);if(k>=0)return rows[k];
   var r={topLow:[],topSpan:[],faceLow:[],faceSpan:[],lip:[],edge:[]};
   for(var ch=0;ch<3;ch++){
    var topLow=palette.topLo[ch]*(plane?1:.7),faceLow=palette.faceLo[ch]*(plane?1:.65);
    r.topLow.push(topLow);r.topSpan.push(palette.topHi[ch]-topLow);r.faceLow.push(faceLow);r.faceSpan.push(palette.lip[ch]*.85-faceLow);r.lip.push(palette.lip[ch]);r.edge.push(palette.edge[ch]);
   }
   rowOf.push(palette);rows.push(r);return r;
  }
  // Per input pixel.
  var N=n*n,NAT=new Uint8Array(N),ENERGY=new Float64Array(N),PAL=new Array(N),DIRECT=material?new Array(N):null,SLOT=new Int8Array(N),FACE=new Uint8Array(N),TX=new Float64Array(N),TY=new Float64Array(N),FIRE=new Uint8Array(N),SHADE=new Float64Array(N),POOL=new Uint8Array(N);
  for(var q=0;q<N;q++){
   var sq=q*4,kq=mask?mask[q]:0;
   var nat=!!rockPixels&&!!mask&&(isPlane&&(naturalWalls||plane)&&kq===1||isDeep&&kq!==0&&DEEP_STYLE[regions[q]]!=='rect');
   if(nat){
    NAT[q]=1;PAL[q]=palRow(plane||(isPlane?cavern:DEEP_ROCK[regions[q]]));
    ENERGY[q]=minerals?minerals[q]:isPlane?(source[sq+1]>110&&source[sq+1]>source[sq]*1.35?.72:0):regions[q]===2?(source[sq]>130&&source[sq]>source[sq+1]*1.45?.8:0):(source[sq]>160?.35:0);
   }
   if(material){var reg=regions[q],rect=DEEP_STYLE[reg]==='rect',part=null,tx=0,ty=0;
    if(kq===0){part='floor';tx=x+offsets[0];ty=y+offsets[1];}
    else if(rect&&kq===1){part='face';tx=x+offsets[2];}
    else if(rect&&kq===2){part='top';tx=x+offsets[3];ty=y+offsets[4];}
    if(part&&!(reg===2&&part==='floor')){DIRECT[q]=material[reg][part];SLOT[q]=reg*3+PARTS[part];FACE[q]=part==='face'?1:0;TX[q]=tx;TY[q]=ty;}
   }
   FIRE[q]=firePixels&&kq===0&&regions[q]===2?1:0;
   SHADE[q]=shade?shade[q]:1;
   POOL[q]=fd&&pool&&pool[q]?1:0;
  }
  for(var v=0;v<S;v++){
   var nearestY=nearest[v],rowCell=nearestY*n,top=lo[v],bottom=hi[v],fy=fraction[v],topN=top*n,bottomN=bottom*n,dRow=detailRow[v],rRow=rockRow?rockRow[v]:0;
   for(var u=0;u<S;u++){
    var cell=rowCell+nearest[u],p=(v*S+u)*4,sp=cell*4,kind=mask?mask[cell]:0;
    var left=lo[u],right=hi[u],fx=fraction[u];
    var a=topN+left,b=topN+right,c=bottomN+left,e=bottomN+right;
    var natural=NAT[cell]===1;
    var same=!mask||mask[a]===kind&&mask[b]===kind&&mask[c]===kind&&mask[e]===kind;
    var coverage=translucent?(source[a*4+3]*(1-fx)+source[b*4+3]*fx)*(1-fy)+(source[c*4+3]*(1-fx)+source[e*4+3]*fx)*fy:source[sp+3];
    var direct=DIRECT?DIRECT[cell]:undefined;
    var dp=dRow+detailCol[u],grain=((POOL[cell]?fd[dp]:d[dp])-128)*grainScale;
    if(isPlane&&kind===2)grain=0; // The native void stays flat and dark.
    var directPixel=0;if(direct){var slot=SLOT[cell],dx=(directCols[slot]||directCol(slot,TX[cell],direct.spec.width))[u],dy=FACE[cell]?Math.min(S-1,faceY[cell]*S/n+(v%(S/n))):(directRows[slot]||directRow(slot,TY[cell],direct.spec.height))[v];directPixel=(dy*direct.spec.width+dx)*4;}
    var pal=null,face=0,depth=0,tone=0,lip=0,edge=0,energy=0;
    if(natural){
     // Real painted surface detail replaces the old broad 32px facets. Only
     // native wall pixels change; floor/void masks and world geometry stay exact.
     pal=PAL[cell];
     var value=rockPixels[rRow+rockCol[u]]/255;
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
     var cov=(isPlane?mask[a]===1:mask[a]!==0)*(1-fx)*(1-fy)+(isPlane?mask[b]===1:mask[b]!==0)*fx*(1-fy)+(isPlane?mask[c]===1:mask[c]!==0)*(1-fx)*fy+(isPlane?mask[e]===1:mask[e]!==0)*fx*fy;
     edge=(1-cov)*.4;
     energy=ENERGY[cell];
    }
    for(var channel=0;channel<3;channel++){
     var color=source[sp+channel];
     if(natural){
      var topColor=pal.topLow[channel]+pal.topSpan[channel]*tone;
      var faceColor=pal.faceLow[channel]+pal.faceSpan[channel]*tone*(1-depth*.25);
      color=topColor*(1-face)+faceColor*face;
      color=color*(1-lip)+pal.lip[channel]*lip;
      color=color*(1-edge)+pal.edge[channel]*edge;
      color=color*(1-energy)+source[sp+channel]*energy;
     }
     else if(FIRE[cell]){
      var fl=fireAxis.lo[u],fr=fireAxis.hi[u],ft=fireAxis.lo[v],fb=fireAxis.hi[v],ffx=fireAxis.fraction[u],ffy=fireAxis.fraction[v];
      color=((firePixels[(ft*fw+fl)*4+channel]*(1-ffx)+firePixels[(ft*fw+fr)*4+channel]*ffx)*(1-ffy)+(firePixels[(fb*fw+fl)*4+channel]*(1-ffx)+firePixels[(fb*fw+fr)*4+channel]*ffx)*ffy)*SHADE[cell];
     }
     else if(direct)color=direct.pixels[directPixel+channel]*SHADE[cell];
     else if(translucent)color=coverage?((source[a*4+channel]*source[a*4+3]*(1-fx)+source[b*4+channel]*source[b*4+3]*fx)*(1-fy)+(source[c*4+channel]*source[c*4+3]*(1-fx)+source[e*4+channel]*source[e*4+3]*fx)*fy)/coverage:0;
     else if(same)color=(source[a*4+channel]*(1-fx)+source[b*4+channel]*fx)*(1-fy)+(source[c*4+channel]*(1-fx)+source[e*4+channel]*fx)*fy;
     dst[p+channel]=color+(direct||natural?0:grain*(chasm?Math.min(1,color/48):1));
    }
    dst[p+3]=coverage;
   }
  }
  return dst;
 }
 // A 128px cell replaces its input raster in the native cache (PT_CACHE/DC), so a built cell costs 64 KiB, not
 // 64 KiB plus its input and fields; the slot is given back when the cell leaves this cache and is rebuilt on demand.
 function drop(key){var out=high.get(key);high.delete(key);if(out&&out.cache&&out.cache[out.key]===out)delete out.cache[out.key];}
 function forget(){Array.from(high.keys()).forEach(drop);}
 // Least recently drawn first. A phone keeps at most 768 cells (48 MiB). A cell in the camera window is never
 // evicted, so a wide view does not rebuild forever and nothing on screen ever drops back to a raster.
 function cap(){return phone()?Math.min(768,cacheCells()):cacheCells();}
 function trim(){
  var limit=cap();if(high.size<=limit)return;
  for(var it=high.keys(),next=it.next();!next.done&&high.size>limit;next=it.next()){
   var out=high.get(next.value);
   if(out&&out.cellX!==undefined&&out.cellX>=camX-1&&out.cellX<=camX+viewW+1&&out.cellY>=camY-1&&out.cellY<=camY+viewH+1)continue;
   drop(next.value);
  }
 }
 // The kernel's inputs for one cell: which masters, which palette. T supplies the masters (get() here, posted copies
 // in a worker). Null when a master is missing: the caller keeps its input raster (the load-error fallback).
 function kernelInputs(source,info,n,x,y,mode,T){
  var detail=T.get(mode==='fluid'?'fluid-detail':'stone-detail');if(!detail)return null;
  var mask=info.mask,regions=info.regions,fluid=mode==='plane'?T.get('fluid-detail'):null;
  var plane=mode==='plane'&&floorMeta&&elementalPlanes.indexOf(floorMeta.plane)>=0?PT_MAT[floorMeta.plane]:null;
  if(plane&&ptMat(x,y)!==plane)plane=null;
  var rock=info.naturalWalls||plane||mode==='deep'?T.get('cave-rock'):null;
  if((info.naturalWalls||plane||mode==='deep')&&!rock)return null;
  if(mode==='plane'&&!fluid)return null;
  var material=null;if(mode==='deep'){
   material=DEEP_REGIONS.map(function(t){return {floor:T.get(t+'-floor'),face:T.get(t+'-face'),top:T.get(t+'-top')};});
   if(material.some(function(t){return !t.floor||!t.face||!t.top;}))return null;
  }
  // Fire ground shows only through open volcanic pixels; a rock top has none, so its fire raster is not built.
  var fire=mode==='deep'&&regions&&regions.some(function(r,i){return r===2&&!(mask&&mask[i]);})?T.fire(x,y):null;
  return {S:S,n:n,source:source,mask:mask,regions:regions,shade:info.shade,faceY:info.faceY,wallDepth:info.wallDepth,pool:info.pool,
   x:x,y:y,mode:mode,axis:axis(n),detail:detail.red,dw:detail.width,dh:detail.height,fluid:fluid?fluid.red:null,
   rock:rock?rock.red:null,rockWidth:rock?rock.width:0,rockHeight:rock?rock.height:0,
   plane:plane,naturalWalls:info.naturalWalls,minerals:plane&&mask?planeMinerals(source,mask,plane):null,material:material,
   offsets:mode==='deep'?[surfOff(0),surfOff(1),surfOff(2),surfOff(3),surfOff(4)]:null,cavern:typeof PT_MAT!=='undefined'?PT_MAT.cavern:null,
   firePixels:fire?fire.environmentTerrain.pixels:null,fireAxis:fire?axis(fire.width):null,fireWidth:fire?fire.width:0,
   deepStyle:typeof DEEP_STYLE!=='undefined'?DEEP_STYLE:null,deepRock:typeof DEEP_ROCK!=='undefined'?DEEP_ROCK:null,dst:null};
 }
 // This page's masters for kernelInputs: the red channel of the detail and rock masters, whole pixels of the rest.
 var pageTextures={get:function(key){var e=get(key);return e&&{red:/-detail$|^cave-rock$/.test(key)?red(e):null,width:e.img.naturalWidth,height:e.img.naturalHeight,pixels:e.pixels,spec:e.spec};},fire:function(x,y){return fireGroundCell(x,y);}};
 function enhance(base,x,y,mode,cache,key){
  if(!base)return base;
  if(base.environmentTerrain&&base.environmentTerrain.nativeDetail)return base;
  if(high.has(base)){var cached=high.get(base);high.delete(base);high.set(base,cached);return cached;}
  // 2026-09-28: no per-frame budget. A cell is drawn at its final 128px detail the first time it is drawn, never as
  // its input raster first (the owner: no low-resolution art on screen). Floor entries build the view behind the
  // entry hold and the cells around the view are built ahead in idle time, so frames rarely build at all.
  var started=performance.now();
  var n=base.width,info=base.environmentTerrain||{},source=info.pixels||base.getContext('2d',{willReadFrequently:true}).getImageData(0,0,n,n).data;
  var o=kernelInputs(source,info,n,x,y,mode,pageTextures);if(!o)return base;
  var out=canvas(S,S,mode+'-'+x+'-'+y),g=out.getContext('2d'),image=g.createImageData(S,S);
  o.dst=image.data;enhanceKernel(o);g.putImageData(image,0,0);
  return keep(out,base,x,y,cache,key,started);
 }
 // A finished 128px cell enters the cache (from enhance, or from a terrain worker with no base at all).
 function keep(out,base,x,y,cache,key,started){
  if(cache){cache[key]=out;out.cache=cache;out.key=key;base=out;}
  out.cellX=x;out.cellY=y;high.set(base||out,out);trim();
  frameBuilt++;builds++;var elapsed=performance.now()-started;frameMs+=elapsed;peakBuildMs=Math.max(peakBuildMs,elapsed);peakFrameMs=Math.max(peakFrameMs,frameMs);return out;
 }
 // A worker's cell x,y: the pixels enhance() would have made, on the same kind of canvas. (Not drawn as an
 // ImageBitmap: scaled, a bitmap is filtered differently from a canvas with the same pixels.)
 function install(pixels,x,y,mode,cache,key){
  var started=performance.now(),out=canvas(S,S,mode+'-'+x+'-'+y);
  out.getContext('2d').putImageData(new ImageData(pixels,S,S),0,0);
  // A rock top keeps its one-pixel base as the cache key, as naturalRockTop does.
  if(mode==='rock')return keep(out,rockTopBase(x,y),x,y,null,null,started);
  return keep(out,null,x,y,cache,key,started);
 }
 // The source of everything a worker needs from this file, as text (the same functions this page runs).
 function kernelSource(){
  return ['var S='+S+',axes={},elementalPlanes='+JSON.stringify(elementalPlanes)+';',wrap,axis,mirror,planeMinerals,enhanceKernel,kernelInputs,rockTopInfo].map(String).join('\n');
 }
 // Masters a worker reads for plane cells: the detail and rock masters' red channels.
 function workerTextures(){
  var out={};['stone-detail','fluid-detail','cave-rock'].forEach(function(key){var t=pageTextures.get(key);if(t)out[key]={red:t.red,width:t.width,height:t.height};});
  return out;
 }
 // The Underdark's masters for a worker. A cave cell draws a master only on open ground outside the volcanic
 // region (fire there), and on the faces and tops of built (temple) regions. Workers get the cave-region floors
 // (4 MB); a cell that reaches a built region is the page's (terrain-workers.js). The rest are named but empty:
 // kernelInputs only checks that they exist.
 function workerDeepTextures(){
  var out={};
  DEEP_REGIONS.forEach(function(t,r){['floor','face','top'].forEach(function(part){
   var e=get(t+'-'+part);if(!e)return;var used=DEEP_STYLE[r]!=='rect'&&part==='floor'&&r!==2;
   out[t+'-'+part]={pixels:used?bytes(e):null,spec:{width:e.spec.width,height:e.spec.height},width:e.img.naturalWidth,height:e.img.naturalHeight};
  });});
  return out;
 }
 function beginFrame(){
  if(cacheMap!==map||cacheMeta!==floorMeta){
   forget();fireGround.clear();rockTops.clear();
   // The native renderers keep one cache per terrain family. Drop our auxiliary
   // CPU fields when that family's map is no longer active, and its key with them:
   // a remembered floor brings the same map back (plane portal, stairs), and a cell
   // without its fields must be rebuilt, never reused (the deep pass reads regions).
   [typeof PT_CACHE!=='undefined'?PT_CACHE:null,typeof DC!=='undefined'?DC:null].forEach(function(cache){
    if(cache&&cache.map!==map){Object.keys(cache.cells||{}).forEach(function(key){var cell=cache.cells[key];if(cell)delete cell.environmentTerrain;});cache.key=null;}
   });
   cacheMap=map;cacheMeta=floorMeta;
  }
  frameBuilt=0;frameMs=0;frameDeadline=performance.now()+(phone()?3:5);
  if(typeof FoteTerrainWorkers!=='undefined'&&typeof viewW==='number')FoteTerrainWorkers.flush(camX-2,camY-2,camX+viewW+2,camY+viewH+2);
 }
 // TODO(hotfix/frame-cost, render-adapter.js drawFramePasses): the last wrapper here. drawFramePasses should call
 // FoteEnvironmentTerrain.beginFrame() itself; then this reassignment and oldFrame go (bootstrap-browser-test ledger).
 drawFramePasses=function(){beginFrame();return oldFrame.apply(this,arguments);};
 /* ---- Building the view, and ahead of it (2026-09-28) ----------------------------------------------------------
  * bakeView(v) builds every known cell of a tile window (the renderer's own tile lookups, so exactly what the frame
  * will draw), in a task of its own after the one that changed the view: a floor's generation finishes first, and
  * its intermediate draws build nothing. ahead(v) then builds the rest of the window and a ring around it in idle
  * time, nearest first, so a step or a newly lit cell finds its terrain built. */
 var post=(function(){
  if(typeof MessageChannel==='undefined')return function(fn){setTimeout(fn,0);};
  var channel=new MessageChannel(),queue=[];channel.port1.onmessage=function(){var fn=queue.shift();if(fn)fn();};
  return function(fn){queue.push(fn);channel.port2.postMessage(0);};
 })();
 function buildCell(x,y){
  if(x<0||y<0||x>=MW||y>=MH)return;var t=at(x,y);if(t===CHASM)return;
  if(isWallLike(t))wallTile(x,y);else floorTile(x,y);
  DEEP_RC=false;DEEP_AT=-1;
 }
 function windowCells(v,margin,knownOnly){
  var out=[],cx=v.x+v.w/2,cy=v.y+v.h/2;
  for(var y=v.y-margin;y<=v.y+v.h+margin;y++)for(var x=v.x-margin;x<=v.x+v.w+margin;x++){
   if(x<0||y<0||x>=MW||y>=MH)continue;var i=y*MW+x;
   if(knownOnly&&!(revealAll||seen[i]||vis[i]))continue;
   out.push(x,y,(x-cx)*(x-cx)+(y-cy)*(y-cy));
  }
  var order=[];for(var k=0;k<out.length;k+=3)order.push(k);
  order.sort(function(a,b){return out[a+2]-out[b+2];});
  return order.map(function(k){return [out[k],out[k+1]];});
 }
 var lastBake=null,bakes=[];
 function bakeView(v){
  var posted=performance.now();
  return new Promise(function(resolve){post(function(){
   var at0=map,cells=[],log=lastBake={posted:posted,start:performance.now(),cells:0,remote:0,page:0,done:0,mapChanged:cacheMap!==map,metaChanged:cacheMeta!==floorMeta};bakes.push(log);if(bakes.length>8)bakes.shift();
   var finished=false,watchdog=0;
   function finish(){if(finished)return;finished=true;clearTimeout(watchdog);try{if(map===at0){beginFrame();cells.forEach(function(c){buildCell(c[0],c[1]);});}}finally{log.done=performance.now();resolve();}}
   try{
    // the view as it is when this task runs: the entry that asked for it has finished moving the player
    if(typeof v==='function')v=v();
    beginFrame();cells=windowCells(v,0,true);log.cells=cells.length;
    // Plane-material cells go to the terrain workers; the page builds its own share (crystal cells, shared rock,
    // the Underdark, masonry) meanwhile, then anything a worker gave up on.
    var remote=typeof FoteTerrainWorkers!=='undefined'?FoteTerrainWorkers.request(cells,true):null;
    cells.forEach(function(c){if(!remote||!remote.taken.has(c[0]+','+c[1]))buildCell(c[0],c[1]);});
    log.remote=remote?remote.taken.size:0;log.page=performance.now();
    if(remote&&remote.taken.size){
     // then it takes queued jobs too, in slices so the workers' finished cells go in between
     var help=function(){if(map!==at0)return;var t0=performance.now(),job;while(performance.now()-t0<8&&(job=FoteTerrainWorkers.steal())){buildCell(job.x,job.y);log.stolen++;}if(job)post(help);};
     log.stolen=0;post(help);remote.done.then(finish,finish);
     // A worker that never answers must not hold the floor: after 5 s the page builds what is left itself.
     watchdog=setTimeout(finish,5000);
    }else{log.done=log.page;resolve();}
   }catch(error){resolve();throw error;}
  });});
 }
 // The same on the page, now (render-adapter.js drawTerrainNow, for tools that paint a new view in one task).
 function bakeViewNow(v){beginFrame();windowCells(v,0,true).forEach(function(c){buildCell(c[0],c[1]);});}
 var aheadQueue=[],aheadKey='',aheadPending=false,aheadMap=null,aheadRemote=null;
 function aheadMargin(v){
  // A phone keeps the view and its ring inside the cache cap, or the ring would evict what it just built.
  var margin=2;while(margin>0&&(v.w+1+2*margin)*(v.h+1+2*margin)>cap()-32)margin--;
  return margin;
 }
 function ahead(v){
  var key=[v.x,v.y,v.w,v.h].join(',');
  if(aheadMap!==map||key!==aheadKey){aheadMap=map;aheadKey=key;aheadView={x:v.x,y:v.y,w:v.w,h:v.h};aheadQueue=[];aheadRemote=null;aheadFresh=true;}
  if(!aheadPending){aheadPending=true;later(aheadSlice);}
 }
 var aheadView=null,aheadFresh=false;
 function later(fn){if(typeof requestIdleCallback==='function')requestIdleCallback(fn,{timeout:120});else setTimeout(fn,16);}
 function aheadSlice(deadline){
  aheadPending=false;if(aheadMap!==map)return;
  // the ring is worked out here, in idle time after the frame that moved the view is on screen
  if(aheadFresh){aheadFresh=false;aheadQueue=windowCells(aheadView,aheadMargin(aheadView),false);
   aheadRemote=typeof FoteTerrainWorkers!=='undefined'?FoteTerrainWorkers.request(aheadQueue,false).taken:null;
   if(aheadQueue.length){aheadPending=true;later(aheadSlice);}return;}
  var t0=performance.now(),budget=phone()?4:6;
  if(deadline&&typeof deadline.timeRemaining==='function'&&!deadline.didTimeout)budget=Math.max(2,Math.min(budget,deadline.timeRemaining()));
  while(aheadQueue.length&&performance.now()-t0<budget){var c=aheadQueue.shift();if(!aheadRemote||!aheadRemote.has(c[0]+','+c[1]))buildCell(c[0],c[1]);}
  if(aheadQueue.length){aheadPending=true;later(aheadSlice);}
 }
 root.FoteEnvironmentTerrain=Object.freeze({ensureAssets:ensureAssets,ready:ready,themeAt:theme,rim:rim,sample:sample,
  masonry:masonrySample,deepTop:deepTop,floorSample:function(x,y){return masonrySample('floor',x,y);},
  lavaFlow:function(){var entry=get('lava-flow');return entry&&entry.img;},
  surface:function(name,x,y){var entry=get(theme(x,y)+'-'+name);return entry&&entry.img;},metadata:function(){return manifest;},enhance:enhance,
  diagnostics:function(){return {ready:!!manifest,loaded:images.size,pending:loading.size,cachedCells:high.size,builds:builds,peakBuildMs:peakBuildMs,peakFrameMs:peakFrameMs,pixelsPerCell:S,lastBake:lastBake&&Object.assign({},lastBake),bakes:bakes.map(function(b){return Object.assign({},b);})};},
  reset:function(){forget();fireGround.clear();rockTops.clear();aheadQueue=[];aheadKey='';},beginFrame:beginFrame,bakeView:bakeView,bakeViewNow:bakeViewNow,ahead:ahead,
  cacheCanvases:function(){return Array.from(high.values());},install:install,kernelSource:kernelSource,workerTextures:workerTextures,
  workerDeepTextures:workerDeepTextures,rockTopReady:rockTopReady});
 if(typeof FoteLifecycle!=='undefined')FoteLifecycle.whenReady(function(){ensureAssets().catch(function(){/* Original materials remain the load-error fallback. */});});
})(globalThis);
