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
    }).catch(function(error){failure=error;pending=null;throw error;});
    return pending;
  }
  function art(group,name){
    // After a failure only the loading screen's Retry (ensureAssets) fetches again; draws must not.
    if(!metadata){if(!failure)ensureMetadata().catch(function(){});return null;}
    var entry=metadata.groups[group]&&metadata.groups[group][name];if(!entry)return null;
    var img=atlas(entry.file);if(!img)return null;
    return {img:img,sx:entry.sx,sy:entry.sy,sw:entry.sw,sh:entry.sh,fullW:entry.fullW,fullH:entry.fullH,ox:entry.ox,oy:entry.oy,res:entry.res,nm:name};
  }
  function ensureAssets(){
    return ensureMetadata().then(function(data){return Promise.all(data.files.map(function(file){
      // A failed image stays broken; replace it so the loading screen's Retry fetches it again.
      if(ATL[file]&&ATL[file].complete&&!ATL[file].naturalWidth){delete ATL[file];delete watched[file];}
      if(atlas(file))return Promise.resolve();
      return new Promise(function(resolve,reject){var image=ATL[file];image.addEventListener('load',resolve,{once:true});image.addEventListener('error',function(){reject(Error('Environment prop atlas could not load: '+file));},{once:true});});
    }));}).then(function(){return root.FoteEnvironmentProps;});
  }
  /* Props with a look of their own, as data; drawPropSurface (render-adapter.js) applies it. paint: the painted art
     draws at a .98 fit ahead of the named prop passes. scale: the prop shrinks around its floor anchor (anchor: a share
     of the tile down from its top); bones at half size since 2026-09-26. Placement, footprint, breakability, lighting
     and loot stay the prop's, and a prop with authored art (artName) keeps it. */
  var FIT={'bed-straw':{paint:true},chains:{paint:true,scale:.5,anchor:.5},bones:{paint:true,scale:.5,anchor:.5},
    'bone-pile':{scale:.5,anchor:.5},pot:{scale:.8,anchor:.96}};
  function fit(p){
    if(!p||p.artName)return null;
    var name=p.name==='stack-group'&&(p.clusterFamily||(p.kinds||[])[0])==='pot'?'pot':p.name;   // a stacked group of pots is a pot
    if(!Object.prototype.hasOwnProperty.call(FIT,name))return null;
    // The Crypt's packed bones keep their own art, at the same half size.
    return name==='bones'&&packCryptOn()?{scale:FIT.bones.scale,anchor:FIT.bones.anchor}:FIT[name];
  }
  root.FoteEnvironmentProps=Object.freeze({ensureAssets:ensureAssets,ready:function(){return !!metadata;},art:art,fit:fit,error:function(){return failure;}});
})(globalThis);
