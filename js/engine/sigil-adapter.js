/* Sigils share validation and completion; each effect has one implementation. */
var SIGIL_CASTS={
"transmutation":function(context){return transmutationPicker(context);},
"firestorm":function(context){var use=context.use,F=floorNo,bountySpots=context.spots;
burst(player.x,player.y,'fire',60,0.12); ents.slice().forEach(function(e){ if(e.foe && dist(player,e)<=3){ var fd=applyDamage(e,8+floorNo,'fire',player); floatText(e.x,e.y,String(fd),'fire'); applyStatus(e,'burn',3,sDMG(2)); if(e.hp<=0) kill(e,player); } });
    for(var dy=-2;dy<=2;dy++) for(var dx=-2;dx<=2;dx++) if(dx||dy) ignite(player.x+dx,player.y+dy,'player'); log('Flames burst out around you.','c-fire');
},
"mana":function(context){var use=context.use,F=floorNo,bountySpots=context.spots;
var m=Math.round(player.maxmp*0.5); player.mp=Math.min(player.maxmp,player.mp+m); floatText(player.x,player.y,'+'+m,'ice'); log('Cool water fills your mind. +'+m+' mana.','c-good');
player.buffs.manaflow=Math.max(player.buffs.manaflow||0,20);
},
"levitate":function(context){var use=context.use,F=floorNo,bountySpots=context.spots;
player.levitate=25; log('You float a hand\'s width off the floor. (25 turns)','c-good'); sparkleFx(player.x,player.y,'lightning',20);
},
"stoneskin":function(context){var use=context.use,F=floorNo,bountySpots=context.spots;
applyStatus(player,'stone',15); log('Your skin turns to stone.','c-good');
},
"heal":function(context){var use=context.use,F=floorNo,bountySpots=context.spots;
healPlayer(Math.round(player.maxhp*.35));player.buffs.afterglow=15;sparkleFx(player.x,player.y,'heal',30);
},
"vanish":function(context){var use=context.use,F=floorNo,bountySpots=context.spots;
player.hidden=5; ents.forEach(function(e){ if(e.foe && e.state==='hunt'){ e.state='wander'; e.lastSeen=null; } }); log('Shadows swallow you.','c-good'); sfx('vanish');
},
"identify":function(context){var use=context.use,F=floorNo,bountySpots=context.spots;
Object.keys(SIGILS).forEach(function(k){ if(player.bag.some(function(b){ return b.kind==='sigil' && b.data.use===k; })) identifySigil(k); });
knowPicker(context);
},
"mapping":function(context){var use=context.use,F=floorNo,bountySpots=context.spots;
for(var i=0;i<seen.length;i++) if(map[i]!==WALL || true) seen[i]=1; log('The shape of the whole floor settles into your mind.','c-good');
},
"blink":function(context){var use=context.use,F=floorNo,bountySpots=context.spots;
var spots=[]; for(var y=0;y<MH;y++) for(var x=0;x<MW;x++) if(walkable(x,y) && vis[idxOf(x,y)] && dist(player,{x:x,y:y})<=6 && dist(player,{x:x,y:y})>=3 && !occupied(x,y)) spots.push({x:x,y:y});
    if(spots.length){ var s2=pick(spots); sparkleFx(player.x,player.y,'magic',20); player.x=s2.x; player.y=s2.y; player._lx=undefined; sparkleFx(s2.x,s2.y,'magic',20); log('You blink away.','c-good'); }
},
"naturesbounty":function(context){var use=context.use,F=floorNo,bountySpots=context.spots;
['honeycake','skewer','moontart'].forEach(function(food,i){var spot=bountySpots[i];items.push({kind:'food',food:food,x:spot.x,y:spot.y});sparkleFx(spot.x,spot.y,'heal',12);});
    log('Nature’s Bounty provides a Honeycake, Mushroom Skewer, and Moonberry Tart.','c-good');
},
"firestorm2":function(context){var use=context.use,F=floorNo,bountySpots=context.spots;
burst(player.x,player.y,'fire',90,0.14); visibleFoes(4).forEach(function(e){ hurt(e, 14+F, 'fire'); if(e.hp>0) applyStatus(e,'burn',4,sDMG(3)); });
    for(var dy=-3;dy<=3;dy++) for(var dx=-3;dx<=3;dx++) if(dx||dy) ignite(player.x+dx,player.y+dy,'player'); log('A firestorm roars out around you.','c-fire');
},
"identify2":function(context){var use=context.use,F=floorNo,bountySpots=context.spots;
Object.keys(SIGILS).forEach(function(k){ identifySigilQuiet(k); });
    var list=wornGear().concat(player.bag.filter(function(b){ return b.data && b.data.unid; }).map(function(b){ return b.data; }));
    var n=0; list.forEach(function(it){ if(identifyGear(it, true)) n++; }); refreshBagNames();
    douseAround(5); log('Clear water runs over everything you own. You know every sigil'+(n?' and '+n+' piece'+(n>1?'s':'')+' of gear':'')+'.','c-kill');
},
"levitate2":function(context){var use=context.use,F=floorNo,bountySpots=context.spots;
player.levitate=Math.max(player.levitate||0,60); player.buffs.haste=10; derive(player); log('You rise on the wind, light and quick.','c-good'); sparkleFx(player.x,player.y,'lightning',30);
},
"stoneskin2":function(context){var use=context.use,F=floorNo,bountySpots=context.spots;
applyStatus(player,'stone',30); giveWard(player.maxhp*0.2, 30); log('Your skin hardens to granite.','c-good');
},
"heal2":function(context){var use=context.use,F=floorNo,bountySpots=context.spots;
player.hp=player.maxhp;cleanseAll();sparkleFx(player.x,player.y,'heal',30);
},
"vanish2":function(context){var use=context.use,F=floorNo,bountySpots=context.spots;
player.hidden=5; ents.forEach(function(e){ if(e.foe && e.state==='hunt'){ e.state='wander'; e.lastSeen=null; } }); log('You fold into the shadows.','c-good');
},
"cinder":function(context){var use=context.use,F=floorNo,bountySpots=context.spots;
player.buffs.cinder=10; derive(player); player._cinderAt={x:player.x,y:player.y}; log('Your feet catch fire. Run.','c-fire');
},
"magma":function(context){var use=context.use,F=floorNo,bountySpots=context.spots;
for(var my=-2;my<=2;my++) for(var mx=-2;mx<=2;mx++){ var tx=player.x+mx, ty=player.y+my; if((mx||my) && inb(tx,ty) && walkable(tx,ty)) fireT[idxOf(tx,ty)]=Math.max(fireT[idxOf(tx,ty)],5); }
    ents.forEach(function(e){ if(e.foe && dist(e,player)<=2) applyStatus(e,'burn',3,sDMG(2)); }); log('The floor around you melts into a ring of fire.','c-fire');
},
"smoke":function(context){var use=context.use,F=floorNo,bountySpots=context.spots;
raiseSmoke();
},
"rot":function(context){var use=context.use,F=floorNo,bountySpots=context.spots;
rotPicker(context);
},
"sunburst":function(context){var use=context.use,F=floorNo,bountySpots=context.spots;
ringFx(player.x,player.y,'#FFF1CC',5); visibleFoes().forEach(function(e){ hurt(e, 6+F, 'light'); if(e.hp>0) applyStatus(e,'blind',3); }); log('A blinding sun flares from your hand.','c-good');
},
"storm":function(context){var use=context.use,F=floorNo,bountySpots=context.spots;
var foes=visibleFoes().sort(function(a,b){ return dist(player,a)-dist(player,b); });
    foes.slice(0,3).forEach(function(e){ var wet=isWet(e); hurt(e, Math.round((10+F)*(wet?1.5:1)), 'lightning'); if(e.hp>0 && rng()<0.5) applyStatus(e,'stun',1); burst(e.x,e.y,'lightning',16,0.06); });
    foes.forEach(function(e){ if(e.hp>0){ e.st.wet={t:5}; } }); log('Thunder cracks and rain hammers down.','c-good');
},
"mire":function(context){var use=context.use,F=floorNo,bountySpots=context.spots;
ents.forEach(function(e){ if(e.foe && dist(e,player)<=3){ applyStatus(e,'root',3); e.st.wet={t:6}; burst(e.x,e.y,'earth',8,0.04); } }); log('The ground turns to sucking mud.','c-good');
},
"purify":function(context){var use=context.use,F=floorNo,bountySpots=context.spots;
cleanseAll(); var ph=Math.round(player.maxhp*0.2); { healPlayer(ph); floatText(player.x,player.y,'+'+ph,'heal'); }
    var broke=0; wornGear().forEach(function(it){ if(breakCurse(it)) broke++; }); log('Clear water washes over you'+(broke?' and your gear':'')+'.','c-good');
},
"recall":function(context){var use=context.use,F=floorNo,bountySpots=context.spots;
var g2=null; for(var j=0;j<map.length;j++){ if(map[j]===STAIRS || (map[j]===EXIT && floorMeta.exitOpen)){ g2={x:j%MW, y:(j/MW)|0}; break; } }
    var land=(!occupied(g2.x,g2.y) && walkable(g2.x,g2.y)) ? g2 : nearFree(g2.x,g2.y,2);
    if(land){ sparkleFx(player.x,player.y,'lightning',20); player.x=land.x; player.y=land.y; player._lx=undefined; seen[idxOf(g2.x,g2.y)]=1; sparkleFx(player.x,player.y,'lightning',20); computeFOV(); log('The wind lifts you and sets you down by the way onward.','c-good'); }
},
"aegis":function(context){var use=context.use,F=floorNo,bountySpots=context.spots;
giveWard(player.maxhp*0.5, 15); applyStatus(player,'stone',15); ringFx(player.x,player.y,'#F6E7B0',2.5); log('A shining aegis settles around you ('+player.ward+').','c-good');
},
"wisdom":function(context){var use=context.use,F=floorNo,bountySpots=context.spots;
var progress=player.xp,need=(typeof xpToNext==='function' ? xpToNext(player.level) : player.xpNext);player.xp=0;gainXP(player.cls==='tourist'?Math.ceil(need/1.25):need);player.xp=progress; log('Understanding floods in.','c-kill');
},
"ascension":function(context){var use=context.use,F=floorNo,bountySpots=context.spots;
sigilUpgradePicker(context);
}
};
function prepareSigil(use){
  if(!SIGILS[use]||!SIGIL_CASTS[use])return null;
  if(sigilConduct(use)===false)return null;
  var context={use:use,echo:!!player._echoing};
  if(use==='naturesbounty'){context.spots=natureBountySpots();if(context.spots.length<3){log('Nature’s Bounty needs three empty spaces on nearby ground.','c-info');return null;}}
  if(use==='ascension'&&!allUpgradeTargets().some(function(o){return upgradeCost(o.it)!==null;})){log('Nothing you carry can be raised any higher.','c-info');return null;}
  if(use==='wisdom'&&player.level>=20){log('Your wisdom can no longer grow. This sigil would do nothing.','c-info');return null;}
  if(use==='rot'&&!wornGear().some(function(it){return it.cursed;})){log('Nothing you wear is cursed. The sigil stays quiet.','c-info');return null;}
  if(use==='recall'){
    var goal=null;for(var i=0;i<map.length;i++)if(map[i]===STAIRS||(map[i]===EXIT&&floorMeta.exitOpen)){goal={x:i%MW,y:(i/MW)|0};break;}
    if(!goal){log('There is nowhere to be carried to.','c-info');return null;}
  }
  return context;
}
function resolveSigilPuzzles(use){
  if(use==='heal'||use==='heal2'){(floorMeta.puzzles||[]).forEach(function(room){if(room.puzzle.kind==='darktraps'&&!room.puzzle.solved&&nearRoom(room,2))solvePuzzle(room,'light reveals every trap.');});return;}
  if(use==='identify') douseAround(3);
  var solveAs = use==='identify2' ? 'identify' : use;   /* the Water sigil+ works on water puzzles too */
  (floorMeta.puzzles||[]).forEach(function(room){
    var k=room.puzzle.kind; if(room.puzzle.solved || PUZZLE_KINDS[k].sigil!==solveAs) return;
    if(k==='everburn' && floorMeta.everburn && dist(player, floorMeta.everburn)<=3) solvePuzzle(room, 'the undying flame gutters out.');
    else if(k==='barricade' && dist(player, room.puzzle.door)<=2) solvePuzzle(room, 'the barricade goes up in flames.');
    else if(k==='hoard' && nearRoom(room, 1)) solvePuzzle(room, 'the ice runs away as water.');
    else if(k==='darktraps' && nearRoom(room, 2)) solvePuzzle(room, 'light floods the room and shows every trap.');
    else if(k==='baths' && nearRoom(room, 2)){ room.cooledUntil=turn+10; log('<b>Scalding baths:</b> the stone cools for 10 turns.','c-kill'); sfx('ice-melt'); }
  });}
function useSigil(use,options){
  if(gameTurns.busy()||playerFearAction())return false;
  var context=prepareSigil(use);if(!context)return false;
  if(use==='transmutation')return SIGIL_CASTS[use](Object.assign(context,options||{}));
  return gameActions.run('sigil',player,null,{sigil:use},function(event){
    sfx('sigil-use');setClip(player,'cast');
    SIGIL_CASTS[use](context);identifySigil(use);
    if(!player._echoing)player.lastSigil=use;
    resolveSigilPuzzles(use);updateUI();event.result=true;
  }).result;
}
