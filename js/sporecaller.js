/* Caverns support caster. Warnings use both clocks: even a slow player action
 * cannot resolve a warning born during that same action. Fields use world time. */
var FoteSporecaller=(function(){
 'use strict';
 MONSTERS.sporecaller=Object.assign({},MONSTERS.myconid,{
  name:'Myconid Sporecaller',sprite:'m-sporecaller',spores:false,sporecaller:true,
  dmg:[3,5],xp:40,w:8,
  hint:'Mushroom buds warn of a root-and-poison field. Leave the marked ground before it blooms. Between casts it retreats, heals allies and protects them with Sporecoat.'
 });
 DROPS.sporecaller=DROPS.myconid;
 // Replace part of the vermin weight rather than increasing encounter counts.
 MONSTERS.caverat.w=4;MONSTERS.cavebat.w=4;
 var RANGE=5,FIELD_LIFE=300,FIELD_COOLDOWN=600,SUPPORT_COOLDOWN=500;
 function fields(){return floorMeta.sporeFields||(floorMeta.sporeFields=[]);}
 function growth(){return floorMeta.sporeGrowth||(floorMeta.sporeGrowth={});}
 function visible(e){return inb(e.x,e.y)&&!!vis[idxOf(e.x,e.y)];}
 function targets(){return [player].concat(ents.filter(function(e){return e!==player&&e.ally&&e.hp>0;}));}
 function cellsAt(target){
  var cells=[];
  for(var y=target.y-1;y<=target.y+1;y++)for(var x=target.x-1;x<=target.x+1;x++){
   if(inb(x,y)&&walkable(x,y)&&at(x,y)!==CHASM&&FoteEnemyTeamwork.openLine(target,{x:x,y:y}))cells.push(idxOf(x,y));
  }
  return cells;
 }
 function warn(e,target){
  if(e.sporeFieldReadyAt>worldNow()||dist(e,target)>RANGE||!FoteEnemyTeamwork.openLine(e,target))return false;
  if(fields().filter(function(f){return !f.expiresAt||f.expiresAt>worldNow();}).length>=2)return false;
  // Put the target on the near edge, so one ordinary step can leave a 3x3 field.
  var center={x:target.x+Math.sign(e.x-target.x),y:target.y+Math.sign(e.y-target.y)};
  var cells=cellsAt(center);if(!cells.length||cells.indexOf(idxOf(target.x,target.y))<0)return false;
  fields().push({owner:e.id,x:center.x,y:center.y,cells:cells,armedTurn:turn,fireAt:worldNow()+100,rooted:[]});
  e.sporeFieldReadyAt=worldNow()+FIELD_COOLDOWN;
  setClip(e,'attack');sfx('shaman-cast',{from:e});
  if(visible(e)||visible(target))log('The <b>Myconid Sporecaller</b> seeds the ground. Move out of the mushroom buds before they bloom!','c-you');
  return true;
 }
 function support(e,idle){
  if(!idle&&e.sporeSupportReadyAt>worldNow())return false;
  var allies=FoteEnemyTeamwork.nearby(e,4).filter(function(o){return o.state==='hunt'&&!o.base.sporecaller&&(o.hp<o.maxhp||!gameEffects.has(o,'sporecoat'));});
  allies.sort(function(a,b){return a.hp/a.maxhp-b.hp/b.maxhp||dist(a,e)-dist(b,e);});
  var target=allies[0];if(!target)return false;
  var healing=Math.max(1,Math.round(target.maxhp*.50));
  if(gameEffects.has(target,'rot'))healing=Math.floor(healing*.5);
  healing=Math.min(target.maxhp-target.hp,healing);target.hp+=healing;
  if(!gameEffects.has(target,'sporecoat'))gameEffects.apply(target,'sporecoat',3,undefined,{durationModifiers:false,data:{n:Math.min(12,Math.max(3,Math.round(target.maxhp*.15)))}});
  e.sporeSupportReadyAt=worldNow()+SUPPORT_COOLDOWN;
  setClip(e,'attack');sfx('shaman-cast',{from:e});boltFx(e.x,e.y,target.x,target.y,'poison');sparkleFx(target.x,target.y,'heal',12);
  floatText(target.x,target.y,'Sporecoat','heal');
  if(visible(e)||visible(target))log('The <b>Myconid Sporecaller</b> coats the <b>'+target.name+'</b> in protective spores'+(healing?', healing '+healing+' HP':'')+'.','c-you');
  return true;
 }
 function act(e,target){
  if(e.state!=='hunt')return false;
  target=target||(canSeePlayer(e)?player:null);
  if(!target){if(e.lastSeen)stepToward(e,e.lastSeen.x,e.lastSeen.y);return true;}
  if(FoteEnemyTeamwork.retreat(e,target))return true;
  if(warn(e,target))return true;
  if(support(e))return true;
  if(FoteEnemyTeamwork.position(e,target,RANGE))return true;
  support(e,true);return true;
 }
 function pulse(clock){
  if(!floorMeta||!floorMeta.sporeFields)return;
  floorMeta.sporeFields=fields().filter(function(f){
   if(!f.expiresAt){
    var caster=ents.find(function(e){return e.id===f.owner&&e.hp>0&&e.foe&&!e.ally;});
    if(!caster||caster.state!=='hunt'||FoteActors.blocked(caster,gameEffects)||gameEffects.has(caster,'fear'))return false;
    if(turn<=f.armedTurn||clock<f.fireAt)return true;
    f.expiresAt=clock+FIELD_LIFE;
    f.cells.forEach(function(i){growth()[i]={known:!!vis[i]};});
    if(typeof burst==='function'&&f.cells.some(function(i){return vis[i];}))burst(f.x,f.y,'poison',24,.05);
    if(f.cells.some(function(i){return vis[i];})){sfx('trap-gas',{from:f});log('The fungal field blooms into grasping roots and poisonous spores!','c-you');}
   }
   if(clock>=f.expiresAt)return false;
   targets().forEach(function(e){
    if(e.hp<=0||e.tomb>0||gameEffects.airborne(e)||f.cells.indexOf(idxOf(e.x,e.y))<0)return;
    var id=e===player?'player':e.id;
    if(f.rooted.indexOf(id)<0){
     f.rooted.push(id);
     gameEffects.apply(e,'root',1,undefined,{durationModifiers:false});
    }
    // Do not overwrite a stronger poison or bypass Earth/Unstoppable immunity.
    if(!gameEffects.has(e,'poison'))gameEffects.apply(e,'poison',2,undefined,{data:{damageScale:.25}});
   });
   return true;
  });
 }
 function observe(){
  if(!floorMeta||!floorMeta.sporeGrowth)return;
  Object.keys(floorMeta.sporeGrowth).forEach(function(i){if(vis[i])floorMeta.sporeGrowth[i].known=true;});
 }
 function wash(x,y){
  var i=idxOf(x,y);if(floorMeta.sporeGrowth)delete floorMeta.sporeGrowth[i];
  if(floorMeta.sporeFields)floorMeta.sporeFields=floorMeta.sporeFields.filter(function(f){f.cells=f.cells.filter(function(cell){return cell!==i;});return f.cells.length>0;});
 }
 function trample(e){
  if(!floorMeta||!floorMeta.sporeGrowth||!e||e.hp<=0||gameEffects.airborne(e))return false;
  var n=typeof entitySize==='function'?entitySize(e):1,crushed=false;
  for(var y=e.y;y<e.y+n;y++)for(var x=e.x;x<e.x+n;x++){
   var i=idxOf(x,y);if(!floorMeta.sporeGrowth[i])continue;
   delete floorMeta.sporeGrowth[i];crushed=true;
   if(vis[i]&&typeof burst==='function')burst(x,y,'poison',10,.035);
  }
  if(!crushed)return false;
  if(visible(e))sfx('step-grass',{from:e,vol:.5});
  if(e.base&&e.base.sporeproof||gameEffects.blocked(e,'poison')||e===player&&player.buffs&&player.buffs.poisonward>0)return true;
  var damage=applyDamage(e,2,'poison',null,{tags:['environment','movement']});
  if(damage>0){floatText(e.x,e.y,String(damage),'poison');if(e===player)log('You crush the green mushrooms, releasing spores: <b>'+damage+'</b> poison damage.','c-you');}
  if(e.hp<=0)kill(e,null);
  return true;
 }
 function absorb(event){
  var e=event.target,s=e.st&&e.st.sporecoat;if(!s||!(s.n>0)||!(event.amount>0))return;
  var n=Math.min(s.n,event.amount);s.n-=n;event.amount-=n;
  floatText(e.x,e.y,'-'+Math.round(n),'heal');
  if(s.n<=0){gameEffects.remove(e,'sporecoat','depleted');if(visible(e))log('The Sporecoat around the <b>'+e.name+'</b> breaks.','c-good');}
  return n;
 }
 var greenPlants={};
 function plant(i,scale,alpha,now){
  var x=i%MW,y=Math.floor(i/MW),v=(x*3+y*7)%5,o=sceneryClusterArt('mushroom-crypt',v);if(!o)return;
  // This is the existing Crypt vegetation, tinted once at its original native
  // resolution. No newly generated mushroom silhouettes or finer detail.
  if(!greenPlants[v]||greenPlants[v].source!==o.img){
   var canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;
   var ink=canvas.getContext('2d');ink.imageSmoothingEnabled=false;ink.filter='hue-rotate(180deg) saturate(.72)';
   ink.drawImage(o.img,o.sx,o.sy,128,128,0,0,128,128);greenPlants[v]={source:o.img,canvas:canvas};
  }
  var sway=ANIM.reduce?0:Math.sin((now||0)/900+x*.7+y)*.018;
  ctx.save();ctx.globalAlpha=alpha;ctx.imageSmoothingEnabled=false;
  ctx.translate((x-camX+.5)*TS,(y-camY+.92)*TS);ctx.transform(1,0,sway,1,0,0);
  ctx.drawImage(greenPlants[v].canvas,0,0,128,128,-TS*.5*scale,-TS*scale,TS*scale,TS*scale);ctx.restore();
 }
 function ground(now){
  if(!floorMeta||!floorMeta.sporeGrowth)return;
  Object.keys(floorMeta.sporeGrowth).forEach(function(key){
   var i=Number(key),x=i%MW,y=Math.floor(i/MW);
   if(x<camX-1||y<camY-1||x>camX+viewW+1||y>camY+viewH+1)return;
   if(vis[i]||floorMeta.sporeGrowth[key].known&&seen[i])plant(i,.92,vis[i]?.88:memA(.4),now);
  });
 }
 function draw(now){
  if(!floorMeta)return;ctx.save();
  (floorMeta.sporeFields||[]).forEach(function(f){
   var active=!!f.expiresAt,pulse=ANIM.reduce?1:.85+.15*Math.sin((now||0)/190);
   f.cells.forEach(function(i){
    if(!vis[i])return;
    var x=(i%MW-camX)*TS,y=(Math.floor(i/MW)-camY)*TS;
    ctx.globalAlpha=(active?.14:.2)*pulse;ctx.fillStyle='#9bbd72';ctx.beginPath();ctx.ellipse(x+TS*.5,y+TS*.68,TS*.46,TS*.29,0,0,Math.PI*2);ctx.fill();
    if(!active)plant(i,.4,.88,now);
    ctx.globalAlpha=active?.65:.48*pulse;ctx.lineWidth=Math.max(1,TS/40);ctx.strokeStyle=active?'#81976c':'#bfcb90';
    ctx.beginPath();
    for(var n=0;n<3;n++){
     var seed=((i*7+n*11)%13)/13,fromX=x+TS*(.15+n*.27),fromY=y+TS*(.68+seed*.2);
     ctx.moveTo(fromX,fromY);ctx.quadraticCurveTo(fromX-TS*.12,y+TS*.43,fromX+TS*.1,y+TS*(active?.2:.55));
    }
    ctx.stroke();
   });
  });
  ents.forEach(function(e){
   if(e.hp<=0||!visible(e)||!gameEffects.has(e,'sporecoat'))return;
   var pos=renderPos(e),p=Math.max(1,Math.round(TS/32)),phase=ANIM.reduce?0:(now||0)/600;
   ctx.globalAlpha=.85;ctx.fillStyle='#b3d39c';
   for(var n=0;n<4;n++){
    var a=phase+n*Math.PI/2,x=(pos.x-camX+.5+Math.cos(a)*.37)*TS,y=(pos.y-camY+.52+Math.sin(a)*.34)*TS;
    ctx.fillRect(Math.round(x),Math.round(y),2*p,2*p);
   }
  });ctx.restore();
 }
 return Object.freeze({act:act,warn:warn,support:support,pulse:pulse,observe:observe,wash:wash,trample:trample,absorb:absorb,ground:ground,draw:draw});
})();
