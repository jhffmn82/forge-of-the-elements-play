/* Higher-resolution environment sources; logical bounds remain in 64px art
 * units. Existing selectors still own theme precedence, animation and layout. */
(function(root){
  'use strict';
  if(root.FoteEnvironmentProps)return;
  var metadata=null,pending=null,failure=null,watched={};
  function redraw(){
    if(root.player&&root.map&&root.map.length&&root.vis&&root.vis.length===root.map.length&&root.seen&&root.seen.length===root.map.length&&typeof draw==='function')draw();
  }
  function invalidate(file){
    Object.keys(metadata.groups).forEach(function(group){Object.keys(metadata.groups[group]).forEach(function(name){
      if(metadata.groups[group][name].file!==file)return;
      ['PACK_PAD','CAVE_PAD','CAVE_BASE','CR_GRADED','OBJ_FX_INFO'].forEach(function(key){if(root[key])delete root[key][name];});
      if(root.B1_WEATHER)delete root.B1_WEATHER['w'+name];if(root.CP_CACHE)delete root.CP_CACHE['v'+name];
    });});
  }
  function atlas(file){
    // Native atl() redraws immediately on load, including while the title screen
    // is still awaiting its first world. These sidecar images share ATL safely.
    if(!ATL[file]){
      var fresh=new Image();ATL[file]=fresh;
      fresh.src='art/packed/'+file+(root.ASSETS&&ASSETS.build?'?v='+ASSETS.build:'');
    }
    var image=ATL[file].complete&&ATL[file].naturalWidth?ATL[file]:null;
    if(!watched[file]){
      watched[file]=true;
      if(image)invalidate(file);
      else ATL[file].addEventListener('load',function(){invalidate(file);redraw();},{once:true});
    }
    return image;
  }
  function ensureMetadata(){
    if(metadata)return Promise.resolve(metadata);
    if(pending)return pending;
    pending=fetch('art/packed/environment-props.json',{cache:'no-cache'}).then(function(response){
      if(!response.ok)throw Error('Environment prop metadata could not load.');return response.json();
    }).then(function(data){
      if(!data.groups||!Array.isArray(data.files))throw Error('Invalid environment prop metadata.');
      metadata=data;failure=null;redraw();return data;
    }).catch(function(error){failure=error;throw error;});
    return pending;
  }
  function art(group,name){
    if(!metadata){ensureMetadata().catch(function(){});return null;}
    var entry=metadata.groups[group]&&metadata.groups[group][name];if(!entry)return null;
    var img=atlas(entry.file);if(!img)return null;
    return {img:img,sx:entry.sx,sy:entry.sy,sw:entry.sw,sh:entry.sh,fullW:entry.fullW,fullH:entry.fullH,ox:entry.ox,oy:entry.oy,res:entry.res,nm:name};
  }
  function ensureAssets(){
    return ensureMetadata().then(function(data){return Promise.all(data.files.map(function(file){
      if(atlas(file))return Promise.resolve();
      return new Promise(function(resolve,reject){var image=ATL[file];image.addEventListener('load',resolve,{once:true});image.addEventListener('error',function(){reject(Error('Environment prop atlas could not load: '+file));},{once:true});});
    }));}).then(function(){return root.FoteEnvironmentProps;});
  }
  var object=packedObjectArt,set=packedSetArt,cave=packedCaveArt,deep=deepArt,pack=packArt;
  packedObjectArt=function(group,name){return art(group,name)||object.apply(this,arguments);};
  packedSetArt=function(name){return art('set',name)||set.apply(this,arguments);};
  packedCaveArt=function(name){return art('cave',name)||cave.apply(this,arguments);};
  deepArt=function(name){return art('deep',name)||deep.apply(this,arguments);};
  packArt=function(name){
    // PixelLab centerpieces already have higher-resolution animated sheets.
    if(AS.map&&AS.map.planeanim&&AS.map.planeanim.items[name])return pack.apply(this,arguments);
    var group=AS.map&&AS.map.set&&AS.map.set.items[name]&&!PACK_PLANE[name]?'set':'planeset';
    return art(group,name)||(PACK_CRYPT[name]?art('props',name):null)||pack.apply(this,arguments);
  };
  var propSurface=drawPropSurface;
  function propVisual(p,x,y,alpha){
    // These two legacy passes manufacture tiny raster images before the normal
    // object lookup. Keep their logical tile, lighting and authored overrides.
    if(p&&!p.artName&&(p.name==='bed-straw'||p.name==='chains'||p.name==='bones'&&!packCryptOn())){
      var replacement=art('props',p.name);
      if(replacement){
        var drawn=drawObj(replacement,x,y,{fit:.98,alpha:alpha});
        if(drawn)return true;
      }
    }
    return propSurface.apply(this,arguments);
  }
  drawPropSurface=function(p,x,y,alpha){
    var pot=p&&!p.artName&&(p.name==='pot'||p.name==='stack-group'&&(p.clusterFamily||(p.kinds||[])[0])==='pot');
    var bones=p&&!p.artName&&(p.name==='bones'||p.name==='bone-pile');
    var chains=p&&!p.artName&&p.name==='chains';
    if(!pot&&!bones&&!chains)return propVisual.apply(this,arguments);
    // Shrink the painted object around its existing floor anchor. The stored
    // placement, tile footprint, breakability and loot are untouched.
    var ax=x+TS*.5,ay=y+TS*(pot?.96:.5);
    var scale=chains?.5:.8;
    ctx.save();ctx.translate(ax,ay);ctx.scale(scale,scale);ctx.translate(-ax,-ay);
    try{
      if(propVisual.apply(this,arguments))return true;
      var o=objArt('props',p.name);if(!o)return false;
      if(pot&&typeof propShadow==='function')propShadow(p.x,p.y,x,y,alpha,p.name);
      return drawObj(o,x,y,{feet:!p.flat,fit:p.flat?.82:.9,alpha:alpha,flash:typeof flashOf==='function'?flashOf(p):0});
    }finally{ctx.restore();}
  };
  root.FoteEnvironmentProps=Object.freeze({ensureAssets:ensureAssets,ready:function(){return !!metadata;},art:art,error:function(){return failure;}});
})(globalThis);
