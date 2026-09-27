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
