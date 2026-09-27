/* Dedicated Shambler presentation. Stats, reanimation, corpses and saves remain
 * owned by the existing Crypt logic. Original atlas is the loading fallback. */
(function(root){
 'use strict';
 if(root.FoteShamblerArt)return;
 var sheet=null,pending=null,failure=null,retryAt=0;
 var originalSheet=mobSheet,originalFrame=clipFrame;
 function redraw(){
  if(root.player&&root.map&&root.map.length&&root.vis&&root.vis.length===root.map.length&&root.seen&&root.seen.length===root.map.length&&typeof draw==='function')draw();
 }
 function ensureAssets(){
  if(sheet)return Promise.resolve(root.FoteShamblerArt);
  if(pending)return pending;
  pending=fetch('art/packed/shambler-art.json',{cache:'no-cache'}).then(function(response){
   if(!response.ok)throw Error('Shambler animation metadata could not load.');return response.json();
  }).then(function(data){
   if(data.sprite!=='m-shambler'||data.facing!=='right'||data.file!=='mob-shambler-refreshed.png'||!Number.isInteger(data.cell)||data.cell<=0||!data.box||data.box.length!==4||!data.box.every(Number.isFinite)||data.box[0]<0||data.box[1]<0||data.box[2]<=0||data.box[3]<=0||data.box[0]+data.box[2]>data.cell||data.box[1]+data.box[3]>data.cell||!Number.isInteger(data.static_row)||data.static_row<0||!data.clips)throw Error('Invalid Shambler animation metadata.');
   ['idle','walk','attack','death'].forEach(function(name){var clip=data.clips[name];if(!clip||!Number.isInteger(clip.row)||clip.row<0||!Number.isInteger(clip.frames)||clip.frames<2)throw Error('Invalid Shambler animation clip.');});
   return new Promise(function(resolve,reject){
    var image=new Image();image.onload=function(){
     var clips=Object.keys(data.clips).map(function(name){return data.clips[name];});
     var columns=Math.max.apply(null,clips.map(function(c){return c.frames;})),rows=1+Math.max.apply(null,[data.static_row].concat(clips.map(function(c){return c.row;})));
     if(image.naturalWidth!==columns*data.cell||image.naturalHeight!==rows*data.cell){reject(Error('Shambler sheet dimensions do not match metadata.'));return;}
     sheet={img:image,m:data};failure=null;retryAt=0;redraw();resolve(root.FoteShamblerArt);
    };
    image.onerror=function(){reject(Error('Shambler animation sheet could not load.'));};
    image.src='art/packed/'+data.file+(root.ASSETS&&ASSETS.build?'?v='+ASSETS.build:'');
   });
  }).catch(function(error){pending=null;failure=error;retryAt=performance.now()+5000;throw error;});
  return pending;
 }
 mobSheet=function(name){
  if(name==='m-shambler'){
   if(sheet)return sheet;
   if(performance.now()>=retryAt)ensureAssets().catch(function(){});
  }
  return originalSheet.apply(this,arguments);
 };
 clipFrame=function(selected,entity,sliding){
  if(sheet&&selected===sheet&&typeof ANIM!=='undefined'&&ANIM.reduce){
   var death=entity._clip&&entity._clip.name==='death',m=sheet.m,c=death?m.clips.death:null;
   return {sx:c?(c.frames-1)*m.cell:0,sy:(c?c.row:m.static_row)*m.cell};
  }
  return originalFrame.apply(this,arguments);
 };
 root.FoteShamblerArt=Object.freeze({ensureAssets:ensureAssets,ready:function(){return !!sheet;},error:function(){return failure;},metadata:function(){return sheet&&sheet.m;}});
})(globalThis);
