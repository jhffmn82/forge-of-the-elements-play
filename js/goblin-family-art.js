/* Approved Goblin-family animation, shared by normal runs and saved corpses.
 * Original sheets remain the loading fallback. Native stats and saved facing
 * are unchanged; each replacement sheet is authored facing left. */
(function(root){
 'use strict';
 if(root.FoteGoblinFamilyArt)return;
 var kinds={'m-goblin':'goblin','m-goblin-archer':'archer','m-goblin-shaman':'shaman','m-goblin-brute':'brute','m-goblin-warchief':'warchief'};
 var sheets=null,pending=null,failure=null,retryAt=0;
 var originalSheet=mobSheet,originalFrame=clipFrame,originalCharacter=drawCharacterSprite,originalCorpse=drawCorpse;
 function redraw(){
  if(root.player&&root.map&&root.map.length&&root.vis&&root.vis.length===root.map.length&&root.seen&&root.seen.length===root.map.length&&typeof draw==='function')draw();
 }
 function validate(name,data){
  if(!data||data.file!=='mob-goblin-family-'+kinds[name]+'.png'||data.facing!=='left'||!Number.isInteger(data.cell)||data.cell<=0||!data.box||data.box.length!==4||!data.box.every(Number.isFinite)||data.box[0]<0||data.box[1]<0||data.box[2]<=0||data.box[3]<=0||data.box[0]+data.box[2]>data.cell||data.box[1]+data.box[3]>data.cell||!Number.isInteger(data.static_row)||data.static_row<0||!data.clips)throw Error('Invalid Goblin-family animation metadata.');
  ['idle','walk','attack','death','melee','ranged','cast'].forEach(function(clipName){var clip=data.clips[clipName];if(!clip||!Number.isInteger(clip.row)||clip.row<0||!Number.isInteger(clip.frames)||clip.frames<2)throw Error('Invalid Goblin-family animation clip.');});
 }
 function ensureAssets(){
  if(sheets)return Promise.resolve(root.FoteGoblinFamilyArt);
  if(pending)return pending;
  pending=fetch('art/packed/goblin-family-atlas.json',{cache:'no-cache'}).then(function(response){
   if(!response.ok)throw Error('Goblin-family animation metadata could not load.');return response.json();
  }).then(function(data){
   Object.keys(kinds).forEach(function(name){validate(name,data[name]);});
   return Promise.all(Object.keys(kinds).map(function(name){return new Promise(function(resolve,reject){
    var m=data[name],image=new Image();image.onload=function(){
     var clips=Object.keys(m.clips).map(function(key){return m.clips[key];});
     var columns=Math.max.apply(null,clips.map(function(c){return c.frames;})),rows=1+Math.max.apply(null,[m.static_row].concat(clips.map(function(c){return c.row;})));
     if(image.naturalWidth!==columns*m.cell||image.naturalHeight!==rows*m.cell){reject(Error('Goblin-family sheet dimensions do not match metadata.'));return;}
     resolve([name,{img:image,m:m}]);
    };
    image.onerror=function(){reject(Error('Goblin-family animation sheet could not load.'));};
    image.src='art/packed/'+m.file+(root.ASSETS&&ASSETS.build?'?v='+ASSETS.build:'');
   });}));
  }).then(function(entries){
   sheets={};entries.forEach(function(entry){sheets[entry[0]]=entry[1];});failure=null;retryAt=0;redraw();return root.FoteGoblinFamilyArt;
  }).catch(function(error){pending=null;failure=error;retryAt=performance.now()+5000;throw error;});
  return pending;
 }
 function ownsSheet(selected){return !!sheets&&Object.keys(sheets).some(function(name){return sheets[name]===selected;});}
 function selected(name){return !!sheets&&!!sheets[name]&&mobSheet(name)===sheets[name];}
 function replacementFlip(nativeFlip,nativeArtLeft){return !(!!nativeFlip!==!!nativeArtLeft);}
 mobSheet=function(name){
  if(kinds[name]){
   if(sheets)return sheets[name];
   if(performance.now()>=retryAt)ensureAssets().catch(function(){});
  }
  return originalSheet.apply(this,arguments);
 };
 drawCharacterSprite=function(entity,x,y,options){
  if(spriteOn&&entity&&entity.base&&!entity.livingFlame&&!entity.shadowClone&&!(typeof isShadeSummon==='function'&&isShadeSummon(entity))&&selected(entity.base.sprite)){
   var paint=Object.assign({},options||{});paint.flip=replacementFlip(paint.flip,entity.base.artLeft);
   return originalCharacter.call(this,entity,x,y,paint);
  }
  return originalCharacter.apply(this,arguments);
 };
 drawCorpse=function(effect,progress,opacity){
  var visual=effect&&effect.e,name=visual&&visual.sprite,kind=kinds[name];
  if(spriteOn&&kind&&!visual.shade&&!visual.livingFlame&&selected(name)){
   var base=MONSTERS[kind]||{},paint=Object.assign({},effect,{e:Object.assign({},visual,{flip:replacementFlip(visual.flip,base.artLeft)})});
   return originalCorpse.call(this,paint,progress,opacity);
  }
  return originalCorpse.apply(this,arguments);
 };
 clipFrame=function(sheet,entity,sliding){
  if(ownsSheet(sheet)&&typeof ANIM!=='undefined'&&ANIM.reduce){
   var death=entity._clip&&entity._clip.name==='death',m=sheet.m,c=death?m.clips.death:null;
   return {sx:c?(c.frames-1)*m.cell:0,sy:(c?c.row:m.static_row)*m.cell};
  }
  return originalFrame.apply(this,arguments);
 };
 root.FoteGoblinFamilyArt=Object.freeze({ensureAssets:ensureAssets,ready:function(){return !!sheets;},error:function(){return failure;},ownsSheet:ownsSheet,metadata:function(name){return sheets&&sheets[name]&&sheets[name].m;}});
})(globalThis);
