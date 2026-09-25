/* Optional local Chaos sheets feed the existing mob/clip/FX renderer.
 * No assets are requested until the combat preview explicitly awaits them. */
(function(root){
  'use strict';
  var names=['prism-seer','folded-horror','rift-skitter','lens-bearer','plague-bloat','brood-carrier','bile-spitter','rotling','horned-reaver','gorehound','ironbound','chain-reaver','lash-dancer','razor-dancer','silk-weaver','hookfang'].map(function(n){return 'm-chaos-'+n;});
  var loaded=Object.create(null),pending=Object.create(null);
  function active(){return !!(typeof floorMeta!=='undefined'&&floorMeta&&floorMeta.chaosPreview&&/^(chaos-mixed|unmaker-crucible)$/.test(floorMeta.chaosPreview.biome));}
  function definitions(){return Object.assign({},root.CHAOS_ENEMY_ATLAS||{},root.UNMAKER_ATLAS||{});}
  function valid(spec){
    return spec&&typeof spec.file==='string'&&/^mob-m-(?:chaos|unmaker)-[a-z-]+\.png$/.test(spec.file)&&Number.isInteger(spec.cell)&&spec.cell>0&&
      Number.isInteger(spec.static_row)&&spec.static_row>=0&&Array.isArray(spec.box)&&spec.box.length===4&&spec.box.every(Number.isFinite)&&
      spec.box[0]>=0&&spec.box[1]>=0&&spec.box[2]>0&&spec.box[3]>0&&spec.box[0]+spec.box[2]<=spec.cell&&spec.box[1]+spec.box[3]<=spec.cell&&
      spec.clips&&['idle','attack'].every(function(key){var clip=spec.clips[key];return clip&&Number.isInteger(clip.row)&&clip.row>=0&&Number.isInteger(clip.frames)&&clip.frames>1;});
  }
  function ready(requested){var specs=definitions();return (requested||names).every(function(name){return loaded[name]&&loaded[name].source===specs[name];});}
  function load(name,spec){
    if(!valid(spec))return Promise.reject(new Error('Missing or invalid Chaos enemy atlas: '+name));
    if(loaded[name]&&loaded[name].source===spec)return Promise.resolve();
    if(ATL[spec.file]&&ATL[spec.file].complete&&!ATL[spec.file].naturalWidth)delete ATL[spec.file];
    atl(spec.file);var img=ATL[spec.file];
    return new Promise(function(resolve,reject){
      function clean(){img.removeEventListener('load',finish);img.removeEventListener('error',fail);}
      function fail(){clean();if(ATL[spec.file]===img)delete ATL[spec.file];reject(new Error('Could not load Chaos enemy artwork: '+spec.file));}
      function finish(){
        clean();var rows=Math.max(spec.static_row+1,spec.clips.idle.row+1,spec.clips.attack.row+1),cols=Math.max(spec.clips.idle.frames,spec.clips.attack.frames);
        if(img.naturalWidth<cols*spec.cell||img.naturalHeight<rows*spec.cell){fail();return;}
        Promise.resolve(typeof img.decode==='function'?img.decode():undefined).then(function(){loaded[name]={source:spec,sheet:{img:img,m:Object.assign({},spec,{chaos:true})}};resolve();},fail);
      }
      if(img.complete){if(img.naturalWidth)finish();else fail();}else{img.addEventListener('load',finish);img.addEventListener('error',fail);}
    });
  }
  function ensureAssets(requested){
    var selected=requested||names,key=selected.slice().sort().join(',');if(pending[key])return pending[key];var specs=definitions();
    pending[key]=Promise.all(selected.map(function(name){return load(name,specs[name]);})).then(function(){delete pending[key];},function(error){delete pending[key];throw error;});return pending[key];
  }
  function sheet(name){return active()&&loaded[name]?loaded[name].sheet:null;}
  function visible(x,y){return inb(x,y)&&(revealAll||vis[idxOf(x,y)]);}
  function drawHazards(now){
    if(!active())return;var pulse=ANIM.reduce?.65:.58+.18*Math.sin((now||0)/260);
    ctx.save();ctx.globalAlpha=1;
    ((floorMeta.chaosCombat||{}).hazards||[]).forEach(function(hazard){
      hazard.tiles.forEach(function(tile){var x=tile[0],y=tile[1];if(!visible(x,y))return;var px=(x-camX)*TS,py=(y-camY)*TS;
        ctx.fillStyle='rgba(133,215,43,.3)';ctx.fillRect(px+2,py+2,TS-4,TS-4);ctx.strokeStyle='rgba(203,255,88,'+pulse+')';ctx.lineWidth=Math.max(1,TS*.035);ctx.strokeRect(px+2,py+2,TS-4,TS-4);
        ctx.beginPath();ctx.moveTo(px+TS*.22,py+TS*.7);ctx.lineTo(px+TS*.7,py+TS*.22);ctx.moveTo(px+TS*.4,py+TS*.8);ctx.lineTo(px+TS*.8,py+TS*.4);ctx.stroke();
      });
    });
    ctx.restore();
  }
  function drawActorCues(e,px,py,now){
    if(!active()||!e.base||!e.base.chaosAI||!actorVisible(e))return;
    ctx.save();
    if(e.kind==='chaos-prism-seer'&&e.chaosNextElement){var col=DMG_COL[e.chaosNextElement]||'#EEE1B7';mark({fire:'\u2668',ice:'\u2744',lightning:'\u03DF'}[e.chaosNextElement]||'\u25C6',px+TS*.13,py-TS*.12,col);}
    var shield=e.st&&e.st.chaoslens;
    if(shield&&shield.n>0){
      ctx.strokeStyle='#9CDEFF';ctx.lineWidth=Math.max(1,TS*.035);ctx.globalAlpha=.65;ctx.beginPath();ctx.ellipse(px+TS*.5,py+TS*.5,TS*.43,TS*.52,0,0,Math.PI*2);ctx.stroke();
      var source=ents.find(function(actor){return actor.id===shield.sourceId&&actor.hp>0;});
      if(source&&actorVisible(source)){var position=renderPos(source);ctx.globalAlpha=.45;ctx.setLineDash([TS*.08,TS*.07]);ctx.beginPath();ctx.moveTo(px+TS*.5,py+TS*.55);ctx.lineTo((position.x-camX+.5)*TS,(position.y-camY+.55)*TS);ctx.stroke();ctx.setLineDash([]);}
    }
    if(e.st&&e.st.chaosbrace){ctx.strokeStyle='#FFE1A1';ctx.lineWidth=Math.max(2,TS*.06);ctx.beginPath();ctx.arc(px+TS*.5,py+TS*.55,TS*.44,Math.PI*.12,Math.PI*.88);ctx.stroke();}
    ctx.restore();
  }
  root.FoteChaosEnemyArt=Object.freeze({ready:ready,ensureAssets:ensureAssets,sheet:sheet,drawHazards:drawHazards,drawActorCues:drawActorCues});
})(globalThis);
