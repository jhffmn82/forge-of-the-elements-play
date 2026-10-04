/* One command owner for ability selection, self casts and target validation. */
var SELF_CASTS={
"ironbody":function(A,r,div){ player.buffs.ironbody=divineDuration(12); derive(player); log('Iron Body active.','c-good'); sfx('earth-cast'); sparkleFx(player.x,player.y,'earth',20); },
"bellow":function(A,r,div){  sfx('warchief-roar');
    ents.forEach(function(e){ if(e.foe && dist(e,player)<=3) applyStatus(e,'stun',1); });
    var h=Math.round(player.maxhp*(.10+.02*r)*div),before=player.hp; healPlayer(h); ringFx(player.x,player.y,'#B8453A',3.5);
    log('Bellow: +'+Math.round(player.hp-before)+' HP; Stun within 3 tiles.','c-good'); },
"heal":function(A,r,div){
    var prior=player.hp,bonus=(1+.10*r)*(typeof inSanctuary==='function'&&inSanctuary(player)?1+.25*holyGroundStrength(player):1);
    var raw=Math.round(player.maxhp*(.10+.02*r)*div);
    healPlayer(Math.min(raw,player.maxhp*.4/bonus));
    var hh=Math.round(player.hp-prior);
    sparkleFx(player.x,player.y,'heal',30);sfx('heal');
    log('Heal: +'+hh+' HP.','c-good');
  },
"temper":function(A,r,div){ setResolvedBuffTimer('b:temper',fullDivineDuration(12)); derive(player); log('Temper: '+player.weapon.name+'.','c-good'); sfx('forge-enchant'); sparkleFx(player.x,player.y,'fire',20); },
"rolldice":function(A,r,div){WOBBLE_BONUS=0;try{ sfx('wobbles-giggle'); wobblesIntervention(false); }finally{WOBBLE_BONUS=0;}},
"unholyaura":function(A,r,div){


    player.st.aura={t:divineDuration(8), d:Math.round(4*godRank()*div)};
    sparkleFx(player.x,player.y,'dark',40); sfx('shadow-cast');
    log('Unholy Aura active.','c-good');
    return true;
  },
"intothedark":function(A,r,div){


    player.hidden = Math.max(player.hidden||0, divineDuration(SYLLA.darkTurns));
    ents.forEach(function(e){ if(e.foe && e.state==='hunt'){ e.state='wander'; e.lastSeen=null; } });
    player.syllaDark = r;player.castingSpell=false;
    sfx('vanish'); sparkleFx(player.x, player.y, 'dark', 30); ringFx(player.x, player.y, GODS.sylla.color, 2.5);
    log('Into the Dark: Hidden '+player.hidden+' turns'+
        (r ? '; next hit +'+Math.round(SYLLA.darkPerRank*r*div*100)+'%' : '')+'.','c-good');
    return true;
  }
};
function castSelf(key,A){
  var action=SELF_CASTS[key];if(!action)return false;
  if(A.divine){spendSpellMana(A);startInvokeCd(key);setClip(player,key==='bellow'?'melee':'cast');}
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

  } else if(A.kind==='storm'){
    player.stormUntil=player.t+100*fullDivineDuration(6);
    sparkleFx(player.x,player.y,'lightning',40); ringFx(player.x,player.y,'#E8D27A',2.5);
    log('Storm Form: double speed.','c-good');
    updateUI(); draw(); return;   /* instant: no time passes */
  } else if(A.kind==='dawn'){
    var n=0,tiles=[],damage=Math.round(sDMG(roll(A.base[0],A.base[1]))*spellPower(A));
    var prior=AOE_HIT;AOE_HIT=true;
    try{ents.slice().forEach(function(e){if(e.foe&&e.hp>0&&vis[idxOf(e.x,e.y)]){spellHit(e,A,damage,'light');if(e.hp>0)applyStatus(e,'blind',3);tiles.push([e.x,e.y]);finishHit(e);n++;}});}finally{AOE_HIT=prior;}
    markGround(tiles,A);
    player.dawnUntil=turn+20;
    sparkleFx(player.x,player.y,'light',60); ringFx(player.x,player.y,'#F6E7B0',5);
    log('Dawn: enemies revealed.','c-good');
  }
  endTurn();
}
function useShadowstep(){
  if(cdLeft('shadowstep')>0){log('Shadowstep: ready in '+cdLeft('shadowstep')+' turns.','c-info');sfx('ui-error');return;}
  if(ents.some(function(e){return e.foe&&dist(e,player)<=1;})){log('Enemy adjacent.','c-info');sfx('ui-error');return;}
  startDivineCd('shadowstep',ABILITIES.shadowstep.cd);stackDiscipline();player.hidden=4;
  ents.forEach(function(e){if(e.foe&&e.state==='hunt'){e.state='wander';e.lastSeen=null;e.goal=null;}});
  setClip(player,'cast');sfx('vanish');sparkleFx(player.x,player.y,'dark',18);log('Shadowstep: hidden.','c-good');endTurn();
}
function useAbility(i){
  if(gameTurns.busy())return false;
  var key=player.abilities[i],A=ABILITIES[key];if(!A)return;
  if(playerFearAction())return false;
  var forbidden=spellForbidden(A);
  if(forbidden){if(aiming&&aiming.i===i)cancelAim();log(GODS[player.god].name+' forbids '+A.name+'.','c-info');sfx('ui-error');return;}
  if(aiming&&!aiming.amulet&&aiming.i===i&&aiming.auto){var target=autoAimLive(),point=target&&autoAimPoint(target);if(point)castAt(point.x,point.y);else cancelAim();return;}
  if(key==='shadowstep')return useShadowstep();
  if(A.kind==='lunge'&&(effectHasTag(player,'root')||gameEffects.has(player,'frozen'))){log('Cannot Lunge while held.','c-info');sfx('ui-error');return false;}
  if(key==='charge'){
    if(cdLeft(key)>0){log('Charge: ready in '+cdLeft(key)+' turns.','c-info');sfx('ui-error');return;}
    if(effectHasTag(player,'root')||gameEffects.has(player,'frozen')){log('Cannot charge while held.','c-info');sfx('ui-error');return;}
  }
  if((A.divine||A.cd)&&cdLeft(key)>0){log(A.name+': ready in '+cdLeft(key)+' turns.','c-info');sfx('ui-error');return;}   /* an invoke's cooldown (DIVINE_COOLDOWNS), or Sap's own */
  if(A.kind!=='charge'&&player.mp<costOf(A)){log(A.name+': needs '+costOf(A)+' Mana.','c-info');sfx('no-mana');return;}
  if(A.kind==='summon'&&ents.some(function(e){return e.ally&&e.undeadServant;})){log('Your servant still stands.','c-info');return;}
  if(A.kind==='charge'||AIM_KINDS[A.kind]||['bolt','dash','summon','lunge'].includes(A.kind)){
    if(aiming&&aiming.i===i){cancelAim();return;}
    aiming={i:i,A:A};
    abilityBar();draw();if(AUTO_AIM_KINDS[A.kind])autoAimPick();
    if(!aiming.auto)log(A.name+': '+(key==='charge'?'straight path, '+A.range+' tiles':A.kind==='umbral'?'choose explored ground':A.kind==='tomb'?'choose a creature or yourself':'choose a target')+(typeof uiUsesTouchInput==='function'&&uiUsesTouchInput()?'.':'. Esc cancels.'),'c-info');
    return;
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
  var range=aiming.prayer?A.range:A.kind==='lunge'?FoteActions.lunge().range:A.kind==='charge'?ABILITIES.charge.range:A.kind==='upheaval'?A.range:A.kind==='dash'?3:spellRange(A);
  return dist(player,{x:x,y:y})<=range&&(revealAll||vis[idxOf(x,y)]);
}

function resolveTargetedCast(x,y,selection){
  if(selection.amulet)return castAmuletTarget(x,y);
  var prayer={lance:castReginaldLance,bonespear:castBoneSpear,arcaneblink:castArcaneBlink}[selection.prayer];
  if(prayer)return prayer(x,y);
  if(selection.A.kind==='lunge')return castLungeTarget(x,y);
  if(AIM_KINDS[selection.A.kind])return castElementTarget(x,y);
  if(selection.A.kind==='charge')return castChargeTarget(x,y);
  return castBoltTarget(x,y);
}
function castAt(x,y){
  if(gameTurns.busy())return false;
  var selection=aiming;if(!selection)return false;
  if(playerFearAction())return false;
  var A=selection.A;
  if(selection.prayer==='arcaneblink'&&(!canPray('arcaneblink')||!arcaneBlinkDestination(x,y))){log('Blink: choose visible, empty ground within '+arcaneBlinkRules().range+' tiles.','c-info');return false;}
  if(!selection.amulet&&!selection.prayer){
    var forbidden=spellForbidden(A);
    if(forbidden){log(GODS[player.god].name+' forbids '+A.name+'.','c-info');sfx('ui-error');return false;}
    if(A.kind!=='charge'&&player.mp<costOf(A)){log(A.name+': needs '+costOf(A)+' Mana.','c-info');sfx('no-mana');return false;}
    if(A.kind==='charge'&&(effectHasTag(player,'root')||gameEffects.has(player,'frozen'))){log('Cannot charge while held.','c-info');sfx('ui-error');return false;}
    if(A.kind==='lunge'&&(effectHasTag(player,'root')||gameEffects.has(player,'frozen'))){log('Cannot Lunge while held.','c-info');sfx('ui-error');return false;}
  }
  var before=turn,tiles=effectFootprint(A,x,y),event=gameActions.run('cast',player,foeAt(x,y),{ability:A},function(context){
    player.noisy=true;context.result=resolveTargetedCast(x,y,selection);
  });
  if(turn!==before)afterTurn(function(){puzzleSpellTiles(A,tiles);if(tiles.length>1)floorMeta.lastCastTiles={tiles:tiles,until:performance.now()+650};});
  return event.result;
}

/* Sheets and damage resolution read exactly the same spell-power calculation. */
function spellPower(){
  return FoteStats.powers(player,statContent()).spell;
}
