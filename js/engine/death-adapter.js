/* Exactly-once death transition with explicit creature, reward and progression
 * stages. A revived summon can die again because membership, not a permanent
 * dead flag, identifies a live actor. */
var resolvingDeaths=new WeakSet();
function prepareCreatureDeath(event){
  var e=event.entity,b=e.base||{};
  if(e.silkEscort){var room=rooms.find(function(r){return r.id===e.silkEscort.roomId;});if(room&&room.uncommonEvent)room.uncommonEvent.escort='failed';log('The rescued traveler falls. The escort is lost.','c-you');}
  if(e.pebbleSlam)clearPebbleSlam(e);
  /* Borrowed bodies dissipate. Their source's corpse, revival and hostile
   * death bursts are not inherited summon abilities. */
  if(e.ally&&e.shade){
    floorMeta.marks=(floorMeta.marks||[]).filter(function(mark){return mark.kind!=='eel'+e.id;});
    return true;
  }
  if(b.magmaBurst&&e.hp<=0&&inFwa()){
    burst(e.x,e.y,'fire',34,.09);SHAKE=6;if(vis[idxOf(e.x,e.y)])log('<b>Magma Crawler explodes!</b>','c-kill');
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
    /* its Worm Tenders, and the Shroomlings they sprouted, sink back into the burrows (as the Unmaker's adds go),
       and their spore clouds settle; the player's own shades stay */
    var brood=floorMeta.maw&&floorMeta.maw.tenders||[];
    ents=ents.filter(function(other){var mine=!other.ally&&(brood.indexOf(other.id)>=0||other.kind==='shroomling'&&brood.indexOf(other.owner)>=0);if(mine)burst(other.x,other.y,'earth',16,.05);return !mine;});
    floorMeta.clouds=(floorMeta.clouds||[]).filter(function(cloud){return brood.indexOf(cloud.owner)<0;});
    SHAKE=12;burst(e.x+1,e.y+1,'earth',60,.1);
  }
  if(e.kind==='shockeel'||e.kind==='sparkjelly')floorMeta.marks=(floorMeta.marks||[]).filter(function(mark){return mark.kind!=='eel'+e.id;});
  if(b.big||e.kind==='deepmaw')ents=ents.filter(function(other){return other.parent!==e;});
  if(b.shatters){
    ents.forEach(function(other){if(other!==e&&dist(other,e)<=1&&(other===player||!other.foe)){var damage=applyDamage(other,6,'phys',null);floatText(other.x,other.y,String(damage),'phys');if(other===player)log('Crystal shards: '+damage+'.','c-you');}});burst(e.x,e.y,'earth',30,.08);
  }
  if(e.kind==='crystalnode'&&(floorMeta.heartNodes||[]).indexOf(e.id)>=0){var left=(floorMeta.heartNodes||[]).filter(function(id){return id!==e.id&&ents.some(function(other){return other.id===id&&other.hp>0;});}).length;log(left?'Crystal node destroyed; '+left+' left.':'<b>Heart of the Mountain exposed!</b>','c-kill');}
  if(e.elite&&floorMeta.plane&&e.id===floorMeta.eliteId){floorMeta.eliteDead=true;setTimeout(function(){log('The guardian of '+PLANE_TITLE[floorMeta.plane]+' falls. Its treasure waits in the grotto.','c-kill');},0);}
  if(b.rises&&!e.risen&&e._lastType!=='fire'&&e._lastType!=='light'&&!(e.st&&e.st.burn)){
    ents=ents.filter(function(other){return other!==e;});var fell=deathAnimation(e,false);floorMeta.corpses=floorMeta.corpses||[];floorMeta.corpses.push({x:e.x,y:e.y,at:turn+3,kind:e.kind,maxhp:e.maxhp,id:e.id,flip:fell.flip});
    if(vis[idxOf(e.x,e.y)])log('<b>Shambler reviving:</b> smash or burn its corpse!','c-info',{priority:'warning'});
    event.deferred='shambler';return false;
  }
  if(b.bursts){addCloud(e.x,e.y,1,5,sDMG(3+Math.floor(floorNo/3)),'bloat');if(vis[idxOf(e.x,e.y)])log('<b>Grave Bloat:</b> Rot cloud!','c-you');sfx('trap-gas',{from:e});}
  if(inCrypt()&&b.living!==false&&!b.object){floorMeta.deathSpots=floorMeta.deathSpots||[];floorMeta.deathSpots.push({x:e.x,y:e.y});if(floorMeta.deathSpots.length>12)floorMeta.deathSpots.shift();}
  if(e.kind==='morty'&&ents.some(function(other){return other.id===floorMeta.phylId&&other.hp>0;})){
    ents=ents.filter(function(other){return other!==e;});floorMeta.mortyReturn={at:turn+3,maxhp:e.maxhp};sparkleFx(e.x,e.y,'dark',60);
    log('<b>Morty reviving:</b> break the phylactery!','c-you',{priority:'warning'});event.deferred='morty';return false;
  }
  if(e.kind==='phylactery')phylacteryBreaks(e);
  return true;
}
function deathAnimation(e,persistent){
  var shade=!!(e.ally&&(e.shade||e.swarm)),flame=!!e.livingFlame;
  var facing=typeof e.facingLeft==='boolean'?e.facingLeft:player.x<e.x;
  var visual={id:e.id,x:e.x,y:e.y,col:e.col,sprite:shade?'m-shade':e.base.sprite,art:shade?.9:(e.base.art||.9)*(e.big?1.25:1),flip:facing!==!!(!shade&&!flame&&e.base.artLeft)};
  if(shade)visual.shade=true;
  if(flame){visual.livingFlame=true;visual.flameShots=e.flameShots||0;}
  /* Magical bodies dissipate in their summoned form; they leave no borrowed corpse. */
  if(shade||flame)persistent=false;
  var remains;
  if(persistent!==false&&visual.sprite){
    floorMeta.deathRemains=floorMeta.deathRemains||[];
    remains={id:e.id,e:visual,bornAt:worldNow(),expiresAt:worldNow()+2000};
    floorMeta.deathRemains.push(remains);
  }
  if(vis[idxOf(e.x,e.y)]||revealAll)fx.push({k:'d',e:visual,remains:remains,t0:Math.max(performance.now(),fxClock)+60,dur:900});
  return visual;
}

function creatureDeathLogOptions(event){
  var e=event.entity,cause=event.cause,action=typeof gameActions!=='undefined'&&gameActions.current();
  if(e.base.boss||e.elite||!cause||!action||cause.actionId!==action.actionId||
      ['periodic','environment','reflected','arc'].some(function(tag){return (cause.tags||[]).indexOf(tag)>=0;}))return;
  return {receipt:{scope:RUN,key:'deaths:'+JSON.stringify([cause.actionId,cause.sourceId,cause.kind,cause.weaponKey,cause.abilityKey]),
    item:combatText(e.name),join:', ',suffix:' die.'}};
}
function commitCreatureDeath(event){
  var e=event.entity,by=event.source;
  ents=ents.filter(function(other){return other!==e;});deathAnimation(e);
  if(e.ally){sfx('ally-death',{at:fxClock,from:e});log(combatText(e.name)+' falls.','c-info');return;}
  /* 2026-09-28 (Justin): quietDeath, a trap kill out of sight (triggerTrap): heard, not named */
  if(e.base.sfx)sfx(e.base.sfx+'-death',{at:fxClock,from:e});var seenDeath=revealAll||vis[idxOf(e.x,e.y)],ourKill=by===player||!!(by&&by.ally);if(!e.quietDeath&&(seenDeath||ourKill))log(combatText(e.name)+' dies.','c-kill',creatureDeathLogOptions(event));   /* 1.3.2 ruling 2: an unseen death is quiet unless you or an ally made the kill */
  RUN.kills++;
  if(event.playerSide&&!e.noXp)gainXP(e.base.xp||10);
  godOnKill(e,by,event.cause);
  if(e.keyholder){items.push({x:e.x,y:e.y,kind:'key',key:'iron'});log('It drops an <b>iron key</b>.','c-kill');}
  if(e.base.drop==='mote'&&e.base.el){items.push({x:e.x,y:e.y,kind:'mote',el:e.base.el});log('It collapses into '+(/^[aeiou]/.test(e.base.el)?'an':'a')+' <b>'+e.base.el+' mote</b>.','c-kill');sparkleFx(e.x,e.y,TRAIL_EL(e.base.el),26);}
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
    if(gained){log(gearName(a)+': '+a.charges+'/'+maximum+' charges.','c-good');sfx('pickup-essence');}
  }
  amuletSync(a);
}
/* A synchronous killing command grants Smoke before it pays its time cost.
 * Keep a transient receipt so that command cannot erase or age its own grant;
 * the public Hidden amount/birth clock remain the saved timer state. */
var smokeHiddenReceipts=new WeakMap();
function grantSmokeHidden(){
  player.hidden=Math.max(player.hidden||0,3);player._worldHiddenBorn=player.t;
  var action=typeof gameActions!=='undefined'&&gameActions.current();
  if(action&&action.source===player&&!(typeof gameTurns!=='undefined'&&gameTurns.running&&gameTurns.running()))
    smokeHiddenReceipts.set(player,{clock:player.t,turns:3});
  log('Smoke: Hidden.','c-good');
}
function takeSmokeHiddenReceipt(actor,clock){
  var receipt=smokeHiddenReceipts.get(actor);smokeHiddenReceipts.delete(actor);
  return receipt&&receipt.clock===clock?receipt.turns:0;
}
function smokeDeathView(event){
  var cause=event.cause,action=typeof gameActions!=='undefined'&&gameActions.current();
  if(!cause||cause.sourceId!==player.id||!action||
      ['proc','periodic','arc','reflected','environment'].some(function(tag){return (cause.tags||[]).indexOf(tag)>=0;}))return player;
  if(action.source===player&&action.actionId===cause.actionId&&action.view)return action.view;
  var hits=action.spellResults||[];
  for(var i=hits.length-1;i>=0;i--)if(hits[i].source===player&&hits[i].target===event.entity&&hits[i].actionId===cause.actionId)return hits[i].view||player;
  return player;
}
function rewardCreatureDeath(event){
  var e=event.entity;
  rewardAmuletKill(event);
  if(e.foe&&event.playerSide&&!e.noXp&&!e.noLoot){
    [['heart',GLOBE_CHANCE],['managlobe',GLOBE_CHANCE]].forEach(function(globe){if(rng()>=globe[1])return;var spot=!items.some(function(it){return it.x===e.x&&it.y===e.y;})&&walkable(e.x,e.y)?{x:e.x,y:e.y}:nearFree(e.x,e.y,1);if(spot)items.push({kind:globe[0],x:spot.x,y:spot.y,until:turn+GLOBE_LIFE});});
  }
  var burn=e.st&&e.st.burn,burnAffinity=burn&&burn.sourceAffinity;
  if(e.foe&&burn&&(burnAffinity?burnAffinity.fire||0:aff('fire'))>=6){var other=ents.filter(function(o){return o.foe&&o.hp>0&&dist(o,e)<=3;}).sort(function(a,b){return dist(a,e)-dist(b,e);})[0];if(other){
    if(burnAffinity)gameEffects.apply(other,'burn',3+(burn.sourceDuration||0),sDMG(2+(burnAffinity.fire||0)),{sourceAffinity:burnAffinity,data:{sourceAffinity:burnAffinity,sourceDuration:burn.sourceDuration||0},durationModifiers:false,applicationCause:burn.applicationCause||null});
    else applyStatus(other,'burn',3,burnDmg(),{applicationCause:burn.applicationCause||null});
    boltFx(e.x,e.y,other.x,other.y,'fire');log('Wildfire: '+combatText(other.name)+' Burning.','c-fire');}}
  if(player.hp>0&&e.foe&&!e.ally&&gameEffects.has(e,'burn')&&combo('shadow','fire',smokeDeathView(event)))grantSmokeHidden();
}
function finishCreatureDeath(event){
  var e=event.entity,boss=e.base.boss||e.caveBoss;
  if(boss&&inCaverns()&&(floorNo===LAST_FLOOR||floorNo===15)&&!caveBossesLeft())caveBossDown();
  if(e.kind==='deepmaw'){log('<b>Deep Maw defeated.</b>','c-kill');caveBossDown();}
  if(e.kind==='matron'){log('<b>Matron defeated.</b>','c-kill');deepEnsureExit(e);}
  if(event.revive)floorMeta.pendingLich={entity:e,at:turn+1};
}
function kill(e,by,cause){
  if(!e)return;
  if(e===player){death();return;}
  if(e.rarePet&&RUN)RUN.rareSpiderPet=null;
  if(e.parent||resolvingDeaths.has(e))return;
  if(ents.indexOf(e)<0&&!(e.kind==='deepmaw'&&floorMeta.maw&&floorMeta.maw.phase!=='dead'))return;
  if(e.foe&&!(by&&by.ally))by=player;
  var event={entity:e,source:by,cause:e.lethalCause||cause||null,playerSide:by===player||by==='player'||!!(by&&by.ally),revive:e.ally&&e.undeadServant&&!e.revived&&capstone('murk')};
  resolvingDeaths.add(e);
  try{
    if(event.revive)e.revived=true;
    if(prepareCreatureDeath(event)===false){gameDamage.emit('actorDeferredDeath',event);return;}
    commitCreatureDeath(event);rewardCreatureDeath(event);finishCreatureDeath(event);
    gameDamage.emit('actorKilled',event);
  }finally{resolvingDeaths.delete(e);}
}
