/* Exactly-once death transition with explicit creature, reward and progression
 * stages. A revived summon can die again because membership, not a permanent
 * dead flag, identifies a live actor. */
var resolvingDeaths=new WeakSet();
function prepareCreatureDeath(event){
  var e=event.entity,b=e.base||{};
  if(b.magmaBurst&&e.hp<=0&&inFwa()){
    burst(e.x,e.y,'fire',34,.09);SHAKE=6;if(vis[idxOf(e.x,e.y)])log('The <b>Magma Crawler</b> bursts open.','c-kill');
    ents.slice().forEach(function(other){if(other===e||other.hp<=0||dist(other,e)>1||other!==player&&fwaNative(other))return;fwaHurt(other,roll(8,13),'fire',null,other===player?'Molten rock sprays over you':null);if(other.hp>0)applyStatus(other,'burn',2,sDMG(3));});
    for(var y=-1;y<=1;y++)for(var x=-1;x<=1;x++)if(rng()<.5)fwaBurnGround(e.x+x,e.y+y);
  }
  if(e.kind==='matron'){
    var matron=floorMeta.matron;if(matron){if(matron.rit)matronEndRitual(matron);matron.venom=null;matron.phase='dead';}
    floorMeta.marks=(floorMeta.marks||[]).filter(function(mark){return !/^matron-/.test(mark.kind);});
    ents.forEach(function(other){if(other!==e&&other.foe&&(other.guard||other.base.spider||other.owner))applyStatus(other,'fear',6);});
    SHAKE=12;burst(e.x,e.y,'blood',60,.1);
  }
  if(e.kind==='deepmaw'){
    if(floorMeta.maw)floorMeta.maw.phase='dead';
    floorMeta.marks=(floorMeta.marks||[]).filter(function(mark){return mark.kind!=='maw';});
    if(ents.indexOf(e)<0)ents.push(e);
    SHAKE=12;burst(e.x+1,e.y+1,'earth',60,.1);
  }
  if(e.kind==='shockeel'||e.kind==='sparkjelly')floorMeta.marks=(floorMeta.marks||[]).filter(function(mark){return mark.kind!=='eel'+e.id;});
  if(b.big||e.kind==='deepmaw')ents=ents.filter(function(other){return other.parent!==e;});
  if(b.shatters){
    ents.forEach(function(other){if(other!==e&&dist(other,e)<=1&&(other===player||!other.foe)){var damage=applyDamage(other,6,'phys',null);floatText(other.x,other.y,String(damage),'phys');if(other===player)log('Crystal shards fly: '+damage+'.','c-you');}});burst(e.x,e.y,'earth',30,.08);
  }
  if(e.kind==='crystalnode'&&(floorMeta.heartNodes||[]).indexOf(e.id)>=0){var left=(floorMeta.heartNodes||[]).filter(function(id){return id!==e.id&&ents.some(function(other){return other.id===id&&other.hp>0;});}).length;log(left?'A crystal node shatters. '+left+' left.':'<b>The last crystal node shatters!</b> The Heart of the Mountain is exposed.','c-kill');}
  if(e.elite&&floorMeta.plane&&e.id===floorMeta.eliteId){floorMeta.eliteDead=true;setTimeout(function(){log('The guardian of '+PLANE_TITLE[floorMeta.plane]+' falls. The treasure grotto lies open.','c-kill');},0);}
  if(b.rises&&!e.risen&&e._lastType!=='fire'&&e._lastType!=='light'&&!(e.st&&e.st.burn)){
    ents=ents.filter(function(other){return other!==e;});floorMeta.corpses=floorMeta.corpses||[];floorMeta.corpses.push({x:e.x,y:e.y,at:turn+3,kind:e.kind,maxhp:e.maxhp});
    if(vis[idxOf(e.x,e.y)])log('The <b>Shambler</b> collapses... and twitches. Finish it, or burn it.','c-info');
    deathAnimation(e);event.deferred='shambler';return false;
  }
  if(b.bursts){addCloud(e.x,e.y,1,5,sDMG(3+Math.floor(floorNo/3)),'bloat');if(vis[idxOf(e.x,e.y)])log('The <b>Grave Bloat</b> bursts in a cloud of rot!','c-you');sfx('trap-gas');}
  if(inCrypt()&&b.living!==false&&!b.object){floorMeta.deathSpots=floorMeta.deathSpots||[];floorMeta.deathSpots.push({x:e.x,y:e.y});if(floorMeta.deathSpots.length>12)floorMeta.deathSpots.shift();}
  if(e.kind==='morty'&&ents.some(function(other){return other.id===floorMeta.phylId&&other.hp>0;})){
    ents=ents.filter(function(other){return other!==e;});floorMeta.mortyReturn={at:turn+3,maxhp:e.maxhp};sparkleFx(e.x,e.y,'dark',60);
    log('Morty crumbles to dust... and the phylactery on the altar pulses. <b>"Oh, I\'ll be right back."</b> Break the phylactery!','c-you');event.deferred='morty';return false;
  }
  if(e.kind==='phylactery')phylacteryBreaks(e);
  return true;
}
function deathAnimation(e){
  if(!(vis[idxOf(e.x,e.y)]||revealAll))return;
  fx.push({k:'d',e:{x:e.x,y:e.y,col:e.col,sprite:e.base.sprite,art:e.base.art,flip:(player.x<e.x)!==!!e.base.artLeft},t0:Math.max(performance.now(),fxClock)+60,dur:900});
}
function commitCreatureDeath(event){
  var e=event.entity,by=event.source;
  ents=ents.filter(function(other){return other!==e;});deathAnimation(e);
  if(e.ally){sfx('ally-death',{at:fxClock});log(e.name+' falls.','c-info');return;}
  if(e.base.sfx)sfx(e.base.sfx+'-death',{at:fxClock});log(e.name+' dies.','c-kill');
  RUN.kills++;
  if(event.playerSide&&!e.noXp)gainXP(e.base.xp||10);
  godOnKill(e,by);
  if(e.keyholder){items.push({x:e.x,y:e.y,kind:'key',key:'iron'});log('It drops an <b>iron key</b>.','c-kill');}
  if(e.base.drop==='mote'&&e.base.el){items.push({x:e.x,y:e.y,kind:'mote',el:e.base.el});log('It collapses into a <b>'+e.base.el+' mote</b>.','c-kill');sparkleFx(e.x,e.y,TRAIL_EL(e.base.el),26);}
  else rollDrops(e,event.playerSide);
  if(e.st.corrupt&&event.playerSide&&!e.base.boss&&!e.elite)raiseShade(e);
  if(e.base.boss)bossDefeated(e);
}
function rewardAmuletKill(event){
  var e=event.entity,a=player.amulet;
  if(!e.foe||!event.playerSide||!a||!amuletOk(a))return;
  amuletSync(a);var maximum=amuletCap(a);
  if(a.charges<maximum){
    a.progress=(a.progress||0)+(e.elite||e.base.elite||e.base.boss?3:1);
    var need=amuletKillsNeeded(a),gained=0;while(a.progress>=need&&a.charges<maximum){a.progress-=need;a.charges++;gained++;}
    if(a.charges>=maximum)a.progress=0;
    if(gained){log('Your <b>'+gearName(a)+'</b> gains a charge ('+a.charges+'/'+maximum+').','c-good');sfx('pickup-essence');}
  }
  amuletSync(a);
}
function rewardCreatureDeath(event){
  var e=event.entity;
  rewardAmuletKill(event);
  if(e.foe&&event.playerSide&&!e.noXp){
    [['heart',GLOBE_CHANCE],['managlobe',GLOBE_CHANCE]].forEach(function(globe){if(rng()>=globe[1])return;var spot=!items.some(function(it){return it.x===e.x&&it.y===e.y;})&&walkable(e.x,e.y)?{x:e.x,y:e.y}:nearFree(e.x,e.y,1);if(spot)items.push({kind:globe[0],x:spot.x,y:spot.y,until:turn+GLOBE_LIFE});});
  }
  if(e.foe&&e.st&&e.st.burn&&aff('fire')>=6){var other=ents.filter(function(o){return o.foe&&o.hp>0&&dist(o,e)<=3;}).sort(function(a,b){return dist(a,e)-dist(b,e);})[0];if(other){applyStatus(other,'burn',3,burnDmg());boltFx(e.x,e.y,other.x,other.y,'fire');log('Wildfire leaps to '+other.name+'.','c-fire');}}
  if(e.foe&&e.st&&e.st.burn&&combo('shadow','fire')&&(event.source===player||event.source==='player')){player.hidden=Math.max(player.hidden||0,3);log('Smolder: you vanish into the smoke.','c-good');}
}
function finishCreatureDeath(event){
  var e=event.entity,boss=e.base.boss||e.caveBoss;
  if(boss&&inCaverns()&&(floorNo===LAST_FLOOR||floorNo===15)&&!caveBossesLeft())caveBossDown();
  if(e.kind==='deepmaw'){log('<b>The Deep Maw</b> shudders, groans, and goes still. The Caverns fall quiet.','c-kill');caveBossDown();}
  if(e.deepBoss&&inDeep()&&floorMeta.boss&&!floorMeta.exitOpen){floorMeta.exitOpen=true;RUN.bossDead=true;log('<b>The Matron falls.</b> The gate in the south wall grinds open.','c-kill');}
  if(e.kind==='matron'){log('<b>The Matron of the Web</b> curls her legs in and is still. Across the Underdark, the webs fall quiet.','c-kill');deepEnsureExit(e);}
  if(event.revive)floorMeta.pendingLich={entity:e,at:turn+1};
}
function kill(e,by){
  if(!e)return;
  if(e===player){death();return;}
  if(e.parent||resolvingDeaths.has(e))return;
  if(ents.indexOf(e)<0&&!(e.kind==='deepmaw'&&floorMeta.maw&&floorMeta.maw.phase!=='dead'))return;
  if(e.foe&&!(by&&by.ally))by=player;
  var event={entity:e,source:by,playerSide:by===player||by==='player'||!!(by&&by.ally),revive:e.ally&&e.undeadServant&&!e.revived&&capstone('murk')};
  resolvingDeaths.add(e);
  try{
    if(event.revive)e.revived=true;
    if(prepareCreatureDeath(event)===false){gameDamage.emit('actorDeferredDeath',event);return;}
    commitCreatureDeath(event);rewardCreatureDeath(event);finishCreatureDeath(event);
    gameDamage.emit('actorKilled',event);
  }finally{resolvingDeaths.delete(e);}
}
