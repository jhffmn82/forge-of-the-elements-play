/* Archived plant masters with the native positions, sway and logical sizes. */
(function(root){
  'use strict';
  var meta=root.FOTE_ENVIRONMENT_VEGETATION_META,images={},pending=null,loaded=false,failure=null;
  function redrawIfWorldReady(){
    if(typeof draw==='function'&&typeof player!=='undefined'&&player&&typeof map!=='undefined'&&map&&map.length&&typeof vis!=='undefined'&&vis&&vis.length===map.length&&typeof seen!=='undefined'&&seen&&seen.length===map.length)draw();
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
  var originalArt=vegArt,originalDraw=vegDraw,originalCluster=sceneryClusterArt;
  vegArt=function(name){return art(name)||originalArt.apply(this,arguments);};
  vegDraw=function(o,cx,base,scale,shear,alpha,flip){
    if(!o||!o.environmentVegetation)return originalDraw.apply(this,arguments);
    var s=TS/64*scale/o.res,w=o.sw*s,h=o.sh*s,b=vegBaked(o);
    ctx.save();ctx.globalAlpha=alpha;ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='low';
    ctx.translate(cx,base);ctx.transform(1,0,-shear,1,0,0);if(flip)ctx.scale(-1,1);
    if(b)ctx.drawImage(b,0,0,o.sw,o.sh,-w/2,-h,w,h);
    else ctx.drawImage(o.img,o.sx,o.sy,o.sw,o.sh,-w/2,-h,w,h);
    ctx.restore();
  };
  sceneryClusterArt=function(family,variant){
    var row=loaded?meta.clusters.families.indexOf(family):-1;
    if(row<0)return originalCluster.apply(this,arguments);
    var cell=meta.clusters.cell,col=((Math.floor(variant)||0)%5+5)%5;
    return {img:images[meta.clusters.file],sx:col*cell,sy:row*cell,sw:cell,sh:cell};
  };
  root.FoteEnvironmentVegetation=Object.freeze({ensureAssets:ensureAssets,ready:function(){return loaded;},art:art,metadata:function(){return meta;},error:function(){return failure;}});
  ensureAssets().catch(function(){/* The existing sprites remain available. */});
})(globalThis);
