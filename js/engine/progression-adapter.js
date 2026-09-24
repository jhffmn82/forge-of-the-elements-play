/* One owner for devotion, level rewards and permanent undead servants. */
function totalAffinity(){
  var total=0;for(var key in player.aff)total+=player.aff[key]||0;
  return total-(player.glimmerLight?1:0);
}
function syncGlimmerLight(options){
  if(!player)return false;
  var want=player.god==='glimmer'&&godRank()>=5,changed=false;
  if(want&&!player.glimmerLight){grantGlimmerLight();changed=!!player.glimmerLight;}
  else if(!want&&player.glimmerLight){takeGlimmerLight();changed=true;}
  if(changed&&!(options&&options.deferStats)){derive(player);updateUI();}
  return changed;
}
function joinGod(id,startPiety){
  if(clericGodLocked(id))return false;
  var previous=player.god;
  if(previous==='glimmer'&&id!=='glimmer')takeGlimmerLight();
  if(previous&&previous!==id){
    log('<b>'+GODS[previous].name+'</b> feels betrayed. Their wrath follows you for a while.','c-you');
    player.wrath={god:previous,t:60};sfx('wrath');
  }
  player.god=id;player.piety=startPiety||0;player.favor=Math.min(100,Math.round((startPiety||0)/2));player.amusement=50;
  player.lastRank=godRank();if(id!=='sylla')player.syllaDark=0;
  syncGlimmerLight({deferStats:true});derive(player);player.hotbar=null;updateUI();
}
function gainPiety(amount,why,options){
  var before=godRank(),god=GODS[player.god];
  if(god&&amount>0){
    var context={race:player.race,cls:player.cls,lovedRace:god.loves,biome:bidx()};
    player.piety=(player.piety||0)+FoteProgression.piety(amount,context);
    // Divine power may change at this new rank; favor uses that updated value.
    if(!(options&&options.pietyOnly))player.favor=Math.min(100,(player.favor||0)+FoteProgression.favor(amount,Object.assign({},context,{divine:divineStrength()})));
    var after=godRank();
    if(after>before){
      log('<b>'+god.name+' is pleased.</b> Piety rank '+after+'.','c-kill');sfx('piety-rank');ringFx(player.x,player.y,god.color,3);
      var index=godBoonRanks(god).indexOf(after),boon=index>=0?god.boons[index]:null;if(boon)log('Boon: '+boon,'c-good');
      (god.prayers||[]).forEach(function(key){var prayer=PRAYERS[key];if(prayer.rank===after)log('New prayer: <b>'+prayer.name+'</b> &mdash; '+prayer.desc+' (Faith tab or P)','c-kill');});
    }
  }
  var lightChanged=syncGlimmerLight({deferStats:true});
  if((godRank()>before||lightChanged)&&!(options&&options.deferStats)){derive(player);updateUI();}
}
function pietyViolation(what,amount){
  var previous=player.god,god=GODS[previous],abandoned=false;
  if(god&&!god.chaos){
    player.piety=Math.max(0,(player.piety||0)-amount);player.favor=0;player.violations=(player.violations||0)+1;
    log('<b>'+god.name+'</b> disapproves of '+what+'. (&minus;'+amount+' piety)','c-you');sfx('wrath');
    if(player.violations>=6&&player.piety<=0){
      log('<b>'+god.name+' turns away from you.</b>','c-you');player.wrath={god:previous,t:80};
      player.god=null;player.piety=0;player.favor=0;player.violations=0;abandoned=true;
    }
  }
  if(previous==='glimmer'&&player.god!=='glimmer')takeGlimmerLight();
  var lightChanged=syncGlimmerLight({deferStats:true});
  if(abandoned||lightChanged){derive(player);updateUI();}
}
function godOnKill(entity,source){
  if(!entity||entity.noXp||entity.noReward||entity.ally)return;
  var base=entity.base||{},status=entity.st||{};
  var reward=FoteProgression.killReward({god:player.god,rank:godRank(),foe:entity.foe,
    big:entity.elite||base.elite||base.boss,playerKill:source===player,taggedPlayerKill:source==='player',allyKill:!!(source&&source.ally),
    servant:!!(source&&source.undeadServant),unarmed:!!(player.weapon&&player.weapon.unarmed),
    spellcaster:base.spellcaster,element:base.el,undead:base.undead,shadowy:base.shadowy,
    awake:entity.state!=='asleep',castThisTurn:player.castTurn===turn,
    held:effectHasTag(entity,'root')||effectHasTag(entity,'slow')||status.poison||entity.syllaWeb>0,
    syllaKill:SYLLA.pietyKill,syllaBig:SYLLA.pietyBig});
  if(reward.piety>0)gainPiety(reward.piety);
  if(reward.healingRanks)healPlayer(Math.round(reward.healingRanks*divineStrength()));
}
function levelStatPoints(character,level){return FoteProgression.statPoints(character,level);}
function gainXP(amount){
  player.xpNext=xpToNext(player.level);var gained=FoteProgression.experience(amount,player.cls);
  player.xp+=gained;floatText(player.x,player.y,'+'+gained+' xp','xp');
  if(player.level>=20){player.xp=Math.min(player.xp,player.xpNext-1);return;}
  while(player.xp>=player.xpNext&&player.level<20){
    player.xp-=player.xpNext;player.level++;player.points+=levelStatPoints(player,player.level);player.xpNext=xpToNext(player.level);
    var old=player.maxhp;derive(player);player.hp+=player.maxhp-old;player.mp=player.maxmp;
    log('<b>Level '+player.level+'.</b> Stat point'+(player.points>1?'s':'')+' to spend in the Character sheet.','c-kill');
    sfx('level-up');sparkleFx(player.x,player.y,'light',40);ringFx(player.x,player.y,'#E8B44A',2.5);
  }
}
function castRaiseDead(x,y,ability,options){
  if(!walkable(x,y)||occupied(x,y)){log('The dead need an empty patch of floor.','c-info');return false;}
  aiming=null;
  if(options&&options.noMana){player._actualSpellCost=0;player.castingSpell=true;}
  else spendSpellMana(ability);
  setClip(player,'cast');
  var rank=godRank(),form=UNDEAD_FORMS.filter(function(entry){return entry.rank<=rank;}).pop()||UNDEAD_FORMS[0];
  var boost=(1+.10*rank)*divineStrength(),servant=spawn('skeleton',x,y);
  servant.foe=false;servant.ally=true;servant.undeadServant=true;servant.state='ally';servant.name=form.name;servant.col='#BFD8B0';
  servant.maxhp=servant.hp=Math.round((form.hp+2*player.level)*boost);
  servant.dmg=[Math.round((form.dmg[0]+Math.floor(player.level/3))*boost),Math.round((form.dmg[1]+Math.floor(player.level/3))*boost)];
  servant.life=undefined;servant.taunt=!!form.taunt;servant.lifesteal=!!form.lifesteal;servant.big=form.taunt;servant.castSpell=form.caster||null;servant.castCd=0;
  if(form.sprite)servant.base=Object.assign({},servant.base,{sprite:form.sprite,name:form.name,art:form.art||servant.base.art});
  log('Mother Murk answers. A <b>'+form.name+'</b> claws its way up out of the floor.','c-good');sfx('summon');sparkleFx(x,y,'dark',24);
  endTurn();return true;
}
function prayRaiseDead(){
  if(floorMeta.pendingLich){log('Your Lich is returning.','c-info');return false;}
  if(!canPray('raisedead')){log('You cannot offer that prayer right now.','c-info');sfx('ui-error');return false;}
  if(ents.some(function(entity){return entity.ally&&entity.undeadServant;})){log('Your servant still stands.','c-info');return false;}
  var cell=nearFree(player.x,player.y,1)||nearFree(player.x,player.y,2);
  if(!cell||!walkable(cell.x,cell.y)||occupied(cell.x,cell.y)){log('There is no room for the dead to rise.','c-info');return false;}
  player.favor-=PRAYERS.raisedead.favor;sfx('pray');ringFx(player.x,player.y,GODS.murk.color,2.5);
  var result=castRaiseDead(cell.x,cell.y,ABILITIES.raisedead,{noMana:true});
  ents.forEach(function(entity){if(entity.ally&&entity.undeadServant&&entity.t<player.t-200)entity.t=player.t;});
  return result;
}
