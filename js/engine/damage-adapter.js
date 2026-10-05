/* One damage pipeline. Content reactions are named stages, never replacement
 * functions. Callers can identify periodic or inherited damage explicitly. */
function rejectDamage(event,reason){event.reason=reason;event.amount=0;return false;}
/* Hit effects finish before kill() removes the actor. Use the existing action
 * and damage contexts, including direct summon hits, to keep this permission
 * local to the successful hit rather than allowing effects on dead actors. */
function pendingHit(target,source){
  if(!target||!target.foe||target.ally||ents.indexOf(target)<0||
      typeof resolvingDeaths!=='undefined'&&resolvingDeaths.has(target))return false;
  var damage=gameDamage.current();
  if(damage&&damage.target===target&&damage.damage>0&&
      (source===undefined||damage.source===source)&&
      !['proc','periodic','arc','reflected','environment'].some(function(tag){return damage.tags.has(tag);}))return true;
  var action=typeof gameActions!=='undefined'&&gameActions.current(),hit=action&&action.hit;
  return !!(hit&&hit.def===target&&hit.landed&&(source===undefined||hit.att===source));
}
var damagedMultipartBodies=new WeakMap();
function damageCreatureRules(event){
  var target=event.target,source=event.source,type=event.type,b=target.base;
  if(typeof FoteChaosEnemies!=='undefined'&&FoteChaosEnemies.damageRules(event)===false)return false;
  event.wasStatused=syllaStatused(target);
  event.iceBefore=player.iceArmor||0;
  if(target.syllaResist>0&&event.amount>0)event.amount*=1-target.syllaResist;
  if(typeof FoteSporecaller!=='undefined'){
    if(FoteSporecaller.absorb(event)>0&&event.amount<=0)return rejectDamage(event,'sporecoat');
  }
  if(b&&target!==player&&inFwa()){
    if(b.fwa==='leviathan'&&target.submerged){if(source===player)log('<b>Leviathan Eel:</b> submerged and invulnerable.','c-info');return rejectDamage(event,'submerged');}
    /* the shell turns the first blow of each turn; after 3 blows it cracks for good (Justin 2026-09-28: with one attack a
       turn the crab could never be hurt) */
    if(b.shellGuard&&!target.shellCracked&&target._shellTurn!==turn&&event.amount>0){
      target._shellTurn=turn;target.shellBlocks=(target.shellBlocks||0)+1;var seen=vis[idxOf(target.x,target.y)];
      if(target.shellBlocks>=3){target.shellCracked=true;floatText(target.x,target.y,'cracked','miss');if(seen)log('<b>Tide Crab:</b> blocked. Shell broken.','c-good');}
      else{floatText(target.x,target.y,'shell','miss');if(seen)log('<b>Tide Crab:</b> blocked.','c-info');}
      return rejectDamage(event,'shell');
    }
  }
  if(target!==player&&target.st&&target.st.wardshield&&event.amount>0){
    var ward=target.st.wardshield,absorbed=Math.min(ward.n,event.amount);ward.n-=absorbed;event.amount-=absorbed;
    if(absorbed>0)floatText(target.x,target.y,'-'+Math.round(absorbed),'magic');
    if(ward.n<=0){gameEffects.remove(target,'wardshield','depleted');if(deepVis(target.x,target.y))log(combatText(target.name)+': Blood Ward broken.','c-good');}
    if(event.amount<=0)return rejectDamage(event,'blood-ward');
  }
  if(MAPVIEW.on&&target===player)return rejectDamage(event,'map-preview');
  if(b&&target!==player){
    if(b.grounded&&type==='lightning')event.amount*=.5;
    if(b.sporeproof&&type==='poison'&&!source)return rejectDamage(event,'sporeproof');
    if(target.parent&&target.parent.kind==='deepmaw'&&damagedMultipartBodies.get(target.parent)===event.actionId)return rejectDamage(event,'same-body');
    if(target.kind==='deepmaw')damagedMultipartBodies.set(target,event.actionId);
    if(target.kind==='shockeel')target._surfT=turn;
    if(target.parent){
      if(source===player)target.parent._provoked=true;
      var redirected=gameDamage.resolve(target.parent,event.amount,type,source,{tags:['redirected'],hit:event.hit,ability:event.ability});
      event.damage=redirected.damage;event.redirected=redirected;
      if(target.parent.hp<=0&&ents.indexOf(target.parent)>=0)kill(target.parent,source);
      return rejectDamage(event,'redirected');
    }
    if(b.big&&(floorMeta.heartNodes||[]).some(function(id){return ents.some(function(e){return e.id===id&&e.hp>0;});})){
      if(source===player){target._provoked=true;var count=(floorMeta.heartNodes||[]).filter(function(id){return ents.some(function(e){return e.id===id&&e.hp>0;});}).length;
        floatText(target.x,target.y,'immune','miss');if(target._immuneMsg!==turn){target._immuneMsg=turn;log('<b>Heart of the Mountain:</b> immune. Destroy '+count+' crystal node'+(count===1?'':'s')+'.','c-info');}}
      return rejectDamage(event,'heart-nodes');
    }
    if(b.moonbound&&!inMoonlight(target)){floatText(target.x,target.y,'immune','miss');if(source===player)log('<b>'+combatText(target.name)+':</b> immune outside crystal light.','c-info');return rejectDamage(event,'moonlight');}
    if(b.burrows&&target.burrowed)return rejectDamage(event,'burrowed');
    if(b.blocksFirst&&target._blockTurn!==turn&&event.amount>0){target._blockTurn=turn;floatText(target.x,target.y,'block','miss');if(vis[idxOf(target.x,target.y)])log('<b>Zealot Knight:</b> blocked.','c-info');return rejectDamage(event,'first-hit-block');}
    if(b.big&&source===player)target._provoked=true;
    if(b.regenerates&&(type==='fire'||target.st&&target.st.burn))target._burnedAt=turn;
    if(b.reflects&&source===player&&(type!=='phys'||dist(target,player)>1)&&event.amount>1&&!event.tags.has('reflected')){
      // Keep the Sentinel's existing deflection, but make its retaliation flat.
      // Riders and damage over time do not retaliate again for the same hit.
      event.amount-=Math.round(event.amount*.5);
      if(!event.tags.has('periodic')&&!event.tags.has('arc')&&(!event.tags.has('proc')||event.tags.has('attack')))
        gameDamage.resolve(player,b.reflects===true?4:b.reflects,type,target,{tags:['reflected']});
    }
    if(b.brands&&target.brand&&source===player)target.brand.stored+=event.amount;
    if(b.boneType&&type==='phys'&&source===player){var weapon=event.hit&&event.hit.view?event.hit.view.weapon:player.weapon;var key=itemKey(weapon);if(weapon.unarmed||key==='mace')event.amount*=1.5;else if(['dagger','bow','spear'].indexOf(key)>=0)event.amount*=.5;}
    if(b.phases&&type==='phys')event.amount*=.5;
    if(b.object&&target.kind==='phylactery')event.amount*=type==='light'||type==='fire'?2:.25;
    if(target.boneWard&&event.amount>0){target.boneWard=false;floatText(target.x,target.y,'ward','miss');if(vis[idxOf(target.x,target.y)])log(combatText(target.name)+': Bone Ward broken.','c-info');return rejectDamage(event,'bone-ward');}
    target._lastType=type;
  }
  return true;
}
function damageOutgoingRules(event){
  var target=event.target,source=event.source,type=event.type;
  // Derived damage already includes the primary hit's outgoing modifiers.
  // Receiver immunity and native defenses still apply to its new damage type.
  var outgoing=!event.options.outgoingModifiersApplied;
  if(outgoing&&typeof hostileCombatDamage==='function'&&!event.tags.has('reflected'))event.amount=hostileCombatDamage(source,event.amount);
  var holy=event.hit&&event.hit.att===player&&event.hit.view?actionInfusion('holy',event.hit.view):infusion('holy');
  if(holy&&isBuffed()){
    if(outgoing&&holy==='fire'&&source===player&&target!==player)event.amount*=1+enchantValues('holy','fire').damageBonus;
    if(holy==='earth'&&target===player)event.amount*=1-enchantValues('holy','earth').damageReduction;
  }
  if(source&&source.foe&&source.st&&source.st.poison&&(target.shadowClone&&target.cloneStats?(target.cloneStats.aff.earth||0)>=3&&(target.cloneStats.aff.shadow||0)>=2:combo('earth','shadow')))event.amount*=.8;
  if(target===player&&player.tombed||target.tomb>0)return rejectDamage(event,'tomb');
  if(target===player&&type==='poison'&&buff('poisonward'))return rejectDamage(event,'poison-ward');
  if(target===player){for(var el in IMMUNE_TYPE)if(IMMUNE_TYPE[el]===type&&aff(el)>=6){floatText(player.x,player.y,'immune','miss');return rejectDamage(event,'element-immunity');}}
  if(target!==player){
    if(outgoing&&target.foe&&!event.tags.has('proc')&&typeof murkSummonDamage==='function')event.amount*=murkSummonDamage(source);
    if(outgoing&&source&&source.shadowClone&&source.cloneStats){
      var copied=source.cloneStats;
      if(copied.holyFire&&FoteShadowClone.buffed(source))event.amount*=1+copied.holyFire;
      if((copied.aff.fire||0)>=3&&target.st&&target.st.burn)event.amount*=1+.05*copied.aff.fire;
    }
    if(outgoing&&(source===player||source==='player')&&aff('fire')>=3&&target.st&&target.st.burn)event.amount*=1+.05*aff('fire');
    if(outgoing&&target.st&&target.st.hollow)event.amount*=1+.05*target.st.hollow.n;
  }
  return true;
}
function damageDefenses(event){
  // Frozen is consumed by native defenses before landed-hit reactions run.
  event.frozenBefore=gameEffects.has(event.target,'frozen');
  if(typeof FoteShadowClone!=='undefined'&&FoteShadowClone.defend(event))return;
  var target=event.target,source=event.source,type=event.type,amount=event.amount,d=amount;
  var isPlayer=target===player,foe=source&&source!==player&&source.foe;
  if(isPlayer&&foe&&event.rawAmount>0&&typeof recordHostileAttack==='function'){
    var hostileAction=gameActions.current();
    // Weapon/spell child actions already recorded the attempt before accuracy.
    if(hostileAction&&hostileAction.kind==='actor'&&!(hostileAction.hostileAttacks||[]).some(function(attempt){return attempt.source===source&&attempt.target===target;}))recordHostileAttack(source,target,event.tags);
  }
  var wardChance=player.block>0?player.block:Math.min(.40,.25+.01*Math.max(0,player.stats.mig-10));
  if(isPlayer&&!event.options.attackRolled&&!event.tags.has('area')&&foe&&hasP('spellWard')&&wardChance>0&&combatRoll(wardChance,true)){
    d*=.25;onShieldBlock(source,player,amount);combatActionNote(player,'blocked');floatText(player.x,player.y,'block','miss');sfx('block');
  }
  var barrier=isPlayer&&hasP('magicBarrier')&&!event.tags.has('area')&&foe&&dist(source,player)>1?5:0;
  if(type==='phys'){
    var hitWeapon=event.hit&&event.hit.view?event.hit.view.weapon:player.weapon;
    var pierce=(source===player||source&&source.shadowClone&&event.hit&&event.hit.view?gearPassiveValue(hitWeapon&&hitWeapon.pierce,event.hit&&event.hit.view):0)+(source&&source.base?source.base.pierce||0:0);
    d=FoteDamage.physical(d,{armor:armorOf(target),pierce:pierce,heavy:!!(source&&source.base&&source.base.heavy),earth:isPlayer?player.aff.earth||0:0,stone:isPlayer&&target.st.stone,frozen:target.st&&target.st.frozen});
    if(isPlayer)d*=resistMult(target,'phys');
    if(target.st&&target.st.frozen){gameEffects.remove(target,'frozen','shattered');if(!isPlayer)gameEffects.apply(target,'imm_frozen',3,undefined,{durationModifiers:false,ignoreImmunity:true});floatText(target.x,target.y,'shatter','ice');}
  }else{
    d=FoteDamage.elemental(d,{resistance:resistMult(target,type),player:isPlayer,corrupt:type==='dark'&&target.st&&target.st.corrupt});
    if(d>0&&target.st&&target.st.frozen){gameEffects.remove(target,'frozen','damaged');if(!isPlayer)gameEffects.apply(target,'imm_frozen',3,undefined,{durationModifiers:false,ignoreImmunity:true});}
  }
  if(isPlayer){
    if(buff('laststand'))d*=FoteDamage.lastStand(godRank(),divineStrength()).damageMultiplier;
    d=d>0&&barrier>0?Math.max(1,d-barrier):Math.max(0,d);
    // A landed physical hit survives rounding; actual shields can still absorb it.
    if(type==='phys'&&d>0)d=Math.max(1,d);
    if(!event.options.bypassShields){
      if(player.ward>0&&!(buff('arcaneward')||buff('communion')))player.ward=0;
      if(player.manaWard>0&&!buff('manaward'))player.manaWard=0;
      var pools=[['ward','magic'],['manaWard','magic'],['iceArmor','ice'],['hideShield','phys'],['mward','magic'],['guard','phys']].map(function(p){return {key:p[0],amount:player[p[0]],type:p[1]};});
      var absorption=FoteDamage.absorb(d,pools);d=absorption.remaining;event.absorbed=absorption.absorbed;
      Object.keys(absorption.pools).forEach(function(key){player[key]=absorption.pools[key];});
      absorption.absorbed.forEach(function(pool){
        floatText(player.x,player.y,'-'+Math.round(pool.amount),pool.type);
        if(pool.key==='manaWard'){
          var before=player.mp;player.mp=Math.min(player.maxmp,player.mp+pool.amount*manaWardRules().manaPerHP);
          var restored=player.mp-before;if(restored>0)floatText(player.x,player.y,'+'+Number(restored.toFixed(1))+' mp','ice');
          if(player.manaWard<=0){player.buffs.manaward=0;combatActionNote(player,'Mana Ward broken');}
        }
        if(pool.key==='ward'&&player.ward<=0)combatActionNote(player,'ward broken');
      });
    }
    if(Math.round(d)>0&&foe&&hasP('fortitude')&&!(player.fortUntil>worldNow())){d*=.5;player.fortUntil=worldNow()+600;combatActionNote(player,'Fortitude');}
  }
  if(target.dazed>0)d*=1.5;
  event.amount=d;
}
function commitDamage(event){
  var target=event.target,d=event.damage,hpBefore=target.hp;
  target.hp-=d;
  // Only the packet crossing from living HP to dead HP owns death attribution.
  // Later corpse riders retain that record, even if equipment changes first.
  if(hpBefore>0){
    delete target.lethalCause;
    if(d>0&&target.hp<=0)target.lethalCause=event.cause;
  }
  if(typeof rareSpiderDamaged==='function')rareSpiderDamaged(event);
  if(event.hit&&d>0)event.hit.landed=true;
  // Offensive status applications receive this exact primary hit explicitly.
  // Never infer it from a parent cast or the last hit during a world pulse.
  if(nativeElementHit(event))event.hit.nativeDamage={source:event.source,target:target,damage:d,
    point:{x:target.x,y:target.y},affinity:Object.assign({},event.hit.view&&event.hit.view.aff||{}),luck:event.hit.view&&event.hit.view.procLuck||0,actionId:event.actionId,cause:event.cause};
  if(typeof FoteEnemyPerception!=='undefined')FoteEnemyPerception.damaged(event);
  else if(d>0&&target!==player&&target.foe&&!target.ally&&target.hp>0&&['asleep','wander','hunt'].indexOf(target.state)>=0){
    target.state='hunt';target.caughtOff=-1;
    var attacker=event.tags.has('periodic')?null:event.source==='player'?player:event.source;
    if(attacker&&Number.isFinite(attacker.x)&&Number.isFinite(attacker.y))target.lastSeen={x:attacker.x,y:attacker.y};
    else if(!target.lastSeen)target.lastSeen={x:target.x,y:target.y};
  }
  if(d>0)revealActor(target);
  if(typeof FoteGreenSlime!=='undefined')FoteGreenSlime.onDamaged(event,hpBefore);
  if(typeof FoteEnemyFields!=='undefined')FoteEnemyFields.onDamaged(event);
  if(d>0&&typeof FoteChaosEnemies!=='undefined')FoteChaosEnemies.onDamaged(event);
  if(d>0&&event.options.reactions!==false)godDamageResolved(target,d,event.type,event.source,event);
  if(event.options.visuals!==false){
    target._hit=Math.max(performance.now(),fxClock);
    if(target===player&&d>0){setClip(player,'hurt');sfx('player-hurt',{at:target._hit});if(typeof onPlayerHurt==='function')onPlayerHurt(d);}
    else if(target!==player&&d>0&&target.base&&!target._clip)setClip(target,'hurt');
  }
  if(target!==player&&target.kind!=='slime'&&target.base&&target.base.splits&&!target.split&&target.hp>0&&target.hp<target.maxhp/2&&!event.tags.has('periodic'))slimeSplit(target);
}
function nativeElementHit(event){
  var hit=event.hit,target=event.target;
  return event.source===player&&target!==player&&target.foe&&!target.ally&&hit&&hit.att===player&&hit.def===target&&
    ['attack','spell'].some(function(tag){return event.tags.has(tag);})&&
    !['proc','periodic','arc','reflected','environment','ground'].some(function(tag){return event.tags.has(tag);});
}
function emitElementArcs(receipt,rule){
  var target=receipt.target,source=receipt.source;
  if(source!==player||!(receipt.damage>0))return;
  var origin=receipt.point||{x:target.x,y:target.y};
  var others=ents.filter(function(e){return e.foe&&!e.ally&&e!==target&&e.hp>0&&dist(e,origin)<=rule.range&&vis[idxOf(e.x,e.y)];})
    .sort(function(a,b){return dist(a,origin)-dist(b,origin);}).slice(0,rule.targets);
  others.forEach(function(other){
    if(other.hp<=0||ents.indexOf(other)<0)return;
    var impact={x:other.x,y:other.y};
    var event=gameDamage.resolve(other,Math.max(1,Math.round(receipt.damage*rule.damageMultiplier)),'lightning',source,
      {tags:['arc','proc'],actionId:receipt.actionId,cause:receipt.cause,procLuck:receipt.luck,procAffinity:receipt.affinity});
    // Commit the captured impact even when a reaction moves/removes its actor.
    var ground=FoteDamage.frozenArcGround(receipt.affinity);
    if(event.damage>0&&ground.duration>0)markIceGround(impact.x,impact.y,ground.duration);
    boltFx(origin.x,origin.y,impact.x,impact.y,'lightning',{staticDischarge:true});
    if(other.hp<=0)kill(other,source);
  });
}
function damageElementReactions(event){
  var target=event.target,source=event.source,type=event.type,d=event.damage;
  if(target!==player&&target.sapped&&d>0){target.sapped=false;gameEffects.remove(target,'stun','awakened');}
  if(target===player||(source!==player&&source!=='player')||d<=0)return;
  if(type==='dark'&&aff('shadow')>=6&&target.hp>0)addHollow(target,1);
  if(type==='light'&&aff('light')>=3)healPlayer(aff('light'));
  var view=event.hit&&event.hit.att===player&&event.hit.view,affinity=view&&view.aff||event.options.procAffinity,air=affinity?affinity.air||0:aff('air');
  var luck=view&&view.procLuck!==undefined?view.procLuck:event.options.procLuck;
  if(type==='lightning'&&air>=6&&target.hp>0&&pRoll(.15,luck))applyStatus(target,'stun',1);
  if(!nativeElementHit(event))return;
  var receipt=event.hit.nativeDamage,arc=FoteDamage.airArc(receipt.affinity.air);
  if(arc.chance>0&&pRoll(arc.chance,receipt.luck))emitElementArcs(receipt,arc);
}
function damageReceivedReactions(event){
  var target=event.target,source=event.source,type=event.type,d=event.damage;
  if(target!==player)return;
  if(d>0&&typeof stackDiscipline==='function')stackDiscipline();
  if(d>0&&hasGod('reginald')&&godRank()>=3&&source&&source.foe&&!source.ally&&source.hp>0&&dist(source,player)>1&&
      !['proc','periodic','environment','reflected','arc','ground'].some(function(tag){return event.tags.has(tag);})){
    var duration=FoteDamage.cowardsMark().duration;
    gameActions.run('reaction',player,source,{ability:{id:'cowards-mark',name:"Coward's Mark"},tags:['reaction','cowards-mark']},function(reaction){
      var cause=FoteActions.damageCause(reaction,{source:player,target:source,ability:reaction.options.ability,actionId:reaction.actionId,tags:Array.from(reaction.tags)},null);
      var options={source:player,applicationCause:cause,tags:Array.from(reaction.tags)};
      var feared=applyStatus(source,'fear',duration,undefined,options);
      var rooted=applyStatus(source,'root',duration,undefined,options);
      var controls=[];if(feared.applied)controls.push('Afraid');if(rooted.applied)controls.push('Rooted');
      if(controls.length)log(combatText(source.name||'Attacker')+': '+controls.join(', ')+'.','c-good');
    });
  }
  if(d>0&&source&&source.foe&&source.hp>0&&combo('fire','earth')&&(dist(source,player)>1||type!=='phys')){
    var root=applyStatus(source,'root',3,undefined,{source:player,tags:['reaction','fire-earth']});
    var burning=applyStatus(source,'burn',3,burnDmg(),{source:player,tags:['reaction','fire-earth']});
    var effects=[];if(root.applied)effects.push('Rooted');if(burning.applied)effects.push('Burning');
    burst(source.x,source.y,'fire',18,.06);if(effects.length)log(combatText(source.name)+': '+effects.join(', ')+'.','c-fire');
  }
  if(source&&source.base){var b=source.base;
    if(d>0&&b.poisons&&!player.st.poison&&rng()<b.poisons&&aff('earth')<6){if(applyStatus(player,'poison',4,Math.max(2,sDMG(2))).applied)combatActionNote(player,'Poisoned');}
    if(d>0&&b.phases){var drained=Math.min(Math.floor(player.mp),4);if(drained>0){player.mp-=drained;floatText(player.x,player.y,'-'+drained+' mp','magic');}}
    if(d>0&&b.rots)applyStatus(player,'rot',30);   /* 2026-09-28 (Justin): rot lasts 30 turns (was 20) */
    if(b.snuffs){player.snuffed=5;combatActionNote(player,'light snuffed');computeFOV();}
    if(b.lurks&&!source._struck)source._struck=true;
    if(b.kindles&&d>0&&player.hp>0){var lit=applyStatus(player,'burn',3,sDMG(3));if(lit.applied&&(!player._fwaLitMsg||player._fwaLitMsg<turn-8)){player._fwaLitMsg=turn;combatActionNote(player,'Burning');}}
  }
  if(d>0){player.lastDamageTime=player.t;if(hasGod('grumbok')&&godRank()>=3&&(type!=='phys'||event.tags.has('ranged')))player.wizardHunterUntil=player.t+300;}   /* 2026-09-29 (Justin): Wizard Hunter wakes to ranged attacks too; Spellbreaker is retired */
  if(player.hp<=0)lastLaugh();
}
function damageAttackReactions(event){
  var target=event.target,hit=event.hit;
  if(!syllaOn()||!(event.damage>0)||event.source!==player||target===player||!target.foe||target.ally||!hit||hit.att!==player||hit.def!==target||hit._syl||event.tags.has('periodic')||event.tags.has('proc')||event.tags.has('reflected')||event.tags.has('arc'))return;
  hit._syl=true;syllaHitReactions(event);
}
function damageCriticalReactions(event){
  var target=event.target,hit=event.hit;
  if(!(event.damage>0)||event.source!==player||!target.foe||target.ally||
      !hit||hit.att!==player||hit.def!==target||!hit.crit||
      !['attack','spell'].some(function(tag){return event.tags.has(tag);})||
      ['proc','periodic','arc','reflected','environment'].some(function(tag){return event.tags.has(tag);})||
      !combo('fire','air',hit.view))return;
  var affinity=hit.view&&hit.view.aff,damage=burnDmg(hit.view);
  var result=applyStatus(target,'burn',3,damage,affinity?{sourceAffinity:affinity,data:{sourceAffinity:affinity}}:undefined);
  if(result.applied){hit.criticalBurnDamage=damage;if(!result.previous)combatActionNote(target,'Burning');}
}
function damageSurpriseReactions(event){
  var target=event.target,source=event.source,hit=event.hit;
  var copied=source&&source.shadowClone&&source.cloneStats;
  if(!(event.damage>0)||!(source===player||copied)||!target.foe||target.ally||
      !hit||hit.att!==source||hit.def!==target||!hit.surprise||!hit.view||
      !['attack','spell'].some(function(tag){return event.tags.has(tag);})||
      ['proc','periodic','arc','reflected','environment'].some(function(tag){return event.tags.has(tag);})||
      !combo('fire','shadow',hit.view))return;
  var affinity=Object.assign({},hit.view.aff||{}),options={sourceAffinity:affinity,data:{sourceAffinity:affinity}};
  var turns=3,corruptTurns=enchantValues('weapon','shadow',hit.view).corruptDuration;
  if(copied){
    options.durationModifiers=false;options.bossControl=true;options.data.sourceDuration=copied.syllaDuration||0;
    turns=FoteEffects.duration('burn',turns,{bonusDuration:copied.syllaDuration||0});
    corruptTurns=FoteEffects.duration('corrupt',corruptTurns,{bonusDuration:copied.syllaDuration||0});
  }
  var damage=copied?copied.burn:burnDmg(hit.view);
  var burning=applyStatus(target,'burn',turns,damage,options);
  var corruption=applyStatus(target,'corrupt',corruptTurns,undefined,options);
  if(burning.applied){hit.surpriseBurnDamage=damage;if(!burning.previous)combatActionNote(target,'Burning');}
  if(corruption.applied&&!corruption.previous)combatActionNote(target,'Corrupted');
}
function damageSiltShieldReactions(event){
  var target=event.target,hit=event.hit;
  if(!(event.damage>0)||event.source!==player||!(player.hp>0)||!target.foe||target.ally||
      !hit||hit.att!==player||hit.def!==target||!hit.view||hit.spell||!event.tags.has('attack')||
      ['proc','periodic','arc','reflected','environment','ground'].some(function(tag){return event.tags.has(tag);})||
      !combo('earth','water',hit.view))return;
  var before=player.iceArmor||0,maximum=player.iceArmorMax||0;
  player.iceArmor=Math.min(maximum,before+FoteDamage.siltShield().restore);
  hit.siltShieldRestored=Math.max(0,player.iceArmor-before);
}
function damageFrozenHolyReactions(event){
  var target=event.target,hit=event.hit;
  if(!(event.damage>0)||!event.frozenBefore||!(target.hp>0)||ents.indexOf(target)<0||
      !nativeElementHit(event)||!hit.view||!combo('water','light',hit.view))return;
  gameDamage.resolve(target,event.damage*FoteDamage.frozenHoly().damageMultiplier,'light',event.source,
    {tags:['proc','water-light'],outgoingModifiersApplied:true,actionId:event.actionId,cause:event.cause});
}
/* Successful primary hit facts admit these combo statuses. The attack's crit
 * and surprise decisions have already resolved; new control never changes them. */
function damageShadowStunReactions(event){
  var target=event.target,hit=event.hit;
  if(!(event.damage>0)||!(target.hp>0)||ents.indexOf(target)<0||!nativeElementHit(event)||
      !hit.surprise||!hit.view||!combo('shadow','air',hit.view))return;
  var affinity=Object.assign({},hit.view.aff||{});
  var result=applyStatus(target,'stun',FoteDamage.shadowStun().duration,undefined,
    {sourceAffinity:affinity,data:{sourceAffinity:affinity}});
  if(result.applied&&!result.previous)combatActionNote(target,'Stunned');
}
function damageGlintReactions(event){
  var target=event.target,hit=event.hit;
  if(!(event.damage>0)||!(target.hp>0)||ents.indexOf(target)<0||!nativeElementHit(event)||
      !hit.crit||!hit.view||hit.spell&&!hit.singleTarget||!combo('air','light',hit.view))return;
  var affinity=Object.assign({},hit.view.aff||{});
  var result=applyStatus(target,'blind',FoteDamage.glint().duration,undefined,
    {sourceAffinity:affinity,data:{sourceAffinity:affinity}});
  if(result.applied&&!result.previous)combatActionNote(target,'Blinded');
}
function damageSurprisePoisonReactions(event){
  var target=event.target,hit=event.hit;
  if(!(event.damage>0)||!(target.hp>0)||ents.indexOf(target)<0||!nativeElementHit(event)||
      !hit.surprise||!hit.view||!combo('shadow','earth',hit.view))return;
  var rule=FoteDamage.surprisePoison(),affinity=Object.assign({},hit.view.aff||{});
  var poison=gameDamage.resolve(target,event.damage*rule.damageMultiplier,'poison',event.source,
    {tags:['proc','shadow-earth'],outgoingModifiersApplied:true,actionId:event.actionId,cause:event.cause});
  if(poison.reason||!(target.hp>0)||ents.indexOf(target)<0)return;
  var result=applyStatus(target,'poison',rule.duration,undefined,
    {durationModifiers:false,refresh:'replace',sourceAffinity:affinity,
      data:{sourceAffinity:affinity,damageScale:1},applicationCause:poison.cause});
  if(result.applied&&!result.previous)combatActionNote(target,'Poisoned');
}
function admitDamage(event){
  var target=event.target;
  if(target===player&&event.type==='poison'&&gameEffects.has(player,'stone'))return rejectDamage(event,'stone-skin');
  // Creature-defined absorption covers ordinary hits and pre-mitigated ticks.
  // Convert the incoming amount before shields, hurt reactions, or attack procs;
  // the damage service has already rejected dead targets and invalid amounts.
  var ratio=target.base&&target.base.damageAbsorption&&target.base.damageAbsorption[event.type];
  if(Number.isFinite(ratio)&&ratio>0){
    if(target.hp<=0)return rejectDamage(event,'element-absorption');
    var amount=event.amount*ratio;if(gameEffects.has(target,'rot'))amount*=.5;
    gameDamage.heal(target,amount,event.source,{damageType:event.type});
    return rejectDamage(event,'element-absorption');
  }
  return true;
}
var gameDamage=FoteDamage.create({
  pendingHit:pendingHit,
  actionId:function(){var action=typeof gameActions!=='undefined'&&gameActions.current();return action?action.actionId:'world:'+turn;},
  cause:function(event,inherited){
    // A supplied delayed origin must not borrow a newer action by that actor.
    var action=!Object.prototype.hasOwnProperty.call(event.options,'cause')&&typeof gameActions!=='undefined'&&gameActions.current();
    return typeof FoteActions!=='undefined'?FoteActions.damageCause(action,event,inherited):null;
  },
  admit:admitDamage,
  modify:function(event){if(damageCreatureRules(event)!==false)damageOutgoingRules(event);},
  defend:damageDefenses,commit:commitDamage,
  commitHealing:function(event){
    event.target.hp=event.hp;
    if(event.target===player&&event.options.playerRules){
      if(event.overflow>0&&combo('light','water'))player.iceArmor=Math.min(player.iceArmorMax,player.iceArmor+event.overflow);
      if(!event.natural&&event.amount>=1)deepStanch(player);
    }else if(event.options.stanch&&event.restored>0&&event.amount>=1&&!event.natural)deepStanch(event.target);
  },
  after:function(event){damageCriticalReactions(event);damageSurpriseReactions(event);damageSiltShieldReactions(event);damageFrozenHolyReactions(event);damageShadowStunReactions(event);damageGlintReactions(event);damageSurprisePoisonReactions(event);damageElementReactions(event);damageReceivedReactions(event);damageAttackReactions(event);}
});
/* HP changes own their feedback. Callers keep their particles/sounds, but never
 * draw a second number or show the requested heal instead of the HP restored. */
gameDamage.on('healingApplied',function(event){
  var n=event.restored,target=event.target;
  if(!(n>0)||event.regen||typeof actorConcealed==='function'&&actorConcealed(target))return;
  floatText(target.x,target.y,'+'+Math.round(n),'heal');
  var action=typeof gameActions!=='undefined'&&gameActions.current();
  if(action&&['attack','spell'].indexOf(action.kind)>=0&&!action.damagePresented){
    var heals=action.healingNotes||(action.healingNotes=[]),prior=heals.find(function(h){return h.target===target;});
    if(prior)prior.amount+=n;else heals.push({target:target,amount:n});
  }
});
function combatDamageName(event){
  var names={'murk-drain':'Life Drain',venomtouch:'Venomtouch',
    'fire-affinity':'Fire affinity','water-light':'Clear Waters','shadow-earth':'Venom Strike',smite:'Smite','molten-ring':'Molten Ring',
    gust:'Gust',enchant:'Enchantment',arc:'Arc',reflected:'Reflection','elemental-attack':'Elemental attack'};
  for(var tag in names)if(event.tags.has(tag))return names[tag];
  return event.tags.has('proc')&&!event.tags.has('attack')?'Bonus damage':'';
}
function combatDamageParts(packets){
  var parts=[];
  packets.slice().sort(function(a,b){return a.id-b.id;}).forEach(function(packet){
    var part=parts.find(function(p){return p.type===packet.type;});
    if(part)part.damage+=packet.damage;else parts.push({type:packet.type,damage:packet.damage});
  });
  return parts;
}
function combatDamageBreakdown(parts){
  return parts.map(function(p,i){return combatDamageNumber(p.damage,p.type,i?'+':'');}).join(' ');
}
function combatText(value){
  return String(value==null?'':value).replace(/[&<>"']/g,function(ch){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch];});
}
function combatDamageNumber(amount,type,prefix){
  type=FoteDamage.type(type)||'phys';
  var label=FoteDamage.label(type),color=typeof DMG_COL!=='undefined'&&DMG_COL[type]||'currentColor',number=combatText(Math.round(amount));
  return '<b style="color:'+color+'" title="'+number+' '+label+' damage" aria-label="'+number+' '+label+' damage">'+combatText(prefix||'')+number+'</b>';
}
function combatActionNote(target,note){
  var action=typeof gameActions!=='undefined'&&gameActions.current();
  if(action&&['attack','spell'].indexOf(action.kind)>=0&&!action.damagePresented&&action.target===target){
    var notes=action.feedbackNotes||(action.feedbackNotes=[]);if(notes.indexOf(note)<0)notes.push(note);
  }else log((target===player?'You':combatText(target.name))+': '+note+'.',target===player?'c-you':'c-good');
}
function combatActionNotes(event,note){
  var notes=(event.feedbackNotes||[]).slice();
  if(note&&notes.indexOf(note)<0)notes.push(note);
  (event.healingNotes||[]).forEach(function(h){
    var who=h.target===event.source?'':(h.target===player?'you':combatText(h.target.name))+' ',amount=Math.round(h.amount);
    var color=typeof DMG_COL!=='undefined'?DMG_COL.heal:'currentColor';
    notes.push(who+'<b style="color:'+color+'" title="'+amount+' HP restored">+'+amount+' HP</b>');
  });
  return notes.length?'; '+notes.join('; '):'';
}
/* Read the resolved packets, including nested god/enchant procs. Only the
 * current hit's own target/source joins its breakdown; arcs, reflections and
 * later effects keep their own target and short result. */
gameDamage.on('damageApplied',function(event){
  if(!(event.damage>0))return;
  var action=typeof gameActions!=='undefined'&&gameActions.current();
  if(action&&['attack','spell'].indexOf(action.kind)>=0&&!action.damagePresented&&event.source===action.source&&event.target===action.target&&
      !event.tags.has('arc')&&!event.tags.has('reflected')&&!event.tags.has('periodic')){
    // Spell riders keep their existing floating feedback; only their log merges.
    if(action.kind==='spell'&&event.tags.has('proc')&&!event.tags.has('attack')&&
       !(typeof actorConcealed==='function'&&actorConcealed(event.target)))floatText(event.target.x,event.target.y,String(event.damage),event.type);
    (action.damagePackets||(action.damagePackets=[])).push(event);return;
  }
  if(event.tags.has('attack')||!['proc','arc','reflected'].some(function(tag){return event.tags.has(tag);}))return;
  if(typeof actorConcealed==='function'&&actorConcealed(event.target))return;
  var name=combatDamageName(event),target=event.target===player?'You':combatText(event.target.name);
  floatText(event.target.x,event.target.y,String(event.damage),event.type);
  log(name+' → '+target+': '+combatDamageNumber(event.damage,event.type)+'.',event.target===player?'c-you':'c-hit');
});
function applyDamage(target,amount,type,source,options){
  var action=typeof gameActions!=='undefined'&&gameActions.current();
  options=Object.assign({attackRolled:false,tags:AOE_HIT?['area']:[],actionId:action?action.actionId:'world:'+turn},options||{});
  return gameDamage.resolve(target,amount,type,source,options).damage;
}
/* Pre-mitigated damage keeps explicit periodic/sacrifice rules. It emits a damage
 * event without accidentally triggering attack procs, shields or attack rewards. */
function dealDirectDamage(target,amount,type,source,options){
  return gameDamage.resolve(target,amount,type,source,Object.assign({preMitigated:true,bypassShields:true,reactions:false,visuals:false,tags:['periodic']},options||{})).damage;
}
function healPlayer(amount,natural,options){
  if(!player||!(amount>0))return 0;
  var rawAmount=amount;
  amount=playerHealingAmount(amount,options);if(!(amount>0))return 0;
  var result=gameDamage.heal(player,amount,player,{rawAmount:rawAmount,playerRules:true,natural:!!natural,regen:!!(options&&options.regen)});
  return result.overflow;
}
/* Named full restores retain their authored exemption from ordinary heal
 * multipliers, overflow conversion and Bleed removal; cleansing stays explicit. */
function restoreActorHealth(target,source){
  return gameDamage.heal(target,Math.max(0,target.maxhp-target.hp),source,{fullRestore:true});
}
function playerHealingContext(options){
  options=options||{};
  return {rot:!!(player&&gameEffects.has(player,'rot')),regen:!!options.regen,
    glimmerRank:hasGod('glimmer')?godRank():0,
    sanctuaryPower:!options.holyGround&&inSanctuary(player)?(typeof holyGroundStrength==='function'?holyGroundStrength(player):divineStrength()):0};
}
function playerHealingAmount(amount,options){return FoteDamage.healingAmount(amount,playerHealingContext(options));}
/* 2026-09-29 (Justin): Rot is the one rule for every HP gain. While you rot, regeneration stops outright (base
   regeneration and everything that multiplies it, such as a Light armor enchant or Grumbok's Thick Hide, plus a
   Ring of Mending and the Regeneration food buff); every other heal is halved. healPlayer() asks it, and so do the
   heart pickups and Light shield blocks before the shared HP commit. Named full restores retain their explicit exemption. */
function rotHealing(amount,regen){return FoteDamage.healingAmount(amount,{rot:!!(player&&gameEffects.has(player,'rot')),regen:!!regen});}
