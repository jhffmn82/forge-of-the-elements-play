/* Sigils share validation and completion; each effect has one implementation. */
function resolveUncommonRewards(kind,p){
  var loot=[];
  if(kind==='funeral-bell')loot=[{kind:'sigil',use:'transmutation'},{kind:'essence',n:50}];
  if(kind==='crystal-resonance'){player.mp=player.maxmp;loot=[{kind:'mote',el:pick(ELEMENTS)}];}
  if(kind==='silk-survivor'){
    var foods=Object.keys(FOODS).filter(function(k){return FOODS[k].buff&&(FOODS[k].biome===undefined||FOODS[k].biome===3);});
    var first=pick(foods),second=pick(foods.filter(function(k){return k!==first;}));
    loot=[{kind:'food',food:first},{kind:'food',food:second},{kind:'sigil',use:'mapping'}];
  }
  loot.forEach(function(it){var c=nearFree(p.x,p.y,2)||{x:player.x,y:player.y};it.x=c.x;it.y=c.y;items.push(it);});
  log(kind==='portcullis-cache'?'The portcullis rises. Two brutes and a shaman guard the cache.':kind==='funeral-bell'?'The funeral bell rings. Three acolytes answer; an offering appears.':kind==='crystal-resonance'?'The crystal refills your Mana and releases a mote. Its resonance draws nearby enemies.':'The traveler leaves two special foods and a mapping sigil. Spiderlings flood the room! Escort him to the upstairs for a ring or amulet.','c-info');
}
function sigilBuffNotice(key,label,style){
  var hero=player,run=RUN;
  // The reader starts its paid turn after this effect returns. Read the timer
  // after that turn's Holy preparation and world pulses have both completed.
  Promise.resolve().then(function(){afterTurn(function(){
    if(player!==hero||RUN!==run||hero.hp<=0||run.over||run.victory)return;
    var remaining=key==='hidden'?hero.hidden:hero.buffs[key];
    if(remaining>0)log(label+': '+remaining+' turns.',style);
  });});
}
var SIGIL_CASTS={
"transmutation":function(context){return transmutationPicker(context);},
"firestorm":function(context){var use=context.use,F=floorNo,bountySpots=context.spots;
burst(player.x,player.y,'fire',60,0.12); ents.slice().forEach(function(e){ if(e.foe && dist(player,e)<=3){ var fd=applyDamage(e,8+floorNo,'fire',player); floatText(e.x,e.y,String(fd),'fire'); applyStatus(e,'burn',3,sDMG(2)); if(e.hp<=0) kill(e,player); } });
    for(var dy=-2;dy<=2;dy++) for(var dx=-2;dx<=2;dx++) if(dx||dy) ignite(player.x+dx,player.y+dy,'player'); log('Firestorm: ground ignited.','c-fire');
},
"mana":function(context){var use=context.use,F=floorNo,bountySpots=context.spots;
var before=player.mp,m=Math.round(player.maxmp*0.5);player.mp=Math.min(player.maxmp,player.mp+m);var restored=Number((player.mp-before).toFixed(1));if(restored>0)floatText(player.x,player.y,'+'+restored,'ice');log('Deep Well: +'+restored+' Mana.','c-good');
player.buffs.manaflow=Math.max(player.buffs.manaflow||0,20);
},
"levitate":function(context){var use=context.use,F=floorNo,bountySpots=context.spots;
player.levitate=Math.max(player.levitate||0,25); gameEffects.clear(player,'root'); gameEffects.clear(player,'web'); log('Floating; roots and webs cleared.','c-good'); sparkleFx(player.x,player.y,'lightning',20);
},
"stoneskin":function(context){var use=context.use,F=floorNo,bountySpots=context.spots;
applyStatus(player,'stone',15); log('Stone Skin; Poison and Stun cleared.','c-good');
},
"heal":function(context){var use=context.use,F=floorNo,bountySpots=context.spots;
healPlayer(Math.round(player.maxhp*.35));player.buffs.afterglow=15;sparkleFx(player.x,player.y,'heal',30);
},
"vanish":function(context){var use=context.use,F=floorNo,bountySpots=context.spots;
player.hidden=5; ents.forEach(function(e){ if(e.foe && e.state==='hunt'){ e.state='wander'; e.lastSeen=null; } }); sigilBuffNotice('hidden','Hidden','c-good'); sfx('vanish');
},
"identify":function(context){var use=context.use,F=floorNo,bountySpots=context.spots;
Object.keys(SIGILS).forEach(function(k){ if(player.bag.some(function(b){ return b.kind==='sigil' && b.data.use===k; })) identifySigil(k); });
knowPicker(context);
},
"mapping":function(context){var use=context.use,F=floorNo,bountySpots=context.spots;
for(var i=0;i<seen.length;i++) if(map[i]!==WALL || true) seen[i]=1; log('Floor map revealed.','c-good');
},
"blink":function(context){var use=context.use,F=floorNo,bountySpots=context.spots;
var spots=[]; for(var y=0;y<MH;y++) for(var x=0;x<MW;x++) if(walkable(x,y) && vis[idxOf(x,y)] && dist(player,{x:x,y:y})<=6 && dist(player,{x:x,y:y})>=3 && !occupied(x,y)) spots.push({x:x,y:y});
    if(spots.length){ var s2=pick(spots); sparkleFx(player.x,player.y,'magic',20); player.x=s2.x; player.y=s2.y; player._lx=undefined; sparkleFx(s2.x,s2.y,'magic',20); log('You blink away.','c-good'); }
},
"naturesbounty":function(context){var use=context.use,F=floorNo,bountySpots=context.spots;
['honeycake','skewer','moontart'].forEach(function(food,i){var spot=bountySpots[i];items.push({kind:'food',food:food,x:spot.x,y:spot.y});sparkleFx(spot.x,spot.y,'heal',12);});
    log("Nature's Bounty: Honeycake, Mushroom Skewer, Moonberry Tart.",'c-good');
},
"firestorm2":function(context){var use=context.use,F=floorNo,bountySpots=context.spots;
burst(player.x,player.y,'fire',90,0.14); visibleFoes(4).forEach(function(e){ hurt(e, 14+F, 'fire'); if(e.hp>0) applyStatus(e,'burn',4,sDMG(3)); });
    for(var dy=-3;dy<=3;dy++) for(var dx=-3;dx<=3;dx++) if(dx||dy) ignite(player.x+dx,player.y+dy,'player'); log('Firestorm: ground ignited.','c-fire');
},
"identify2":function(context){var use=context.use,F=floorNo,bountySpots=context.spots;
Object.keys(SIGILS).forEach(function(k){ identifySigilQuiet(k); });
    var list=wornGear().concat(player.bag.filter(function(b){ return b.data && b.data.unid; }).map(function(b){ return b.data; }));
    var n=0; list.forEach(function(it){ if(identifyGear(it, true)) n++; }); refreshBagNames();
    douseAround(5); log('All sigils identified'+(n?'; '+n+' gear identified':'')+'.','c-kill');
},
"levitate2":function(context){var use=context.use,F=floorNo,bountySpots=context.spots;
player.levitate=Math.max(player.levitate||0,60); gameEffects.clear(player,'root'); gameEffects.clear(player,'web'); player.buffs.haste=Math.max(player.buffs.haste||0,10); derive(player); log('Floating, Haste; roots and webs cleared.','c-good'); sparkleFx(player.x,player.y,'lightning',30);
},
"haste":function(context){
player.buffs.haste=Math.max(player.buffs.haste||0,20);derive(player);
sigilBuffNotice('haste','Haste','c-good');sparkleFx(player.x,player.y,'lightning',24);
},
"stoneskin2":function(context){var use=context.use,F=floorNo,bountySpots=context.spots;
applyStatus(player,'stone',30); giveWard(player.maxhp*0.2, 30); log('Stone Skin, shield; Poison and Stun cleared.','c-good');
},
"heal2":function(context){var use=context.use,F=floorNo,bountySpots=context.spots;
restoreActorHealth(player,player);cleanseAll();sparkleFx(player.x,player.y,'heal',30);
},
"vanish2":function(context){var use=context.use,F=floorNo,bountySpots=context.spots;
player.hidden=5; ents.forEach(function(e){ if(e.foe && e.state==='hunt'){ e.state='wander'; e.lastSeen=null; } }); sigilBuffNotice('hidden','Hidden','c-good');
},
"cinder":function(context){var use=context.use,F=floorNo,bountySpots=context.spots;
player.buffs.cinder=10; derive(player); player._cinderAt={x:player.x,y:player.y}; log('Cinder Stride: +50% speed; leave burning ground.','c-fire');
},
"magma":function(context){var use=context.use,F=floorNo,bountySpots=context.spots;
player.buffs.moltenring=Math.max(player.buffs.moltenring||0,5);
for(var my=-2;my<=2;my++) for(var mx=-2;mx<=2;mx++){ var tx=player.x+mx, ty=player.y+my; if((mx||my) && inb(tx,ty) && walkable(tx,ty)) fireT[idxOf(tx,ty)]=Math.max(fireT[idxOf(tx,ty)],5); }
    ents.forEach(function(e){ if(e.foe && dist(e,player)<=2) applyStatus(e,'burn',3,sDMG(2)); }); sigilBuffNotice('moltenring','Molten Ring','c-fire');
},
"smoke":function(context){var use=context.use,F=floorNo,bountySpots=context.spots;
raiseSmoke();
},
"rot":function(context){var use=context.use,F=floorNo,bountySpots=context.spots;
rotPicker(context);
},
"sunburst":function(context){var use=context.use,F=floorNo,bountySpots=context.spots;
ringFx(player.x,player.y,'#FFF1CC',5); visibleFoes().forEach(function(e){ hurt(e, 6+F, 'light'); if(e.hp>0) applyStatus(e,'blind',3); }); log('Sunburst: enemies Blinded.','c-good');
},
"storm":function(context){var use=context.use,F=floorNo,bountySpots=context.spots;
var foes=visibleFoes().sort(function(a,b){ return dist(player,a)-dist(player,b); });
    foes.slice(0,3).forEach(function(e){ var wet=isWet(e); hurt(e, Math.round((10+F)*(wet?1.5:1)), 'lightning'); if(e.hp>0 && rng()<0.5) applyStatus(e,'stun',1); burst(e.x,e.y,'lightning',16,0.06); });
    foes.forEach(function(e){ if(e.hp>0){ e.st.wet={t:5}; } }); log('Tempest: enemies Wet.','c-good');
},
"mire":function(context){var use=context.use,F=floorNo,bountySpots=context.spots;
ents.forEach(function(e){ if(e.foe && dist(e,player)<=3){ applyStatus(e,'root',3); e.st.wet={t:6}; burst(e.x,e.y,'earth',8,0.04); } }); log('Quagmire: enemies Rooted, Wet.','c-good');
},
"purify":function(context){var use=context.use,F=floorNo,bountySpots=context.spots;
cleanseAll(); healPlayer(Math.round(player.maxhp*0.2));
    var broke=0; wornGear().forEach(function(it){ if(breakCurse(it)) broke++; }); log('Cleansed'+(broke?'; '+broke+' curse'+(broke===1?'':'s')+' removed':'')+'.','c-good');
},
"recall":function(context){var use=context.use,F=floorNo,bountySpots=context.spots;
var g2=null; for(var j=0;j<map.length;j++){ if(map[j]===STAIRS || (map[j]===EXIT && floorMeta.exitOpen)){ g2={x:j%MW, y:(j/MW)|0}; break; } }
    var land=(!occupied(g2.x,g2.y) && walkable(g2.x,g2.y)) ? g2 : nearFree(g2.x,g2.y,2);
    if(land){ sparkleFx(player.x,player.y,'lightning',20); player.x=land.x; player.y=land.y; player._lx=undefined; seen[idxOf(g2.x,g2.y)]=1; sparkleFx(player.x,player.y,'lightning',20); computeFOV(); log('Returned to the exit.','c-good'); }
},
"aegis":function(context){var use=context.use,F=floorNo,bountySpots=context.spots;
giveWard(player.maxhp*0.5, 15); applyStatus(player,'stone',15); ringFx(player.x,player.y,'#F6E7B0',2.5); log('Aegis: '+player.ward+' ward.','c-good');
},
"wisdom":function(context){var use=context.use,F=floorNo,bountySpots=context.spots;
var progress=player.xp,need=(typeof xpToNext==='function' ? xpToNext(player.level) : player.xpNext);player.xp=0;gainXP(player.cls==='tourist'?Math.ceil(need/1.25):need);player.xp=progress; log('Level gained.','c-kill');
},
"ascension":function(context){var use=context.use,F=floorNo,bountySpots=context.spots;
sigilUpgradePicker(context);
}
};
function prepareSigil(use){
  if(!SIGILS[use]||!SIGIL_CASTS[use])return null;
  if(sigilConduct(use)===false)return null;
  var context={use:use,echo:!!player._echoing};
  if(use==='naturesbounty'){context.spots=natureBountySpots();if(context.spots.length<3){log('Nature\'s Bounty needs 3 empty tiles nearby.','c-info');return null;}}
  if(use==='ascension'&&!allUpgradeTargets().some(function(o){return upgradeCost(o.it)!==null;})){log('No gear can be upgraded.','c-info');return null;}
  if(use==='wisdom'&&player.level>=20){log('Already at maximum level.','c-info');return null;}
  if(use==='rot'&&!wornGear().some(FoteInventory.curseBinds)){log('No equipped item has a known curse.','c-info');return null;}
  if(use==='recall'){
    var goal=null;for(var i=0;i<map.length;i++)if(map[i]===STAIRS||(map[i]===EXIT&&floorMeta.exitOpen)){goal={x:i%MW,y:(i/MW)|0};break;}
    if(!goal){log('No exit available.','c-info');return null;}
  }
  return context;
}
function resolveSigilPuzzles(use){
  if(use==='heal'||use==='heal2'){(floorMeta.puzzles||[]).forEach(function(room){if(room.puzzle.kind==='darktraps'&&!room.puzzle.solved&&nearRoom(room,2))solvePuzzle(room,'light reveals every trap.');});return;}
  if(use==='identify') douseAround(3);
  var solveAs = use==='identify2' ? 'identify' : use;   /* the Greater Sigil of Knowledge works on water puzzles too */
  (floorMeta.puzzles||[]).forEach(function(room){
    if(room.puzzle.kind==='poisonvault'&&!room.puzzle.solved&&(use==='firestorm'||use==='firestorm2')&&nearRoom(room,use==='firestorm2'?2:1)){solvePuzzle(room,'the fire burns away the poison gas.');return;}
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
