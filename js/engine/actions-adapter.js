/* One contextual path for attacks and spell hits. Equipment is never swapped
 * to simulate an action, and every damage event carries its action identity. */
var gameActions=FoteActions.create();
function actionInfusion(kind,view){
  view=view||player;var o=view.twoHanded?null:view.off;
  return o&&(o.icon||'').replace(/^item-/,'')===kind?o.enchant||null:null;
}
function actionDivine(view){var w=view.weapon||{},o=view.twoHanded?{}:view.off||{};return 1+((w.cursed?0:w.divine||0)+(o.cursed?0:o.divine||0))*gearPassiveBonus();}
function actionCritBonus(view){return actionInfusion('holy',view)==='shadow'&&isBuffed()?enchantValues('holy','shadow').critChance:0;}
function actionRootCrit(target,view){return actionInfusion('orb',view)==='earth'&&effectHasTag(target,'root')?enchantValues('orb','earth').critChance:0;}
function actionCritMultiplier(view){return 1.6+(actionInfusion('orb',view)==='shadow'?enchantValues('orb','shadow').critMultiplier:0);}
function attackView(att,def,options){
  if(att!==player)return att;
  var selected=options.weapon;
  if(!selected&&isRangedWeapon(player.ranged)&&dist(player,def)>1&&!player._reaching)selected=player.ranged;
  if(!selected)return Object.assign({},player);
  var actor=options.offhand?Object.assign({},player,{off:EMPTY_OFF}):player;
  var stats=FoteStats.compute(actor,statContent(),{weapon:selected});
  if(options.offhand)return Object.assign({},actor,stats);
  // The dedicated ranged slot supplies its own damage/accuracy/crit. Worn
  // offhand passives retain the same scope they have in the character sheet.
  return Object.assign({},player,{weapon:selected,dmg:stats.dmg,acc:stats.acc,crit:stats.crit});
}
function resistMult(target,type){
  if(target.shadowClone&&target.cloneStats&&typeof FoteShadowClone!=='undefined')return FoteShadowClone.resistance(target,type);
  var own=target===player,b=target.base||{},B=target.buffs||{},arm=own?bodyArmor(player):{},immunity=false;
  if(own)for(var el in IMMUNE_TYPE)if(IMMUNE_TYPE[el]===type&&aff(el)>=6)immunity=true;
  return FoteActions.resistance(type,{player:own,
    armorResistance:own&&arm.enchant&&elemToType(arm.enchant)===type?enchantValues('armor',arm.enchant).resistance:0,
    tomeResistance:own&&infusion('tome')==='earth'?enchantValues('tome','earth').resistance:0,
    godResistance:own&&hasGod('grumbok')?Math.min(.4,.08*godRank()):0,
    water:own?aff('water'):0,vitality:own?player.stats.vit:10,bulwark:own&&hasP('bulwark'),
    lightVulnerable:own&&player.race==='gloomling',courtOpposite:own&&player.race==='fae'&&player.court?elemToType(OPPOSITE[player.court]):null,
    element:b.el?elemToType(b.el):null,opposite:b.el?elemToType(OPPOSITE[b.el]):null,undead:b.undead||b.shadowy,
    wet:!!isWet(target),chilled:!!(target.st&&target.st.chill),warding:own?ringVal('warding'):0,immune:immunity,
    poisonward:B.poisonward>0,shadeward:B.shadeward>0,stormward:B.stormward>0,fireward:B.fireward>0,starward:B.starward>0,
    mountainResistance:own?.02*livingMountainStacks(player):0,sanctuary:inSanctuary(target),divine:divineStrength()});
}
function prepareAttack(event){
  var att=event.source,def=event.target,view=event.view=attackView(att,def,event.options);
  revealActor(att);
  if(att===player&&view.weapon&&view.weapon.unarmed&&!event.options.offhand&&!event.tags.has('proc')&&livingMountain(player)){
    stackLivingMountain();view=event.view=attackView(att,def,event.options);
  }
  event.multiplier=event.options.multiplier||1;event.label=event.options.label;
  event.hpBefore=def.hp;event.playerHPBefore=player.hp;
  event.thorns=def===player&&att!==player&&att.hp>0&&buff('thorns')&&dist(att,def)<=1;
  event.shieldedHPBefore=player.hp+(player.ward||0)+(player.iceArmor||0);
  event.wasHidden=player.hidden>0;
  event.numbing=att===player&&numbingDark(def)&&!event.wasHidden;
  event.dark=att===player&&syllaOn()&&player.syllaDark>0&&event.wasHidden?player.syllaDark:0;
  if(event.dark)event.multiplier*=1+SYLLA.darkPerRank*event.dark*actionDivine(view);
  if(att.ally&&att.rallyUntil>player.t)event.multiplier*=1.1;
  if(att.base&&att.base.lurks&&!att._struck&&def===player){event.multiplier*=2;att._struck=true;log('The <b>Stalker</b> strikes from the dark!','c-you');}
  if(att===player){player.noisy=true;if(view.weapon&&!view.weapon.unarmed)useCount(view.weapon,'weapon');}
  if(def===player&&player.armorItem)useCount(player.armorItem,'armor');
}
function attack(att,def,mult,label,options){
  LAST_HIT=null;if(!att||!def||def.hp<=0)return;
  options=Object.assign({},options||{},{multiplier:mult||1,label:label});
  return gameActions.run('attack',att,def,options,function(event){
    prepareAttack(event);
    if(att.base&&att.base.prism&&def===player&&dist(att,def)>1&&!options.split){
      var other=ents.filter(function(o){return o!==player&&!o.foe&&o.hp>0&&dist(o,player)<=3&&canSeeFrom(att,o);})[0];
      if(other)event.multiplier*=.7;
      boltFx(att.x,att.y,player.x,player.y,'light',{});resolveWeaponStrike(event);
      if(other){boltFx(att.x,att.y,other.x,other.y,'light',{});attack(att,other,(mult||1)*.7,label,{split:true});if(vis[idxOf(att.x,att.y)])log('The <b>Prism Scarab</b> splits its beam between you and '+other.name+'.','c-info');}
    }else resolveWeaponStrike(event);
    finishAttackReactions(event);
  });
}
function offHandSwing(foe){
  if(!foe||foe.hp<=0||!player.off||!player.off.weapon||player.twoHanded)return;
  return attack(player,foe,.6,undefined,{weapon:player.off,offhand:true,tags:['offhand']});
}
function finishAttackReactions(event){
  var att=event.source,def=event.target,H=event.hit,landed=def.hp<event.hpBefore;
  if(event.thorns){var taken=event.shieldedHPBefore-(player.hp+(player.ward||0)+(player.iceArmor||0));
    if(taken>0&&att.hp>0){var d=applyDamage(att,Math.max(1,Math.round(taken*.5)),'phys',player,{tags:['reflected'],actionId:event.actionId});floatText(att.x,att.y,String(d),'poison');if(att.hp<=0)kill(att,player);}}
  if(att===player){if(H&&landed)afterPlayerHit(def,H);else if(player.friction)player.friction.n=0;}
  if(att!==player&&def===player&&att.foe&&dist(att,player)<=1&&player.hp<event.playerHPBefore&&player.hp>0&&combo('air','shadow')&&!(player.windCd>turn)){
    var best=null,bd=0;for(var dy=-1;dy<=1;dy++)for(var dx=-1;dx<=1;dx++){var nx=player.x+dx,ny=player.y+dy;if((dx||dy)&&walkable(nx,ny)&&!occupied(nx,ny)){var dd=dist({x:nx,y:ny},att);if(dd>bd){bd=dd;best={x:nx,y:ny};}}}
    if(best&&bd>1){player.x=best.x;player.y=best.y;player.windCd=turn+5;log('Windwalker: you slip away.','c-good');computeFOV();}}
  if(att===player&&landed){stokeForgeHeat();if(hasGod('grom')&&event.view.weapon.unarmed&&def.foe&&event.hpBefore>0)gainPiety(1,'punch',{pietyOnly:true});}
  if(att===player&&def.surprised)def.surprised=false;
  if(att===player&&def.base&&def.base.fumes&&dist(att,def)<=1&&def.hp>0&&(def._fumeAt||-9)<turn-1){def._fumeAt=turn;addCloud(def.x,def.y,1,5,sDMG(2+Math.floor(floorNo/3)),'beetle');log('The <b>Grave Beetle</b> vents a cloud of noxious fumes!','c-you');sfx('trap-gas');}
  if(att.base&&att.base.reloads&&def===player&&dist(att,def)>1){att.reloading=true;if(landed){applyStatus(player,'root',1);log('An arrow pins you in place.','c-you');}}
  if(att.base&&landed&&player.hp>0){if(att.base.arcs&&def===player)beetleArc(att);if(att.base.stingChain)jellyChain(att,def);if(att.base.aquatic){att._surfT=turn;if(def===player&&eelWater(att.x,att.y))applyStatus(player,'wet',3);}}
  if(att!==player&&att.base&&landed&&def.hp>0){var b=att.base;
    if(b.bleeds&&rng()<b.bleeds)inflictBleed(def,att);
    if(b.fangs&&dist(att,def)<=1&&rng()<b.fangs){applyStatus(def,'poison',DRIDER.poison[0],sDMG(DRIDER.poison[1]));floatText(def.x,def.y,'poisoned','poison');if(def===player)log('The <b>Drider</b>\'s fangs sink in: you are poisoned.','c-you');}
    if(b.emberBite&&rng()<b.emberBite&&!(def.st&&def.st.burn)){applyStatus(def,'burn',3,sDMG(2+Math.floor(floorNo/5)));if(def===player)log('The <b>Ember Spider</b>\'s bite sets you <span class="c-fire">burning</span>.','c-you');}}
  if(event.dark&&landed){player.syllaDark=0;log('<b>Into the Dark.</b> You come out of the black: +'+Math.round(SYLLA.darkPerRank*event.dark*100)+'% on the strike.','c-good');}
  if(!landed)return;
  if(att===player&&syllaOn()){var gr=godRank();if(gr>0&&def.hp>0&&rng()<SYLLA.webChance*gr)syllaWeb(def,gr);if(H&&H.surprise)gainPiety(event.wasHidden?SYLLA.pietyUnseen:SYLLA.pietySurprise);}
  if(att.broodling&&def!==player&&def.hp>0)broodBite(def);
}
function resolveSpellStrike(f,A,amount,type,options){
  options=options||{};if(!f||f.hp<=0)return null;
  return gameActions.run('spell',player,f,options,function(event){
    var view=event.view=Object.assign({},player),numb=numbingDark(f),opening=offGuard(f)||player.hidden>0||numb;
    var unaware=opening||f.st&&(f.st.stun||f.st.frozen);
    var crit=combatRoll((f.sapped?1:view.crit+actionCritBonus(view))+actionRootCrit(f,view)+(unaware&&player.aff.shadow?.05*player.aff.shadow:0),true);
    var base=FoteActions.spellDamage(amount,{bolt:!!options.bolt,numbing:numb,crit:crit,criticalMultiplier:actionCritMultiplier(view),lightUndead:A.el==='light'&&(f.base.undead||f.base.shadowy)});
    event.hit={att:player,def:f,crit:crit,surprise:!!(options.bolt?unaware:opening),spell:true,actionId:event.actionId,view:view};
    LAST_HIT=event.hit;event.ability=A;
    if(!options.bolt){if(f.state!=='hunt'&&f.state!=='throne')f.state='hunt';f.caughtOff=-1;}
    event.damage=applyDamage(f,base,type,player,{hit:event.hit,ability:A,actionId:event.actionId,tags:[options.bolt||A.kind==='bolt'?'single-target':'area','spell']});
    f.lastHitBy=player;event.landed=event.damage>0;
    if(!options.bolt||!A.tech&&!A.divine)spellOnHit(f,event.damage,crit,A);
    if(!options.bolt){floatText(f.x,f.y,String(event.damage),type,crit);if(event.damage>0)playerHitRewards(f,A.kind==='bolt'&&A!==BONE_SPEAR);}
  });
}
function spellHit(f,A,amount,type){var event=resolveSpellStrike(f,A,amount,type);return event?event.damage:0;}
function spellOnHit(f,d,crit,A){applySpellOffhandEffects(f,d,crit,A);applySpellWeaponEnchant(f,d,crit,A);}

function resolveWeaponStrike(event){
  var roll=rollWeaponHit(event);if(!roll)return;
  rollWeaponDamage(event,roll);
  var damage=resolveWeaponDamage(event,roll);
  presentWeaponDamage(event,roll,damage);
}
function rollWeaponHit(event){
  var att=event.source,def=event.target,mult=event.multiplier,label=event.label,view=event.view;
  mult = mult || 1;
  LAST_HIT=null;
  if(!def || def.hp<=0) return;
  if(def===player && dist(att,def)>1 && deflectProjectile())return;
  if(att.ally && def.x!==att.x) att.facingLeft=def.x<att.x;
  var ranged = (att.base && att.base.range>1 && dist(att,def)>1) || (att===player && ((view.weapon&&view.weapon.range)||1)>1 && dist(att,def)>1);
  var ch=hitChance(att===player?view.acc:accOf(att), evaOf(def) * (att===player && hasP('keenAim') ? 0.75 : 1));
  if(att===player){player.lastAttack=true;player.lastAttackMelee=!((view.weapon&&view.weapon.range||1)>1 && !player._reaching);}
  if(att===player && ((view.weapon&&view.weapon.range)||1)>1 && dist(att,def)<=1) ch *= 0.7;
  if(att.st && att.st.blind) ch *= 0.6;
  if(def===player && typeof luckBonus==='function') ch -= luckBonus();   /* Lady Luck's Blessing: blows slide off */
  if(def.st && (def.st.frozen || def.st.stun)) ch = 1;
  /* 2026-09-20: Justin - "surprise attacks shouldn't miss". Striking something that has not noticed you always
     lands: the same rule frozen and stunned targets already had. */
  if(att===player && def!==player && (typeof offGuard==='function' && offGuard(def) || (player.hidden>0||event.numbing) || def.surprised)) ch = 1;
  if(att===player && event.options.sureHit) ch = 1;
  var who = att===player ? 'You' : att.name;
  var foe = def===player ? 'you' : def.name;
  var tAt = fxClock;
  if(att===player) setClip(player, ranged ? 'ranged' : 'melee');
  else setClip(att, 'attack');
  var tSwing = Math.max(performance.now(), fxClock);   /* the release or swing frame, after the clip's windup */
  if(ranged){ boltFx(att.x,att.y,def.x,def.y,'phys',{arrow:true,silentHit:true}); sfx('bow-shot',{at:tSwing}); }
  else { lungeFx(att, def.x, def.y); if(att===player || !att.base.sfx)sfx('swing',{at:tSwing}); }
  if(!ranged && att!==player && att.base.sfx) sfx(att.base.sfx+'-attack',{at:tSwing});
  if(def===player && att.foe) ch=hostileHitChance(ch);
  if(def.shadowClone&&def.cloneStats){
    var echoDefense=def.cloneStats;
    if(ranged&&rng()<echoDefense.deflect||dist(att,def)<=1&&rng()<echoDefense.parry){floatText(def.x,def.y,'deflected','miss');return;}
    ch-=echoDefense.luck||0;if(echoDefense.blur)ch=Math.max(.15,ch*.8);
  }
  if(def===player && player.parry && dist(att,def)<=1 && combatRoll(player.parry,true)){
    log('You parry '+att.name+'.','c-good'); sfx('parry'); floatText(def.x,def.y,'parry','miss');
    if(att.hp>0){ log('Riposte!','c-good'); attack(player, att, 0.5, 'Riposte'); }
    return;
  }
  var blocked = def.shadowClone&&def.cloneStats?rng()<def.cloneStats.block:(def===player && player.block && combatRoll(player.block,true));
  if(att===player ? !combatRoll(ch,true) : def===player ? combatRoll(1-ch,true) : rng()>ch){
    log(who+' miss'+(att===player?'':'es')+' '+foe+' <span class="roll">('+Math.round(ch*100)+'% to hit)</span>','c-miss');
    floatText(def.x, def.y, 'miss', 'miss'); sfx('miss'); if(att===player && def.state!=='hunt' && def.state!=='throne') def.state='hunt'; if(att===player) def.caughtOff=-1; return;
  }
  return {ranged:ranged,ch:ch,blocked:blocked,who:who,foe:foe};
}
function rollWeaponDamage(event,strike){
  var att=event.source,def=event.target,mult=event.multiplier,label=event.label,view=event.view;
  var ranged=strike.ranged,ch=strike.ch,blocked=strike.blocked;
  var dr = att===player ? view.dmg : (att.dmg || att.base.dmg);
  var base = roll(dr[0], dr[1]) * mult;
  var surprise=false, crit=false;
  if(att===player){
    var melee = !ranged;
    /* two pools: gear bonuses add together, stat + ability bonuses add together, then the pools multiply */
    /* 2026-09-17: Might is 4% per point above 10, mirroring Focus's 4% spell damage. It covers every weapon
       attack, bows included - drawing a heavy bow is strength, not nimbleness. Spells stay with Focus. */
    var gearPool = 0, statPool = 0.04*(player.stats.mig-10);
    if(view.weapon.executioner && def.hp <= def.maxhp/2) gearPool += view.weapon.executioner;
    if(melee && hasP('heavyHands')) statPool += 0.10;
    if(melee && hasP('unstoppable')) statPool += 0.20;
    if(melee && buff('rampage')) statPool += 0.40*actionDivine(view);
    if(hasP('crushing') && def.hp < def.maxhp/2) statPool += 0.25;
    if(def.challenged && hasGod('reginald')) statPool += 0.25*actionDivine(view);
    if(hasGod('reginald') && godRank()>=5) statPool += 0.10*Math.min(3, Math.max(0, adjacentFoes()-1));   /* Wall of One */
    if(buff('rally')) statPool += 0.10;
    if(melee && capstone('grumbok') && player.spellbreakUntil>player.t){base*=1+.5*actionDivine(view);player.spellbreakUntil=0;log('<b>Spellbreaker!</b>','c-good');}
    if(hasGod('glimmer') && (def.base.undead||def.base.shadowy)) statPool += 0.10*godRank();
    if(hasGod('reginald') && (def.elite||def.base.elite||def.base.boss)) statPool += 0.10*godRank();
    base *= Math.max(0.1, 1+gearPool) * Math.max(0.1, 1+statPool);
    /* 2026-09-20: this read player.range, which rangedslot.js sets to the BOW's reach whenever one is
       slung - so merely carrying a bow cut every adjacent sword swing to 60% damage. Ask the weapon in
       hand, the same way the hit-chance line above was fixed on 2026-09-17. */
    if(((view.weapon && view.weapon.range)||1)>1 && dist(att,def)<=1) base *= 0.6;
    var pummelHit=view.weapon.unarmed && player.pummel>0;
    if(pummelHit){base*=1+actionDivine(view);player.pummel--;}
    var unaware = offGuard(def) || def.st.stun || def.st.frozen || (player.hidden>0||event.numbing) || (typeof smokeAmbush==='function' && smokeAmbush(def)) || def.surprised;
    var critCh = (def.sapped?1:view.crit+actionCritBonus(view)) + actionRootCrit(def,view) + (unaware && player.aff.shadow ? 0.05*player.aff.shadow : 0);
    crit = combatRoll(critCh,true);
    if(unaware){ surprise=true; base *= isScoundrel() ? 2.0 : 1.5; if(view.weapon.name.indexOf('Dagger')>=0) base*=1.2;
      /* 2026-09-22 (Justin): no piety for surprise attacks at all - his followers simply cannot sneak (stealthScore), and
         his only foul is Shadow (gods.js, forge.js). */ }
  } else {
    crit = !(def===player && hasP('bulwark')||def.shadowClone&&def.cloneStats.passives.bulwark) && rng() < 0.05;
  }
  if(crit){base *= att===player?actionCritMultiplier(view):1.6;}
  if(att===player&&pummelHit&&def.hp>0)applyStatus(def,'stun',1);
  if(blocked){ if(typeof onShieldBlock==='function') onShieldBlock(att, def, base); base *= 0.25; }
  /* Fortitude resolves after mitigation in applyDamage. */
  event.hit={att:att,def:def,crit:crit,surprise:surprise,melee:!ranged,actionId:event.actionId,view:view};
  LAST_HIT=event.hit;
  strike.base=base;strike.crit=crit;strike.surprise=surprise;
}
function resolveWeaponDamage(event,strike){
  var att=event.source,def=event.target,mult=event.multiplier,label=event.label,view=event.view;
  var ranged=strike.ranged,ch=strike.ch,blocked=strike.blocked;
  var base=strike.base,crit=strike.crit,surprise=strike.surprise;
  var phys=applyDamage(def,base,att.swarm?'dark':'phys',att,{hit:event.hit,attackRolled:true,actionId:event.actionId,tags:['attack',ranged?'ranged':'melee']}),extra=0,applied=0,note='',el=null;
  sfx(hitSfx(att,def,crit,blocked), {at:def._hit});
  if(att===player){
    var ench = view.weapon.enchant;
    if(ench){
      /* The same authored enchant magnitudes drive weapon and spell procs. */
      var values=enchantValues('weapon',ench);
      var roll1 = function(c){ return (typeof pRoll==='function' ? pRoll(c) : rng()<c); };
      el=ench;
      if(ench==='fire'){ extra+=Math.round(base*values.extraDamage); if(roll1(values.burnChance)){ applyStatus(def,'burn',values.burnDuration,burnDmg()); note=' <span class="c-fire">burning</span>'; } }
      if(ench==='water' && roll1(values.chillChance)){ addChill(def); note=' chilled'; }
      if(ench==='earth' && roll1(values.rootChance)){ applyStatus(def,'root',values.rootDuration); note=' rooted'; }
      if(ench==='light' && (def.base.undead||def.base.shadowy)) extra+=Math.round(base*values.extraDamage);
      if(ench==='shadow'){ if(def.st.hollow) extra+=values.hollowDamage;
        if(roll1(values.procChance)){
          extra+=Math.round(base*values.extraDamage); applyStatus(def,'corrupt',values.corruptDuration); note=' <span style="color:#B58BFF">corrupted</span>';
          /* the enchant's bite IS this build's dark damage, so at Shadow 6 it is what stacks Hollow.
             Spells stack it through the applyDamage wrapper in elements.js; this is the melee half. */
          if(typeof aff==='function' && aff('shadow')>=6) addHollow(def, 1);
        } }
      if(ench==='air' && roll1(values.repeatChance) && !label && def.hp>0){ note=' (gust: extra attack)'; event.pendingExtra=def; }
    }
    if(player.aff.fire){ el = el || 'fire'; extra += player.aff.fire; }
    if(player.aff.light && rng() < 0.10*player.aff.light + (typeof smiteBonus==='function' ? smiteBonus() : 0)){
      var sm=applyDamage(def,smiteDamage(),'light',player,{attackRolled:true,actionId:event.actionId,tags:['proc','smite']}); applied+=sm; el = el || 'light';
      /* the light-air combo fires a second smite, so count it before the log line is written: what the
         note reports is the whole smite, not just the first half of it (2026-09-18) */
      if(typeof onSmiteProc==='function'){ var sm2=onSmiteProc(def)||0; applied+=sm2; sm+=sm2; }
      /* Light 6 Consecration used to fire off light SPELLS only, which made it the one rank 6 capstone a
         melee build could not use - and Light 6 is the one most likely to be reached by a melee build,
         since Glimmer's free Light point (religion.js) gets a normal race there a biome early. The smite
         sanctifies the ground it strikes now, so the capstone answers a swing as well as a spell. */
      if(typeof holyG!=='undefined' && holyG && typeof aff==='function' && aff('light')>=6 && inb(def.x,def.y))
        holyG[idxOf(def.x,def.y)]=3;
      note+=' <span style="color:#FFF1B8">smite '+sm+'</span>';
      if(rng()<0.10*player.aff.light) applyStatus(def,'blind',2); sparkleFx(def.x,def.y,'light',10);
    }
    if(player.aff.shadow && def.hp>0) addHollow(def, 0);
    if(view.weapon.unarmed && hasGod('grom') && def.hp>0 && rng() < (buff('ironbody')?0.3*actionDivine(view):0) + (godRank()>=3?0.15:0)){ applyStatus(def,'stun',1); note+=' staggered'; }
    if(extra>0)dealDirectDamage(def,Math.round(extra*(el?resistMult(def,el):1)),el||'phys',player,{tags:['proc','enchant'],actionId:event.actionId,resistanceApplied:!!el});
  }
  if(att!==player && att.base && att.base.el){
    el = att.base.el;
    var add = Math.max(1, Math.round(base*0.50*resistMult(def, elemToType(el))));   /* 2026-09-23 (Justin): half the blow as its element, past armour */
    if(rng() < 0.22){
      if(el==='fire'){ applyStatus(def,'burn',3,sDMG(2)); note=' <span class="c-fire">burning</span>'; }
      else if(el==='water'){ addChill(def); note=' chilled'; }
      else if(el==='earth'){ applyStatus(def,'root',2); note=' rooted'; }
      else if(el==='shadow'){ applyStatus(def,'fear',2); note=' shaken'; }
      else if(el==='air'){ applyStatus(def,'stun',1); note=' stunned'; }
      else if(el==='light'){ applyStatus(def,'blind',2); note=' dazzled'; }
    }
    dealDirectDamage(def,add,elemToType(el),att,{tags:['proc','elemental-attack'],actionId:event.actionId,resistanceApplied:true});extra=add;
  }
  if(att.lifesteal && att.ally){ att.hp=Math.min(att.maxhp, att.hp+Math.round(phys*0.3)); }
  return {phys:phys,extra:extra,applied:applied,note:note,element:el};
}
function presentWeaponDamage(event,strike,damage){
  var att=event.source,def=event.target,mult=event.multiplier,label=event.label,view=event.view;
  var ranged=strike.ranged,ch=strike.ch,blocked=strike.blocked;
  var base=strike.base,crit=strike.crit,surprise=strike.surprise;
  var phys=damage.phys,extra=damage.extra,applied=damage.applied,note=damage.note,el=damage.element,who=strike.who,foe=strike.foe;
  var total=phys+extra+applied;event.damage=total;event.landed=total>0;
  var bonus=extra+applied;
  var elTxt = bonus>0 ? ' <span class="c-fire">+'+bonus+(el?' '+el:'')+'</span>' : '';
  floatText(def.x, def.y, String(total), bonus>0 && el ? elemToType(el) : 'phys', crit);
  log((label?label+': ':'')+who+' hit '+foe+' <span class="roll">('+Math.round(ch*100)+'%'
      +(crit?', crit':'')+(surprise?', surprise':'')+(blocked?', blocked':'')+')</span> &mdash; <b>'+total+'</b>'+elTxt+note,
      att===player?'c-hit':'c-you');
  if(def!==player && def.state!=='hunt' && def.state!=='throne') def.state='hunt';
  if(def!==player) def.caughtOff=-1;   /* the surprise is spent: it knows now */
  if(def!==player && def.living && rng()<0.3) setG(def.x,def.y,G_BLOOD);
  if(att===player && total>0){ if(crit)orbOnCritical(def,view); playerHitRewards(def,true); }
  if(def.hp<=0){ kill(def, att); }
  if(att===player && hasP('cleaving') && !label){   /* 2026-09-22 audit: the swing carries on through a killing blow too */
    var other=ents.filter(function(o){ return o.foe && o!==def && dist(player,o)<=1; })[0];
    if(other){ log('Your swing carries into '+other.name+'.','c-info'); attack(player,other,.5,'Cleave',{weapon:view.weapon,offhand:!!event.options.offhand,tags:['proc']}); }
  }
  if(att===player && event.pendingExtra && event.pendingExtra===def && def.hp>0){ event.pendingExtra=null; attack(player,def,1,'Gust',{weapon:view.weapon,offhand:!!event.options.offhand,tags:['proc']}); }
  event.pendingExtra=null;
}
