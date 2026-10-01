/* One damage pipeline. Content reactions are named stages, never replacement
 * functions. Callers can identify periodic or inherited damage explicitly. */
function rejectDamage(event,reason){event.reason=reason;event.amount=0;return false;}
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
    if(ward.n<=0){gameEffects.remove(target,'wardshield','depleted');if(deepVis(target.x,target.y))log('The blood ward around the '+target.name+' shatters.','c-good');}
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
    if(b.moonbound&&!inMoonlight(target)){floatText(target.x,target.y,'immune','miss');if(source===player)log('<b>'+target.name+':</b> immune outside crystal light.','c-info');return rejectDamage(event,'moonlight');}
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
    if(target.boneWard&&event.amount>0){target.boneWard=false;floatText(target.x,target.y,'ward','miss');if(vis[idxOf(target.x,target.y)])log('A bone ward shatters around the '+target.name+'.','c-info');return rejectDamage(event,'bone-ward');}
    target._lastType=type;
  }
  return true;
}
function damageOutgoingRules(event){
  var target=event.target,source=event.source,type=event.type;
  var holy=event.hit&&event.hit.att===player&&event.hit.view?actionInfusion('holy',event.hit.view):infusion('holy');
  if(holy&&isBuffed()){
    if(holy==='fire'&&source===player&&target!==player)event.amount*=1+enchantValues('holy','fire').damageBonus;
    if(holy==='earth'&&target===player)event.amount*=1-enchantValues('holy','earth').damageReduction;
  }
  if(source&&source.foe&&source.st&&source.st.poison&&(target.shadowClone&&target.cloneStats?(target.cloneStats.aff.earth||0)>=3&&(target.cloneStats.aff.shadow||0)>=2:combo('earth','shadow')))event.amount*=.8;
  if(target===player&&player.tombed||target.tomb>0)return rejectDamage(event,'tomb');
  if(target===player&&type==='poison'&&buff('poisonward'))return rejectDamage(event,'poison-ward');
  if(target===player){for(var el in IMMUNE_TYPE)if(IMMUNE_TYPE[el]===type&&aff(el)>=6){floatText(player.x,player.y,'immune','miss');return rejectDamage(event,'element-immunity');}}
  if(target!==player){
    if(target.foe&&!event.tags.has('proc')&&typeof murkSummonDamage==='function')event.amount*=murkSummonDamage(source);
    if((source===player||source==='player')&&aff('fire')>=3&&target.st&&target.st.burn)event.amount*=1+.05*aff('fire');
    if(target.st&&target.st.hollow)event.amount*=1+.05*target.st.hollow.n;
  }
  return true;
}
function damageDefenses(event){
  if(typeof FoteShadowClone!=='undefined'&&FoteShadowClone.defend(event))return;
  var target=event.target,source=event.source,type=event.type,amount=event.amount,d=amount;
  var isPlayer=target===player,foe=source&&source!==player&&source.foe;
  var wardChance=player.block>0?player.block:Math.min(.40,.25+.01*Math.max(0,player.stats.mig-10));
  if(isPlayer&&!event.options.attackRolled&&!event.tags.has('area')&&foe&&hasP('spellWard')&&wardChance>0&&combatRoll(wardChance,true)){
    d*=.25;onShieldBlock(source,player,amount);log('Your shield turns the '+(type==='phys'?'blow':FoteDamage.label(type))+' from '+(source.name||'the attack')+'.','c-good');floatText(player.x,player.y,'block','miss');sfx('block');
  }
  var barrier=isPlayer&&hasP('magicBarrier')&&!event.tags.has('area')&&foe&&dist(source,player)>1?5:0;
  if(type==='phys'){
    var hitWeapon=event.hit&&event.hit.view?event.hit.view.weapon:player.weapon;
    var pierce=(source===player?gearPassiveValue(hitWeapon&&hitWeapon.pierce):0)+(source&&source.base?source.base.pierce||0:0);
    d=FoteDamage.physical(d,{armor:armorOf(target),pierce:pierce,heavy:!!(source&&source.base&&source.base.heavy),earth:isPlayer?player.aff.earth||0:0,stone:isPlayer&&target.st.stone,frozen:target.st&&target.st.frozen});
    if(isPlayer)d*=resistMult(target,'phys');
    if(target.st&&target.st.frozen){gameEffects.remove(target,'frozen','shattered');if(!isPlayer)gameEffects.apply(target,'imm_frozen',3,undefined,{durationModifiers:false,ignoreImmunity:true});floatText(target.x,target.y,'shatter','ice');}
  }else{
    d=FoteDamage.elemental(d,{resistance:resistMult(target,type),player:isPlayer,corrupt:type==='dark'&&target.st&&target.st.corrupt});
    if(d>0&&target.st&&target.st.frozen){gameEffects.remove(target,'frozen','damaged');if(!isPlayer)gameEffects.apply(target,'imm_frozen',3,undefined,{durationModifiers:false,ignoreImmunity:true});}
  }
  if(isPlayer){
    if(buff('laststand'))d*=.5;
    if(hasGod('reginald')&&godRank()>=3&&foe&&source.challenged)d*=Math.max(0,1-.05*godRank()*divineStrength());
    if(hasGod('reginald')&&godRank()>=5&&foe)d*=1-.10*Math.min(3,Math.max(0,adjacentFoes()-1));
    if(hasGod('reginald')&&godRank()>=3&&foe&&source.hp>0&&!source.challenged&&dist(source,player)>1){source.challenged=true;source.challengeUntil=worldNow()+500;source.state='hunt';source.cowardMark=true;log('<b>'+(source.name||'It')+'</b> strikes from afar. Sir Reginald marks the coward: it must face you.','c-good');}
    d=d>0&&barrier>0?Math.max(1,d-barrier):Math.max(0,d);
    // A landed physical hit survives rounding; actual shields can still absorb it.
    if(type==='phys'&&d>0)d=Math.max(1,d);
    if(!event.options.bypassShields){
      if(player.ward>0&&!(buff('arcaneward')||buff('communion')))player.ward=0;
      var pools=[['ward','magic'],['iceArmor','ice'],['hideShield','phys'],['mward','magic'],['guard','phys']].map(function(p){return {key:p[0],amount:player[p[0]],type:p[1]};});
      var absorption=FoteDamage.absorb(d,pools);d=absorption.remaining;event.absorbed=absorption.absorbed;
      Object.keys(absorption.pools).forEach(function(key){player[key]=absorption.pools[key];});
      absorption.absorbed.forEach(function(pool){floatText(player.x,player.y,'-'+Math.round(pool.amount),pool.type);if(pool.key==='ward'&&player.ward<=0)log('Your Arcane Ward shatters.','c-info');});
    }
    if(Math.round(d)>0&&foe&&hasP('fortitude')&&!(player.fortUntil>worldNow())){d*=.5;player.fortUntil=worldNow()+600;log('Fortitude blunts the blow.','c-good');}
  }
  if(target.challenged&&target.challengeBoost)d*=1.2;
  if(target.dazed>0)d*=1.5;
  event.amount=d;
}
function commitDamage(event){
  var target=event.target,d=event.damage,hpBefore=target.hp;
  target.hp-=d;
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
function damageElementReactions(event){
  var target=event.target,source=event.source,type=event.type,d=event.damage;
  if(target!==player&&target.sapped&&d>0){target.sapped=false;gameEffects.remove(target,'stun','awakened');}
  if(target===player||(source!==player&&source!=='player')||d<=0)return;
  if(type==='dark'&&aff('shadow')>=6&&target.hp>0)addHollow(target,1);
  if(type==='light'&&aff('light')>=3)healPlayer(aff('light'));
  if(type==='lightning'&&aff('air')>=6&&target.hp>0&&rng()<.15)applyStatus(target,'stun',1);
  if(aff('air')>=3&&!event.tags.has('arc')&&rng()<.05*aff('air')){
    var other=ents.filter(function(e){return e.foe&&e!==target&&e.hp>0&&dist(e,target)<=3&&vis[idxOf(e.x,e.y)];}).sort(function(a,b){return dist(a,target)-dist(b,target);})[0];
    if(other){gameDamage.resolve(other,Math.max(1,Math.round(d*.5)),'lightning',player,{tags:['arc']});boltFx(target.x,target.y,other.x,other.y,'lightning');if(other.hp<=0)kill(other,player);}
  }
}
function damageReceivedReactions(event){
  var target=event.target,source=event.source,type=event.type,d=event.damage;
  if(target!==player)return;
  var soaked=event.iceBefore-(player.iceArmor||0);
  if(soaked>0&&combo('water','light'))healPlayer(Math.max(1,Math.round(soaked*.25)));
  if(d>0&&source&&source.foe&&source.hp>0&&combo('fire','earth')&&(dist(source,player)>1||type!=='phys')){applyStatus(source,'root',1);applyStatus(source,'burn',3,burnDmg());burst(source.x,source.y,'fire',18,.06);log('Lava erupts under '+source.name+'.','c-fire');}
  if(source&&source.base){var b=source.base;
    if(d>0&&b.poisons&&!player.st.poison&&rng()<b.poisons&&aff('earth')<6){if(applyStatus(player,'poison',4,Math.max(2,sDMG(2))).applied)log('Poisoned by '+source.name+'.','c-you');}
    if(d>0&&b.phases){var drained=Math.min(Math.floor(player.mp),4);if(drained>0){player.mp-=drained;floatText(player.x,player.y,'-'+drained+' mp','magic');}}
    if(d>0&&b.rots)applyStatus(player,'rot',30);   /* 2026-09-28 (Justin): rot lasts 30 turns (was 20) */
    if(b.snuffs){player.snuffed=5;log('The <b>Gloom Moth</b> smothers your light.','c-you');computeFOV();}
    if(b.lurks&&!source._struck)source._struck=true;
    if(b.kindles&&d>0&&player.hp>0){var lit=applyStatus(player,'burn',3,sDMG(3));if(lit.applied&&(!player._fwaLitMsg||player._fwaLitMsg<turn-8)){player._fwaLitMsg=turn;log('The <b>Flame Dancer</b> sets you alight.','c-you');}}
  }
  if(d>0){player.lastDamageTime=player.t;if(hasGod('grumbok')&&godRank()>=3&&(type!=='phys'||event.tags.has('ranged')))player.wizardHunterUntil=player.t+300;}   /* 2026-09-29 (Justin): Wizard Hunter wakes to ranged attacks too; Spellbreaker is retired */
  if(player.hp<=0)lastLaugh();
}
function damageAttackReactions(event){
  var target=event.target,hit=event.hit;
  if(!syllaOn()||!(event.damage>0)||event.source!==player||target===player||!target.foe||target.ally||!hit||hit.att!==player||hit.def!==target||hit._syl||event.tags.has('periodic')||event.tags.has('proc')||event.tags.has('reflected')||event.tags.has('arc'))return;
  hit._syl=true;syllaHitReactions(event);
}
function admitDamage(event){
  var target=event.target;
  if(target===player&&event.type==='poison'&&gameEffects.has(player,'stone'))return rejectDamage(event,'stone-skin');
  // Creature-defined absorption covers ordinary hits and pre-mitigated ticks.
  // Convert the incoming amount before shields, hurt reactions, or attack procs;
  // the damage service has already rejected dead targets and invalid amounts.
  var ratio=target.base&&target.base.damageAbsorption&&target.base.damageAbsorption[event.type];
  if(Number.isFinite(ratio)&&ratio>0){
    var amount=event.amount*ratio;if(gameEffects.has(target,'rot'))amount*=.5;
    var healed=FoteDamage.heal(target.hp,target.maxhp,amount);target.hp=healed.hp;
    if(healed.restored>0){
      gameDamage.emit('healingApplied',{target:target,source:event.source,amount:amount,restored:healed.restored,overflow:healed.overflow,natural:false,damageType:event.type});
    }
    return rejectDamage(event,'element-absorption');
  }
  return true;
}
var gameDamage=FoteDamage.create({
  actionId:function(){var action=typeof gameActions!=='undefined'&&gameActions.current();return action?action.actionId:'world:'+turn;},
  admit:admitDamage,
  modify:function(event){if(damageCreatureRules(event)!==false)damageOutgoingRules(event);},
  defend:damageDefenses,commit:commitDamage,
  after:function(event){damageElementReactions(event);damageReceivedReactions(event);damageAttackReactions(event);}
});
/* HP changes own their feedback. Callers keep their particles/sounds, but never
 * draw a second number or show the requested heal instead of the HP restored. */
gameDamage.on('healingApplied',function(event){
  var n=Math.round(event.restored*10)/10,target=event.target;
  if(!(n>0)||event.regen||typeof actorConcealed==='function'&&actorConcealed(target))return;
  floatText(target.x,target.y,'+'+n,'heal');
});
function combatDamageName(event){
  var names={'murk-drain':'Life Drain',venomtouch:'Venomtouch',
    'fire-affinity':'Fire affinity',smite:'Smite','molten-ring':'Molten Ring',
    gust:'Gust',enchant:'Enchantment',arc:'Arc',reflected:'Reflection','elemental-attack':'Elemental attack'};
  for(var tag in names)if(event.tags.has(tag))return names[tag];
  return event.tags.has('proc')&&!event.tags.has('attack')?'Bonus damage':'';
}
function combatDamageParts(packets){
  var parts=[];
  packets.slice().sort(function(a,b){return a.id-b.id;}).forEach(function(packet){
    var name=combatDamageName(packet),part=parts.find(function(p){return p.type===packet.type&&p.name===name;});
    if(part)part.damage+=packet.damage;else parts.push({type:packet.type,name:name,damage:packet.damage});
  });
  return parts;
}
function combatDamageBreakdown(parts){
  return parts.map(function(p){return p.damage+' '+FoteDamage.label(p.type)+(p.name?' ('+p.name+')':'');}).join(' + ');
}
/* Read the resolved packets, including nested god/enchant procs. Only the
 * current weapon hit's own target/source joins its total; arcs, reflections,
 * spell riders and later effects get a short line of their own. */
gameDamage.on('damageApplied',function(event){
  if(!(event.damage>0))return;
  var action=typeof gameActions!=='undefined'&&gameActions.current();
  if(action&&action.kind==='attack'&&!action.damagePresented&&event.source===action.source&&event.target===action.target&&
      !event.tags.has('arc')&&!event.tags.has('reflected')&&!event.tags.has('periodic')){
    (action.damagePackets||(action.damagePackets=[])).push(event);return;
  }
  if(event.tags.has('attack')||!['proc','arc','reflected'].some(function(tag){return event.tags.has(tag);}))return;
  if(typeof actorConcealed==='function'&&actorConcealed(event.target))return;
  var name=combatDamageName(event),target=event.target===player?'You':event.target.name;
  floatText(event.target.x,event.target.y,String(event.damage),event.type);
  log(name+': '+target+' '+(event.target===player?'take':'takes')+' '+event.damage+' '+FoteDamage.label(event.type)+'.',event.target===player?'c-you':'c-hit');
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
  amount=rotHealing(amount,options&&options.regen);if(!(amount>0))return 0;
  if(hasGod('glimmer'))amount*=1+.10*godRank();
  if(!(options&&options.holyGround)&&inSanctuary(player))amount*=1+.25*(typeof holyGroundStrength==='function'?holyGroundStrength(player):divineStrength());
  var result=FoteDamage.heal(player.hp,player.maxhp,amount);player.hp=result.hp;
  if(result.overflow>0&&combo('light','water'))player.iceArmor=Math.min(player.iceArmorMax,player.iceArmor+result.overflow);
  if(!natural&&amount>=1)deepStanch(player);
  gameDamage.emit('healingApplied',{target:player,amount:amount,restored:result.restored,overflow:result.overflow,natural:!!natural,regen:!!(options&&options.regen)});
  return result.overflow;
}
/* 2026-09-29 (Justin): Rot is the one rule for every HP gain. While you rot, regeneration stops outright (base
   regeneration and everything that multiplies it, such as a Light armor enchant or Grumbok's Thick Hide, plus a
   Ring of Mending and the Regeneration food buff); every other heal is halved. healPlayer() asks it, and so do the
   two heals that write HP themselves (a heart off the floor, a Light shield block). */
function rotHealing(amount,regen){return player&&gameEffects.has(player,'rot')?(regen?0:amount*.5):amount;}
