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
  if(b&&target!==player&&inFwa()){
    if(b.fwa==='leviathan'&&target.submerged){if(source===player)log('The water closes over <b>the Leviathan Eel</b>. Wait for it to come up.','c-info');return rejectDamage(event,'submerged');}
    if(b.shellGuard&&target._shellTurn!==turn&&event.amount>0){target._shellTurn=turn;floatText(target.x,target.y,'shell','miss');if(vis[idxOf(target.x,target.y)])log('The <b>Tide Crab</b> takes it on the shell.','c-info');return rejectDamage(event,'shell');}
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
        floatText(target.x,target.y,'immune','miss');if(target._immuneMsg!==turn){target._immuneMsg=turn;log('The <b>Heart of the Mountain</b> drinks strength from '+count+' crystal node'+(count===1?'':'s')+'. Break '+(count===1?'it':'them')+' first.','c-info');}}
      return rejectDamage(event,'heart-nodes');
    }
    if(b.moonbound&&!inMoonlight(target)){floatText(target.x,target.y,'immune','miss');if(source===player)log('Your blow passes through shadow: the <b>'+target.name+'</b> can only be hurt in the crystal light.','c-info');return rejectDamage(event,'moonlight');}
    if(b.burrows&&target.burrowed)return rejectDamage(event,'burrowed');
    if(b.blocksFirst&&target._blockTurn!==turn&&event.amount>0){target._blockTurn=turn;floatText(target.x,target.y,'block','miss');if(vis[idxOf(target.x,target.y)])log('The <b>Zealot Knight</b> takes the blow on its shield.','c-info');return rejectDamage(event,'first-hit-block');}
    if(b.big&&source===player)target._provoked=true;
    if(b.regenerates&&(type==='fire'||target.st&&target.st.burn))target._burnedAt=turn;
    if(b.reflects&&source===player&&(type!=='phys'||dist(target,player)>1)&&event.amount>1&&!event.tags.has('reflected')){
      var back=Math.round(event.amount*.5);event.amount-=back;
      var reflected=gameDamage.resolve(player,back,type,target,{tags:['reflected']});floatText(player.x,player.y,String(reflected.damage),'light');log('The <b>'+target.name+'</b> reflects '+reflected.damage+' back at you.','c-you');
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
    d*=.25;onShieldBlock(source,player,amount);log('Your shield turns the '+(type==='phys'?'blow':type)+' from '+(source.name||'the attack')+'.','c-good');floatText(player.x,player.y,'block','miss');sfx('block');
  }
  var barrier=isPlayer&&hasP('magicBarrier')&&!event.tags.has('area')&&foe&&dist(source,player)>1?5:0;
  if(type==='phys'){
    var pierce=(source===player?player.weapon.pierce||0:0)+(source&&source.base?source.base.pierce||0:0);
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
    if(capstone('grumbok')&&type!=='phys'&&foe)d*=.5;
    d=d>0&&barrier>0?Math.max(1,d-barrier):Math.max(0,d);
    if(d>0&&foe&&hasP('fortitude')&&!(player.fortUntil>player.t)){d*=.5;player.fortUntil=player.t+1500;log('Fortitude blunts the blow.','c-good');}
    // A landed physical hit survives rounding; actual shields can still absorb it.
    if(type==='phys'&&d>0)d=Math.max(1,d);
    if(!event.options.bypassShields){
      if(player.ward>0&&!(buff('arcaneward')||buff('communion')))player.ward=0;
      var pools=[['ward','magic'],['iceArmor','ice'],['hideShield','phys'],['mward','magic'],['guard','phys']].map(function(p){return {key:p[0],amount:player[p[0]],type:p[1]};});
      var absorption=FoteDamage.absorb(d,pools);d=absorption.remaining;event.absorbed=absorption.absorbed;
      Object.keys(absorption.pools).forEach(function(key){player[key]=absorption.pools[key];});
      absorption.absorbed.forEach(function(pool){floatText(player.x,player.y,'-'+Math.round(pool.amount),pool.type);if(pool.key==='ward'&&player.ward<=0)log('Your Arcane Ward shatters.','c-info');});
    }
  }
  if(target.challenged&&target.challengeBoost)d*=1.2;
  if(target.dazed>0)d*=1.5;
  event.amount=d;
}
function commitDamage(event){
  var target=event.target,d=event.damage;
  target.hp-=d;
  if(d>0)revealActor(target);
  if(d>0&&typeof FoteChaosEnemies!=='undefined')FoteChaosEnemies.onDamaged(event);
  if(d>0&&event.options.reactions!==false)godDamageResolved(target,d,event.type,event.source,event);
  if(event.options.visuals!==false){
    target._hit=Math.max(performance.now(),fxClock);
    if(target===player&&d>0){setClip(player,'hurt');sfx('player-hurt',{at:target._hit});if(typeof onPlayerHurt==='function')onPlayerHurt(d);}
    else if(target!==player&&d>0&&target.base&&!target._clip)setClip(target,'hurt');
  }
  if(target!==player&&target.base&&target.base.splits&&!target.split&&target.hp>0&&target.hp<target.maxhp/2&&!event.tags.has('periodic'))slimeSplit(target);
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
    if(other){var arc=gameDamage.resolve(other,Math.max(1,Math.round(d*.5)),'lightning',player,{tags:['arc']});boltFx(target.x,target.y,other.x,other.y,'lightning');floatText(other.x,other.y,String(arc.damage),'lightning');if(other.hp<=0)kill(other,player);}
  }
}
function damageReceivedReactions(event){
  var target=event.target,source=event.source,type=event.type,d=event.damage;
  if(target!==player)return;
  var soaked=event.iceBefore-(player.iceArmor||0);
  if(soaked>0&&combo('water','light'))healPlayer(Math.max(1,Math.round(soaked*.25)));
  if(d>0&&source&&source.foe&&source.hp>0&&combo('fire','earth')&&(dist(source,player)>1||type!=='phys')){applyStatus(source,'root',1);applyStatus(source,'burn',3,burnDmg());burst(source.x,source.y,'fire',18,.06);log('Lava erupts under '+source.name+'.','c-fire');}
  if(source&&source.base){var b=source.base;
    if(d>0&&b.poisons&&!player.st.poison&&rng()<b.poisons&&aff('earth')<6){applyStatus(player,'poison',4,Math.max(2,sDMG(2)));log('The arrow is grave-tipped: <b>you are poisoned</b>.','c-you');}
    if(d>0&&b.phases){var drained=Math.min(Math.floor(player.mp),4);if(drained>0){player.mp-=drained;floatText(player.x,player.y,'-'+drained+' mp','magic');}}
    if(d>0&&b.rots)applyStatus(player,'rot',20);
    if(b.snuffs){player.snuffed=5;log('The <b>Gloom Moth</b> smothers your light.','c-you');computeFOV();}
    if(b.lurks&&!source._struck)source._struck=true;
    if(b.kindles&&d>0&&player.hp>0){applyStatus(player,'burn',3,sDMG(3));if(!player._fwaLitMsg||player._fwaLitMsg<turn-8){player._fwaLitMsg=turn;log('The <b>Flame Dancer</b> sets you alight.','c-you');}}
  }
  if(d>0){player.lastDamageTime=player.t;if(hasGod('grumbok')&&godRank()>=3&&type!=='phys')player.wizardHunterUntil=player.t+300;if(capstone('grumbok')&&type!=='phys'&&source&&source.foe)player.spellbreakUntil=player.t+1000;}
  if(player.hp<=0)lastLaugh();
}
function damageAttackReactions(event){
  var target=event.target,hit=event.hit;
  if(!syllaOn()||target===player||target.ally||!hit||hit.att!==player||hit.def!==target||hit._syl||event.tags.has('periodic'))return;
  hit._syl=true;var rank=godRank();
  if(rank>=3&&target.hp>0){syllaPoison(target,SYLLA.poisonTurns,rank);if(event.wasStatused&&target.hp>0){var venom=gameDamage.resolve(target,rank,'poison',player,{tags:['proc','venomtouch']});if(venom.damage>0)floatText(target.x,target.y,String(venom.damage),'poison');}}
}
var gameDamage=FoteDamage.create({
  actionId:function(){var action=typeof gameActions!=='undefined'&&gameActions.current();return action?action.actionId:'world:'+turn;},
  admit:function(event){return true;},
  modify:function(event){if(damageCreatureRules(event)!==false)damageOutgoingRules(event);},
  defend:damageDefenses,commit:commitDamage,
  after:function(event){damageElementReactions(event);damageReceivedReactions(event);damageAttackReactions(event);}
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
function healPlayer(amount,natural){
  if(!player||!(amount>0))return 0;
  if(inSanctuary(player))amount*=1+.25*divineStrength();
  var result=FoteDamage.heal(player.hp,player.maxhp,amount);player.hp=result.hp;
  if(result.overflow>0&&combo('light','water'))player.iceArmor=Math.min(player.iceArmorMax,player.iceArmor+result.overflow);
  if(!natural&&amount>=1)deepStanch(player);
  gameDamage.emit('healingApplied',{target:player,amount:amount,restored:result.restored,overflow:result.overflow,natural:!!natural});
  return result.overflow;
}
