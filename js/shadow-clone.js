/* Umbral Passage's echo is an ordinary saved ally with an immutable numeric
 * combat snapshot. It never swaps the live player or borrows mutable gear. */
(function(root){
  'use strict';
  var types=['phys','fire','ice','lightning','poison','light','dark','magic'];
  function copy(value){return value===undefined?undefined:JSON.parse(JSON.stringify(value));}
  function isClone(e){return !!(e&&e.shadowClone&&e.cloneStats);}
  function migrateSnapshot(s){
    if((s.version||1)<3){
      // Older echoes saved the base and gear multiplier before Agility's perks.
      // Use their own frozen stats and gear, never the current player's build.
      s.criticalMultiplier=FoteActions.criticalMultiplier(s.stats&&s.stats.agi,(s.criticalMultiplier||1.6)-1.6);
      s.version=3;
    }
  }
  function statModel(p){var out={};['name','race','cls','level','god','piety','stats','aff','buffs','sets','activeSet','off','rings','armorItem','forgeHeat'].forEach(function(k){out[k]=copy(p[k]);});out.st={livingmountain:copy(p.st&&p.st.livingmountain)};return out;}
  function buffed(e){return Object.keys(e.buffs||{}).some(function(k){return k!=='hardened'&&e.buffs[k]>0;})||e.cloneExtraBuff>0||!!(e.st.livingmountain&&e.st.livingmountain.t>0);}
  function refreshStats(e){
    var s=e.cloneStats;migrateSnapshot(s);if(!s.statModel)return;
    var model=Object.assign({},s.statModel,{buffs:e.buffs,st:{livingmountain:e.st.livingmountain},forgeHeat:e.cloneForgeHeat}),now=FoteStats.compute(model,statContent());
    ['acc','eva','armor','crit','block','parry','speed'].forEach(function(k){e[k]=s[k]+now[k]-s.statInitial[k];if(['acc','eva','armor','speed'].includes(k))e.base[k]=e[k];});
    if(!(e.buffs.ironhide>0))e.hideShield=0;
  }
  function snapshot(){
    var p=player,perks=copy(p.passives||{}),rank=godRank(),hpRate=(.20+.02*Math.max(0,p.stats.vit-10))/100;
    if(bodyArmor(p).enchant==='light')hpRate*=1+enchantValues('armor','light').hpRegen;
    if(hasGod('grumbok'))hpRate*=1+.20*rank;if(hasGod('glimmer'))hpRate*=1+.10*rank;
    var off=p.twoHanded?null:p.off,orb=off&&focusKey(off)==='orb'?off.enchant:null,weapon=p.weapon||{},focus=['staff','wand'].includes(itemKey(weapon))||weapon.spell;
    var resist={},contexts={},arm=bodyArmor(p);
    types.forEach(function(type){
      resist[type]=resistMult(p,type);
      contexts[type]={player:true,armorResistance:arm.enchant&&elemToType(arm.enchant)===type?enchantValues('armor',arm.enchant).resistance:0,
        tomeResistance:infusion('tome')==='earth'?enchantValues('tome','earth').resistance:0,godResistance:hasGod('grumbok')?Math.min(.4,.08*rank):0,
        water:aff('water'),vitality:p.stats.vit,bulwark:!!perks.bulwark,lightVulnerable:p.race==='gloomling',
        courtOpposite:p.race==='fae'&&p.court?elemToType(OPPOSITE[p.court]):null,warding:ringVal('warding'),
        immune:Object.keys(IMMUNE_TYPE).some(function(el){return IMMUNE_TYPE[el]===type&&aff(el)>=6;}),
        divine:divineStrength()};
    });
    var timing=Object.assign({},playerTiming(),{attacking:false,casting:true,free:false,freeStep:false,chill:0,slow:0});
    var model=statModel(p),extraBuff=Math.max(p.levitate||0,p.hidden||0,p.st&&p.st.stone&&p.st.stone.t||0,p.st&&p.st.aura&&p.st.aura.t||0);
    var immunities=[];Object.keys(FoteEffects.registry).forEach(function(key){var d=FoteEffects.registry[key];if(d.element&&(p.aff[d.element]||0)>=(d.immuneRank||3))immunities.push(key);});
    if(perks.unstoppable)immunities.push('slow','root','stun','knockback');
    return {version:3,stats:copy(p.stats),aff:copy(p.aff),passives:perks,resist:resist,resistanceContexts:contexts,
      statModel:model,statInitial:FoteStats.compute(model,statContent()),timing:timing,stormTurns:Math.max(0,(p.stormUntil||0)-p.t)/100,extraBuff:extraBuff,
      spellPowerBase:spellPower()/(buff('rally')?1.1:1),holyAir:infusion('holy')==='air',holyReduction:infusion('holy')==='air'?enchantValues('holy','air').actionTimeReduction:0,
      holyCrit:infusion('holy')==='shadow'?enchantValues('holy','shadow').critChance:0,holyFire:infusion('holy')==='fire'?enchantValues('holy','fire').damageBonus:0,holyEarth:infusion('holy')==='earth'?enchantValues('holy','earth').damageReduction:0,
      grumbokCapstone:hasGod('grumbok')&&rank>=5,reginaldRank:hasGod('reginald')?rank:0,divine:divineStrength(),
      hp:p.hp,maxhp:p.maxhp,mp:p.mp,maxmp:p.maxmp,acc:p.acc,eva:p.eva,armor:p.armor,crit:p.crit,block:p.block||0,parry:p.parry||0,speed:p.speed,buffs:copy(p.buffs||{}),
      spellPower:spellPower(ABILITIES.shadowbolt),range:spellRange(ABILITIES.shadowbolt),criticalMultiplier:criticalMultiplier(),critBonus:actionCritBonus(p),rootCrit:orb==='earth'?enchantValues('orb','earth').critChance:0,
      castCost:FoteCosts.action(timing),immunities:immunities,blur:!!perks.blur,deflect:armorDeflectChance(),luck:luckBonus(),
      wardChance:p.block>0?p.block:Math.min(.40,.25+.01*Math.max(0,p.stats.mig-10)),laststand:buff('laststand'),spellWard:!!perks.spellWard,
      magicBarrier:!!perks.magicBarrier,fortitude:!!perks.fortitude,fortUntil:p.fortUntil||0,earth:p.aff.earth||0,
      hpRate:hpRate,mending:mendingRate(ringVal('mending')),fed:p.hunger>0,foodRegen:buff('regeneration')?.01:0,sanctuaryBonus:.25*divineStrength(),
      mpRate:(.60+.05*Math.max(0,p.stats.foc-10))/100*(perks.meditation?1.25:1),manaflow:buff('manaflow')?.009:0,
      shield:off&&off.block>0?{element:off.enchant,values:copy(enchantValues('shield',off.enchant))}:null,
      orb:orb?{element:orb,values:copy(enchantValues('orb',orb))}:null,
      weapon:focus&&weapon.enchant?{element:weapon.enchant,values:copy(enchantValues('weapon',weapon.enchant))}:null,
      tomeHeal:off&&focusKey(off)==='tome'&&off.enchant==='shadow'?enchantValues('tome','shadow').killHeal:0,
      burn:burnDmg(),syllaDuration:syllaOn()&&rank>=5?1:0,
      pools:FoteCosts.shields(p).map(function(pool){return {key:pool.key,amount:pool.amount};}),iceArmorMax:p.iceArmorMax||0,guardMax:p.guardMax||0,
      look:playerCastLook(),race:p.race,gender:p.gender,face:p.face,appearance:{weapon:copy(p.weapon),off:copy(p.off),armorItem:copy(p.armorItem),twoHanded:p.twoHanded}};
  }
  function create(x,y,s){
    if(!s||!walkable(x,y)||occupied(x,y))return null;
    migrateSnapshot(s);
    ents=ents.filter(function(e){return !isClone(e)||e.cloneOwnerId!==player.id;});
    var e=spawnRaw('shadowclone',x,y);
    Object.assign(e,{foe:false,ally:true,state:'ally',name:player.name+'\'s Shadow',shadowClone:true,cloneOwnerId:player.id,cloneStats:s,cloneLook:s.look,
      hp:s.hp,maxhp:s.maxhp,mp:s.mp,maxmp:s.maxmp,acc:s.acc,eva:s.eva,armor:s.armor,crit:s.crit,block:s.block,parry:s.parry,speed:s.speed,
      st:{},buffs:copy(s.buffs),t:player.t+Math.max(1,s.castCost)+1,noXp:true,noReward:true,cloneBornAt:worldNow(),clonePulseAt:worldNow(),lastDamageTime:worldNow(),
      iceArmorMax:s.iceArmorMax,guardMax:s.guardMax,fortUntil:s.fortUntil,face:s.face,race:s.race,gender:s.gender});
    e.cloneStormTurns=s.stormTurns||0;e.cloneExtraBuff=s.extraBuff||0;e.cloneForgeHeat=copy(s.statModel&&s.statModel.forgeHeat);
    if(s.statModel&&s.statModel.st.livingmountain)e.st.livingmountain=copy(s.statModel.st.livingmountain);
    e.base=Object.assign({},MONSTERS.shadowclone,{acc:s.acc,eva:s.eva,armor:s.armor,speed:s.speed,statusImmunities:s.immunities.slice()});
    Object.assign(e,copy(s.appearance));s.pools.forEach(function(pool){e[pool.key]=pool.amount;});
    RUN.shadowClone=e;sparkleFx(x,y,'dark',24);return e;
  }
  function damage(e,target,amount,type,extra){
    return applyDamage(target,amount,type,e,Object.assign({tags:['spell','single-target','shadow-clone','murk-inherited']},extra||{}));
  }
  function effectOptions(e){return {sourceAffinity:copy(e.cloneStats.aff),sourcePoint:{x:e.x,y:e.y},data:{sourceAffinity:copy(e.cloneStats.aff),sourceDuration:e.cloneStats.syllaDuration},durationModifiers:false,bossControl:true};}
  function status(e,target,key,turns,amount){return gameEffects.apply(target,key,turns+e.cloneStats.syllaDuration,amount,effectOptions(e));}
  function weaponProc(e,target,dealt){
    var spec=e.cloneStats.weapon;if(!spec||target.hp<=0||dealt<=0)return;
    var el=spec.element,v=spec.values,extra=0;
    if(el==='fire'){extra+=Math.round(dealt*v.extraDamage);if(rng()<v.burnChance)status(e,target,'burn',v.burnDuration,e.cloneStats.burn);}
    if(el==='water'&&rng()<v.chillChance)gameEffects.addChill(target,effectOptions(e));
    if(el==='earth'&&rng()<v.rootChance)status(e,target,'root',v.rootDuration);
    if(el==='air'&&rng()<v.repeatChance)damage(e,target,dealt,'dark');
    if(el==='light'&&(target.base.undead||target.base.shadowy))extra+=Math.round(dealt*v.extraDamage);
    if(el==='shadow'){if(target.st.hollow)extra+=v.hollowDamage;if(rng()<v.procChance){extra+=Math.round(dealt*v.extraDamage);status(e,target,'corrupt',v.corruptDuration);}}
    if(extra>0)dealDirectDamage(target,extra,el==='light'?'light':el==='fire'?'fire':'dark',e,{tags:['proc','enchant','shadow-clone','murk-inherited']});
  }
  function cast(e,target){
    refreshStats(e);var s=e.cloneStats,A=ABILITIES.shadowbolt,line=projectileLine(e,target,{range:s.range});if(!line)return;
    var point=line.to;setClip(e,'cast');e.facingLeft=point.x<e.x;boltFx(line.from.x,line.from.y,point.x,point.y,'dark');
    var chance=hitChance(e.acc+10,evaOf(target));if(gameEffects.has(e,'blind'))chance*=.6;
    if(rng()>=chance){floatText(point.x,point.y,'miss','miss');return;}
    return gameActions.run('spell',e,target,{ability:A,tags:['shadow-clone']},function(event){
      var numb=!!(target.st.chill&&(s.aff.water||0)>=3&&(s.aff.shadow||0)>=2),unaware=offGuard(target)||numb||target.st.stun||target.st.frozen;
      var crit=rng()<((target.sapped?1:e.crit+(s.holyCrit!==undefined?(buffed(e)?s.holyCrit:0):s.critBonus))+(effectHasTag(target,'root')?s.rootCrit:0)+(unaware?.05*(s.aff.shadow||0):0));
      var power=s.spellPowerBase!==undefined?s.spellPowerBase*(e.buffs.rally>0?1.1:1):s.spellPower;
      var raw=Math.round(sDMG(roll(A.base[0],A.base[1]))*power)+(s.aff.fire||0);
      raw=FoteActions.spellDamage(raw,{bolt:true,numbing:numb,crit:crit,criticalMultiplier:s.criticalMultiplier});
      if((s.aff.fire||0)>=3&&target.st.burn)raw*=1+.05*s.aff.fire;
      if(buffed(e)&&s.holyFire)raw*=1+s.holyFire;
      event.hit={att:e,def:target,crit:crit,spell:true,surprise:!!unaware,view:e,actionId:event.actionId};
      var dealt=damage(e,target,raw,'dark',{hit:event.hit,ability:A,actionId:event.actionId});event.damage=dealt;event.landed=dealt>0;
      target.lastHitBy=e;floatText(point.x,point.y,String(dealt),'dark',crit);
      if(target.hp>0){status(e,target,'fear',A.status.fear);if((s.aff.shadow||0)>=6&&dealt>0)addHollow(target,1);}
      var orb=s.orb;if(crit&&orb){var v=orb.values;
        if(orb.element==='water')e.iceArmor=Math.min(e.iceArmorMax,(e.iceArmor||0)+v.iceArmor);
        if(orb.element==='air'&&target.hp>0)status(e,target,'stun',v.stunDuration);
        if(orb.element==='light')e.mp=Math.min(e.maxmp,e.mp+v.mana);
        if(orb.element==='fire'&&target.hp>0)status(e,target,'burn',v.burnDuration,s.burn);
      }
      weaponProc(e,target,dealt);
      if(target.hp<=0){if(s.tomeHeal)e.hp=Math.min(e.maxhp,e.hp+Math.max(1,Math.round(e.maxhp*s.tomeHeal)));kill(target,e);}
    });
  }
  function act(e){
    if(!isClone(e))return false;
    var target=ents.filter(function(o){return o.foe&&o.hp>0&&!actorConcealed(o)&&dist(e,o)<=e.cloneStats.range&&clearShot(e,o);}).sort(function(a,b){return dist(e,a)-dist(e,b)||a.id-b.id;})[0];
    if(target)cast(e,target);else if(dist(e,player)>2&&canActorMove(e))allyFollowStep(e);
    return true;
  }
  function block(e,source,raw){
    var spec=e.cloneStats.shield;if(!spec||!source||source.hp<=0)return;
    var el=spec.element,v=spec.values;
    if(el==='fire'){damage(e,source,Math.max(1,Math.round(raw*v.fire)),'fire');if(source.hp>0&&rng()<v.burn)status(e,source,'burn',v.burnDuration,e.cloneStats.burn);}
    if(el==='water'&&rng()<v.water)gameEffects.addChill(source,effectOptions(e));
    if(el==='air'&&rng()<v.air){status(e,source,'stun',v.stunDuration);knockback(source,source.x-e.x,source.y-e.y,v.knockback);}
    if(el==='light')e.hp=Math.min(e.maxhp,e.hp+v.light);
    if(el==='shadow'&&rng()<v.shadow)status(e,source,'corrupt',v.corruptDuration);
    if(source.hp<=0)kill(source,e);
  }
  function defend(event){
    var e=event.target;if(!isClone(e))return false;
    var s=e.cloneStats,source=event.source,foe=source&&source.foe,type=event.type,d=event.amount;
    refreshStats(e);
    if(s.resistanceContexts&&s.resistanceContexts[type]&&s.resistanceContexts[type].immune||type==='poison'&&e.buffs.poisonward>0){event.amount=0;return true;}
    if(e.tomb>0){event.amount=0;return true;}
    if(buffed(e)&&s.holyEarth)d*=1-s.holyEarth;
    if(foe&&!event.options.attackRolled&&!event.tags.has('area')&&s.spellWard&&rng()<s.wardChance){block(e,source,d);d*=.25;floatText(e.x,e.y,'block','miss');}
    if(type==='phys')d=FoteDamage.physical(d,{armor:armorOf(e),pierce:source&&source.base&&source.base.pierce||0,heavy:!!(source&&source.base&&source.base.heavy),earth:s.earth,stone:e.st.stone,frozen:e.st.frozen})*resistMult(e,type);
    else d=FoteDamage.elemental(d,{resistance:resistMult(e,type),player:true,corrupt:type==='dark'&&e.st.corrupt});
    if(d>0&&e.st.frozen)gameEffects.remove(e,'frozen','damaged');
    if(e.buffs.laststand>0)d*=.5;
    if(s.reginaldRank>=3&&foe&&source.challenged)d*=Math.max(0,1-.05*s.reginaldRank*s.divine);
    if(s.reginaldRank>=5&&foe)d*=1-.10*Math.min(3,Math.max(0,ents.filter(function(o){return o.foe&&o.hp>0&&dist(e,o)<=1;}).length-1));
    if(s.grumbokCapstone&&type!=='phys'&&foe)d*=.5;
    if(s.magicBarrier&&foe&&!event.tags.has('area')&&dist(source,e)>1&&d>0)d=Math.max(1,d-5);
    if(s.fortitude&&foe&&d>0&&!(e.fortUntil>worldNow())){d*=.5;e.fortUntil=worldNow()+1500;}
    if(type==='phys'&&d>0)d=Math.max(1,d);
    if(!event.options.bypassShields){if(e.ward>0&&!(e.buffs.arcaneward>0||e.buffs.communion>0))e.ward=0;var absorption=FoteDamage.absorb(d,['ward','iceArmor','hideShield','mward','guard'].map(function(k){return{key:k,amount:e[k]||0,type:'dark'};}));d=absorption.remaining;event.absorbed=absorption.absorbed;Object.keys(absorption.pools).forEach(function(key){e[key]=absorption.pools[key];});}
    if(e.challenged&&e.challengeBoost)d*=1.2;if(e.dazed>0)d*=1.5;
    if(d>0)e.lastDamageTime=worldNow();event.amount=d;return true;
  }
  function pulse(e,clock){
    if(!isClone(e)||e.hp<=0||clock<=e.clonePulseAt)return;
    var s=e.cloneStats,scale=(clock-e.clonePulseAt)/100;e.clonePulseAt=clock;
    var poisoned=gameEffects.has(e,'poison'),rot=gameEffects.has(e,'rot'),fighting=ents.some(function(o){return o.foe&&o.hp>0&&o.state==='hunt'&&dist(e,o)<=s.range&&clearShot(e,o);});
    var hp=s.fed&&!poisoned&&!rot&&!fighting?s.hpRate*(s.passives.resilient&&e.hp<e.maxhp/2?2:1):0;
    if(s.fed&&!poisoned)hp+=s.mending;if(e.buffs.regeneration>0)hp+=s.foodRegen;e.hp=Math.min(e.maxhp,e.hp+e.maxhp*hp*scale*(inSanctuary(e)?1+(s.sanctuaryBonus||0):1));
    var mp=s.mpRate*(s.passives.tidalMind&&e.mp<e.maxmp/2?2:1)+(e.buffs.manaflow>0?s.manaflow:0);e.mp=Math.min(e.maxmp,e.mp+e.maxmp*mp*scale);
    if(clock-(e.lastDamageTime||0)>=500){e.iceArmor=Math.min(e.iceArmorMax,(e.iceArmor||0)+scale);e.guard=Math.min(e.guardMax,(e.guard||0)+scale);}
    Object.keys(e.buffs).forEach(function(key){e.buffs[key]=Math.max(0,e.buffs[key]-scale);});
    e.cloneStormTurns=Math.max(0,(e.cloneStormTurns||0)-scale);e.cloneExtraBuff=Math.max(0,(e.cloneExtraBuff||0)-scale);
    if(e.cloneForgeHeat){e.cloneForgeHeat.t-=scale;if(e.cloneForgeHeat.t<=0)e.cloneForgeHeat=null;}
    refreshStats(e);
  }
  function cost(e){var s=e.cloneStats;if(!s.timing)return Math.max(1,Math.round(s.castCost/(1-(e.st.chill?chillSlow(e):0))/(e.st.slow?(e.st.slow.mult||SYLLA.slowMult):1)));
    refreshStats(e);return FoteCosts.action(Object.assign({},s.timing,{speed:e.speed,storm:e.cloneStormTurns>0,holyAir:s.holyAir&&buffed(e),holyReduction:s.holyReduction,chill:e.st.chill?chillSlow(e):0,slow:e.st.slow?(e.st.slow.mult||SYLLA.slowMult):0}));}
  function resistance(e,type){
    var s=e.cloneStats,c=s.resistanceContexts&&s.resistanceContexts[type];if(!c)return s.resist[type]===undefined?1:s.resist[type];
    return FoteActions.resistance(type,Object.assign({},c,{wet:!!isWet(e),chilled:!!e.st.chill,sanctuary:inSanctuary(e),
      poisonward:e.buffs.poisonward>0,shadeward:e.buffs.shadeward>0,stormward:e.buffs.stormward>0,fireward:e.buffs.fireward>0,starward:e.buffs.starward>0}));
  }
  function arrive(){
    if(!RUN)return;
    var e=RUN.shadowClone;
    if(!isClone(e)){e=ents.find(isClone);if(e)RUN.shadowClone=e;else return;}
    if(e.hp<=0){delete RUN.shadowClone;return;}
    if(ents.includes(e))return;
    var spot=nearFree(player.x,player.y,4);if(!spot)return;
    e.x=spot.x;e.y=spot.y;e.t=player.t+Math.max(1,cost(e));e.clonePulseAt=worldNow();e._lx=e._ly=undefined;delete e._clip;ents.push(e);
  }
  MONSTERS.shadowclone={name:'Shadow Clone',hp:1,dmg:[0,0],acc:0,eva:0,speed:100,armor:0,xp:0,band:[99,99],w:0,ch:'@',col:'#7962AA',living:true};
  DROPS.shadowclone={chance:0,table:{}};
  ABILITIES.umbral.desc='Step to any seen tile that no enemy stands beside. Leave a shadow clone with your current combat stats; it casts Shadow Bolt and follows you between floors until killed or replaced by another Passage. Only one clone can exist. Arrive hidden for 2 turns.';
  root.FoteShadowClone=Object.freeze({isClone:isClone,snapshot:snapshot,create:create,act:act,cast:cast,defend:defend,block:block,pulse:pulse,cost:cost,resistance:resistance,arrive:arrive});
})(globalThis);
