/* Source slimes reproduce from full health. One owner resolves poison trails,
 * including allied Shades and the stronger Rot Hollows trail. */
var FoteGreenSlime=(function(){
 'use strict';
 var trails=Object.freeze({slime:Object.freeze({name:'Slime trail',damage:1,duration:1000}),plague:Object.freeze({name:'Plague trail',damage:6,duration:1000})});
 MONSTERS.greenslime={name:'Green Slime',sprite:'m-green-slime',col:'#75a64e',ch:'s',hp:20,dmg:[1,2],acc:48,eva:0,armor:0,speed:70,range:1,xp:10,
  band:[1,4],biome:[0],w:12,living:true,sporeproof:true,greenSlime:true,art:.7,artLeft:true,sfx:'slime',
  hint:''};
 DROPS.greenslime={chance:.12,table:{essence:1}};
 if(MONSTERS.pebbleslime)MONSTERS.pebbleslime.w=0;
 function sourceBody(e){return !!(e&&e.base&&!e.swarm&&!e.shadowClone);}
 function splittingSlime(e){return sourceBody(e)&&(e.base.greenSlime||e.kind==='slime');}
 function trailKind(e){
  if(!sourceBody(e))return null;
  if(e.base.greenSlime)return 'slime';
  if(e.base.poisonTrail==='plague'||e.kind==='chaos-plague-bloat'&&e.base.chaosAI)return 'plague';
  return null;
 }
 function trailDescription(e){
  var kind=trailKind(e);if(!kind)return '';var rule=trails[kind];
  return 'Leaves poison for '+rule.duration/100+' turns: '+rule.damage+' damage per turn.'+(e.ally?' Harms foes only.':'');
 }
 function traitsHint(e){
  if(!sourceBody(e))return '';
  return (splittingSlime(e)?'Heals 2 HP per turn. Splits when hit at full health.'+(e.shade?' Two-Shade limit.':'')+' ':'')+trailDescription(e);
 }
 MONSTERS.greenslime.hint=traitsHint({kind:'greenslime',base:MONSTERS.greenslime});
 function onDamaged(event,hpBefore){
  var e=event.target;
  if(!splittingSlime(e)||event.damage<=0||e.hp<2||hpBefore<e.maxhp||!event.source||event.tags.has('periodic')||event.tags.has('environment'))return;
  // Failed reproduction at the existing summon limit cannot consume HP.
  if(e.ally&&e.shade&&ents.filter(function(actor){return actor.ally&&actor.shade&&actor.hp>0;}).length>=2)return;
  var cell=nearFree(e.x,e.y,1);if(!cell)return;
  var hp=Math.floor(e.hp/2);e.hp-=hp;
  var child=spawnRaw(e.kind,cell.x,cell.y,{base:Object.assign({},e.base),ally:!!e.ally});
  child.hp=hp;child.maxhp=e.maxhp;child.noLoot=true;child.noXp=true;child.slimeDescendant=true;child.state='hunt';
  child.name=e.name;child.base=Object.assign({},e.base);child.dmg=(e.dmg||e.base.dmg).slice();child.beta11Balanced=e.beta11Balanced;
  if(e.ally){
   child.foe=false;child.ally=true;child.state='ally';child.col=e.col;
   ['shade','shadeOwnerId','shadeSourceKind','shadeRootId','shadeLife','life','murkBaseHp','noReward'].forEach(function(key){if(e[key]!==undefined)child[key]=e[key];});
  }
  child.greenPulseAt=worldNow();
  child.lastSeen=e.lastSeen?{x:e.lastSeen.x,y:e.lastSeen.y}:null;
  child.t=Math.max(e.t||0,worldNow())+actCost(child);
  if(vis[idxOf(e.x,e.y)]){log('<b>'+e.name+'</b> splits.','c-info');sfx('slime-split',{from:e});}
 }
 function moved(e,x,y){
  var kind=trailKind(e);if(!kind||e.hp<=0||e.x===x&&e.y===y||!walkable(x,y))return;
  var clock=worldNow(),rule=trails[kind],i=idxOf(x,y),trail=floorMeta.greenTrail||(floorMeta.greenTrail={});
  var packet={bornAt:clock,expiresAt:clock+rule.duration,known:!!vis[i],kind:kind,damage:rule.damage,
    side:e.ally?'ally':kind==='plague'?'foe':'all',sourceId:e.id,sourceName:e.name,sourceX:e.x,sourceY:e.y};
  if(e.shade){packet.shade=true;packet.shadeOwnerId=e.shadeOwnerId;packet.shadeSourceKind=e.shadeSourceKind;packet.shadeRootId=e.shadeRootId;}
  var live=packets(trail[i]).filter(function(previous){return previous.expiresAt>clock&&!(packetKind(previous)===kind&&packetSide(previous)===packet.side);});
  live.push(packet);trail[i]=cell(live);
  if(kind==='plague'&&!e.ally&&!e.poisonTrailWarned&&vis[i]){e.poisonTrailWarned=true;log(e.name+' leaves '+rule.damage+' poison damage per turn.','c-info');}
 }
 function packets(ground){return ground?Array.isArray(ground.packets)?ground.packets:[ground]:[];}
 function packetKind(packet){return packet.kind==='plague'?'plague':'slime';}
 function packetSide(packet){return packet.side==='ally'?'ally':packet.side==='foe'?'foe':'all';}
 function packetDamage(packet){return Number.isFinite(packet.damage)&&packet.damage>0?packet.damage:trails[packetKind(packet)].damage;}
 function cell(list){
  if(list.length===1)return list[0];
  return {bornAt:Math.min.apply(null,list.map(function(p){return p.bornAt;})),expiresAt:Math.max.apply(null,list.map(function(p){return p.expiresAt;})),known:list.some(function(p){return p.known;}),packets:list};
 }
 function affects(packet,e){
  var side=packetSide(packet);if(side==='all')return true;
  return side==='ally'?e!==player&&e.foe&&!e.ally:e===player||e.ally;
 }
 function sourceFor(packet){
  // Native/legacy slime ground retains its neutral environmental rules.
  if(packetSide(packet)==='all')return null;
  return ents.find(function(actor){return actor.id===packet.sourceId;})||{id:packet.sourceId,name:packet.sourceName||trails[packetKind(packet)].name,
    ally:packetSide(packet)==='ally',foe:packetSide(packet)==='foe',hp:0,base:{},x:packet.sourceX,y:packet.sourceY,
    shade:!!packet.shade,shadeOwnerId:packet.shadeOwnerId,shadeSourceKind:packet.shadeSourceKind,shadeRootId:packet.shadeRootId};
 }
 function trailAt(x,y){
  var index=idxOf(x,y),ground=floorMeta.greenTrail&&floorMeta.greenTrail[index],clock=worldNow();
  var live=packets(ground).filter(function(p){return p.expiresAt>clock&&(vis[index]||p.known);}).sort(function(a,b){return Number(affects(b,player))-Number(affects(a,player))||packetDamage(b)-packetDamage(a);});
  if(!live.length)return null;var packet=live[0],rule=trails[packetKind(packet)];
  return {name:rule.name,damage:packetDamage(packet),turns:Math.ceil((packet.expiresAt-clock)/100),side:packetSide(packet),known:!!ground.known};
 }
 function hazardAt(e,x,y){return packets(floorMeta.greenTrail&&floorMeta.greenTrail[idxOf(x,y)]).some(function(packet){return packet.expiresAt>worldNow()&&affects(packet,e);});}
 function pulse(clock){
  ents.forEach(function(e){
   if(e.hp<=0||!splittingSlime(e)||e.state!=='hunt'&&!(e.ally&&e.state==='ally')||e.greenPulseAt===clock)return;
   e.greenPulseAt=clock;
   if(gameEffects.has(e,'poison')||gameEffects.has(e,'rot'))return;
   gameDamage.heal(e,2,e,{natural:true,regen:true});
  });
  if(!floorMeta.greenTrail)return;
  var trail=floorMeta.greenTrail;
  Object.keys(trail).forEach(function(i){
   var live=packets(trail[i]).filter(function(p){return clock<p.expiresAt;});
   if(!live.length){delete trail[i];return;}if(vis[i])live.forEach(function(p){p.known=true;});trail[i]=cell(live);
  });
  [player].concat(ents.filter(function(e){return e!==player;})).forEach(function(e){
   if(e.hp<=0||gameEffects.airborne(e)||e.base&&e.base.sporeproof||gameEffects.blocked(e,'poison'))return;
   var live=packets(trail[idxOf(e.x,e.y)]).filter(function(p){return p.bornAt<clock&&affects(p,e);}).sort(function(a,b){return packetDamage(b)-packetDamage(a);});
   if(!live.length)return;var packet=live[0],source=sourceFor(packet),options={tags:['periodic','environment','poison-trail']};
   if(packetSide(packet)!=='all')options.tags.push('area');
   var n=applyDamage(e,packetDamage(packet),'poison',source,options);
   if(n>0){floatText(e.x,e.y,String(n),'poison');if(e===player)log(trails[packetKind(packet)].name+': '+n+' poison damage.','c-you');}
   if(e.hp<=0)kill(e,source);
  });
 }
 function draw(now){
  if(!floorMeta.greenTrail)return;
  var cells=Object.keys(floorMeta.greenTrail).map(Number).filter(function(i){return vis[i]||floorMeta.greenTrail[i].known&&seen[i];});
  drawGroundMaterial('poison',cells,function(i){
   // The connected pool's soft shore can extend into adjacent stone. Fade it
   // with its neighbouring trail cells rather than cutting it at tile edges.
   var left=0,x=i%MW,y=Math.floor(i/MW);
   for(var dy=-1;dy<=1;dy++)for(var dx=-1;dx<=1;dx++){
    if(!inb(x+dx,y+dy))continue;var t=floorMeta.greenTrail[idxOf(x+dx,y+dy)];
    if(t)left=Math.max(left,t.expiresAt-worldNow());
   }
   return Math.max(0,Math.min(1,left/200));
  },true);
 }
 function wash(x,y){if(floorMeta.greenTrail)delete floorMeta.greenTrail[idxOf(x,y)];}
 return Object.freeze({onDamaged:onDamaged,moved:moved,pulse:pulse,draw:draw,wash:wash,trailAt:trailAt,hazardAt:hazardAt,trailDescription:trailDescription,traitsHint:traitsHint});
})();
