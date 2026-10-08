/* Higher-resolution environment sources; logical bounds remain in 64px art
 * units. Existing selectors still own theme precedence, animation and layout. */
(function(root){
  'use strict';
  if(root.FoteEnvironmentProps)return;
  var metadata=null,pending=null,failure=null,watched={},metadataWatchers=new Set();
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
    if(watched[file]!==requested){
      watched[file]=requested;
      atlReady(file).then(function(){if(ATL[file]===requested){invalidate(file);redraw();}},function(){});
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
    });
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
    return ensureMetadata().then(function(data){return Promise.all(data.files.map(function(file){
      return atlReady(file,{retry:true}).then(function(){invalidate(file);});
    }));}).then(function(){failure=null;return root.FoteEnvironmentProps;},function(error){failure=error;throw error;});
  }
  /* Props with a look of their own, as data; drawPropSurface (render-adapter.js) applies it. paint: the painted art
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
  root.FoteEnvironmentProps=Object.freeze({ensureAssets:ensureAssets,ready:function(){if(!metadata)return false;var files=atlasLoadDiagnostics().files;return metadata.files.every(function(file){return files.some(function(entry){return entry.file===file&&entry.phase==='ready';});});},
    source:function(group,name){var entry=metadata&&metadata.groups[group]&&metadata.groups[group][name];return entry?{file:entry.file}:null;},
    metadataReady:function(){return !!metadata;},subscribeMetadata:subscribeMetadata,art:art,fit:fit,error:function(){return failure;}});
})(globalThis);
