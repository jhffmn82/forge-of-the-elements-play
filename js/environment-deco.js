/* Generated environment decals, shared by every biome. Selection, placement,
 * collision, seeded density and lighting stay in the existing renderer. */
(function(root){
  'use strict';
  var meta=root.FOTE_ENVIRONMENT_DECO_META, image=null, pending=null, loaded=false, error=null,cells={},caps={};
  function redrawIfWorldReady(){
    if(typeof draw==='function'&&typeof player!=='undefined'&&player&&typeof map!=='undefined'&&map&&map.length&&typeof vis!=='undefined'&&vis&&vis.length===map.length&&typeof seen!=='undefined'&&seen&&seen.length===map.length)draw();
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
    ctx.restore();return true;
  }
  root.FoteEnvironmentDeco=Object.freeze({ready:function(){return loaded;},ensureAssets:ensureAssets,metadata:function(){return meta;},art:art,cap:cap,palette:palette,draw:drawDecal,error:function(){return error;}});
  ensureAssets().catch(function(){/* Existing renderer is the load-error fallback. */});
})(window);
