/* One command owner for ability selection, self casts and target validation. */
var SELF_CASTS={
"ironbody":function(A,r,div){ player.buffs.ironbody=divineDuration(12); derive(player); log('Iron Body: your skin turns hard as iron.','c-good'); sfx('earth-cast'); sparkleFx(player.x,player.y,'earth',20); },
"bellow":function(A,r,div){  sfx('warchief-roar');
    ents.forEach(function(e){ if(e.foe && dist(e,player)<=3) applyStatus(e,'stun',1); });
    var h=Math.round(player.maxhp*(.10+.02*r)*div); healPlayer(h); floatText(player.x,player.y,'+'+h,'heal'); ringFx(player.x,player.y,'#B8453A',3.5);
    log('You bellow. Everything nearby reels.','c-good'); },
"heal":function(A,r,div){
    var prior=player.hp,bonus=typeof inSanctuary==='function'&&inSanctuary(player)?1+.25*divineStrength():1;
    var raw=Math.round(player.maxhp*(.10+.02*r)*div*(1+.10*r));
    healPlayer(Math.min(raw,player.maxhp*.4/bonus));
    var hh=Math.round(player.hp-prior);
    floatText(player.x,player.y,'+'+hh,'heal');sparkleFx(player.x,player.y,'heal',30);sfx('heal');
    log('Saint Glimmer mends you. +'+hh+' HP.','c-good');
  },
"arcaneward":function(A,r,div){ player.buffs.communion=8; player.buffs.arcaneward=8; player.ward=Math.round((8+2*r)*div); sfx('cast-generic'); ringFx(player.x,player.y,'#7FA8FF',2); },
"temper":function(A,r,div){ player.buffs.temper=fullDivineDuration(12);player._buffSeen=player._buffSeen||{};player._buffSeen['b:temper']=player.buffs.temper; derive(player); log('Old Anvil tempers your '+player.weapon.name+': +2 for 12 turns.','c-good'); sfx('forge-enchant'); sparkleFx(player.x,player.y,'fire',20); },
"rolldice":function(A,r,div){WOBBLE_BONUS=0;try{ sfx('wobbles-giggle'); wobblesIntervention(false); }finally{WOBBLE_BONUS=0;}},
"unholyaura":function(A,r,div){


    player.st.aura={t:divineDuration(8), d:Math.round(4*godRank()*div)};
    sparkleFx(player.x,player.y,'dark',40); sfx('shadow-cast');
    log('An unholy aura seeps from you ('+player.st.aura.d+' a turn).','c-good');
    return true;
  },
"intothedark":function(A,r,div){


    player.hidden = Math.max(player.hidden||0, divineDuration(SYLLA.darkTurns));
    ents.forEach(function(e){ if(e.foe && e.state==='hunt'){ e.state='wander'; e.lastSeen=null; } });
    player.syllaDark = r;player.castingSpell=false;
    sfx('vanish'); sparkleFx(player.x, player.y, 'dark', 30); ringFx(player.x, player.y, GODS.sylla.color, 2.5);
    log('<b>Into the Dark.</b> The dark closes over you for '+SYLLA.darkTurns+' turns; nothing can keep your trail. Your next strike comes out of it'+
        (r ? ' (+'+Math.round(SYLLA.darkPerRank*r*100)+'%)' : '')+'.','c-good');
    return true;
  }
};
function castSelf(key,A){
  var action=SELF_CASTS[key];if(!action)return false;
  if(A.divine){spendSpellMana(A);setClip(player,key==='bellow'?'melee':'cast');}
  return action(A,godRank(),divineStrength())!==false;
}
function castElementSelf(A){
  return gameActions.run('cast',player,null,{ability:A},function(event){event.result=resolveElementSelf(A);}).result;
}
function resolveElementSelf(A){  beginCast(A);
  if(A.kind==='quake'){
    SHAKE=10; var tiles=[];
    for(var y=player.y-A.radius;y<=player.y+A.radius;y++) for(var x=player.x-A.radius;x<=player.x+A.radius;x++){ if(!inb(x,y)) continue; tiles.push([x,y]); burst(x,y,'earth',3,0.04); }
    var dmg=spellRoll(A);
    ents.slice().forEach(function(e){ if(e===player || e.hp<=0 || dist(e,player)>A.radius) return;
      if(e.foe){ spellHit(e, A, dmg, 'phys'); finishHit(e); }
      else if(e.ally){ var ad=applyDamage(e, dmg, 'phys', player); floatText(e.x,e.y,String(ad),'phys'); if(e.hp<=0) kill(e,null); } });
    markGround(tiles, A);
    log('<b>Earthquake.</b> The ground heaves.','c-hit');
  } else if(A.kind==='storm'){
    player.stormUntil=player.t+600;
    sparkleFx(player.x,player.y,'lightning',40); ringFx(player.x,player.y,'#E8D27A',2.5);
    log('<b>Storm Form.</b> The world slows around you.','c-good');
    updateUI(); draw(); return;   /* instant: no time passes */
  } else if(A.kind==='dawn'){
    var n=0;
    ents.forEach(function(e){ if(e.foe && vis[idxOf(e.x,e.y)]){ applyStatus(e,'blind',3); n++; } });
    player.dawnUntil=turn+20;
    sparkleFx(player.x,player.y,'light',60); ringFx(player.x,player.y,'#F6E7B0',5);
    log('<b>Dawn.</b> '+n+' enem'+(n===1?'y is':'ies are')+' blinded, and nothing on this floor can hide from you.','c-good');
  }
  endTurn();
}
function useShadowstep(){
  if(cdLeft('shadowstep')>0){log('Shadowstep is not ready ('+cdLeft('shadowstep')+' turns).','c-info');sfx('ui-error');return;}
  if(ents.some(function(e){return e.foe&&dist(e,player)<=1;})){log('Not with an enemy right next to you.','c-info');sfx('ui-error');return;}
  player.cds=player.cds||{};player.cds.shadowstep=turn+ABILITIES.shadowstep.cd;player.hidden=4;
  ents.forEach(function(e){if(e.foe&&e.state==='hunt'){e.state='wander';e.lastSeen=null;e.goal=null;}});
  setClip(player,'cast');sfx('vanish');sparkleFx(player.x,player.y,'dark',18);log('You <b>Shadowstep</b> into hiding.','c-good');endTurn();
}
function useAbility(i){
  if(gameTurns.busy())return false;
  var key=player.abilities[i],A=ABILITIES[key];if(!A)return;
  if(playerFearAction())return false;
  var forbidden=spellForbidden(A);
  if(forbidden){if(aiming&&aiming.i===i)cancelAim();log('<b>'+GODS[player.god].name+'</b> forbids '+forbidden+'. '+A.name+' will not come to you.','c-info');sfx('ui-error');return;}
  if(aiming&&!aiming.amulet&&aiming.i===i&&aiming.auto){var target=autoAimLive(),point=target&&autoAimPoint(target);if(point)castAt(point.x,point.y);else cancelAim();return;}
  if(key==='shadowstep')return useShadowstep();
  if(key==='charge'){
    if(cdLeft(key)>0){log('Charge is not ready ('+cdLeft(key)+' turns).','c-info');sfx('ui-error');return;}
    if(effectHasTag(player,'root')||gameEffects.has(player,'frozen')){log('You cannot charge while held fast.','c-info');sfx('ui-error');return;}
  }
  if(A.kind!=='charge'&&player.mp<costOf(A)){log('Not enough mana for '+A.name+' ('+costOf(A)+').','c-info');sfx('no-mana');return;}
  if(A.kind==='summon'&&ents.some(function(e){return e.ally&&e.undeadServant;})){log('Your servant still stands.','c-info');return;}
  if(A.kind==='charge'||AIM_KINDS[A.kind]||['bolt','dash','summon'].includes(A.kind)){
    if(aiming&&aiming.i===i){cancelAim();return;}
    aiming={i:i,A:A};
    if(key==='charge')log('<b>Charge</b> &mdash; click an enemy, or open ground, within 5 tiles in a straight line; Esc cancels.','c-info');
    else log('<b>'+A.name+'</b> &mdash; '+(A.kind==='umbral'?'click any tile you have seen':A.kind==='tomb'?'click an enemy, or yourself':'click a target within '+spellRange(A)+' tiles')+', or press Esc.','c-info');
    abilityBar();draw();if(AUTO_AIM_KINDS[A.kind])autoAimPick();return;
  }
  if(['quake','storm','dawn'].includes(A.kind))return castElementSelf(A);
  if(A.kind==='melee2'){
    var foe=nearestFoe(1);if(!foe){log('Nothing adjacent to strike.','c-info');return;}
    spendSpellMana(A);attack(player,foe,1,A.name);if(foe.hp>0)attack(player,foe,1,A.name);endTurn();return;
  }
  if(A.kind==='self'){if(castSelf(key,A)===false)return;if(key==='temper'){updateUI();return;}if(A.instant)FREE_ACTION=true;endTurn();}
}
function inRange(x,y){
  if(!aiming||!inb(x,y))return false;
  var A=aiming.A;if(A.kind==='umbral')return !!seen[idxOf(x,y)];
  var range=A.kind==='charge'?ABILITIES.charge.range:A.kind==='upheaval'?7:A.kind==='dash'?3:spellRange(A);
  return dist(player,{x:x,y:y})<=range&&(revealAll||vis[idxOf(x,y)]);
}

function resolveTargetedCast(x,y,selection){
  if(selection.amulet)return castAmuletTarget(x,y);
  var prayer={lance:castReginaldLance,bonespear:castBoneSpear,arcanelance:castArcaneLance,arcanenova:castArcaneNova}[selection.prayer];
  if(prayer)return prayer(x,y);
  if(AIM_KINDS[selection.A.kind])return castElementTarget(x,y);
  if(selection.A.kind==='charge')return castChargeTarget(x,y);
  return castBoltTarget(x,y);
}
function castAt(x,y){
  if(gameTurns.busy())return false;
  var selection=aiming;if(!selection)return false;
  if(playerFearAction())return false;
  var A=selection.A;
  if(!selection.amulet&&!selection.prayer){
    var forbidden=spellForbidden(A);
    if(forbidden){log('<b>'+GODS[player.god].name+'</b> forbids '+forbidden+'. '+A.name+' will not come to you.','c-info');sfx('ui-error');return false;}
    if(A.kind!=='charge'&&player.mp<costOf(A)){log('Not enough mana for '+A.name+' ('+costOf(A)+').','c-info');sfx('no-mana');return false;}
    if(A.kind==='charge'&&(effectHasTag(player,'root')||gameEffects.has(player,'frozen'))){log('You cannot charge while held fast.','c-info');sfx('ui-error');return false;}
  }
  var before=turn,tiles=effectFootprint(A,x,y),event=gameActions.run('cast',player,foeAt(x,y),{ability:A},function(context){
    player.noisy=true;context.result=resolveTargetedCast(x,y,selection);
  });
  if(turn!==before)afterTurn(function(){puzzleSpellTiles(A,tiles);if(tiles.length>1)floorMeta.lastCastTiles={tiles:tiles,until:performance.now()+650};});
  return event.result;
}

/* Sheets and damage resolution read exactly the same spell-power calculation. */
function spellPower(){
  var character=.04*(player.stats.foc-10)+(hasP('arcaneStudy')?.10:0)+(hasP('archmage')?.10:0);
  var gear=focusBonus(player.weapon)+(player.twoHanded?0:focusBonus(player.off));
  var power=Math.max(.3,1+character)*(1+gear)*(1+Math.max(-.5,ringVal('wizardry')*2/3));
  if(infusion('tome')==='fire')power*=1+enchantValues('tome','fire').spellPower;
  var armor=player.armorItem;
  if(armor&&itemKey(armor)==='robe'&&!armor.cursed)power*=Math.max(.1,1+gear+robeSpell(armor)*gearPassiveBonus())/Math.max(.1,1+gear);
  return power*(buff('rally')?1.1:1);
}
