;
/* js/presentation/render/normal-assets.js */
/* Optional NiRNE surface normals. Original color art, geometry and alpha remain
 * authoritative. Unsupported art uses the lighting renderer's relief fallback.
 * Images belong to the ordinary bounded atlas queue; this module owns no second
 * image cache. Actor records bind exact source frames, never composed outfits. */
(function(root){
 'use strict';
 if(root.FoteNormalAssets)return;
 var directory='normals/',convention='x-right-y-up-z-out';
 var records=[
  {id:'dungeon-floor',source:'environment-terrain-dungeon-floor.png',normal:'normal-floor.png',width:1792,height:896,kind:'floor',atlas:true,opaque:true,mirroredRepeat:true},
  {id:'dungeon-face',source:'environment-terrain-dungeon-face.png',normal:'normal-wall.png',width:768,height:128,kind:'wall',atlas:true,opaque:true},
  {id:'chest-ornate',source:'environment-props-chests.png',crop:[1010,2,124,94],normal:'normal-chest.png',width:124,height:94,kind:'sprite'},
  {id:'crystal-water',source:'environment-props-props.png',crop:[2,134,86,118],normal:'normal-crystal.png',width:86,height:118,kind:'sprite'},
  {id:'forge-lit',source:'environment-props-set.png',crop:[386,2,194,308],normal:'normal-forge.png',width:194,height:308,kind:'sprite'},
  {id:'brazier-lit',source:'environment-props-props.png',crop:[2,366,100,88],normal:'normal-prop-brazier-lit-2-366-100-88.png',width:100,height:88,kind:'sprite'},
  {id:'chest-wood',source:'environment-props-chests.png',crop:[882,2,124,96],normal:'normal-prop-chest-wood-882-2-124-96.png',width:124,height:96,kind:'sprite'},
  {id:'crate-supply',source:'environment-props-chests.png',crop:[374,2,124,108],normal:'normal-prop-crate-supply-374-2-124-108.png',width:124,height:108,kind:'sprite'},
  {id:'shrine-grom',source:'map-set.png',crop:[1063,513,160,243],normal:'normal-prop-shrine-grom-1063-513-160-243.png',width:160,height:243,kind:'sprite'},
  {id:'stairs-down',source:'environment-props-structures.png',crop:[2,134,124,106],normal:'normal-prop-stairs-down-2-134-124-106.png',width:124,height:106,kind:'sprite'},
  {id:'torch-stand',source:'environment-props-props.png',crop:[1238,134,32,112],normal:'normal-prop-torch-stand-1238-134-32-112.png',width:32,height:112,kind:'sprite'},
  {id:'dungeon-sconce',source:'environment-deco-dungeon:9',crop:[0,0,128,128],normal:'normal-prop-wall-sconce-0-0-128-128.png',width:128,height:128,kind:'sprite'},
  {id:'human-f-idle-run',source:'cast-human-f.png',region:[0,2048,1152,256],normal:'normal-cast-human-f-idle-run.png',width:1152,height:256,kind:'sprite',atlas:true}
 ];
 var bySource=new Map(),hits=0,misses=0,pending=0,invalid=0;
 records.forEach(function(record){
  if(record.crop)Object.freeze(record.crop);if(record.region)Object.freeze(record.region);Object.freeze(record);
  if(!bySource.has(record.source))bySource.set(record.source,[]);bySource.get(record.source).push(record);
 });Object.freeze(records);
 function sourceName(image){
  var src=image&&(image.currentSrc||image.src);if(typeof src!=='string')return '';
  // The native terrain owner darkens this exact face atlas into a same-size
  // canvas (source-atop). Its crop, geometry and alpha remain unchanged.
  if(src==='environment-terrain:shaded-dungeon-face'&&image.width===768&&image.height===128)return 'environment-terrain-dungeon-face.png';
  if(src.indexOf('environment-')===0)return src.replace(/\.webp$/,'.png');
  src=src.split(/[?#]/)[0].replace(/\\/g,'/');return src.slice(src.lastIndexOf('/')+1).replace(/\.webp$/,'.png');
 }
 function rectangle(art){
  var a=[art.sx,art.sy,art.sw,art.sh];return a.every(Number.isFinite)&&a[0]>=0&&a[1]>=0&&a[2]>0&&a[3]>0?a:null;
 }
 function match(art){
  if(!art||!art.img)return null;
  var crop=rectangle(art);if(!crop)return null;
  var source=sourceName(art.img),flipX=1,flipY=1;
  // Native terrain caches reflected tiles instead of expanding the master.
  // Its source identifier preserves the original atlas cell and both mirrors.
  // Deploy rewrites atlas filenames to WebP; the canvas identifier follows it.
  var reflection=/^environment-terrain:masonry-reflection-(environment-terrain-dungeon-floor\.(?:png|webp)):(\d+):(\d+):([01]):([01])$/.exec(source);
  if(reflection){
   var cw=art.img.width,ch=art.img.height;if(cw!==128||ch!==128||crop[0]+crop[2]>cw||crop[1]+crop[3]>ch)return null;
   source=reflection[1].replace(/\.webp$/,'.png');flipX=reflection[4]==='1'?-1:1;flipY=reflection[5]==='1'?-1:1;
   crop=[Number(reflection[2])*cw+(flipX<0?cw-crop[0]-crop[2]:crop[0]),Number(reflection[3])*ch+(flipY<0?ch-crop[1]-crop[3]:crop[1]),crop[2],crop[3]];
  }
  var candidates=bySource.get(source);if(!candidates)return null;
  for(var i=0;i<candidates.length;i++){
   var r=candidates[i],ox=r.region?r.region[0]:0,oy=r.region?r.region[1]:0;
   var same=r.atlas?crop[0]>=ox&&crop[1]>=oy&&crop[0]+crop[2]<=ox+r.width&&crop[1]+crop[3]<=oy+r.height:r.crop.every(function(v,k){return v===crop[k];});
   if(!same)continue;
   return {record:r,sx:r.atlas?crop[0]-ox:0,sy:r.atlas?crop[1]-oy:0,sw:crop[2],sh:crop[3],flipX:flipX,flipY:flipY};
  }
  return null;
 }
 function resolve(art){
  var found=match(art);if(!found){misses++;return null;}
  var record=found.record,img=typeof atl==='function'?atl(directory+record.normal):null;
  if(!img){pending++;return null;}
  if((img.naturalWidth||img.width)!==record.width||(img.naturalHeight||img.height)!==record.height){invalid++;return null;}
  hits++;
  // The shader must mirror UVs AND normal vector components by these intrinsic
  // signs, then apply the draw's own transform. Alpha comes from the color art.
  return {img:img,sx:found.sx,sy:found.sy,sw:found.sw,sh:found.sh,flipX:found.flipX,flipY:found.flipY,kind:record.kind,
   recordId:record.id,sourceFile:record.source,normalFile:directory+record.normal,convention:convention,alpha:'source-color',opaque:record.opaque===true,mirroredRepeat:record.mirroredRepeat===true};
 }
 function selected(ids){return !ids?records:records.filter(function(r){return ids.indexOf(r.id)>=0;});}
 // Source election runs before painting. Only normals whose color atlases are
 // part of this scene join the ordinary queue and its readiness boundary.
 function filesForSources(files){
  var sources=new Set(Array.from(files,function(file){return file.replace(/\.webp$/,'.png');}));
  return records.filter(function(r){return sources.has(r.source)||r.id==='dungeon-sconce'&&sources.has('environment-terrain-dungeon-floor.png');}).map(function(r){return directory+r.normal;});
 }
 function ensureAssets(ids){
  if(typeof atlReady!=='function')return Promise.reject(Error('Native atlas loader is unavailable.'));
  return Promise.all(selected(ids).map(function(r){return atlReady(directory+r.normal,{retry:true}).then(function(img){
   if(img.naturalWidth!==r.width||img.naturalHeight!==r.height)throw Error('Normal dimensions do not match '+r.id+'.');return img;
  });})).then(function(){return root.FoteNormalAssets;});
 }
 function diagnostics(){
  var native=typeof atlasLoadDiagnostics==='function'?atlasLoadDiagnostics():{files:[],failures:[]};
  var files=native.files.filter(function(f){return f.file.indexOf(directory)===0;});
  return {mappedAssets:records.length,convention:convention,hits:hits,misses:misses,pendingLookups:pending,invalidDimensions:invalid,
   files:files,readyBytes:files.reduce(function(n,f){return n+(f.phase==='ready'?f.bytes||0:0);},0),
   failures:native.failures.filter(function(f){return f.file.indexOf(directory)===0;}),playerNormals:'Exact human-f idle2/run2 body frames only; other actions and looks use fallback.'};
 }
 root.FoteNormalAssets=Object.freeze({resolve:resolve,match:match,ensureAssets:ensureAssets,filesForSources:filesForSources,
  // The native loader's monotonic arrival epoch invalidates retained ground
  // when a requested normal becomes ready, including an evicted atlas reload.
  // Reading one scalar avoids scanning the image queue on every ground frame.
  revision:function(){return typeof ATL_LOADS==='number'?ATL_LOADS:0;},
  ready:function(ids){var files=diagnostics().files;return selected(ids).every(function(r){return files.some(function(f){return f.file===directory+r.normal&&f.phase==='ready';});});},
  records:function(){return records;},diagnostics:diagnostics});
})(globalThis);

;
/* js/presentation/render/normal-lighting.js */
/* Native forward surface lighting. Original Canvas pixels remain the albedo;
 * ordered native draw records supply source alpha, inferred normals and explicit
 * receiver positions. Every admitted native light is summed independently.
 * No scene-gradient normals, averaged-light moments, gameplay writes or readback. */
(function(root){
  'use strict';
  var requested=true;
  try{requested=new URLSearchParams(root.location&&root.location.search||'').get('lighting')!=='classic';}catch(ignore){}
  var relief=.72,device=null,lost=false,failed=false,records=[],layers=[],collector=null,imageIds=new WeakMap(),layerSizes=new WeakMap(),nextImage=1;
  var stats={frames:0,composites:0,fallbacks:0,contextLosses:0,errors:[],last:null};
  var TEXTURE_BUDGET=24*1024*1024,GEOMETRY_BUDGET=6*1024*1024,FIELD_SPARE_BUDGET=64*1024,MAX_TEXTURES=512,STRIDE=22;
  var FULL_LAYOUT=[['a_position',2,0],['a_uv',2,2]],SURFACE_LAYOUT=[['a_position',2,0],['a_uv',2,2],['a_world',3,4],['a_admission',2,7],['a_basis',4,9],['a_shape',4,13],['a_bounds',4,17],['a_emission',1,21]];
  var CORNERS=[0,0,1,0,0,1,0,1,1,0,1,1];
  function note(error){var s=String(error&&error.message||error);if(stats.errors[stats.errors.length-1]!==s)stats.errors.push(s);if(stats.errors.length>12)stats.errors.shift();}
  function finite(n){return typeof n==='number'&&Number.isFinite(n);}
  function clamp(n,a,b){return Math.max(a,Math.min(b,n));}
  function matrix(ctx){var m=ctx.getTransform();return [m.a,m.b,m.c,m.d,m.e,m.f];}
  function cleanRect(r){return r&&finite(r.x)&&finite(r.y)&&finite(r.w)&&finite(r.h)&&r.w!==0&&r.h!==0?{x:r.x,y:r.y,w:r.w,h:r.h}:null;}
  function id(image){var n=imageIds.get(image);if(!n){n=nextImage++;imageIds.set(image,n);}return n;}
  function texture(gl,nearest){var t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,nearest?gl.NEAREST:gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,nearest?gl.NEAREST:gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);return t;}
  function program(gl,vs,fs){function compile(type,source){var s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){var e=gl.getShaderInfoLog(s);gl.deleteShader(s);throw Error('Native surface shader: '+e);}return s;}var v=compile(gl.VERTEX_SHADER,vs),f=compile(gl.FRAGMENT_SHADER,fs),p=gl.createProgram();gl.attachShader(p,v);gl.attachShader(p,f);gl.linkProgram(p);gl.deleteShader(v);gl.deleteShader(f);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error('Native surface program: '+gl.getProgramInfoLog(p));return p;}
  var fullVertex=['#version 300 es','in vec2 a_position;in vec2 a_uv;out vec2 v_uv;void main(){v_uv=a_uv;gl_Position=vec4(a_position,0.,1.);}'].join('\n');
  var fieldFunctions=[
    'vec2 fieldUV(vec2 p){return (p-u_origin+vec2(.5))*u_samples/u_fieldSize;}',
    'bool inside(vec2 uv){return all(greaterThanEqual(uv,vec2(0.)))&&all(lessThan(uv,vec2(1.)));}',
    'vec2 clampedUV(vec2 uv){return clamp(uv,vec2(.5)/u_fieldSize,vec2(1.)-vec2(.5)/u_fieldSize);}',
    'vec3 nativeLight(vec2 p){vec2 uv=fieldUV(p);return inside(uv)?texture(u_native,clampedUV(uv)).rgb:vec3(0.);}',
    'bool admitted(vec2 p){vec2 uv=fieldUV(p);if(!inside(uv))return false;ivec2 cell=ivec2(floor(uv*u_fieldSize));return texelFetch(u_native,cell,0).a>.5;}'
  ].join('\n');
  var backgroundFragment=['#version 300 es','precision highp float;in vec2 v_uv;out vec4 result;',
    'uniform sampler2D u_native;uniform vec2 u_canvas,u_camera,u_origin,u_fieldSize;uniform mat3 u_inverse;uniform float u_tileSize,u_samples,u_storageScale;',fieldFunctions,
    'void main(){vec2 p=(u_inverse*vec3(v_uv*u_canvas,1.)).xy/u_tileSize+u_camera-vec2(.5);result=vec4(nativeLight(p)/u_storageScale,1.);}'].join('\n');
  var surfaceVertex=['#version 300 es','precision highp float;',
    'in vec2 a_position,a_uv,a_admission;in vec3 a_world;in vec4 a_basis,a_shape,a_bounds;in float a_emission;',
    'uniform vec2 u_canvas,u_offset;out vec2 v_uv,v_admission;out vec3 v_world;out vec4 v_basis,v_shape,v_bounds;out float v_emission;',
    'void main(){vec2 p=(a_position+u_offset)/u_canvas;gl_Position=vec4(p.x*2.-1.,1.-p.y*2.,0.,1.);v_uv=a_uv;v_admission=a_admission;v_world=a_world;v_basis=a_basis;v_shape=a_shape;v_bounds=a_bounds;v_emission=a_emission;}'].join('\n');
  var surfaceFragment=['#version 300 es','precision highp float;precision highp int;',
    'in vec2 v_uv,v_admission;in vec3 v_world;in vec4 v_basis,v_shape,v_bounds;in float v_emission;out vec4 result;',
    'uniform sampler2D u_normal,u_mask,u_weights,u_lights,u_ambient,u_native;',
    'uniform vec2 u_origin,u_fieldSize,u_weightSize;uniform float u_samples,u_weightScale,u_relief,u_storageScale;',
    'uniform int u_lightCount,u_lightColumns,u_weightColumns;uniform bool u_hasNormal,u_opaque,u_mirroredRepeat;',fieldFunctions,
    'void main(){',
    ' if(v_shape.y>.5){result=vec4(nativeLight(v_world.xy)/u_storageScale,1.);return;}if(!admitted(v_admission))discard;',
    ' vec2 uv=clamp(v_uv,v_bounds.xy,v_bounds.zw);float alpha=(u_opaque?1.:texture(u_mask,uv).a)*v_shape.x;if(alpha<=.0001)discard;',
    // Readable ground loot keeps its painted color. Its source alpha and native
    // record order still let the floor show through and actors cover it.
    ' if(v_shape.z>3.5){result=vec4(vec3(alpha/u_storageScale),alpha);return;}',
    // The normal convention is x-right/y-up/z-out. Position Y uses native
    // downwards map coordinates; convert the light delta once below.
    // The native masonry owner mirrors the whole atlas at repeat boundaries.
    // A normal's crossing component must reach zero there before its sign flips;
    // otherwise continuous stone color acquires a straight lighting crease.
    // Only the outer 12 source pixels taper, not individual tile or mortar edges.
    ' vec3 n=vec3(0.,0.,1.);if(u_hasNormal){vec3 c=texture(u_normal,uv).rgb;n=vec3((c.rg*255.-128.)/127.,c.b*2.-1.);if(u_mirroredRepeat){vec2 edge=max(vec2(0.),min(uv,vec2(1.)-uv)*vec2(textureSize(u_normal,0))-vec2(.5));n.xy*=smoothstep(vec2(0.),vec2(12.),edge);}n.xy=mat2(v_basis.xy,v_basis.zw)*n.xy*(v_shape.z>2.5?1.7:3.)*u_relief;n=normalize(n);}',
    ' if(v_shape.z>.5&&v_shape.z<1.5)n=vec3(n.x,-n.z,n.y);else if(v_shape.z>1.5)n=vec3(n.x,(n.y-n.z)*.70710678,(n.y+n.z)*.70710678);',
    ' vec2 field=fieldUV(v_world.xy);if(!inside(field))discard;vec2 cell=clamp(field*u_fieldSize,vec2(.5),u_fieldSize-vec2(.5));',
    ' vec3 illumination=max(vec3(0.),texture(u_ambient,clampedUV(field)).rgb);vec3 point=vec3(v_world.xy,max(0.,v_world.z));',
    // WebGL2 permits a dynamic loop: all admitted sources remain present, even
    // when their number exceeds a fixed uniform-array size.
    ' for(int k=0;k<u_lightCount;k++){',
    '  ivec2 li=ivec2(k%u_lightColumns,(k/u_lightColumns)*2);vec4 light=texelFetch(u_lights,li,0);vec3 color=texelFetch(u_lights,li+ivec2(0,1),0).rgb;',
    '  vec2 tile=vec2(k%u_weightColumns,k/u_weightColumns);float weight=texture(u_weights,(tile*u_fieldSize+cell)/u_weightSize).r*u_weightScale;if(weight<=0.)continue;',
    '  vec3 delta=vec3(light.x-point.x,point.y-light.y,light.z-point.z);float len=length(delta);vec3 direction=len>.0001?delta/len:vec3(0.,0.,1.);',
    '  float diffuse=max(0.,dot(n,direction));float self=k==0?v_shape.w:1.;illumination+=color*weight*(.22+diffuse)*self;',
    ' }',
    // Luminous painted receivers retain a minimum illumination without adding
    // white albedo or bypassing source alpha, occlusion, or actor admission.
    ' result=vec4(max(illumination,vec3(v_emission))*alpha/u_storageScale,alpha);',
    '}'
  ].join('\n');
  var finalFragment=['#version 300 es','precision highp float;in vec2 v_uv;out vec4 result;uniform sampler2D u_color,u_irradiance;uniform float u_storageScale;',
    'void main(){vec4 color=texture(u_color,v_uv);vec3 light=texture(u_irradiance,vec2(v_uv.x,1.-v_uv.y)).rgb*u_storageScale;result=vec4(color.rgb*light,color.a);}'].join('\n');
  function locations(gl,p,attributes,uniforms){var l={};attributes.forEach(function(n){l[n]=gl.getAttribLocation(p,n);});uniforms.forEach(function(n){l[n]=gl.getUniformLocation(p,n);});return l;}
  function initialize(){
    if(failed||lost||!root.document)return false;if(device)return !device.gl.isContextLost();
    try{
      var canvas=document.createElement('canvas'),gl=canvas.getContext('webgl2',{alpha:true,premultipliedAlpha:false,antialias:false,preserveDrawingBuffer:false,depth:false,stencil:false});if(!gl){failed=true;return false;}
      var d={canvas:canvas,gl:gl,background:program(gl,fullVertex,backgroundFragment),surface:program(gl,surfaceVertex,surfaceFragment),final:program(gl,fullVertex,finalFragment),fullBuffer:gl.createBuffer(),streamBuffer:gl.createBuffer(),source:texture(gl),irradiance:texture(gl),native:texture(gl),ambient:texture(gl),weights:texture(gl),lights:texture(gl,true),framebuffer:gl.createFramebuffer(),cache:new Map(),cacheBytes:0,geometryCache:new Map(),geometryBytes:0,width:0,height:0,maxTexture:gl.getParameter(gl.MAX_TEXTURE_SIZE),maxAttributes:gl.getParameter(gl.MAX_VERTEX_ATTRIBS),floatTarget:!!gl.getExtension('EXT_color_buffer_float')};
      d.backgroundLoc=locations(gl,d.background,['a_position','a_uv'],['u_native','u_canvas','u_camera','u_origin','u_fieldSize','u_inverse','u_tileSize','u_samples','u_storageScale']);
      d.surfaceLoc=locations(gl,d.surface,['a_position','a_uv','a_world','a_admission','a_basis','a_shape','a_bounds','a_emission'],['u_normal','u_mask','u_weights','u_lights','u_ambient','u_native','u_origin','u_fieldSize','u_weightSize','u_samples','u_weightScale','u_relief','u_storageScale','u_lightCount','u_lightColumns','u_weightColumns','u_hasNormal','u_opaque','u_mirroredRepeat','u_canvas','u_offset']);
      d.finalLoc=locations(gl,d.final,['a_position','a_uv'],['u_color','u_irradiance','u_storageScale']);
      gl.disable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL,gl.NONE);gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);
      gl.bindBuffer(gl.ARRAY_BUFFER,d.fullBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,1,0,0,1,1,1,0,-1,-1,0,1,-1,-1,0,1,1,1,1,0,1,-1,1,1]),gl.STATIC_DRAW);
      d.backgroundVAO=vertexArray(d,d.backgroundLoc,d.fullBuffer,FULL_LAYOUT,4);d.finalVAO=vertexArray(d,d.finalLoc,d.fullBuffer,FULL_LAYOUT,4);d.streamVAO=vertexArray(d,d.surfaceLoc,d.streamBuffer,SURFACE_LAYOUT,STRIDE);
      canvas.addEventListener('webglcontextlost',function(e){e.preventDefault();clearFieldSpare(d);lost=true;device=null;stats.contextLosses++;end();});canvas.addEventListener('webglcontextrestored',function(){lost=false;failed=false;device=null;});device=d;return true;
    }catch(error){if(d)dispose(d);else if(gl){var release=gl.getExtension('WEBGL_lose_context');if(release)release.loseContext();}failed=true;note(error);return false;}
  }
  function enabled(){return requested&&relief>0&&(typeof lightingOn!=='function'||lightingOn())&&initialize();}
  function available(){return initialize();}
  function setEnabled(v){requested=!!v;end();return enabled();}
  function setRelief(v){if(finite(v))relief=clamp(v,0,1.5);return relief;}
  function end(){records=[];layers=[];collector=null;}
  function begin(ctx){end();if(!ctx||!enabled())return false;collector=ctx;return true;}
  function record(ctx,art,rect,options){
    if(!requested||lost||failed||relief===0||!ctx||ctx!==collector||!art||!art.img)return false;var r=cleanRect(rect);if(!r)return false;options=options||{};
    var n=options.normal===false?null:options.normal||root.FoteNormalAssets&&root.FoteNormalAssets.resolve(art)||null,alpha=options.alpha===undefined?ctx.globalAlpha:options.alpha;if(!finite(alpha)||alpha<=0)return false;
    records.push({art:art,normal:n,rect:r,matrix:matrix(ctx),alpha:clamp(alpha,0,1),surface:options.surface?Object.assign({},options.surface):null,clip:cleanRect(options.clip),erase:false});return true;
  }
  function invalidate(ctx,rect){var r=cleanRect(rect);if(!requested||lost||failed||relief===0||!ctx||ctx!==collector||!r)return false;records.push({rect:r,matrix:matrix(ctx),alpha:1,erase:true});return true;}
  function captureLayer(ctx){if(!collector||!ctx)return null;var t={parent:records,records:[],ctx:ctx,parentContext:collector};layers.push(t);records=t.records;collector=ctx;return t;}
  function finishLayer(t){if(!t)return [];var i=layers.lastIndexOf(t);if(i<0)return [];var result=t.records;layerSizes.set(result,{width:t.ctx.canvas.width,height:t.ctx.canvas.height});records=t.parent;collector=t.parentContext;layers.splice(i);return result;}
  function translated(r,dx,dy){var m=r.matrix.slice();m[4]+=dx;m[5]+=dy;var s=r.surface&&Object.assign({},r.surface);if(s&&finite(s.footY))s.footY+=dy;return Object.assign({},r,{matrix:m,surface:s});}
  function appendLayer(saved,dx,dy){if(!requested||lost||failed||relief===0||!collector||!saved)return;dx=finite(dx)?dx:0;dy=finite(dy)?dy:0;var size=layerSizes.get(saved);if(size){records.push({layer:saved,dx:dx,dy:dy});return;}saved.forEach(function(r){records.push(translated(r,dx,dy));});}
  function bindTexture(d,unit,t){var g=d.gl;g.activeTexture(g.TEXTURE0+unit);g.bindTexture(g.TEXTURE_2D,t);}
  // Vertex layouts belong to their buffer, not to a draw. Retaining them avoids
  // resetting every attribute for every native sprite while preserving order.
  function vertexArray(d,loc,buffer,layout,stride){var g=d.gl,vao=g.createVertexArray();g.bindVertexArray(vao);g.bindBuffer(g.ARRAY_BUFFER,buffer);layout.forEach(function(a){var p=loc[a[0]];if(p<0)return;g.enableVertexAttribArray(p);g.vertexAttribPointer(p,a[1],g.FLOAT,false,stride*4,a[2]*4);});return vao;}
  function fullscreen(d,loc){d.gl.bindVertexArray(loc===d.backgroundLoc?d.backgroundVAO:d.finalVAO);}
  function resize(d,w,h){if(w===d.width&&h===d.height)return;clearFieldSpare(d);d.fieldView=null;var g=d.gl;d.canvas.width=d.width=w;d.canvas.height=d.height=h;bindTexture(d,0,d.source);g.texImage2D(g.TEXTURE_2D,0,g.RGBA,w,h,0,g.RGBA,g.UNSIGNED_BYTE,null);bindTexture(d,0,d.irradiance);d.storageScale=d.floatTarget?1:4;g.texImage2D(g.TEXTURE_2D,0,d.floatTarget?g.RGBA16F:g.RGBA8,w,h,0,g.RGBA,d.floatTarget?g.HALF_FLOAT:g.UNSIGNED_BYTE,null);g.bindFramebuffer(g.FRAMEBUFFER,d.framebuffer);g.framebufferTexture2D(g.FRAMEBUFFER,g.COLOR_ATTACHMENT0,g.TEXTURE_2D,d.irradiance,0);if(g.checkFramebufferStatus(g.FRAMEBUFFER)!==g.FRAMEBUFFER_COMPLETE)throw Error('Native irradiance framebuffer unavailable');g.bindFramebuffer(g.FRAMEBUFFER,null);}
  function prune(d){while(d.cache.size>MAX_TEXTURES||d.cacheBytes>TEXTURE_BUDGET){var key=d.cache.keys().next().value,e=d.cache.get(key);d.gl.deleteTexture(e.texture);if(e.mask)d.gl.deleteTexture(e.mask);d.cacheBytes-=e.bytes;d.cache.delete(key);d.frameEvictions++;}}
  function trimGeometry(d){
    while(d.geometryCache.size>2||d.geometryBytes>GEOMETRY_BUDGET){var key=d.geometryCache.keys().next().value,old=d.geometryCache.get(key);old.batches.forEach(function(b){d.gl.deleteVertexArray(b.vao);d.gl.deleteBuffer(b.buffer);});d.geometryBytes-=old.bytes;d.geometryCache.delete(key);}
  }
  function dispose(d){
    var g=d.gl;clearFieldSpare(d);d.cache.forEach(function(e){g.deleteTexture(e.texture);if(e.mask)g.deleteTexture(e.mask);});d.cache.clear();
    d.geometryCache.forEach(function(e){e.batches.forEach(function(b){g.deleteVertexArray(b.vao);g.deleteBuffer(b.buffer);});});d.geometryCache.clear();
    ['source','irradiance','native','ambient','weights','lights','white'].forEach(function(k){if(d[k])g.deleteTexture(d[k]);});
    ['background','surface','final'].forEach(function(k){g.deleteProgram(d[k]);});['fullBuffer','streamBuffer'].forEach(function(k){g.deleteBuffer(d[k]);});
    ['backgroundVAO','finalVAO','streamVAO'].forEach(function(k){g.deleteVertexArray(d[k]);});g.deleteFramebuffer(d.framebuffer);
  }
  function recordTexture(d,r,preparing){
    // Verified opaque terrain has no silhouette to upload. Its flat fallback
    // shares one texel; transparent rasters and every mapped normal stay exact.
    var g=d.gl;g.activeTexture(g.TEXTURE0);if(r.erase||!r.normal&&r.art&&r.art.opaque===true){if(!d.white){d.white=texture(g);g.texImage2D(g.TEXTURE_2D,0,g.R8,1,1,0,g.RED,g.UNSIGNED_BYTE,new Uint8Array([255]));}return {key:r.erase?'erase':'opaque',texture:d.white,mask:null,hasNormal:false,shared:true,opaque:!r.erase};}var a=r.art,n=r.normal;if(!a||!a.img)return null;
    if(n&&n.opaque===true){var iw=n.img.naturalWidth||n.img.width,ih=n.img.naturalHeight||n.img.height,key='atlas:'+id(n.img),entry=d.cache.get(key);if(entry){d.cache.delete(key);d.cache.set(key,entry);return entry;}if(iw>d.maxTexture||ih>d.maxTexture||iw*ih*3>TEXTURE_BUDGET)return null;var started=performance.now(),t=texture(g);g.texImage2D(g.TEXTURE_2D,0,g.RGB,g.RGB,g.UNSIGNED_BYTE,n.img);entry={key:key,texture:t,mask:null,bytes:iw*ih*3,atlas:true,width:iw,height:ih,hasNormal:true,mirroredRepeat:n.mirroredRepeat===true};d.cache.set(key,entry);d.cacheBytes+=entry.bytes;prune(d);d.frameUploads++;d.frameUploadMS+=performance.now()-started;return entry;}
    var sx=a.sx||0,sy=a.sy||0,sw=a.sw||a.img.naturalWidth||a.img.width,sh=a.sh||a.img.naturalHeight||a.img.height;if(!(sw>0&&sh>0))return null;
    var w=Math.max(1,Math.ceil(sw)),h=Math.max(1,Math.ceil(sh)),bytes=w*h*(n?7:4);if(w>d.maxTexture||h>d.maxTexture||bytes>TEXTURE_BUDGET)return null;
    var key=[id(a.img),sx,sy,sw,sh,n?id(n.img):0,n&&n.sx,n&&n.sy,n&&n.sw,n&&n.sh,n&&n.flipX,n&&n.flipY].join(':'),entry=d.cache.get(key);if(entry){if(!preparing){d.cache.delete(key);d.cache.set(key,entry);}return entry;}
    if(preparing&&(d.cacheBytes+bytes>TEXTURE_BUDGET||d.cache.size>=MAX_TEXTURES))return null;
    var started=performance.now(),c=document.createElement('canvas');c.width=w;c.height=h;var x=c.getContext('2d'),t=null,mask=texture(g);
    // Keep source alpha on the GPU. A Canvas readback here stalls cold movement frames.
    x.drawImage(a.img,sx,sy,sw,sh,0,0,w,h);g.texImage2D(g.TEXTURE_2D,0,g.RGBA,g.RGBA,g.UNSIGNED_BYTE,c);
    if(n){x.clearRect(0,0,w,h);var fx=n.flipX===-1?-1:1,fy=n.flipY===-1?-1:1;x.save();x.translate(fx<0?w:0,fy<0?h:0);x.scale(fx,fy);x.drawImage(n.img,n.sx,n.sy,n.sw,n.sh,0,0,w,h);x.restore();t=texture(g);g.texImage2D(g.TEXTURE_2D,0,g.RGB,g.RGB,g.UNSIGNED_BYTE,c);}else{t=mask;mask=null;}
    entry={key:key,texture:t,mask:mask,bytes:bytes,hasNormal:!!n};d.cache.set(key,entry);d.cacheBytes+=bytes;prune(d);d.frameUploads++;d.frameUploadMS+=performance.now()-started;
    // Native painters may elect the other alpha crops of their current clip.
    // Only exact same-row cells qualify; malformed or transformed source crops
    // keep demand-only imports. The current frame always claims its space first.
    if(!preparing&&d.prefetch&&!n&&Number.isInteger(a.prefetchFrames)&&a.prefetchFrames>1&&
      Number.isInteger(sw)&&sw===sh&&Number.isInteger(sx/sw)&&sx>=0&&sx<sw*a.prefetchFrames&&Number.isInteger(sy/sh)&&sy>=0&&
      sw*a.prefetchFrames<=(a.img.naturalWidth||a.img.width)&&sy+sh<=(a.img.naturalHeight||a.img.height))d.prefetch.push(r);
    // Only a cold registered idle/run frame elects its seventeen peers. Keep
    // every existing crop conversion and UV; optional uploads wait until all
    // current-frame textures have claimed their cache budget.
    if(!preparing&&d.prefetch&&n&&n.recordId==='human-f-idle-run'&&n.flipX!==-1&&n.flipY!==-1&&
      sw===128&&sh===128&&n.sw===128&&n.sh===128&&sx===n.sx&&sy===n.sy+2048&&
      Number.isInteger(n.sx/128)&&n.sx>=0&&n.sx<1152&&(n.sy===0||n.sy===128)&&
      (n.img.naturalWidth||n.img.width)===1152&&(n.img.naturalHeight||n.img.height)===256&&
      (a.img.naturalWidth||a.img.width)>=1152&&(a.img.naturalHeight||a.img.height)>=2304)d.prefetch.push(r);
    return entry;
  }
  // Field contents change every frame; their texture storage only changes size
  // when the view or admitted source count changes.
  function clearFieldSpare(d){var spare=d.fieldSpare;if(!spare)return;d.gl.deleteTexture(spare.weights);d.gl.deleteTexture(spare.lights);d.fieldSpare=null;}
  function selectFieldLayout(d,width,height,ww,wh,lcols,lrows){
    var view=d.fieldView,changed=!view||view[0]!==width||view[1]!==height;
    if(changed){clearFieldSpare(d);d.fieldView=[width,height];}
    var sizes=d.fieldSizes,ws=sizes&&sizes.weights,ls=sizes&&sizes.lights;
    if(!ws||!ls||ws[0]===ww&&ws[1]===wh&&ls[0]===lcols&&ls[1]===lrows)return;
    // Retain at most one small previous pair, with its exact atlas dimensions.
    // A returning source count still receives fresh bytes but avoids allocating
    // storage (and the synchronous allocation-error boundary) a second time.
    var old={weights:d.weights,lights:d.lights,weightSize:ws,lightSize:ls},spare=d.fieldSpare;
    var keep=!changed&&ws[0]*ws[1]+ls[0]*ls[1]*16<=FIELD_SPARE_BUDGET;
    var hit=spare&&spare.weightSize[0]===ww&&spare.weightSize[1]===wh&&spare.lightSize[0]===lcols&&spare.lightSize[1]===lrows;
    if(hit)d.fieldSpare=null;else clearFieldSpare(d);
    if(hit){
      if(keep)d.fieldSpare=old;else{d.gl.deleteTexture(old.weights);d.gl.deleteTexture(old.lights);}
      d.weights=spare.weights;d.lights=spare.lights;sizes.weights=spare.weightSize;sizes.lights=spare.lightSize;
    }else if(keep){
      d.fieldSpare=old;d.weights=texture(d.gl);d.lights=texture(d.gl,true);delete sizes.weights;delete sizes.lights;
    }
  }
  function uploadField(d,name,unit,internal,width,height,format,type,data){
    var g=d.gl,size=d.fieldSizes&&d.fieldSizes[name];bindTexture(d,unit,d[name]);
    if(!size||size[0]!==width||size[1]!==height){
      g.texImage2D(g.TEXTURE_2D,0,internal,width,height,0,format,type,data);
      if(!d.fieldSizes)d.fieldSizes=Object.create(null);d.fieldSizes[name]=[width,height];d.frameFieldTextureAllocations++;
    }else g.texSubImage2D(g.TEXTURE_2D,0,0,0,width,height,format,type,data);
  }
  function prepareFields(d,frame){
    var g=d.gl,f=frame.field,N=f.width*f.height,count=frame.lights.length,scale=finite(f.weightScale)?f.weightScale:2,cols=Math.max(1,Math.min(count,Math.floor(d.maxTexture/f.width))),rows=Math.ceil(count/cols),ww=f.width*cols,wh=f.height*rows;
    if(ww>d.maxTexture||wh>d.maxTexture)throw Object.assign(Error('Native admitted-light atlas exceeds GPU capacity'),{nativeLightingCapacity:true});
    if(!d.weightBytes||d.weightBytes.length!==ww*wh)d.weightBytes=new Uint8Array(ww*wh);else d.weightBytes.fill(0);
    if(!d.nativeData||d.nativeData.length!==N*4){d.nativeData=new Float32Array(N*4);d.ambientData=new Float32Array(N*4);}
    var lcols=Math.max(1,Math.min(count,d.maxTexture)),lrows=Math.ceil(count/lcols)*2;if(lrows>d.maxTexture)throw Object.assign(Error('Native light data exceeds GPU capacity'),{nativeLightingCapacity:true});if(!d.lightData||d.lightData.length!==lcols*lrows*4)d.lightData=new Float32Array(lcols*lrows*4);else d.lightData.fill(0);
    for(var k=0;k<count;k++){
      var light=frame.lights[k],c=light.c||light.color||[1,1,1],li=(Math.floor(k/lcols)*2*lcols+k%lcols)*4;d.lightData[li]=light.x;d.lightData[li+1]=light.y;d.lightData[li+2]=finite(light.height)?light.height:finite(light.z)?light.z:(k===0?.8:1.1);li+=lcols*4;d.lightData[li]=c[0];d.lightData[li+1]=c[1];d.lightData[li+2]=c[2];
      var ax=(k%cols)*f.width,ay=Math.floor(k/cols)*f.height;for(var y=0;y<f.height;y++)d.weightBytes.set(f.weights.subarray?f.weights.subarray(k*N+y*f.width,k*N+(y+1)*f.width):f.weights.slice(k*N+y*f.width,k*N+(y+1)*f.width),(ay+y)*ww+ax);
    }
    var live=0;
    for(var i=0;i<N;i++){
      var p=i*4,q=i*3,visible=!f.visible||!!f.visible[i],sum=null;
      if(!f.ambient||!f.illumination){sum=[0,0,0];for(var k=0;k<count;k++){var c=frame.lights[k].c||frame.lights[k].color||[1,1,1],w=f.weights[k*N+i]*scale/255;for(var j=0;j<3;j++)sum[j]+=w*c[j];}}
      for(var j=0;j<3;j++){var native=f.illumination?f.illumination[q+j]:sum[j]+.25;d.nativeData[p+j]=clamp(native,0,1);d.ambientData[p+j]=f.ambient?Math.max(0,f.ambient[q+j]):Math.max(0,native-sum[j]);}
      d.nativeData[p+3]=visible?1:0;d.ambientData[p+3]=1;if(visible)live++;
    }
    selectFieldLayout(d,f.width,f.height,ww,wh,lcols,lrows);
    uploadField(d,'weights',2,g.R8,ww,wh,g.RED,g.UNSIGNED_BYTE,d.weightBytes);
    uploadField(d,'lights',3,g.RGBA32F,lcols,lrows,g.RGBA,g.FLOAT,d.lightData);
    uploadField(d,'ambient',4,g.RGBA16F,f.width,f.height,g.RGBA,g.FLOAT,d.ambientData);
    uploadField(d,'native',5,g.RGBA16F,f.width,f.height,g.RGBA,g.FLOAT,d.nativeData);
    return {live:live,weightColumns:cols,weightWidth:ww,weightHeight:wh,lightColumns:lcols};
  }
  function transformPoint(m,x,y){return [m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]];}
  function clipBounds(r){if(!r.clip)return null;var c=r.clip,p=[[c.x,c.y],[c.x+c.w,c.y],[c.x,c.y+c.h],[c.x+c.w,c.y+c.h]].map(function(v){return transformPoint(r.matrix,v[0],v[1]);});return [Math.min.apply(null,p.map(function(v){return v[0];})),Math.min.apply(null,p.map(function(v){return v[1];})),Math.max.apply(null,p.map(function(v){return v[0];})),Math.max.apply(null,p.map(function(v){return v[1];}))];}
  function makeBatches(d,list,dx,dy){
    var batches=[],current=null,mapped=0,fallback=0;
    list.forEach(function(r){
      if(r.layer)throw Error('Nested native lighting layer requires explicit flattening');var tex=recordTexture(d,r);if(!tex)return;var m=r.matrix,b=r.rect,n=r.normal,s=r.surface||{},kind=s.kind||'ground',normalKind=kind==='unlit'?4:kind==='actor'?3:n&&n.kind==='wall'?1:n&&n.kind==='sprite'?2:kind==='wall'?1:kind==='sprite'?2:0,clip=clipBounds(r),bounds=tex.atlas?[(n.sx+.5)/tex.width,(n.sy+.5)/tex.height,(n.sx+n.sw-.5)/tex.width,(n.sy+n.sh-.5)/tex.height]:[0,0,1,1];
      var key=tex.key+'|'+JSON.stringify(clip);if(!current||current.key!==key){current={key:key,record:r,tex:tex,bounds:bounds,clip:clip,points:[]};batches.push(current);}
      var lx=Math.hypot(m[0],m[1])||1,ly=Math.hypot(m[2],m[3])||1,fx=n&&n.flipX===-1?-1:1,fy=n&&n.flipY===-1?-1:1,b0=m[0]/lx*fx,b1=-m[1]/lx*fx,b2=-m[2]/ly*fy,b3=m[3]/ly*fy,inv=d.inverse,frame=d.frame;
      for(var corner=0;corner<CORNERS.length;corner+=2){
        var u=CORNERS[corner],v=CORNERS[corner+1],rx=b.x+u*b.w,ry=b.y+v*b.h,px=m[0]*rx+m[2]*ry+m[4],py=m[1]*rx+m[3]*ry+m[5],gx=px+dx,gy=py+dy;
        var wx=(inv[0]*gx+inv[3]*gy+inv[6])/frame.tileSize+frame.cameraX-.5,wy=(inv[1]*gx+inv[4]*gy+inv[7])/frame.tileSize+frame.cameraY-.5,z=finite(s.baseZ)?s.baseZ:0;
        if(kind==='wall'){if(finite(s.y))wy=s.y;z+=(finite(s.height)?s.height:0)*((finite(s.footV)?s.footV:1)-v);}
        else if(kind==='sprite'||kind==='actor'){if(finite(s.x))wx=s.x;if(finite(s.y))wy=s.y;if(finite(s.footY)&&finite(s.zPerPixel))z+=(s.footY-py)*s.zPerPixel;else z+=(finite(s.height)?s.height:0)*((finite(s.footV)?s.footV:1)-v);}
        var ax=finite(s.admissionX)?s.admissionX:wx,ay=finite(s.admissionY)?s.admissionY:wy;if(tex.atlas){u=(n.sx+(fx<0?1-u:u)*n.sw)/tex.width;v=(n.sy+(fy<0?1-v:v)*n.sh)/tex.height;}
        current.points.push(px,py,u,v,wx,wy,z,ax,ay,b0,b1,b2,b3,r.alpha,r.erase?1:0,normalKind,finite(s.selfLight)?clamp(s.selfLight,0,1):1,bounds[0],bounds[1],bounds[2],bounds[3],finite(s.emission)?clamp(s.emission,0,1):0);
      }if(n)mapped++;else fallback++;
    });
    batches.forEach(function(b){b.data=new Float32Array(b.points);delete b.points;b.count=b.data.length/STRIDE;});return {batches:batches,mapped:mapped,fallback:fallback};
  }
  function cachedGeometry(d,r){
    var e=d.geometryCache.get(r.layer);if(e){d.geometryCache.delete(r.layer);d.geometryCache.set(r.layer,e);return {entry:e,hit:true};}
    e=makeBatches(d,r.layer,r.dx,r.dy);e.bytes=e.batches.reduce(function(n,b){return n+b.data.byteLength;},0);
    // Oversized layers use the existing stream buffer. Cached buffers remain
    // alive until the whole ordered pass finishes, including multiple layers.
    if(e.bytes>GEOMETRY_BUDGET)return {entry:e,hit:false};
    e.batches.forEach(function(b){b.buffer=d.gl.createBuffer();d.gl.bindBuffer(d.gl.ARRAY_BUFFER,b.buffer);d.gl.bufferData(d.gl.ARRAY_BUFFER,b.data,d.gl.STATIC_DRAW);b.vao=vertexArray(d,d.surfaceLoc,b.buffer,SURFACE_LAYOUT,STRIDE);});d.geometryCache.set(r.layer,e);d.geometryBytes+=e.bytes;return {entry:e,hit:false};
  }
  function drawBatches(d,set,dx,dy){
    var g=d.gl,l=d.surfaceLoc,calls=0;g.uniform2f(l.u_offset,dx,dy);
    set.batches.forEach(function(b){var t=b.tex;bindTexture(d,0,t.texture);bindTexture(d,1,t.mask||t.texture);g.uniform1i(l.u_hasNormal,t.hasNormal?1:0);g.uniform1i(l.u_opaque,t.atlas||t.opaque?1:0);g.uniform1i(l.u_mirroredRepeat,t.mirroredRepeat?1:0);
      if(b.clip){var c=b.clip,x=Math.max(0,Math.floor(c[0]+dx)),y=Math.max(0,Math.floor(c[1]+dy)),right=Math.min(d.width,Math.ceil(c[2]+dx)),bottom=Math.min(d.height,Math.ceil(c[3]+dy));if(right<=x||bottom<=y)return;g.enable(g.SCISSOR_TEST);g.scissor(x,d.height-bottom,right-x,bottom-y);}else g.disable(g.SCISSOR_TEST);
      g.bindVertexArray(b.vao||d.streamVAO);g.drawArrays(g.TRIANGLES,b.buffer?0:b.first,b.count);calls++;
    });g.disable(g.SCISSOR_TEST);return calls;
  }
  function uniformField(d,l){var g=d.gl,f=d.frame.field;g.uniform2f(l.u_origin,f.originX,f.originY);g.uniform2f(l.u_fieldSize,f.width,f.height);g.uniform1f(l.u_samples,f.samplesPerTile);g.uniform1f(l.u_storageScale,d.storageScale);}
  function preparePass(d,list){
    var commands=[],mapped=0,fallback=0,hits=0,misses=0,pending=[];d.prefetch=[];
    function stage(set,dx,dy){set.batches.forEach(function(b){var t=b.tex.shared?b.tex:d.cache.get(b.tex.key);if(!t)t=recordTexture(d,b.record);else if(!b.tex.shared){d.cache.delete(b.tex.key);d.cache.set(b.tex.key,t);}if(!t)throw Object.assign(Error('Native surface texture unavailable'),{nativeLightingCapacity:true});b.tex=t;});mapped+=set.mapped;fallback+=set.fallback;commands.push({set:set,dx:dx,dy:dy});}
    function flush(){if(pending.length){stage(makeBatches(d,pending,0,0),0,0);pending=[];}}
    list.forEach(function(r){if(!r.layer){pending.push(r);return;}flush();var c=cachedGeometry(d,r);if(c.hit)hits++;else misses++;stage(c.entry,r.dx,r.dy);});flush();
    // Never evict or upload a texture while surface draws are in flight. If an
    // unusually large visible scene exceeds the bounded cache, keep native light.
    commands.forEach(function(c){c.set.batches.forEach(function(b){if(!b.tex.shared&&d.cache.get(b.tex.key)!==b.tex)throw Object.assign(Error('Native surface texture budget exceeded'),{nativeLightingCapacity:true});});});
    // Batch optional cold imports behind this pass's single resource check.
    // recordTexture's preparing path cannot evict any existing texture.
    var prefetch=d.prefetch;d.prefetch=null;prefetch.forEach(function(r){
      var count=r.normal?18:r.art.prefetchFrames,cold=[];for(var i=0;i<count;i++){
        if(d.cache.size>=MAX_TEXTURES||d.cacheBytes+r.art.sw*r.art.sh*(r.normal?7:4)>TEXTURE_BUDGET)break;
        var sx=r.normal?i%9*128:i*r.art.sw,sy=r.normal?Math.floor(i/9)*128+2048:r.art.sy;if(sx===r.art.sx&&sy===r.art.sy)continue;
        var uploads=d.frameUploads,t=recordTexture(d,{art:Object.assign({},r.art,{sx:sx,sy:sy}),normal:r.normal?Object.assign({},r.normal,{sx:sx,sy:sy-2048}):null},true);if(t&&d.frameUploads>uploads)cold.push([t.key,t]);
      }
      // Unused optional crops are the first eviction candidates. Their first
      // real draw promotes them through the ordinary cache-hit path.
      if(cold.length){var cache=new Map(cold);d.cache.forEach(function(t,key){cache.set(key,t);});d.cache=cache;}
    });
    // Upload moving records once; draw their ranges in the original order,
    // including where cached terrain layers intervene. No alpha sorting.
    var floats=0;commands.forEach(function(c){c.set.batches.forEach(function(b){if(!b.buffer)floats+=b.data.length;});});
    if(floats){
      if(!d.streamData||d.streamData.length<floats)d.streamData=new Float32Array(Math.max(floats,d.streamData?d.streamData.length*2:4096));
      var offset=0;commands.forEach(function(c){c.set.batches.forEach(function(b){if(!b.buffer){b.first=offset/STRIDE;d.streamData.set(b.data,offset);offset+=b.data.length;}});});
      d.gl.bindBuffer(d.gl.ARRAY_BUFFER,d.streamBuffer);d.gl.bufferData(d.gl.ARRAY_BUFFER,d.streamData.subarray(0,floats),d.gl.STREAM_DRAW);d.frameGeometryUploads=1;
    }
    return {commands:commands,mapped:mapped,fallback:fallback,cacheHit:hits>0&&misses===0};
  }
  function shade(d,pass,fields){
    var g=d.gl,frame=d.frame,f=frame.field,l=d.backgroundLoc;g.bindFramebuffer(g.FRAMEBUFFER,d.framebuffer);g.viewport(0,0,d.width,d.height);g.disable(g.BLEND);g.useProgram(d.background);fullscreen(d,l);bindTexture(d,5,d.native);g.uniform1i(l.u_native,5);g.uniform2f(l.u_canvas,d.width,d.height);g.uniform2f(l.u_camera,frame.cameraX,frame.cameraY);g.uniform1f(l.u_tileSize,frame.tileSize);g.uniformMatrix3fv(l.u_inverse,false,d.inverse);uniformField(d,l);g.drawArrays(g.TRIANGLES,0,6);
    g.useProgram(d.surface);l=d.surfaceLoc;g.uniform1i(l.u_normal,0);g.uniform1i(l.u_mask,1);g.uniform1i(l.u_weights,2);g.uniform1i(l.u_lights,3);g.uniform1i(l.u_ambient,4);g.uniform1i(l.u_native,5);g.uniform1i(l.u_lightCount,frame.lights.length);g.uniform1i(l.u_lightColumns,fields.lightColumns);g.uniform1i(l.u_weightColumns,fields.weightColumns);g.uniform2f(l.u_weightSize,fields.weightWidth,fields.weightHeight);g.uniform1f(l.u_weightScale,finite(f.weightScale)?f.weightScale:2);g.uniform1f(l.u_relief,finite(frame.relief)?clamp(frame.relief,0,1.5):relief);g.uniform2f(l.u_canvas,d.width,d.height);uniformField(d,l);g.enable(g.BLEND);g.blendFunc(g.ONE,g.ONE_MINUS_SRC_ALPHA);
    var calls=1;pass.commands.forEach(function(c){calls+=drawBatches(d,c.set,c.dx,c.dy);});g.disable(g.BLEND);g.bindFramebuffer(g.FRAMEBUFFER,null);return {mapped:pass.mapped,fallback:pass.fallback,drawCalls:calls,cacheHit:pass.cacheHit};
  }
  function validFrame(frame){var f=frame&&frame.field;return !!(frame&&finite(frame.tileSize)&&frame.tileSize>0&&finite(frame.cameraX)&&finite(frame.cameraY)&&Array.isArray(frame.lights)&&frame.lights.length>0&&f&&Number.isInteger(f.width)&&Number.isInteger(f.height)&&f.width>0&&f.height>0&&finite(f.originX)&&finite(f.originY)&&finite(f.samplesPerTile)&&f.samplesPerTile>0&&f.weights&&f.weights.length===frame.lights.length*f.width*f.height&&(!f.visible||f.visible.length===f.width*f.height)&&(!f.illumination||f.illumination.length===f.width*f.height*3)&&(!f.ambient||f.ambient.length===f.width*f.height*3));}
  function render(ctx,frame){
    stats.frames++;var started=performance.now(),list=frame&&frame.records||records;end();if(!ctx||!enabled()||!validFrame(frame)||finite(frame.relief)&&frame.relief<=0){stats.fallbacks++;return false;}
    var d=device,g=d.gl,canvas=ctx.canvas;
    try{
      d.frameUploads=0;d.frameEvictions=0;d.frameUploadMS=0;d.frameGeometryUploads=0;d.frameFieldTextureAllocations=0;if(g.isContextLost()||!canvas.width||!canvas.height||canvas.width>d.maxTexture||canvas.height>d.maxTexture){stats.fallbacks++;return false;}
      var m=matrix(ctx),det=m[0]*m[3]-m[1]*m[2];if(!finite(det)||Math.abs(det)<1e-8){stats.fallbacks++;return false;}d.frame=frame;d.inverse=new Float32Array([m[3]/det,-m[1]/det,0,-m[2]/det,m[0]/det,0,(m[2]*m[5]-m[3]*m[4])/det,(m[1]*m[4]-m[0]*m[5])/det,1]);
      var resized=canvas.width!==d.width||canvas.height!==d.height;resize(d,canvas.width,canvas.height);var fields=prepareFields(d,frame),normalStart=performance.now(),pass=preparePass(d,list);
      // Check allocations before importing the current Canvas, so this resource
      // boundary does not also wait for the full frame's queued native paint.
      if(resized||d.frameUploads||d.frameFieldTextureAllocations||stats.composites===0){var error=g.getError();if(error!==g.NO_ERROR)throw Error('Native surface GL resource error '+error);}
      var sourceStart=performance.now();bindTexture(d,0,d.source);g.texSubImage2D(g.TEXTURE_2D,0,0,0,g.RGBA,g.UNSIGNED_BYTE,canvas);var sourceMS=performance.now()-sourceStart;
      var coverage=shade(d,pass,fields),normalMS=performance.now()-normalStart-sourceMS;
      g.useProgram(d.final);g.viewport(0,0,d.width,d.height);fullscreen(d,d.finalLoc);bindTexture(d,0,d.source);bindTexture(d,1,d.irradiance);g.uniform1i(d.finalLoc.u_color,0);g.uniform1i(d.finalLoc.u_irradiance,1);g.uniform1f(d.finalLoc.u_storageScale,d.storageScale);g.drawArrays(g.TRIANGLES,0,6);if(g.isContextLost()){stats.fallbacks++;return false;}
      var copyStart=performance.now();ctx.save();try{ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;ctx.globalCompositeOperation='copy';if('filter'in ctx)ctx.filter='none';ctx.shadowColor='rgba(0,0,0,0)';ctx.drawImage(d.canvas,0,0);}finally{ctx.restore();}var copyMS=performance.now()-copyStart;
      stats.composites++;stats.last={nativeLights:frame.lights.length,admittedSamples:fields.live,fieldSamples:frame.field.width*frame.field.height,records:list.reduce(function(n,r){return n+(r.layer?r.layer.length:1);},0),mapped:coverage.mapped,erased:coverage.fallback,normalDrawCalls:coverage.drawCalls,dynamicGeometryUploads:d.frameGeometryUploads,fieldTextureAllocations:d.frameFieldTextureAllocations,sourceMS:sourceMS,normalMS:normalMS,copyMS:copyMS,textureUploads:d.frameUploads,textureUploadMS:d.frameUploadMS,textureEvictions:d.frameEvictions,layerCacheHit:coverage.cacheHit,layerCacheBytes:d.geometryBytes,cacheTextures:d.cache.size,cacheBytes:d.cacheBytes,width:d.width,height:d.height,ms:performance.now()-started,mode:'native-forward-irradiance',floatIrradiance:d.floatTarget};return true;
    }catch(error){note(error);clearFieldSpare(d);if(!error.nativeLightingCapacity){dispose(d);device=null;failed=true;}stats.fallbacks++;return false;}
    finally{d.prefetch=null;if(device===d)trimGeometry(d);}
  }
  function diagnostics(){return {requested:requested,enabled:requested&&relief>0&&(typeof lightingOn!=='function'||lightingOn())&&!failed&&!lost&&!!device,available:!!device&&!failed&&!lost,lost:lost,failed:failed,relief:relief,frames:stats.frames,composites:stats.composites,fallbacks:stats.fallbacks,contextLosses:stats.contextLosses,last:stats.last&&Object.assign({},stats.last),errors:stats.errors.slice(),coverage:'Native forward irradiance: every admitted source uses its own colored Lambert term and explicit receiver position. Exact registered NiRNE normals; flat native surfaces elsewhere.'};}
  root.FoteNormalLighting=Object.freeze({enabled:enabled,available:available,setEnabled:setEnabled,setRelief:setRelief,begin:begin,end:end,record:record,invalidate:invalidate,captureLayer:captureLayer,finishLayer:finishLayer,appendLayer:appendLayer,render:render,diagnostics:diagnostics,contextForTesting:function(){return initialize()?device.gl:null;}});
})(globalThis);

;
/* js/world/chaos/chaos-preview.js */
/* Local Prism Archives layout. Uses the existing floor, doors, props and portal
 * tiles; launch controls, rendering and action timing remain with their owners. */
(function(root){
  'use strict';
  var capturing=false;
  function active(){return floorMeta&&floorMeta.chaosPreview||null;}
  function onLand(x,y){var preview=active();return !!(preview&&inb(x,y)&&preview.landMask[idxOf(x,y)]);}
  function regionAt(x,y){var preview=active();return preview&&inb(x,y)?preview.regionByCell[idxOf(x,y)]||null:null;}
  function atPortal(x,y){var preview=active();return preview&&at(x,y)===PORTAL?preview.portals.find(function(p){return x>=p.x&&x<p.x+(p.w||1)&&y>=p.y&&y<p.y+(p.h||1);})||null:null;}

  function resetMotion(entity){
    entity._lx=undefined;entity._ly=undefined;delete entity._clip;
    if(typeof MOTION_STATE!=='undefined')MOTION_STATE.delete(entity);
  }
  function clearPresentation(){
    if(typeof stopTravel==='function')stopTravel();
    if(typeof PACING!=='undefined')PACING.pending=null;
    if(typeof fx!=='undefined')fx=[];
    if(typeof PARTS!=='undefined')PARTS.length=0;
    if(typeof fxClock!=='undefined')fxClock=0;
    if(typeof aiming!=='undefined')aiming=null;
    if(typeof BOWAIM!=='undefined')BOWAIM=null;
    if(typeof hoverX!=='undefined')hoverX=-1;
    if(typeof hoverY!=='undefined')hoverY=-1;
    if(typeof camX!=='undefined')camX=Math.max(0,Math.min(MW-viewW,player.x-(viewW>>1)));
    if(typeof camY!=='undefined')camY=Math.max(0,Math.min(MH-viewH,player.y-(viewH>>1)));
    if(typeof camOX!=='undefined')camOX=0;
    if(typeof camOY!=='undefined')camOY=0;
  }

  // Authored layouts share only installation, safe scenery and portal plumbing.
  // Floor generation and each biome's geometry remain with their own module.
  function begin(definition,seed){
    if(!player)throw new Error('Create the preview character before building '+definition.name+'.');
    if(typeof gameTurns!=='undefined'&&gameTurns.busy())throw new Error('Finish the current turn before building the preview.');
    if(definition.width&&definition.height){
      if(typeof setMapDimensions!=='function')throw new Error('Map dimensions must be installed before the combined Chaos preview.');
      setMapDimensions(definition.width,definition.height);
    }else if(typeof resetMapDimensions==='function')resetMapDimensions();
    if(MW<54||MH<33)throw new Error(definition.name+' requires at least the existing 56 by 34 floor.');
    seed=Number.isFinite(seed)?seed>>>0:92421;
    var size=MW*MH;
    floorNo=21;worldSeed=seed;
    map=new Uint8Array(size).fill(CHASM);seen=new Uint8Array(size);vis=new Uint8Array(size);
    ground=new Uint8Array(size);fireT=new Uint8Array(size);
    if(typeof fireSrc!=='undefined')fireSrc=new Uint8Array(size);
    props=[];propGrid=new Int16Array(size).fill(-1);feats=[];items=[];ents=[player];rooms=[];
    chestKind={};levers=[];plates=null;altars={};groundReset();
    // The ordinary wandering-spawn cap is 3+floorNo, so this is permanent.
    spawnedExtra=99;nextSpawn=1e9;
    var preview={version:2,biome:definition.biome,name:definition.name,seed:seed,
      regions:[],portals:[],focals:[],landmarks:[],decor:[],landMask:new Array(size).fill(0),regionByCell:new Array(size).fill(null),
      spawn:{x:definition.spawn.x,y:definition.spawn.y},currentRegion:definition.regionId,visits:{}};
    preview.visits[definition.regionId]=1;
    floorMeta={floor:floorNo,biome:4,boss:false,forge:false,shrine:false,portal:'light',portalUsed:false,impassableVoid:true,
      exitOpen:false,keyHolder:false,notes:[definition.name+': '+(definition.islandCount===5?'five':'three')+' islands linked by paired portals.','The void cannot be crossed.'],puzzles:[],searched:{},planeLights:[],chaosPreview:preview};
    return preview;
  }
  function finish(preview){
    if(capturing)return preview;
    player.x=preview.spawn.x;player.y=preview.spawn.y;player.keys={iron:0,crystal:0};
    function present(){resetMotion(player);clearPresentation();if(typeof resetGeneratedSurface==='function')resetGeneratedSurface(preview.seed);}
    if(typeof afterGeneratedInstall==='function')afterGeneratedInstall(present);else present();
    return preview;
  }
  // Read an approved authored layout without moving the live character or
  // clearing presentation. Restore every temporary floor reference even when
  // authoring fails; only the final composed installation invalidates caches.
  function capture(builder,seed){
    if(capturing)throw new Error('Nested Chaos layout capture is not supported.');
    var keys=['MW','MH','floorNo','worldSeed','map','seen','vis','ground','fireT','fireSrc','props','propGrid','feats','items','ents','rooms','chestKind','levers','plates','altars','iceG','rootG','holyG','spawnedExtra','nextSpawn','floorMeta','rng'];
    var saved=keys.map(function(key){return {key:key,exists:Object.prototype.hasOwnProperty.call(root,key),value:root[key]};});
    capturing=true;
    try{
      root.rng=mulberry32((seed>>>0)^0x43617074);
      var preview=builder(seed);
      return JSON.parse(JSON.stringify({preview:preview,map:Array.from(map),props:props,rooms:rooms,planeLights:floorMeta.planeLights,width:MW,height:MH}));
    }finally{
      saved.forEach(function(entry){if(entry.exists)root[entry.key]=entry.value;else delete root[entry.key];});
      capturing=false;
    }
  }
  function scenery(preview,x,y,name,extra,w,h){
    if(!onLand(x,y)||at(x,y)!==FLOOR)throw new Error('Invalid preview prop placement: '+name+' at '+x+','+y);
    var options=Object.assign({keep:true,burn:0,br:0,loot:0,ex:0,altar:0,drink:0,melt:0,web:0,previewDecor:true},extra||{});
    // Barrel art promises a breakable obstacle, including authored previews.
    if(name==='barrel'||/^barrel-/.test(name))options.br=1;
    var placed=w?addSetPiece(x,y,name,w,h,options):addProp(x,y,name,options);
    if(!placed)throw new Error('Could not place preview prop '+name+'.');
    preview.decor.push({kind:name,regionId:regionAt(x,y),x:x,y:y,w:w||1,h:h||1,variant:(preview.seed+x*17+y*31)%4});
    return placed;
  }
  function portal(preview,artName,id,pairId,regionId,x,y,arrival,destinationId,label){
    for(var yy=y;yy<y+2;yy++)for(var xx=x;xx<x+2;xx++){
      if(!onLand(xx,yy)||regionAt(xx,yy)!==regionId||at(xx,yy)!==FLOOR||propAt(xx,yy))throw new Error('Invalid preview portal placement.');
    }
    var endpoint={id:id,pairId:pairId,regionId:regionId,x:x,y:y,w:2,h:2,arrival:arrival,destinationId:destinationId,label:label};
    scenery(preview,x,y,artName,{artName:artName,previewPortal:id,previewLabel:label,b:0,flat:0,noShadow:true},2,2);
    for(var py=y;py<y+2;py++)for(var px=x;px<x+2;px++)map[idxOf(px,py)]=PORTAL;
    preview.portals.push(endpoint);return endpoint;
  }
  function build(seed){
    var preview=begin({biome:'prism-archives',name:'Prism Archives',spawn:{x:8,y:9},regionId:'index-court'},seed);
    seed=preview.seed;
    var focalChoices=[{artName:'prism-lens',label:'Crystal lens'},{artName:'prism-astrolabe',label:'Astral astrolabe'},
      {artName:'prism-lectern',label:'Floating-book lectern'},{artName:'prism-tree',label:'Prism tree'}];
    // Use an independent seeded stream: scenery selection never consumes the
    // gameplay random sequence, and an island cannot repeat another's focal.
    var choose=mulberry32(seed^0x50726973);
    for(var choice=focalChoices.length-1;choice>0;choice--){var swap=Math.floor(choose()*(choice+1)),held=focalChoices[choice];focalChoices[choice]=focalChoices[swap];focalChoices[swap]=held;}

    function rect(x,y,w,h,fn){for(var yy=y;yy<y+h;yy++)for(var xx=x;xx<x+w;xx++)fn(xx,yy);}
    function region(id,name,bounds,footprints,spawn,height){
      var entry={id:id,name:name,bounds:bounds,height:height,spawn:spawn,palette:'prism'};preview.regions.push(entry);
      footprints.forEach(function(r){rect(r[0],r[1],r[2],r[3],function(x,y){
        var i=idxOf(x,y);if(preview.regionByCell[i]&&preview.regionByCell[i]!==id)throw new Error('Preview islands overlap.');
        map[i]=FLOOR;preview.landMask[i]=1;preview.regionByCell[i]=id;
      });});return entry;
    }
    function room(id,regionId,name,x,y,w,h,doors){
      rooms.push({id:rooms.length,x:x,y:y,w:w,h:h,cx:x+(w>>1),cy:y+(h>>1),special:'library',previewId:id,regionId:regionId});
      rect(x,y,w,h,function(xx,yy){if(xx===x||yy===y||xx===x+w-1||yy===y+h-1)map[idxOf(xx,yy)]=WALL;});
      doors.forEach(function(d){map[idxOf(d[0],d[1])]=DOOR;});
      preview.landmarks.push({id:id,kind:'room',regionId:regionId,x:x,y:y,w:w,h:h,label:name});
    }
    function prop(x,y,name,extra,w,h){
      // Archive furniture is scenery: it cannot burn, break, produce loot or
      // inherit an interactive shrine/fountain effect from its artwork.
      var options=Object.assign({keep:true,burn:0,br:0,loot:0,ex:0,altar:0,drink:0,melt:0,web:0,previewDecor:true},extra||{});
      if(name==='bookshelf'){options.artName='prism-bookcase';options.previewLabel='Prism bookcase';}
      return scenery(preview,x,y,name,options,w,h);
    }
    function line(x,y,n,dx,dy,name){for(var i=0;i<n;i++)prop(x+i*dx,y+i*dy,name);}
    function light(x,y,col,r){floorMeta.planeLights.push({x:x,y:y,col:col,r:r||3.1,s:.55});}
    function focal(x,y){
      var selected=focalChoices[preview.focals.length];
      prop(x,y,'prism-focal',{artName:selected.artName,previewLabel:selected.label,previewFocal:true,b:1,flat:0,noShadow:true},2,2);
      preview.focals.push({regionId:regionAt(x,y),x:x,y:y,w:2,h:2,artName:selected.artName,label:selected.label});
    }
    function prismPortal(id,pairId,regionId,x,y,arrival,destinationId,label){
      return portal(preview,'prism-portal',id,pairId,regionId,x,y,arrival,destinationId,label);
    }

    // Index Court: a reading hall surrounded by open galleries. The Prism
    // Atelier is a small annex reached by an exposed, three-tile land bridge.
    region('index-court','Index Court',{x:3,y:2,w:21,h:14},
      [[3,4,12,10],[5,2,8,2],[5,14,8,2],[15,8,4,3],[19,6,5,7]],preview.spawn,3);
    room('reading-hall','index-court','The Reading Hall',5,5,8,8,[[5,9],[12,9],[8,5],[9,12]]);
    room('catalogue-alcove','index-court','Catalogue Alcove',6,2,6,4,[[8,5]]);
    room('lens-atelier','index-court','Prism Atelier',19,6,5,7,[[19,9]]);
    preview.landmarks.push({id:'lens-bridge',kind:'bridge',regionId:'index-court',x:14,y:8,w:6,h:3,label:'Atelier Causeway'});
    line(6,6,2,1,0,'bookshelf');line(10,6,2,1,0,'bookshelf');
    line(6,11,2,1,0,'bookshelf');line(10,11,2,1,0,'bookshelf');
    prop(8,8,'table-candle',{light:'#F0DCAB'});prop(10,9,'table-candle',{light:'#BBD8FF'});
    prop(7,3,'bookshelf');prop(10,3,'bookshelf');
    prop(3,5,'grave-pillar');prop(14,5,'grave-pillar');prop(3,12,'grave-pillar');prop(14,12,'grave-pillar');
    prop(6,14,'crystal-gold-small');prop(11,14,'crystal-water-small');
    focal(20,7);prop(20,11,'crystal-water-small');prop(22,11,'crystal-gold-small');
    light(8,8,'#F3DFAD',4);light(21,8,'#9DD7FA',3.5);

    // Refraction Galleries: two long stacks with an open transverse court,
    // offset entrances and broad balconies at the north and south ends.
    region('refraction-galleries','Refraction Galleries',{x:34,y:1,w:20,h:17},
      [[37,3,15,13],[34,7,3,6],[40,1,9,2],[52,7,2,6],[40,16,9,2]],{x:36,y:10},4);
    room('upper-gallery','refraction-galleries','Spectrum Gallery',39,3,11,5,[[44,7],[48,7],[44,3]]);
    room('lower-gallery','refraction-galleries','The Mirrored Stacks',38,10,13,5,[[43,10],[45,10],[44,14]]);
    line(40,4,3,1,0,'bookshelf');line(45,4,3,1,0,'bookshelf');
    prop(40,6,'table-candle',{light:'#C6E6FE'});prop(46,6,'crystal-water-small');
    line(39,11,3,1,0,'bookshelf');line(46,11,4,1,0,'bookshelf');
    prop(39,13,'table-candle',{light:'#F1DBA5'});prop(46,13,'table-candle',{light:'#C6E6FE'});
    focal(42,16);
    prop(37,4,'grave-pillar');prop(51,4,'grave-pillar');prop(37,14,'grave-pillar');prop(51,14,'grave-pillar');
    prop(41,1,'crystal-water-small');prop(47,1,'crystal-gold-small');
    prop(41,17,'crystal-gold-small');prop(47,17,'crystal-water-small');
    prop(53,8,'statue');prop(53,11,'statue');
    light(44,8,'#C7E8FF',4);light(44,12,'#F1DDB6',3.5);

    // Astral Repository: a compact circular reading route around the raised
    // index, with two open side wings and recessed shelves at every corner.
    region('astral-repository','Astral Repository',{x:18,y:22,w:22,h:11},
      [[21,22,16,11],[18,25,3,5],[37,25,3,5]],{x:37,y:27},5);
    room('great-index','astral-repository','The Great Index',25,24,9,7,[[25,27],[33,27],[29,24],[29,30]]);
    focal(28,26);
    prop(26,25,'bookshelf');prop(32,25,'bookshelf');prop(26,29,'bookshelf');prop(32,29,'bookshelf');
    line(22,23,2,1,0,'bookshelf');line(35,23,2,0,1,'bookshelf');
    line(22,31,2,1,0,'bookshelf');line(35,30,2,0,1,'bookshelf');
    prop(22,26,'table-candle',{light:'#C6E6FE'});prop(35,28,'table-candle',{light:'#F1DBA5'});
    prop(18,25,'crystal-gold-small');prop(18,29,'crystal-water-small');
    prop(27,22,'grave-pillar');prop(31,22,'grave-pillar');prop(27,32,'grave-pillar');prop(31,32,'grave-pillar');
    light(29,27,'#E7DEFF',4.2);light(22,27,'#9FDFFF',3);

    prismPortal('index-gate','index-gallery','index-court',21,9,{x:20,y:9},'gallery-west','To Refraction Galleries');
    prismPortal('gallery-west','index-gallery','refraction-galleries',34,9,{x:36,y:10},'index-gate','To Index Court');
    prismPortal('gallery-east','gallery-repository','refraction-galleries',47,5,{x:46,y:5},'repository-gate','To Astral Repository');
    prismPortal('repository-gate','gallery-repository','astral-repository',38,26,{x:37,y:27},'gallery-east','To Refraction Galleries');
    return finish(preview);
  }

  function legalArrival(x,y,regionId,reserved){
    if(!onLand(x,y)||regionAt(x,y)!==regionId||reserved.has(idxOf(x,y)))return false;
    if(at(x,y)!==FLOOR&&at(x,y)!==OPEN)return false;
    return !propAt(x,y);
  }
  function travelPortal(value){
    var preview=active();if(!preview)return false;
    if(typeof gameTurns!=='undefined'&&gameTurns.busy())return false;
    var id=typeof value==='string'?value:value&&value.id;
    var source=preview.portals.find(function(p){return p.id===id;});
    if(!source||atPortal(player.x,player.y)!==source)return false;
    var destination=preview.portals.find(function(p){return p.id===source.destinationId;});
    if(!destination||destination.destinationId!==source.id)return false;
    var reserved=new Set(ents.filter(function(e){return e!==player&&e.hp>0;}).map(function(e){return idxOf(e.x,e.y);})),arrival=destination.arrival;
    if(!legalArrival(arrival.x,arrival.y,destination.regionId,reserved)){
      var alternatives=[];
      for(var ay=0;ay<MH;ay++)for(var ax=0;ax<MW;ax++)if(legalArrival(ax,ay,destination.regionId,reserved))alternatives.push({x:ax,y:ay});
      alternatives.sort(function(a,b){return Math.abs(a.x-arrival.x)+Math.abs(a.y-arrival.y)-Math.abs(b.x-arrival.x)-Math.abs(b.y-arrival.y)||a.y-b.y||a.x-b.x;});
      if(!alternatives.length)return false;arrival=alternatives[0];
    }
    var from={x:player.x,y:player.y};player.x=arrival.x;player.y=arrival.y;reserved.add(idxOf(player.x,player.y));resetMotion(player);
    // Reserve existing creatures as well as each selected arrival. Releasing
    // one companion's old cell never opens another creature's occupied cell.
    ents.filter(function(e){return e!==player&&e.ally&&e.hp>0;}).forEach(function(e){
      var old=idxOf(e.x,e.y);if(!ents.some(function(other){return other!==e&&other.hp>0&&other.x===e.x&&other.y===e.y;}))reserved.delete(old);
      var cells=[];
      for(var y=0;y<MH;y++)for(var x=0;x<MW;x++)if(legalArrival(x,y,destination.regionId,reserved))cells.push({x:x,y:y});
      cells.sort(function(a,b){return Math.abs(a.x-player.x)+Math.abs(a.y-player.y)-Math.abs(b.x-player.x)-Math.abs(b.y-player.y)||a.y-b.y||a.x-b.x;});
      if(!cells.length){reserved.add(old);return;}
      e.x=cells[0].x;e.y=cells[0].y;e.t=player.t;reserved.add(idxOf(e.x,e.y));resetMotion(e);
    });
    preview.currentRegion=destination.regionId;preview.visits[destination.regionId]=(preview.visits[destination.regionId]||0)+1;
    clearPresentation();
    // The caller spends one action after leaving the current entry callback.
    // No floor is regenerated, and seen/vis/map remain the same objects.
    return {from:from,to:{x:player.x,y:player.y},portal:source,destination:destination,spentAction:true};
  }
  root.FoteChaosPreview=Object.freeze({active:active,onLand:onLand,regionAt:regionAt,build:build,atPortal:atPortal,travelPortal:travelPortal,
    authoring:Object.freeze({begin:begin,finish:finish,scenery:scenery,portal:portal,capture:capture})});
})(typeof window!=='undefined'?window:globalThis);

;
/* js/world/chaos/rot-preview.js */
/* Rot Hollows: an authored Chaos island layout using the shared preview
 * installer and portal runtime. Pools, moss and hanging roots are cosmetic. */
(function(root){
  'use strict';
  function build(seed){
    var api=root.FoteChaosPreview,author=api&&api.authoring;
    if(!author)throw new Error('Load the shared Chaos preview before Rot Hollows.');
    var preview=author.begin({biome:'rot-hollows',name:'Rot Hollows',spawn:{x:7,y:11},regionId:'rootmouth-grotto'},seed);
    preview.mossMask=new Array(MW*MH).fill(0);preview.cosmeticPools=[];preview.tendrils=[];

    function region(id,name,rows,spawn,height){
      var minX=MW,minY=MH,maxX=0,maxY=0;
      rows.forEach(function(row){
        var y=row[0];
        for(var r=1;r<row.length;r+=2)for(var x=row[r];x<=row[r+1];x++){
          if(!inb(x,y)||preview.landMask[idxOf(x,y)])throw new Error('Invalid Rot Hollows island footprint.');
          var i=idxOf(x,y);map[i]=FLOOR;preview.landMask[i]=1;preview.regionByCell[i]=id;
          minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
        }
      });
      var bounds={x:minX,y:minY,w:maxX-minX+1,h:maxY-minY+1};
      preview.regions.push({id:id,name:name,bounds:bounds,height:height,spawn:spawn,palette:'rot'});
      rooms.push({id:rooms.length,x:bounds.x,y:bounds.y,w:bounds.w,h:bounds.h,cx:spawn.x,cy:spawn.y,special:'chaos-preview',previewId:id,regionId:id});
    }
    function walls(cells){cells.forEach(function(cell){
      if(!api.onLand(cell[0],cell[1]))throw new Error('Rot Hollows rock must remain on its island.');
      map[idxOf(cell[0],cell[1])]=WALL;
    });}
    function prop(x,y,name,extra,w,h){
      // Check the complete footprint, including flat walkable set pieces.
      for(var yy=y;yy<y+(h||1);yy++)for(var xx=x;xx<x+(w||1);xx++){
        if(!api.onLand(xx,yy)||at(xx,yy)!==FLOOR||propAt(xx,yy))throw new Error('Invalid Rot Hollows scenery: '+name+' at '+xx+','+yy);
      }
      return author.scenery(preview,x,y,name,Object.assign({light:null,b:0,flat:1},extra||{}),w,h);
    }
    function focal(x,y,artName,label,w,h,flat){
      prop(x,y,artName,{artName:artName,previewFocal:true,previewLabel:label,noShadow:true,b:flat?0:1,flat:flat?1:0},w,h);
      preview.focals.push({regionId:api.regionAt(x,y),x:x,y:y,w:w,h:h,artName:artName,label:label});
    }
    function pool(x,y,w,h,variant){preview.cosmeticPools.push({x:x,y:y,w:w,h:h,regionId:api.regionAt(x,y),variant:variant});}
    function tendril(x,y,toX,toY,variant){preview.tendrils.push({x:x,y:y,toX:toX,toY:toY,regionId:api.regionAt(x,y),variant:variant});}
    function portal(id,pairId,regionId,x,y,arrival,destinationId,label){
      var endpoint=author.portal(preview,'rot-portal',id,pairId,regionId,x,y,arrival,destinationId,label);
      propAt(x,y).light=null;return endpoint;
    }

    // Rootmouth's curved main grotto opens into a little spore annex. Its
    // exposed causeway is ordinary FLOOR, three cells wide throughout.
    region('rootmouth-grotto','Rootmouth Grotto',[
      [2,8,12],[3,5,14],[4,4,15],[5,3,16],[6,3,16],[7,2,16,22,24],
      [8,2,15,20,25],[9,3,25],[10,3,26],[11,3,26],[12,4,16,20,25],
      [13,4,15,21,24],[14,5,14],[15,6,13],[16,8,11]
    ],preview.spawn,3);
    walls([[8,2],[9,2],[10,2],[11,2],[12,2],[5,3],[6,3],[13,3],[14,3],
      [4,4],[15,4],[3,5],[16,5],[2,7],[2,8],[12,6],[13,6],[13,7],[14,7],
      [4,13],[5,14],[6,15],[13,15],[22,7],[24,7],[25,8]]);
    preview.landmarks.push({id:'rootmouth-annex',kind:'annex',regionId:'rootmouth-grotto',x:20,y:7,w:7,h:7,label:'The Spore Nook'});
    preview.landmarks.push({id:'rootmouth-bridge',kind:'bridge',regionId:'rootmouth-grotto',x:17,y:9,w:3,h:3,label:'Rootbound Causeway'});
    focal(7,6,'rot-canopy','Ancient shelfcap canopy',3,3,false);
    prop(4,6,'stalagmite-tall-3',{b:1,flat:0,previewLabel:'Ivory cave rock'});
    prop(11,4,'cl-small-mushrooms-3',{previewLabel:'Amber shelfcaps'});
    prop(5,9,'cl-small-mushrooms-4',{previewLabel:'Lime mushrooms'});
    prop(12,9,'vines',{previewLabel:'Exposed roots'});
    prop(5,12,'cl-rubble-2',{previewLabel:'Porous cave rubble'});
    prop(9,14,'cl-glow-moss-1',{previewLabel:'Luminous moss'});
    prop(14,11,'cl-small-mushrooms-2',{previewLabel:'Pale mushroom cluster'});
    prop(23,12,'cl-small-mushrooms-3',{previewLabel:'Amber shelfcaps'});
    prop(21,8,'vines',{previewLabel:'Annex roots'});
    pool(11,12,3,2,0);tendril(10,16,11,20,0);tendril(26,11,28,16,1);

    // Offset lobes leave a wide loop around the central rock crescent and
    // the walkable turquoise pool; both gates have clear approach aprons.
    region('shelfcap-hollow','Shelfcap Hollow',[
      [2,41,46],[3,38,49],[4,36,51],[5,35,52],[6,34,52],[7,33,53],
      [8,33,54],[9,34,54],[10,34,53],[11,35,53],[12,36,52],
      [13,36,51],[14,37,50],[15,39,49],[16,42,47]
    ],{x:36,y:8},4);
    walls([[41,2],[42,2],[43,2],[44,2],[45,2],[46,2],[38,3],[39,3],[48,3],[49,3],
      [36,4],[37,4],[51,4],[35,5],[52,5],[53,7],[54,8],[54,9],
      [41,6],[42,6],[42,7],[42,8],[41,8],[36,13],[37,14],[50,14],[49,15]]);
    focal(44,9,'rot-pool','Glowing spore pool',3,2,true);
    prop(39,5,'giant-mushroom-3',{b:1,flat:0,previewLabel:'Amber shelfcap'});
    prop(48,5,'cl-small-mushrooms-3',{previewLabel:'Shelfcap cluster'});
    prop(50,7,'stalagmite-tall-2',{b:1,flat:0,previewLabel:'Ivory cave rock'});
    prop(38,10,'vines',{previewLabel:'Creeping roots'});
    prop(39,13,'cl-small-mushrooms-4',{previewLabel:'Lime mushrooms'});
    prop(43,14,'cl-glow-moss-2',{previewLabel:'Luminous moss'});
    prop(50,13,'cl-rubble-1',{previewLabel:'Porous cave rubble'});
    prop(45,4,'vines',{previewLabel:'Shelf roots'});
    pool(44,9,3,2,1);tendril(46,16,45,20,2);tendril(51,13,54,18,0);

    // Puffball Basin spreads into broad scalloped shelves. The bent ivory
    // spine divides two winding routes that rejoin around the focal cluster.
    region('puffball-basin','Puffball Basin',[
      [21,25,32],[22,22,35],[23,20,37],[24,19,39],[25,17,40],[26,17,41],
      [27,18,41],[28,18,40],[29,19,39],[30,21,38],[31,23,36],[32,26,32]
    ],{x:37,y:27},5);
    walls([[25,21],[26,21],[27,21],[28,21],[29,21],[30,21],[31,21],[32,21],
      [22,22],[23,22],[34,22],[35,22],[20,23],[37,23],[19,24],[39,24],
      [17,25],[17,26],[18,28],[19,29],[21,30],[36,31],
      [25,25],[25,26],[26,26],[26,27],[27,27]]);
    focal(29,25,'rot-puffballs','Giant luminous puffballs',2,2,false);
    prop(23,24,'cl-small-mushrooms-4',{previewLabel:'Young puffballs'});
    prop(31,23,'cl-rubble-3',{previewLabel:'Porous cave rubble'});
    prop(20,26,'giant-mushroom-1',{b:1,flat:0,previewLabel:'Lime shelfcap'});
    prop(22,28,'vines',{previewLabel:'Basin roots'});
    prop(28,30,'cl-small-mushrooms-4',{previewLabel:'Young puffballs'});
    prop(35,30,'cl-glow-moss-3',{previewLabel:'Luminous moss'});
    prop(36,24,'stalagmite-tall-1',{b:1,flat:0,previewLabel:'Ivory cave rock'});
    pool(33,28,3,2,2);tendril(23,31,21,33,1);tendril(32,32,34,33,2);

    portal('rootmouth-gate','rootmouth-shelfcap','rootmouth-grotto',22,9,{x:21,y:10},'shelfcap-west','To Shelfcap Hollow');
    portal('shelfcap-west','rootmouth-shelfcap','shelfcap-hollow',34,7,{x:36,y:8},'rootmouth-gate','To Rootmouth Grotto');
    portal('shelfcap-east','shelfcap-puffball','shelfcap-hollow',48,11,{x:47,y:12},'puffball-gate','To Puffball Basin');
    portal('puffball-gate','shelfcap-puffball','puffball-basin',38,26,{x:37,y:27},'shelfcap-east','To Shelfcap Hollow');
    for(var y=0;y<MH;y++)for(var x=0;x<MW;x++)if(at(x,y)===FLOOR){
      preview.mossMask[idxOf(x,y)]=((Math.floor(x/3)*7+Math.floor(y/3)*11+preview.seed%17)%9)<3?1:0;
    }
    return author.finish(preview);
  }
  root.FoteRotPreview=Object.freeze({build:build});
})(typeof window!=='undefined'?window:globalThis);

;
/* js/world/chaos/cinder-preview.js */
/* Cinder Bastion: a local authored fortress on three floating islands.
 * Shared Chaos code owns movement, portal travel and the impassable void. */
(function(root){
  'use strict';
  function build(seed){
    var api=root.FoteChaosPreview,author=api&&api.authoring;
    if(!author)throw new Error('Load the shared Chaos preview before Cinder Bastion.');
    var preview=author.begin({biome:'cinder-bastion',name:'Cinder Bastion',spawn:{x:7,y:11},regionId:'mustering-hall'},seed);
    preview.cosmeticPools=[];preview.chains=[];
    // An independent stream varies a few focal positions without advancing
    // combat/loot RNG or changing the authored routes and portal arrivals.
    var choose=mulberry32(preview.seed^0x43696e64);
    function rect(x,y,w,h,visit){for(var yy=y;yy<y+h;yy++)for(var xx=x;xx<x+w;xx++)visit(xx,yy);}
    function region(id,name,footprints,spawn,height){
      var minX=MW,minY=MH,maxX=0,maxY=0;
      footprints.forEach(function(r){rect(r[0],r[1],r[2],r[3],function(x,y){
        var i=idxOf(x,y);
        if(!inb(x,y)||preview.landMask[i])throw new Error('Cinder Bastion island footprints overlap or leave the map.');
        map[i]=FLOOR;preview.landMask[i]=1;preview.regionByCell[i]=id;
        minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
      });});
      preview.regions.push({id:id,name:name,bounds:{x:minX,y:minY,w:maxX-minX+1,h:maxY-minY+1},spawn:spawn,height:height,palette:'cinder'});
    }
    function room(id,regionId,label,x,y,w,h,doors){
      rect(x,y,w,h,function(xx,yy){
        if(api.regionAt(xx,yy)!==regionId)throw new Error('Cinder Bastion room leaves its island at '+xx+','+yy+'.');
        if(xx===x||yy===y||xx===x+w-1||yy===y+h-1)map[idxOf(xx,yy)]=WALL;
      });
      doors.forEach(function(d){
        if(at(d[0],d[1])!==WALL)throw new Error('Cinder Bastion door requires a wall.');
        map[idxOf(d[0],d[1])]=DOOR;
      });
      rooms.push({id:rooms.length,x:x,y:y,w:w,h:h,cx:x+(w>>1),cy:y+(h>>1),special:'chaos-preview',previewId:id,regionId:regionId});
      preview.landmarks.push({id:id,kind:'room',regionId:regionId,x:x,y:y,w:w,h:h,label:label});
    }
    function prop(x,y,name,label,extra,w,h){
      for(var yy=y;yy<y+(h||1);yy++)for(var xx=x;xx<x+(w||1);xx++){
        if(!api.onLand(xx,yy)||at(xx,yy)!==FLOOR||propAt(xx,yy))throw new Error('Invalid Cinder Bastion scenery: '+name+' at '+xx+','+yy);
      }
      return author.scenery(preview,x,y,name,Object.assign({light:null,b:0,flat:1,previewLabel:label},extra||{}),w,h);
    }
    function standing(x,y,name,label){return prop(x,y,name,label,{b:1,flat:0});}
    function focal(positions,artName,label,w,h){
      var pos=positions[Math.floor(choose()*positions.length)],x=pos[0],y=pos[1];
      prop(x,y,artName,label,{artName:artName,previewFocal:true,noShadow:true,b:1,flat:0},w,h);
      preview.focals.push({regionId:api.regionAt(x,y),x:x,y:y,w:w,h:h,artName:artName,label:label});
    }
    function portal(id,pairId,regionId,x,y,arrival,destinationId,label){
      var gate=author.portal(preview,'cinder-portal',id,pairId,regionId,x,y,arrival,destinationId,label);
      propAt(x,y).light=null;return gate;
    }
    function pool(x,y,w,h,variant){
      rect(x,y,w,h,function(xx,yy){if(at(xx,yy)!==FLOOR||propAt(xx,yy)&&propAt(xx,yy).b)throw new Error('Cinder cooling pool must be cosmetic open floor.');});
      preview.cosmeticPools.push({x:x,y:y,w:w,h:h,regionId:api.regionAt(x,y),variant:variant});
    }
    function chain(x,y,toX,toY){preview.chains.push({x:x,y:y,toX:toX,toY:toY,regionId:api.regionAt(x,y),variant:preview.chains.length%3});}

    // A tall mustering hall and gatehouse share a wall. The small eastern
    // annex is reached on ordinary red-stone floor three cells wide.
    region('mustering-hall','Ember Mustering Hall',[
      [3,4,12,11],[5,2,8,2],[5,15,8,2],[15,9,4,3],[19,7,7,8]
    ],preview.spawn,3);
    room('ember-gatehouse','mustering-hall','Ember Gatehouse',6,2,6,4,[[9,5]]);
    room('mustering-chamber','mustering-hall','The Mustering Hall',5,5,9,9,[[9,5],[5,9],[13,9],[9,13]]);
    room('chain-annex','mustering-hall','The Chain Annex',19,7,7,8,[[19,10]]);
    preview.landmarks.push({id:'mustering-causeway',kind:'bridge',regionId:'mustering-hall',x:15,y:9,w:4,h:3,label:'Ironbound Causeway'});
    focal([[8,7],[8,8]],'cinder-furnace','Great horned furnace',3,3);
    standing(6,6,'weapon-rack','Muster weapons');standing(12,6,'weapon-rack','Muster weapons');
    standing(6,12,'banner-stand','Ironbound standard');standing(12,12,'brazier-unlit','Cooling brazier');
    standing(8,3,'table-candle','Gatehouse watch table');prop(10,4,'chains','Gatehouse chains');
    standing(3,5,'grave-pillar','Squat red-stone buttress');standing(14,14,'grave-pillar','Squat red-stone buttress');
    prop(4,12,'rubble','Broken battlement');prop(11,15,'chains','Cliff anchor links');
    standing(20,8,'weapon-rack','Annex weapons');standing(24,8,'brazier-unlit','Cooling brazier');
    prop(24,13,'chains','Annex chain anchor');chain(12,16,14,20);chain(25,13,28,17);

    // Two low chambers surround an open transverse yard. A clear exterior
    // circuit links the broad west landing to the gate on the eastern ledge.
    region('bastion-armory','Ironbound Armory',[
      [34,3,17,13],[38,1,9,2],[31,7,3,7],[51,6,3,9],[36,16,14,3]
    ],{x:33,y:10},4);
    room('anvil-hall','bastion-armory','The Anvil Hall',36,4,13,6,[[42,4],[40,9],[46,9]]);
    room('shield-store','bastion-armory','Shield Store',36,11,14,6,[[40,11],[46,11],[43,16]]);
    focal([[42,6],[40,6]],'cinder-anvil','Bastion anvil',3,2);
    standing(37,5,'weapon-rack','Forged weapon rack');standing(47,5,'weapon-rack','Forged weapon rack');
    standing(37,8,'barrel','Quenched iron stores');standing(47,8,'brazier-unlit','Cold brazier');
    standing(37,12,'weapon-rack','Armory weapon rack');standing(48,15,'weapon-rack','Armory weapon rack');
    standing(41,14,'cage','Empty iron cage');standing(45,14,'banner-stand','Bastion standard');
    standing(38,2,'grave-pillar','Battlement buttress');standing(46,2,'grave-pillar','Battlement buttress');
    prop(34,14,'rubble','Broken battlement');prop(48,17,'chains','Cliff anchor links');
    prop(52,7,'chains','Eastern anchor links');chain(47,18,48,21);chain(53,14,55,18);

    // The open forge court has four entrances and broad side terraces. Small
    // cooling stains are painted metadata: no liquid tile or damage source.
    region('cooling-forge-court','Cooling Forge Court',[
      [21,22,16,11],[17,25,4,5],[37,24,6,7],[24,21,9,1]
    ],{x:38,y:27},5);
    room('cooling-court','cooling-forge-court','The Cooling Court',23,23,12,9,[[29,23],[23,27],[34,27],[29,31]]);
    focal([[27,26],[29,27]],'cinder-shields','Cracked shield monument',2,2);
    standing(24,28,'brazier-unlit','Quenched brazier');standing(33,26,'brazier-unlit','Quenched brazier');
    standing(22,23,'grave-pillar','Forge buttress');standing(35,31,'grave-pillar','Forge buttress');
    standing(18,26,'weapon-rack','Cooling weapons');standing(18,28,'barrel','Forge stores');
    standing(41,25,'banner-stand','Forge standard');prop(41,29,'chains','Forge anchor links');
    prop(25,32,'rubble','Cooling slag fragments');prop(31,22,'rubble','Broken court stone');
    pool(24,24,3,2,0);pool(31,29,3,2,1);chain(21,30,18,33);chain(36,32,39,33);

    portal('mustering-gate','mustering-armory','mustering-hall',22,10,{x:21,y:11},'armory-west','To Ironbound Armory');
    portal('armory-west','mustering-armory','bastion-armory',31,9,{x:33,y:10},'mustering-gate','To Ember Mustering Hall');
    portal('armory-east','armory-forge','bastion-armory',51,11,{x:50,y:12},'forge-gate','To Cooling Forge Court');
    portal('forge-gate','armory-forge','cooling-forge-court',39,26,{x:38,y:27},'armory-east','To Ironbound Armory');
    return author.finish(preview);
  }
  root.FoteCinderPreview=Object.freeze({build:build});
})(typeof window!=='undefined'?window:globalThis);

;
/* js/world/chaos/violet-preview.js */
/* Violet Warrens: three authored cavern islands, with cosmetic silk and pools.
 * Installation, movement, portals and impassable void use the shared engine. */
(function(root){
  'use strict';
  function build(seed){
    var api=root.FoteChaosPreview,author=api&&api.authoring;
    if(!author)throw new Error('Load the shared Chaos preview before Violet Warrens.');
    var preview=author.begin({biome:'violet-warrens',name:'Violet Warrens',spawn:{x:7,y:10},regionId:'silkveil-grotto'},seed);
    preview.cosmeticPools=[];preview.filaments=[];
    var choose=mulberry32(preview.seed^0x56696f6c);
    function region(id,name,rows,spawn,height){
      var minX=MW,minY=MH,maxX=0,maxY=0;
      rows.forEach(function(row){
        var y=row[0];for(var span=1;span<row.length;span+=2)for(var x=row[span];x<=row[span+1];x++){
          if(!inb(x,y)||preview.landMask[idxOf(x,y)])throw new Error('Violet Warrens footprints overlap or leave the map.');
          var i=idxOf(x,y);map[i]=FLOOR;preview.landMask[i]=1;preview.regionByCell[i]=id;
          minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
        }
      });
      var bounds={x:minX,y:minY,w:maxX-minX+1,h:maxY-minY+1};
      preview.regions.push({id:id,name:name,bounds:bounds,spawn:spawn,height:height,palette:'violet'});
      rooms.push({id:rooms.length,x:bounds.x,y:bounds.y,w:bounds.w,h:bounds.h,cx:spawn.x,cy:spawn.y,special:'chaos-preview',previewId:id,regionId:id});
    }
    function walls(cells){cells.forEach(function(cell){
      if(!api.onLand(cell[0],cell[1]))throw new Error('Violet rock leaves its island.');map[idxOf(cell[0],cell[1])]=WALL;
    });}
    function prop(x,y,name,label,extra,w,h){
      var regionId=api.regionAt(x,y);
      for(var yy=y;yy<y+(h||1);yy++)for(var xx=x;xx<x+(w||1);xx++){
        if(!regionId||api.regionAt(xx,yy)!==regionId||at(xx,yy)!==FLOOR||propAt(xx,yy))throw new Error('Invalid Violet scenery: '+name+' at '+xx+','+yy);
      }
      return author.scenery(preview,x,y,name,Object.assign({light:null,b:0,flat:1,previewLabel:label},extra||{}),w,h);
    }
    function focal(positions,artName,label,w,h){
      var pos=positions[Math.floor(choose()*positions.length)],x=pos[0],y=pos[1];
      // The pavilion's raised dais fills its base; it is not a walk-under roof.
      prop(x,y,artName,label,{artName:artName,previewFocal:true,noShadow:true,b:1,flat:0},w,h);
      preview.focals.push({regionId:api.regionAt(x,y),x:x,y:y,w:w,h:h,artName:artName,label:label});
    }
    function portal(id,pairId,regionId,x,y,arrival,destinationId,label){
      var gate=author.portal(preview,'violet-portal',id,pairId,regionId,x,y,arrival,destinationId,label);
      propAt(x,y).light=null;return gate;
    }
    function pool(x,y,w,h,variant){
      for(var yy=y;yy<y+h;yy++)for(var xx=x;xx<x+w;xx++)if(at(xx,yy)!==FLOOR||propAt(xx,yy)&&propAt(xx,yy).b)throw new Error('Violet pools require clear cosmetic floor.');
      preview.cosmeticPools.push({x:x,y:y,w:w,h:h,regionId:api.regionAt(x,y),variant:variant});
    }
    function filament(x,y,toX,toY,variant){
      if(!api.onLand(x,y))throw new Error('Violet silk requires a cliff anchor.');
      preview.filaments.push({x:x,y:y,toX:toX,toY:toY,regionId:api.regionAt(x,y),variant:variant});
    }

    // A wide silk-draped crescent narrows into a SOUTHERN annex. Its vertical
    // causeway is ordinary FLOOR, three tiles wide, with clear approaches.
    region('silkveil-grotto','Silkveil Grotto',[
      [2,8,14],[3,6,17],[4,4,19],[5,3,20],[6,3,22],[7,2,23],[8,2,23],
      [9,3,22],[10,3,21],[11,4,20],[12,4,19],[13,5,19],[14,6,18],
      [15,7,17],[16,9,15],[17,10,14],[18,11,13],[19,11,13],[20,11,13],
      [21,10,15],[22,8,17],[23,7,18],[24,7,19],[25,8,19],[26,9,18],[27,10,17],[28,12,15]
    ],preview.spawn,4);
    walls([[8,2],[9,2],[10,2],[11,2],[12,2],[13,2],[14,2],[6,3],[7,3],[16,3],[17,3],
      [4,4],[19,4],[3,5],[20,5],[2,7],[23,7],[2,8],[23,8],
      [16,6],[17,6],[18,6],[17,7],[18,7],[18,8],[9,12],[10,12],[10,13],[11,13],
      [4,12],[5,13],[6,14],[7,15],[17,15],[9,16],[15,16],
      [10,21],[15,21],[8,22],[17,22],[7,23],[18,23],[19,24],[8,25],[9,26],[10,27],[17,27],[12,28],[15,28]]);
    preview.landmarks.push({id:'silkveil-causeway',kind:'bridge',regionId:'silkveil-grotto',x:11,y:18,w:3,h:3,label:'The Silk Causeway'});
    preview.landmarks.push({id:'silkveil-annex',kind:'annex',regionId:'silkveil-grotto',x:7,y:21,w:13,h:8,label:'The Draped Alcove'});
    focal([[8,6],[9,6]],'violet-pavilion','Silk-draped pavilion',3,3);
    prop(5,6,'crystal-violet-small','Amethyst buds');prop(14,4,'cl-crystal-shards-3','Lavender crystal scatter');
    prop(20,7,'stalagmite-tall-2','Flowing plum rock',{b:1,flat:0});prop(6,12,'cl-cave-pearls-1','Silver cave pearls');
    prop(5,10,'cl-rubble-2','Smooth plum stone');prop(16,12,'cl-crystal-shards-1','Moonlit crystal scatter');
    prop(9,24,'cl-cave-pearls-2','Annex pearls');prop(17,23,'crystal-violet-small','Amethyst buds');
    prop(17,26,'stalagmite-tall-3','Silk anchor stone',{b:1,flat:0});
    pool(13,10,3,2,0);filament(3,9,0,12,0);filament(20,11,24,15,1);filament(15,28,18,31,2);

    // Pearlcoil spreads across a shallow crescent, with the nursery behind a
    // short curved spine and two separated landings on opposite shores.
    region('pearlcoil-nursery','Pearlcoil Nursery',[
      [2,39,45],[3,36,48],[4,34,50],[5,33,52],[6,32,53],[7,31,53],[8,31,52],
      [9,32,51],[10,33,50],[11,33,50],[12,34,49],[13,35,48],[14,36,47],[15,38,45],[16,40,43]
    ],{x:34,y:8},3);
    walls([[39,2],[40,2],[41,2],[42,2],[43,2],[44,2],[45,2],[36,3],[48,3],[34,4],[50,4],
      [33,5],[52,5],[31,7],[31,8],[53,6],[53,7],[50,10],
      [39,6],[40,6],[41,6],[41,7],[41,8],[40,8],[35,13],[36,14],[47,14],[38,15],[45,15],[40,16],[43,16]]);
    focal([[41,11],[42,11]],'violet-eggs','Pearl egg nest',2,2);
    prop(37,4,'cl-cave-pearls-3','Unlit pearl cluster');prop(45,5,'crystal-violet-small','Violet crystal buds');
    prop(50,7,'stalagmite-tall-1','Plum mineral column',{b:1,flat:0});prop(33,9,'cl-rubble-1','Polished cave rubble');
    prop(36,13,'cl-crystal-shards-3','Pearlcoil crystals');prop(44,14,'cl-cave-pearls-1','Small pearl nest');
    prop(44,8,'cl-crystal-shards-1','Nursery crystal scatter');
    pool(35,10,3,2,1);filament(46,3,49,1,0);filament(51,8,55,10,2);filament(39,15,36,18,1);

    // The diagonal gallery is a long, swept lobe with a wide southern loop.
    // Its loom and curved rock spine leave two routes back to the east gate.
    region('moonthread-gallery','Moonthread Gallery',[
      [20,41,46],[21,38,49],[22,34,51],[23,31,52],[24,28,52],[25,27,51],
      [26,26,50],[27,26,48],[28,27,47],[29,29,46],[30,31,45],[31,33,42],[32,35,39]
    ],{x:47,y:24},5);
    walls([[41,20],[42,20],[43,20],[44,20],[45,20],[46,20],[38,21],[49,21],[34,22],[51,22],
      [31,23],[52,23],[28,24],[52,24],[27,25],[26,26],[26,27],[27,28],[29,29],[31,30],
      [33,31],[42,31],[35,32],[39,32],[41,24],[42,24],[41,25],[40,25],[40,26],[41,26]]);
    focal([[35,25],[35,27]],'violet-loom','Moonthread silk loom',3,2);
    prop(39,22,'crystal-violet-small','Moonthread crystals');prop(46,22,'cl-cave-pearls-2','Silver pearl scatter');
    prop(29,25,'stalagmite-tall-3','Curved silk anchor',{b:1,flat:0});prop(32,29,'cl-rubble-2','Smooth gallery stone');
    prop(43,29,'stalagmite-tall-2','Plum mineral column',{b:1,flat:0});prop(37,31,'cl-crystal-shards-3','Lavender crystal scatter');
    prop(48,25,'cl-cave-pearls-3','Gallery pearls');
    pool(29,26,3,2,2);filament(32,23,28,20,0);filament(50,25,54,28,1);filament(38,32,41,33,2);

    portal('silkveil-gate','silkveil-pearlcoil','silkveil-grotto',13,24,{x:12,y:25},'pearlcoil-west','To Pearlcoil Nursery');
    portal('pearlcoil-west','silkveil-pearlcoil','pearlcoil-nursery',32,7,{x:34,y:8},'silkveil-gate','To Silkveil Grotto');
    portal('pearlcoil-east','pearlcoil-moonthread','pearlcoil-nursery',47,11,{x:46,y:12},'moonthread-gate','To Moonthread Gallery');
    portal('moonthread-gate','pearlcoil-moonthread','moonthread-gallery',48,23,{x:47,y:24},'pearlcoil-east','To Pearlcoil Nursery');
    return author.finish(preview);
  }
  root.FoteVioletPreview=Object.freeze({build:build});
})(typeof window!=='undefined'?window:globalThis);

;
/* js/world/chaos/mixed-chaos-preview.js */
/* Realm of Chaos: five approved island templates, composed on one floor.
 * Biome order, the repeated type and source regions use an isolated stream.
 * Source builders retain their own geometry, focal variation and scenery. */
(function(root){
  'use strict';
  function build(seed,options){
    var api=root.FoteChaosPreview,author=api&&api.authoring;
    if(!author||!author.capture)throw new Error('Load the shared Chaos authoring API before composing the realm.');
    seed=Number.isFinite(seed)?seed>>>0:92421;
    var choose=mulberry32(seed^0x4d697865),types=[
      {biome:'prism-archives',portal:'prism-portal',build:api.build},
      {biome:'rot-hollows',portal:'rot-portal',build:root.FoteRotPreview&&root.FoteRotPreview.build},
      {biome:'cinder-bastion',portal:'cinder-portal',build:root.FoteCinderPreview&&root.FoteCinderPreview.build},
      {biome:'violet-warrens',portal:'violet-portal',build:root.FoteVioletPreview&&root.FoteVioletPreview.build}
    ];
    if(types.some(function(type){return typeof type.build!=='function';}))throw new Error('Load all four approved Chaos layouts before composing the realm.');
    var campaign=!!(options&&options.campaign),order=[];
    if(campaign){for(var pick=0;pick<5;pick++)order.push(types[Math.floor(choose()*types.length)]);}
    else{
      order=types.slice();order.push(types[Math.floor(choose()*types.length)]);
      for(var n=order.length-1;n>0;n--){var swap=Math.floor(choose()*(n+1)),held=order[n];order[n]=order[swap];order[swap]=held;}
    }
    // The upper row runs west to east; the lower row returns westward. The
    // 27-cell slots leave at least five cells of void between any land masks.
    var slots=[{x:3,y:4},{x:35,y:4},{x:67,y:4},{x:51,y:39},{x:19,y:39}],used={},usedFocals={};
    var selections=order.map(function(type,index){
      var sourceSeed=Math.floor(choose()*4294967296)>>>0,source=author.capture(type.build,sourceSeed);
      var available=source.preview.regions.filter(function(region){
        var focal=source.preview.focals.find(function(value){return value.regionId===region.id;});
        return !(used[type.biome]||[]).includes(region.id)&&focal&&!(usedFocals[type.biome]||[]).includes(focal.artName);
      });
      // A campaign floor can roll one realm five times. Prefer fresh templates,
      // then reuse an approved shape with that island's own scenery seed.
      if(!available.length&&campaign){
        used[type.biome]=[];usedFocals[type.biome]=[];
        available=source.preview.regions.filter(function(region){return source.preview.focals.some(function(value){return value.regionId===region.id;});});
      }
      if(!available.length)throw new Error('No distinct approved template and focal for the repeated biome.');
      var region=available[Math.floor(choose()*available.length)];
      (used[type.biome]||(used[type.biome]=[])).push(region.id);
      (usedFocals[type.biome]||(usedFocals[type.biome]=[])).push(source.preview.focals.find(function(value){return value.regionId===region.id;}).artName);
      if(region.bounds.w>27||region.bounds.h>27)throw new Error('Approved island exceeds its composition slot.');
      return {type:type,source:source,region:region,id:'island-'+(index+1),sourceSeed:sourceSeed,
        dx:slots[index].x+Math.floor((27-region.bounds.w)/2)-region.bounds.x,
        dy:slots[index].y+Math.floor((27-region.bounds.h)/2)-region.bounds.y};
    });
    var first=selections[0],preview=author.begin({biome:'chaos-mixed',name:'Realm of Chaos',width:96,height:72,islandCount:5,
      spawn:{x:first.region.spawn.x+first.dx,y:first.region.spawn.y+first.dy},regionId:first.id},seed);
    preview.mossMask=new Array(MW*MH).fill(0);preview.cosmeticPools=[];preview.tendrils=[];preview.chains=[];preview.filaments=[];
    preview.composition={width:MW,height:MH,order:order.map(function(type){return type.biome;}),links:[]};
    function translated(value,selection){
      var out=JSON.parse(JSON.stringify(value));
      if(Number.isFinite(out.x))out.x+=selection.dx;if(Number.isFinite(out.y))out.y+=selection.dy;
      if(Number.isFinite(out.cx))out.cx+=selection.dx;if(Number.isFinite(out.cy))out.cy+=selection.dy;
      if(Number.isFinite(out.toX))out.toX+=selection.dx;if(Number.isFinite(out.toY))out.toY+=selection.dy;
      out.regionId=selection.id;out.biome=selection.type.biome;return out;
    }
    selections.forEach(function(selection){
      var source=selection.source,original=selection.region,id=selection.id;
      var region={id:id,name:original.name,biome:selection.type.biome,sourceRegionId:original.id,sourceSeed:selection.sourceSeed,
        palette:original.palette,height:original.height,bounds:translated(original.bounds,selection),
        spawn:{x:original.spawn.x+selection.dx,y:original.spawn.y+selection.dy}};
      // Bounds are geometry, not independently themed objects.
      delete region.bounds.regionId;delete region.bounds.biome;preview.regions.push(region);
      for(var y=0;y<source.height;y++)for(var x=0;x<source.width;x++){
        var si=y*source.width+x;if(source.preview.regionByCell[si]!==original.id)continue;
        var xx=x+selection.dx,yy=y+selection.dy,di=idxOf(xx,yy);
        if(!inb(xx,yy)||preview.landMask[di])throw new Error('Composed Chaos islands overlap or leave the floor.');
        map[di]=source.map[si]===PORTAL?FLOOR:source.map[si];preview.landMask[di]=1;preview.regionByCell[di]=id;
        preview.mossMask[di]=source.preview.mossMask&&source.preview.mossMask[si]||0;
      }
      source.props.filter(function(p){return !p.previewPortal&&source.preview.regionByCell[p.y*source.width+p.x]===original.id;}).forEach(function(p){
        var copy=translated(p,selection),x=copy.x,y=copy.y,name=copy.name;
        delete copy.x;delete copy.y;delete copy.name;
        for(var yy=y;yy<y+(p.h||1);yy++)for(var xx=x;xx<x+(p.w||1);xx++){
          if(api.regionAt(xx,yy)!==id||at(xx,yy)!==FLOOR||propAt(xx,yy))throw new Error('Composed scenery leaves its approved footprint.');
        }
        author.scenery(preview,x,y,name,copy,p.set?p.w:undefined,p.set?p.h:undefined);
      });
      ['focals','landmarks','cosmeticPools','tendrils','chains','filaments'].forEach(function(key){
        (source.preview[key]||[]).filter(function(value){return value.regionId===original.id;}).forEach(function(value){
          var copy=translated(value,selection);if(copy.id)copy.id=id+'-'+copy.id;preview[key].push(copy);
        });
      });
      source.rooms.filter(function(room){return room.regionId===original.id;}).forEach(function(room){var copy=translated(room,selection);copy.id=rooms.length;copy.previewId=id+'-'+copy.previewId;rooms.push(copy);});
      (source.planeLights||[]).filter(function(light){return source.preview.regionByCell[light.y*source.width+light.x]===original.id;}).forEach(function(light){floorMeta.planeLights.push(translated(light,selection));});
      selection.originalGates=source.preview.portals.filter(function(gate){return gate.regionId===original.id;}).map(function(gate){
        return {x:gate.x+selection.dx,y:gate.y+selection.dy,arrival:{x:gate.arrival.x+selection.dx,y:gate.arrival.y+selection.dy}};
      });
    });
    // Reuse the approved landing patches first. A template with one original
    // gate receives a second clear 2x2 patch, far from the first, when internal
    // to the chain. No carved routes or removed furniture are needed.
    var reserved=new Set();
    function clearFloor(x,y,id){return inb(x,y)&&api.regionAt(x,y)===id&&at(x,y)===FLOOR&&!propAt(x,y)&&!reserved.has(idxOf(x,y));}
    function gateCandidate(x,y,region,preferred){
      for(var yy=y;yy<y+2;yy++)for(var xx=x;xx<x+2;xx++)if(!clearFloor(xx,yy,region.id)||xx===region.spawn.x&&yy===region.spawn.y)return null;
      var apron=[];
      for(var ay=y-1;ay<=y+2;ay++)for(var ax=x-1;ax<=x+2;ax++){
        if(ax>=x&&ax<x+2&&ay>=y&&ay<y+2)continue;
        if((ax<x||ax>=x+2)&&(ay<y||ay>=y+2))continue;
        if(clearFloor(ax,ay,region.id))apron.push({x:ax,y:ay});
      }
      if(!apron.length)return null;
      var arrival=preferred&&apron.find(function(p){return p.x===preferred.x&&p.y===preferred.y;})||apron[0];
      return {x:x,y:y,arrival:arrival};
    }
    selections.forEach(function(selection,index){
      var region=preview.regions[index],needed=index===0||index===4?1:2,gates=[];
      function keep(gate){gates.push(gate);for(var yy=gate.y;yy<gate.y+2;yy++)for(var xx=gate.x;xx<gate.x+2;xx++)reserved.add(idxOf(xx,yy));reserved.add(idxOf(gate.arrival.x,gate.arrival.y));}
      selection.originalGates.forEach(function(old){if(gates.length<needed){var gate=gateCandidate(old.x,old.y,region,old.arrival);if(gate)keep(gate);}});
      while(gates.length<needed){
        var choices=[],b=region.bounds;
        for(var y=b.y;y<b.y+b.h-1;y++)for(var x=b.x;x<b.x+b.w-1;x++){
          var candidate=gateCandidate(x,y,region);if(!candidate)continue;
          candidate.distance=gates.length?Math.min.apply(null,gates.map(function(g){return Math.abs(g.x-x)+Math.abs(g.y-y);})):Math.abs(region.spawn.x-x)+Math.abs(region.spawn.y-y);
          if(candidate.distance>=6)choices.push(candidate);
        }
        choices.sort(function(a,b){return b.distance-a.distance||a.y-b.y||a.x-b.x;});
        if(!choices.length)throw new Error('Approved island has no clear second portal landing.');
        var chosen=choices[0];delete chosen.distance;keep(chosen);
      }
      selection.gates=gates;
    });
    for(var link=0;link<4;link++){
      var left=selections[link],right=selections[link+1],a=left.gates[link===0?0:1],b=right.gates[0];
      var pair='chaos-link-'+(link+1),aId=pair+'-a',bId=pair+'-b';
      author.portal(preview,left.type.portal,aId,pair,left.id,a.x,a.y,a.arrival,bId,'To '+preview.regions[link+1].name);
      author.portal(preview,right.type.portal,bId,pair,right.id,b.x,b.y,b.arrival,aId,'To '+preview.regions[link].name);
      [a,b].forEach(function(g){var p=propAt(g.x,g.y);p.light=null;p.regionId=api.regionAt(g.x,g.y);p.biome=preview.regions.find(function(r){return r.id===p.regionId;}).biome;});
      preview.composition.links.push({pairId:pair,from:left.id,to:right.id});
    }
    preview.decor.forEach(function(value){value.biome=preview.regions.find(function(region){return region.id===value.regionId;}).biome;});
    return author.finish(preview);
  }
  root.FoteMixedChaosPreview=Object.freeze({build:build});
})(typeof window!=='undefined'?window:globalThis);

;
/* js/world/chaos/unmaker-preview.js */
/* The Unmaker's Crucible: a fixed, explorable final-floor composition.
 * Existing Chaos authoring owns installation, fog, props and motion.
 * The two linked gates share save-backed encounter state. Boss combat remains
 * a separate installation; the sandbox walkthrough never reports a victory. */
(function(root){
  'use strict';
  var encounterStarter=null,startingEncounter=false;
  function details(){return typeof floorMeta!=='undefined'&&floorMeta&&floorMeta.unmakerPreview||null;}
  function ensurePreparationForge(){
    var d=details(),preview=floorMeta&&floorMeta.chaosPreview;
    if(!d||!preview)return false;
    var point=null,cells=[];
    for(var y=0;y<MH;y++)for(var x=0;x<MW;x++){
      if(preview.regionByCell[idxOf(x,y)]!=='preparation')continue;
      if(at(x,y)===FORGE){point={x:x,y:y};continue;}
      if(at(x,y)===FLOOR&&!propAt(x,y)&&!items.some(function(it){return it.x===x&&it.y===y;})&&
        !ents.some(function(e){return e.hp>0&&(typeof entityOccupies==='function'?entityOccupies(e,x,y):x>=e.x&&x<e.x+(e.w||1)&&y>=e.y&&y<e.y+(e.h||1));}))cells.push({x:x,y:y});
    }
    if(!point){
      cells.sort(function(a,b){return Math.abs(a.x-43)+Math.abs(a.y-62)-Math.abs(b.x-43)-Math.abs(b.y-62)||a.y-b.y||a.x-b.x;});
      point=cells[0];if(!point)return false;
      if(typeof setT==='function')setT(point.x,point.y,FORGE);else map[idxOf(point.x,point.y)]=FORGE;
    }
    d.ordinaryForge=point;floorMeta.forge=true;floorMeta.forgeAt=point;
    preview.landmarks=preview.landmarks||[];
    var mark=preview.landmarks.find(function(value){return value.id==='preparation-forge';});
    if(!mark){mark={id:'preparation-forge'};preview.landmarks.push(mark);}
    Object.assign(mark,{kind:'forge',label:'Last Hearth crafting forge',regionId:'preparation',x:point.x,y:point.y,w:1,h:1});
    return true;
  }
  function gateAt(x,y){
    var d=details();if(!d)return null;
    if(x>=d.entryGate.x&&x<d.entryGate.x+d.entryGate.w&&y===d.entryGate.y)return d.entryGate;
    if(x>=d.rearSeal.x&&x<d.rearSeal.x+d.rearSeal.w&&y===d.rearSeal.y)return d.rearSeal;
    return null;
  }
  function syncGates(){
    var d=details();if(!d||!d.gates)return;
    var state=d.gates;
    d.entryGate.open=state.walkthrough||state.phase==='preview'||state.phase==='defeated';
    d.rearSeal.open=state.walkthrough||state.phase==='defeated';
    floorMeta.ironDoors=floorMeta.ironDoors||{};
    [d.entryGate,d.rearSeal].forEach(function(gate){for(var x=gate.x;x<gate.x+gate.w;x++){
      map[idxOf(x,gate.y)]=gate.open?OPEN:gate===d.entryGate&&state.phase==='ready'?DOOR:SEALED;
      floorMeta.ironDoors[idxOf(x,gate.y)]=1;
    }});
  }
  function repairGates(){
    var d=details();if(!d)return false;
    // An older environment save may already stand beyond either threshold.
    // Preserve its position and access, with an explicitly marked walkthrough.
    if(!d.gates){
      var beyond=typeof player!=='undefined'&&player&&player.y<=d.entryGate.y;
      d.gates={phase:'ready',walkthrough:!!beyond,legacyWalkthrough:!!beyond};
    }
    d.version=2;repairForgeArt(d);syncGates();return true;
  }
  function repairForgeArt(d){
    var forge=d.trueForge;if(!forge)return;
    var appearanceChanged=forge.artName!=='final-forge';forge.artName='final-forge';
    // Migrate only the final Forge's authored footprint. Ordinary furnaces,
    // collision, interaction state and the rest of a saved floor stay intact.
    function atForge(piece){return piece&&piece.x===forge.x&&piece.y===forge.y&&piece.w===forge.w&&piece.h===forge.h;}
    if(typeof props!=='undefined')props.forEach(function(piece){if(atForge(piece)){appearanceChanged=appearanceChanged||piece.name!==forge.artName||piece.artName!==forge.artName;piece.name=forge.artName;piece.artName=forge.artName;}});
    var preview=floorMeta.chaosPreview;if(!preview){if(appearanceChanged)FoteContent.appearanceChanged(floorMeta);return;}
    (preview.focals||[]).forEach(function(piece){if(atForge(piece)){appearanceChanged=appearanceChanged||piece.artName!==forge.artName;piece.artName=forge.artName;}});
    (preview.decor||[]).forEach(function(piece){if(atForge(piece)){appearanceChanged=appearanceChanged||piece.kind!==forge.artName;piece.kind=forge.artName;}});
    if(appearanceChanged)FoteContent.appearanceChanged(floorMeta);
  }
  function refresh(){if(typeof computeFOV==='function')computeFOV();if(typeof updateUI==='function')updateUI();}
  function setWalkthrough(enabled){
    var d=details();if(!d||!d.gates||!d.layoutOnly||!RUN||!RUN.sandbox||d.gates.phase==='active')return false;
    if(typeof gameTurns!=='undefined'&&gameTurns.busy())return false;
    enabled=!!enabled;
    // Do not lower a gate onto an actor, or strand a visitor at the true Forge.
    var living=typeof ents!=='undefined'?ents.filter(function(actor){return actor.hp>0;}):[player];
    if(!enabled&&living.some(function(actor){return actor.y<=d.rearSeal.y;})&&d.gates.phase!=='defeated'){
      log('You and your companions must return south of the rear gate before restoring the gate locks.','c-info');return false;
    }
    if(!enabled&&d.gates.phase==='ready'&&living.some(function(actor){return actor.y<=d.entryGate.y;}))d.gates.phase='preview';
    d.gates.walkthrough=enabled;syncGates();refresh();
    log(enabled?'Layout walkthrough: both gates are raised. This does not count as defeating the Unmaker.':'Gate locks restored. The rear gate awaits the Unmaker\'s defeat.','c-info');
    return true;
  }
  function registerEncounter(start){
    if(start!==null&&typeof start!=='function')throw new Error('The Unmaker encounter needs a start handler.');
    encounterStarter=start;
    var d=details();if(d&&d.gates.phase!=='active'){d.encounterImplemented=!!start;d.layoutOnly=!start;}
  }
  function startEncounter(){
    var d=details();if(!d||!d.gates||d.gates.phase!=='ready'||d.gates.walkthrough||!encounterStarter)return false;
    var started;startingEncounter=true;
    try{started=encounterStarter(d)===true;}finally{startingEncounter=false;}
    // The encounter installer owns the boss and safe party placement. Never
    // seal the entrance with the player or a living companion still outside.
    var party=ents.filter(function(actor){return actor.hp>0&&(actor===player||actor.ally);});
    if(!started||!party.length||party.some(function(actor){return actor.y>=d.entryGate.y||actor.y<=d.rearSeal.y;}))return false;
    d.gates.phase='active';d.encounterImplemented=true;d.layoutOnly=false;syncGates();refresh();return true;
  }
  function completeEncounter(){
    var d=details();if(!d||!d.gates||d.gates.phase!=='active')return false;
    d.gates.phase='defeated';syncGates();refresh();
    log('The rear gate rises. The Forge of the Elements awaits.','c-kill');sfx('door-unlock');return true;
  }
  function bumpGate(x,y){
    var d=details(),gate=gateAt(x,y);if(!gate||gate.open)return false;
    if(gate===d.rearSeal){
      log('The rear gate is sealed until the Unmaker is defeated.'+(d.layoutOnly?' Combat is disabled in this environment review; Sandbox has a gate walkthrough control.':''),'c-info');
      sfx('door-locked');return true;
    }
    if(d.gates.phase==='active'){log('The entrance gate stays sealed until the Unmaker falls.','c-info');sfx('door-locked');return true;}
    if(encounterStarter){
      if(!startEncounter()){log('The gate will not open yet.','c-info');return true;}
      log('You pass through the entrance gate, and it seals behind you. The Unmaker awakens.','c-kill');
    }else{
      d.gates.phase='preview';syncGates();refresh();
      log('The entrance gate rises. Combat is disabled in this environment walkthrough.','c-info');
    }
    sfx('door-open');endTurn();return true;
  }
  function destinationAllowed(x,y){
    var d=details();if(!d||!d.gates||d.gates.walkthrough)return true;
    // Movement, blink, forced movement and random teleport all use walkable.
    // Guard destinations too, so a revealed landing tile cannot skip a gate.
    if(d.gates.phase==='active'&&y>=d.entryGate.y)return false;
    return !(d.gates.phase==='ready'&&!startingEncounter&&y<d.entryGate.y||!d.rearSeal.open&&y<d.rearSeal.y);
  }
  function gateInfo(x,y){
    var d=details(),gate=gateAt(x,y);if(!gate)return null;
    var rear=gate===d.rearSeal,state=d.gates||{};
    return {name:rear?'Gate of the Elements':'The Unmaker\'s entrance gate',hint:
      state.walkthrough?'Raised for the sandbox layout walkthrough; no victory has been recorded.':
      rear?(gate.open?'The Unmaker is defeated. The way to the Forge of the Elements is open.':'Sealed until the Unmaker is defeated.'):
      state.phase==='active'?'Sealed until the Unmaker falls.':
      gate.open?(state.phase==='preview'?'Open for the environment walkthrough. Combat is disabled.':'The entrance gate is raised.'):
      'Open this gate to face the Unmaker. It seals behind you.'+(d.layoutOnly?' This environment preview opens the gate only; boss combat comes next.':'')};
  }
  function drawGate(x,y,px,py,alpha){
    var gate=gateAt(x,y);if(!gate)return false;
    var rear=gate===details().rearSeal,section=x-gate.x,last=section===gate.w-1,s=TS;
    var iron='#303540',edge='#929DAA',trim=rear?'#B4DAE6':'#DEB87D',seal=rear?'#91DFFF':'#FFBE78';
    ctx.save();ctx.globalAlpha=alpha;
    function box(color,xx,yy,w,h){ctx.fillStyle=color;ctx.fillRect(px+xx*s,py+yy*s,w*s,h*s);}
    // Each visible tile paints one seamless section of a single broad gate.
    // The normal object pass retains fog, remembered opacity and depth sorting.
    if(!gate.open){
      for(var i=0;i<3;i++){
        var bx=(i+.5)/3;
        box('#1C2430',bx-.038,.15,.095,.78);box(edge,bx-.026,.17,.025,.73);
        ctx.fillStyle=iron;ctx.beginPath();ctx.moveTo(px+(bx-.05)*s,py+.88*s);ctx.lineTo(px+(bx+.057)*s,py+.88*s);ctx.lineTo(px+bx*s,py+.995*s);ctx.closePath();ctx.fill();
      }
      box(iron,0,.40,1.01,.10);box(edge,0,.40,1.01,.022);
      box(iron,0,.77,1.01,.075);box(trim,0,.77,1.01,.019);
    }
    box('#242833',0,.075,1.01,.16);box(trim,0,.075,1.01,.027);box('#626C77',0,.205,1.01,.02);
    if(section===0||last){
      var post=section===0?0:.84;
      box('#32343D',post,.04,.16,.94);box(trim,post+.018,.04,.033,.94);box('#717986',post+.063,.05,.058,.91);
      box(trim,post-.005,.055,.175,.10);box(trim,post-.005,.84,.175,.085);
    }
    if(section===Math.floor(gate.w/2)){
      box('#232B38',.36,gate.open?.045:.32,.28,gate.open?.20:.30);
      ctx.strokeStyle=seal;ctx.lineWidth=Math.max(1,s*.026);ctx.beginPath();
      var cy=gate.open?.14:.46;ctx.moveTo(px+.5*s,py+(cy-.095)*s);ctx.lineTo(px+.58*s,py+cy*s);ctx.lineTo(px+.5*s,py+(cy+.095)*s);ctx.lineTo(px+.42*s,py+cy*s);ctx.closePath();ctx.stroke();
    }
    ctx.restore();return true;
  }
  function build(seed){
    var api=root.FoteChaosPreview,author=api&&api.authoring;
    if(!author)throw new Error('Load shared Chaos authoring before the Unmaker preview.');
    var preview=author.begin({biome:'unmaker-crucible',name:"The Unmaker's Crucible",width:96,height:72,
      spawn:{x:46,y:62},regionId:'preparation'},seed);
    var gameplayRng=root.rng;
    // Some ordinary prop factories sample RNG for decoration. This authored
    // composition must never advance the live combat and loot stream.
    root.rng=mulberry32(preview.seed^0x556e6d61);
    try{
      floorNo=25;floorMeta.floor=25;floorMeta.forge=false;
      floorMeta.portal=null;
      floorMeta.notes=["The Unmaker's Crucible, the last floor. You are safe here until you open the gate.",
        encounterStarter?'Open the entrance gate when you are ready; it seals behind you for the fight. Defeat all three forms of the Unmaker to reach the Forge of the Elements.':
        'Combat is disabled in this environment review. Open the entrance gate to explore; Sandbox can raise both gates for a walkthrough.','The void is impassable.'];
      preview.cosmeticPools=[];preview.chains=[];
      var arenaOutline=[[43,24],[50,23],[56,24],[60,24],[64,27],[65,31],[62,34],[66,38],[64,43],
        [59,46],[55,47],[52,45],[51,49],[44,49],[40,47],[37,44],[32,45],[29,41],[29,37],
        [32,33],[29,30],[32,26],[37,25],[40,27]];
      var preparationOutline=[[44,56],[51,56],[55,60],[53,65],[43,66],[40,62],[41,59]];
      var forgeOutline=[[43,9],[51,9],[55,13],[53,18],[49,20],[44,19],[40,15],[40,12]];
      var cover=[{x:37,y:31,w:3,h:2},{x:55,y:29,w:2,h:3},{x:40,y:39,w:2,h:3},{x:54,y:38,w:3,h:2}];
      var details={version:2,layoutOnly:!encounterStarter,encounterImplemented:!!encounterStarter,arrival:{x:46,y:62},
        bossStart:{x:48,y:35},arena:{outline:arenaOutline,bounds:{x:29,y:23,w:38,h:27}},cover:cover,
        entryGate:{x:45,y:52,w:5,h:1,open:false},rearSeal:{x:46,y:22,w:5,h:1,open:false},gates:{phase:'ready',walkthrough:false},
        trueForge:{x:46,y:12,w:3,h:3,center:{x:47,y:13},arrival:{x:47,y:16},artName:'final-forge'},floorInlays:[]};
      floorMeta.unmakerPreview=details;
      function rect(x,y,w,h,visit){for(var yy=y;yy<y+h;yy++)for(var xx=x;xx<x+w;xx++)visit(xx,yy);}
      function inside(x,y,points){
        var hit=false;
        for(var i=0,j=points.length-1;i<points.length;j=i++){
          var a=points[i],b=points[j];
          if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])hit=!hit;
        }
        return hit;
      }
      function region(id,name,biome,palette,outline,spawn,height){
        var entry={id:id,name:name,biome:biome,palette:palette,outline:outline,spawn:spawn,height:height,
          bounds:{x:MW,y:MH,w:0,h:0}};
        preview.regions.push(entry);
        for(var y=0;y<MH;y++)for(var x=0;x<MW;x++)if(inside(x+.5,y+.5,outline))land(entry,x,y);
        return entry;
      }
      function land(entry,x,y){
        if(!inb(x,y))throw new Error('Unmaker land leaves the map.');
        var i=idxOf(x,y),old=preview.regionByCell[i];
        if(old&&old!==entry.id)throw new Error('Unmaker themed regions overlap at '+x+','+y+'.');
        map[i]=FLOOR;preview.landMask[i]=1;preview.regionByCell[i]=entry.id;
      }
      function extend(entry,x,y,w,h){rect(x,y,w,h,function(xx,yy){land(entry,xx,yy);});}
      var prep=region('preparation','The Last Hearth','cinder-bastion','cinder',preparationOutline,preview.spawn,3);
      var arena=region('crucible',"The Unmaker's Crucible",'cinder-bastion','cinder',arenaOutline,{x:47,y:47},4);
      var forge=region('true-forge','Forge of the Elements','prism-archives','prism',forgeOutline,{x:48,y:19},5);
      // Boundaries between contiguous regions meet between rows. Every bridge
      // cell belongs to a region, so terrain, fog and light use the right theme.
      extend(prep,45,54,5,5);extend(prep,44,54,7,1);
      extend(arena,45,48,5,6);extend(arena,44,50,7,4);
      extend(arena,46,23,5,3);
      extend(forge,46,18,5,5);extend(forge,45,19,7,4);
      preview.regions.forEach(function(entry){
        var minX=MW,minY=MH,maxX=0,maxY=0;
        for(var y=0;y<MH;y++)for(var x=0;x<MW;x++)if(preview.regionByCell[idxOf(x,y)]===entry.id){
          minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);
        }
        entry.bounds={x:minX,y:minY,w:maxX-minX+1,h:maxY-minY+1};
      });
      function landmark(id,kind,label,regionId,x,y,w,h){
        preview.landmarks.push({id:id,kind:kind,label:label,regionId:regionId,x:x,y:y,w:w||1,h:h||1});
      }
      function prop(x,y,name,label,extra,w,h){
        rect(x,y,w||1,h||1,function(xx,yy){
          if(!api.onLand(xx,yy)||at(xx,yy)!==FLOOR||propAt(xx,yy))throw new Error('Invalid Unmaker scenery: '+name+' at '+xx+','+yy+'.');
        });
        var regionId=api.regionAt(x,y),entry=preview.regions.find(function(value){return value.id===regionId;});
        return author.scenery(preview,x,y,name,Object.assign({b:0,flat:1,light:null,previewLabel:label,
          regionId:regionId,biome:entry.biome},extra||{}),w,h);
      }
      function focal(x,y,name,label,w,h){
        prop(x,y,name,label,{artName:name,b:1,flat:0,noShadow:true,previewFocal:true},w,h);
        preview.focals.push({x:x,y:y,w:w,h:h,regionId:api.regionAt(x,y),artName:name,label:label});
      }
      function light(x,y,col,r,strength){floorMeta.planeLights.push({x:x,y:y,col:col,r:r,s:strength||.6});}
      function wall(x,y,w,h){rect(x,y,w,h,function(xx,yy){
        if(!api.onLand(xx,yy)||at(xx,yy)!==FLOOR||propAt(xx,yy))throw new Error('Invalid Unmaker cover.');
        map[idxOf(xx,yy)]=WALL;
      });}
      function inlay(kind,regionId,values){details.floorInlays.push(Object.assign({kind:kind,regionId:regionId},values));}

      // The preparation area stays safe until the entrance gate opens.
      prop(42,61,'weapon-rack','Last Hearth tool rack',{b:1,flat:0});
      prop(51,63,'table-candle','Last Hearth workbench',{b:1,flat:0,light:'#FFCB83'});
      prop(43,64,'rubble','Old forge fragments');
      prop(52,59,'chains','Forge anchor links');
      prop(42,60,'brazier-lit','Last Hearth brazier',{flat:0,light:'#FFD09A'});
      light(48,60,'#FFD5A0',4.3,.72);
      landmark('arrival','arrival','Arrival from the Realm of Chaos','preparation',46,62);
      inlay('disc','preparation',{x:46.5,y:62.5,r:1.35,color:'#D4B984'});

      // Stone gate cheeks frame a linked five-tile iron gate.
      wall(44,51,1,3);wall(50,51,1,3);
      prop(44,50,'brazier-lit','Western threshold flame',{flat:0,light:'#FFB06E'});
      prop(50,50,'brazier-lit','Eastern threshold flame',{flat:0,light:'#FFB06E'});
      light(44,50,'#FFB066',4,.68);light(50,50,'#FFB066',4,.68);
      landmark('boss-threshold','threshold','The Unmaker entrance gate','crucible',45,52,5,1);
      inlay('threshold','crucible',{x:45,y:52,w:5,h:1,color:'#EEBF79'});

      // Solid staggered cover gives both melee and ranged builds several
      // broad approaches. Decorative edge objects are walkable, not new cover.
      cover.forEach(function(block,index){
        wall(block.x,block.y,block.w,block.h);
        landmark('cover-'+(index+1),'cover','Crucible stone pillar '+(index+1),'crucible',block.x,block.y,block.w,block.h);
      });
      prop(38,33,'chains','Fallen western anchor');
      prop(57,30,'chains','Fallen eastern anchor');
      prop(39,41,'rubble','Weathered pillar chips');
      prop(56,40,'rubble','Broken pillar stone');
      // Keep the staggered cover legible from the fighting court. These low
      // crystals are walkable accents, not extra collision around the pillars.
      [[40,32,'fire','#FFAD70'],[54,31,'water','#86D7FF'],[42,40,'violet','#BC9CFF'],[53,39,'gold','#FFE0A1']].forEach(function(anchor){
        prop(anchor[0],anchor[1],'crystal-'+anchor[2]+'-small','Crucible pillar crystal');
        light(anchor[0],anchor[1],anchor[3],4.5,.72);
      });
      prop(32,29,'crystal-fire-small','Ember crystal');light(32,29,'#FF8959',3.1,.65);
      prop(33,41,'crystal-violet-small','Discord crystal');light(33,41,'#BB89FF',3.1,.58);
      prop(60,28,'crystal-gold-small','Golden anchor crystal');light(60,28,'#FFD181',3.1,.6);
      prop(61,40,'crystal-water-small','Azure anchor crystal');light(61,40,'#76CFFF',3.1,.63);
      prop(43,27,'chains','Broken northern shackle');
      prop(58,44,'chains','Broken eastern shackle');
      prop(35,28,'rubble','Crucible rim fragments');
      prop(60,42,'rubble','Crucible rim fragments');
      preview.chains.push({x:31,y:38,toX:26,toY:43,regionId:'crucible',variant:0},
        {x:64,y:38,toX:70,toY:42,regionId:'crucible',variant:1});
      landmark('central-court','arena','The Unmaker: central combat court','crucible',43,31,11,10);
      landmark('western-wing','wing','Broken western wing','crucible',30,34,10,9);
      landmark('eastern-wing','wing','Eastern crucible wing','crucible',57,33,8,10);
      inlay('broken-ring','crucible',{x:48,y:35,r:9.1,color:'#EDD3A2',opacity:.82,lineWidth:2.2,arcs:[[.1,.85],[1.1,2.1],[2.45,3.05],[3.5,4.5],[4.95,5.85]]});
      inlay('broken-ring','crucible',{x:48,y:35,r:4.4,color:'#FFE1A7',opacity:.82,lineWidth:2.2,arcs:[[0,.9],[1.3,2.55],[3,4.15],[4.65,5.85]]});
      inlay('disc','crucible',{x:48,y:35,r:1.6,color:'#FFE8BE',opacity:.75,lineWidth:2.2});

      // The rear passage changes from ember stone to pale Prism masonry. Its
      // six elemental anchors surround the final Forge and azure lens.
      wall(45,20,1,3);wall(51,20,1,3);
      prop(45,19,'crystal-gold-small','Rear seal gold crystal');
      prop(51,19,'crystal-water-small','Rear seal blue crystal');
      light(45,19,'#FFCF78',3.4,.72);light(51,19,'#78CBFF',3.4,.72);
      landmark('rear-seal','threshold','Gate of the Elements: opens after the Unmaker falls','true-forge',46,22,5,1);
      inlay('threshold','true-forge',{x:46,y:22,w:5,h:1,color:'#BCEAFF'});
      focal(46,12,'final-forge','Forge of the Elements',3,3);
      focal(46,9,'prism-lens','Elemental convergence lens',2,2);
      var anchors=[
        [42,12,'fire','#FF9265'],[51,11,'air','#D8F2FF'],[53,14,'water','#68C8FF'],
        [51,17,'violet','#BC8CFF'],[44,17,'amber','#D9BD77'],[41,14,'gold','#FFD581']
      ];
      anchors.forEach(function(anchor){
        prop(anchor[0],anchor[1],'crystal-'+anchor[2]+'-small','Elemental Forge anchor');
        light(anchor[0],anchor[1],anchor[3],3.5,.74);
      });
      light(47,13,'#FFE2A6',5.5,.9);light(47,10,'#96DFFF',4.6,.68);
      landmark('true-forge','destination','Forge of the Elements: final destination','true-forge',46,12,3,3);
      landmark('forge-dais','dais','The restoration dais','true-forge',46,15,3,3);
      inlay('broken-ring','true-forge',{x:47.5,y:14,r:5.1,color:'#D6B978',arcs:[[0,6.283185307179586]]});
      inlay('disc','true-forge',{x:47.5,y:16.5,r:1.35,color:'#DAF4FF'});
      preview.decor.forEach(function(value){value.biome=preview.regions.find(function(entry){return entry.id===value.regionId;}).biome;});
      syncGates();ensurePreparationForge();
      return author.finish(preview);
    }finally{root.rng=gameplayRng;}
  }
  root.FoteUnmakerPreview=Object.freeze({build:build,gateAt:gateAt,gateInfo:gateInfo,bumpGate:bumpGate,drawGate:drawGate,
    repairGates:repairGates,ensurePreparationForge:ensurePreparationForge,destinationAllowed:destinationAllowed,setWalkthrough:setWalkthrough,
    registerEncounter:registerEncounter,startEncounter:startEncounter,completeEncounter:completeEncounter});
})(typeof window!=='undefined'?window:globalThis);

;
/* js/presentation/render/chaos-preview-art.js */
/* Local Chaos sprites use the ordinary image cache and prop placement.
 * Source pixels stay untouched; crop rectangles remove transparent margins. */
(function(root){
  'use strict';
  var definitions={
    'prism-lens':{file:'map-prism-lens.webp',sx:126,sy:17,sw:1000,sh:1217},
    'prism-bookcase':{file:'map-prism-bookcase.webp',sx:157,sy:54,sw:710,sh:1400},
    'prism-portal':{file:'map-prism-portal.webp',sx:47,sy:10,sw:1160,sh:1212},
    'prism-astrolabe':{file:'map-prism-astrolabe.webp',sx:47,sy:15,sw:1172,sh:1209},
    'prism-lectern':{file:'map-prism-lectern.webp',sx:33,sy:31,sw:1189,sh:1185},
    'prism-tree':{file:'map-prism-tree.webp',sx:74,sy:33,sw:1107,sh:1190},
    'rot-portal':{file:'map-rot-portal.webp',sx:42,sy:54,sw:1179,sh:1153},
    'rot-canopy':{file:'map-rot-canopy.webp',sx:87,sy:54,sw:1101,sh:1152},
    'rot-puffballs':{file:'map-rot-puffballs.webp',sx:30,sy:71,sw:1192,sh:1141},
    'rot-pool':{file:'map-rot-pool.webp',sx:52,sy:163,sw:1426,sh:708},
    'cinder-portal':{file:'map-cinder-portal.webp',sx:39,sy:62,sw:1140,sh:1170},
    'cinder-furnace':{file:'map-cinder-furnace.webp',sx:60,sy:80,sw:1134,sh:1088},
    'final-forge':{file:'map-final-forge.webp',sx:0,sy:6,sw:1236,sh:1233},
    'cinder-anvil':{file:'map-cinder-anvil.webp',sx:161,sy:122,sw:1178,sh:810},
    'cinder-shields':{file:'map-cinder-shields.webp',sx:34,sy:41,sw:1186,sh:1144},
    'violet-portal':{file:'map-violet-portal.webp',sx:51,sy:17,sw:1154,sh:1203},
    'violet-pavilion':{file:'map-violet-pavilion.webp',sx:35,sy:16,sw:1184,sh:1227},
    'violet-eggs':{file:'map-violet-eggs.webp',sx:67,sy:148,sw:1148,sh:1029},
    'violet-loom':{file:'map-violet-loom.webp',sx:25,sy:78,sw:1487,sh:857}
  },pending=Object.create(null),decoded=new WeakSet();
  var themePrefixes={'prism-archives':'prism-','rot-hollows':'rot-','cinder-bastion':'cinder-','violet-warrens':'violet-','unmaker-forge':'final-'};
  var themeGroups={'chaos-mixed':['prism-archives','rot-hollows','cinder-bastion','violet-warrens'],'unmaker-crucible':['cinder-bastion','prism-archives','unmaker-forge']};
  // Activate only completed local strips. Each crop is the same union bounds
  // within every cell, so playback never changes a set piece's size or feet.
  // {file:'map-prism-lens-idle.webp',cell:192,frames:8,fps:8,sx:0,sy:0,sw:192,sh:192}
  var animations={
  "final-forge": {"file":"map-final-forge-idle.webp","cell":192,"frames":9,"fps":5.5,"sx":12,"sy":8,"sw":171,"sh":176},
  "violet-portal": {"file":"map-violet-portal-idle.webp","cell":192,"frames":9,"fps":4,"sx":11,"sy":8,"sw":169,"sh":176},
  "violet-pavilion": {"file":"map-violet-pavilion-idle.webp","cell":192,"frames":9,"fps":4.5,"sx":11,"sy":8,"sw":170,"sh":176},
  "violet-eggs": {"file":"map-violet-eggs-idle.webp","cell":192,"frames":9,"fps":4.5,"sx":8,"sy":23,"sw":176,"sh":161},
  "violet-loom": {"file":"map-violet-loom-idle.webp","cell":192,"frames":9,"fps":5.5,"sx":8,"sy":81,"sw":176,"sh":103},
  "cinder-portal": {"file":"map-cinder-portal-idle.webp","cell":192,"frames":9,"fps":5.5,"sx":10,"sy":8,"sw":171,"sh":176},
  "cinder-furnace": {"file":"map-cinder-furnace-idle.webp","cell":192,"frames":9,"fps":5.5,"sx":8,"sy":15,"sw":176,"sh":169},
  "cinder-shields": {"file":"map-cinder-shields-idle.webp","cell":192,"frames":9,"fps":5.5,"sx":8,"sy":9,"sw":176,"sh":175},
  "rot-puffballs": {"file":"map-rot-puffballs-idle.webp","cell":192,"frames":9,"fps":5.5,"sx":8,"sy":15,"sw":176,"sh":169},
  "rot-pool": {"file":"map-rot-pool-idle.webp","cell":192,"frames":9,"fps":5.5,"sx":8,"sy":93,"sw":176,"sh":91},
  "prism-portal": {
    "file": "map-prism-portal-idle.webp",
    "cell": 192,
    "frames": 9,
    "fps": 5.5,
    "sx": 12,
    "sy": 9,
    "sw": 168,
    "sh": 175
  },
  "prism-lens": {
    "file": "map-prism-lens-idle.webp",
    "cell": 192,
    "frames": 9,
    "fps": 5.5,
    "sx": 23,
    "sy": 8,
    "sw": 145,
    "sh": 176
  },
  "prism-astrolabe": {
    "file": "map-prism-astrolabe-idle.webp",
    "cell": 192,
    "frames": 9,
    "fps": 5.5,
    "sx": 7,
    "sy": 8,
    "sw": 177,
    "sh": 176
  },
  "prism-lectern": {
    "file": "map-prism-lectern-idle.webp",
    "cell": 192,
    "frames": 9,
    "fps": 5.5,
    "sx": 8,
    "sy": 9,
    "sw": 176,
    "sh": 175
  },
  "prism-tree": {
    "file": "map-prism-tree-idle.webp",
    "cell": 192,
    "frames": 9,
    "fps": 5.5,
    "sx": 13,
    "sy": 5,
    "sw": 166,
    "sh": 179
  },
  "rot-portal": {
    "file": "map-rot-portal-idle.webp",
    "cell": 192,
    "frames": 9,
    "fps": 5.5,
    "sx": 8,
    "sy": 12,
    "sw": 176,
    "sh": 172
  },
  "rot-canopy": {
    "file": "map-rot-canopy-idle.webp",
    "cell": 192,
    "frames": 9,
    "fps": 5.5,
    "sx": 12,
    "sy": 7,
    "sw": 169,
    "sh": 177
  }
};
  var animationLoads=Object.create(null),detailedAnimations=new WeakMap();
  // Wide set pieces need native detail at game zoom. Preserve the authored
  // master and use the existing strip only for its moving light, not its pixels.
  function detailedAnimation(name,img,spec){
    if(name!=='violet-loom')return null;
    var definition=definitions[name],master=atl(definition.file);if(!master)return null;
    var strips=detailedAnimations.get(master),entry=strips&&strips.get(img);
    if(entry)return entry;
    var width=512,height=Math.round(width*spec.sh/spec.sw),canvas=document.createElement('canvas');
    canvas.width=width*spec.frames;canvas.height=height;
    var g=canvas.getContext('2d');g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';
    for(var frame=0;frame<spec.frames;frame++){
      g.drawImage(master,definition.sx,definition.sy,definition.sw,definition.sh,frame*width,0,width,height);
      g.save();g.globalCompositeOperation='source-atop';g.globalAlpha=.1;
      g.drawImage(img,frame*spec.cell+spec.sx,spec.sy,spec.sw,spec.sh,frame*width,0,width,height);g.restore();
    }
    // Derived pixels live only while both atlas sources do. The weak keys do
    // not retain masters, strips or a retired scene's detailed loom canvas.
    if(!strips)detailedAnimations.set(master,strips=new WeakMap());
    entry={img:canvas,width:width,height:height};strips.set(img,entry);return entry;
  }
  function activeTheme(){return typeof floorMeta!=='undefined'&&floorMeta&&floorMeta.chaosPreview&&floorMeta.chaosPreview.biome;}
  function themeKey(theme){return theme||activeTheme()||'prism-archives';}
  function belongs(name,theme){if(themeGroups[theme])return themeGroups[theme].some(function(key){return belongs(name,key);});var prefix=themePrefixes[theme];return typeof name==='string'&&!!prefix&&name.indexOf(prefix)===0;}
  function ready(theme){
    theme=themeKey(theme);if(themeGroups[theme])return themeGroups[theme].every(ready);
    return !!themePrefixes[theme]&&Object.keys(definitions).filter(function(name){return belongs(name,theme);}).every(function(name){return decoded.has(ATL[definitions[name].file]);})&&
      Object.keys(animations).filter(function(name){return belongs(name,theme);}).every(function(name){var entry=animationLoads[name];return entry&&!entry.pending&&(entry.failed||decoded.has(ATL[animations[name].file]));});
  }
  function imageReady(file){
    return atlReady(file,{retry:true}).then(function(img){decoded.add(img);return img;});
  }
  function ensureAssets(theme){
    theme=themeKey(theme);
    if(themeGroups[theme])return Promise.all(themeGroups[theme].map(ensureAssets));
    if(!themePrefixes[theme])return Promise.reject(new Error('Unknown Chaos preview theme.'));
    var required=Object.keys(definitions).filter(function(name){return belongs(name,theme);});
    var optional=Object.keys(animations).filter(function(name){return belongs(name,theme);});
    if(pending[theme]){required.forEach(function(name){atl(definitions[name].file);});optional.forEach(loadAnimation);return pending[theme];}
    pending[theme]=Promise.all(required.map(function(name){return imageReady(definitions[name].file);}).concat(optional.map(loadAnimation))).then(function(){}).finally(function(){delete pending[theme];});
    return pending[theme];
  }
  function lookup(group,name){
    if(group!=='props'||!belongs(name,activeTheme()))return null;
    if(!Object.prototype.hasOwnProperty.call(definitions,name))return null;
    var definition=definitions[name];
    var img=atl(definition.file);if(!img)return null;
    return {img:img,sx:definition.sx,sy:definition.sy,sw:definition.sw,sh:definition.sh,nm:name};
  }
  function validAnimation(spec){
    return spec&&typeof spec.file==='string'&&Number.isInteger(spec.cell)&&spec.cell>0&&Number.isInteger(spec.frames)&&spec.frames>0&&
      Number.isFinite(spec.fps)&&spec.fps>0&&Number.isInteger(spec.sx)&&spec.sx>=0&&Number.isInteger(spec.sy)&&spec.sy>=0&&
      Number.isInteger(spec.sw)&&spec.sw>0&&Number.isInteger(spec.sh)&&spec.sh>0&&spec.sx+spec.sw<=spec.cell&&spec.sy+spec.sh<=spec.cell;
  }
  function loadAnimation(name){
    var spec=animations[name],entry=animationLoads[name];
    if(entry&&entry.failed)return entry.promise;
    if(entry&&(entry.pending||decoded.has(ATL[spec.file]))){atl(spec.file);return entry.promise;}
    entry={pending:true,failed:false,promise:null};animationLoads[name]=entry;
    // An optional failure keeps the original artwork and is remembered, rather
    // than retrying a missing strip on every shared animation frame.
    entry.promise=(validAnimation(spec)?imageReady(spec.file).then(function(img){
      entry.failed=img.naturalWidth<spec.cell*spec.frames||img.naturalHeight<spec.cell;
    },function(error){entry.failed=!(error&&error.atlasSceneRetired);}):Promise.resolve().then(function(){entry.failed=true;})).finally(function(){entry.pending=false;});
    return entry.promise;
  }
  function visibleSet(p,alpha){
    if(Number.isFinite(alpha)&&alpha<1)return false;
    if(typeof revealAll!=='undefined'&&revealAll)return true;
    if(typeof sceneVisibility()==='undefined'||typeof inb!=='function'||typeof idxOf!=='function')return false;
    for(var y=p.y;y<p.y+(p.h||1);y++)for(var x=p.x;x<p.x+(p.w||1);x++)if(inb(x,y)&&sceneVisibility()[idxOf(x,y)])return true;
    return false;
  }
  function artForSet(p,alpha,now){
    if(!p)return null;
    var name=p.artName||p.name;
    if(!belongs(name,activeTheme()))return null;
    if(!Object.prototype.hasOwnProperty.call(animations,name))return null;
    loadAnimation(name);
    var spec=animations[name],entry=animationLoads[name],img=!entry.pending&&!entry.failed?atl(spec.file):null;
    if(!img)return lookup('props',name);
    if(!Number.isFinite(now))now=typeof performance!=='undefined'?performance.now():0;
    // Remember the same artwork and union crop, held on its first frame.
    // Returning the original differently shaped crop here would resize the
    // piece whenever it crosses the fog boundary.
    var still=!visibleSet(p,alpha)||(typeof ANIM!=='undefined'&&ANIM.reduce);
    var frame=still?0:Math.floor(Math.max(0,now)*spec.fps/1000)%spec.frames;
    var detail=detailedAnimation(name,img,spec);
    if(detail)return {img:detail.img,sx:frame*detail.width,sy:0,sw:detail.width,sh:detail.height,nm:name};
    return {img:img,sx:frame*spec.cell+spec.sx,sy:spec.sy,sw:spec.sw,sh:spec.sh,nm:name};
  }
  root.FoteChaosPreviewArt=Object.freeze({ready:ready,ensureAssets:ensureAssets,lookup:lookup,artForSet:artForSet});
})(typeof window!=='undefined'?window:globalThis);

;
/* js/presentation/render/chaos-preview-render.js */
/* Local Chaos previews use the normal scene, terrain, props, fog and actor renderer.
 * These optional material/decor passes own no camera, simulation or RAF loop. */
(function(root){
  'use strict';
  var R=32,rotMaterial=null,violetMaterial=null,cache=null,surfaces=new Map(),builds=0,objectSources=new WeakMap(),objectCanvases=new WeakSet(),objectBuilds=0;
  var cellData=null,regionCache=new WeakMap();
  function rawData(){var d=typeof floorMeta!=='undefined'&&floorMeta&&floorMeta.chaosPreview&&/^(prism-archives|rot-hollows|cinder-bastion|violet-warrens|chaos-mixed|unmaker-crucible)$/.test(floorMeta.chaosPreview.biome)?floorMeta.chaosPreview:null;if(!d)cache=null;return d;}
  function data(){return cellData||rawData();}
  function composite(d){return !!(d&&(d.biome==='chaos-mixed'||d.biome==='unmaker-crucible'));}
  function mixed(){return composite(rawData());}
  function regionData(d){
    var entry=regionCache.get(d);if(entry&&entry.props===props)return entry.regions;
    var regions=d.regions.map(function(region){
      var view=Object.assign({},d,{biome:region.biome,regionId:region.id,landMask:new Uint8Array(MW*MH),bounds:{x:MW,y:MH,w:0,h:0}}),maxX=0,maxY=0;
      for(var i=0;i<d.landMask.length;i++)if(d.landMask[i]&&d.regionByCell[i]===region.id){var x=i%MW,y=Math.floor(i/MW);view.landMask[i]=1;view.bounds.x=Math.min(view.bounds.x,x);view.bounds.y=Math.min(view.bounds.y,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}
      view.bounds.w=maxX-view.bounds.x+1;view.bounds.h=maxY-view.bounds.y+1;
      ['portals','focals','decor','cosmeticPools','tendrils','chains','filaments'].forEach(function(key){view[key]=(d[key]||[]).filter(function(p){return p.regionId===region.id||!p.regionId&&d.regionByCell[p.y*MW+p.x]===region.id;});});
      view.props=props.filter(function(p){return p.regionId===region.id||!p.regionId&&d.regionByCell[p.y*MW+p.x]===region.id;});return view;
    });
    regionCache.set(d,{props:props,regions:regions});return regions;
  }
  function dataAt(x,y){
    var d=data();if(!composite(d))return d;
    if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||y<0||x>=MW||y>=MH)return null;
    var id=d.regionByCell[Math.floor(y)*MW+Math.floor(x)];return regionData(d).find(function(region){return region.regionId===id;})||null;
  }
  function themeAt(x,y){var d=dataAt(x,y);return d&&d.biome;}
  // A synchronous draw scope carries the prop's location through legacy art
  // helpers without changing the map, player, plane, camera or simulation.
  function withCell(x,y,draw){if(!mixed())return draw();var keep=cellData;cellData=dataAt(x,y);try{return draw();}finally{cellData=keep;}}
  function themedProps(d){return d.props||props;}
  function rot(d){return !!(d&&d.biome==='rot-hollows');}
  function cinder(d){return !!(d&&d.biome==='cinder-bastion');}
  function violet(d){return !!(d&&d.biome==='violet-warrens');}
  function terrainMaterial(x,y){
    var d=dataAt(x,y);if(violet(d))return violetTerrainMaterial();
    if(!rot(d)||typeof PT_MAT==='undefined'||!PT_MAT.cavern)return null;
    /* The ordinary Caverns raster owns contours, collision edges and caches.
     * Only this preview opts into porous warm rock and moss metadata. */
    if(!rotMaterial)rotMaterial=Object.assign({},PT_MAT.cavern,{
      floor:[159,137,99],floorLav:[128,103,67],jointCol:[86,65,40],joint:.3,grain:.03,occ:[74,58,34],
      mineralCool:[139,137,91],pearl:[197,176,128],band:[173,151,105],
      top:[217,198,155],topHi:[253,239,203],topLo:[158,135,94],topLav:[193,177,129],edge:[95,77,48],
      face:[214,186,134],faceLo:[130,105,67],faceH:.8,lip:[255,238,189],void:[116,98,66],voidEdge:[139,115,76],
      vein:[108,150,44],veinHot:[208,233,104],veinDark:[65,85,33],
      inlay:[158,132,82],inlayJoint:[91,72,46],polish:[190,168,115],
      pool:[33,103,76],poolEdge:[87,180,114],poolShallow:[148,210,91],poolRim:[214,238,140],
      poolShelf:[129,111,73],poolShelfDry:[158,135,86],poolWet:[84,87,51],poolLight:'#82EACB',
      moss:[[75,122,39],[112,151,59],[44,76,28],[145,170,81]],
      rockHi:'#F3DFB4',rockMid:'#C7AF7B',rockLo:'#947D53',rockEdge:'#5B482D',
      fill:'#E0D2A8',motif:'none',jag:.65,organicRock:true,faceCrystals:false,sourceLightsOnly:true
    });
    return rotMaterial;
  }
  function violetTerrainMaterial(){
    if(typeof PT_MAT==='undefined'||!PT_MAT.cavern)return null;
    // The shared Caverns raster keeps its collision contours and tile cache.
    // This material is a separate immutable choice from Rot's warm limestone.
    if(!violetMaterial)violetMaterial=Object.assign({},PT_MAT.cavern,{
      floor:[165,143,185],floorLav:[134,111,164],jointCol:[105,84,126],joint:.27,grain:.02,occ:[78,61,99],
      mineralCool:[142,132,174],pearl:[217,199,231],band:[182,158,198],
      top:[171,148,192],topHi:[231,216,244],topLo:[104,80,133],topLav:[184,164,212],edge:[77,57,103],
      face:[177,144,198],faceLo:[89,65,120],faceH:.8,lip:[239,226,247],void:[97,76,129],voidEdge:[124,98,148],
      vein:[181,144,213],veinHot:[241,222,254],veinDark:[89,64,119],
      inlay:[184,163,206],inlayJoint:[105,86,128],polish:[219,200,232],
      pool:[69,69,133],poolEdge:[136,144,207],poolShallow:[152,142,209],poolRim:[235,220,251],
      poolShelf:[139,120,164],poolShelfDry:[168,145,190],poolWet:[106,86,143],poolLight:'#D6C6FF',
      crystal:['#F6E8FF','#D7B2EF','#A679CE','#A8C8F2'],crystalGold:'#D7D4EA',crystalLight:'#E2BCFF',
      moss:[[105,74,137],[162,117,182],[68,53,96],[203,162,218]],
      rockHi:'#E7D9F2',rockMid:'#BCA0D0',rockLo:'#8B6BAA',rockEdge:'#4D386B',
      fill:'#E0D2F0',motif:'none',jag:.35,organicRock:true,faceCrystals:false,sourceLightsOnly:true
    });
    return violetMaterial;
  }
  function noise(x,y,s){var n=Math.imul(x+31,374761393)^Math.imul(y+17,668265263)^(s||0);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967296;}
  function polygon(g,points,fill){g.fillStyle=fill;g.beginPath();points.forEach(function(p,i){if(i)g.lineTo(p[0],p[1]);else g.moveTo(p[0],p[1]);});g.closePath();g.fill();}
  function surface(name,x,y){
    var d=dataAt(x,y);if(!d||rot(d)||violet(d)||!AS.surface||!AS.surface['light-'+name])return null;
    var img=atl('surface-light-'+name+'.webp');if(!img||!img.complete||!img.naturalWidth)return null;
    var key=d.biome+':'+name,entry=surfaces.get(key);if(entry&&entry.source===img)return entry.canvas;
    var c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;var g=c.getContext('2d');g.drawImage(img,0,0);
    /* A palette map changes the material, rather than darkening yellow stone
     * with a transparent blue wash. Original joints, bevels and alpha remain. */
    var image=g.getImageData(0,0,c.width,c.height),pixels=image.data;
    for(var i=0;i<pixels.length;i+=4){
      if(!pixels[i+3])continue;
      var red=pixels[i],green=pixels[i+1],blue=pixels[i+2],lum=.24*red+.65*green+.11*blue;
      if(cinder(d)){
        var piece=Math.floor((i/4%c.width)/64),lo,hi,t=Math.pow(Math.max(0,Math.min(1,(lum-28)/212)),.86);
        if(name==='deco'&&piece===9)continue; // Preserve the ordinary orange sconce.
        if(name==='deco'&&(piece===10||piece===11)){lo=[68,20,25];hi=[191,62,45];}
        else if(name.indexOf('rim')===0||name==='deco'&&piece===12){lo=[76,51,37];hi=[226,180,111];}
        else if(name==='floor'){lo=[111,77,62];hi=[233,202,164];}
        else if(name==='top'){lo=[51,45,47];hi=[162,144,130];}
        else if(name==='face'){lo=[57,43,44];hi=[179,134,112];}
        else {lo=[56,47,45];hi=[176,147,112];}
        for(var channel=0;channel<3;channel++)pixels[i+channel]=Math.round(lo[channel]+(hi[channel]-lo[channel])*t);
        continue;
      }
      var tile=Math.floor((i/4%c.width)/64),kind=name==='deco'?(tile===12?'gold':tile===9?'original':tile>=10?'banner':'porcelain'):name.indexOf('rim')===0?'gold':name==='floor'?'porcelain':'cobalt';
      if(kind==='original')continue;
      var vein=kind==='porcelain'&&name==='floor'&&red-green>11&&green-blue>29&&green>blue*1.4;
      var lo,hi,t;
      if(kind==='gold'||vein){lo=[113,75,28];hi=[255,224,139];t=Math.max(0,Math.min(1,(lum-65)/175));}
      else if(kind==='porcelain'){lo=[142,163,190];hi=[246,250,255];t=Math.max(0,Math.min(1,(lum-100)/137));}
      else {lo=[13,36,77];hi=name==='top'?[48,116,179]:[55,132,182];t=Math.pow(Math.max(0,Math.min(1,(lum-40)/190)),.8);}
      for(var channel=0;channel<3;channel++)pixels[i+channel]=Math.round(lo[channel]+(hi[channel]-lo[channel])*t);
    }
    g.putImageData(image,0,0);
    surfaces.set(key,{source:img,canvas:c});return c;
  }
  var SUPPORTS={'grave-pillar':'pillar',statue:'statue','statue-broken':'statue','table-candle':'table','portal-arch':'arch',archway:'arch',
    'door-wood':'door','door-wood-side':'door','door-wood-open':'door','door-iron':'door','door-iron-side':'door'};
  function objectArt(art,group,name){
    var d=data();if(rot(d))return rotObjectArt(art,group,name);if(cinder(d))return cinderObjectArt(art,group,name);if(violet(d))return violetObjectArt(art,group,name);
    var kind=SUPPORTS[name];
    if(!d||composite(d)||!kind||!art||!art.img||objectCanvases.has(art.img))return art;
    var img=art.img;if(img.complete===false||!img.width||!img.height||!art.sw||!art.sh)return art;
    var entries=objectSources.get(img);if(!entries){entries=new Map();objectSources.set(img,entries);}
    var key=[d.biome,kind,art.sx,art.sy,art.sw,art.sh].join(':'),c=entries.get(key);
    if(!c){
      c=document.createElement('canvas');c.width=art.sw;c.height=art.sh;
      var g=c.getContext('2d');g.drawImage(img,art.sx,art.sy,art.sw,art.sh,0,0,c.width,c.height);
      var image=g.getImageData(0,0,c.width,c.height),pixels=image.data;
      for(var i=0;i<pixels.length;i+=4){
        if(!pixels[i+3])continue;
        var red=pixels[i],green=pixels[i+1],blue=pixels[i+2],lum=.24*red+.65*green+.11*blue,y=Math.floor(i/4/c.width)/c.height;
        var warm=red>blue*1.2&&red-green>7,neutral=Math.max(red,green,blue)-Math.min(red,green,blue)<34;
        /* Keep the candle's small flame/wax warm. Existing crystal props and
         * the new lens/bookcase are deliberately outside this small allowlist. */
        if(kind==='table'&&y<.31&&lum>90)continue;
        var material='cobalt';
        if(kind==='table'){if(y>=.3&&y<.49&&warm)material='gold';}
        else if(kind==='door'){material=warm?(lum>155?'gold':'cobalt'):'porcelain';}
        else if(kind==='arch'){material=warm?'gold':(lum>110?'porcelain':'cobalt');}
        else if(kind==='statue'){material=warm?'gold':y>.8?'cobalt':'porcelain';}
        else {material=warm?'gold':green>red*1.2?'teal':neutral&&lum>75?'porcelain':'cobalt';}
        var lo,hi,t=Math.pow(Math.max(0,Math.min(1,(lum-18)/210)),.78);
        if(material==='gold'){lo=[61,43,20];hi=[255,225,135];}
        else if(material==='porcelain'){lo=[30,55,93];hi=[236,247,255];}
        else if(material==='teal'){lo=[13,47,83];hi=[104,231,240];}
        else {lo=[8,25,67];hi=[55,143,230];}
        for(var ch=0;ch<3;ch++)pixels[i+ch]=Math.round(lo[ch]+(hi[ch]-lo[ch])*t);
      }
      g.putImageData(image,0,0);objectBuilds++;
      /* Existing silhouette caches identify art by source URL + crop. A
       * stable canvas identity keeps different support masks from colliding. */
      c.src='prism-support-'+objectBuilds;objectCanvases.add(c);entries.set(key,c);
    }
    return Object.assign({},art,{img:c,sx:0,sy:0});
  }
  function doorPalette(palette,crystal,iron){
    var d=data();if(!d||composite(d)||rot(d)||crystal)return palette;
    if(violet(d))return {leaf:iron?'#8C7FA3':'#83608F',hi:'#E9DDF2',lo:'#49395C',band:'#CFC5DE'};
    if(cinder(d))return {leaf:iron?'#655D58':'#803F30',hi:'#D4B487',lo:'#302C2E',band:'#CA985C'};
    return {leaf:iron?'#27618C':'#2459A2',hi:'#74B9E8',lo:'#112E60',band:'#DAB365'};
  }
  function rotObjectArt(art,group,name){
    var kind=/mushroom/.test(name)?'fungus':/root|vine/.test(name)?'root':/moss|fern/.test(name)?'moss':/boulder|rubble|stalagmit|stepping-stone/.test(name)?'rock':null;
    if(!kind||!art||!art.img||objectCanvases.has(art.img))return art;
    var img=art.img;if(img.complete===false||!img.width||!img.height||!art.sw||!art.sh)return art;
    var entries=objectSources.get(img);if(!entries){entries=new Map();objectSources.set(img,entries);}
    var key=['rot',kind,name,art.sx,art.sy,art.sw,art.sh].join(':'),c=entries.get(key);
    if(!c){
      c=document.createElement('canvas');c.width=art.sw;c.height=art.sh;
      var g=c.getContext('2d');g.drawImage(img,art.sx,art.sy,art.sw,art.sh,0,0,c.width,c.height);
      var im=g.getImageData(0,0,c.width,c.height),p=im.data,amber=/(?:small-mushrooms-3|giant-mushroom-3|mushroom-pair-1)$/.test(name);
      for(var i=0;i<p.length;i+=4){
        if(!p[i+3])continue;
        var red=p[i],green=p[i+1],blue=p[i+2],lum=.24*red+.65*green+.11*blue,t=Math.pow(Math.max(0,Math.min(1,(lum-14)/219)),.82),lo,hi;
        if(kind==='moss'||kind==='rock'&&green>red*1.07){lo=[37,58,21];hi=[184,212,87];}
        else if(kind==='root'){lo=[51,35,18];hi=[225,209,165];}
        else if(kind==='fungus'){
          var colored=Math.max(red,green,blue)-Math.min(red,green,blue)>25;
          lo=colored?(amber?[93,39,11]:[57,77,18]):[67,55,31];hi=colored?(amber?[255,198,75]:[207,236,112]):[246,231,183];
        }else{lo=[64,49,28];hi=[228,205,156];}
        for(var ch=0;ch<3;ch++)p[i+ch]=Math.round(lo[ch]+(hi[ch]-lo[ch])*t);
      }
      g.putImageData(im,0,0);objectBuilds++;c.src='rot-support-'+objectBuilds;objectCanvases.add(c);entries.set(key,c);
    }
    return Object.assign({},art,{img:c,sx:0,sy:0});
  }
  var CINDER_SUPPORTS={'grave-pillar':'stone','weapon-rack':'iron','banner-stand':'banner','brazier-unlit':'iron','table-candle':'table',chains:'iron',rubble:'stone',barrel:'wood',cage:'iron',
    'door-wood':'wood','door-wood-side':'wood','door-wood-open':'wood','door-iron':'iron','door-iron-side':'iron'};
  function cinderObjectArt(art,group,name){
    var kind=CINDER_SUPPORTS[name];if(!kind||!art||!art.img||objectCanvases.has(art.img))return art;
    var img=art.img;if(img.complete===false||!img.width||!img.height||!art.sw||!art.sh)return art;
    var entries=objectSources.get(img);if(!entries){entries=new Map();objectSources.set(img,entries);}
    var key=['cinder-bastion',kind,name,art.sx,art.sy,art.sw,art.sh].join(':'),c=entries.get(key);
    if(!c){
      c=document.createElement('canvas');c.width=art.sw;c.height=art.sh;var g=c.getContext('2d');g.drawImage(img,art.sx,art.sy,art.sw,art.sh,0,0,c.width,c.height);
      var im=g.getImageData(0,0,c.width,c.height),p=im.data;
      for(var i=0;i<p.length;i+=4){
        if(!p[i+3])continue;
        var red=p[i],green=p[i+1],blue=p[i+2],lum=.24*red+.65*green+.11*blue,y=Math.floor(i/4/c.width)/c.height;
        if(kind==='table'&&y<.31&&lum>90)continue;
        var warm=red>blue*1.2&&red-green>9,t=Math.pow(Math.max(0,Math.min(1,(lum-16)/220)),.82),lo,hi;
        if(kind==='banner'&&Math.max(red,green,blue)-Math.min(red,green,blue)>30){lo=[60,14,22];hi=[211,66,45];}
        else if(warm&&kind!=='stone'&&kind!=='wood'){lo=[66,42,24];hi=[239,185,96];}
        else if(kind==='stone'||kind==='wood'||kind==='table'){lo=[61,34,30];hi=[207,150,116];}
        else {lo=[31,32,35];hi=[173,167,155];}
        for(var ch=0;ch<3;ch++)p[i+ch]=Math.round(lo[ch]+(hi[ch]-lo[ch])*t);
      }
      g.putImageData(im,0,0);objectBuilds++;c.src='cinder-support-'+objectBuilds;objectCanvases.add(c);entries.set(key,c);
    }
    return Object.assign({},art,{img:c,sx:0,sy:0});
  }
  function violetObjectArt(art,group,name){
    // Explicit focal PNGs are already painted for this biome and stay intact.
    var kind=/^violet-/.test(name)?null:/crystal/.test(name)?'crystal':/mushroom|cave-pearls/.test(name)?'pearl':/web|silk|root|vine/.test(name)?'silk':/boulder|rubble|stalagmit|stepping-stone/.test(name)?'rock':/moss|fern/.test(name)?'foliage':/pillar|statue|door|table-candle/.test(name)?'silver':null;
    if(!kind||!art||!art.img||objectCanvases.has(art.img))return art;
    var img=art.img;if(img.complete===false||!img.width||!img.height||!art.sw||!art.sh)return art;
    var entries=objectSources.get(img);if(!entries){entries=new Map();objectSources.set(img,entries);}
    var key=['violet-warrens',kind,name,art.sx,art.sy,art.sw,art.sh].join(':'),c=entries.get(key);
    if(!c){
      c=document.createElement('canvas');c.width=art.sw;c.height=art.sh;var g=c.getContext('2d');g.drawImage(img,art.sx,art.sy,art.sw,art.sh,0,0,c.width,c.height);
      var im=g.getImageData(0,0,c.width,c.height),p=im.data;
      for(var i=0;i<p.length;i+=4){
        if(!p[i+3])continue;
        var red=p[i],green=p[i+1],blue=p[i+2],lum=.24*red+.65*green+.11*blue,t=Math.pow(Math.max(0,Math.min(1,(lum-14)/219)),.8),lo,hi;
        if(kind==='crystal'){lo=[59,31,101];hi=/water|blue/.test(name)?[174,219,250]:[224,175,254];}
        else if(kind==='pearl'){var colored=Math.max(red,green,blue)-Math.min(red,green,blue)>25;lo=colored?[71,37,91]:[89,72,103];hi=colored?[221,170,226]:[247,226,245];}
        else if(kind==='silk'||kind==='silver'){lo=[66,58,87];hi=[232,223,246];}
        else if(kind==='foliage'){lo=[54,38,74];hi=[177,133,189];}
        else {lo=[62,43,86];hi=[205,173,227];}
        for(var ch=0;ch<3;ch++)p[i+ch]=Math.round(lo[ch]+(hi[ch]-lo[ch])*t);
      }
      g.putImageData(im,0,0);objectBuilds++;c.src='violet-support-'+objectBuilds;objectCanvases.add(c);entries.set(key,c);
    }
    return Object.assign({},art,{img:c,sx:0,sy:0});
  }
  function ellipse(g,x,y,rx,ry,fill){g.fillStyle=fill;g.beginPath();g.ellipse(x,y,rx,ry,0,0,Math.PI*2);g.fill();}
  function rootStrand(g,x,y,drop,side,width,color){
    g.strokeStyle=color;g.lineWidth=width;g.lineCap='round';g.beginPath();g.moveTo(x,y);
    g.bezierCurveTo(x+side*10,y+drop*.25,x-side*9,y+drop*.61,x+side*3,y+drop);g.stroke();
  }
  // Share the actual cave master with the ground. Painted fracture detail
  // remains native 128px per tile instead of turning each cliff into a curtain.
  var cliffTextures=Object.create(null);
  function paintCliffTexture(g,theme,x,y,w,h){
    var textures=root.FoteEnvironmentTerrain&&root.FoteEnvironmentTerrain.workerTextures(),source=textures&&textures['cave-rock'];
    if(!source)return;
    var entry=cliffTextures[theme];
    if(!entry||entry.source!==source.red){
      var c=document.createElement('canvas');c.width=source.width;c.height=source.height;
      var cg=c.getContext('2d'),im=cg.createImageData(c.width,c.height),a=im.data;
      var lo=theme==='rot'?[48,44,29]:[44,32,66],hi=theme==='rot'?[162,140,98]:[165,129,183];
      for(var i=0;i<source.red.length;i++){
        var value=source.red[i]/255;
        for(var ch=0;ch<3;ch++)a[i*4+ch]=Math.round(lo[ch]+(hi[ch]-lo[ch])*value);
        a[i*4+3]=255;
      }
      cg.putImageData(im,0,0);entry=cliffTextures[theme]={source:source.red,canvas:c};
    }
    var pattern=g.createPattern(entry.canvas,'repeat');
    pattern.setTransform(new DOMMatrix().scale(.25));
    g.globalAlpha=.74;g.fillStyle=pattern;g.fillRect(x,y,w,h);g.globalAlpha=1;
    // Small irregular bedding cracks follow the rock rather than a tile grid.
    g.strokeStyle=theme==='rot'?'rgba(34,31,20,.28)':'rgba(31,22,47,.28)';g.lineWidth=.45;
    for(var n=0;n<5;n++){
      var cy=y+h*(.12+n*.15),dx=w*(.12+noise(x,n,83)*.42);
      g.beginPath();g.moveTo(x+dx,cy);g.lineTo(x+dx+w*.17,cy-h*.024);
      g.lineTo(x+dx+w*.36,cy+h*.017);g.stroke();
    }
  }
  var sceneryView=null;
  function sceneryCanvas(){
    var c=document.createElement('canvas');c.width=sceneryView.w*128;c.height=sceneryView.h*128;
    var g=c.getContext('2d');g.scale(4,4);g.translate(-sceneryView.x*R,-sceneryView.y*R);return c;
  }
  function sceneryContains(view){return view&&camX>=view.x&&camY>=view.y&&camX+viewW+1<=view.x+view.w&&camY+viewH+1<=view.y+view.h;}
  function buildRot(d){
    var c=sceneryCanvas(),g=c.getContext('2d'),mask=d.landMask,seed=d.seed||91;
    function land(x,y){return x>=0&&y>=0&&x<MW&&y<MH&&!!mask[y*MW+x];}
    if(!d.mixedForeground){
    var sky=g.createLinearGradient(0,0,(MW*R),(MH*R));sky.addColorStop(0,'#47B9C5');sky.addColorStop(.48,'#62D4BE');sky.addColorStop(1,'#529ACA');g.fillStyle=sky;g.fillRect(0,0,(MW*R),(MH*R));
    for(var n=0;n<29;n++){
      var cx=noise(n,4,seed)*(MW*R),cy=noise(n,8,seed)*(MH*R),rad=R*(2+noise(n,9,seed)*5);
      var mist=g.createRadialGradient(cx,cy,0,cx,cy,rad);mist.addColorStop(0,n%3?'rgba(118,235,217,.22)':'rgba(210,236,198,.17)');mist.addColorStop(1,'rgba(92,206,210,0)');g.fillStyle=mist;g.fillRect(cx-rad,cy-rad,rad*2,rad*2);
    }
    /* Rounded distant ledges, with no archive prisms or faceted blue shards. */
    for(var k=0;k<37;k++){
      var rx=Math.floor(noise(k,23,seed)*MW),ry=Math.floor(noise(k,24,seed)*MH),near=false;
      for(var oy=-2;oy<=2;oy++)for(var ox=-2;ox<=2;ox++)if(land(rx+ox,ry+oy))near=true;
      if(near)continue;
      var dx=rx*R,dy=ry*R,w=R*(.26+noise(k,25,seed)*.55),h=w*(1.2+noise(k,26,seed));
      g.fillStyle='#24555C';g.beginPath();g.moveTo(dx-w,dy);g.bezierCurveTo(dx-w*.8,dy+h*.55,dx-w*.5,dy+h,dx-w*.12,dy+h);g.bezierCurveTo(dx+w*.35,dy+h*.95,dx+w*.76,dy+h*.35,dx+w,dy);g.closePath();g.fill();
      ellipse(g,dx,dy,w,w*.23,'#56887B');ellipse(g,dx-w*.14,dy-1,w*.74,w*.15,'#73A784');
      rootStrand(g,dx+w*.2,dy+h*.2,h*.75,1,1,'rgba(119,164,133,.34)');
    }
    }
    /* Warm porous cliff columns share the exact land edge with the terrain.
     * Their roots and moss hang into the void; everything is cached once. */
    for(var y=0;y<MH;y++)for(var x=0;x<MW;x++){
      if(!land(x,y))continue;var px=x*R,py=(y+1)*R;
      if(!land(x,y+1)){
        var dep=R*(1.15+noise(x,y,seed)*1.15),tip=px+R*(.35+noise(x,y,seed+1)*.3),ledge=g.createLinearGradient(px,py,px,py+dep);
        ledge.addColorStop(0,'#A38A61');ledge.addColorStop(.4,'#766340');ledge.addColorStop(1,'#3C3B2C');
        var face=new Path2D();face.moveTo(px-1,py-1);face.lineTo(px+R+1,py-1);
        face.lineTo(px+R*.96,py+dep*.3);face.lineTo(px+R*.83,py+dep*.37);
        face.lineTo(px+R*.86,py+dep*.62);face.lineTo(px+R*.64,py+dep*.8);
        face.lineTo(tip+R*.13,py+dep);face.lineTo(tip-R*.13,py+dep*.94);
        face.lineTo(px+R*.18,py+dep*.71);face.lineTo(px+R*.08,py+dep*.44);face.closePath();
        g.save();g.clip(face);g.fillStyle=ledge;g.fillRect(px-1,py-1,R+2,dep+2);
        paintCliffTexture(g,'rot',px-1,py-1,R+2,dep+2);g.restore();
        var roots=1+Math.floor(noise(x,y,seed+11)*3);
        for(var rt=0;rt<roots;rt++){
          var rootx=px+R*(.15+.7*(rt+noise(x,rt+y,seed+12))/roots),drop=dep*(.5+noise(x,rt+y,seed+13)*.5),side=rt%2?1:-1;
          rootStrand(g,rootx+1,py+3,drop,side,1.5,'rgba(43,35,21,.45)');rootStrand(g,rootx,py+2,drop,side,.8,'#9B8E65');
        }
        for(var m=0;m<5;m++){
          var mx=px+(m+.4)*R/5,mh=R*(.07+noise(x*5+m,y,seed+15)*.34);
          for(var leaf=0;leaf<7;leaf++){var lx=mx+(noise(x*35+m*7+leaf,y,seed+51)-.5)*7,ly=py+noise(x,y*35+m*7+leaf,seed+52)*mh;polygon(g,[[lx-1.1,ly],[lx+.5,ly-1.2],[lx+1.3,ly+.2],[lx-.4,ly+1.1]],leaf%2?'#667C32':'#85943D');}
        }
      }
      // The terrain owns side rims; extra ellipses produced square corner blocks.
    }
    g.globalCompositeOperation='destination-out';for(var i=0;i<mask.length;i++)if(mask[i])g.fillRect(i%MW*R,Math.floor(i/MW)*R,R,R);g.globalCompositeOperation='source-over';
    var floorClip=new Path2D();for(var fi=0;fi<mask.length;fi++)if(mask[fi]&&!isWallLike(map[fi]))floorClip.rect(fi%MW*R,Math.floor(fi/MW)*R,R,R);
    g.save();g.clip(floorClip);
    (d.tendrils||[]).forEach(function(t){
      var ax=(t.x+.5)*R,ay=(t.y+.5)*R,bx=(t.toX+.5)*R,by=(t.toY+.5)*R,dx=bx-ax,dy=by-ay;
      if(!Number.isFinite(bx)||!Number.isFinite(by))return;
      g.lineCap='round';[['rgba(49,40,21,.30)',3,2],['#B5A775',1.4,0]].forEach(function(style){
        g.strokeStyle=style[0];g.lineWidth=style[1];g.beginPath();g.moveTo(ax,ay+style[2]);g.bezierCurveTo(ax+dx*.38+dy*.15,ay+dy*.28-dx*.15,bx-dx*.24-dy*.1,by-dy*.22+dx*.1,bx,by);g.stroke();
      });
    });
    g.restore();builds++;return {data:d,map:map,canvas:c,view:sceneryView};
  }
  function drawRotSpores(d,now){
    if(ANIM.reduce)return;var t=(now||0)/1000;
    for(var n=0;n<45;n++){
      var wx=noise(n,41,d.seed)*MW,wy=noise(n,42,d.seed)*MH,ix=Math.floor(wx),iy=Math.floor(wy);
      if(!inb(ix,iy)||d.landMask[idxOf(ix,iy)]||!(revealAll||sceneVisibility()[idxOf(ix,iy)])||wx<camX||wx>camX+viewW||wy<camY||wy>camY+viewH)continue;
      ctx.globalAlpha=.16+.1*Math.sin(t*.4+n);ellipse(ctx,(wx-camX)*TS+Math.sin(t*.15+n)*TS*.05,(wy-camY)*TS-Math.sin(t*.2+n)*TS*.12,Math.max(.65,TS*.019),Math.max(.65,TS*.023),n%3?'#C4E9A9':'#F3D98F');
    }
  }
  function drawRotPortals(d,now){
    var time=ANIM.reduce?0:(now||0)/1000;
    d.portals.forEach(function(p){
      if(!portalVisibility(p).visible||p.x+2<camX||p.x>camX+viewW+1||p.y+2<camY||p.y>camY+viewH+1)return;
      var w=p.w||1,h=p.h||1,x=(p.x-camX+w*.5)*TS,y=(p.y-camY+h*.42)*TS,col=pairColor(p,d),r=TS*w*.52;
      ctx.save();ctx.globalAlpha=.75;var glow=ctx.createRadialGradient(x,y,0,x,y,r);glow.addColorStop(0,'rgba(221,246,173,.22)');glow.addColorStop(.5,'rgba(187,226,121,.12)');glow.addColorStop(1,'rgba(187,226,121,0)');ctx.fillStyle=glow;ctx.fillRect(x-r,y-r,r*2,r*2);
      /* Floating spores belong to this living arch; the ordinary sprite owns
       * its footprint and depth. No archive floor rings or rune brackets. */
      for(var j=0;j<5;j++){
        var a=time*.3+j*Math.PI*2/5;ctx.globalAlpha=.35+.14*Math.sin(a+time);ellipse(ctx,x+Math.cos(a)*TS*w*.22,y+Math.sin(a)*TS*h*.3,Math.max(.8,TS*.021),Math.max(.8,TS*.025),j%2?col:'#F3E6B1');
      }
      ctx.restore();
    });
  }
  var ROT_LIGHTS={
    'rot-canopy':{color:'#FFD076',radius:5,strength:1.07},
    'rot-puffballs':{color:'#CBEE83',radius:4.2,strength:.98},
    'rot-pool':{color:'#80E4BE',radius:4.5,strength:.96}
  };
  function addRotLights(list,d,now,position,skipPlayer){
    skipPlayer=skipPlayer||(typeof FoteNormalLighting!=='undefined'&&FoteNormalLighting.enabled());
    /* Keep the normal source/occlusion pipeline. A gentle player fill reveals
     * nearby tan rock; every other pocket comes from a visible object. */
    if(!skipPlayer&&list[0]){list[0].s*=.8;list[0].c=hexRGB('#FFE2A5');}
    if(!skipPlayer)list.push({x:position.x,y:position.y,c:hexRGB('#DDE2BB'),r:7,s:.62,wall:true,wr:7,ws:.92,tx:player.x,ty:player.y});
    themedProps(d).forEach(function(p){
      var light=p.previewFocal?ROT_LIGHTS[p.artName]:null;
      if(!light&&p.previewDecor&&/mushroom|glow-moss/.test(p.name))light={color:/(?:small-mushrooms-3|giant-mushroom-3|mushroom-pair-1)$/.test(p.name)?'#EDC475':'#C5E777',radius:3,strength:.58};
      if(!light)light=crystalSupportLight(p);if(!light||!portalVisibility(p).visible)return;
      addObjectLight(list,p,{x:p.x+((p.w||1)-1)/2,y:p.y+((p.h||1)-1)/2,c:hexRGB(light.color),r:light.radius,s:light.strength,height:light.height,wall:true,wr:light.radius,ws:.78,tx:p.x,ty:p.y});
    });
    d.portals.forEach(function(p){if(portalVisibility(p).visible)addObjectLight(list,p,{x:p.x+((p.w||1)-1)/2,y:p.y+((p.h||1)-1)/2,c:hexRGB(pairColor(p,d)),r:4.2,s:.98,wall:true,wr:4.2,ws:.72,tx:p.x,ty:p.y});});
    return list;
  }
  function buildCinder(d){
    var c=sceneryCanvas(),g=c.getContext('2d'),mask=d.landMask,seed=d.seed||91;
    function land(x,y){return x>=0&&y>=0&&x<MW&&y<MH&&!!mask[y*MW+x];}
    if(!d.mixedForeground){
    var sky=g.createLinearGradient(0,0,(MW*R),(MH*R));sky.addColorStop(0,'#548FC1');sky.addColorStop(.5,'#73BEDA');sky.addColorStop(1,'#417FAB');g.fillStyle=sky;g.fillRect(0,0,(MW*R),(MH*R));
    for(var n=0;n<23;n++){
      var cx=noise(n,4,seed)*(MW*R),cy=noise(n,8,seed)*(MH*R),rad=R*(3+noise(n,9,seed)*5),mist=g.createRadialGradient(cx,cy,0,cx,cy,rad);
      mist.addColorStop(0,n%3?'rgba(187,226,234,.24)':'rgba(228,207,169,.17)');mist.addColorStop(1,'rgba(147,206,230,0)');g.fillStyle=mist;g.fillRect(cx-rad,cy-rad,rad*2,rad*2);
    }
    // Distant fortress remnants have broad ledges and squared battlements.
    for(var k=0;k<32;k++){
      var rx=Math.floor(noise(k,23,seed)*MW),ry=Math.floor(noise(k,24,seed)*MH),near=false;
      for(var oy=-2;oy<=2;oy++)for(var ox=-2;ox<=2;ox++)if(land(rx+ox,ry+oy))near=true;
      if(near)continue;
      var dx=rx*R,dy=ry*R,w=R*(.35+noise(k,25,seed)*.7),h=w*(1.3+noise(k,26,seed));
      polygon(g,[[dx-w,dy],[dx+w,dy],[dx+w*.7,dy+h*.6],[dx+w*.15,dy+h],[dx-w*.65,dy+h*.65]],'#675C64');
      polygon(g,[[dx-w,dy],[dx+w,dy],[dx+w*.55,dy+h*.38],[dx-w*.5,dy+h*.72]],'#936E6A');
      g.fillStyle='#ABA49B';g.fillRect(dx-w,dy-3,w*2,4);g.fillStyle='#697378';
      for(var b=0;b<3;b++)g.fillRect(dx-w+w*b*.75,dy-w*.45,w*.5,w*.42);
    }
    }
    // Red fractured bedrock supports masonry ledges; no archive crystals.
    for(var y=0;y<MH;y++)for(var x=0;x<MW;x++){
      if(!land(x,y))continue;var px=x*R,py=(y+1)*R;
      if(!land(x,y+1)){
        var dep=R*(1.6+noise(x,y,seed)*1.6),tip=px+R*(.25+noise(x,y,seed+1)*.5),rock=g.createLinearGradient(px,py,px,py+dep);
        rock.addColorStop(0,'#B6765C');rock.addColorStop(.35,'#89534B');rock.addColorStop(1,'#4B4048');
        polygon(g,[[px-1,py-2],[px+R+1,py-2],[px+R*.91,py+dep*.42],[px+R*.69,py+dep*.55],[tip,py+dep],[px+R*.1,py+dep*.63]],rock);
        polygon(g,[[px+R*.1,py+4],[px+R*.36,py+2],[tip,py+dep],[px+R*.1,py+dep*.63]],'rgba(227,143,103,.18)');
        g.strokeStyle='rgba(47,34,38,.6)';g.lineWidth=1.4;g.beginPath();g.moveTo(px+R*.7,py+6);g.lineTo(px+R*.54,py+dep*.36);g.lineTo(px+R*.68,py+dep*.48);g.stroke();
        g.fillStyle='#514A49';g.fillRect(px,py-2,R,9);g.fillStyle='#B3A08B';g.fillRect(px,py-2,R,3);g.fillStyle='#312D30';g.fillRect(px+R-1,py+1,1,6);
        if(noise(x,y,seed+5)>.58){g.fillStyle='#83756A';g.fillRect(px+R*.33,py+4,R*.34,12);g.fillStyle='#D0AB73';g.fillRect(px+R*.37,py+6,2,2);}
      }
      if(!land(x-1,y)){g.fillStyle='#9B7B68';g.fillRect(px-2,y*R,3,R);}
      if(!land(x+1,y)){g.fillStyle='#55464A';g.fillRect(px+R-1,y*R,3,R);}
    }
    g.globalCompositeOperation='destination-out';for(var i=0;i<mask.length;i++)if(mask[i])g.fillRect(i%MW*R,Math.floor(i/MW)*R,R,R);g.globalCompositeOperation='source-over';
    (d.chains||[]).forEach(function(chain){
      var ax=(chain.x+.5)*R,ay=(chain.y+.5)*R,bx=(chain.toX+.5)*R,by=(chain.toY+.5)*R,len=Math.hypot(bx-ax,by-ay),steps=Math.max(2,Math.ceil(len/6));
      for(var j=0;j<=steps;j++){
        var t=j/steps,x=ax+(bx-ax)*t,y=ay+(by-ay)*t+Math.sin(t*Math.PI)*R*.45;
        g.save();g.translate(x,y);g.rotate(Math.atan2(by-ay,bx-ax));g.lineWidth=1.5;g.strokeStyle='#403B3D';g.beginPath();g.ellipse(0,1,4,j%2?1.5:2.7,0,0,Math.PI*2);g.stroke();g.strokeStyle=j%2?'#9C8A71':'#D0B481';g.lineWidth=.8;g.beginPath();g.ellipse(0,0,3.5,j%2?1:2.2,0,0,Math.PI*2);g.stroke();g.restore();
      }
    });
    var floorClip=new Path2D();for(var fi=0;fi<mask.length;fi++)if(mask[fi]&&!isWallLike(map[fi]))floorClip.rect(fi%MW*R,Math.floor(fi/MW)*R,R,R);
    g.save();g.clip(floorClip);
    (d.cosmeticPools||[]).forEach(function(pool){
      var x=(pool.x+pool.w*.5)*R,y=(pool.y+pool.h*.5)*R,rx=pool.w*R*.46,ry=pool.h*R*.42;
      ellipse(g,x,y+2,rx+3,ry+3,'rgba(49,39,34,.65)');ellipse(g,x,y,rx,ry,'#727B78');ellipse(g,x,y,rx-3,ry-3,'#385A60');ellipse(g,x-3,y-2,rx*.8,ry*.67,'#4B7780');
      g.strokeStyle='rgba(206,183,138,.5)';g.lineWidth=1.4;g.beginPath();g.ellipse(x,y,rx,ry,0,Math.PI*.05,Math.PI*.95);g.stroke();
    });
    g.restore();builds++;return {data:d,map:map,canvas:c,view:sceneryView};
  }
  function drawCinderEmbers(d,now){
    if(ANIM.reduce)return;var time=(now||0)/1000;
    themedProps(d).forEach(function(p){
      if(!p.previewFocal||!CINDER_LIGHTS[p.artName]||!portalVisibility(p).visible)return;
      for(var n=0;n<4;n++){
        var phase=(time*.18+n*.27+noise(p.x,n,d.seed))%1,x=(p.x+(p.w||1)*.5-camX)*TS+(noise(n,p.y,d.seed)-.5)*TS,y=(p.y-camY+.45-phase*.8)*TS;
        ctx.globalAlpha=Math.sin(phase*Math.PI)*.48;ellipse(ctx,x,y,Math.max(.7,TS*.016),Math.max(.9,TS*.023),n%2?'#FFE0A0':'#FF9B49');
      }
    });
  }
  function drawCinderPortals(d,now){
    var time=ANIM.reduce?0:(now||0)/1000;
    d.portals.forEach(function(p){
      if(!portalVisibility(p).visible||p.x+2<camX||p.x>camX+viewW+1||p.y+2<camY||p.y>camY+viewH+1)return;
      var x=(p.x-camX+1)*TS,y=(p.y-camY+.9)*TS,r=TS*.85;
      ctx.save();var glow=ctx.createRadialGradient(x,y,0,x,y,r);glow.addColorStop(0,'rgba(255,200,107,.2)');glow.addColorStop(.5,'rgba(255,121,49,.1)');glow.addColorStop(1,'rgba(255,121,49,0)');ctx.fillStyle=glow;ctx.fillRect(x-r,y-r,r*2,r*2);
      for(var j=0;j<4;j++){var phase=(time*.16+j*.25)%1;ctx.globalAlpha=.28*Math.sin(phase*Math.PI);ellipse(ctx,x+(j%2?1:-1)*TS*.66,y+TS*(.45-phase*.9),Math.max(.7,TS*.018),Math.max(.9,TS*.025),'#FFD188');}
      ctx.restore();
    });
  }
  var CINDER_LIGHTS={
    'cinder-furnace':{color:'#FFAD59',radius:5.5,strength:1.2},
    'cinder-anvil':{color:'#FFC16F',radius:4.5,strength:1.02},
    'cinder-shields':{color:'#FF9F4E',radius:4,strength:.94}
  };
  function addCinderLights(list,d,now,position,skipPlayer){
    skipPlayer=skipPlayer||(typeof FoteNormalLighting!=='undefined'&&FoteNormalLighting.enabled());
    // Ordinary wall sconces use this same light pipeline, but memory is not
    // an active source in the preview. Never light an unseen adjacent island.
    if(!mixed())for(var i=list.length-1;i>0;i--){var l=list[i];if(!revealAll&&(!inb(l.tx,l.ty)||!sceneVisibility()[idxOf(l.tx,l.ty)]))list.splice(i,1);}
    if(!skipPlayer&&list[0]){list[0].s*=.8;list[0].c=hexRGB('#FFD9A3');}
    if(!skipPlayer)list.push({x:position.x,y:position.y,c:hexRGB('#F4D8B0'),r:6.8,s:.6,wall:true,wr:6.5,ws:.7,tx:player.x,ty:player.y});
    var pulse=ANIM.reduce?1:1+.035*Math.sin((now||0)/630);
    themedProps(d).forEach(function(p){
      var light=p.previewFocal?CINDER_LIGHTS[p.artName]:p.previewDecor&&p.name==='table-candle'?{color:'#FFC680',radius:3,strength:.6}:null;
      if(!light)light=crystalSupportLight(p);if(!light||!portalVisibility(p).visible)return;
      addObjectLight(list,p,{x:p.x+((p.w||1)-1)/2,y:p.y+((p.h||1)-1)/2,c:hexRGB(light.color),r:light.radius,s:light.strength*pulse,height:light.height,wall:true,wr:light.radius,ws:.72,tx:p.x,ty:p.y});
    });
    d.portals.forEach(function(p){if(portalVisibility(p).visible)addObjectLight(list,p,{x:p.x+.5,y:p.y+.5,c:hexRGB(pairColor(p,d)),r:4.2,s:.98*pulse,wall:true,wr:4.2,ws:.65,tx:p.x,ty:p.y});});return list;
  }
  function buildViolet(d){
    var c=sceneryCanvas(),g=c.getContext('2d'),mask=d.landMask,seed=d.seed||91;
    function land(x,y){return x>=0&&y>=0&&x<MW&&y<MH&&!!mask[y*MW+x];}
    if(!d.mixedForeground){
    var sky=g.createLinearGradient(0,0,(MW*R),(MH*R));sky.addColorStop(0,'#454886');sky.addColorStop(.46,'#708BCE');sky.addColorStop(1,'#3D5CA8');g.fillStyle=sky;g.fillRect(0,0,(MW*R),(MH*R));
    for(var n=0;n<25;n++){
      var cx=noise(n,4,seed)*(MW*R),cy=noise(n,8,seed)*(MH*R),rad=R*(2+noise(n,9,seed)*6),haze=g.createRadialGradient(cx,cy,0,cx,cy,rad);
      haze.addColorStop(0,n%3?'rgba(189,167,233,.22)':'rgba(138,198,249,.25)');haze.addColorStop(1,'rgba(138,154,221,0)');g.fillStyle=haze;g.fillRect(cx-rad,cy-rad,rad*2,rad*2);
    }
    // Flowstone ledges hang in the blue void with softened mineral folds.
    for(var k=0;k<34;k++){
      var rx=Math.floor(noise(k,23,seed)*MW),ry=Math.floor(noise(k,24,seed)*MH),near=false;
      for(var oy=-2;oy<=2;oy++)for(var ox=-2;ox<=2;ox++)if(land(rx+ox,ry+oy))near=true;
      if(near)continue;
      var dx=rx*R,dy=ry*R,w=R*(.24+noise(k,25,seed)*.7),h=w*(1.3+noise(k,26,seed));
      g.fillStyle='#61528C';g.beginPath();g.moveTo(dx-w,dy);g.bezierCurveTo(dx-w*.72,dy+h*.12,dx-w*.76,dy+h*.76,dx-w*.1,dy+h);g.bezierCurveTo(dx+w*.47,dy+h*.72,dx+w*.77,dy+h*.33,dx+w,dy);g.closePath();g.fill();
      ellipse(g,dx,dy,w,w*.23,'#9382AD');ellipse(g,dx-w*.18,dy-1,w*.7,w*.12,'#B7A6CD');
    }
    }
    for(var y=0;y<MH;y++)for(var x=0;x<MW;x++){
      if(!land(x,y))continue;var px=x*R,py=(y+1)*R;
      if(!land(x,y+1)){
        var dep=R*(1.05+noise(x,y,seed)*1.55),tip=px+R*(.2+noise(x,y,seed+1)*.6),rock=g.createLinearGradient(px,py,px,py+dep);
        rock.addColorStop(0,'#AF91C6');rock.addColorStop(.23,'#826199');rock.addColorStop(.68,'#5D487E');rock.addColorStop(1,'#3F416D');
        // Broken mineral ledges replace repeated curtain folds. The top edge
        // still follows the exact land mask; only the hanging scenery changes.
        var face=new Path2D();face.moveTo(px-1,py-1);face.lineTo(px+R+1,py-1);
        face.lineTo(px+R*.94,py+dep*.22);face.lineTo(px+R*.77,py+dep*.27);
        face.lineTo(px+R*.83,py+dep*.46);face.lineTo(px+R*.61,py+dep*.61);
        face.lineTo(tip+R*.1,py+dep*.87);face.lineTo(tip,py+dep);
        face.lineTo(tip-R*.12,py+dep*.91);face.lineTo(px+R*.22,py+dep*.56);
        face.lineTo(px+R*.08,py+dep*.48);face.lineTo(px+R*.13,py+dep*.28);face.closePath();
        g.save();g.clip(face);g.fillStyle=rock;g.fillRect(px-1,py-1,R+2,dep+2);
        paintCliffTexture(g,'violet',px-1,py-1,R+2,dep+2);
        g.restore();
        g.strokeStyle='#C9B2DA';g.lineWidth=1.7;g.beginPath();g.moveTo(px,py+1);g.quadraticCurveTo(px+R*.5,py+3,px+R,py+1);g.stroke();
      }
      // The terrain owns side rims and their rounded island corners.
    }
    g.globalCompositeOperation='destination-out';for(var i=0;i<mask.length;i++)if(mask[i])g.fillRect(i%MW*R,Math.floor(i/MW)*R,R,R);g.globalCompositeOperation='source-over';
    (d.filaments||[]).forEach(function(t){
      var ax=(t.x+.5)*R,ay=(t.y+.5)*R,bx=(t.toX+.5)*R,by=(t.toY+.5)*R;
      if(!Number.isFinite(bx)||!Number.isFinite(by))return;
      g.strokeStyle='rgba(227,208,243,.58)';g.lineWidth=.9;g.beginPath();g.moveTo(ax,ay);g.quadraticCurveTo((ax+bx)/2,(ay+by)/2+R*.7,bx,by);g.stroke();
    });
    var floorClip=new Path2D();for(var fi=0;fi<mask.length;fi++)if(mask[fi]&&!isWallLike(map[fi]))floorClip.rect(fi%MW*R,Math.floor(fi/MW)*R,R,R);
    g.save();g.clip(floorClip);
    (d.cosmeticPools||[]).forEach(function(pool){
      var x=(pool.x+pool.w*.5)*R,y=(pool.y+pool.h*.5)*R,rx=pool.w*R*.43,ry=pool.h*R*.38;
      ellipse(g,x,y+1,rx+2,ry+2,'rgba(187,174,214,.55)');ellipse(g,x,y,rx,ry,'rgba(121,162,191,.68)');ellipse(g,x-2,y-2,rx*.75,ry*.62,'rgba(186,222,232,.38)');
      g.strokeStyle='rgba(233,222,251,.65)';g.lineWidth=.9;g.beginPath();g.ellipse(x,y,rx,ry,0,Math.PI*.06,Math.PI*.86);g.stroke();
    });
    g.restore();builds++;return {data:d,map:map,canvas:c,view:sceneryView};
  }
  var VIOLET_LIGHTS={
    'violet-pavilion':{color:'#E9CAF8',radius:5,strength:1.02},
    'violet-eggs':{color:'#F8DCEB',radius:4.3,strength:1.04},
    'violet-loom':{color:'#C7D7FF',radius:4.6,strength:.98}
  };
  function violetSupportLight(p){
    if(!p.previewDecor)return null;
    if(/crystal/.test(p.name)){var crystal=crystalSupportLight(p);return {color:crystal?crystal.color:/water|blue/.test(p.name)?'#B9DDFF':'#DCABF5',radius:3.1,strength:.65};}
    if(/mushroom|cave-pearls/.test(p.name))return {color:'#F1D6E9',radius:2.7,strength:.52};
    return null;
  }
  function addVioletLights(list,d,now,position,skipPlayer){
    skipPlayer=skipPlayer||(typeof FoteNormalLighting!=='undefined'&&FoteNormalLighting.enabled());
    if(!skipPlayer&&list[0]){list[0].s*=.72;list[0].c=hexRGB('#F1DFEF');}
    if(!skipPlayer)list.push({x:position.x,y:position.y,c:hexRGB('#E1D4F4'),r:7,s:.65,wall:true,wr:7,ws:.86,tx:player.x,ty:player.y});
    themedProps(d).forEach(function(p){
      var light=p.previewFocal?VIOLET_LIGHTS[p.artName]:violetSupportLight(p);if(!light)light=crystalSupportLight(p);if(!light||!portalVisibility(p).visible)return;
      addObjectLight(list,p,{x:p.x+((p.w||1)-1)/2,y:p.y+((p.h||1)-1)/2,c:hexRGB(light.color),r:light.radius,s:light.strength,height:light.height,wall:true,wr:light.radius,ws:.74,tx:p.x,ty:p.y});
    });
    (d.cosmeticPools||[]).forEach(function(p){if(portalVisibility(p).visible)addObjectLight(list,p,{x:p.x+(p.w-1)/2,y:p.y+(p.h-1)/2,c:hexRGB('#C9DEF5'),r:2.6,s:.54,wall:true,wr:2.6,ws:.34,tx:p.x,ty:p.y});});
    d.portals.forEach(function(p){if(portalVisibility(p).visible)addObjectLight(list,p,{x:p.x+((p.w||1)-1)/2,y:p.y+((p.h||1)-1)/2,c:hexRGB(pairColor(p,d)),r:4.3,s:.98,wall:true,wr:4.3,ws:.72,tx:p.x,ty:p.y});});return list;
  }
  function drawVioletPortals(d,now){
    var time=ANIM.reduce?0:(now||0)/1000;
    d.portals.forEach(function(p){
      if(!portalVisibility(p).visible||p.x+2<camX||p.x>camX+viewW+1||p.y+2<camY||p.y>camY+viewH+1)return;
      var x=(p.x-camX+1)*TS,y=(p.y-camY+.86)*TS,r=TS*.82;
      ctx.save();var glow=ctx.createRadialGradient(x,y,0,x,y,r);glow.addColorStop(0,'rgba(208,223,255,.19)');glow.addColorStop(.5,'rgba(206,161,237,.11)');glow.addColorStop(1,'rgba(187,157,234,0)');ctx.fillStyle=glow;ctx.fillRect(x-r,y-r,r*2,r*2);
      for(var n=0;n<4;n++){var a=n*Math.PI*.5+time*.22;ctx.globalAlpha=.27+.08*Math.sin(a+time);ellipse(ctx,x+Math.cos(a)*TS*.49,y+Math.sin(a)*TS*.57,Math.max(.65,TS*.014),Math.max(.7,TS*.02),n%2?'#F8E9FC':'#CBEAFF');}
      ctx.restore();
    });
  }
  function mixedBounds(d){var b=d.bounds;return {x:Math.max(0,b.x-4),y:Math.max(0,b.y-3),right:Math.min(MW,b.x+b.w+4),bottom:Math.min(MH,b.y+b.h+6)};}
  function mixedClip(d){
    var bounds=mixedBounds(d),path=new Path2D(),all=rawData();
    for(var y=bounds.y;y<bounds.bottom;y++)for(var x=bounds.x;x<bounds.right;x++)if(!all.landMask[y*MW+x]||d.landMask[y*MW+x])path.rect(x*R,y*R,R,R);
    return path;
  }
  function buildMixed(d){
    var c=sceneryCanvas(),g=c.getContext('2d'),sky=g.createLinearGradient(0,0,(MW*R),(MH*R));
    sky.addColorStop(0,'#315F99');sky.addColorStop(1,'#487FAD');g.fillStyle=sky;g.fillRect(0,0,(MW*R),(MH*R));
    // A shared blue sky with broad radial tints has no rectangular region
    // boundaries. The existing foreground builders keep every cliff opaque.
    var regions=regionData(d),skyColors={'prism-archives':'#386DA7','rot-hollows':'#62D4BE','cinder-bastion':'#73BEDA','violet-warrens':'#708BCE'};
    regions.forEach(function(region){
      var b=region.bounds,cx=(b.x+b.w*.5)*R,cy=(b.y+b.h*.5)*R,rx=(b.w*.7+5)*R,ry=(b.h*.7+5)*R;
      g.save();g.translate(cx,cy);g.scale(rx,ry);var haze=g.createRadialGradient(0,0,0,0,0,1);haze.addColorStop(0,hexA(skyColors[region.biome],.92));haze.addColorStop(.4,hexA(skyColors[region.biome],.65));haze.addColorStop(1,hexA(skyColors[region.biome],0));g.fillStyle=haze;g.fillRect(-1,-1,2,2);g.restore();
    });
    // Only one full-size temporary exists, and is released immediately after
    // compositing. No other island's playable cells enter this region's layer.
    regions.forEach(function(region){
      var layer=build(Object.assign({},region,{mixedForeground:true})).canvas,b=mixedBounds(region),x=b.x*R,y=b.y*R,w=(b.right-b.x)*R,h=(b.bottom-b.y)*R;
      g.globalCompositeOperation='destination-out';for(var i=0;i<region.landMask.length;i++)if(region.landMask[i])g.fillRect(i%MW*R,Math.floor(i/MW)*R,R,R);g.globalCompositeOperation='source-over';
      g.save();g.clip(mixedClip(region));g.drawImage(layer,0,0,layer.width,layer.height,sceneryView.x*R,sceneryView.y*R,sceneryView.w*R,sceneryView.h*R);g.restore();layer.width=layer.height=0;
    });
    if(d.biome==='unmaker-crucible')buildCrucibleInlays(g,d);
    return {data:d,map:map,canvas:c,view:sceneryView};
  }
  // Authored ornament is cached with the floor. It has no collision, animation
  // timer or gameplay state, and drawVoid applies the ordinary discovery mask.
  function buildCrucibleInlays(g,d){
    var layout=floorMeta.unmakerPreview;if(!layout)return;
    var clip=new Path2D();
    for(var i=0;i<d.landMask.length;i++)if(d.landMask[i]&&!isWallLike(map[i]))clip.rect(i%MW*R,Math.floor(i/MW)*R,R,R);
    g.save();g.clip(clip);
    (layout.floorInlays||[]).forEach(function(mark){
      var x=(mark.x+.5)*R,y=(mark.y+.5)*R;
      g.strokeStyle=hexA(mark.color,mark.opacity===undefined?.55:mark.opacity);g.fillStyle=hexA(mark.color,.10);g.lineWidth=mark.lineWidth||1.6;
      if(mark.kind==='broken-ring'){
        (mark.arcs||[]).forEach(function(arc){g.beginPath();g.ellipse(x,y,mark.r*R,mark.r*R*.86,0,arc[0],arc[1]);g.stroke();});
      }else if(mark.kind==='disc'){
        g.beginPath();g.ellipse(x,y,mark.r*R,mark.r*R*.86,0,0,Math.PI*2);g.fill();g.stroke();
      }else if(mark.kind==='threshold'){
        g.fillRect(mark.x*R,mark.y*R,mark.w*R,mark.h*R);
        g.beginPath();g.moveTo(mark.x*R,mark.y*R);g.lineTo((mark.x+mark.w)*R,mark.y*R);
        g.moveTo(mark.x*R,(mark.y+mark.h)*R);g.lineTo((mark.x+mark.w)*R,(mark.y+mark.h)*R);g.stroke();
      }
    });g.restore();
  }
  function build(d){
    if(composite(d))return buildMixed(d);
    if(rot(d))return buildRot(d);
    if(cinder(d))return buildCinder(d);
    if(violet(d))return buildViolet(d);
    var c=sceneryCanvas(),g=c.getContext('2d'),mask=d.landMask,seed=d.seed||91;
    function land(x,y){return x>=0&&y>=0&&x<MW&&y<MH&&!!mask[y*MW+x];}
    if(!d.mixedForeground){
    var sky=g.createLinearGradient(0,0,(MW*R),(MH*R));sky.addColorStop(0,'#254F89');sky.addColorStop(.48,'#386DA7');sky.addColorStop(1,'#235A8D');g.fillStyle=sky;g.fillRect(0,0,(MW*R),(MH*R));
    /* Soft cloud banks and scattered distant fragments establish height;
     * deterministic placement never consumes the gameplay random stream. */
    for(var n=0;n<19;n++){
      var cx=noise(n,4,seed)*(MW*R),cy=noise(n,8,seed)*(MH*R),rad=R*(3+noise(n,9,seed)*7);
      var cloud=g.createRadialGradient(cx,cy,0,cx,cy,rad);cloud.addColorStop(0,n%3?'rgba(117,201,235,.24)':'rgba(171,162,225,.20)');cloud.addColorStop(1,'rgba(85,157,216,0)');g.fillStyle=cloud;g.fillRect(cx-rad,cy-rad,rad*2,rad*2);
    }
    for(var s=0;s<520;s++){
      var sx=noise(s,11,seed)*(MW*R),sy=noise(s,12,seed)*(MH*R),size=noise(s,13,seed)>.965?1.8:.65;
      g.globalAlpha=.12+noise(s,14,seed)*.36;g.fillStyle=s%6?'#A3C7E9':'#E4C788';g.fillRect(sx,sy,size,size);
    }
    g.globalAlpha=1;
    for(var k=0;k<45;k++){
      var rx=Math.floor(noise(k,23,seed)*MW),ry=Math.floor(noise(k,24,seed)*MH),near=false;
      for(var oy=-2;oy<=2;oy++)for(var ox=-2;ox<=2;ox++)if(land(rx+ox,ry+oy))near=true;
      if(near)continue;
      var x=rx*R,y=ry*R,w=R*(.22+noise(k,25,seed)*.5),h=w*(1.5+noise(k,26,seed));
      polygon(g,[[x-w,y],[x+w*.7,y-3],[x+w,y+h*.3],[x+w*.15,y+h],[x-w*.65,y+h*.5]],'#163154');
      polygon(g,[[x-w,y],[x-w*.2,y-w*.25],[x+w*.7,y-3],[x+w*.1,y+w*.2]],'#547FA0');
      polygon(g,[[x+w*.1,y+w*.2],[x+w*.7,y-3],[x+w,y+h*.3],[x+w*.15,y+h]],'#25476B');
    }
    }
    /* Exposed southern edges form irregular, faceted floating foundations.
     * This is decoration beyond CHASM edges; the existing tile edge is exact. */
    for(var yy=0;yy<MH;yy++)for(var xx=0;xx<MW;xx++){
      if(!land(xx,yy))continue;
      var px=xx*R,py=(yy+1)*R;
      if(!land(xx,yy+1)){
        var dep=R*(1.65+noise(xx,yy,seed)*2.2),tip=px+R*(.2+noise(xx,yy,seed+1)*.6),ledge=g.createLinearGradient(0,py,0,py+dep);
        ledge.addColorStop(0,'#6B94B9');ledge.addColorStop(.25,'#3D648D');ledge.addColorStop(1,'#162F59');
        polygon(g,[[px-1,py-1],[px+R+1,py-1],[px+R*.9,py+dep*.52],[tip,py+dep],[px+R*.06,py+dep*.64]],ledge);
        polygon(g,[[px,py],[px+R*.32,py+2],[tip,py+dep],[px+R*.06,py+dep*.64]],'rgba(117,147,177,.16)');
        polygon(g,[[px+R*.64,py+1],[px+R,py],[px+R*.9,py+dep*.52],[tip,py+dep]],'rgba(10,24,55,.36)');
        g.strokeStyle='rgba(175,184,182,.7)';g.lineWidth=2;g.beginPath();g.moveTo(px,py+1);g.lineTo(px+R,py+1);g.stroke();
        if(noise(xx,yy,seed+9)>.68){g.strokeStyle='rgba(98,178,197,.35)';g.lineWidth=1;g.beginPath();g.moveTo(px+R*.4,py+4);g.lineTo(px+R*.48,py+dep*.4);g.lineTo(px+R*.35,py+dep*.65);g.stroke();}
      }
      if(!land(xx+1,yy)){polygon(g,[[px+R,py-R],[px+R+R*.22,py-R*.75],[px+R+R*.13,py+R*.5],[px+R,py+R*.85]],'#274768');}
      if(!land(xx-1,yy)){polygon(g,[[px,py-R],[px-R*.13,py-R*.62],[px-R*.1,py+R*.35],[px,py+R*.6]],'#446687');}
    }
    /* Leave every playable surface and blocker to the existing renderer. */
    g.globalCompositeOperation='destination-out';for(var i=0;i<mask.length;i++)if(mask[i])g.fillRect(i%MW*R,Math.floor(i/MW)*R,R,R);g.globalCompositeOperation='source-over';
    /* A floor inlay is an explicit placement choice, never an automatic
     * circle underneath every focal prop. It is cached with the terrain. */
    var floorClip=new Path2D();for(var fi=0;fi<mask.length;fi++)if(mask[fi]&&!isWallLike(map[fi]))floorClip.rect(fi%MW*R,Math.floor(fi/MW)*R,R,R);
    g.save();g.clip(floorClip);
    themedProps(d).filter(function(p){return !!p.previewInlay;}).forEach(function(p){
      var x=(p.x+(p.w||1)/2)*R,y=(p.y+(p.h||1)/2)*R,r=R*2.05;g.strokeStyle='rgba(165,126,58,.56)';g.lineWidth=1.2;
      [r,r*.87].forEach(function(a){g.beginPath();g.ellipse(x,y,a,a*.82,0,0,Math.PI*2);g.stroke();});
      for(var j=0;j<12;j++){var a=j*Math.PI/6;g.beginPath();g.moveTo(x+Math.cos(a)*r*.87,y+Math.sin(a)*r*.87*.82);g.lineTo(x+Math.cos(a)*r,y+Math.sin(a)*r*.82);g.stroke();}
    });g.restore();builds++;return {data:d,map:map,canvas:c,view:sceneryView};
  }
  function drawVoid(now){
    var d=data();if(!d||!d.landMask)return;if(!cache||cache.data!==d||cache.map!==map||!sceneryContains(cache.view)){sceneryView={x:camX-4,y:camY-4,w:viewW+9,h:viewH+9};cache=build(d);}
    var clip=new Path2D(),any=false;
    // Cached floor ornaments must not paint over a temporary live wall.
    for(var y=camY;y<=camY+viewH;y++)for(var x=camX;x<=camX+viewW;x++)if(inb(x,y)&&!isWallLike(at(x,y))&&(revealAll||seen[idxOf(x,y)])){clip.rect((x-camX)*TS,(y-camY)*TS,TS+.1,TS+.1);any=true;}
    if(!any)return;
    ctx.save();ctx.clip(clip);ctx.globalAlpha=1;ctx.imageSmoothingEnabled=true;
    ctx.drawImage(cache.canvas,(camX-cache.view.x)*128,(camY-cache.view.y)*128,(viewW+1)*128,(viewH+1)*128,0,0,(viewW+1)*TS,(viewH+1)*TS);
    /* A few slow glints use the caller's shared time. No object owns a timer. */
    var phase=ANIM.reduce?0:(now||0)/7000;
    if(composite(d)){
      regionData(d).forEach(function(region){
        if(!rot(region)&&!cinder(region))return;
        var b=mixedBounds(region);ctx.save();ctx.beginPath();ctx.rect((b.x-camX)*TS,(b.y-camY)*TS,(b.right-b.x)*TS,(b.bottom-b.y)*TS);ctx.clip();
        if(rot(region))drawRotSpores(region,now);else drawCinderEmbers(region,now);ctx.restore();
      });ctx.restore();return;
    }
    if(rot(d)){drawRotSpores(d,now);ctx.restore();return;}
    if(cinder(d)){drawCinderEmbers(d,now);ctx.restore();return;}
    if(violet(d)){ctx.restore();return;}
    for(var n=0;n<20;n++){
      var wx=noise(n,41,d.seed)*MW,wy=noise(n,42,d.seed)*MH,ix=Math.floor(wx),iy=Math.floor(wy);
      if(!inb(ix,iy)||d.landMask[idxOf(ix,iy)]||wx<camX||wx>camX+viewW||wy<camY||wy>camY+viewH)continue;
      var alpha=.17+.16*Math.sin(phase+n*2.3),px=(wx-camX)*TS,py=(wy-camY)*TS;
      ctx.globalAlpha=alpha;ctx.strokeStyle='#B3E5F0';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(px-2,py);ctx.lineTo(px+2,py);ctx.moveTo(px,py-2);ctx.lineTo(px,py+2);ctx.stroke();
    }
    ctx.restore();
  }
  function pairColor(p,d){if(rot(d))return '#D7EC88';if(cinder(d))return '#FFBC70';if(violet(d))return '#C7DFFF';var pairs=[];d.portals.forEach(function(q){if(pairs.indexOf(q.pairId)<0)pairs.push(q.pairId);});return pairs.indexOf(p.pairId)%2?'#E5BA68':'#78D5F1';}
  function portalVisibility(p){
    var known=false,visible=false,blind=typeof playerBlind==='function'&&playerBlind(),anchor=null,best=Infinity;
    var cx=p.x+((p.w||1)-1)/2,cy=p.y+((p.h||1)-1)/2;
    for(var y=Math.floor(p.y);y<Math.ceil(p.y+(p.h||1));y++)for(var x=Math.floor(p.x);x<Math.ceil(p.x+(p.w||1));x++)if(inb(x,y)){
      known=known||revealAll||seen[idxOf(x,y)];
      if(!blind&&(revealAll||sceneVisibility()[idxOf(x,y)])){
        visible=true;var d=(x-cx)*(x-cx)+(y-cy)*(y-cy);if(d<best){best=d;anchor={x:x,y:y};}
      }
    }
    return {known:known,visible:visible,anchor:anchor};
  }
  function addObjectLight(list,p,light){
    var state=portalVisibility(p);if(!state.visible)return;
    // Native pp.light and authored Unmaker sources already light these props.
    // Keep their deliberate palette/radius instead of stacking a second lamp.
    if(p.previewDecor||p.previewFocal){
      if(p.light||(floorMeta.planeLights||[]).some(function(l){return l.x>=p.x&&l.x<p.x+(p.w||1)&&l.y>=p.y&&l.y<p.y+(p.h||1);}))return;
    }
    light.tx=state.anchor.x;light.ty=state.anchor.y;list.push(light);
  }
  function crystalSupportLight(p){
    if(!p.previewDecor||typeof crystalLightProfile!=='function')return null;
    var profile=crystalLightProfile(p.artName||p.name);if(!profile)return null;
    return {color:profile.color,radius:profile.r,strength:profile.s,height:profile.height};
  }
  function drawPortals(now){
    var d=rawData();if(!d)return;if(composite(d)){regionData(d).forEach(function(region){drawThemePortals(region,now);});return;}drawThemePortals(d,now);
  }
  function drawThemePortals(d,now){
    if(rot(d)){drawRotPortals(d,now);return;}if(cinder(d)){drawCinderPortals(d,now);return;}if(violet(d)){drawVioletPortals(d,now);return;}var time=ANIM.reduce?0:(now||0)/1000;
    d.portals.forEach(function(p){
      var w=p.w||1,h=p.h||1,state=portalVisibility(p),motionTime=state.visible?time:0;
      if(!state.known||p.x+w<camX||p.x>camX+viewW+1||p.y+h<camY||p.y>camY+viewH+1)return;
      var x=(p.x-camX+w*.5)*TS,y=(p.y-camY+h*.43)*TS,col=pairColor(p,d),a=state.visible?1:memA(.45),scale=Math.min(w,h),radius=TS*scale*.6;
      ctx.save();ctx.globalAlpha=a;var glow=ctx.createRadialGradient(x,y,0,x,y,radius);glow.addColorStop(0,'rgba(219,248,255,.42)');glow.addColorStop(.4,hexA(col,.24));glow.addColorStop(1,hexA(col,0));ctx.fillStyle=glow;ctx.fillRect(x-radius,y-radius,radius*2,radius*2);
      ctx.fillStyle=hexA(col,.2);ctx.beginPath();ctx.ellipse(x,y,TS*w*.21,TS*h*.29,0,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle=col;ctx.lineWidth=Math.max(1,TS*.027);ctx.beginPath();ctx.ellipse(x,y,TS*w*.22,TS*h*.3,0,0,Math.PI*2);ctx.stroke();
      for(var j=0;j<7;j++){var angle=motionTime*.48+j*Math.PI*2/7;ctx.globalAlpha=a*(.5+.3*Math.sin(angle+motionTime));ctx.fillStyle=j%3?'#F4E4BE':col;ctx.beginPath();ctx.arc(x+Math.cos(angle)*TS*w*.19,y+Math.sin(angle)*TS*h*.26,Math.max(.7,TS*.023),0,Math.PI*2);ctx.fill();}
      ctx.globalAlpha=a*.86;ctx.strokeStyle=col;ctx.beginPath();ctx.ellipse(x,(p.y-camY+h*.93)*TS,TS*w*.49,TS*h*.085,0,0,Math.PI*2);ctx.stroke();
      /* The paired marks bracket the new footprint; the normal set renderer
       * still draws its sole arch and controls character depth/occlusion. */
      [-1,1].forEach(function(side){var rx=x+side*TS*w*.53,ry=(p.y-camY+h*.92)*TS;polygon(ctx,[[rx,ry-TS*.07],[rx+TS*.04,ry],[rx,ry+TS*.07],[rx-TS*.04,ry]],col);});ctx.restore();
    });
  }
  var FOCAL_LIGHTS={
    'prism-lens':{color:'#6CCEFF',radius:4.4,strength:1.02},
    'prism-astrolabe':{color:'#F5D69B',radius:3.8,strength:.88},
    'prism-lectern':{color:'#9FDFFF',radius:3.8,strength:.94},
    'prism-tree':{color:'#A58AFF',radius:4.5,strength:1.06}
  };
  var CRYSTAL_LIGHTS={
    'crystal-water-small':{color:'#40BAFF',radius:3.2,strength:1,wallRadius:2.2,wallStrength:.5},
    'crystal-gold-small':{color:'#FFC04D',radius:3.2,strength:1,wallRadius:2.2,wallStrength:.5}
  };
  function addLights(list,now,position){
    var d=rawData();if(!d)return list;position=position||renderPos(player);
    if(!composite(d))return addThemeLights(list,d,now,position,false);
    // The existing player lamp receives exactly one local fill. All other
    // sources are selected by their own region, never by the player's region.
    for(var i=list.length-1;i>0;i--){var l=list[i];if(!revealAll&&(!inb(l.tx,l.ty)||!sceneVisibility()[idxOf(l.tx,l.ty)]))list.splice(i,1);}
    var regions=regionData(d),local=dataAt(player.x,player.y)||regions[0];
    addThemeLights(list,local,now,position,false);
    regions.forEach(function(region){if(region!==local)addThemeLights(list,region,now,position,true);});return list;
  }
  function addThemeLights(list,d,now,position,skipPlayer){
    skipPlayer=skipPlayer||(typeof FoteNormalLighting!=='undefined'&&FoteNormalLighting.enabled());
    if(rot(d))return addRotLights(list,d,now,position,skipPlayer);if(cinder(d))return addCinderLights(list,d,now,position,skipPlayer);if(violet(d))return addVioletLights(list,d,now,position,skipPlayer);
    /* A small cool fill keeps the nearby route legible. Each discovered
     * instrument lights its own pocket; no source washes the whole island. */
    if(!skipPlayer&&list[0]){list[0].s*=.64;list[0].c=hexRGB('#FFF0D8');}
    if(!skipPlayer)list.push({x:position.x,y:position.y,c:hexRGB('#C6DEFF'),r:6.5,s:.5,wall:true,wr:5,ws:.42,tx:player.x,ty:player.y});
    themedProps(d).forEach(function(p){
      var light=p.previewFocal?FOCAL_LIGHTS[p.artName]:p.previewDecor&&CRYSTAL_LIGHTS[p.name];if(!light)light=crystalSupportLight(p);if(!light||!portalVisibility(p).visible)return;
      addObjectLight(list,p,{x:p.x+((p.w||1)-1)/2,y:p.y+((p.h||1)-1)/2,c:hexRGB(light.color),r:light.radius,s:light.strength,height:light.height,wall:true,wr:light.wallRadius||light.radius,ws:light.wallStrength||.58,tx:p.x,ty:p.y});
    });
    d.portals.forEach(function(p){if(portalVisibility(p).visible)addObjectLight(list,p,{x:p.x+((p.w||1)-1)/2,y:p.y+((p.h||1)-1)/2,c:hexRGB(pairColor(p,d)),r:4,s:.96,wall:true,wr:4,ws:.5,tx:p.x,ty:p.y});});return list;
  }
  root.FoteChaosPreviewRenderer=Object.freeze({active:function(){return !!rawData();},mixed:mixed,themeAt:themeAt,withCell:withCell,surface:surface,terrainMaterial:terrainMaterial,objectArt:objectArt,doorPalette:doorPalette,drawVoid:drawVoid,drawPortals:drawPortals,addLights:addLights,
    ensureAssets:function(){return Promise.resolve();},reset:function(){cache=null;},diagnostics:function(){return {active:!!data(),biome:data()&&data().biome,builds:builds,cachedPixels:cache?cache.canvas.width*cache.canvas.height:0,materialCaches:surfaces.size,objectCaches:objectBuilds};}});
})(globalThis);

;
/* js/world/chaos/chaos-enemies.js */
/* Local Chaos combat content. All numbers are provisional endgame tuning.
 * The ordinary actor scheduler, damage pipeline and status clock own timing;
 * this module only describes one enemy decision and finite floor hazards. */
(function(root){
  'use strict';
  var groups={
    'prism-archives':['prism-seer','folded-horror','rift-skitter','lens-bearer'],
    'rot-hollows':['plague-bloat','brood-carrier','bile-spitter'],
    'cinder-bastion':['horned-reaver','gorehound','ironbound','chain-reaver'],
    'violet-warrens':['lash-dancer','razor-dancer','silk-weaver','hookfang']
  };
  var content={
    'prism-seer':{name:'Prism Seer',hp:225,dmg:[18,26],acc:76,eva:22,armor:2,speed:95,art:1.05,spellcaster:true},
    'folded-horror':{name:'Folded Horror',hp:270,dmg:[27,38],acc:73,eva:14,armor:4,speed:85,art:1.18},
    'rift-skitter':{name:'Rift Skitter',hp:225,dmg:[15,23],acc:75,eva:48,armor:1,speed:135,art:.75},
    'lens-bearer':{name:'Lens Bearer',hp:225,dmg:[11,15],acc:69,eva:15,armor:4,speed:90,art:1.05,el:'light'},
    'plague-bloat':{name:'Plague Bloat',hp:390,dmg:[30,42],acc:70,eva:9,armor:3,speed:65,art:1.28,poisonTrail:'plague'},
    'brood-carrier':{name:'Brood Carrier',hp:285,dmg:[14,21],acc:69,eva:12,armor:3,speed:85,art:1.14,broodKind:'chaos-rotling'},
    'bile-spitter':{name:'Bile Spitter',hp:225,dmg:[9,15],acc:73,eva:20,armor:2,speed:95,art:.9},
    'rotling':{name:'Rotling',hp:32,dmg:[11,15],acc:70,eva:26,armor:0,speed:125,art:.64,rots:true,tiny:true},
    'horned-reaver':{name:'Horned Reaver',hp:263,dmg:[27,38],acc:75,eva:18,armor:4,speed:95,art:1.08},
    'gorehound':{name:'Gorehound',hp:225,dmg:[21,30],acc:74,eva:24,armor:3,speed:110,art:1.0},
    'ironbound':{name:'Ironbound',hp:368,dmg:[18,26],acc:71,eva:10,armor:9,speed:75,art:1.16},
    'chain-reaver':{name:'Chain Reaver',hp:225,dmg:[17,26],acc:77,eva:21,armor:3,speed:95,art:1.03},
    'lash-dancer':{name:'Lash Dancer',hp:225,dmg:[18,26],acc:78,eva:42,armor:2,speed:110,art:1.02},
    'razor-dancer':{name:'Razor Dancer',hp:225,dmg:[18,26],acc:77,eva:46,armor:2,speed:130,art:.95},
    'silk-weaver':{name:'Silk Weaver',hp:225,dmg:[9,15],acc:74,eva:22,armor:2,speed:90,art:.93,broodKind:'chaos-spiderling'},
    'hookfang':{name:'Hookfang',hp:240,dmg:[24,33],acc:74,eva:18,armor:4,speed:100,art:1.04}
  };
  var immunities={
    'prism-seer':['blind'],'folded-horror':['fear'],'rift-skitter':['slow'],'lens-bearer':['stun'],
    'plague-bloat':['poison','slow'],'brood-carrier':['poison','fear'],'bile-spitter':['poison','blind'],'rotling':['poison','fear'],
    'horned-reaver':['fear'],'gorehound':['fear'],'ironbound':['stun','knockback'],'chain-reaver':['root'],
    'lash-dancer':['fear'],'razor-dancer':['slow'],'silk-weaver':['root'],'hookfang':['fear']
  };
  // Reuse the recorded creature voices. The shared combat and death pipelines
  // play these on the animation's impact frame; no per-turn vocal loops.
  var voices={
    'prism-seer':'wisp','folded-horror':'mimic','rift-skitter':'imp','lens-bearer':'elementaling',
    'plague-bloat':'zombie','brood-carrier':'slime','bile-spitter':'slime','rotling':'imp',
    'horned-reaver':'brute','gorehound':'hound','ironbound':'golem','chain-reaver':'brute',
    'lash-dancer':'drow','razor-dancer':'drow','silk-weaver':'spider','hookfang':'spider'
  };
  // Rewards remain stable across difficulty tuning and older sandbox saves.
  var rewards={'prism-seer':68,'folded-horror':81,'rift-skitter':68,'lens-bearer':68,
    'plague-bloat':117,'brood-carrier':86,'bile-spitter':68,'rotling':19,
    'horned-reaver':79,'gorehound':68,'ironbound':110,'chain-reaver':68,
    'lash-dancer':68,'razor-dancer':68,'silk-weaver':68,'hookfang':72};
  Object.keys(groups).forEach(function(biome){groups[biome].concat(biome==='rot-hollows'?['rotling']:[]).forEach(function(slug){
    var row=content[slug],kind='chaos-'+slug;row.sfx=voices[slug];
    if(slug==='lash-dancer'||slug==='razor-dancer'){row.spawnInvisible=true;}
    if(slug==='silk-weaver'||slug==='hookfang')row.spider=true;
    row.statusImmunities=immunities[slug];
    MONSTERS[kind]=Object.assign({sprite:'m-'+kind,ch:row.name.charAt(0),col:biome==='rot-hollows'?'#A0C85A':biome==='prism-archives'?'#84CCEE':biome==='cinder-bastion'?'#D97555':'#C998E8',
      range:1,xp:rewards[slug],band:[99,99],w:0,living:true,artLeft:false,chaosAI:true,chaosBiome:biome},row);
    if(row.poisonTrail&&typeof FoteGreenSlime!=='undefined')MONSTERS[kind].hint=FoteGreenSlime.trailDescription({kind:kind,base:MONSTERS[kind]});
    DROPS[kind]={chance:.22,table:{essence:12,gear:3,food:2}};
  });});
  // Weaver offspring reuse the native Spiderling, outside the ordinary Chaos
  // roster. Only the local AI/region and its recolored atlas differ.
  MONSTERS['chaos-spiderling']=Object.assign({},MONSTERS.spiderling,{sprite:'m-chaos-spiderling',chaosAI:true,chaosBiome:'violet-warrens',band:[99,99],w:0});
  DROPS['chaos-spiderling']=DROPS.spiderling;
  if(typeof STATUS_INFO!=='undefined'){
    STATUS_INFO.chaoslens={name:'Lens Shield',icon:'ic-arcane-ward',d:'Absorbs damage for up to 4 turns.'};
    STATUS_INFO.chaosbrace={name:'Iron Brace',icon:'ic-arcane-ward',d:'Stationary; takes 45% less damage for 2 turns.'};
  }
  var elements=['fire','ice','lightning'];
  function sound(from,name,volume){if(typeof sfx==='function')sfx(name,{vol:volume===undefined?.7:volume,from:from});}
  function castSound(element){return element==='poison'?'status-poison':element==='web'?'trap-web':element+'-cast';}
  function active(){return !!(floorMeta&&(floorMeta.chaosPreview||(floorMeta.ritualChaos||floorMeta.chaosIncursion)));}
  function state(){return floorMeta.chaosCombat||(floorMeta.chaosCombat={version:1,damageVersion:2,hazards:[],nextHazard:1});}
  function regionAt(x,y){return active()&&inb(x,y)?floorMeta.chaosPreview?floorMeta.chaosPreview.regionByCell[idxOf(x,y)]:'ritual-incursion':null;}
  function sameRegion(a,b){return !!regionAt(a.x,a.y)&&regionAt(a.x,a.y)===regionAt(b.x,b.y);}
  function now(){return worldNow();}
  function kindsForBiome(biome){return (groups[biome]||[]).map(function(slug){return 'chaos-'+slug;});}
  function spawnKinds(actor){var base=MONSTERS[actor.kind];return base&&base.broodKind?[base.broodKind]:[];}
  function spawnEnemy(kind,x,y,options){
    options=options||{};var base=MONSTERS[kind],region=regionAt(x,y);
    if(!active()||!base||!base.chaosAI||!region||!walkable(x,y)||at(x,y)===PORTAL||occupied(x,y)||options.regionId&&options.regionId!==region)return null;
    // spawnRaw remains the sole actor constructor. Its incidental castCd roll
    // is isolated so authoring a preview cannot consume combat/loot randomness.
    var previous=rng,e;
    try{rng=mulberry32(((floorMeta.chaosPreview?floorMeta.chaosPreview.seed:worldSeed)^x*73856093^y*19349663^nextId)>>>0);e=spawnRaw(kind,x,y);}finally{rng=previous;}
    e.state=options.state||'asleep';e.castCd=options.castCd===undefined?1:options.castCd;e.chaosRegionId=region;
    e.chaosCooldown=now()+100;e.chaosNextElement='fire';e.chaosBorn=0;e.beta11Balanced=true;
    if(options.offspring){e.noLoot=true;e.chaosOwnerId=options.ownerId;}
    return e;
  }
  function land(x,y,region){return inb(x,y)&&regionAt(x,y)===region&&walkable(x,y)&&at(x,y)!==CHASM&&at(x,y)!==PORTAL;}
  function line(e,target,max){
    if(!sameRegion(e,target)||dist(e,target)>max)return [];
    var path=boltPath(e.x,e.y,target.x,target.y),out=[];
    for(var i=0;i<path.length;i++){var p=path[i];if(!land(p.x,p.y,regionAt(e.x,e.y)))break;out.push([p.x,p.y]);if(ents.some(function(o){return o!==e&&o.hp>0&&entityOccupies(o,p.x,p.y)&&(o===target||FoteGeometry.projectileBlocker(o));}))break;}
    return out;
  }
  function reaches(tiles,target){return tiles.some(function(t){return t[0]===target.x&&t[1]===target.y;});}
  function targetFor(e){
    var candidates=[player].concat(ents.filter(function(o){return o!==player&&o.ally&&o.hp>0;})).filter(function(o){return o.hp>0&&sameRegion(e,o)&&(o===player?canSeePlayer(e):dist(e,o)<=6&&clearShot(e,o));});
    candidates.sort(function(a,b){
      var wound=e.kind==='chaos-razor-dancer'?(gameEffects.has(b,'bleed')?1:0)-(gameEffects.has(a,'bleed')?1:0):0;
      return wound||dist(e,a)-dist(e,b)||(a===player?-1:1);
    });return candidates[0]||null;
  }
  // Only the support calls for help. A call costs an action and cannot relay.
  function alertPack(e,target){
    if(!active()||!e||e.kind!=='chaos-lens-bearer'||e.chaosAlerted||!target)return false;
    var region=regionAt(e.x,e.y);if(!region||region!==regionAt(target.x,target.y))return false;
    e.chaosAlerted=true;
    var listeners=ents.filter(function(ally){return ally!==e&&ally.foe&&!ally.ally&&ally.hp>0&&ally.base&&ally.base.chaosAI&&
      (ally.state==='asleep'||ally.state==='wander')&&regionAt(ally.x,ally.y)===region&&dist(e,ally)<=5&&FoteEnemyTeamwork.openLine(e,ally);
    }).sort(function(a,b){return dist(e,a)-dist(e,b)||a.id-b.id;}).slice(0,2);
    listeners.forEach(function(ally){
      ally.state='hunt';ally.chaosAlerted=true;ally._lostFor=0;
      ally.lastSeen={x:target.x,y:target.y};
      if(typeof FoteEnemyPerception!=='undefined')FoteEnemyPerception.remember(ally,target,'call');
    });
    if(listeners.length&&vis[idxOf(e.x,e.y)]){log('Lens Bearer: help called.','c-you');floatText(e.x,e.y,'Help!','light');}
    return listeners.length>0;
  }
  function onDamaged(event){
    var e=event.target,source=event.source==='player'?player:event.source;
    if(event.damage>0&&e&&e.hp>0&&!e.ally&&e.base&&e.base.chaosAI&&source&&!(event.tags&&event.tags.has('periodic'))&&(source===player||source.ally)){
      if(typeof FoteEnemyPerception==='undefined'){e.state='hunt';e.lastSeen={x:source.x,y:source.y};}
    }
  }
  function victims(tiles){return [player].concat(ents.filter(function(o){return o!==player&&o.ally;})).filter(function(o){return o.hp>0&&reaches(tiles,o);});}
  function physical(e,target,mult,label){var result=attack(e,target,mult,label);return !!(result&&result.landed);}
  function afflict(e,target,key,turns){
    return gameEffects.apply(target,key,turns,undefined,{data:{sourceId:e.id,sourceX:e.x,sourceY:e.y}});
  }
  function direct(e,target,amount,type,area){
    var damage=applyDamage(target,amount,type,e,{tags:area?['area']:[]});floatText(target.x,target.y,String(damage),type,true);
    if(target===player&&damage>0)log(combatText(e.name)+' → you: '+combatDamageNumber(damage,type)+'.','c-you');if(target.hp<=0)kill(target,e);return damage;
  }
  function projectileVictim(e,w){
    var region=regionAt(e.x,e.y);
    for(var i=0;i<w.tiles.length;i++){
      var t=w.tiles[i];if(!land(t[0],t[1],region))return null;
      var victim=ents.find(function(o){return o!==e&&o.hp>0&&entityOccupies(o,t[0],t[1])&&(i===w.tiles.length-1||FoteGeometry.projectileBlocker(o));});
      if(player.hp>0&&player.x===t[0]&&player.y===t[1])victim=player;
      if(victim)return victim===player||victim.ally?victim:null;
    }return null;
  }
  function spellLands(e,target){
    recordHostileAttack(e,target,['attack','spell','ranged']);
    var chance=hitChance(accOf(e),evaOf(target));if(gameEffects.has(e,'blind'))chance*=.6;
    return target===player?!combatRoll(1-hostileHitChance(chance,true),true):rng()<chance;
  }
  function lensBeam(e,target){
    if(now()<(e.chaosBeamReadyAt||0)||dist(e,target)>6||!clearShot(e,target))return false;
    var tiles=line(e,target,6);if(!reaches(tiles,target))return false;
    var victim=projectileVictim(e,{tiles:tiles});if(!victim)return false;
    e.chaosLensActive=true;e.chaosBeamReadyAt=now()+600;revealActor(e);setClip(e,'attack');sound(e,'light-cast');boltFx(e.x,e.y,victim.x,victim.y,'light');
    if(spellLands(e,victim)){var damage=direct(e,victim,sDMG(24),'light',false);if(damage>0&&victim.hp>0)afflict(e,victim,'blind',2);}
    else floatText(victim.x,victim.y,'miss','miss');
    return true;
  }
  function lensShield(e,target){
    var ally=ents.filter(function(o){return o!==e&&o.foe&&!o.ally&&o.hp>0&&o.state==='hunt'&&o.kind!=='chaos-lens-bearer'&&sameRegion(e,o)&&dist(e,o)<=4&&!gameEffects.has(o,'chaoslens')&&clearShot(e,o);}).sort(function(a,b){return dist(a,target)-dist(b,target)||a.id-b.id;})[0];
    if(!ally)return false;
    revealActor(e);gameEffects.apply(ally,'chaoslens',4,undefined,{durationModifiers:false,refresh:'replace',data:{n:sHP(35),sourceId:e.id}});
    if(!actorConcealed(ally))boltFx(e.x,e.y,ally.x,ally.y,'light');setClip(e,'attack');sound(e,'light-cast',.55);
    e.chaosCooldown=now()+500;e.chaosLensActive=true;return true;
  }
  function area(cx,cy,r,region){var out=[];for(var y=cy-r;y<=cy+r;y++)for(var x=cx-r;x<=cx+r;x++)if(land(x,y,region))out.push([x,y]);return out;}
  function livingBrood(e){return ents.filter(function(o){return o.hp>0&&o.chaosOwnerId===e.id;}).length;}
  function broodLandings(e,target){
    var tiles=area(target.x,target.y,1,e.chaosRegionId).filter(function(t){
      var to={x:t[0],y:t[1]};return !occupied(to.x,to.y)&&reaches(line(e,to,6),to);
    });
    tiles.sort(function(a,b){return dist(e,{x:a[0],y:a[1]})-dist(e,{x:b[0],y:b[1]})||a[1]-b[1]||a[0]-b[0];});return tiles;
  }
  function releaseBrood(e,w){
    var count=Math.min(w.count,3-livingBrood(e)),children=[];
    for(var i=0;i<w.tiles.length&&children.length<count;i++){
      var cell=w.tiles[i],to={x:cell[0],y:cell[1]};
      if(!land(to.x,to.y,e.chaosRegionId)||occupied(to.x,to.y)||!reaches(line(e,to,6),to))continue;
      var child=spawnEnemy(w.childKind,to.x,to.y,{offspring:true,ownerId:e.id,state:'hunt',regionId:e.chaosRegionId});
      if(child){child.t=Math.max(player.t,now()+100);child.lastSeen={x:w.aim.x,y:w.aim.y};children.push(child);}
    }
    if(!children.length)return false;
    revealActor(e);setClip(e,'attack');e.chaosCooldown=now()+w.cooldown;e.chaosLastSpecial='brood';e.chaosBorn=(e.chaosBorn||0)+children.length;
    sound(e,w.childKind==='chaos-rotling'?'slime-split':'trap-web',.65);
    children.forEach(function(child){boltFx(e.x,e.y,child.x,child.y,w.element,{silentHit:true});});return true;
  }
  function throwBrood(e,target,kind,count,element,cooldown){
    if(dist(e,target)>6||livingBrood(e)>=3)return false;
    return immediate(e,'brood',broodLandings(e,target),'throws its brood',element,{childKind:kind,count:count,cooldown:cooldown,aim:{x:target.x,y:target.y}});
  }
  function poison(e,w,damage){
    var combat=state(),tiles=w.tiles.filter(function(t){return land(t[0],t[1],e.chaosRegionId);});if(!tiles.length)return;
    // One patch per source and eight per floor bound overlap and save size.
    combat.hazards=combat.hazards.filter(function(h){return h.sourceId!==e.id;});
    combat.hazards.push({id:combat.nextHazard++,sourceId:e.id,regionId:e.chaosRegionId,tiles:tiles,bornAt:now(),expiresAt:now()+300,damage:sDMG(damage),poisonTurns:w.poisonTurns||0,type:'poison',x:w.origin.x,y:w.origin.y});
    if(combat.hazards.length>8)combat.hazards.shift();tiles.forEach(function(t){burst(t[0],t[1],'poison',3,.03);});
  }
  function pull(e,target){
    if(gameEffects.blocked(target,'knockback'))return;
    for(var n=0;n<2&&dist(e,target)>1;n++){
      var dx=Math.sign(e.x-target.x),dy=Math.sign(e.y-target.y),x=target.x+dx,y=target.y+dy;
      if(!land(x,y,regionAt(target.x,target.y))||occupied(x,y)||dx&&dy&&!walkable(target.x+dx,target.y)&&!walkable(target.x,target.y+dy))break;
      target.x=x;target.y=y;
    }
  }
  function release(e,w){
    if(w.kind==='chaos-brood')return releaseBrood(e,w);
    revealActor(e);setClip(e,'attack');e.chaosCooldown=now()+500;
    // Physical specials already get their voice from attack(). Non-physical
    // releases need an audible cast even when their projectile misses.
    if(w.kind==='chaos-ray'||w.kind==='chaos-web')sound(e,castSound(w.element));
    else if(w.kind==='chaos-vent'||w.kind==='chaos-bile')sound(e,'trap-gas');
    var victim;
    if(w.kind==='chaos-ray'||w.kind==='chaos-harpoon'||w.kind==='chaos-web'){
      victim=projectileVictim(e,w);var end=w.tiles[w.tiles.length-1];boltFx(e.x,e.y,end[0],end[1],w.element);
      if(w.kind==='chaos-web'&&typeof FoteEnemyFields!=='undefined')FoteEnemyFields.web(victim?victim.x:end[0],victim?victim.y:end[1],e);
      if(victim){
        if(w.kind==='chaos-harpoon'){if(physical(e,victim,1.15,'Harpoon')&&victim.hp>0)pull(e,victim);}
        else if(spellLands(e,victim)){
          if(w.kind==='chaos-ray'){var damage=direct(e,victim,sDMG(36),w.element,false);if(damage>0&&victim.hp>0&&w.element==='ice')afflict(e,victim,'frozen',1);}
          else if(!gameEffects.hasTag(victim,'root')&&!gameEffects.hasTag(victim,'slow')){
            var web=gameEffects.apply(victim,'web',1);if(web.applied)victim.syllaWeb=3;
          }
        }else floatText(victim.x,victim.y,'miss','miss');
      }
      if(w.kind==='chaos-ray'){e.chaosElementIndex=((e.chaosElementIndex||0)+1)%elements.length;e.chaosNextElement=elements[e.chaosElementIndex];e.chaosCooldown=now()+600;}
    }else if(w.kind==='chaos-vent'||w.kind==='chaos-bile'){
      if(w.kind!=='chaos-bile'||w.aim&&reaches(line(e,w.aim,5),w.aim)){
        if(w.aim)boltFx(e.x,e.y,w.aim.x,w.aim.y,'poison');
        poison(e,w,w.kind==='chaos-vent'||w.poisonTurns?14:11);
      }
      if(e.kind==='chaos-brood-carrier')e.chaosLastSpecial='cloud';
    }
    else{
      // Reaching blows still obey the ordinary line and cover checks.
      victims(w.tiles).forEach(function(target){if(!reaches(line(e,target,2),target))return;var hit=physical(e,target,w.kind==='chaos-lash'?1.1:1.35,w.label);if(hit&&target.hp>0){
        if(w.kind==='chaos-lash')applyStatus(target,'bleed',3,sDMG(8));
        if(w.kind==='chaos-reach')afflict(e,target,'fear',2);
        if(w.kind==='chaos-cleave')afflict(e,target,'stun',1);
      }});
    }
  }
  function blink(e,target){
    if(!canActorMove(e)||e.chaosBlinkNeedsAttack)return false;
    var queue=[{x:e.x,y:e.y,n:0}],seenCells=new Set([idxOf(e.x,e.y)]),choices=[],region=e.chaosRegionId;
    for(var n=0;n<queue.length;n++){var p=queue[n];if(p.n>=3)continue;
      [[1,0],[-1,0],[0,1],[0,-1]].forEach(function(d){var x=p.x+d[0],y=p.y+d[1],i=idxOf(x,y);if(!land(x,y,region)||occupied(x,y)||seenCells.has(i))return;seenCells.add(i);var next={x:x,y:y,n:p.n+1};queue.push(next);
        if(vis[i]&&clearShot(e,next)&&dist(next,target)<=dist(e,target)&&dist(next,target)>1)choices.push(next);
      });
    }
    choices.sort(function(a,b){return Math.abs(dist(a,target)-2)-Math.abs(dist(b,target)-2)||b.n-a.n||a.y-b.y||a.x-b.x;});if(!choices.length)return false;
    var to=choices[0],concealed=actorConcealed(e);if(!concealed)sparkleFx(e.x,e.y,'light',10);e.x=to.x;e.y=to.y;e._lx=undefined;e._ly=undefined;if(typeof MOTION_STATE!=='undefined')MOTION_STATE.delete(e);if(!concealed)sparkleFx(e.x,e.y,'light',10);
    sound(e,'vanish',.5);e.chaosBlinkNeedsAttack=true;e.chaosCooldown=now()+500;return true;
  }
  function immediate(e,kind,tiles,label,element,extra){
    if(!tiles.length)return false;
    return release(e,Object.assign({kind:'chaos-'+kind,tiles:tiles,label:label,element:element||'phys',origin:{x:e.x,y:e.y}},extra||{}))!==false;
  }
  function rangedAttack(e,target){
    if(e.kind!=='chaos-prism-seer'&&e.kind!=='chaos-bile-spitter')return false;
    var range=e.kind==='chaos-prism-seer'?6:5,tiles=line(e,target,range);
    if(!reaches(tiles,target))return false;
    var type=e.kind==='chaos-prism-seer'?e.chaosNextElement:'poison';
    revealActor(e);setClip(e,'attack');sound(e,castSound(type));boltFx(e.x,e.y,target.x,target.y,type);
    if(spellLands(e,target)){
      var damage=direct(e,target,sDMG(e.kind==='chaos-prism-seer'?24:15),type,false);
      if(damage>0&&target.hp>0&&e.kind==='chaos-bile-spitter'&&now()>=(e.chaosDebuffReadyAt||0)){afflict(e,target,'blind',2);e.chaosDebuffReadyAt=now()+300;}
    }
    else floatText(target.x,target.y,'miss','miss');return true;
  }
  function approach(e,target){
    // Prefer a nearby free attack square instead of filing in behind the
    // nearest ally. Existing pathfinding still owns walls, traps and movement.
    if(!canActorMove(e))return false;
    var choices=area(target.x,target.y,1,e.chaosRegionId).filter(function(t){return !occupied(t[0],t[1])&&!(t[0]===target.x&&t[1]===target.y);});
    choices.sort(function(a,b){return dist(e,{x:a[0],y:a[1]})-dist(e,{x:b[0],y:b[1]});});
    return choices.length&&stepToward(e,choices[0][0],choices[0][1])||stepToward(e,target.x,target.y);
  }
  function leap(e,target){
    if(!canActorMove(e)||dist(e,target)<2||dist(e,target)>5||!sameRegion(e,target))return false;
    var path=boltPath(e.x,e.y,target.x,target.y),region=e.chaosRegionId,previous={x:e.x,y:e.y};
    if(path.length<2||path[path.length-1].x!==target.x||path[path.length-1].y!==target.y)return false;
    for(var n=0;n<path.length;n++){
      var p=path[n],dx=p.x-previous.x,dy=p.y-previous.y;
      if(!land(p.x,p.y,region)||dx&&dy&&!land(previous.x+dx,previous.y,region)&&!land(previous.x,previous.y+dy,region))return false;
      if(n<path.length-1&&occupied(p.x,p.y))return false;
      previous=p;
    }
    var to=path[path.length-2],from=typeof renderPos==='function'?renderPos(e):{x:e.x,y:e.y};
    revealActor(e);e.x=to.x;e.y=to.y;e.chaosCooldown=now()+400;
    // Reuse renderer-owned interpolation and its finite turn deadline. The
    // ordinary attack clip winds up in flight and its impact lands with the leap.
    if(typeof motionState==='function'&&typeof ANIM!=='undefined'&&!ANIM.reduce){
      var motion=motionState(e),start=Math.max(performance.now(),typeof fxClock==='number'?fxClock:0),duration=Math.max(180,Math.round(MOVE_MS*1.65));
      Object.assign(motion,{x:e.x,y:e.y,fx:from.x,fy:from.y,mt:start,dur:duration,lin:true,hopHeight:5});
      if(typeof fxClock==='number')fxClock=Math.max(fxClock,start+duration-(CLIP_WINDUP.attack||0));
    }
    physical(e,target,1.2,'Pounce');return true;
  }
  function special(e,target){
    var d=dist(e,target),region=e.chaosRegionId,tiles;
    switch(e.kind){
      case 'chaos-prism-seer':tiles=line(e,target,6);if(reaches(tiles,target))return immediate(e,'ray',tiles,'fires a '+FoteDamage.label(e.chaosNextElement)+' ray',e.chaosNextElement);break;
      case 'chaos-folded-horror':tiles=line(e,target,2);if(reaches(tiles,target))return immediate(e,'reach',tiles,'Heavy Reach');break;
      case 'chaos-rift-skitter':if(d>=2&&d<=5)return blink(e,target);break;
      case 'chaos-lens-bearer':
        return lensShield(e,target)||lensBeam(e,target);
      case 'chaos-plague-bloat':if(d<=2)return immediate(e,'vent',area(e.x,e.y,1,region),'vents poison','poison');break;
      case 'chaos-brood-carrier':
        if(d<=6&&livingBrood(e)<3)return throwBrood(e,target,MONSTERS[e.kind].broodKind,1,'poison',200);
        if(d<=5&&clearShot(e,target))return immediate(e,'bile',area(target.x,target.y,1,region),'launches infectious poison','poison',{aim:{x:target.x,y:target.y},poisonTurns:4});break;
      case 'chaos-bile-spitter':if(d>=2&&d<=5&&clearShot(e,target))return immediate(e,'bile',area(target.x,target.y,1,region),'spits a bile patch','poison',{aim:{x:target.x,y:target.y}});break;
      case 'chaos-horned-reaver':if(d<=1){var dx=Math.sign(target.x-e.x),dy=Math.sign(target.y-e.y);tiles=area(e.x,e.y,1,region).filter(function(t){return (t[0]-e.x)*dx+(t[1]-e.y)*dy>0;});return immediate(e,'cleave',tiles,'Frontal Cleave');}break;
      case 'chaos-gorehound':
        return leap(e,target);
      case 'chaos-ironbound':if(d<=4){gameEffects.apply(e,'chaosbrace',2,undefined,{durationModifiers:false,refresh:'replace'});e.chaosCooldown=now()+700;setClip(e,'attack');sound(e,'hit-armor',.55);floatText(e.x,e.y,'braced','phys');return true;}break;
      case 'chaos-chain-reaver':if(d>=2){tiles=line(e,target,6);if(reaches(tiles,target))return immediate(e,'harpoon',tiles,'casts its hooked harpoon');}break;
      case 'chaos-lash-dancer':tiles=line(e,target,2);if(reaches(tiles,target))return immediate(e,'lash',tiles,'lashes with a barbed whip','blood');break;
      case 'chaos-silk-weaver':
        if(d<=6&&livingBrood(e)<3)return throwBrood(e,target,MONSTERS[e.kind].broodKind,3,'web',500);
        if(d>=2&&!gameEffects.hasTag(target,'root')&&!gameEffects.hasTag(target,'slow')){tiles=line(e,target,5);if(reaches(tiles,target))return immediate(e,'web',tiles,'casts a silver web','web');}break;
    }return false;
  }
  function act(e){
    if(!active()||!e||!e.foe||!e.base||!e.base.chaosAI)return false;
    e.chaosRegionId=regionAt(e.x,e.y);e.chaosNextElement=e.chaosNextElement||elements[e.chaosElementIndex||0];
    // Old sandbox saves can carry queued warnings. Discard that intent and
    // make one fresh decision against the current target and legal terrain.
    if(e.windup&&e.windup.chaos)e.windup=null;
    if(gameEffects.has(e,'chaosbrace'))return true;
    if(e.state!=='hunt'){
      // Shared perception already tried noticing before this behavior.
      basicMonsterBehavior(e);return true;
    }
    var target=targetFor(e);
    if(!target){if(typeof FoteEnemyPerception!=='undefined')return FoteEnemyPerception.investigate(e);if(e.lastSeen&&sameRegion(e,e.lastSeen))stepToward(e,e.lastSeen.x,e.lastSeen.y);return true;}
    if(!e.chaosAlerted&&alertPack(e,target))return true;
    e.lastSeen={x:target.x,y:target.y};var d=dist(e,target);
    // Lens Bearers spend their action escaping close threats before casting.
    if(e.kind==='chaos-lens-bearer'&&d<3&&fleeStep(e,target))return true;
    if(e.kind==='chaos-lens-bearer'&&e.chaosLensActive&&lensBeam(e,target))return true;
    if(now()>=(e.chaosCooldown||0)&&special(e,target))return true;
    if(e.kind==='chaos-lens-bearer'){
      if(d>5&&stepToward(e,target.x,target.y))return true;
      // Stay in support range of a nearby ally without stepping into melee.
      var escort=ents.filter(function(o){return o!==e&&o.foe&&!o.ally&&o.hp>0&&o.state==='hunt'&&o.kind!=='chaos-lens-bearer'&&sameRegion(e,o)&&dist(e,o)<=6&&clearShot(e,o);}).sort(function(a,b){return dist(e,a)-dist(e,b)||a.id-b.id;})[0];
      if(escort&&dist(e,escort)>3){
        var safe=area(e.x,e.y,1,e.chaosRegionId).filter(function(t){var cell={x:t[0],y:t[1]};return !occupied(t[0],t[1])&&dist(cell,target)>=3&&dist(cell,escort)<dist(e,escort);});
        safe.sort(function(a,b){return dist({x:a[0],y:a[1]},escort)-dist({x:b[0],y:b[1]},escort);});
        if(safe.length&&stepToward(e,safe[0][0],safe[0][1]))return true;
      }
      lensShield(e,target);
      return true;
    }
    var reach=e.kind==='chaos-lash-dancer'||e.kind==='chaos-folded-horror'?2:1;
    if(d<=reach&&reaches(line(e,target,reach),target)){
      var hit=physical(e,target,e.kind==='chaos-razor-dancer'&&gameEffects.has(target,'bleed')?1.3:1);
      if(hit&&target.hp>0&&e.kind==='chaos-rift-skitter'&&now()>=(e.chaosDebuffReadyAt||0)){afflict(e,target,'slow',2);e.chaosDebuffReadyAt=now()+300;}
      e.chaosBlinkNeedsAttack=false;return true;
    }
    if(rangedAttack(e,target))return true;
    if((e.kind==='chaos-prism-seer'||e.kind==='chaos-bile-spitter'||e.kind==='chaos-silk-weaver')&&d<3&&fleeStep(e,target))return true;
    if(d>1)approach(e,target);return true;
  }
  function holdsPosition(e){return !!(active()&&e&&e.base&&e.base.chaosAI&&gameEffects.has(e,'chaosbrace'));}
  function cellAllowed(e,x,y){return !(active()&&e&&e.base&&e.base.chaosAI)||regionAt(x,y)===regionAt(e.x,e.y)&&at(x,y)!==PORTAL;}
  function damageRules(event){
    if(!active()||!event.target||!event.target.st)return true;
    var e=event.target;if(gameEffects.has(e,'chaosbrace'))event.amount*=.55;
    var shield=e.st.chaoslens;
    if(shield&&shield.t>0&&event.amount>0){var absorbed=Math.min(Math.max(0,shield.n||0),event.amount);shield.n-=absorbed;event.amount-=absorbed;if(absorbed)floatText(e.x,e.y,'-'+Math.round(absorbed),'light');if(shield.n<=0)gameEffects.remove(e,'chaoslens','depleted');if(event.amount<=0){event.amount=0;event.reason='lens-shield';return false;}}
    return true;
  }
  function globalPulse(clock){
    if(!active()||!floorMeta.chaosCombat)return;var combat=state();if(combat.lastPulse===clock)return;combat.lastPulse=clock;
    combat.hazards=combat.hazards.filter(function(h){return h.expiresAt>=clock;});
    [player].concat(ents.filter(function(e){return e!==player&&e.ally;})).forEach(function(victim){
      if(victim.hp<=0||gameEffects.airborne(victim))return;
      var patches=combat.hazards.filter(function(h){return h.bornAt<clock&&h.regionId===regionAt(victim.x,victim.y)&&reaches(h.tiles,victim);}).sort(function(a,b){return b.damage-a.damage;});if(!patches.length)return;
      var h=patches[0],source=ents.find(function(e){return e.id===h.sourceId;})||{name:'The poison cloud',foe:true,hp:0,base:{},x:h.x,y:h.y};
      var damage=direct(source,victim,h.damage,'poison',true);
      // Overlap pays direct damage once, but an infectious carrier cloud still
      // applies its shared status when a stronger ordinary patch overlaps it.
      var poisonTurns=patches.reduce(function(turns,patch){return Math.max(turns,patch.poisonTurns||0);},0);
      if(damage>0&&victim.hp>0&&poisonTurns>0)gameEffects.apply(victim,'poison',poisonTurns,undefined,{data:{damageScale:1.5}});
    });
    combat.hazards=combat.hazards.filter(function(h){return h.expiresAt>clock;});
  }
  function wash(x,y){
    var combat=floorMeta.chaosCombat;if(!combat)return;
    combat.hazards=combat.hazards.filter(function(h){h.tiles=h.tiles.filter(function(t){return t[0]!==x||t[1]!==y;});return h.tiles.length>0;});
  }
  root.FoteChaosEnemies=Object.freeze({kindsForBiome:kindsForBiome,spawnKinds:spawnKinds,spawn:spawnEnemy,act:act,holdsPosition:holdsPosition,cellAllowed:cellAllowed,damageRules:damageRules,onDamaged:onDamaged,globalPulse:globalPulse,wash:wash});
})(typeof window!=='undefined'?window:globalThis);

;
/* js/presentation/render/chaos-enemy-atlas.js */
/* Reviewed local Chaos creature sheets; excluded from the public build. */
globalThis.CHAOS_ENEMY_ATLAS={
  "m-chaos-prism-seer": {
    "file": "mob-m-chaos-prism-seer.webp",
    "cell": 192,
    "box": [
      43,
      24,
      106,
      152
    ],
    "static_row": 2,
    "clips": {
      "idle": {
        "row": 0,
        "frames": 9
      },
      "attack": {
        "row": 1,
        "frames": 9
      }
    },
    "artLeft": false
  },
  "m-chaos-folded-horror": {
    "file": "mob-m-chaos-folded-horror.webp",
    "cell": 192,
    "box": [
      16,
      51,
      160,
      125
    ],
    "static_row": 2,
    "clips": {
      "idle": {
        "row": 0,
        "frames": 9
      },
      "attack": {
        "row": 1,
        "frames": 9
      }
    },
    "artLeft": false
  },
  "m-chaos-lens-bearer": {
    "file": "mob-m-chaos-lens-bearer.webp",
    "cell": 192,
    "box": [
      25,
      24,
      141,
      152
    ],
    "static_row": 2,
    "clips": {
      "idle": {
        "row": 0,
        "frames": 9
      },
      "attack": {
        "row": 1,
        "frames": 9
      }
    },
    "artLeft": false
  },
  "m-chaos-bile-spitter": {
    "file": "mob-m-chaos-bile-spitter.webp",
    "cell": 192,
    "box": [
      16,
      52,
      160,
      124
    ],
    "static_row": 2,
    "clips": {
      "idle": {
        "row": 0,
        "frames": 9
      },
      "attack": {
        "row": 1,
        "frames": 9
      }
    },
    "artLeft": false
  },
  "m-chaos-brood-carrier": {
    "file": "mob-m-chaos-brood-carrier.webp",
    "cell": 192,
    "box": [
      18,
      24,
      155,
      152
    ],
    "static_row": 2,
    "clips": {
      "idle": {
        "row": 0,
        "frames": 9
      },
      "attack": {
        "row": 1,
        "frames": 9
      }
    },
    "artLeft": false
  },
  "m-chaos-rift-skitter": {
    "file": "mob-m-chaos-rift-skitter.webp",
    "cell": 192,
    "box": [
      16,
      39,
      160,
      137
    ],
    "static_row": 2,
    "clips": {
      "idle": {
        "row": 0,
        "frames": 9
      },
      "attack": {
        "row": 1,
        "frames": 9
      }
    },
    "artLeft": false
  },
  "m-chaos-rotling": {
    "file": "mob-m-chaos-rotling.webp",
    "cell": 192,
    "box": [
      16,
      27,
      160,
      149
    ],
    "static_row": 2,
    "clips": {
      "idle": {
        "row": 0,
        "frames": 9
      },
      "attack": {
        "row": 1,
        "frames": 9
      }
    },
    "artLeft": false
  },
  "m-chaos-plague-bloat": {
    "file": "mob-m-chaos-plague-bloat.webp",
    "cell": 192,
    "box": [
      16,
      30,
      160,
      146
    ],
    "static_row": 2,
    "clips": {
      "idle": {
        "row": 0,
        "frames": 9
      },
      "attack": {
        "row": 1,
        "frames": 9
      }
    },
    "artLeft": false
  },
  "m-chaos-horned-reaver": {
    "file": "mob-m-chaos-horned-reaver.webp",
    "cell": 192,
    "box": [
      32,
      24,
      128,
      152
    ],
    "static_row": 2,
    "clips": {
      "idle": {
        "row": 0,
        "frames": 9
      },
      "attack": {
        "row": 1,
        "frames": 9
      }
    },
    "artLeft": false
  },
  "m-chaos-gorehound": {
    "file": "mob-m-chaos-gorehound.webp",
    "cell": 192,
    "box": [
      16,
      37,
      160,
      139
    ],
    "static_row": 2,
    "clips": {
      "idle": {
        "row": 0,
        "frames": 9
      },
      "attack": {
        "row": 1,
        "frames": 9
      }
    },
    "artLeft": false
  },
  "m-chaos-chain-reaver": {
    "file": "mob-m-chaos-chain-reaver.webp",
    "cell": 192,
    "box": [
      24,
      24,
      144,
      152
    ],
    "static_row": 2,
    "clips": {
      "idle": {
        "row": 0,
        "frames": 9
      },
      "attack": {
        "row": 1,
        "frames": 9
      }
    },
    "artLeft": false
  },
  "m-chaos-ironbound": {
    "file": "mob-m-chaos-ironbound.webp",
    "cell": 192,
    "box": [
      20,
      24,
      151,
      152
    ],
    "static_row": 2,
    "clips": {
      "idle": {
        "row": 0,
        "frames": 9
      },
      "attack": {
        "row": 1,
        "frames": 9
      }
    },
    "artLeft": false
  },
  "m-chaos-lash-dancer": {
    "file": "mob-m-chaos-lash-dancer.webp",
    "cell": 192,
    "box": [
      38,
      24,
      115,
      152
    ],
    "static_row": 2,
    "clips": {
      "idle": {
        "row": 0,
        "frames": 9
      },
      "attack": {
        "row": 1,
        "frames": 9
      }
    },
    "artLeft": false
  },
  "m-chaos-razor-dancer": {
    "file": "mob-m-chaos-razor-dancer.webp",
    "cell": 192,
    "box": [
      16,
      32,
      160,
      144
    ],
    "static_row": 2,
    "clips": {
      "idle": {
        "row": 0,
        "frames": 9
      },
      "attack": {
        "row": 1,
        "frames": 9
      }
    },
    "artLeft": false
  },
  "m-chaos-hookfang": {
    "file": "mob-m-chaos-hookfang.webp",
    "cell": 192,
    "box": [
      16,
      51,
      160,
      125
    ],
    "static_row": 2,
    "clips": {
      "idle": {
        "row": 0,
        "frames": 9
      },
      "attack": {
        "row": 1,
        "frames": 9
      }
    },
    "artLeft": false
  },
  "m-chaos-silk-weaver": {
    "file": "mob-m-chaos-silk-weaver.webp",
    "cell": 192,
    "box": [
      16,
      51,
      160,
      125
    ],
    "static_row": 2,
    "clips": {
      "idle": {
        "row": 0,
        "frames": 9
      },
      "attack": {
        "row": 1,
        "frames": 9
      }
    },
    "artLeft": false
  }
};

;
/* js/presentation/render/chaos-spider-art.js */
/* Silk Weaver offspring reuse every native Spiderling frame and placement.
 * The only new material is the purple recolor; gameplay lives in Chaos AI. */
(function(root){
  'use strict';
  var source=root.ASSETS.mobs['m-spiderling'];
  if(!source)throw new Error('Native Spiderling artwork is required for Chaos Spiderlings.');
  var variant=JSON.parse(JSON.stringify(source));
  variant.file='mob-m-chaos-spiderling.webp';
  variant.artLeft=true;
  root.CHAOS_ENEMY_ATLAS['m-chaos-spiderling']=variant;
})(globalThis);

;
/* js/presentation/render/unmaker-atlas.js */
/* Reviewed local Unmaker form sheets; exact-reference PixelLab clips. */
globalThis.UNMAKER_ATLAS={
  "m-unmaker-tyrant": {
    "file": "mob-m-unmaker-tyrant.webp",
    "cell": 192,
    "box": [
      44,
      24,
      104,
      152
    ],
    "static_row": 2,
    "clips": {
      "idle": {
        "row": 0,
        "frames": 9
      },
      "attack": {
        "row": 1,
        "frames": 9
      },
      "walk": {
        "row": 0,
        "frames": 9
      },
      "melee": {
        "row": 1,
        "frames": 9
      },
      "cast": {
        "row": 1,
        "frames": 9
      },
      "ranged": {
        "row": 1,
        "frames": 9
      }
    },
    "artLeft": false
  },
  "m-unmaker-heart": {
    "file": "mob-m-unmaker-heart.webp",
    "cell": 192,
    "box": [
      51,
      24,
      90,
      152
    ],
    "static_row": 2,
    "clips": {
      "idle": {
        "row": 0,
        "frames": 9
      },
      "attack": {
        "row": 1,
        "frames": 9
      },
      "walk": {
        "row": 0,
        "frames": 9
      },
      "melee": {
        "row": 1,
        "frames": 9
      },
      "cast": {
        "row": 1,
        "frames": 9
      },
      "ranged": {
        "row": 1,
        "frames": 9
      }
    },
    "artLeft": false
  },
  "m-unmaker-unbound": {
    "file": "mob-m-unmaker-unbound.webp",
    "cell": 192,
    "box": [
      47,
      24,
      97,
      152
    ],
    "static_row": 2,
    "clips": {
      "idle": {
        "row": 0,
        "frames": 9
      },
      "attack": {
        "row": 1,
        "frames": 9
      },
      "walk": {
        "row": 0,
        "frames": 9
      },
      "melee": {
        "row": 1,
        "frames": 9
      },
      "cast": {
        "row": 1,
        "frames": 9
      },
      "ranged": {
        "row": 1,
        "frames": 9
      }
    },
    "artLeft": false
  }
};

;
/* js/presentation/render/chaos-enemy-art.js */
/* Optional local Chaos sheets feed the existing mob/clip/FX renderer.
 * No assets are requested until the combat preview explicitly awaits them. */
(function(root){
  'use strict';
  var names=['prism-seer','folded-horror','rift-skitter','lens-bearer','plague-bloat','brood-carrier','bile-spitter','rotling','horned-reaver','gorehound','ironbound','chain-reaver','lash-dancer','razor-dancer','silk-weaver','hookfang'].map(function(n){return 'm-chaos-'+n;});
  var loaded=new WeakMap(),pending=Object.create(null);
  function active(){return !!(typeof floorMeta!=='undefined'&&floorMeta&&((floorMeta.ritualChaos||floorMeta.chaosIncursion)||floorMeta.chaosPreview&&/^(chaos-mixed|unmaker-crucible)$/.test(floorMeta.chaosPreview.biome)));}
  function definitions(){return Object.assign({},root.CHAOS_ENEMY_ATLAS||{},root.UNMAKER_ATLAS||{});}
  function valid(spec){
    return spec&&typeof spec.file==='string'&&/^mob-m-(?:chaos|unmaker)-[a-z-]+\.webp$/.test(spec.file)&&Number.isInteger(spec.cell)&&spec.cell>0&&
      Number.isInteger(spec.static_row)&&spec.static_row>=0&&Array.isArray(spec.box)&&spec.box.length===4&&spec.box.every(Number.isFinite)&&
      spec.box[0]>=0&&spec.box[1]>=0&&spec.box[2]>0&&spec.box[3]>0&&spec.box[0]+spec.box[2]<=spec.cell&&spec.box[1]+spec.box[3]<=spec.cell&&
      spec.clips&&['idle','attack'].every(function(key){var clip=spec.clips[key];return clip&&Number.isInteger(clip.row)&&clip.row>=0&&Number.isInteger(clip.frames)&&clip.frames>1;});
  }
  function ready(requested){var specs=definitions();return (requested||names).every(function(name){var spec=specs[name],entry=spec&&loaded.get(ATL[spec.file]);return entry&&entry.source===spec;});}
  function load(name,spec){
    if(!valid(spec))return Promise.reject(new Error('Missing or invalid Chaos enemy atlas: '+name));
    return atlReady(spec.file,{retry:true}).then(function(img){
      var entry=loaded.get(img);if(entry&&entry.source===spec)return;
      var rows=Math.max(spec.static_row+1,spec.clips.idle.row+1,spec.clips.attack.row+1),cols=Math.max(spec.clips.idle.frames,spec.clips.attack.frames);
      if(img.naturalWidth<cols*spec.cell||img.naturalHeight<rows*spec.cell)throw new Error('Invalid Chaos enemy artwork dimensions: '+spec.file);
      loaded.set(img,{source:spec,sheet:{img:img,m:Object.assign({},spec,{chaos:true})}});
    });
  }
  function ensureAssets(requested){
    var selected=requested||names,key=selected.slice().sort().join(','),specs=definitions();
    if(pending[key]){selected.forEach(function(name){var spec=specs[name];if(valid(spec))atl(spec.file);});return pending[key];}
    pending[key]=Promise.all(selected.map(function(name){return load(name,specs[name]);})).then(function(){delete pending[key];},function(error){delete pending[key];throw error;});return pending[key];
  }
  function sheet(name){
    if(!active())return null;
    var spec=root.UNMAKER_ATLAS&&root.UNMAKER_ATLAS[name]||root.CHAOS_ENEMY_ATLAS&&root.CHAOS_ENEMY_ATLAS[name];if(!spec)return null;
    // The atlas owns image lifetime. Looking up a live actor also elects its
    // source for this scene; weak sheet metadata cannot pin a retired image.
    var img=atl(spec.file),entry=img&&loaded.get(img);
    if(entry&&entry.source===spec)return entry.sheet;
    ensureAssets([name]).catch(function(error){if(!error||error.atlasSceneRetired!==true)console.error(error);});
    return null;
  }
  function visible(x,y){return inb(x,y)&&(revealAll||sceneVisibility()[idxOf(x,y)]);}
  function drawHazards(now){
    if(!active())return;
    ((floorMeta.chaosCombat||{}).hazards||[]).forEach(function(hazard){
      var cells=hazard.tiles.map(function(tile){return idxOf(tile[0],tile[1]);});
      drawGroundMaterial('poison',cells,.92);drawFieldMist(cells,'#93ae64',now,.16);
    });
  }
  function drawActorCues(e,px,py,now){
    if(!active()||!e.base||!e.base.chaosAI||!actorVisible(e,false,sceneVisibility()))return;
    ctx.save();
    if(e.kind==='chaos-prism-seer'&&e.chaosNextElement){var col=DMG_COL[e.chaosNextElement]||'#EEE1B7';mark({fire:'\u2668',ice:'\u2744',lightning:'\u03DF'}[e.chaosNextElement]||'\u25C6',px+TS*.13,py-TS*.12,col);}
    var shield=e.st&&e.st.chaoslens;
    if(shield&&shield.n>0){
      ctx.strokeStyle='#9CDEFF';ctx.lineWidth=Math.max(1,TS*.035);ctx.globalAlpha=.65;ctx.beginPath();ctx.ellipse(px+TS*.5,py+TS*.5,TS*.43,TS*.52,0,0,Math.PI*2);ctx.stroke();
      var source=ents.find(function(actor){return actor.id===shield.sourceId&&actor.hp>0;});
      if(source&&actorVisible(source,false,sceneVisibility())){var position=renderPos(source);ctx.globalAlpha=.45;ctx.setLineDash([TS*.08,TS*.07]);ctx.beginPath();ctx.moveTo(px+TS*.5,py+TS*.55);ctx.lineTo((position.x-camX+.5)*TS,(position.y-camY+.55)*TS);ctx.stroke();ctx.setLineDash([]);}
    }
    if(e.st&&e.st.chaosbrace){ctx.strokeStyle='#FFE1A1';ctx.lineWidth=Math.max(2,TS*.06);ctx.beginPath();ctx.arc(px+TS*.5,py+TS*.55,TS*.44,Math.PI*.12,Math.PI*.88);ctx.stroke();}
    ctx.restore();
  }
  root.FoteChaosEnemyArt=Object.freeze({ready:ready,ensureAssets:ensureAssets,sheet:sheet,drawHazards:drawHazards,drawActorCues:drawActorCues});
})(globalThis);

;
/* js/world/chaos/chaos-encounters.js */
/* Local Chaos encounters use the ordinary actor table and turn scheduler.
 * Planning owns a separate seeded stream and never changes authored terrain. */
(function(root){
  'use strict';
  var groups={
    'prism-archives':['prism-seer','folded-horror','lens-bearer','rift-skitter','rift-skitter','rift-skitter'],
    'rot-hollows':['plague-bloat','plague-bloat','plague-bloat','brood-carrier','brood-carrier','bile-spitter'],
    'cinder-bastion':['ironbound','chain-reaver','horned-reaver','gorehound','horned-reaver','gorehound'],
    'violet-warrens':['lash-dancer','razor-dancer','hookfang','silk-weaver','hookfang','razor-dancer']
  };
  function distance(a,b){return Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y));}
  function active(){var p=floorMeta&&floorMeta.chaosPreview;return p&&p.biome==='chaos-mixed'?p:null;}
  function plan(preview,options){
    preview=preview||active();options=options||{};if(!preview||preview.biome!=='chaos-mixed')return [];
    var random=mulberry32(((Number.isFinite(options.seed)?options.seed:preview.seed)>>>0)^0x4368616F),out=[];
    var start=preview.spawn;
    function open(x,y){var p=inb(x,y)&&propAt(x,y);return inb(x,y)&&at(x,y)===FLOOR&&!p&&!ents.some(function(e){return e.hp>0&&e.x===x&&e.y===y;});}
    preview.regions.forEach(function(region){
      var baseRoster=groups[region.biome];if(!baseRoster)throw new Error('Unknown Chaos encounter biome: '+region.biome);
      var roster=baseRoster.concat(baseRoster);
      var safety=[{x:region.spawn.x,y:region.spawn.y}],candidates=[],chosen=[];
      preview.portals.filter(function(p){return p.regionId===region.id;}).forEach(function(p){
        safety.push(p.arrival);for(var y=p.y;y<p.y+(p.h||1);y++)for(var x=p.x;x<p.x+(p.w||1);x++)safety.push({x:x,y:y});
      });
      var bounds=region.bounds;
      for(var y=bounds.y;y<bounds.y+bounds.h;y++)for(var x=bounds.x;x<bounds.x+bounds.w;x++){
        var i=idxOf(x,y),point={x:x,y:y};
        if(preview.regionByCell[i]!==region.id||!open(x,y)||distance(point,start)<6||safety.some(function(p){return distance(point,p)<4;}))continue;
        var neighbors=[[1,0],[-1,0],[0,1],[0,-1]].filter(function(v){return open(x+v[0],y+v[1]);});
        if(neighbors.length<2||neighbors.length===2&&neighbors[0][0]+neighbors[1][0]===0&&neighbors[0][1]+neighbors[1][1]===0)continue;
        point.openNeighbors=neighbors.length;point.jitter=random();candidates.push(point);
      }
      // Four loose groups double the encounter density while keeping each
      // regional role in the same proportion. Try a tile of spacing first;
      // compact islands may use adjacent tiles without weakening safe buffers.
      var bestGroup=[];
      for(var attempt=0;attempt<64&&bestGroup.length<roster.length;attempt++){
        var separation=attempt<32?2:1;
        chosen=[];if(attempt)candidates.forEach(function(point){point.jitter=random();});
        for(var n=0;n<roster.length;n++){
          var group=Math.floor(n/3),anchor=chosen[group*3],best=null,bestScore=-Infinity;
          candidates.forEach(function(point){
            if(roster[n]==='gorehound'&&point.openNeighbors<3||chosen.some(function(p){return distance(point,p)<separation;}))return;
            var clearance=Math.min.apply(null,safety.map(function(p){return distance(point,p);}));
            var score=point.jitter*2+Math.min(10,clearance)*.15;
            if(anchor)score-=Math.abs(distance(point,anchor)-3)*.7;
            else if(chosen.length)score+=Math.min(12,Math.min.apply(null,chosen.map(function(p){return distance(point,p);})))*.55;
            if(score>bestScore){bestScore=score;best=point;}
          });
          if(!best)break;
          chosen.push({kind:'chaos-'+roster[n],x:best.x,y:best.y,regionId:region.id,biome:region.biome,group:group});
        }
        if(chosen.length>bestGroup.length)bestGroup=chosen;
      }
      // Safety never relaxes to squeeze encounters beside starts or portals.
      if(bestGroup.length<roster.length)throw new Error('Chaos island has no safe encounter space: '+region.id);
      out.push.apply(out,bestGroup);

    });
    return out;
  }
  function populate(preview,options){
    preview=preview||active();if(!preview||preview!==active())return null;
    if(preview.encounters)return preview.encounters;
    if(!root.FoteChaosEnemies)throw new Error('Chaos enemy behavior is not loaded.');
    var placements=plan(preview,options),spawned=[];
    placements.forEach(function(p){var e=root.FoteChaosEnemies.spawn(p.kind,p.x,p.y,{regionId:p.regionId,offspring:false,castCd:1});e.chaosEncounterGroup=p.group;spawned.push(e.id);});
    preview.encounters={version:1,seed:(options&&Number.isFinite(options.seed)?options.seed:preview.seed)>>>0,count:placements.length,actorIds:spawned,placements:placements};
    return preview.encounters;
  }
  root.FoteChaosEncounters=Object.freeze({plan:plan,populate:populate});
})(globalThis);

;
/* js/world/chaos/unmaker-encounter.js */
/* The Unmaker uses the ordinary actor, damage, status and turn pipelines.
 * Phase-two pylons are independent, save-backed world hazards, never actors. */
(function(root){
  'use strict';
  var unsubscribe=null;
  var retirementTimer=null,retirementQueued=null,retirementPrompt=null,retirementOnClose=null;
  var forms=[
    {kind:'unmaker-tyrant',name:'The Unmaker, Crowned Tyrant',dmg:[42,62],armor:10,speed:100,col:'#DFAC75'},
    {kind:'unmaker-unbound',name:'The Unmaker, the Unbound',dmg:[32,48],armor:7,speed:110,col:'#BFA0F0'},
    {kind:'unmaker-heart',name:'The Unmaker, Heart of Discord',dmg:[44,62],armor:5,speed:110,col:'#F4D5FF'}
  ];
  var elements=['fire','ice','lightning','light','dark'];
  var summonKinds=['chaos-horned-reaver','chaos-prism-seer','chaos-gorehound','chaos-lash-dancer','chaos-rotling'];
  var pylonSites=[{x:42,y:34,art:'crystal-air',color:'#91ECFF',label:'I'},
    {x:54,y:34,art:'crystal-violet',color:'#D2AEFF',label:'II'},
    {x:48,y:43,art:'crystal-gold',color:'#FFE193',label:'III'}];
  var hints=[
    'Keeps up to 3 Chaos demons at its side in every form. Shoulder Rush carries it up to 4 tiles toward you. Great Cleave marks the ground up to 2 tiles in front of it: circle its flank. It shrugs off Fear and Stun, but Blind, Root and Slow still work.',
    'Three floating Prism Pylons each mark a line and fire down it 2 turns later; the beam does not follow you. The Unbound takes turns casting Rupture and Inversion Pulse, and demons keep coming. Step off the marked tiles or behind cover. The pylons float, so they never block your way. It shrugs off Fear and Stun.',
    'Keeps up to 3 Chaos demons at its side in every form. Discord Pulse strikes the inner ring first, then the outer ring. You get a turn to move before each: step out, then back in. It shrugs off Fear and Stun.'
  ];
  forms.forEach(function(form,index){
    MONSTERS[form.kind]=Object.assign({hp:4500,acc:85,eva:24,range:1,xp:1500,band:[99,99],w:0,
      sprite:'m-'+form.kind,ch:'U',boss:true,living:true,encounterId:'unmaker',unmakerPhase:index+1,
      statusImmunities:['fear','stun'],footprint:2,big:2,art:1.8,artLeft:false,hint:hints[index]},form);
    DROPS[form.kind]={chance:0,table:{}};
  });
  function state(){return floorMeta&&floorMeta.unmakerEncounter||null;}
  function boss(){var s=state();return s&&ents.find(function(e){return e.id===s.bossId&&e.hp>0;})||null;}
  function owns(e){return !!(e&&e.base&&e.base.encounterId==='unmaker');}
  function clock(){return worldNow();}
  function animation(e,name,clip){e.unmakerAnimation=name;e.unmakerAnimationAt=performance.now();setClip(e,clip||'attack');}
  function arenaCell(x,y){
    var d=floorMeta&&floorMeta.unmakerPreview,p=inb(x,y)&&propAt(x,y);
    return !!(d&&inb(x,y)&&y>d.rearSeal.y&&y<d.entryGate.y&&floorMeta.chaosPreview.regionByCell[idxOf(x,y)]==='crucible'&&
      [FLOOR,OPEN].indexOf(at(x,y))>=0&&!(p&&p.b));
  }
  function clearLine(a,b){return clearShot(a,b);}
  function bodyFits(e,x,y){
    for(var yy=y;yy<y+entitySize(e);yy++)for(var xx=x;xx<x+entitySize(e);xx++)if(!arenaCell(xx,yy)||occupied(xx,yy,e))return false;
    return true;
  }
  function party(){return ents.filter(function(e){return e.hp>0&&(e===player||e.ally);});}
  function start(d){
    d=d||floorMeta.unmakerPreview;if(!d||d.gates.phase!=='ready'||player.hp<=0||state()&&state().status==='active')return false;
    var friends=party(),spots=[],anchor={x:47,y:48};
    for(var y=44;y<=50;y++)for(var x=42;x<=53;x++)if(arenaCell(x,y)&&!ents.some(function(e){return e.hp>0&&!friends.includes(e)&&e.x===x&&e.y===y;}))spots.push({x:x,y:y});
    spots.sort(function(a,b){return dist(a,anchor)-dist(b,anchor)||b.y-a.y||a.x-b.x;});
    if(spots.length<friends.length||!bodyFits({base:MONSTERS[forms[0].kind]},d.bossStart.x,d.bossStart.y))return false;
    friends.sort(function(a,b){return a===player?-1:b===player?1:a.id-b.id;});
    friends.forEach(function(e,index){e.x=spots[index].x;e.y=spots[index].y;e._lx=undefined;e._ly=undefined;});
    var e=spawnRaw(forms[0].kind,d.bossStart.x,d.bossStart.y);
    e.state='hunt';e.beta11Balanced=true;e.noReward=true;e.lastSeen={x:player.x,y:player.y};e.unmakerPhase=1;
    floorMeta.unmakerEncounter={version:1,status:'active',bossId:e.id,phase:1,warning:null,majorReadyAt:clock()+300,
      rushReadyAt:clock(),summonReadyAt:clock(),summoned:0,summonIds:[],majorCycle:0,elementIndex:0,basicCycle:0};
    floorMeta.boss=true;floorMeta.bossRewarded=false;RUN.bossDead=false;floorMeta.exitOpen=false;
    stopTravel();animation(e,'arrival','cast');sparkleFx(e.x,e.y,'magic',32);playSceneMusic();return true;
  }
  function phaseFor(e){return e.hp<=e.maxhp*.30?3:e.hp<=e.maxhp*.65?2:1;}
  function clearPylons(s){
    s.pylons=[];s.pylonPulseAt=null;
    floorMeta.planeLights=(floorMeta.planeLights||[]).filter(function(light){return !light.unmakerPylon;});
  }
  function ensurePylons(s){
    if(s.phase!==2||s.status!=='active'){clearPylons(s);return;}
    if(!Array.isArray(s.pylons)||s.pylons.length!==3){
      s.pylons=pylonSites.map(function(site,index){return {id:index,x:site.x,y:site.y,readyAt:clock()+100*(index+1),warning:null};});
      s.pylonPulseAt=clock();
    }
    floorMeta.planeLights=(floorMeta.planeLights||[]).filter(function(light){return !light.unmakerPylon;});
    s.pylons.forEach(function(p){floorMeta.planeLights.push({x:p.x,y:p.y,col:pylonSites[p.id].color,r:2.2,s:.8,unmakerPylon:true});});
  }
  function updatePhase(e,quiet){
    var s=state();if(!s||s.status!=='active'||!owns(e)||e.id!==s.bossId||e.hp<=0)return false;
    var phase=phaseFor(e),changed=phase!==s.phase,form=forms[phase-1];
    if(!changed&&e.kind===form.kind)return false;
    e.kind=form.kind;e.base=MONSTERS[form.kind];e.name=form.name;e.col=form.col;e.unmakerPhase=phase;
    e.dmg=form.dmg.map(function(d){return sDMG(d);});s.phase=phase;FoteContent.appearanceChanged(floorMeta);
    if(changed){
      s.warning=null;e.windup=null;s.majorReadyAt=clock()+200;s.summonReadyAt=clock();
      ensurePylons(s);
      if(!quiet){animation(e,'transition','cast');burst(e.x,e.y,phase===2?'magic':'light',38,.08);
        log(phase===2?'<b>The Unbound:</b> 3 Prism Pylons charge beams!':'<b>Heart of Discord:</b> demons incoming!','c-kill',{priority:'warning'});}
    }
    return changed;
  }
  function install(enabled){
    cancelRetirementPrompt();
    FoteUnmakerPreview.registerEncounter(enabled===false?null:start);
    if(!unsubscribe&&typeof gameDamage!=='undefined')unsubscribe=gameDamage.on('damageApplied',function(event){if(event.damage>0&&owns(event.target))updatePhase(event.target);});
    return true;
  }
  function restore(){
    var s=state(),ownPromptOpen=s&&retirementPrompt===s&&modalOpen;
    if(!ownPromptOpen)cancelRetirementPrompt();
    if(!s)return false;
    if(s.status==='active'){
      var e=boss();if(!e)return false;
      updatePhase(e,true);var form=forms[s.phase-1];e.kind=form.kind;e.base=MONSTERS[form.kind];e.name=form.name;e.unmakerPhase=s.phase;
      // Old saves may contain a boss-fired phase-two lance. Retire that old
      // pattern without damaging anyone; the new pylons receive a full warning.
      if(s.phase===2&&s.warning&&s.warning.kind==='beam')s.warning=null;
      ensurePylons(s);
      e.dmg=form.dmg.map(function(d){return sDMG(d);});e.windup=s.warning;e.state='hunt';e.beta11Balanced=true;
      // Saves from the one-cell preview may leave an edge against a pillar.
      // Repair only an invalid footprint; transformations keep their anchor.
      if(!bodyFits(e,e.x,e.y)){
        var land=[];for(var y=0;y<MH;y++)for(var x=0;x<MW;x++)if(bodyFits(e,x,y))land.push({x:x,y:y});
        land.sort(function(a,b){return Math.abs(a.x-e.x)+Math.abs(a.y-e.y)-Math.abs(b.x-e.x)-Math.abs(b.y-e.y)||a.y-b.y||a.x-b.x;});
        if(land.length){e.x=land[0].x;e.y=land[0].y;e._lx=undefined;e._ly=undefined;s.warning=null;e.windup=null;}
      }
      floorMeta.boss=true;floorMeta.unmakerPreview.layoutOnly=false;floorMeta.unmakerPreview.encounterImplemented=true;
    }
    // A saved or legacy death prompt never resumes itself. The Forge remains
    // available for an explicit interaction, including after a declined choice.
    if(s.status!=='active')clearPylons(s);
    if(s.status==='defeated'&&!ownPromptOpen)s.retirementPending=false;
    return true;
  }
  function targetFor(e){
    var candidates=party().filter(function(t){return typeof FoteEnemyPerception!=='undefined'?FoteEnemyPerception.sees(e,t):t!==player||canSeePlayer(e);});
    candidates.sort(function(a,b){return dist(e,a)-dist(e,b)||(a===player?-1:1);});
    if(candidates.length){e.lastSeen={x:candidates[0].x,y:candidates[0].y};return candidates[0];}
    return null;
  }
  function direct(e,target,amount,type){
    var damage=applyDamage(target,sDMG(amount),type,e,{tags:['area','unmaker']});floatText(target.x,target.y,String(damage),type,true);
    if(target===player&&damage>0)log('Unmaker → you: '+damage+' '+FoteDamage.label(type)+'.','c-you');if(target.hp<=0)kill(target,e);return damage;
  }
  function spell(e,target){
    recordHostileAttack(e,target,['attack','spell','ranged']);
    var s=state(),type=elements[s.elementIndex++%elements.length],chance=hitChance(accOf(e),evaOf(target));
    if(gameEffects.has(e,'blind'))chance*=.6;
    var origin=entityPoint(e,target);animation(e,'bolt','cast');boltFx(origin.x,origin.y,target.x,target.y,type);
    var landed=target===player?!combatRoll(1-hostileHitChance(chance,true),true):rng()<chance;
    if(landed)direct(e,target,s.phase===3?49:42,type);else floatText(target.x,target.y,'miss','miss');
  }
  function tilesAround(origin,minimum,maximum){
    var tiles=[];for(var y=origin.y-maximum;y<origin.y+entitySize(origin)+maximum;y++)for(var x=origin.x-maximum;x<origin.x+entitySize(origin)+maximum;x++){
      var p={x:x,y:y},d=dist(origin,p);if(d>=minimum&&d<=maximum&&arenaCell(x,y)&&clearLine(origin,p))tiles.push([x,y]);
    }return tiles;
  }
  function legalStep(from,to,e){
    if(!arenaCell(to.x,to.y)||entityOccupies(e,to.x,to.y))return false;
    if(ents.some(function(other){return other!==player&&other!==e&&other.foe&&other.hp>0&&entityOccupies(other,to.x,to.y);} ))return false;
    var dx=to.x-from.x,dy=to.y-from.y;return !(dx&&dy&&!arenaCell(from.x+dx,from.y)&&!arenaCell(from.x,from.y+dy));
  }
  function pendingTiles(exclude){
    var s=state(),tiles=[];if(!s)return tiles;
    if(s.warning&&s.warning!==exclude)tiles=tiles.concat(s.warning.tiles||[]);
    (s.pylons||[]).forEach(function(p){if(p.warning&&p.warning!==exclude)tiles=tiles.concat(p.warning.tiles);});return tiles;
  }
  function safePattern(tiles,e,fixed){
    // Leave a reachable response even where a wall, actor or island edge cuts
    // off the obvious escape. Gaps are fixed when the warning is shown.
    fixed=fixed||[];var held=new Set(fixed.map(function(t){return idxOf(t[0],t[1]);}));
    var marked=new Set(tiles.concat(fixed).map(function(t){return idxOf(t[0],t[1]);}));
    tiles.concat(fixed).forEach(function(t){
      var origin={x:t[0],y:t[1]},choices=[];
      for(var dy=-1;dy<=1;dy++)for(var dx=-1;dx<=1;dx++)if(dx||dy){var p={x:t[0]+dx,y:t[1]+dy};if(legalStep(origin,p,e))choices.push(p);}
      if(choices.some(function(p){return !marked.has(idxOf(p.x,p.y));}))return;
      choices=choices.filter(function(p){return !held.has(idxOf(p.x,p.y));});
      choices.sort(function(a,b){return dist(a,e)-dist(b,e);});
      if(choices.length)marked.delete(idxOf(choices[0].x,choices[0].y));else if(!held.has(idxOf(t[0],t[1])))marked.delete(idxOf(t[0],t[1]));
    });return tiles.filter(function(t){return marked.has(idxOf(t[0],t[1]));});
  }
  function planPulse(e){return {tiles:safePattern(tilesAround(e,1,1),e),outer:safePattern(tilesAround(e,2,4),e),origin:{x:e.x,y:e.y}};}
  function warn(e,kind,target){
    var s=state(),tiles=[],outer=null,origin={x:e.x,y:e.y};
    if(kind==='cleave'){
      var dx=Math.sign(target.x-e.x),dy=Math.sign(target.y-e.y);
      tiles=safePattern(tilesAround(e,1,2).filter(function(t){return (t[0]-e.x)*dx+(t[1]-e.y)*dy>0;}),e);
    }else if(kind==='rupture'){
      origin={x:target.x,y:target.y};
      for(var y=target.y-1;y<=target.y+1;y++)for(var x=target.x-1;x<=target.x+1;x++)if(arenaCell(x,y))tiles.push([x,y]);
      tiles=safePattern(tiles,e,pendingTiles());
    }else if(kind==='ring')tiles=safePattern(tilesAround(e,2,5),e,pendingTiles());
    else {var pulse=planPulse(e);tiles=pulse.tiles;outer=pulse.outer;}
    if(!tiles.length)return false;
    var w={unmaker:true,kind:kind,tiles:tiles,outer:outer,origin:origin,armedTurn:turn,beat:1,due:1};s.warning=w;e.windup=w;
    animation(e,kind==='pulse'?'pulse-inner':kind,'cast');log('<b>'+({cleave:'Great Cleave: circle its flank!',rupture:'Rupture: leave the marked ground!',ring:'Inversion Pulse: get in close!',pulse:'Discord Pulse: inner ring, then outer. Step out, then back in!'})[kind]+'</b>','c-info',{priority:'warning'});return true;
  }
  function release(e){
    var s=state(),w=s.warning;if(!w||turn<=w.armedTurn)return true;
    var marked=new Set(w.tiles.map(function(t){return idxOf(t[0],t[1]);})),type=w.kind==='cleave'?'phys':w.kind==='ring'?'lightning':'magic';
    animation(e,w.kind==='pulse'?(w.beat===1?'pulse-inner':'pulse-outer'):w.kind,'cast');
    w.tiles.forEach(function(t){burst(t[0],t[1],type,2,.02);});
    party().slice().forEach(function(target){if(marked.has(idxOf(target.x,target.y))&&(w.origin.x===target.x&&w.origin.y===target.y||clearLine(w.origin,target)))direct(e,target,w.kind==='cleave'?76:66,type);});
    if(w.kind==='pulse'&&w.beat===1){w.tiles=w.outer;w.outer=null;w.beat=2;w.armedTurn=turn;return true;}
    s.warning=null;e.windup=null;s.majorReadyAt=clock()+400;return true;
  }
  function beamTiles(p,target){
    var dx=target.x-p.x,dy=target.y-p.y;if(!dx&&!dy)dy=-1;
    var scale=40/Math.max(Math.abs(dx),Math.abs(dy));
    var path=[{x:p.x,y:p.y}].concat(boltPathRaw(p.x,p.y,Math.round(p.x+dx*scale),Math.round(p.y+dy*scale))),tiles=[];
    for(var i=0;i<path.length;i++){if(!arenaCell(path[i].x,path[i].y))break;tiles.push([path[i].x,path[i].y]);}return tiles;
  }
  function pylonTarget(p,e){
    var targets=party().filter(function(t){return t!==player||canSeePlayer(e);});
    targets.sort(function(a,b){return dist(p,a)-dist(p,b)||(a===player?-1:1);});return targets[0]||null;
  }
  function pulsePylons(now){
    var s=state(),e=boss();if(!s||s.status!=='active'||s.phase!==2||!e||player.hp<=0)return;
    if(s.pylonPulseAt!==null&&s.pylonPulseAt!==undefined&&now<=s.pylonPulseAt)return;
    s.pylonPulseAt=now;
    (s.pylons||[]).forEach(function(p){
      if(s.status!=='active'||s.phase!==2||e.hp<=0||player.hp<=0)return;
      var w=p.warning;if(!w||now<w.fireAt||turn<=w.armedTurn)return;
      var marked=new Set(w.tiles.map(function(t){return idxOf(t[0],t[1]);}));
      w.tiles.forEach(function(t){burst(t[0],t[1],'light',3,.025);});
      fx.push({k:'beam',tiles:w.tiles.slice(),col:pylonSites[p.id].color,t0:performance.now(),dur:ANIM.reduce?180:320});
      party().slice().forEach(function(target){
        if(!marked.has(idxOf(target.x,target.y)))return;
        var path=boltPathRaw(p.x,p.y,target.x,target.y);
        if(path.every(function(t){return arenaCell(t.x,t.y);}))direct(e,target,48,'light');
      });
      p.warning=null;p.readyAt=now+500;
    });
    if(player.hp<=0)return;
    (s.pylons||[]).forEach(function(p){
      if(s.status!=='active'||s.phase!==2||e.hp<=0)return;
      if(p.warning||now<p.readyAt)return;
      var target=pylonTarget(p,e);if(!target){p.readyAt=now+100;return;}
      var tiles=safePattern(beamTiles(p,target),e,pendingTiles());
      if(!tiles.length){p.readyAt=now+100;return;}
      p.warning={kind:'pylon-beam',tiles:tiles,origin:{x:p.x,y:p.y},armedTurn:turn,fireAt:now+200};
      log('<b>Pylon '+pylonSites[p.id].label+':</b> beam in 2 turns!','c-info');
    });
  }
  function rush(e,target){
    var s=state();if(s.phase!==1||clock()<s.rushReadyAt||dist(e,target)<2||dist(e,target)>7||!canActorMove(e)||!clearLine(e,target))return false;
    var steps=0;for(var i=0;i<4&&dist(e,target)>1;i++){
      var edge=entityPoint(e,target),dx=Math.sign(target.x-edge.x),dy=Math.sign(target.y-edge.y),nx=e.x+dx,ny=e.y+dy;
      if(!actorCellAllowed(e,nx,ny,dx,dy)||!bodyFits(e,nx,ny))break;e.x=nx;e.y=ny;steps++;
    }
    if(!steps)return false;s.rushReadyAt=clock()+400;animation(e,'rush','melee');
    if(dist(e,target)<=1)attack(e,target,1.15,'Shoulder Rush');return true;
  }
  function summon(e){
    var s=state();if(!s||s.status!=='active'||clock()<s.summonReadyAt)return false;
    var live=ents.filter(function(a){return a.hp>0&&a.unmakerOwnerId===e.id;});if(live.length>=3)return false;
    var spots=[];for(var y=e.y-4;y<=e.y+4;y++)for(var x=e.x-4;x<=e.x+4;x++)if(arenaCell(x,y)&&!occupied(x,y)&&dist(e,{x:x,y:y})>=2&&dist(player,{x:x,y:y})>=2)spots.push({x:x,y:y});
    spots.sort(function(a,b){return dist(a,player)-dist(b,player)||a.y-b.y||a.x-b.x;});
    var born=0;while(spots.length&&live.length+born<3&&born<2){
      var p=spots.shift(),kind=summonKinds[s.summoned%summonKinds.length],add=FoteChaosEnemies.spawn(kind,p.x,p.y,{state:'hunt',offspring:true,ownerId:e.id,castCd:0});
      if(!add)continue;add.unmakerOwnerId=e.id;add.chaosAlerted=true;add.lastSeen={x:player.x,y:player.y};add.t=clock()+100;
      s.summoned++;(s.summonIds||(s.summonIds=[])).push(add.id);born++;burst(add.x,add.y,'dark',20,.06);
    }
    if(!born)return false;s.summonReadyAt=clock()+400;animation(e,'summon','cast');log('<b>Chaos demons summoned!</b>','c-you');return true;
  }
  function act(e){
    var s=state();if(!s||s.status!=='active'||!owns(e)||e.hp<=0)return false;
    updatePhase(e);if(s.warning)return release(e);
    if(summon(e))return true;
    var target=targetFor(e);if(!target){if(typeof FoteEnemyPerception!=='undefined')return FoteEnemyPerception.investigate(e);if(e.lastSeen)stepToward(e,e.lastSeen.x,e.lastSeen.y);return true;}
    var distance=dist(e,target),clear=clearLine(e,target);
    if(clock()>=s.majorReadyAt&&clear){
      if(s.phase===1&&distance<=2&&warn(e,'cleave',target))return true;
      if(s.phase===2&&distance<=8){var kind=s.majorCycle++%2?'ring':'rupture';if(warn(e,kind,target))return true;}
      if(s.phase===3&&distance<=4&&warn(e,'pulse',target))return true;
    }
    if(rush(e,target))return true;
    if(distance<=1){animation(e,'melee','melee');if(s.phase===3&&s.basicCycle++%2)spell(e,target);else attack(e,target,1,s.phase===2?'Unbound Lash':undefined);return true;}
    if(s.phase>=2&&distance<=7&&clear){spell(e,target);return true;}
    stepToward(e,target.x,target.y);return true;
  }
  function onDefeated(e){
    var s=state();if(!s||s.status!=='active'||!owns(e)||e.id!==s.bossId||e.hp>0)return false;
    s.warning=null;e.windup=null;s.status='defeated';clearPylons(s);var removed=new Set([e.id].concat(s.summonIds||[]));
    ents=ents.filter(function(a){if(a.unmakerOwnerId===e.id){removed.add(a.id);burst(a.x,a.y,'magic',12,.04);return false;}return true;});
    if(floorMeta.chaosCombat)floorMeta.chaosCombat.hazards=(floorMeta.chaosCombat.hazards||[]).filter(function(h){return !removed.has(h.sourceId);});
    floorMeta.marks=(floorMeta.marks||[]).filter(function(m){return !m.unmaker&&!removed.has(m.sourceId);});
    floorMeta.bossRewarded=true;RUN.bossDead=true;animation(e,'death','death');burst(e.x,e.y,'light',70,.1);
    FoteUnmakerPreview.completeEncounter();playSceneMusic();log('<b>The Unmaker falls.</b> Use the Forge of the Elements when you are ready to restore balance.','c-kill');
    s.retirementPending=false;return true;
  }
  function cancelRetirementPrompt(){
    if(retirementTimer!==null)clearTimeout(retirementTimer);
    retirementTimer=null;retirementQueued=null;retirementPrompt=null;
    if(typeof modalOnClose!=='undefined'&&modalOnClose===retirementOnClose)modalOnClose=null;
    retirementOnClose=null;
  }
  function chooseRetirement(retire,expected){
    var s=state();if(!s||s!==expected||s.status!=='defeated'||RUN.over||RUN.victory||player.hp<=0)return false;
    s.retirementPending=false;s.retirementChoice=retire?'retire':'explore';
    var closeOwn=retirementPrompt===s;cancelRetirementPrompt();if(closeOwn&&modalOpen)closeModal();
    if(!retire){log('Your journey continues. Use the Forge again when you are ready to retire.','c-info');return true;}
    s.forgeRestored=true;s.retired=true;s.status='victory';
    log('<b>You restore the Forge of the Elements and retire. Balance returns to the material plane.</b>','c-kill');victory();return true;
  }
  function showRetirementPrompt(s){
    if(state()!==s||s.status!=='defeated'||!s.retirementPending||retirementPrompt===s)return false;
    retirementPrompt=s;retirementQueued=null;s.retirementOffered=true;
    stopTravel();
    openModal('Forge of the Elements',
      '<p>The elements gather at your touch. Would you like to restore balance and retire?</p><p><b>Retire</b> restores balance and ends this run with victory. <b>Keep exploring</b> leaves the run open; use this Forge again when you are ready.</p>',[
        {label:'Keep exploring',fn:function(){chooseRetirement(false,s);}},
        {label:'Retire',cls:'primary',fn:function(){chooseRetirement(true,s);}}
      ]);
    // Escape and the close button mean "keep exploring", never consent to win.
    retirementOnClose=function(){if(state()===s&&s.status==='defeated'&&s.retirementPending){s.retirementPending=false;s.retirementChoice='explore';}retirementPrompt=null;retirementOnClose=null;};
    modalOnClose=retirementOnClose;return true;
  }
  function queueRetirementPrompt(s){
    if(!s||retirementQueued===s||retirementPrompt===s)return;
    retirementQueued=s;var run=RUN,hero=player;
    function ready(){
      retirementTimer=null;
      if(state()!==s||RUN!==run||player!==hero||s.status!=='defeated'||!s.retirementPending||RUN.over||RUN.victory||player.hp<=0){if(retirementQueued===s)retirementQueued=null;return;}
      if(gameTurns.busy()){afterTurn(ready);return;}
      var now=performance.now(),until=now;
      if(typeof ANIM!=='undefined'&&!ANIM.reduce){
        until=Math.max(until,typeof fxClock==='number'?fxClock:0);
        if(typeof fx!=='undefined')fx.forEach(function(effect){if(effect.k==='d'&&Number.isFinite(effect.t0)&&Number.isFinite(effect.dur))until=Math.max(until,effect.t0+effect.dur);});
      }
      if(until>now||modalOpen){retirementTimer=setTimeout(ready,Math.max(30,Math.min(250,until-now||100)));return;}
      showRetirementPrompt(s);
    }
    // Finish the explicit interaction's action before showing its choice.
    retirementTimer=setTimeout(ready,0);
  }
  function forgeInfo(x,y){
    var d=floorMeta&&floorMeta.unmakerPreview,f=d&&d.trueForge,s=state();
    if(!f||x<f.x||y<f.y||x>=f.x+f.w||y>=f.y+f.h)return null;
    var near=!!player&&Math.max(Math.max(f.x-player.x,0,player.x-(f.x+f.w-1)),Math.max(f.y-player.y,0,player.y-(f.y+f.h-1)))<=1;
    return {name:'Forge of the Elements',x:f.x,y:f.y,w:f.w,h:f.h,near:near,ready:!!(s&&s.status==='defeated'),
      hint:s&&s.status==='defeated'?'Stand beside the Forge and click or tap it. You can restore balance and retire, or keep exploring.':'It will not wake until the Unmaker falls.'};
  }
  function interactForge(x,y){
    var f=forgeInfo(x,y),s=state();if(!f||!f.near||!f.ready||!s||player.hp<=0||RUN.over||RUN.victory||modalOpen)return false;
    s.retirementPending=true;s.retirementReason='forge-interaction';queueRetirementPrompt(s);return true;
  }
  function drawTelegraphs(now){
    var s=state();if(!s||s.status!=='active')return;var w=s.warning;
    ctx.save();if(w){drawBossDangerTiles(w.outer,2,now);drawBossDangerTiles(w.tiles,1,now);}
    (s.pylons||[]).forEach(function(p){
      var site=pylonSites[p.id],warning=p.warning;
      if(warning)drawBossDangerTiles(warning.tiles,Math.ceil((warning.fireAt-clock())/100),now);
      if(!(revealAll||sceneVisibility()[idxOf(p.x,p.y)]))return;
      var px=(p.x-camX)*TS,py=(p.y-camY)*TS;
      ctx.strokeStyle=site.color;ctx.lineWidth=Math.max(1,TS*.04);ctx.beginPath();ctx.ellipse(px+TS*.5,py+TS*.83,TS*.35,TS*.13,0,0,Math.PI*2);ctx.stroke();
      if(!spriteOn){ctx.fillStyle=site.color;ctx.fillRect(px+TS*.24,py+TS*.15,TS*.52,TS*.75);ctx.strokeStyle=warning?'#FFF4D1':'#302338';ctx.lineWidth=Math.max(2,TS*.05);ctx.strokeRect(px+TS*.24,py+TS*.15,TS*.52,TS*.75);}
      else if(typeof FoteUnmakerPylonArt==='undefined'||!FoteUnmakerPylonArt.draw(p,px,py,now))drawObj(objArt('props',site.art),px,py,{feet:true,fit:.98,alpha:.92});
      var label=site.label;
      ctx.font='bold '+Math.max(11,Math.round(TS*.22))+'px "IBM Plex Mono",monospace';ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.lineWidth=Math.max(3,TS*.07);ctx.strokeStyle='#241E35';ctx.strokeText(label,px+TS*.5,py-TS*.25);ctx.fillStyle=site.color;ctx.fillText(label,px+TS*.5,py-TS*.25);
      if(warning){
        var remaining=Math.max(0,Math.min(1,(warning.fireAt-clock())/200));
        ctx.fillStyle='rgba(30,25,43,.8)';ctx.fillRect(px+TS*.13,py-TS*.10,TS*.74,TS*.08);
        ctx.fillStyle=site.color;ctx.fillRect(px+TS*.15,py-TS*.08,TS*.70*remaining,TS*.04);
      }
    });ctx.restore();
  }
  root.FoteUnmakerEncounter=Object.freeze({install:install,start:start,act:act,updatePhase:updatePhase,onDefeated:onDefeated,
    forgeInfo:forgeInfo,interactForge:interactForge,restore:restore,drawTelegraphs:drawTelegraphs,state:state,boss:boss,summon:summon,planPulse:planPulse,pulsePylons:pulsePylons});
})(typeof window!=='undefined'?window:globalThis);

;
/* js/presentation/render/unmaker-pylon-art.js */
/* Dedicated Discord Prism animation. Presentation only; the encounter still
 * owns positions, warning deadlines, beams, damage, light and persistence. */
(function(root){
  'use strict';
  if(root.FoteUnmakerPylonArt)return;
  var metadata=null,image=null,pending=null,failure=null,retryAt=0;
  function redraw(){
    if(root.player&&root.map&&root.map.length&&root.vis&&root.vis.length===root.map.length&&root.seen&&root.seen.length===root.map.length&&typeof draw==='function')draw();
  }
  function ensureAssets(){
    if(pending)return pending;
    pending=fetch('art/packed/unmaker-pylon-animation.json',{cache:'no-cache'}).then(function(response){
      if(!response.ok)throw Error('Pylon animation metadata could not load.');return response.json();
    }).then(function(data){
      if(!Number.isInteger(data.cell)||data.cell<=0||!data.box||data.box.length!==4||!data.box.every(Number.isFinite)||data.box[2]<=0||data.box[3]<=0||!Number.isInteger(data.staticRow)||!data.clips||!data.clips.idle||!data.clips.charge)throw Error('Invalid pylon animation metadata.');
      ['idle','charge'].forEach(function(name){var clip=data.clips[name];if(!Number.isInteger(clip.row)||clip.row<0||!Number.isInteger(clip.frames)||clip.frames<2||!Number.isFinite(clip.fps)||clip.fps<=0)throw Error('Invalid pylon animation clip.');});
      metadata=data;
      return new Promise(function(resolve,reject){
        var sprite=new Image();
        sprite.onload=function(){
          var width=data.cell*Math.max(data.clips.idle.frames,data.clips.charge.frames),height=data.cell*(Math.max(data.staticRow,data.clips.idle.row,data.clips.charge.row)+1);
          if(sprite.naturalWidth!==width||sprite.naturalHeight!==height){reject(Error('Pylon animation sheet dimensions do not match its metadata.'));return;}
          image=sprite;failure=null;retryAt=0;redraw();resolve(root.FoteUnmakerPylonArt);
        };
        sprite.onerror=function(){reject(Error('Pylon animation sheet could not load.'));};
        sprite.src='art/packed/'+data.file+(root.ASSETS&&ASSETS.build?'?v='+ASSETS.build:'');
      });
    }).catch(function(error){failure=error;pending=null;retryAt=performance.now()+5000;throw error;});
    return pending;
  }
  function frame(pylon,now){
    if(!image||!metadata)return null;
    var reduced=typeof ANIM!=='undefined'&&ANIM.reduce,clip=metadata.clips[pylon.warning?'charge':'idle'],id=Number(pylon.id);
    var index=reduced?0:Math.floor((Math.max(0,Number.isFinite(now)?now:performance.now())+(Number.isFinite(id)?Math.max(0,id):0)*137)*clip.fps/1000)%clip.frames;
    return {sx:index*metadata.cell,sy:(reduced?metadata.staticRow:clip.row)*metadata.cell,sw:metadata.cell,sh:metadata.cell,index:index,clip:reduced?'static':pylon.warning?'charge':'idle'};
  }
  function drawPylon(pylon,px,py,now){
    var sample=frame(pylon,now);
    if(!sample){if(performance.now()>=retryAt)ensureAssets().catch(function(){});return false;}
    var box=metadata.box,scale=TS*.98/Math.max(box[2],box[3]);
    var left=px+TS*.5-(box[0]+box[2]/2)*scale,top=py+TS*.96-(box[1]+box[3])*scale;
    ctx.save();ctx.globalAlpha=.92;ctx.imageSmoothingEnabled=scale<1;
    ctx.drawImage(image,sample.sx,sample.sy,sample.sw,sample.sh,left,top,metadata.cell*scale,metadata.cell*scale);
    ctx.restore();return true;
  }
  root.FoteUnmakerPylonArt=Object.freeze({ensureAssets:ensureAssets,ready:function(){return !!image;},frame:frame,draw:drawPylon,error:function(){return failure;}});
})(globalThis);

;
/* js/world/chaos/chaos-entry-preview.js */
/* The quiet supply room between the Matron's floor and the Realm of Chaos.
 * Uses ordinary dungeon tiles, loot and portal artwork; no bespoke renderer. */
(function(root){
  'use strict';
  function active(){return floorMeta&&floorMeta.chaosEntryPreview||null;}
  function ensureForge(){
    if(!active())return false;
    var point=null,cells=[];
    for(var y=0;y<MH;y++)for(var x=0;x<MW;x++){
      if(at(x,y)===FORGE){point={x:x,y:y};break;}
      if(at(x,y)===FLOOR&&!propAt(x,y)&&!items.some(function(it){return it.x===x&&it.y===y;})&&
        !ents.some(function(e){return e.hp>0&&e.x===x&&e.y===y;}))cells.push({x:x,y:y});
    }
    if(!point){
      // Beside the portal, outside the treasure rows and the central approach.
      cells.sort(function(a,b){return Math.abs(a.x-24)+Math.abs(a.y-13)-Math.abs(b.x-24)-Math.abs(b.y-13)||a.y-b.y||a.x-b.x;});
      point=cells[0];if(!point)return false;
      map[idxOf(point.x,point.y)]=FORGE;
    }
    floorMeta.forge=true;floorMeta.forgeAt=point;return true;
  }
  function portalInfo(x,y){
    var entry=active();
    return entry&&x===entry.portal.x&&y===entry.portal.y&&at(x,y)===PORTAL?
      {name:'Portal to the Realm of Chaos',hint:'Leads to floor 21. Gather the supplies before stepping through; there are no god shrines beyond this room.'}:null;
  }
  function resetMotion(entity){entity._lx=undefined;entity._ly=undefined;delete entity._clip;if(typeof MOTION_STATE!=='undefined')MOTION_STATE.delete(entity);}
  function clearPresentation(){
    if(typeof stopTravel==='function')stopTravel();
    if(typeof PACING!=='undefined')PACING.pending=null;
    if(typeof fx!=='undefined')fx=[];if(typeof PARTS!=='undefined')PARTS.length=0;
    if(typeof fxClock!=='undefined')fxClock=0;
    if(typeof aiming!=='undefined')aiming=null;if(typeof BOWAIM!=='undefined')BOWAIM=null;
    if(typeof hoverX!=='undefined')hoverX=-1;if(typeof hoverY!=='undefined')hoverY=-1;
    if(typeof DEEP_AT!=='undefined')DEEP_AT=-1;if(typeof DEEP_RC!=='undefined')DEEP_RC=false;
    if(typeof resetGeneratedSurface==='function')resetGeneratedSurface(worldSeed);
  }
  function livingCompanions(){return (ents||[]).filter(function(e){return e!==player&&e.ally&&e.hp>0;});}
  function placeCompanions(companions){
    var reserved=new Set(ents.filter(function(e){return e.hp>0;}).map(function(e){return idxOf(e.x,e.y);}));
    companions.forEach(function(e){
      var cells=[];
      for(var y=0;y<MH;y++)for(var x=0;x<MW;x++)if(at(x,y)===FLOOR&&!propAt(x,y)&&!reserved.has(idxOf(x,y)))cells.push({x:x,y:y});
      cells.sort(function(a,b){return Math.max(Math.abs(a.x-player.x),Math.abs(a.y-player.y))-Math.max(Math.abs(b.x-player.x),Math.abs(b.y-player.y))||a.y-b.y||a.x-b.x;});
      if(!cells.length)throw new Error('The destination has no safe companion landing.');
      e.x=cells[0].x;e.y=cells[0].y;resetMotion(e);reserved.add(idxOf(e.x,e.y));ents.push(e);
    });
  }
  function build(seed){
    if(!player)throw new Error('Create the character before entering the Chaos supply room.');
    if(typeof gameTurns!=='undefined'&&gameTurns.busy())throw new Error('Finish the current turn before entering the Chaos supply room.');
    var companions=livingCompanions();
    seed=Number.isFinite(seed)?seed>>>0:92521;
    resetMapDimensions();var size=MW*MH;
    floorNo=20;worldSeed=seed;
    map=new Uint8Array(size).fill(WALL);seen=new Uint8Array(size);vis=new Uint8Array(size);
    ground=new Uint8Array(size);fireT=new Uint8Array(size);if(typeof fireSrc!=='undefined')fireSrc=new Uint8Array(size);
    props=[];propGrid=new Int16Array(size).fill(-1);feats=[];items=[];ents=[player];rooms=[];
    chestKind={};levers=[];plates=null;altars={};groundReset();spawnedExtra=99;nextSpawn=1e9;
    var room={id:0,x:20,y:10,w:16,h:13,cx:28,cy:16,role:'start',shape:'rect'};
    rooms.push(room);
    for(var y=room.y+1;y<room.y+room.h-1;y++)for(var x=room.x+1;x<room.x+room.w-1;x++)map[idxOf(x,y)]=FLOOR;
    var entry={version:1,seed:seed,spawn:{x:28,y:20},portal:{x:28,y:12},destinationFloor:21};
    map[idxOf(entry.portal.x,entry.portal.y)]=PORTAL;
    map[idxOf(entry.spawn.x,entry.spawn.y)]=UPSTAIRS;
    floorMeta={floor:20,biome:0,boss:false,forge:false,shrine:false,portal:'light',portalUsed:false,portalAt:entry.portal,
      upAt:entry.spawn,exitOpen:false,keyHolder:false,puzzles:[],searched:{},planeLights:[],chaosEntryPreview:entry,
      notes:['A quiet treasure room lies beneath the twentieth floor. Gather supplies and prepare at the forge before entering Chaos.','There are no god shrines in the Realm of Chaos.']};
    // Loot has its own stream, leaving the run's combat and item RNG untouched.
    var choose=mulberry32(seed^0x54726561),cells=[];
    for(var yy=14;yy<=19;yy++)for(var xx=22;xx<=33;xx++)if(xx!==28)cells.push({x:xx,y:yy});
    for(var n=cells.length-1;n>0;n--){var swap=Math.floor(choose()*(n+1)),held=cells[n];cells[n]=cells[swap];cells[swap]=held;}
    function put(item){var c=cells.pop();item.x=c.x;item.y=c.y;items.push(item);}
    for(var e=0;e<4;e++)put({kind:'essence',n:250,scaled:true});
    [['weapon',WEAPONS,['sword','dagger','mace','longsword','axe','bow','staff','wand','spear','censer']],
      ['armor',ARMORS,['leather','chain','plate','robe']],['off',OFFHANDS,['buckler','kite','orb','tome','holy']]].forEach(function(group){
      var keys=group[2].filter(function(key){return !!group[1][key];}),key=keys[Math.floor(choose()*keys.length)];
      var gear=JSON.parse(JSON.stringify(group[1][key]));gear.key=key;gear.kind=group[0];gear.tier=3;gear.plus=3;gear.cursed=false;gear.unid=false;
      delete gear.cursedOff;tierNormalize(gear);put({kind:group[0],it:gear});
    });
    ELEMENTS.forEach(function(el){put({kind:'mote',el:el});put({kind:'mote',el:el});});
    for(var f=0;f<4;f++)put({kind:'food',food:'ration'});
    player.x=entry.spawn.x;player.y=entry.spawn.y;ensureForge();placeCompanions(companions);
    function present(){resetMotion(player);ents.filter(function(e){return e!==player&&e.ally;}).forEach(resetMotion);clearPresentation();}
    if(typeof afterGeneratedInstall==='function')afterGeneratedInstall(present);else present();
    return entry;
  }
  function enterPortal(){
    if(!portalInfo(player.x,player.y)||typeof FoteChaosCampaign==='undefined')return Promise.resolve(false);
    return FoteChaosCampaign.enterRealm();
  }
  function prompt(){
    if(!portalInfo(player.x,player.y))return false;
    stopTravel();confirmBox('Enter the Realm of Chaos','The portal leads to <b>floor 21</b>. Collect any supplies you want to carry before leaving. There are no god shrines in Chaos.','Step through',enterPortal);
    return true;
  }
  root.FoteChaosEntryPreview=Object.freeze({active:active,build:build,ensureForge:ensureForge,portalInfo:portalInfo,prompt:prompt,enterPortal:enterPortal});
})(typeof window!=='undefined'?window:globalThis);

;
/* js/world/chaos/chaos-campaign.js */
/* Campaign travel owns the quiet supply room and the five Chaos floors.
 * Authored layouts, actors, floor snapshots and action timing keep their owners. */
(function(root){
  'use strict';
  var pending=null,prepared=false;
  function handles(n){return Number.isInteger(n)&&n>=21&&n<=25;}
  function entry(){return floorMeta&&floorMeta.chaosEntryPreview||null;}
  function prepare(){
    var names=Object.keys(root.CHAOS_ENEMY_ATLAS||{}).concat(['m-unmaker-tyrant','m-unmaker-unbound','m-unmaker-heart']);
    var crucible=floorMeta&&floorMeta.chaosPreview&&floorMeta.chaosPreview.biome==='unmaker-crucible';
    return Promise.all([root.FoteChaosPreviewRenderer.ensureAssets(),root.FoteChaosPreviewArt.ensureAssets(crucible?'unmaker-crucible':'chaos-mixed'),crucible?null:root.FoteChaosPreviewArt.ensureAssets('unmaker-forge'),root.FoteChaosEnemyArt.ensureAssets(names),root.FoteChaosCurrentRenderer.ensureAssets(),root.FoteUnmakerPylonArt.ensureAssets()]).then(function(art){prepared=true;return art;});
  }
  function currentAt(x,y){
    var meta=floorMeta&&floorMeta.chaosCampaign;if(!meta)return null;
    var direction=meta.upAt&&x===meta.upAt.x&&y===meta.upAt.y?'up':meta.downAt&&x===meta.downAt.x&&y===meta.downAt.y?'down':null;
    if(direction==='up'&&meta.materialGate)return null;
    if(!direction)return null;
    var destination=floorNo+(direction==='up'?-1:1),name=destination===20?'the treasure room':'floor '+destination;
    var point=direction==='up'?meta.upAt:meta.downAt;
    return {x:x,y:y,direction:direction,destinationFloor:destination,targetFloor:destination,dx:Number.isFinite(point.dx)?point.dx:0,dy:Number.isFinite(point.dy)?point.dy:-1,label:'Current to '+name,
      hint:'A magical current will carry you through the void to '+name+'.'};
  }
  function materialPortalInfo(x,y){
    var meta=floorMeta&&floorMeta.chaosCampaign;
    if(!meta||!meta.materialGate||floorNo!==21||x!==meta.upAt.x||y!==meta.upAt.y||at(x,y)!==PORTAL)return null;
    return {x:x,y:y,targetFloor:20,name:'Portal to the Material Plane',label:'Return to the Material Plane',hint:'This elemental gateway leads back to the treasure room beneath floor 20. The way to Chaos remains open.'};
  }
  function materialPortalPrompt(){
    var info=materialPortalInfo(player.x,player.y);if(!info)return false;
    var meta=floorMeta;stopTravel();
    setTimeout(function(){afterTurn(function(){
      if(floorMeta!==meta||player.hp<=0||RUN.over||RUN.victory||!materialPortalInfo(player.x,player.y))return;
      confirmBox(info.label,info.hint,'Step through',function(){if(!gameTurns.busy()&&floorMeta===meta&&materialPortalInfo(player.x,player.y))root.ascend();});
    });},0);return true;
  }
  function landing(preview,region){
    var choices=[],directions=[[0,-1],[1,0],[0,1],[-1,0]],bounds=region.bounds;
    function clear(x,y){return inb(x,y)&&preview.regionByCell[idxOf(x,y)]===region.id&&at(x,y)===FLOOR&&!propAt(x,y);}
    for(var y=bounds.y;y<bounds.y+bounds.h;y++)for(var x=bounds.x;x<bounds.x+bounds.w;x++){
      if(!clear(x,y)||preview.portals.some(function(p){return Math.max(Math.abs(p.x-x),Math.abs(p.y-y))<4;}))continue;
      var pad=true;for(var py=y-1;py<=y+1;py++)for(var px=x-1;px<=x+1;px++)if(!clear(px,py))pad=false;
      if(!pad)continue;
      directions.forEach(function(d){for(var n=2;n<=7;n++){
        var xx=x+d[0]*n,yy=y+d[1]*n;
        if(inb(xx,yy)&&at(xx,yy)===CHASM){choices.push({x:x,y:y,dx:d[0],dy:d[1],distance:n});break;}
        if(!clear(xx,yy))break;
      }});
    }
    choices.sort(function(a,b){return a.distance-b.distance||a.y-b.y||a.x-b.x;});
    if(!choices.length)throw new Error('Chaos island has no clear current landing: '+region.id);
    var point=choices[0];delete point.distance;return point;
  }
  function entryHint(){
    var current=currentAt(player.x,player.y);
    if(current){
      log(current.hint+' '+(document.body.classList.contains('touch')?'Tap it to travel.':'Press <b>'+(current.direction==='up'?'&lt;':'&gt;')+'</b> to ride the current.'),'c-kill');
      stopTravel();var meta=floorMeta;
      setTimeout(function(){afterTurn(function(){
        if(floorMeta!==meta||player.hp<=0||RUN.over||RUN.victory||player.x!==current.x||player.y!==current.y)return;
        confirmBox(current.label,current.hint,'Ride the current',function(){
          if(gameTurns.busy()||floorMeta!==meta||player.x!==current.x||player.y!==current.y)return;
          if(current.direction==='up')root.ascend();else root.descend();
        });
      });},0);return true;
    }
    if(entry()&&at(player.x,player.y)===UPSTAIRS){log('Stairs back to floor 20 and the Matron\'s hall.','c-kill');return true;}
    return false;
  }
  function build(n,seed,options){
    if(!handles(n))throw new Error('Chaos campaign floor must be between 21 and 25.');
    return generationTransaction(function(){return buildCandidate(n,seed,options);});
  }
  function buildCandidate(n,seed,options){
    options=options||{};
    if(options.encounters===undefined&&RUN&&RUN.sandbox&&RUN.sandbox.config&&RUN.sandbox.config.location==='chaos-current-preview'&&RUN.sandbox.config.encounters===false)options={encounters:false};
    var clock=player.t,preview;
    if(n===25){root.FoteUnmakerEncounter.install(true);preview=root.FoteUnmakerPreview.build(seed);}
    else preview=root.FoteMixedChaosPreview.build(seed,{campaign:true});
    floorNo=n;floorMeta.floor=n;rng=mulberry32(seed>>>0);
    var up=n===25?{x:preview.spawn.x,y:preview.spawn.y,dx:0,dy:1}:landing(preview,preview.regions[0]),down=null;
    if(n<25){var last=preview.regions[preview.regions.length-1];down=landing(preview,last);}
    if(propAt(up.x,up.y)||at(up.x,up.y)!==FLOOR)throw new Error('Chaos arrival current has no clear landing.');
    setT(up.x,up.y,n===21?PORTAL:UPSTAIRS);floorMeta.upAt=up;
    player.x=up.x;player.y=up.y;preview.spawn={x:up.x,y:up.y};
    if(down){if(propAt(down.x,down.y)||at(down.x,down.y)!==FLOOR)throw new Error('Chaos departure current has no clear landing.');setT(down.x,down.y,STAIRS);}
    floorMeta.chaosCampaign={version:1,upAt:up,downAt:down,materialGate:n===21};
    floorMeta.shrine=false;delete floorMeta.shrineGod;
    if(n<25){
      floorMeta.notes=['Five islands drift in the void, linked by paired portals. A magical current on the last island carries you deeper.','There are no god shrines in the Realm of Chaos.'];
      if(options.encounters!==false)root.FoteChaosEncounters.populate(preview,{seed:seed});
    }
    player.t=clock;if(typeof arriveRarePet==='function')arriveRarePet();ents.forEach(function(e){e.t=clock;});
    if(typeof computeFOV==='function')computeFOV();
    return preview;
  }
  function stashEntry(){
    if(!RUN||!entry())return false;
    RUN.chaosEntryStash=FoteTransitions.capture(gameState);return true;
  }
  function refresh(){computeFOV();resize();updateUI();draw();playSceneMusic();}
  function restore(){
    if(entry()){root.FoteChaosEntryPreview.ensureForge();return;}
    if(!floorMeta||!floorMeta.chaosCampaign)return;
    floorMeta.shrine=false;delete floorMeta.shrineGod;
    if(floorNo===25){root.FoteUnmakerEncounter.install(true);root.FoteUnmakerPreview.repairGates();root.FoteUnmakerPreview.ensurePreparationForge();root.FoteUnmakerEncounter.restore();}
  }
  function restoreEntry(arrival){
    var saved=RUN.chaosEntryStash;if(!saved)return false;
    FoteTransitions.restore(gameState,saved,20);delete RUN.chaosEntryStash;
    restore();
    presentRestoredFloor(arrival||{x:28,y:13});return true;
  }
  function descend(){
    if(!RUN||floorNo!==20||floorMeta.plane)return false;
    if(entry()){log('The portal leads to floor 21. Step into it to enter the Realm of Chaos.','c-info');return true;}
    if(!floorMeta.exitOpen){log('The Matron\'s gate is still sealed.','c-info');return true;}
    function move(){
      stashFloor();player.levitate=0;
      if(!restoreEntry(RUN.chaosEntryStash&&RUN.chaosEntryStash.floorMeta.upAt))root.FoteChaosEntryPreview.build((worldSeed^0x54726561)>>>0);
      afterGeneratedInstall(function(){sfx('stairs');aiming=null;log('Beyond the twentieth floor, a quiet treasure room waits before the portal to Chaos.','c-kill');refresh();writeSlot('auto','Chaos treasure room');});return true;
    }
    return RUN.chaosEntryStash?move():generationTransaction(move);
  }
  function ascend(){
    if(entry()){
      var saved=RUN.floorStash&&RUN.floorStash[20];
      if(!saved){log('The way back to the Matron\'s hall is not available in this scenario.','c-info');return true;}
      stashEntry();sfx('stairs');player.levitate=0;
      restoreFloor(20,findTileIn(saved,EXIT)||findTileIn(saved,STAIRS));
      log('You return to floor 20 and the Matron\'s hall.','c-kill');playSceneMusic();writeSlot('auto','floor 20');return true;
    }
    if(floorNo!==21||!floorMeta.chaosCampaign)return false;
    if(!RUN.chaosEntryStash){log('The upstream current fades before reaching the treasure room.','c-info');return true;}
    stashFloor();sfx('stairs');player.levitate=0;restoreEntry({x:28,y:13});
    log('You step through the elemental gateway into the treasure room.','c-kill');playSceneMusic();writeSlot('auto','Chaos treasure room');return true;
  }
  function enterRealm(){
    if(pending)return pending;
    if(!entry()||!RUN||RUN.over||RUN.victory||player.hp<=0||gameTurns.busy())return Promise.resolve(false);
    var run=RUN,from=floorMeta,hero=player;
    openModal('Entering the Realm of Chaos','The portal is opening…',[]);
    pending=prepare().then(function(){
      if(RUN!==run||floorMeta!==from||player!==hero||player.hp<=0||RUN.over||gameTurns.busy())return false;
      var prior=RUN.floorStash&&RUN.floorStash[21];
      if(prior){stashEntry();restoreFloor(21,prior.floorMeta.upAt);sfx('stairs');}
      else generationTransaction(function(){stashEntry();generateNextFloor(false);});
      closeModal();refresh();log('You step through the portal into <b>the Realm of Chaos</b>.','c-kill');
      writeSlot('auto','floor 21');return true;
    }).catch(function(error){
      if(RUN===run&&floorMeta===from)openModal('The portal could not open','Your character and the treasure room are unchanged. Please try again.',[{label:'Close',fn:closeModal}]);
      if(root.console&&console.error)console.error(error);return false;
    }).finally(function(){pending=null;});
    return pending;
  }
  root.FoteChaosCampaign=Object.freeze({handles:handles,prepare:prepare,prepared:function(){return prepared;},build:build,currentAt:currentAt,currentInfo:currentAt,materialPortalInfo:materialPortalInfo,materialPortalPrompt:materialPortalPrompt,entryHint:entryHint,stashEntry:stashEntry,restore:restore,descend:descend,ascend:ascend,enterRealm:enterRealm});
})(globalThis);

;
/* js/presentation/render/chaos-current-render.js */
/* Floor currents and the material gateway share the scene clock. This is presentation only: the normal
 * floor transition owns travel, saves, companions and destination selection. */
(function(root){
  'use strict';
  var gateFile='map-material-gateway.webp',gateReady=false,gateLoading=null;
  function materialGateAt(x,y){
    var entry=floorMeta&&floorMeta.chaosEntryPreview;
    if(entry&&entry.portal.x===x&&entry.portal.y===y)return true;
    return typeof FoteChaosCampaign!=='undefined'&&!!FoteChaosCampaign.materialPortalInfo(x,y);
  }
  function ensureAssets(){
    if(gateReady)return Promise.resolve();if(gateLoading)return gateLoading;
    gateLoading=atlReady(gateFile,{retry:true}).then(function(){gateReady=true;}).finally(function(){gateLoading=null;});return gateLoading;
  }
  function drawGate(x,y,px,py,alpha){
    if(!materialGateAt(x,y))return false;
    var image=atl(gateFile);if(!image)return true;
    var h=TS*2.5,w=h*image.naturalWidth/image.naturalHeight;
    ctx.save();ctx.globalAlpha=alpha;ctx.drawImage(image,px+TS*.5-w*.5,py+TS*.96-h,w,h);
    if(typeof FoteNormalLighting!=='undefined')FoteNormalLighting.record(ctx,{img:image,sx:0,sy:0,sw:image.naturalWidth,sh:image.naturalHeight},{x:px+TS*.5-w*.5,y:py+TS*.96-h,w:w,h:h},{normal:false});
    ctx.restore();return true;
  }
  function gateShimmer(p,now){
    var i=idxOf(p.x,p.y);if(!(revealAll||seen[i]))return;
    var alpha=revealAll||sceneVisibility()[i]?1:memA(.4),t=ANIM.reduce||!sceneVisibility()[i]?0:(now||0)/1000,cx=(p.x-camX+.5)*TS,cy=(p.y-camY+.06)*TS;
    ctx.save();ctx.globalAlpha=alpha*.55;
    var glow=ctx.createRadialGradient(cx,cy,TS*.08,cx,cy,TS*.7);glow.addColorStop(0,'rgba(128,224,255,.35)');glow.addColorStop(1,'rgba(96,153,255,0)');
    ctx.fillStyle=glow;ctx.beginPath();ctx.ellipse(cx,cy,TS*.5,TS*.75,0,0,Math.PI*2);ctx.fill();
    for(var n=0;n<10;n++){var a=n*2.39+t*.6,r=.10+(n%4)*.09,q=(t*.21+n*.173)%1;ctx.globalAlpha=alpha*Math.sin(q*Math.PI)*.8;ctx.fillStyle=n%3?'#B5EEFF':'#EEE0FF';var xx=cx+Math.cos(a)*TS*r,yy=cy+Math.sin(a)*TS*r*1.6,size=TS*.022;ctx.fillRect(xx-size,yy-size,size*2,size*2);}
    ctx.restore();
  }
  function currentAt(x,y){return typeof FoteChaosCampaign!=='undefined'&&FoteChaosCampaign.currentInfo(x,y);}
  function draw(x,y,px,py,alpha,now){
    var c=currentAt(x,y);if(!c)return false;
    var visible=revealAll||sceneVisibility()[idxOf(x,y)],t=ANIM.reduce||!visible?0:(now||0)/1000;
    var dx=Number.isFinite(c.dx)?c.dx:1,dy=Number.isFinite(c.dy)?c.dy:0;
    var cx=px+TS*.5,cy=py+TS*.58;
    function point(q,strand){
      var sway=Math.sin(q*5.5-t*1.6+strand*.65)*(.07+q*.18),spread=(strand-3)*.055;
      return [cx+TS*(dx*q*3.7-dy*(sway+spread)),cy+TS*(dy*q*3.7+dx*(sway+spread)-q*q*.6)];
    }
    ctx.save();ctx.globalAlpha=alpha;
    // A shallow pool of light marks the boarding square, without a portal arch.
    var glow=ctx.createRadialGradient(cx,cy,TS*.04,cx,cy,TS*.8);
    glow.addColorStop(0,'rgba(207,255,255,.72)');glow.addColorStop(.4,'rgba(89,215,242,.26)');glow.addColorStop(1,'rgba(107,150,246,0)');
    ctx.fillStyle=glow;ctx.beginPath();ctx.ellipse(cx,cy,TS*.82,TS*.49,0,0,Math.PI*2);ctx.fill();
    ctx.lineCap='round';ctx.lineJoin='round';
    // Long open ribbons lead away through the void; there is no doorway/ring.
    for(var layer=0;layer<2;layer++)for(var strand=0;strand<7;strand++){
      var end=point(1,strand),gradient=ctx.createLinearGradient(cx,cy,end[0],end[1]);
      var rgb=strand%3===0?'188,154,255':strand%3===1?'97,223,248':'218,252,255';
      gradient.addColorStop(0,'rgba('+rgb+','+(layer?.95:.16)+')');gradient.addColorStop(.56,'rgba('+rgb+','+(layer?.72:.09)+')');gradient.addColorStop(1,'rgba('+rgb+',0)');
      ctx.strokeStyle=gradient;ctx.lineWidth=TS*(layer?.025:.11);ctx.beginPath();
      for(var n=0;n<=28;n++){var p=point(n/28,strand);if(n)ctx.lineTo(p[0],p[1]);else ctx.moveTo(p[0],p[1]);}ctx.stroke();
    }
    // Shared-time sparks travel along the flow rather than spinning in place.
    for(var i=0;i<15;i++){
      var q=(i*.173+t*.30)%1,p=point(q,i%7),size=TS*(.025+.018*Math.sin(q*Math.PI));
      ctx.globalAlpha=alpha*Math.sin(q*Math.PI)*.9;ctx.fillStyle=i%3===0?'#D6BCFF':'#E5FFFF';
      ctx.beginPath();ctx.moveTo(p[0],p[1]-size*1.8);ctx.lineTo(p[0]+size,p[1]);ctx.lineTo(p[0],p[1]+size*1.8);ctx.lineTo(p[0]-size,p[1]);ctx.closePath();ctx.fill();
    }
    ctx.restore();return true;
  }
  function addLights(lights,now){
    var m=floorMeta&&floorMeta.chaosCampaign,entry=floorMeta&&floorMeta.chaosEntryPreview;
    (entry?[entry.portal]:m?[m.upAt,m.downAt]:[]).filter(Boolean).forEach(function(p){
      if(!(revealAll||seen[idxOf(p.x,p.y)]))return;
      lights.push({x:p.x,y:p.y,c:hexRGB('#9DEEFF'),r:3.2,s:.85,tx:p.x,ty:p.y});
    });return lights;
  }
  function drawAll(now){
    var m=floorMeta&&floorMeta.chaosCampaign,entry=floorMeta&&floorMeta.chaosEntryPreview;
    (entry?[entry.portal]:m?[m.upAt,m.downAt]:[]).filter(Boolean).forEach(function(p){
      var index=idxOf(p.x,p.y);if(!(revealAll||seen[index]))return;
      if(p.x<camX-4||p.x>camX+viewW+4||p.y<camY-4||p.y>camY+viewH+4)return;
      if(materialGateAt(p.x,p.y))gateShimmer(p,now);
      else draw(p.x,p.y,(p.x-camX)*TS,(p.y-camY)*TS,revealAll||sceneVisibility()[index]?1:memA(.4),now);
    });
  }
  root.FoteChaosCurrentRenderer=Object.freeze({draw:draw,drawGate:drawGate,drawAll:drawAll,addLights:addLights,ensureAssets:ensureAssets,materialGateAt:materialGateAt});
})(globalThis);

;
/* js/combat/shadow-clone.js */
/* Umbral Passage's echo is an ordinary saved ally with an immutable numeric
 * combat snapshot. It never swaps the live player or borrows mutable gear. */
(function(root){
  'use strict';
  var types=['phys','fire','ice','lightning','poison','light','dark','magic'];
  function copy(value){return value===undefined?undefined:JSON.parse(JSON.stringify(value));}
  function isClone(e){return !!(e&&e.shadowClone&&e.cloneStats);}
  function migrateSnapshot(s){
    if((s.version||1)<3){
      // Older echoes saved the base and gear multiplier before Agility's perks.
      // Use their own frozen stats and gear, never the current player's build.
      s.criticalMultiplier=FoteActions.criticalMultiplier(s.stats&&s.stats.agi,(s.criticalMultiplier||1.6)-1.6);
      s.version=3;
    }
  }
  function statModel(p){var out={};['name','race','cls','level','god','piety','stats','aff','buffs','sets','activeSet','off','rings','armorItem','forgeHeat'].forEach(function(k){out[k]=copy(p[k]);});out.st={livingmountain:copy(p.st&&p.st.livingmountain)};return out;}
  function buffed(e){return Object.keys(e.buffs||{}).some(function(k){return k!=='hardened'&&e.buffs[k]>0;})||e.cloneExtraBuff>0||!!(e.st.livingmountain&&e.st.livingmountain.t>0);}
  function refreshStats(e){
    var s=e.cloneStats;migrateSnapshot(s);if(!s.statModel)return;
    var model=Object.assign({},s.statModel,{buffs:e.buffs,st:{livingmountain:e.st.livingmountain},forgeHeat:e.cloneForgeHeat}),now=FoteStats.compute(model,statContent());
    ['acc','eva','armor','crit','block','parry','speed'].forEach(function(k){e[k]=s[k]+now[k]-s.statInitial[k];if(['acc','eva','armor','speed'].includes(k))e.base[k]=e[k];});
    if(!(e.buffs.ironhide>0))e.hideShield=0;
  }
  function snapshot(){
    var p=player,perks=copy(p.passives||{}),rank=godRank(),hpRate=(.20+.02*Math.max(0,p.stats.vit-10))/100;
    if(bodyArmor(p).enchant==='light')hpRate*=1+enchantValues('armor','light').hpRegen;
    if(hasGod('grumbok'))hpRate*=1+.20*rank;if(hasGod('glimmer'))hpRate*=1+.10*rank;
    var off=p.twoHanded?null:p.off,orb=off&&focusKey(off)==='orb'?off.enchant:null,weapon=p.weapon||{},focus=['staff','wand'].includes(itemKey(weapon))||weapon.spell;
    var resist={},contexts={},arm=bodyArmor(p);
    types.forEach(function(type){
      resist[type]=resistMult(p,type);
      contexts[type]={player:true,armorResistance:arm.enchant&&elemToType(arm.enchant)===type?enchantValues('armor',arm.enchant).resistance:0,
        tomeResistance:infusion('tome')==='earth'?enchantValues('tome','earth').resistance:0,godResistance:hasGod('grumbok')?.04*rank:0,
        water:aff('water'),vitality:p.stats.vit,bulwark:!!perks.bulwark,lightVulnerable:p.race==='gloomling',
        courtOpposite:p.race==='fae'&&p.court?elemToType(OPPOSITE[p.court]):null,warding:ringVal('warding'),
        immune:Object.keys(IMMUNE_TYPE).some(function(el){return IMMUNE_TYPE[el]===type&&aff(el)>=6;}),
        divine:divineStrength()};
    });
    var timing=Object.assign({},playerTiming(),{attacking:false,casting:true,free:false,chill:0,slow:0});
    var model=statModel(p),extraBuff=Math.max(p.levitate||0,p.hidden||0,p.st&&p.st.stone&&p.st.stone.t||0,p.st&&p.st.aura&&p.st.aura.t||0);
    var immunities=[];Object.keys(FoteEffects.registry).forEach(function(key){var d=FoteEffects.registry[key];if(d.element&&(p.aff[d.element]||0)>=(d.immuneRank||3))immunities.push(key);});
    if(perks.unstoppable)immunities.push('slow','root','stun','knockback');
    return {version:3,stats:copy(p.stats),aff:copy(p.aff),passives:perks,resist:resist,resistanceContexts:contexts,
      statModel:model,statInitial:FoteStats.compute(model,statContent()),timing:timing,stormTurns:Math.max(0,(p.stormUntil||0)-p.t)/100,extraBuff:extraBuff,
      spellPowerBase:spellPower()/(buff('rally')?1.1:1),holyAir:infusion('holy')==='air',holyReduction:infusion('holy')==='air'?enchantValues('holy','air').actionTimeReduction:0,
      holyCrit:infusion('holy')==='shadow'?enchantValues('holy','shadow').critChance:0,holyFire:infusion('holy')==='fire'?enchantValues('holy','fire').damageBonus:0,holyEarth:infusion('holy')==='earth'?enchantValues('holy','earth').damageReduction:0,
      reginaldRank:hasGod('reginald')?rank:0,divine:divineStrength(),
      hp:p.hp,maxhp:p.maxhp,mp:p.mp,maxmp:p.maxmp,acc:p.acc,eva:p.eva,armor:p.armor,crit:p.crit,block:p.block||0,parry:p.parry||0,speed:p.speed,buffs:copy(p.buffs||{}),
      spellPower:spellPower(ABILITIES.shadowbolt),range:spellRange(ABILITIES.shadowbolt),criticalMultiplier:criticalMultiplier(),critBonus:actionCritBonus(p),rootCrit:orb==='earth'?enchantValues('orb','earth').critChance:0,
      castCost:FoteCosts.action(timing),immunities:immunities,blur:!!perks.blur,deflect:armorDeflectChance(),luck:luckBonus(),
      wardChance:p.block>0?p.block:Math.min(.40,.25+.01*Math.max(0,p.stats.mig-10)),laststand:buff('laststand'),spellWard:!!perks.spellWard,
      magicBarrier:!!perks.magicBarrier,fortitude:!!perks.fortitude,fortUntil:p.fortUntil||0,earth:p.aff.earth||0,
      hpRate:hpRate,mending:mendingRate(ringVal('mending')),fed:p.hunger>0,foodRegen:buff('regeneration')?.01:0,sanctuaryBonus:.25*divineStrength(),
      mpRate:(.60+.05*Math.max(0,p.stats.foc-10))/100*(perks.meditation?1.25:1),manaflow:buff('manaflow')?.009:0,
      shield:off&&off.block>0?{element:off.enchant,values:copy(enchantValues('shield',off.enchant))}:null,
      orb:orb?{element:orb,values:copy(enchantValues('orb',orb))}:null,
      weapon:focus&&weapon.enchant?{element:weapon.enchant,values:copy(enchantValues('weapon',weapon.enchant))}:null,
      tomeHeal:off&&focusKey(off)==='tome'&&off.enchant==='shadow'?enchantValues('tome','shadow').killHeal:0,
      burn:burnDmg(),syllaDuration:syllaOn()&&rank>=5?1:0,
      pools:FoteCosts.shields(p).map(function(pool){return {key:pool.key,amount:pool.amount};}),iceArmorMax:p.iceArmorMax||0,guardMax:p.guardMax||0,
      look:playerCastLook(),race:p.race,gender:p.gender,face:p.face,appearance:{weapon:copy(p.weapon),off:copy(p.off),armorItem:copy(p.armorItem),twoHanded:p.twoHanded}};
  }
  function create(x,y,s){
    if(!s||!walkable(x,y)||occupied(x,y))return null;
    migrateSnapshot(s);
    ents=ents.filter(function(e){return !isClone(e)||e.cloneOwnerId!==player.id;});
    var e=spawnRaw('shadowclone',x,y);
    Object.assign(e,{foe:false,ally:true,state:'ally',name:player.name+'\'s Shadow',shadowClone:true,cloneOwnerId:player.id,cloneStats:s,cloneLook:s.look,
      hp:s.hp,maxhp:s.maxhp,mp:s.mp,maxmp:s.maxmp,acc:s.acc,eva:s.eva,armor:s.armor,crit:s.crit,block:s.block,parry:s.parry,speed:s.speed,
      st:{},buffs:copy(s.buffs),t:player.t+Math.max(1,s.castCost)+1,noXp:true,noReward:true,cloneBornAt:worldNow(),clonePulseAt:worldNow(),lastDamageTime:worldNow(),
      iceArmorMax:s.iceArmorMax,guardMax:s.guardMax,fortUntil:s.fortUntil,face:s.face,race:s.race,gender:s.gender});
    e.cloneStormTurns=s.stormTurns||0;e.cloneExtraBuff=s.extraBuff||0;e.cloneForgeHeat=copy(s.statModel&&s.statModel.forgeHeat);
    if(s.statModel&&s.statModel.st.livingmountain)e.st.livingmountain=copy(s.statModel.st.livingmountain);
    e.base=Object.assign({},MONSTERS.shadowclone,{acc:s.acc,eva:s.eva,armor:s.armor,speed:s.speed,statusImmunities:s.immunities.slice()});
    Object.assign(e,copy(s.appearance));s.pools.forEach(function(pool){e[pool.key]=pool.amount;});
    if(typeof murkSummonHp==='function')murkSummonHp(e);
    RUN.shadowClone=e;sparkleFx(x,y,'dark',24);return e;
  }
  function damage(e,target,amount,type,extra){
    return applyDamage(target,amount,type,e,Object.assign({tags:['proc','shadow-clone']},extra||{}));
  }
  function effectOptions(e){return {sourceAffinity:copy(e.cloneStats.aff),sourcePoint:{x:e.x,y:e.y},data:{sourceAffinity:copy(e.cloneStats.aff),sourceDuration:e.cloneStats.syllaDuration},durationModifiers:false,bossControl:true};}
  function status(e,target,key,turns,amount){return gameEffects.apply(target,key,turns+e.cloneStats.syllaDuration,amount,effectOptions(e));}
  function attackView(e,options){
    refreshStats(e);options=options||{};var s=e.cloneStats,appearance=s.appearance||e;
    var model=Object.assign({},s.statModel||{name:e.name,race:s.race,cls:'fighter',level:1,stats:s.stats,aff:s.aff,sets:[appearance.weapon||FISTS],rings:[],off:appearance.off},
      {buffs:e.buffs,st:{livingmountain:e.st.livingmountain},forgeHeat:e.cloneForgeHeat});
    if(options.offhand)model.off=EMPTY_OFF;
    var stats=FoteStats.compute(model,statContent(),{weapon:options.weapon||appearance.weapon||FISTS});
    return Object.assign({},e,model,stats,{x:e.x,y:e.y,hp:e.hp,maxhp:e.maxhp,st:e.st,passives:s.passives||stats.passives});
  }
  function heal(e,amount){
    if(gameEffects.has(e,'rot'))amount*=.5;
    gameDamage.heal(e,amount,e);
  }
  function weaponHit(event,strike,dealt){
    var e=event.source,target=event.target,view=event.view,s=e.cloneStats,bonus={};
    if(!(dealt>0))return bonus;
    function extra(type,amount,tags){var n=damage(e,target,amount,type,{tags:['proc','shadow-clone'].concat(tags||[]),actionId:event.actionId});if(n>0)bonus[type]=(bonus[type]||0)+n;}
    var el=view.weapon&&view.weapon.enchant,v=el&&enchantValues('weapon',el,view),raw=strike.base;
    if(el==='fire'){extra('fire',Math.round(raw*v.extraDamage),['enchant']);if(rng()<v.burnChance)status(e,target,'burn',v.burnDuration,s.burn);}
    if(el==='water'&&rng()<v.chillChance)gameEffects.addChill(target,effectOptions(e));
    if(el==='earth'&&rng()<v.rootChance)status(e,target,'root',v.rootDuration);
    if(el==='shadow'){
      var dark=target.st.corrupt?v.corruptDamage||0:0;
      if(rng()<v.procChance){dark+=Math.round(raw*v.extraDamage);status(e,target,'corrupt',v.corruptDuration);}
      if(dark>0){extra('dark',dark,['enchant']);if((s.aff.shadow||0)>=6&&target.hp>0)addHollow(target,1);}
    }
    if(el==='light'&&v.healPerHit>0)heal(e,v.healPerHit);
    if(el==='air'&&!event.label&&target.hp>0&&rng()<v.repeatChance)event.pendingExtra=target;
    if(s.aff.fire)extra('fire',s.aff.fire,['fire-affinity']);
    if(e.buffs.moltenring>0)extra('fire',5,['molten-ring']);
    var orb=s.orb;if(strike.crit&&orb){v=orb.values;
      if(orb.element==='water')e.iceArmor=Math.min(e.iceArmorMax,(e.iceArmor||0)+v.iceArmor);
      if(orb.element==='air'&&target.hp>0)status(e,target,'stun',v.stunDuration);
      if(orb.element==='light')e.mp=Math.min(e.maxmp,e.mp+v.mana);
      if(orb.element==='fire'&&target.hp>0)status(e,target,'burn',v.burnDuration,s.burn);
    }
    if(target.hp<=0&&s.tomeHeal)heal(e,Math.max(1,Math.round(e.maxhp*s.tomeHeal)));
    return bonus;
  }
  function strike(e,target){
    if(!target||target.hp<=0||dist(e,target)>1||!clearShot(e,target))return false;
    e.cloneAction='attack';attack(e,target,1,undefined,{tags:['shadow-clone']});
    if(e.hp>0&&target.hp>0&&dist(e,target)<=1&&e.off&&e.off.weapon&&!e.twoHanded)attack(e,target,.6,undefined,{weapon:e.off,offhand:true,tags:['shadow-clone','offhand']});
    return true;
  }
  function act(e){
    if(!isClone(e))return false;
    e.cloneAction='move';
    // Join a visible fight, then finish that engagement without a player leash.
    // Lost sight means pursuing a remembered tile, not tracking through walls.
    var target=ents.find(function(o){return o.id===e.cloneTargetId&&o.foe&&o.hp>0;});
    if(!target){
      delete e.cloneTargetId;e.lastSeen=null;
      target=ents.filter(function(o){return o.foe&&o.hp>0&&actorVisible(o)&&dist(e,o)<=8;}).sort(function(a,b){return dist(e,a)-dist(e,b)||a.id-b.id;})[0];
      if(target){e.cloneTargetId=target.id;e.lastSeen={x:target.x,y:target.y};}
    }
    if(target){
      var sees=!actorConcealed(target)&&!gameEffects.has(e,'blind')&&dist(e,target)<=8&&clearShot(e,target);
      if(sees){e.lastSeen={x:target.x,y:target.y};if(strike(e,target))return true;}
      if(e.lastSeen&&(sees||dist(e,e.lastSeen)>1)){
        if(canActorMove(e))actorPathStep(e,e.lastSeen);
        return true;
      }
      delete e.cloneTargetId;e.lastSeen=null;
    }
    if(canActorMove(e))allyFollowStep(e);
    return true;
  }
  function block(e,source,raw){
    var spec=e.cloneStats.shield;if(!spec||!source||source.hp<=0)return;
    var el=spec.element,v=spec.values;
    if(el==='fire'){damage(e,source,Math.max(1,Math.round(raw*v.fire)),'fire');if(source.hp>0&&rng()<v.burn)status(e,source,'burn',v.burnDuration,e.cloneStats.burn);}
    if(el==='water'&&rng()<v.water)gameEffects.addChill(source,effectOptions(e));
    if(el==='air'&&rng()<v.air){status(e,source,'stun',v.stunDuration);knockback(source,source.x-e.x,source.y-e.y,v.knockback);}
    if(el==='light')gameDamage.heal(e,v.light,e);
    if(el==='shadow'&&rng()<v.shadow)status(e,source,'corrupt',v.corruptDuration);
    if(source.hp<=0)kill(source,e);
  }
  function defend(event){
    var e=event.target;if(!isClone(e))return false;
    var s=e.cloneStats,source=event.source,foe=source&&source.foe,type=event.type,d=event.amount;
    refreshStats(e);
    if(s.resistanceContexts&&s.resistanceContexts[type]&&s.resistanceContexts[type].immune||type==='poison'&&e.buffs.poisonward>0){event.amount=0;return true;}
    if(e.tomb>0){event.amount=0;return true;}
    if(s.holyEarth)d*=1-s.holyEarth;
    if(foe&&!event.options.attackRolled&&!event.tags.has('area')&&s.spellWard&&rng()<s.wardChance){block(e,source,d);d*=.25;floatText(e.x,e.y,'block','miss');}
    if(type==='phys')d=FoteDamage.physical(d,{armor:armorOf(e),pierce:source&&source.base&&source.base.pierce||0,heavy:!!(source&&source.base&&source.base.heavy),earth:s.earth,stone:e.st.stone,frozen:e.st.frozen})*resistMult(e,type);
    else d=FoteDamage.elemental(d,{resistance:resistMult(e,type),player:true,corrupt:type==='dark'&&e.st.corrupt});
    if(d>0&&e.st.frozen)gameEffects.remove(e,'frozen','damaged');
    if(e.buffs.laststand>0)d*=FoteDamage.lastStand(s.reginaldRank,s.divine).damageMultiplier;
    if(s.magicBarrier&&foe&&!event.tags.has('area')&&dist(source,e)>1&&d>0)d=Math.max(1,d-5);
    if(type==='phys'&&d>0)d=Math.max(1,d);
    if(!event.options.bypassShields){if(e.ward>0&&!(e.buffs.arcaneward>0||e.buffs.communion>0))e.ward=0;var absorption=FoteDamage.absorb(d,['ward','iceArmor','hideShield','mward','guard'].map(function(k){return{key:k,amount:e[k]||0,type:'dark'};}));d=absorption.remaining;event.absorbed=absorption.absorbed;Object.keys(absorption.pools).forEach(function(key){e[key]=absorption.pools[key];});}
    if(s.fortitude&&foe&&Math.round(d)>0&&!(e.fortUntil>worldNow())){d*=.5;e.fortUntil=worldNow()+600;}
    if(e.dazed>0)d*=1.5;
    if(d>0)e.lastDamageTime=worldNow();event.amount=d;return true;
  }
  function pulse(e,clock){
    if(!isClone(e)||e.hp<=0||clock<=e.clonePulseAt)return;
    var s=e.cloneStats,scale=(clock-e.clonePulseAt)/100;e.clonePulseAt=clock;
    var poisoned=gameEffects.has(e,'poison'),rot=gameEffects.has(e,'rot'),fighting=ents.some(function(o){return o.foe&&o.hp>0&&o.state==='hunt'&&dist(e,o)<=s.range&&clearShot(e,o);});
    var hp=s.fed&&!poisoned&&!rot&&!fighting?s.hpRate*(s.passives.resilient&&e.hp<e.maxhp/2?2:1):0;
    if(s.fed&&!poisoned&&s.mending>0)hp+=s.mending;if(e.buffs.regeneration>0)hp+=s.foodRegen;
    // Echoes retain their own equipment; old snapshots may only contain a rate.
    var blocked=s.statModel&&Array.isArray(s.statModel.rings)?FoteGear.cursedMending(s.statModel.rings):
      (s.regenerationBlocked!==undefined?!!s.regenerationBlocked:s.mending<0);
    gameDamage.heal(e,FoteDamage.healingAmount(e.maxhp*hp*scale*(1+.25*holyGroundStrength(e)),{regen:true,regenerationBlocked:blocked}),e,{natural:true,regen:true});
    delete e.mendingDebt;
    var mp=s.mpRate*(s.passives.tidalMind&&e.mp<e.maxmp/2?2:1)+(e.buffs.manaflow>0?s.manaflow:0);e.mp=Math.min(e.maxmp,e.mp+e.maxmp*mp*scale);
    if(clock-(e.lastDamageTime||0)>=500){e.iceArmor=Math.min(e.iceArmorMax,(e.iceArmor||0)+scale);e.guard=Math.min(e.guardMax,(e.guard||0)+scale);}
    Object.keys(e.buffs).forEach(function(key){e.buffs[key]=Math.max(0,e.buffs[key]-scale);});
    e.cloneStormTurns=Math.max(0,(e.cloneStormTurns||0)-scale);e.cloneExtraBuff=Math.max(0,(e.cloneExtraBuff||0)-scale);
    if(e.cloneForgeHeat){e.cloneForgeHeat.t-=scale;if(e.cloneForgeHeat.t<=0)e.cloneForgeHeat=null;}
    refreshStats(e);
  }
  function cost(e){var s=e.cloneStats;if(!s.timing)return Math.max(1,Math.round(s.castCost/(1-(e.st.chill?chillSlow(e):0))/(e.st.slow?(e.st.slow.mult||SYLLA.slowMult):1)));
    refreshStats(e);return FoteCosts.action(Object.assign({},s.timing,{speed:e.speed,casting:false,attacking:e.cloneAction==='attack',unarmed:!!(e.weapon&&e.weapon.unarmed),dagger:!!(e.weapon&&/Dagger/.test(e.weapon.name||'')),rampage:e.buffs.rampage>0,storm:e.cloneStormTurns>0,holyAir:s.holyAir,holyReduction:s.holyReduction,chill:e.st.chill?chillSlow(e):0,slow:e.st.slow?(e.st.slow.mult||SYLLA.slowMult):0}));}
  function resistance(e,type){
    var s=e.cloneStats,c=s.resistanceContexts&&s.resistanceContexts[type];if(!c)return s.resist[type]===undefined?1:s.resist[type];
    return FoteActions.resistance(type,Object.assign({},c,{wet:!!isWet(e),chilled:!!e.st.chill,sanctuary:inSanctuary(e),divine:holyGroundStrength(e),
      poisonward:e.buffs.poisonward>0,shadeward:e.buffs.shadeward>0,stormward:e.buffs.stormward>0,fireward:e.buffs.fireward>0,starward:e.buffs.starward>0}));
  }
  function arrive(){
    if(!RUN)return;
    var e=RUN.shadowClone;
    if(!isClone(e)){e=ents.find(isClone);if(e)RUN.shadowClone=e;else return;}
    if(e.hp<=0){delete RUN.shadowClone;return;}
    if(ents.includes(e))return;
    delete e.cloneTargetId;e.lastSeen=null;
    var spot=allyArrivalSpot(e);if(!spot)return;
    e.x=spot.x;e.y=spot.y;e.t=player.t+Math.max(1,cost(e));e.clonePulseAt=worldNow();e._lx=e._ly=undefined;delete e._clip;ents.push(e);
  }
  MONSTERS.shadowclone={name:'Shadow Clone',hp:1,dmg:[0,0],acc:0,eva:0,speed:100,armor:0,xp:0,band:[99,99],w:0,ch:'@',col:'#7962AA',living:true};
  DROPS.shadowclone={chance:0,table:{}};
  root.FoteShadowClone=Object.freeze({isClone:isClone,snapshot:snapshot,create:create,act:act,strike:strike,attackView:attackView,weaponHit:weaponHit,buffed:buffed,defend:defend,block:block,pulse:pulse,cost:cost,resistance:resistance,arrive:arrive});
})(globalThis);

;
/* js/world/terrain/environment-terrain.js */
/* High-density environment materials. Geometry, world RNG and turn state are
 * owned by the existing terrain generators; this module only caches pixels. */
(function(root){
 'use strict';
 if(root.FoteEnvironmentTerrain)return;
 var manifest=null,manifestPending=null,manifestFailure=null,images=new Map(),loading=new Map(),failures=new Map(),high=new Map(),cacheMap=null,cacheMeta=null;
 var wanted=new Set(),assetsMap=null,assetsMeta=null;
 var S=128,builds=0,frameBuilt=0,frameDeadline=0,peakBuildMs=0,frameMs=0,peakFrameMs=0,fireGround=new Map(),rockTops=new Map(),masonryReflections=new Map();
 var elementalPlanes=['light','shadow','earth','fire','water','air'];
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
 function deadline(promise,ms,label,cancel){
  return new Promise(function(resolve,reject){
   var settled=false,timer=setTimeout(function(){if(settled)return;settled=true;if(cancel)cancel();reject(Error(label+' timed out'));},ms);
   Promise.resolve(promise).then(function(value){if(settled)return;settled=true;clearTimeout(timer);resolve(value);},function(error){if(settled)return;settled=true;clearTimeout(timer);reject(error);});
  });
 }
 function fetchManifest(options){
  if(manifest)return Promise.resolve(manifest);
  if(manifestPending)return manifestPending;
  if(manifestFailure&&!(options&&options.retry)&&performance.now()<manifestFailure.retryAt)return Promise.reject(manifestFailure.error);
  var controller=typeof AbortController==='function'?new AbortController():null;
  var fetched=Promise.resolve().then(function(){return fetch('art/packed/environment-terrain-atlas.json',Object.assign({cache:'no-cache'},controller?{signal:controller.signal}:{}));}).then(function(r){
   if(!r.ok)throw Error('Environment terrain metadata failed to load (HTTP '+r.status+').');return r.json();
  }).then(function(data){
   if(!data||!data.assets||typeof data.assets!=='object')throw Error('Invalid environment terrain metadata.');
   ['stone-detail','fluid-detail'].forEach(function(key){if(!data.assets[key])throw Error('Missing required Terrain material '+key+'.');});
   return data;
  }).catch(function(error){throw Error('Environment terrain metadata could not load: '+String(error&&error.message||error));});
  var request=deadline(fetched,15000,'Environment terrain metadata',function(){if(controller)controller.abort();}).then(function(data){
   if(manifestPending!==request)throw Error('Environment terrain metadata attempt was replaced.');
   manifest=data;manifestFailure=null;return data;
  });
  manifestPending=request;
  request.catch(function(error){if(manifestPending===request){manifestPending=null;manifestFailure={error:error,retryAt:performance.now()+5000};}});
  return manifestPending;
 }
 function load(key,options){
  if(images.has(key))return Promise.resolve(images.get(key));
  if(loading.has(key))return loading.get(key);
  var failure=failures.get(key);if(failure&&!(options&&options.retry)&&performance.now()<failure.retryAt)return Promise.reject(failure.error);
  var img=null,label='Terrain material '+key;
  function clean(){if(img)img.onload=img.onerror=null;}
  function cancel(){clean();if(img)img.src='';}
  var promise=fetchManifest(options).then(function(){var spec=manifest.assets[key];if(!spec)throw Error('Missing required '+label+'.');
   img=new Image();
   var arrival=new Promise(function(resolve,reject){
    img.onload=function(){if(loading.get(key)!==promise)return;resolve(img);};
    img.onerror=function(){if(loading.get(key)!==promise)return;reject(Error(label+' could not load.'));};
    img.src='art/packed/'+spec.file;
   });
   return deadline(arrival,15000,label+' load',cancel).then(function(){
    clean();if(img.naturalWidth!==spec.width||img.naturalHeight!==spec.height)throw Error('Invalid terrain image dimensions: '+key+' ('+img.naturalWidth+'x'+img.naturalHeight+').');
    return deadline(Promise.resolve().then(function(){if(typeof img.decode==='function')return img.decode();}),10000,label+' decode',cancel).catch(function(error){throw Error(label+' could not decode: '+String(error&&error.message||error));});
   }).then(function(){
    if(loading.get(key)!==promise)throw Error(label+' attempt was replaced.');
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
    if(key==='cave-rock'||/-detail$/.test(key))red(entry);
    // Natural faces/tops use rock colors and volcanic floors use the fire
    // raster. Only constructed stone and cave floors sample RGBA masters.
    else if(/^temple-(floor|face|top)$|^underdark-floor$/.test(key))bytes(entry);
    if(wanted.has(key)){images.set(key,entry);redraw();}failures.delete(key);return entry;
   });
  }).catch(function(error){clean();if(loading.get(key)===promise)failures.set(key,{error:error,retryAt:performance.now()+5000});throw error;
  }).finally(function(){if(loading.get(key)===promise)loading.delete(key);});loading.set(key,promise);return promise;
 }
 function get(key){if(manifest&&!manifest.assets[key])return null;wanted.add(key);if(images.has(key))return images.get(key);load(key).catch(function(){});return null;}
 // The current floor's materials by default; 'caverns' or a plane name asks for the natural rock; 'all' is every biome.
 function assetKeys(themes){
  if(themes==='all')return Object.keys(manifest.assets);
  if(!themes){themes=['dungeon'];if(typeof floorMeta!=='undefined'&&floorMeta){
   if(floorMeta.deepRegion)themes=DEEP_REGIONS.slice();
   else if(floorMeta.chaosPreview)themes=['prism','cinder'];
   else if(typeof player!=='undefined'&&player)themes=[theme(player.x,player.y)];
  }}
  var keys=['stone-detail','fluid-detail'];if(typeof floorMeta!=='undefined'&&floorMeta&&floorMeta.chaosPreview||typeof inCaverns==='function'&&inCaverns()||themes.some(function(t){return t==='caverns'||t==='underdark'||t==='volcanic'||elementalPlanes.indexOf(t)>=0;}))keys.push('cave-rock');if(typeof floorMeta!=='undefined'&&floorMeta&&floorMeta.lava)keys.push('lava-flow');themes.forEach(function(t){['floor','face','top','rim-n','rim-v'].forEach(function(n){var k=t+'-'+n;if(manifest.assets[k])keys.push(k);});});
  return keys;
 }
 function ensureAssets(themes){
  return fetchManifest({retry:true}).then(function(){
   var keys=assetKeys(themes);
   // Terrain masters belong to the installed floor, not the history of a run.
   // In-flight images from a retired floor may finish, but cannot repopulate it.
   if(assetsMap!==map||assetsMeta!==floorMeta){
    wanted=new Set(keys);assetsMap=map;assetsMeta=floorMeta;masonryReflections.clear();
    images.forEach(function(entry,key){if(!wanted.has(key))images.delete(key);});
   }else keys.forEach(function(key){wanted.add(key);});
   return Promise.all(keys.map(function(key){return load(key,{retry:true});}));
  }).then(function(){return root.FoteEnvironmentTerrain;});
 }
 function ready(themes){return !!manifest&&assetKeys(themes).every(function(key){return images.has(key);});}
 // Every cell on screen, twice over (layers), fits the caches, or cells flip back to the crisp raster.
 function cacheCells(){return 2*(viewW+3)*(viewH+3);}
 function sample(name,x,y,t){
  var entry=get((t||theme(x,y))+'-'+name);if(!entry)return null;
  var spec=entry.spec,w=entry.img.naturalWidth/spec.columns,h=entry.img.naturalHeight/spec.rows;
  var image=entry.shaded||entry.img,sx=wrap(x,spec.columns),sy=wrap(y,spec.rows);
  // Reflect whole masonry repeats at their joins, rather than connecting two
  // unrelated cropped stones. Keep the original master and cache only visible
  // reflected cells: a doubled atlas would cost 44 MB of additional decoded art.
   var opaque=name==='floor'&&/^environment-terrain-(dungeon|crypt)-floor\.(?:png|webp)$/.test(spec.file);
   if(opaque){
   var rx=wrap(x,spec.columns*2),ry=wrap(y,spec.rows*2),flipX=rx>=spec.columns,flipY=ry>=spec.rows;
   sx=flipX?spec.columns*2-1-rx:rx;sy=flipY?spec.rows*2-1-ry:ry;
   if(flipX||flipY){
    var key=[spec.file,sx,sy,flipX?1:0,flipY?1:0].join(':'),tile=masonryReflections.get(key);
    if(tile){masonryReflections.delete(key);masonryReflections.set(key,tile);}
    else{
     tile=canvas(w,h,'masonry-reflection-'+key);var paint=tile.getContext('2d');
     paint.translate(flipX?w:0,flipY?h:0);paint.scale(flipX?-1:1,flipY?-1:1);
     paint.drawImage(image,sx*w,sy*h,w,h,0,0,w,h);masonryReflections.set(key,tile);
     if(masonryReflections.size>128)masonryReflections.delete(masonryReflections.keys().next().value);
    }
    return {img:tile,sx:0,sy:0,sw:w,sh:h,deepDim:entry.shaded?0:spec.dim||0,opaque:opaque};
   }
  }
  return {img:image,sx:sx*w,sy:sy*h,sw:w,sh:h,deepDim:entry.shaded?0:spec.dim||0,opaque:opaque};
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
 // material top (presentation/render/renderer.js wallTile). Null when neither is ready.
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
  if(!entry.red){var b=bytes(entry),r=new Uint8Array(b.length>>2);for(var i=0;i<r.length;i++)r[i]=b[i*4];entry.red=r;entry.pixels=null;}
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
  // The archived detail master contains coarse slab outlines. Keep only a
  // trace of its material; continuous fine grain must not stamp a second,
  // pixelated floor layout over the native 128px contours.
  function grainHash(x,y,s){var h=(Math.imul(x,374761393)+Math.imul(y,668265263)+s)|0;h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967295;}
  function grainNoise(x,y,s){var ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;fx*=fx*(3-2*fx);fy*=fy*(3-2*fy);var a=grainHash(ix,iy,s),b=grainHash(ix+1,iy,s),c=grainHash(ix,iy+1,s),e=grainHash(ix+1,iy+1,s);return (a+(b-a)*fx)*(1-fy)+(c+(e-c)*fx)*fy-.5;}
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
    var topGrade=plane?.61:.72,faceGrade=plane?.5:.58;
    var topLow=palette.topLo[ch]*topGrade,faceLow=palette.faceLo[ch]*faceGrade;
    r.topLow.push(topLow);r.topSpan.push(palette.topHi[ch]*topGrade-topLow);r.faceLow.push(faceLow);r.faceSpan.push(palette.lip[ch]*.85*faceGrade-faceLow);r.lip.push(palette.lip[ch]);r.edge.push(palette.edge[ch]);
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
    var dp=dRow+detailCol[u],wx=x+(u+.5)/S,wy=y+(v+.5)/S;
    var grain=POOL[cell]||mode==='fluid'?((POOL[cell]?fd[dp]:d[dp])-128)*.12:
      (d[dp]-128)*.015+grainNoise(wx*12,wy*12,37)*8+grainNoise(wx*38,wy*38,91)*4+(grainHash(x*S+u,y*S+v,173)-.5)*2;
    if(mode==='vegetation')grain*=.45;
    // Caverns are rough weathered rock, not a smooth paving material. Use
    // the painted rock master at native density without polygon slab seams.
    if(isPlane&&(naturalWalls||o.naturalFloor||plane)&&kind===0&&!POOL[cell]&&rockPixels){
      var floorRock=rockPixels[rRow+rockCol[u]]-128;
      var roughness=plane?Math.max(.28,Math.min(.42,.18+plane.grain*8)):.34;
      grain+=floorRock*roughness+grainNoise(wx*5,wy*5,227)*(plane?roughness*28:12);
    }
    if(isDeep&&FIRE[cell]&&rockPixels)grain+=(rockPixels[rRow+rockCol[u]]-128)*.42+grainNoise(wx*5,wy*5,227)*14;
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
  // Resolve the raster's own material: preview/mixed cells and volcanic ground
  // may have a different material from the floor's global plane.
  var cellMaterial=mode==='plane'?(info.terrainMaterial||ptMat(x,y)):null;
  var plane=cellMaterial&&elementalPlanes.some(function(key){return PT_MAT[key]===cellMaterial;})?cellMaterial:null;
  var rock=info.naturalWalls||info.naturalFloor||plane||mode==='deep'?T.get('cave-rock'):null;
  if((info.naturalWalls||info.naturalFloor||plane||mode==='deep')&&!rock)return null;
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
   plane:plane,naturalWalls:info.naturalWalls,naturalFloor:info.naturalFloor,minerals:plane&&mask?planeMinerals(source,mask,plane):null,material:material,
   offsets:mode==='deep'?[surfOff(0),surfOff(1),surfOff(2),surfOff(3),surfOff(4)]:null,cavern:info.naturalMaterial||(typeof PT_MAT!=='undefined'?PT_MAT.cavern:null),
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
  // Wall crystals belong above the finished rock. Cache the native painter's
  // result once; these canvas-path cells already stay out of terrain workers.
  if(info.crystal){g.save();g.scale(S/PT_R,S/PT_R);ptCrystal(g,x,y,ptSalt(),info.terrainMaterial||ptMat(x,y));g.restore();}
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
   if(typeof FoteTerrainWorkers!=='undefined'&&!inCaverns()&&!inDeep()&&!ptMat()&&!(typeof FoteChaosPreviewRenderer!=='undefined'&&FoteChaosPreviewRenderer.mixed()))FoteTerrainWorkers.release();
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
 // The same on the page, now (presentation/render/renderer.js drawTerrainNow, for tools that paint a new view in one task).
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
  sourceFiles:function(){return manifest?Array.from(wanted,function(key){return manifest.assets[key]&&manifest.assets[key].file;}).filter(Boolean):[];},
  masonry:masonrySample,deepTop:deepTop,floorSample:function(x,y){return masonrySample('floor',x,y);},
  lavaFlow:function(){var entry=get('lava-flow');return entry&&entry.img;},
  rockSurface:function(){var entry=get('cave-rock');return entry&&entry.img;},
  surface:function(name,x,y){var entry=get(theme(x,y)+'-'+name);return entry&&entry.img;},metadata:function(){return manifest;},enhance:enhance,
  diagnostics:function(){
   // Image/canvas bytes are RGBA equivalents, not browser or GPU memory usage.
   var imageBytes=0,pixelBytes=0,shadedBytes=0;images.forEach(function(e){imageBytes+=e.img.naturalWidth*e.img.naturalHeight*4;pixelBytes+=(e.pixels?e.pixels.byteLength:0)+(e.red?e.red.byteLength:0);if(e.shaded)shadedBytes+=e.shaded.width*e.shaded.height*4;});
   return {ready:!!manifest,loaded:images.size,materials:Array.from(images.keys()),imageBytes:imageBytes,pixelBytes:pixelBytes,shadedBytes:shadedBytes,pending:loading.size,cachedCells:high.size,cellBytes:high.size*S*S*4,masonryReflectionCells:masonryReflections.size,builds:builds,peakBuildMs:peakBuildMs,peakFrameMs:peakFrameMs,pixelsPerCell:S,lastBake:lastBake&&Object.assign({},lastBake),bakes:bakes.map(function(b){return Object.assign({},b);})};},
  reset:function(){forget();fireGround.clear();rockTops.clear();masonryReflections.clear();aheadQueue=[];aheadKey='';},beginFrame:beginFrame,bakeView:bakeView,bakeViewNow:bakeViewNow,ahead:ahead,
  cacheCanvases:function(){return Array.from(high.values());},discardCell:function(cell){if(!high.has(cell))return false;drop(cell);return true;},install:install,kernelSource:kernelSource,workerTextures:workerTextures,
  workerDeepTextures:workerDeepTextures,rockTopReady:rockTopReady});
})(globalThis);

;
/* js/world/terrain/terrain-workers.js */
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
 function naturalFloor(){return inCaverns()||inDeep()||ptMat()||typeof FoteChaosPreviewRenderer!=='undefined'&&FoteChaosPreviewRenderer.mixed();}
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
  var page=[hash2,inb,idxOf,at,isWallLike,ptWallCell,ptVal,ptVor,ptFieldTables,ptSub,ptSolid,ptJag,ptKind,ptMix,ptMineralStreak,ptFloorColor,ptGroundRaster,ptCellRaster,
   ptMossField,ptPoolField,ptFieldContext,ptPoolFx,ptMat,ptSalt,surfSalt,surfOff,ptCrystalAt,
   deepRegionAt,deepCellReg,deepContext,deepWallCell,deepPixReg,deepSolid,deepMix,deepRockCol,deepTexel,deepPresent,deepCellRaster];
  return [
   'var map=null,MW=0,MH=0,ground=null,floorMeta=null,floorNo=0,worldSeed=0,CAVERNS=false,DEEP_RC=false,PT_MAT=null,PT_POOL_FX=null,DEEP_ROCK=null,DC=null,FoteChaosPreviewRenderer=null;',
   // Shared map readers support the page's held-frame view. Workers use their
   // posted floor snapshot directly and never inherit that page-only override.
   'var FRAME_MAP=null,FRAME_MW=0,FRAME_MH=0;',
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
  if(!naturalFloor())return false;
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
  finally{if(url)URL.revokeObjectURL(url);}
  return true;
 }
 // The dungeon/crypt cannot use these workers. Release their cloned masters,
 // old floor snapshots and queued pixels; a later natural floor starts anew.
 function release(){
  if(pool)pool.forEach(function(w){w.worker.onmessage=w.worker.onerror=null;w.worker.terminate();});
  pool=null;ET=null;sentFloor=null;deepSent=false;urgent=[];later=[];ready=[];inflight.clear();settle();
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
   if(deepNeedsRaster(x,y,sig)){var dk=x+','+y+':'+sig;return dk in cells||nearBuilt(x,y)?null:[1,dk];}
   if(isWallLike(t)&&DEEP_STYLE[deepCellReg(x,y)]!=='rect')return ET.rockTopReady(x,y)?null:[2,x+','+y];
   return null;   // masonry and volcanic ground: the page
  }
  var k=x+','+y;if(k in cells)return null;
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
  var cells=cacheNow(),queue=[],keys=new Set(),owned=new Map();
  function remember(q,r){if(q.cells===cells&&q.map===map)owned.set(q.key,{q:q,ready:r});}
  urgent.forEach(function(u){u.list.forEach(function(q){remember(q,null);});});
  inflight.forEach(function(q){remember(q,null);});
  ready.forEach(function(r){remember(r.q,r);});
  list.forEach(function(c){
   var j=job(c[0],c[1],cells);if(!j)return;
   var key='pdr'[j[0]]+j[1],existing=owned.get(key);
   if(existing){
    // A moving view overlaps the preceding ring. Its pending cells still
    // belong to the workers; omitting them from taken rebuilt them on the
    // page while the same expensive raster was already being computed.
    if(now){
     existing.q.urgent=true;
     if(existing.ready){var index=ready.indexOf(existing.ready);if(index>=0)ready.splice(index,1);place(existing.q,existing.ready.image);}
     else keys.add(key);
    }
    taken.add(c[0]+','+c[1]);return;
   }
   // A retired floor/cache may still have this transport key in flight.
   // Never borrow its pixels or replace its entry; the page owns this cell.
   if(inflight.has(key))return;
   var q={x:c[0],y:c[1],kind:j[0],key:key,slot:j[1],urgent:!!now,cells:cells,map:map};
   queue.push(q);owned.set(key,{q:q,ready:null});keys.add(key);taken.add(c[0]+','+c[1]);
  });
  if(!now){later=queue;later.cells=cells;later.map=map;}
  else urgent.push({list:queue,cells:cells,map:map});
  // an urgent request resolves once each of its cells is in the cache or given up
  var done=now&&keys.size?new Promise(function(resolve){waiting.push({keys:Array.from(keys),resolve:resolve});}):Promise.resolve();
  if(queue.length){floorState();pump();}
  return {taken:taken,done:done};
 }
 // The next job still worth sending: urgent (a held view) first, then the ring ahead of the view.
 function nextJob(current,deepOk){
  if(!deepOk&&deepFloor())return null;
  while(urgent.length){var u=urgent[0];while(u.list.length){var q=u.list.shift();if(needed(q,current)&&!inflight.has(q.key))return q;}urgent.shift();}
  while(later.length){var q2=later.shift();if(needed(q2,current)&&!inflight.has(q2.key))return q2;}
  return null;
 }
 function needed(q,current){return q.cells===current&&q.map===map&&(q.kind===2?!ET.rockTopReady(q.x,q.y):!(q.slot in current));}
 // The page helps with a held view once its own share is done: it takes the queued job farthest from the view's
 // centre (the workers take the nearest), builds it itself, and the job leaves the queue.
 function steal(){
  var current=cacheNow();
  for(var i=urgent.length-1;i>=0;i--){var u=urgent[i];while(u.list.length){var q=u.list.pop();if(needed(q,current)&&!inflight.has(q.key)){settle();return q;}}}
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
  if(!pool||pool.indexOf(w)<0)return;
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
  request:request,flush:flush,steal:steal,release:release,
  info:function(){return {workers:pool?pool.length:0,failed:failed,supported:supported(),size:size(),stats:Object.assign({},stats)};}
 });
})(globalThis);

;
/* art/packed/environment-deco-meta.js */
window.FOTE_ENVIRONMENT_DECO_META={"version":1,"file":"environment-deco.webp","cell":128,"columns":13,"rows":13,"master":"art/concepts/environment-refresh/deco-master.png","masterSha256":"fec1f02cf5614c45f6a2c1abe4f39d008746996a6da84976967e50c7a2ec3270","items":[{"index":0,"name":"pebble-1","source":[0,0,314,314],"sourceBounds":[48,103,276,249],"legacyBounds":[20,34,44,60],"packedBounds":[40,78,88,109],"rgbBrightness":0.65},{"index":1,"name":"pebble-2","source":[314,0,627,314],"sourceBounds":[40,81,275,259],"legacyBounds":[14,18,46,48],"packedBounds":[28,42,92,90],"rgbBrightness":0.65},{"index":2,"name":"pebble-3","source":[627,0,940,314],"sourceBounds":[35,77,276,256],"legacyBounds":[0,10,34,48],"packedBounds":[0,32,68,83],"rgbBrightness":0.65},{"index":3,"name":"crack-1","source":[940,0,1254,314],"sourceBounds":[35,55,277,288],"legacyBounds":[0,14,64,64],"packedBounds":[12,28,116,128],"rgbBrightness":1},{"index":4,"name":"crack-2","source":[0,314,314,627],"sourceBounds":[52,20,260,286],"legacyBounds":[0,6,64,64],"packedBounds":[18,12,109,128],"rgbBrightness":1},{"index":5,"name":"crack-3","source":[314,314,627,627],"sourceBounds":[33,23,276,276],"legacyBounds":[0,0,62,64],"packedBounds":[0,0,123,128],"rgbBrightness":1},{"index":6,"name":"drain","source":[627,314,940,627],"sourceBounds":[35,30,277,267],"legacyBounds":[14,14,50,50],"packedBounds":[28,28,100,99],"rgbBrightness":1},{"index":7,"name":"damage-1","source":[940,314,1254,627],"sourceBounds":[38,61,275,244],"legacyBounds":[22,32,52,52],"packedBounds":[48,64,100,104],"rgbBrightness":1},{"index":8,"name":"damage-2","source":[0,627,314,940],"sourceBounds":[43,70,276,243],"legacyBounds":[12,36,44,54],"packedBounds":[32,72,80,108],"rgbBrightness":1},{"index":9,"name":"sconce","source":[314,627,627,940],"sourceBounds":[119,6,218,287],"legacyBounds":[26,12,38,48],"packedBounds":[52,26,76,94],"rgbBrightness":1},{"index":10,"name":"banner-1","source":[627,627,940,940],"sourceBounds":[33,19,281,285],"legacyBounds":[18,8,46,54],"packedBounds":[36,32,92,92],"rgbBrightness":1},{"index":11,"name":"banner-2","source":[940,627,1254,940],"sourceBounds":[32,17,278,285],"legacyBounds":[18,8,46,54],"packedBounds":[36,31,92,92],"rgbBrightness":1},{"index":12,"name":"cap","source":[0,940,314,1254],"sourceBounds":[57,26,275,251],"legacyBounds":[18,18,46,46],"packedBounds":[37,36,91,92],"rgbBrightness":1}],"variants":{"dungeon":{"row":0,"rgbRatio":[1.0,1.0,1.0]},"crypt":{"row":1,"rgbRatio":[1.0,1.0,1.0]},"light":{"row":2,"rgbRatio":[1.0,1.0,1.0]},"shadow":{"row":3,"rgbRatio":[1.0,1.0,1.0]},"earth":{"row":4,"rgbRatio":[1.0,1.0,1.0]},"caverns":{"row":5,"rgbRatio":[1.0417,0.9264,0.7855]},"temple":{"row":6,"rgbRatio":[0.58,0.58,0.58]},"underdark":{"row":7,"rgbRatio":[0.8235,0.7826,0.724]},"volcanic":{"row":8,"rgbRatio":[0.58,0.58,0.58]},"fire":{"row":9,"rgbRatio":[0.58,0.58,0.58]},"water":{"row":10,"rgbRatio":[1.0417,0.9264,0.7855]},"air":{"row":11,"rgbRatio":[1.0,1.0,1.0]},"rot":{"row":12,"rgbRatio":[0.8,1.03,0.7]}},"cap":{"index":12,"x":36,"y":36,"w":56,"h":56},"note":"Generated art placed within original64px decal bounds; runtime cells128px. Slots13-15 of source master intentionally unused. All biome rows preserve the same alpha.","atlasSha256":"6a851679eb5630b1643ec75d465c8939d4a5433e3ec40b526ee402f9ffa0dd25"};

;
/* js/world/terrain/environment-deco.js */
/* Generated environment decals, shared by every biome. Selection, placement,
 * collision, seeded density and lighting stay in the existing renderer. */
(function(root){
  'use strict';
  var meta=root.FOTE_ENVIRONMENT_DECO_META, image=null, pending=null, loaded=false, error=null,cells={},caps={};
  function redrawIfWorldReady(){
    if(typeof draw==='function'&&typeof player!=='undefined'&&player&&typeof map!=='undefined'&&map&&map.length&&typeof sceneVisibility()!=='undefined'&&sceneVisibility()&&sceneVisibility().length===map.length&&typeof seen!=='undefined'&&seen&&seen.length===map.length)draw();
  }
  function ensureAssets(){
    if(loaded)return Promise.resolve(true);
    if(pending)return pending;
    if(!meta)return Promise.reject(new Error('Environment decal metadata is missing'));
    pending=new Promise(function(resolve,reject){
      image=new Image();
      image.onload=function(){loaded=true;redrawIfWorldReady();resolve(true);};
      image.onerror=function(){error='Unable to load '+meta.file;pending=null;reject(new Error(error));};
      image.src='art/packed/'+meta.file+'?v='+(meta.atlasSha256||meta.masterSha256).slice(0,12);
    });
    return pending;
  }
  function palette(x,y){
    if(typeof FoteChaosPreviewRenderer!=='undefined'&&FoteChaosPreviewRenderer.active()){
      var theme=FoteChaosPreviewRenderer.themeAt(x,y);
      var chaos={'prism-archives':'light','rot-hollows':'rot','cinder-bastion':'volcanic','violet-warrens':'shadow','unmaker-crucible':'volcanic'};
      if(chaos[theme])return chaos[theme];
    }
    if(typeof floorMeta!=='undefined'&&floorMeta&&floorMeta.plane&&meta.variants[floorMeta.plane])return floorMeta.plane;
    if(typeof inDeep==='function'&&inDeep()){
      var reg=typeof DEEP_AT==='number'&&DEEP_AT>=0?DEEP_AT:(typeof deepCellReg==='function'?deepCellReg(x,y):0);
      return typeof DEEP_REGIONS!=='undefined'&&meta.variants[DEEP_REGIONS[reg]]?DEEP_REGIONS[reg]:'underdark';
    }
    if(typeof inCaverns==='function'&&inCaverns())return 'caverns';
    return typeof bidx==='function'&&bidx()===1?'crypt':'dungeon';
  }
  function art(index,x,y){
    if(!loaded||!meta.items[index])return null;
    var key=palette(x,y),variant=meta.variants[key]||meta.variants.dungeon,cacheKey=key+':'+index;
    if(cells[cacheKey])return cells[cacheKey];
    // Deep terrain inherits a canvas color filter. Filtering the entire1664px
    // atlas for each tiny decal is costly; isolate each immutable cell once.
    var c=document.createElement('canvas');c.width=meta.cell;c.height=meta.cell;
    c.getContext('2d').drawImage(image,index*meta.cell,variant.row*meta.cell,meta.cell,meta.cell,0,0,meta.cell,meta.cell);
    c.src='environment-deco-'+cacheKey;
    return (cells[cacheKey]={img:c,sx:0,sy:0,sw:meta.cell,sh:meta.cell,palette:key,index:index});
  }
  function cap(x,y){
    var o=art(meta?meta.cap.index:12,x,y);if(!o)return null;
    if(caps[o.palette])return caps[o.palette];
    var c=document.createElement('canvas');c.width=meta.cap.w;c.height=meta.cap.h;
    c.getContext('2d').drawImage(o.img,meta.cap.x,meta.cap.y,meta.cap.w,meta.cap.h,0,0,meta.cap.w,meta.cap.h);
    c.src='environment-deco-cap-'+o.palette;
    return (caps[o.palette]={img:c,sx:0,sy:0,sw:c.width,sh:c.height,palette:o.palette,index:meta.cap.index});
  }
  function drawDecal(index,px,py,alpha,opt){
    var o=art(index,Math.floor(px/TS)+camX,Math.floor(py/TS)+camY);if(!o)return false;
    opt=opt||{};var scale=opt.s||1,w=TS*scale;
    ctx.save();ctx.globalAlpha=alpha*(opt.a===undefined?1:opt.a);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='low';
    ctx.drawImage(o.img,o.sx,o.sy,o.sw,o.sh,Math.round(px+(opt.dx||0)*TS+(TS-w)/2),Math.round(py+(opt.dy||0)*TS+(TS-w)/2),Math.round(w),Math.round(w));
    if(typeof FoteNormalLighting!=='undefined'){
      var surface=opt.surface||{kind:'ground'};
      if(surface.kind==='wall')surface=Object.assign({},surface,{height:Math.round(w)/TS*1.2,footV:(py+TS-Math.round(py+(opt.dy||0)*TS+(TS-w)/2))/Math.round(w)});
      FoteNormalLighting.record(ctx,o,{x:Math.round(px+(opt.dx||0)*TS+(TS-w)/2),y:Math.round(py+(opt.dy||0)*TS+(TS-w)/2),w:Math.round(w),h:Math.round(w)},{surface:surface});
    }
    ctx.restore();return true;
  }
  root.FoteEnvironmentDeco=Object.freeze({ready:function(){return loaded;},ensureAssets:ensureAssets,metadata:function(){return meta;},art:art,cap:cap,palette:palette,draw:drawDecal,error:function(){return error;}});
  ensureAssets().catch(function(){/* Existing renderer is the load-error fallback. */});
})(window);

;
/* js/world/terrain/environment-props.js */
/* Higher-resolution environment sources; logical bounds remain in 64px art
 * units. Existing selectors still own theme precedence, animation and layout. */
(function(root){
  'use strict';
  if(root.FoteEnvironmentProps)return;
  var metadata=null,pending=null,failure=null,watched=new WeakSet(),metadataWatchers=new Set();
  function subscribeMetadata(ready,failed){
    var subscription={ready:ready,failed:failed,active:true};metadataWatchers.add(subscription);
    if(metadata)Promise.resolve().then(function(){if(subscription.active)ready();});
    return function(){subscription.active=false;metadataWatchers.delete(subscription);};
  }
  function redraw(){
    if(root.player&&root.map&&root.map.length&&root.vis&&root.vis.length===root.map.length&&root.seen&&root.seen.length===root.map.length&&typeof draw==='function')draw();
  }
  function invalidate(file){
    Object.keys(metadata.groups).forEach(function(group){Object.keys(metadata.groups[group]).forEach(function(name){
      if(metadata.groups[group][name].file!==file)return;
      ['PACK_PAD','CAVE_PAD','CAVE_BASE','CR_GRADED','OBJ_FX_INFO'].forEach(function(key){if(root[key])delete root[key][name];});
    });});
  }
  function atlas(file){
    var image=atl(file),requested=ATL[file];
    if(!watched.has(requested)){
      watched.add(requested);
      atlReady(file).then(function(){if(ATL[file]===requested){invalidate(file);redraw();}},function(){});
    }
    return image;
  }
  function ensureMetadata(){
    if(metadata)return Promise.resolve(metadata);
    if(pending)return pending;
    var controller=new AbortController(),timer=setTimeout(function(){controller.abort();},15000);
    pending=fetch('art/packed/environment-props.json',{cache:'no-cache',signal:controller.signal}).then(function(response){
      if(!response.ok)throw Error('Environment prop metadata could not load.');return response.json();
    }).then(function(data){
      if(!data.groups||!Array.isArray(data.files))throw Error('Invalid environment prop metadata.');
      metadata=data;failure=null;redraw();
      var subscriptions=Array.from(metadataWatchers);
      Promise.resolve().then(function(){subscriptions.forEach(function(subscription){
        if(subscription.active)try{subscription.ready();}catch(error){console.error('Environment art presentation subscriber failed',error);}
      });});
      return data;
    }).catch(function(error){
      failure=error;pending=null;
      Array.from(metadataWatchers).forEach(function(subscription){if(subscription.active&&subscription.failed)subscription.failed(error);});
      throw error;
    }).finally(function(){clearTimeout(timer);});
    return pending;
  }
  function art(group,name){
    // After a failure only the loading screen's Retry (ensureAssets) fetches again; draws must not.
    if(!metadata){if(!failure)ensureMetadata().catch(function(){});return null;}
    var entry=metadata.groups[group]&&metadata.groups[group][name];if(!entry)return null;
    var img=atlas(entry.file);if(!img)return null;
    // 2026-10-05 (item art): item pictures on environment-items.webp say the cell they were drawn in (64 or 128), as a
    // map sheet does, so a ring keeps its true size in a slot (ui.js paintIconArt) and 64px loot stays crisp (render.js).
    return {img:img,sx:entry.sx,sy:entry.sy,sw:entry.sw,sh:entry.sh,fullW:entry.fullW,fullH:entry.fullH,ox:entry.ox,oy:entry.oy,res:entry.res,nm:name,frames:entry.frames,frameMs:entry.frameMs,cell:entry.cell};
  }
  function ensureAssets(){
    // Native selectors elect the current scene. Unrelated biome sheets remain
    // on disk; entry/startup readiness awaits every elected image in the atlas queue.
    return ensureMetadata().then(function(data){return Promise.all(data.files.filter(function(file){return !!ATL[file];}).map(function(file){
      return atlReady(file,{retry:true}).then(function(){invalidate(file);});
    }));}).then(function(){failure=null;return root.FoteEnvironmentProps;},function(error){failure=error;throw error;});
  }
  /* Props with a look of their own, as data; drawPropSurface (presentation/render/renderer.js) applies it. paint: the painted art
     draws at a .98 fit ahead of the named prop passes. scale: the prop shrinks around its floor anchor (anchor: a share
     of the tile down from its top); bones at half size since 2026-09-26. Placement, footprint, breakability, lighting
     and loot stay the prop's, and a prop with authored art (artName) keeps it. */
  var FIT={'sword-in-stone':{paint:true},'bed-straw':{paint:true},chains:{paint:true,scale:.5,anchor:.5},bones:{paint:true,scale:.5,anchor:.5},
    'bone-pile':{scale:.5,anchor:.5},pot:{scale:1,anchor:.5}};
  function fit(p){
    if(!p)return null;
    // Native Earth mushroom clusters already apply their one half-size reduction.
    if(p.name==='glow-mushrooms'&&!p.artName&&typeof floorMeta!=='undefined'&&floorMeta&&floorMeta.plane==='earth')return null;
    // Barrel groups retain the full-size fluid-barrel footprint.
    if(p.name==='stack-group'&&(p.clusterFamily||(p.kinds||[])[0])==='barrel')return null;
    if(p.artName&&/boss|pylon/.test(p.name||'')&&/^crystal-/.test(p.artName))return null;
    if(/^crystal-(gold|violet|amber|fire|water|air)(-small)?$/.test(p.name||'')&&(!p.artName||p.artName===p.name))return /-small$/.test(p.name)?{paint:true,scale:.7,anchor:.96}:{scale:.7,anchor:.96};
    var small=/^(scatter-water-|scatter-air-|embers-slag-|crystal-.+-small|pebbles|rubble-small|loose-stones)/.test(p.artName||p.name||'')||/mushroom|shroom|fungus/.test((p.name||'')+' '+(p.artName||''));
    if(small)return {scale:.5,anchor:p.flat?.5:.96};
    var vessel=(p.name||'')+' '+(p.artName||'');
    // Chests, crates and pots retain their original authored size, including saved groups.
    if(/(?:^| )(?:chest|pot|crate|stack-group)(?:-| |$)/.test(vessel)||p.name==='stack-group')return {scale:1,anchor:.5};
    if(/(?:^| )(?:urn|soul-urn|pot|crate|stack-group|brazier|soul-brazier|incense)(?:-| |$)/.test(vessel)||p.name==='stack-group'||p.name==='urn-group')return {scale:.8,anchor:.5};
    if(p.artName)return null;
    var name=p.name==='stack-group'&&(p.clusterFamily||(p.kinds||[])[0])==='pot'?'pot':p.name;   // a stacked group of pots is a pot
    if(!Object.prototype.hasOwnProperty.call(FIT,name))return null;
    // The Crypt's packed bones keep their own art, at the same half size.
    return name==='bones'&&packCryptOn()?{scale:FIT.bones.scale,anchor:FIT.bones.anchor}:FIT[name];
  }
  root.FoteEnvironmentProps=Object.freeze({ensureAssets:ensureAssets,ready:function(){return !!metadata;},
    source:function(group,name){var entry=metadata&&metadata.groups[group]&&metadata.groups[group][name];return entry?{file:entry.file}:null;},
    metadataReady:function(){return !!metadata;},subscribeMetadata:subscribeMetadata,art:art,fit:fit,error:function(){return failure;}});
})(globalThis);

;
/* art/packed/environment-vegetation-meta.js */
window.FOTE_ENVIRONMENT_VEGETATION_META={"version":1,"cell":128,"res":2,"file":"environment-vegetation.webp","files":["environment-vegetation.webp","environment-vegetation-clusters.webp"],"items":{"veg-caverns-grass-back-1":{"sx":0,"sy":0,"sw":56,"sh":80,"res":2,"logicalW":28,"logicalH":40,"source":"art/incoming/Vegetation-Priority/masters/caverns/grass-back-1.png","sourceRegion":null,"sourceKind":"archived-master","sourceSize":[1254,1254],"sourceSha256":"034b0f19760874683b4115407e306f91b9420cc8c1bb3b4cfb39ba6543af1509"},"veg-caverns-grass-back-2":{"sx":128,"sy":0,"sw":58,"sh":80,"res":2,"logicalW":29,"logicalH":40,"source":"art/incoming/Vegetation-Priority/masters/caverns/grass-back-2.png","sourceRegion":null,"sourceKind":"archived-master","sourceSize":[1254,1254],"sourceSha256":"739a9fa5849f3ab2d8f3fa38e2491a941b373ca2bfe0ad8bbf6954708a9c6fd0"},"veg-caverns-grass-back-3":{"sx":256,"sy":0,"sw":52,"sh":80,"res":2,"logicalW":26,"logicalH":40,"source":"art/incoming/Vegetation-Priority/masters/caverns/grass-back-3.png","sourceRegion":null,"sourceKind":"archived-master","sourceSize":[1254,1254],"sourceSha256":"8362c85283b9a23f46d81ff43d526a290041a5ab5c4470557f72f31eb05549a5"},"veg-caverns-grass-front-1":{"sx":384,"sy":0,"sw":32,"sh":46,"res":2,"logicalW":16,"logicalH":23,"source":"art/incoming/Vegetation-Priority/masters/caverns/grass-front-1.png","sourceRegion":null,"sourceKind":"archived-master","sourceSize":[1254,1254],"sourceSha256":"648610437bc8f12b2284c71ea2313ab42fec3a21caab210c99d1189145af9b32"},"veg-caverns-grass-front-2":{"sx":512,"sy":0,"sw":36,"sh":46,"res":2,"logicalW":18,"logicalH":23,"source":"art/incoming/Vegetation-Priority/masters/caverns/grass-front-2.png","sourceRegion":null,"sourceKind":"archived-master","sourceSize":[1254,1254],"sourceSha256":"9c7475797758c3a13dcb13d07dcdc6f7a48550d4ffcd5a02935dc5e768b610bd"},"veg-caverns-grass-front-3":{"sx":640,"sy":0,"sw":30,"sh":46,"res":2,"logicalW":15,"logicalH":23,"source":"art/incoming/Vegetation-Priority/masters/caverns/grass-front-3.png","sourceRegion":null,"sourceKind":"archived-master","sourceSize":[1254,1254],"sourceSha256":"759894f546d004008d4a5909ba283222432f46cadb2f7bb9270e303933b37f86"},"veg-caverns-mushroom-amber-1":{"sx":768,"sy":0,"sw":86,"sh":104,"res":2,"logicalW":43,"logicalH":52,"source":"art/concepts/environment-refresh/vegetation-mushrooms-master.png","sourceRegion":[608,316,938,666],"sourceKind":"new-generated-art","sourceSize":[1233,1275],"sourceSha256":"a5ad1d44753a4ddfb1798c3f7937b2faccee26a5e5189e3e678735213f8fb48d"},"veg-caverns-mushroom-amber-2":{"sx":896,"sy":0,"sw":86,"sh":126,"res":2,"logicalW":43,"logicalH":63,"source":"art/concepts/environment-refresh/vegetation-mushrooms-master.png","sourceRegion":[945,316,1233,666],"sourceKind":"new-generated-art","sourceSize":[1233,1275],"sourceSha256":"a5ad1d44753a4ddfb1798c3f7937b2faccee26a5e5189e3e678735213f8fb48d"},"veg-caverns-mushroom-teal-1":{"sx":1024,"sy":0,"sw":86,"sh":100,"res":2,"logicalW":43,"logicalH":50,"source":"art/concepts/environment-refresh/vegetation-mushrooms-master.png","sourceRegion":[0,666,330,992],"sourceKind":"new-generated-art","sourceSize":[1233,1275],"sourceSha256":"a5ad1d44753a4ddfb1798c3f7937b2faccee26a5e5189e3e678735213f8fb48d"},"veg-caverns-mushroom-teal-2":{"sx":0,"sy":128,"sw":84,"sh":128,"res":2,"logicalW":42,"logicalH":64,"source":"art/concepts/environment-refresh/vegetation-mushrooms-master.png","sourceRegion":[330,666,598,992],"sourceKind":"new-generated-art","sourceSize":[1233,1275],"sourceSha256":"a5ad1d44753a4ddfb1798c3f7937b2faccee26a5e5189e3e678735213f8fb48d"},"veg-caverns-mushroom-violet-1":{"sx":128,"sy":128,"sw":86,"sh":104,"res":2,"logicalW":43,"logicalH":52,"source":"art/concepts/environment-refresh/vegetation-mushrooms-master.png","sourceRegion":[600,666,970,992],"sourceKind":"new-generated-art","sourceSize":[1233,1275],"sourceSha256":"a5ad1d44753a4ddfb1798c3f7937b2faccee26a5e5189e3e678735213f8fb48d"},"veg-caverns-mushroom-violet-2":{"sx":256,"sy":128,"sw":86,"sh":124,"res":2,"logicalW":43,"logicalH":62,"source":"art/concepts/environment-refresh/vegetation-mushrooms-master.png","sourceRegion":[975,666,1233,992],"sourceKind":"new-generated-art","sourceSize":[1233,1275],"sourceSha256":"a5ad1d44753a4ddfb1798c3f7937b2faccee26a5e5189e3e678735213f8fb48d"},"veg-crypt-moss-1":{"sx":384,"sy":128,"sw":66,"sh":38,"res":2,"logicalW":33,"logicalH":19,"source":"art/incoming/Packet-08-Crypt-Mushrooms/masters/veg/crypt-moss-1.png","sourceRegion":null,"sourceKind":"archived-master","sourceSize":[1774,887],"sourceSha256":"d83a51aa5e9f0ace8be469a037322c4db2518fe0ce1c39a0978857a88ff8fd8d"},"veg-crypt-moss-2":{"sx":512,"sy":128,"sw":82,"sh":38,"res":2,"logicalW":41,"logicalH":19,"source":"art/incoming/Packet-08-Crypt-Mushrooms/masters/veg/crypt-moss-2.png","sourceRegion":null,"sourceKind":"archived-master","sourceSize":[1402,1122],"sourceSha256":"7d8bcf89fabe058beb141b59cbc1714e2a1a9cbe4169f0e4074c569011e5b478"},"veg-crypt-moss-3":{"sx":640,"sy":128,"sw":54,"sh":38,"res":2,"logicalW":27,"logicalH":19,"source":"art/incoming/Packet-08-Crypt-Mushrooms/masters/veg/crypt-moss-3.png","sourceRegion":null,"sourceKind":"archived-master","sourceSize":[1536,1024],"sourceSha256":"4c9c7e1c60be9496d79da4b2e0690c8c9fefc92e9ab662336dfdf4b3a1ee3201"},"veg-crypt-moss-4":{"sx":768,"sy":128,"sw":88,"sh":38,"res":2,"logicalW":44,"logicalH":19,"source":"art/incoming/Packet-08-Crypt-Mushrooms/masters/veg/crypt-moss-4.png","sourceRegion":null,"sourceKind":"archived-master","sourceSize":[1774,887],"sourceSha256":"3d778b90a78a4e5874a1d168fadac19d88c4b536a374a8c4bb86c29f1b258eba"},"veg-crypt-puffcap-1":{"sx":896,"sy":128,"sw":102,"sh":114,"res":2,"logicalW":51,"logicalH":57,"source":"art/incoming/Packet-08-Crypt-Mushrooms/masters/veg/crypt-puffcap-1.png","sourceRegion":null,"sourceKind":"archived-master","sourceSize":[1254,1254],"sourceSha256":"703d7ec7a4e0df079f9349c0bb3faaf191b4930ede5f3eb822eef64ec41929f2"},"veg-crypt-puffcap-2":{"sx":1024,"sy":128,"sw":88,"sh":114,"res":2,"logicalW":44,"logicalH":57,"source":"art/incoming/Packet-08-Crypt-Mushrooms/masters/veg/crypt-puffcap-2.png","sourceRegion":null,"sourceKind":"archived-master","sourceSize":[1254,1254],"sourceSha256":"72e382d731b7eae3629c348752c0f5dd6b34f1980eb0676b209373fd7a7da3f7"},"veg-crypt-puffcap-3":{"sx":0,"sy":256,"sw":110,"sh":114,"res":2,"logicalW":55,"logicalH":57,"source":"art/incoming/Packet-08-Crypt-Mushrooms/masters/veg/crypt-puffcap-3.png","sourceRegion":null,"sourceKind":"archived-master","sourceSize":[1254,1254],"sourceSha256":"dfe36195c8f9697243c7df18954bb1b000eb9ecfe5e25062bb75de5e14a30832"},"veg-crypt-roots-1":{"sx":128,"sy":256,"sw":82,"sh":114,"res":2,"logicalW":41,"logicalH":57,"source":"art/incoming/Packet-08-Crypt-Vegetation/masters/veg/crypt-roots-1.png","sourceRegion":null,"sourceKind":"archived-master","sourceSize":[1024,1536],"sourceSha256":"2551438a4e2dd6832311d8842bed0fec0c6ebdea3fff0ee2e335f55f5687eaad"},"veg-crypt-roots-2":{"sx":256,"sy":256,"sw":94,"sh":116,"res":2,"logicalW":47,"logicalH":58,"source":"art/incoming/Packet-08-Crypt-Vegetation/masters/veg/crypt-roots-2.png","sourceRegion":null,"sourceKind":"archived-master","sourceSize":[1024,1536],"sourceSha256":"d7c9bf602bff855c12f729fa538b24207f170c088c35b3768c6afb41c58941a4"},"veg-crypt-roots-3":{"sx":384,"sy":256,"sw":72,"sh":116,"res":2,"logicalW":36,"logicalH":58,"source":"art/incoming/Packet-08-Crypt-Vegetation/masters/veg/crypt-roots-3.png","sourceRegion":null,"sourceKind":"archived-master","sourceSize":[1145,1374],"sourceSha256":"3d2e041b0b0a9a5f41e028c5a1ed06479db0b6fd05695950a827653f35f06aba"},"veg-crypt-shelf-fungus-1":{"sx":512,"sy":256,"sw":96,"sh":116,"res":2,"logicalW":48,"logicalH":58,"source":"art/incoming/Packet-08-Crypt-Mushrooms/masters/veg/crypt-shelf-fungus-1.png","sourceRegion":null,"sourceKind":"archived-master","sourceSize":[1230,1278],"sourceSha256":"6c0c975d5a6b6622444166a20e232d58eb9aca450978882edbcf395d88be6f0f"},"veg-crypt-shelf-fungus-2":{"sx":640,"sy":256,"sw":98,"sh":116,"res":2,"logicalW":49,"logicalH":58,"source":"art/incoming/Packet-08-Crypt-Mushrooms/masters/veg/crypt-shelf-fungus-2.png","sourceRegion":null,"sourceKind":"archived-master","sourceSize":[1254,1254],"sourceSha256":"2381b7d6c8401de8db5e6c9eca1676ec1a026bed0e6725afdba6f7f7e344d916"},"veg-crypt-shelf-fungus-3":{"sx":768,"sy":256,"sw":68,"sh":116,"res":2,"logicalW":34,"logicalH":58,"source":"art/incoming/Packet-08-Crypt-Mushrooms/masters/veg/crypt-shelf-fungus-3.png","sourceRegion":null,"sourceKind":"archived-master","sourceSize":[1254,1254],"sourceSha256":"041f0b76abeb741eb1989da8797919fb42c5e4a9e924096efdb1edd4d40c19d7"},"veg-crypt-shroom-1":{"sx":896,"sy":256,"sw":74,"sh":80,"res":2,"logicalW":37,"logicalH":40,"source":"art/concepts/environment-refresh/vegetation-mushrooms-master.png","sourceRegion":[0,0,313,316],"sourceKind":"new-generated-art","sourceSize":[1233,1275],"sourceSha256":"a5ad1d44753a4ddfb1798c3f7937b2faccee26a5e5189e3e678735213f8fb48d"},"veg-crypt-shroom-2":{"sx":1024,"sy":256,"sw":66,"sh":80,"res":2,"logicalW":33,"logicalH":40,"source":"art/concepts/environment-refresh/vegetation-mushrooms-master.png","sourceRegion":[330,0,579,316],"sourceKind":"new-generated-art","sourceSize":[1233,1275],"sourceSha256":"a5ad1d44753a4ddfb1798c3f7937b2faccee26a5e5189e3e678735213f8fb48d"},"veg-crypt-shroom-3":{"sx":0,"sy":384,"sw":86,"sh":96,"res":2,"logicalW":43,"logicalH":48,"source":"art/concepts/environment-refresh/vegetation-mushrooms-master.png","sourceRegion":[603,0,902,316],"sourceKind":"new-generated-art","sourceSize":[1233,1275],"sourceSha256":"a5ad1d44753a4ddfb1798c3f7937b2faccee26a5e5189e3e678735213f8fb48d"},"veg-crypt-shroom-4":{"sx":128,"sy":384,"sw":86,"sh":102,"res":2,"logicalW":43,"logicalH":51,"source":"art/concepts/environment-refresh/vegetation-mushrooms-master.png","sourceRegion":[903,0,1233,316],"sourceKind":"new-generated-art","sourceSize":[1233,1275],"sourceSha256":"a5ad1d44753a4ddfb1798c3f7937b2faccee26a5e5189e3e678735213f8fb48d"},"veg-crypt-shroom-5":{"sx":256,"sy":384,"sw":64,"sh":124,"res":2,"logicalW":32,"logicalH":62,"source":"art/concepts/environment-refresh/vegetation-mushrooms-master.png","sourceRegion":[0,316,300,666],"sourceKind":"new-generated-art","sourceSize":[1233,1275],"sourceSha256":"a5ad1d44753a4ddfb1798c3f7937b2faccee26a5e5189e3e678735213f8fb48d"},"veg-crypt-shroom-6":{"sx":384,"sy":384,"sw":86,"sh":124,"res":2,"logicalW":43,"logicalH":62,"source":"art/concepts/environment-refresh/vegetation-mushrooms-master.png","sourceRegion":[320,316,603,666],"sourceKind":"new-generated-art","sourceSize":[1233,1275],"sourceSha256":"a5ad1d44753a4ddfb1798c3f7937b2faccee26a5e5189e3e678735213f8fb48d"},"veg-crypt-shroom-squashed-1":{"sx":512,"sy":384,"sw":78,"sh":58,"res":2,"logicalW":39,"logicalH":29,"source":"art/concepts/environment-refresh/vegetation-mushrooms-master.png","sourceRegion":[0,992,337,1275],"sourceKind":"new-generated-art","sourceSize":[1233,1275],"sourceSha256":"a5ad1d44753a4ddfb1798c3f7937b2faccee26a5e5189e3e678735213f8fb48d"},"veg-crypt-shroom-squashed-2":{"sx":640,"sy":384,"sw":90,"sh":56,"res":2,"logicalW":45,"logicalH":28,"source":"art/concepts/environment-refresh/vegetation-mushrooms-master.png","sourceRegion":[344,992,600,1275],"sourceKind":"new-generated-art","sourceSize":[1233,1275],"sourceSha256":"a5ad1d44753a4ddfb1798c3f7937b2faccee26a5e5189e3e678735213f8fb48d"},"veg-crypt-shroom-squashed-3":{"sx":768,"sy":384,"sw":100,"sh":58,"res":2,"logicalW":50,"logicalH":29,"source":"art/concepts/environment-refresh/vegetation-mushrooms-master.png","sourceRegion":[601,992,976,1275],"sourceKind":"new-generated-art","sourceSize":[1233,1275],"sourceSha256":"a5ad1d44753a4ddfb1798c3f7937b2faccee26a5e5189e3e678735213f8fb48d"},"veg-dungeon-grass-back-1":{"sx":896,"sy":384,"sw":70,"sh":80,"res":2,"logicalW":35,"logicalH":40,"source":"art/incoming/Vegetation-Priority/masters/dungeon/grass-back-1.png","sourceRegion":null,"sourceKind":"archived-master","sourceSize":[1254,1254],"sourceSha256":"07a7aa4c4dadc95e6246df96172fa2e3b7f1ddc45a629a5581f909c2c879dbc7"},"veg-dungeon-grass-back-2":{"sx":1024,"sy":384,"sw":60,"sh":80,"res":2,"logicalW":30,"logicalH":40,"source":"art/incoming/Vegetation-Priority/masters/dungeon/grass-back-2.png","sourceRegion":null,"sourceKind":"archived-master","sourceSize":[1254,1254],"sourceSha256":"126e491d6dd33daf3086af1cb2724e5d97f8b84d06662f44c44c3c66dbb7b604"},"veg-dungeon-grass-back-3":{"sx":0,"sy":512,"sw":62,"sh":80,"res":2,"logicalW":31,"logicalH":40,"source":"art/incoming/Vegetation-Priority/masters/dungeon/grass-back-3.png","sourceRegion":null,"sourceKind":"archived-master","sourceSize":[1254,1254],"sourceSha256":"9b2bda6aec6458217ccccd45e65a353af3c56d3125facde4ea487ee2fadd4c97"},"veg-dungeon-grass-front-1":{"sx":128,"sy":512,"sw":38,"sh":44,"res":2,"logicalW":19,"logicalH":22,"source":"art/incoming/Vegetation-Priority/masters/dungeon/grass-front-1.png","sourceRegion":null,"sourceKind":"archived-master","sourceSize":[1254,1254],"sourceSha256":"7752c8fe5d03b6011027c0092965372f6a8708bbe4f2750014dbde21e122d4b2"},"veg-dungeon-grass-front-2":{"sx":256,"sy":512,"sw":48,"sh":46,"res":2,"logicalW":24,"logicalH":23,"source":"art/incoming/Vegetation-Priority/masters/dungeon/grass-front-2.png","sourceRegion":null,"sourceKind":"archived-master","sourceSize":[1254,1254],"sourceSha256":"10a1087044e9171d3432a8afe72fa6599d5edee8b7c640f8c416190501bd5a2e"},"veg-dungeon-grass-front-3":{"sx":384,"sy":512,"sw":38,"sh":46,"res":2,"logicalW":19,"logicalH":23,"source":"art/incoming/Vegetation-Priority/masters/dungeon/grass-front-3.png","sourceRegion":null,"sourceKind":"archived-master","sourceSize":[1254,1254],"sourceSha256":"e55c83f2d095b7f4c39a0511103ad6fbd8856191fd90951dde717554212f5b3f"},"veg-earth-bush-1":{"sx":512,"sy":512,"sw":124,"sh":98,"res":2,"logicalW":62,"logicalH":49,"source":"art/incoming/Vegetation-Priority/masters/earth/bush-1.png","sourceRegion":null,"sourceKind":"archived-master","sourceSize":[1254,1254],"sourceSha256":"43f4d71b31e9419bee785c60e2ea5c08690eece82f690690cd4fdab97a04f9dc"},"veg-earth-bush-2":{"sx":640,"sy":512,"sw":124,"sh":102,"res":2,"logicalW":62,"logicalH":51,"source":"art/incoming/Vegetation-Priority/masters/earth/bush-2.png","sourceRegion":null,"sourceKind":"archived-master","sourceSize":[1254,1254],"sourceSha256":"adf480e7b6cb65a3e1558edbb73dbabfacb05c6abf1a5cc73bc147381e7661a3"},"veg-earth-bush-3":{"sx":768,"sy":512,"sw":124,"sh":92,"res":2,"logicalW":62,"logicalH":46,"source":"art/incoming/Vegetation-Priority/masters/earth/bush-3.png","sourceRegion":null,"sourceKind":"archived-master","sourceSize":[1254,1254],"sourceSha256":"8f4c74c90c3b59240341edb0b9ad1fad089fdd68c93993fa0ab2d895fbc7dafd"},"veg-earth-fern-1":{"sx":896,"sy":512,"sw":124,"sh":94,"res":2,"logicalW":62,"logicalH":47,"source":"art/incoming/Vegetation-Priority/masters/earth/fern-1.png","sourceRegion":null,"sourceKind":"archived-master","sourceSize":[1254,1254],"sourceSha256":"b94f7db57763f134a0d06cd17eb9a6c18d11329fdb7e0750fef14c21837a9652"},"veg-earth-fern-2":{"sx":1024,"sy":512,"sw":124,"sh":102,"res":2,"logicalW":62,"logicalH":51,"source":"art/incoming/Vegetation-Priority/masters/earth/fern-2.png","sourceRegion":null,"sourceKind":"archived-master","sourceSize":[1254,1254],"sourceSha256":"3a6ca83d3588ea941675437d5b8d32ac59ae39c3baa87e4314326031faf9a544"},"veg-earth-fern-3":{"sx":0,"sy":640,"sw":124,"sh":102,"res":2,"logicalW":62,"logicalH":51,"source":"art/incoming/Vegetation-Priority/masters/earth/fern-3.png","sourceRegion":null,"sourceKind":"archived-master","sourceSize":[1254,1254],"sourceSha256":"46eda3d205b6532c7db1f4cfb15358a7251e97be1ebdd79a535a63e5af2a7078"},"veg-earth-grass-back-1":{"sx":128,"sy":640,"sw":86,"sh":80,"res":2,"logicalW":43,"logicalH":40,"source":"art/incoming/Vegetation-Priority/masters/earth/grass-back-1.png","sourceRegion":null,"sourceKind":"archived-master","sourceSize":[1254,1254],"sourceSha256":"de2dcc3ac69df457c9630c060704cf1fbc757ee63428d3ee7eb2df662ddffa61"},"veg-earth-grass-back-2":{"sx":256,"sy":640,"sw":66,"sh":80,"res":2,"logicalW":33,"logicalH":40,"source":"art/incoming/Vegetation-Priority/masters/earth/grass-back-2.png","sourceRegion":null,"sourceKind":"archived-master","sourceSize":[1254,1254],"sourceSha256":"2fa94a80f50ae3f3b2aff4524d2c3f13fabc2d55262e788e49c69f1afb48fed4"},"veg-earth-grass-back-3":{"sx":384,"sy":640,"sw":80,"sh":80,"res":2,"logicalW":40,"logicalH":40,"source":"art/incoming/Vegetation-Priority/masters/earth/grass-back-3.png","sourceRegion":null,"sourceKind":"archived-master","sourceSize":[1254,1254],"sourceSha256":"2de7df5b4f163a6f6dccab92071287d72b7b31e4aac688db2cc233c532dc63a1"},"veg-earth-grass-front-1":{"sx":512,"sy":640,"sw":42,"sh":46,"res":2,"logicalW":21,"logicalH":23,"source":"art/incoming/Vegetation-Priority/masters/earth/grass-front-1.png","sourceRegion":null,"sourceKind":"archived-master","sourceSize":[1254,1254],"sourceSha256":"26f036242e32cc5a15b0efcc61d8fde01a0a085c62f061c3aad4e8aff302e8f1"},"veg-earth-grass-front-2":{"sx":640,"sy":640,"sw":50,"sh":46,"res":2,"logicalW":25,"logicalH":23,"source":"art/incoming/Vegetation-Priority/masters/earth/grass-front-2.png","sourceRegion":null,"sourceKind":"archived-master","sourceSize":[1254,1254],"sourceSha256":"dd00e69aae99262f8982e80156c4e350039f6a42916787e0e7c7409bb971378d"},"veg-earth-grass-front-3":{"sx":768,"sy":640,"sw":42,"sh":46,"res":2,"logicalW":21,"logicalH":23,"source":"art/incoming/Vegetation-Priority/masters/earth/grass-front-3.png","sourceRegion":null,"sourceKind":"archived-master","sourceSize":[1254,1254],"sourceSha256":"1eb22880599418449814b3760d0feec291379b9d59cf50218b69d4b87c510463"},"veg-earth-mushroom-cluster-1":{"sx":896,"sy":640,"sw":124,"sh":122,"res":2,"logicalW":62,"logicalH":61,"source":"art/incoming/Vegetation-Priority/masters/earth/mushroom-cluster-1.png","sourceRegion":null,"sourceKind":"archived-master","sourceSize":[1254,1254],"sourceSha256":"739a78b20b9778e3b97420f768c24ddf0b4ab3913979b09945ebe0f83fe57bd3"},"veg-earth-mushroom-cluster-2":{"sx":1024,"sy":640,"sw":120,"sh":124,"res":2,"logicalW":60,"logicalH":62,"source":"art/incoming/Vegetation-Priority/masters/earth/mushroom-cluster-2.png","sourceRegion":null,"sourceKind":"archived-master","sourceSize":[1254,1254],"sourceSha256":"76c13e39c52bccd26e270cb24a9ae1121b12ac54ebd30e6dd3ec4bbe79499fb4"},"veg-earth-mushroom-cluster-3":{"sx":0,"sy":768,"sw":124,"sh":116,"res":2,"logicalW":62,"logicalH":58,"source":"art/incoming/Vegetation-Priority/masters/earth/mushroom-cluster-3.png","sourceRegion":null,"sourceKind":"archived-master","sourceSize":[1254,1254],"sourceSha256":"e9443b09b8043a1598dd94d45b876d3b1605eb2a8a78c49e7881bdbb5c830de3"},"veg-earth-root-tangle-1":{"sx":128,"sy":768,"sw":124,"sh":108,"res":2,"logicalW":62,"logicalH":54,"source":"art/incoming/Vegetation-Priority/masters/earth/root-tangle-1.png","sourceRegion":null,"sourceKind":"archived-master","sourceSize":[1254,1254],"sourceSha256":"c29bd6396e850bf5ea20153d60f34c719780659651007dd2c88440f919be351a"},"veg-earth-root-tangle-2":{"sx":256,"sy":768,"sw":124,"sh":92,"res":2,"logicalW":62,"logicalH":46,"source":"art/incoming/Vegetation-Priority/masters/earth/root-tangle-2.png","sourceRegion":null,"sourceKind":"archived-master","sourceSize":[1254,1254],"sourceSha256":"43d7bad8bbfc9b787e22915be242b05b87da61b79e2eefd2f642cc59f967cbbe"},"veg-underdark-fungus-1":{"sx":384,"sy":768,"sw":120,"sh":112,"res":2,"logicalW":60,"logicalH":56,"source":"art/incoming/Packet-07-Underdark-Creatures-Props/masters/veg/underdark-fungus-1.png","sourceRegion":null,"sourceKind":"archived-master","sourceSize":[1254,1254],"sourceSha256":"27b35b3012576620826c2f1053ba04980da1449eee68f60c6197f7dff05f7c03"},"veg-underdark-fungus-2":{"sx":512,"sy":768,"sw":82,"sh":120,"res":2,"logicalW":41,"logicalH":60,"source":"art/incoming/Packet-07-Underdark-Creatures-Props/masters/veg/underdark-fungus-2.png","sourceRegion":null,"sourceKind":"archived-master","sourceSize":[1254,1254],"sourceSha256":"fc6d015713aee18560c5cd8d7fb3b095172759b2f2ec5374ae8cdd636b92746a"},"veg-underdark-fungus-3":{"sx":640,"sy":768,"sw":120,"sh":94,"res":2,"logicalW":60,"logicalH":47,"source":"art/incoming/Packet-07-Underdark-Creatures-Props/masters/veg/underdark-fungus-3.png","sourceRegion":null,"sourceKind":"archived-master","sourceSize":[1254,1254],"sourceSha256":"020c51832061cb3e2d87ca43d7a0f6878dd7978c69e805552e8e1b1fd807fc87"},"veg-underdark-grass-back-1":{"sx":768,"sy":768,"sw":50,"sh":80,"res":2,"logicalW":25,"logicalH":40,"source":"art/incoming/Packet-07-Underdark-Creatures-Props/masters/veg/underdark-grass-back-1.png","sourceRegion":null,"sourceKind":"archived-master","sourceSize":[1254,1254],"sourceSha256":"f4b00cac87a21394836d438ecc5b889093d3fd4b092ac4e5adc6e844f4f247bd"},"veg-underdark-grass-back-2":{"sx":896,"sy":768,"sw":50,"sh":80,"res":2,"logicalW":25,"logicalH":40,"source":"art/incoming/Packet-07-Underdark-Creatures-Props/masters/veg/underdark-grass-back-2.png","sourceRegion":null,"sourceKind":"archived-master","sourceSize":[1254,1254],"sourceSha256":"dd5c635bcc069d77fbce252dec767b499d71827f532fa1876300d998882e5aaa"},"veg-underdark-grass-back-3":{"sx":1024,"sy":768,"sw":62,"sh":80,"res":2,"logicalW":31,"logicalH":40,"source":"art/incoming/Packet-07-Underdark-Creatures-Props/masters/veg/underdark-grass-back-3.png","sourceRegion":null,"sourceKind":"archived-master","sourceSize":[1254,1254],"sourceSha256":"9a7802f2066643b3f2450677e5de59eb4415856b04a1d3fca91d412e36de8052"},"veg-underdark-grass-front-1":{"sx":0,"sy":896,"sw":32,"sh":46,"res":2,"logicalW":16,"logicalH":23,"source":"art/incoming/Packet-07-Underdark-Creatures-Props/masters/veg/underdark-grass-front-1.png","sourceRegion":null,"sourceKind":"archived-master","sourceSize":[1254,1254],"sourceSha256":"cb40bfa2f1ed1edf9e284848ea7b961769ce1de71a6b1f5b488a3cce99180642"},"veg-underdark-grass-front-2":{"sx":128,"sy":896,"sw":34,"sh":46,"res":2,"logicalW":17,"logicalH":23,"source":"art/incoming/Packet-07-Underdark-Creatures-Props/masters/veg/underdark-grass-front-2.png","sourceRegion":null,"sourceKind":"archived-master","sourceSize":[1254,1254],"sourceSha256":"b106032c2839ce6277c292bd8cec411af2451c30cb8ff07bb3806d6f657b4b7b"},"veg-underdark-grass-front-3":{"sx":256,"sy":896,"sw":24,"sh":46,"res":2,"logicalW":12,"logicalH":23,"source":"art/incoming/Packet-07-Underdark-Creatures-Props/masters/veg/underdark-grass-front-3.png","sourceRegion":null,"sourceKind":"archived-master","sourceSize":[1254,1254],"sourceSha256":"d6033379ba0d306a5d0e8895f5458cdfe7164035bb5fcb916259531bec3a6545"},"veg-volcanic-ashweed-1":{"sx":384,"sy":896,"sw":64,"sh":120,"res":2,"logicalW":32,"logicalH":60,"source":"art/incoming/Packet-07-Underdark-Creatures-Props/masters/veg/volcanic-ashweed-1.png","sourceRegion":null,"sourceKind":"archived-master","sourceSize":[1254,1254],"sourceSha256":"9bbafc4bd4dcd0a1ff635aca97aecbd3448989b2e7c35365ea2c7f5ddc349bee"},"veg-volcanic-ashweed-2":{"sx":512,"sy":896,"sw":72,"sh":120,"res":2,"logicalW":36,"logicalH":60,"source":"art/incoming/Packet-07-Underdark-Creatures-Props/masters/veg/volcanic-ashweed-2.png","sourceRegion":null,"sourceKind":"archived-master","sourceSize":[1254,1254],"sourceSha256":"4e8f404602a2e85427742981a52b0e39ab3e85ec36b9db9e920b7a99e2d46359"},"veg-volcanic-ashweed-3":{"sx":640,"sy":896,"sw":64,"sh":120,"res":2,"logicalW":32,"logicalH":60,"source":"art/incoming/Packet-07-Underdark-Creatures-Props/masters/veg/volcanic-ashweed-3.png","sourceRegion":null,"sourceKind":"archived-master","sourceSize":[1254,1254],"sourceSha256":"cb36ebf25732fb585d640e2c23ed8c5c1ff32505ac93d637e4af1813e07e2a46"}},"clusters":{"file":"environment-vegetation-clusters.webp","cell":128,"families":["mushroom-teal","mushroom-violet","mushroom-amber","mushroom-crypt","urn"],"variants":5,"sources":{"mushroom-teal":[{"name":"veg-caverns-mushroom-teal-1","source":"art/concepts/environment-refresh/vegetation-mushrooms-master.png","sourceRegion":[0,666,330,992],"sourceKind":"new-generated-art"},{"name":"veg-caverns-mushroom-teal-2","source":"art/concepts/environment-refresh/vegetation-mushrooms-master.png","sourceRegion":[330,666,598,992],"sourceKind":"new-generated-art"}],"mushroom-violet":[{"name":"veg-caverns-mushroom-violet-1","source":"art/concepts/environment-refresh/vegetation-mushrooms-master.png","sourceRegion":[600,666,970,992],"sourceKind":"new-generated-art"},{"name":"veg-caverns-mushroom-violet-2","source":"art/concepts/environment-refresh/vegetation-mushrooms-master.png","sourceRegion":[975,666,1233,992],"sourceKind":"new-generated-art"}],"mushroom-amber":[{"name":"veg-caverns-mushroom-amber-1","source":"art/concepts/environment-refresh/vegetation-mushrooms-master.png","sourceRegion":[608,316,938,666],"sourceKind":"new-generated-art"},{"name":"veg-caverns-mushroom-amber-2","source":"art/concepts/environment-refresh/vegetation-mushrooms-master.png","sourceRegion":[945,316,1233,666],"sourceKind":"new-generated-art"}],"mushroom-crypt":[{"name":"veg-crypt-shroom-1","source":"art/concepts/environment-refresh/vegetation-mushrooms-master.png","sourceRegion":[0,0,313,316],"sourceKind":"new-generated-art"},{"name":"veg-crypt-shroom-2","source":"art/concepts/environment-refresh/vegetation-mushrooms-master.png","sourceRegion":[330,0,579,316],"sourceKind":"new-generated-art"},{"name":"veg-crypt-shroom-3","source":"art/concepts/environment-refresh/vegetation-mushrooms-master.png","sourceRegion":[603,0,902,316],"sourceKind":"new-generated-art"},{"name":"veg-crypt-shroom-4","source":"art/concepts/environment-refresh/vegetation-mushrooms-master.png","sourceRegion":[903,0,1233,316],"sourceKind":"new-generated-art"},{"name":"veg-crypt-shroom-5","source":"art/concepts/environment-refresh/vegetation-mushrooms-master.png","sourceRegion":[0,316,300,666],"sourceKind":"new-generated-art"},{"name":"veg-crypt-shroom-6","source":"art/concepts/environment-refresh/vegetation-mushrooms-master.png","sourceRegion":[320,316,603,666],"sourceKind":"new-generated-art"}],"urn":[{"name":"urn-tall","source":"art/concepts/environment-refresh/crypt-props-master.png","region":[314,627,627,940],"alphaBounds":[72,2,238,311],"sha256":"aade80b2e7d721e13bf37d1c1a67ec48eaffa00496ac6587d7c5bdd7148e668e","kind":"new-generated-art"},{"name":"urn-squat","source":"art/concepts/environment-refresh/crypt-props-master.png","region":[0,627,314,940],"alphaBounds":[42,42,263,302],"sha256":"aade80b2e7d721e13bf37d1c1a67ec48eaffa00496ac6587d7c5bdd7148e668e","kind":"new-generated-art"},{"name":"urn-ornate","source":"art/concepts/environment-refresh/crypt-props-master.png","region":[627,314,940,627],"alphaBounds":[82,4,239,302],"sha256":"aade80b2e7d721e13bf37d1c1a67ec48eaffa00496ac6587d7c5bdd7148e668e","kind":"new-generated-art"}]},"layouts":{"vessels":[[[0.29,0.61,0.45,0],[0.7,0.59,0.44,1],[0.51,0.96,0.48,2]],[[0.48,0.55,0.47,1],[0.23,0.92,0.46,0],[0.76,0.95,0.47,2]],[[0.21,0.75,0.36,0],[0.51,0.73,0.53,1],[0.79,0.95,0.34,2]],[[0.26,0.6,0.4,0],[0.71,0.73,0.51,2],[0.3,0.97,0.46,1]],[[0.25,0.66,0.46,2],[0.73,0.63,0.43,1],[0.5,0.94,0.4,0]]],"mushrooms":[[[0.25,0.58,0.33,0],[0.64,0.57,0.39,1],[0.47,0.88,0.41,2],[0.83,0.94,0.26,3]],[[0.26,0.48,0.34,1],[0.72,0.61,0.4,0],[0.33,0.88,0.41,3],[0.66,0.96,0.27,2]],[[0.23,0.61,0.41,0],[0.54,0.44,0.29,2],[0.79,0.73,0.38,1],[0.49,0.92,0.32,3]],[[0.34,0.54,0.4,1],[0.7,0.62,0.35,2],[0.18,0.94,0.28,3],[0.55,0.94,0.44,0]],[[0.21,0.64,0.32,3],[0.47,0.55,0.41,2],[0.78,0.66,0.3,0],[0.68,0.95,0.41,1],[0.28,0.98,0.33,2]]]}},"sha256":{"environment-vegetation.webp":"4d1606d4dd3b3ba65d88352524af39e47c65e37fd72f7f6790c37fee8fc29276","environment-vegetation-clusters.webp":"eb3c915c8bfdc3ce07464aa6e76d8bc76715501b29e402bab2c728bf687e0689"},"note":"SourceKind distinguishes new generated artwork, archived masters and known coarse pixel-art masters. PNG dimensions alone do not imply fine detail. All 69 old trimmed logical bounds retained. The 25 mushroom/urn clusters keep their original arrangements; urn pieces use recovered or newly generated prop masters. Crates, pots and barrels draw one high-resolution prop per logical placement and need no cluster rows."};

;
/* js/world/terrain/environment-vegetation.js */
/* Archived plant masters with the native positions, sway and logical sizes. */
(function(root){
  'use strict';
  var meta=root.FOTE_ENVIRONMENT_VEGETATION_META,images={},pending=null,loaded=false,failure=null;
  function redrawIfWorldReady(){
    if(typeof draw==='function'&&typeof player!=='undefined'&&player&&typeof map!=='undefined'&&map&&map.length&&typeof sceneVisibility()!=='undefined'&&sceneVisibility()&&sceneVisibility().length===map.length&&typeof seen!=='undefined'&&seen&&seen.length===map.length)draw();
  }
  function ensureAssets(){
    if(loaded)return Promise.resolve(true);if(pending)return pending;
    if(!meta)return Promise.reject(Error('Environment vegetation metadata is missing'));
    pending=Promise.all(meta.files.map(function(file){return new Promise(function(resolve,reject){
      var image=new Image();images[file]=image;
      image.onload=resolve;image.onerror=function(){reject(Error('Unable to load '+file));};
      image.src='art/packed/'+file+'?v='+meta.sha256[file].slice(0,12);
    });})).then(function(){loaded=true;redrawIfWorldReady();return true;}).catch(function(e){failure=e;pending=null;throw e;});
    return pending;
  }
  function art(name){
    if(!loaded)return null;var item=meta.items[name.indexOf('veg-')===0?name:'veg-'+name];if(!item)return null;
    return {img:images[meta.file],sx:item.sx,sy:item.sy,sw:item.sw,sh:item.sh,res:item.res,nm:name,environmentVegetation:true};
  }
  // The only definitions (2026-09-27): the old map-veg.webp and prop-clusters.webp are archived.
  root.vegArt=art;
  root.vegDraw=function(o,cx,base,scale,shear,alpha,flip){
    if(!o)return;
    if(/mushroom|shroom|fungus/.test(o.nm||''))scale*=.5;
    var s=TS/64*scale/o.res,w=o.sw*s,h=o.sh*s,b=vegBaked(o);
    ctx.save();ctx.globalAlpha=alpha;ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='low';
    ctx.translate(cx,base);ctx.transform(1,0,-shear,1,0,0);if(flip)ctx.scale(-1,1);
    if(b)ctx.drawImage(b,0,0,o.sw,o.sh,-w/2,-h,w,h);
    else ctx.drawImage(o.img,o.sx,o.sy,o.sw,o.sh,-w/2,-h,w,h);
    if(root.FoteNormalLighting)root.FoteNormalLighting.record(ctx,b?{img:b,sx:0,sy:0,sw:o.sw,sh:o.sh}:o,{x:-w/2,y:-h,w:w,h:h},{normal:false,surface:{kind:'sprite',x:cx/TS+camX-.5,y:base/TS+camY-1,height:h/TS,footV:1,admissionX:Math.floor(cx/TS)+camX,admissionY:Math.floor(base/TS-.5)+camY}});
    ctx.restore();
  };
  root.sceneryClusterArt=function(family,variant){
    var mushroomFamilies=['mushroom-teal','mushroom-violet','mushroom-amber','mushroom-crypt','mushroom-earth'];
    var mushroomRow=mushroomFamilies.indexOf(family);
    if(mushroomRow>=0&&root.FoteEnvironmentProps)return root.FoteEnvironmentProps.art('props','mushroom-spread-'+mushroomRow+'-'+(((Math.floor(variant)||0)%5+5)%5));
    return sourceClusterArt(family,variant);
  };
  // Original full-size clusters remain available to combat effects.
  function sourceClusterArt(family,variant){
    var row=loaded?meta.clusters.families.indexOf(family):-1;
    if(row<0)return null;
    var cell=meta.clusters.cell,col=((Math.floor(variant)||0)%5+5)%5;
    return {img:images[meta.clusters.file],sx:col*cell,sy:row*cell,sw:cell,sh:cell};
  }
  root.FoteEnvironmentVegetation=Object.freeze({ensureAssets:ensureAssets,ready:function(){return loaded;},art:art,metadata:function(){return meta;},clusterArt:sourceClusterArt,error:function(){return failure;}});
  ensureAssets().catch(function(){/* the loading screen's Retry fetches again */});
})(globalThis);

;
/* js/presentation/animation/portrait-animation.js */
/* Approved portrait frames only. This presentation controller never writes actor
   state; paper dolls and the game's world-sprite animation keep their owners. */
(function(root){
  'use strict';
  var supportedLooks=new Set(['human','elf','dwarf','gloomling','fae-air','fae-fire','fae-water','fae-earth'].flatMap(function(base){return [base+'-f',base+'-m'];}));
  var approvedLooks=['human','elf','dwarf','gloomling','fae-air','fae-fire','fae-water','fae-earth'].reduce(function(looks,base){return looks.concat([base+'-f',base+'-m']);},[]);
  function validFrameDelays(clip){return Array.isArray(clip.frame_delays)&&clip.frame_delays.length===clip.frame_count&&clip.frame_delays.every(function(delay){return Number.isFinite(delay)&&delay>0;});}
  function validClip(clip){return !!clip&&Number.isInteger(clip.frame_count)&&clip.frame_count>0&&(validFrameDelays(clip)||Number.isFinite(clip.delay)&&clip.delay>0);}
  function clipTiming(clip){
    if(!validClip(clip))return null;
    var delays=validFrameDelays(clip)?clip.frame_delays:Array(clip.frame_count).fill(clip.delay),duration=0;
    return {ends:delays.map(function(delay){duration+=delay;return duration;}),duration:duration};
  }
  function clipDuration(clip){var timing=clipTiming(clip);return timing?timing.duration:0;}
  function createTimeline(entry,start){
    var clips=entry.clips,quiet=clipTiming(clips.quiet),turn=clipTiming(clips.turn),hurt=clipTiming(clips.hurt);
    if(!quiet)throw new Error('Portrait needs a timed quiet clip');
    var quietDuration=quiet.duration,cycle=quietDuration*2+(turn?turn.duration:0),idleStart=start,hurtStart=null;
    function frame(phase,timing,elapsed){
      var index=0;while(index<timing.ends.length-1&&elapsed>=timing.ends[index])index++;
      return {phase:phase,frame:index,nextIn:Math.max(1,timing.ends[index]-elapsed)};
    }
    return {
      hurt:function(now){if(hurt)hurtStart=now;},
      sample:function(now){
        if(hurtStart!==null){
          var hurtElapsed=Math.max(0,now-hurtStart),duration=hurt.duration;
          if(hurtElapsed<duration)return frame('hurt',hurt,hurtElapsed);
          idleStart=hurtStart+duration;hurtStart=null;
        }
        var elapsed=Math.max(0,now-idleStart)%cycle;
        if(elapsed<quietDuration*2)return frame('quiet',quiet,elapsed%quietDuration);
        return frame('turn',turn,elapsed-quietDuration*2);
      }
    };
  }
  function createController(ports){
    var actor=null,look='',host=null,lastHp=null,fallbackHp=null,assets=null,timeline=null,timer=null,version=0,paused=true,lastFrame='',seen=new Set(),damageBus=null,unsubscribe=null,loading=null,loadError=null,retryAt=0;
    function cancel(){if(timer!==null){ports.clearTimeout(timer);timer=null;}}
    function subscribe(){
      var bus=ports.damageBus&&ports.damageBus();
      if(bus===damageBus)return;
      if(unsubscribe)unsubscribe();damageBus=bus;unsubscribe=bus&&bus.on('damageApplied',damage);
    }
    function render(){
      cancel();
      if(!host||!actor)return;
      var stop=!!ports.reduced()||!!ports.hidden();
      if(stop||!assets){paused=true;lastFrame='';ports.still(host,look);return;}
      var now=ports.now();
      if(paused||!timeline){timeline=createTimeline(assets.entry,now);paused=false;lastFrame='';}
      var sample=timeline.sample(now),key=sample.phase+':'+sample.frame;
      if(key!==lastFrame){ports.draw(host,assets,sample);lastFrame=key;}
      else if(ports.attach)ports.attach(host,assets);
      timer=ports.setTimeout(render,sample.nextIn);
    }
    function flinch(){
      if(!timeline||paused||ports.reduced()||ports.hidden())return;
      timeline.hurt(ports.now());lastFrame='';render();
    }
    function damage(event){
      if(!event||event.target!==actor||!(event.damage>0))return;
      var key=event.id===undefined?event:event.id;
      if(seen.has(key))return;
      seen.add(key);if(seen.size>64)seen.delete(seen.values().next().value);
      // commitDamage can refresh the HUD before damageApplied is emitted. Consume
      // the HP fallback for that same committed hit instead of starting it twice.
      var hp=Number.isFinite(actor.hp)?actor.hp:null,alreadyShown=fallbackHp!==null&&fallbackHp===hp;
      fallbackHp=null;lastHp=hp;if(!alreadyShown)flinch();
    }
    function loadCurrent(){
      if(loading&&loading.version===version)return loading.promise;
      var ticket=version,nextLook=look,request={version:ticket,promise:null};loading=request;
      request.promise=Promise.resolve().then(function(){return ports.load(nextLook);}).then(function(loaded){
        if(ticket!==version)return;
        assets=loaded;loadError=null;retryAt=0;render();
      }).catch(function(error){if(ticket===version){assets=null;loadError=error;retryAt=ports.now()+5000;render();}}).then(function(){if(loading===request)loading=null;});
      return request.promise;
    }
    function retry(){
      if(!host||!actor)return Promise.resolve();
      if(ports.retryStill)ports.retryStill(look);
      if(assets){render();return Promise.resolve();}
      return loadCurrent();
    }
    function paint(nextHost,nextActor){
      if(!nextHost||!nextActor||!supportedLooks.has(String(nextActor.look||'')))return;
      subscribe();host=nextHost;
      var nextLook=String(nextActor.look);
      if(nextActor!==actor||nextLook!==look){
        cancel();actor=nextActor;look=nextLook;lastHp=Number.isFinite(actor.hp)?actor.hp:null;fallbackHp=null;seen.clear();assets=null;timeline=null;paused=true;lastFrame='';
        version++;loading=null;loadError=null;retryAt=0;
        ports.still(host,look);
        loadCurrent();
      }else{
        if(loadError&&ports.now()>=retryAt)loadCurrent();
        var hp=Number.isFinite(actor.hp)?actor.hp:null;
        if(hp!==lastHp){
          var lowered=hp!==null&&lastHp!==null&&hp<lastHp;lastHp=hp;fallbackHp=null;
          if(lowered){fallbackHp=hp;flinch();}
        }
      }
      render();
    }
    return {
      paint:paint,damage:damage,retry:retry,error:function(){return loadError;},
      refresh:function(){if(host&&actor)paint(host,actor);},
      dispose:function(){cancel();version++;loading=null;if(unsubscribe)unsubscribe();unsubscribe=null;damageBus=null;actor=null;host=null;assets=null;timeline=null;},
      state:function(){return timeline&&!paused?timeline.sample(ports.now()):null;}
    };
  }
  var browserController=null,browserAssetPorts=null;
  function browserPorts(){
    var manifestUrl=new URL('art/portraits/animations/manifest.json',document.baseURI),manifest=null,loaded=new Map(),images=new Map();
    function validateManifest(entries){
      if(!Array.isArray(entries))throw new Error('Portrait manifest is invalid');
      var ids=new Set();
      entries.forEach(function(entry){
        if(!entry||!supportedLooks.has(entry.id)||ids.has(entry.id))throw new Error('Portrait manifest has an invalid or duplicate look: '+(entry&&entry.id));
        ids.add(entry.id);
        if(!Number.isInteger(entry.width)||entry.width<1||!Number.isInteger(entry.height)||entry.height<1||typeof entry.portrait!=='string'||!entry.portrait)
          throw new Error('Portrait '+entry.id+' has invalid dimensions or still artwork');
        ['quiet','turn','hurt'].forEach(function(phase){
          var clip=entry.clips&&entry.clips[phase];
          if(!validClip(clip)||typeof clip.sheet!=='string'||!clip.sheet)throw new Error('Portrait '+entry.id+' '+phase+' clip is missing or invalid');
        });
      });
      approvedLooks.forEach(function(look){if(!ids.has(look))throw new Error('Portrait manifest is missing approved look '+look);});
      return entries;
    }
    function deadline(promise,ms,label,cancel){
      return new Promise(function(resolve,reject){
        var settled=false,timer=setTimeout(function(){if(settled)return;settled=true;if(cancel)cancel();reject(new Error(label+' timed out'));},ms);
        Promise.resolve(promise).then(function(value){if(settled)return;settled=true;clearTimeout(timer);resolve(value);},function(error){if(settled)return;settled=true;clearTimeout(timer);reject(error);});
      });
    }
    function getManifest(){
      if(!manifest){
        var controller=typeof AbortController==='function'?new AbortController():null;
        var fetchManifest=Promise.resolve().then(function(){return fetch(manifestUrl.href,controller?{signal:controller.signal}:undefined);}).then(function(response){if(!response.ok)throw new Error('Portrait manifest could not load (HTTP '+response.status+')');return response.json();}).then(validateManifest).catch(function(error){
          if(error&&/^Portrait /.test(error.message))throw error;
          throw new Error('Portrait manifest could not load: '+(error&&error.message||error));
        });
        var request=deadline(fetchManifest,15000,'Portrait manifest',function(){if(controller)controller.abort();});
        manifest=request;
        request.catch(function(){if(manifest===request)manifest=null;});
      }
      return manifest;
    }
    /* Rendering may show a pending still, but only an explicit load/preparation
       request replaces a failed record. Successful image decodes stay shared. */
    function imageRecord(url,label,retryFailed){
      var prior=images.get(url);if(prior&&(!prior.failed||!retryFailed))return prior;
      var image=new Image(),record={image:image,failed:false,promise:null};images.set(url,record);
      var arrival=new Promise(function(resolve,reject){image.onload=function(){resolve(image);};image.onerror=function(){reject(new Error(label+' could not load'));};image.src=url;});
      record.promise=deadline(arrival,15000,label+' load',function(){image.onload=image.onerror=null;image.src='';}).then(function(){
        image.onload=image.onerror=null;
        return deadline(Promise.resolve().then(function(){if(typeof image.decode==='function')return image.decode();}),10000,label+' decode').catch(function(error){throw new Error(label+' could not decode: '+String(error&&error.message||error));});
      }).then(function(){return image;});
      record.promise.catch(function(){record.failed=true;image.onload=image.onerror=null;});
      return record;
    }
    function stillImage(look,retryFailed){
      var record=imageRecord(new URL('../'+look+'.webp',manifestUrl).href,'Portrait '+look+' still',retryFailed),image=record.image;
      image.alt='';image.setAttribute('aria-hidden','true');image.style.cssText='width:100%;height:100%;object-fit:contain;image-rendering:pixelated';
      return record;
    }
    function load(look){
      if(!loaded.has(look)){
        var request=getManifest().then(function(entries){
          var entry=entries.find(function(item){return item.id===look;});if(!entry)throw new Error('Missing approved portrait '+look);
          var sheets={},still=stillImage(look,true);
          function dimensions(record,width,height,label){
            return record.promise.then(function(image){
              if(image.naturalWidth!==width||image.naturalHeight!==height){record.failed=true;throw new Error(label+' has invalid dimensions: '+image.naturalWidth+'x'+image.naturalHeight);}
              return image;
            });
          }
          return Promise.all([dimensions(still,entry.width,entry.height,'Portrait '+look+' still')].concat(['quiet','turn','hurt'].map(function(phase){
            var clip=entry.clips[phase],label='Portrait '+look+' '+phase+' sheet';
            return dimensions(imageRecord(new URL(clip.sheet,manifestUrl).href,label,true),entry.width,entry.height*clip.frame_count,label).then(function(image){
              sheets[phase]=image;
            });
          }))).then(function(){
            var canvas=document.createElement('canvas');canvas.width=entry.width;canvas.height=entry.height;canvas.setAttribute('aria-hidden','true');canvas.style.cssText='width:100%;height:100%;object-fit:contain;image-rendering:pixelated';
            var context=canvas.getContext('2d');if(!context)throw new Error('Portrait '+look+' canvas unavailable');context.imageSmoothingEnabled=false;
            return {entry:entry,sheets:sheets,canvas:canvas,context:context};
          });
        });
        loaded.set(look,request);request.catch(function(){if(loaded.get(look)===request)loaded.delete(look);});
      }
      return loaded.get(look);
    }
    function attach(host,assets){if(host.firstChild!==assets.canvas||host.childNodes.length!==1)host.replaceChildren(assets.canvas);}
    return {
      now:function(){return performance.now();},setTimeout:function(fn,delay){return setTimeout(fn,delay);},clearTimeout:function(id){clearTimeout(id);},
      reduced:function(){return typeof ANIM!=='undefined'?ANIM.reduce:!!(root.matchMedia&&root.matchMedia('(prefers-reduced-motion: reduce)').matches);},
      hidden:function(){
        var title=document.getElementById&&document.getElementById('title'),create=document.getElementById&&document.getElementById('create');
        return document.hidden||!!(title&&title.classList.contains('on'))||!!(create&&create.classList.contains('on'));
      },damageBus:function(){return typeof gameDamage!=='undefined'?gameDamage:null;},
      still:function(host,look){
        var image=stillImage(look,false).image;
        if(host.firstChild!==image||host.childNodes.length!==1)host.replaceChildren(image);
      },
      retryStill:function(look){stillImage(look,true);},
      load:load,ensureAssets:function(look){
        if(!supportedLooks.has(String(look||'')))return Promise.reject(new Error('An approved current portrait look is required'));
        return load(look);
      },attach:attach,
      draw:function(host,assets,sample){
        var entry=assets.entry,context=assets.context;
        context.clearRect(0,0,entry.width,entry.height);context.drawImage(assets.sheets[sample.phase],0,sample.frame*entry.height,entry.width,entry.height,0,0,entry.width,entry.height);
        assets.canvas.dataset.look=entry.id;assets.canvas.dataset.phase=sample.phase;assets.canvas.dataset.frame=String(sample.frame);attach(host,assets);
      }
    };
  }
  function sharedBrowserPorts(){if(!browserAssetPorts)browserAssetPorts=browserPorts();return browserAssetPorts;}
  var api={clipDuration:clipDuration,createTimeline:createTimeline,createController:createController,
  ensureAssets:function(look){return sharedBrowserPorts().ensureAssets(look).then(function(){if(browserController)return browserController.retry();});},
  retry:function(look){
    if(look)return sharedBrowserPorts().ensureAssets(look).then(function(){if(browserController)return browserController.retry();});
    return browserController?browserController.retry():Promise.resolve();
  },error:function(){return browserController&&browserController.error();},refresh:function(){if(browserController)browserController.refresh();},paint:function(host,actor){
    if(!browserController){browserController=createController(sharedBrowserPorts());document.addEventListener('visibilitychange',function(){browserController.refresh();if(!document.hidden)browserController.retry();});root.addEventListener&&root.addEventListener('online',function(){browserController.retry();});}
    browserController.paint(host,actor);
  }};
  root.FotePortraitAnimation=Object.freeze(api);if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis==='object'?globalThis:this);

