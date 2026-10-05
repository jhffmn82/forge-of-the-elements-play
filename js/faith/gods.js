/* ============================================================================
   gods.js - shrines, swearing to a god, piety and favor, conduct, prayers,
   wrath, and Wobbles' interventions.
   Piety sets your rank and only rises by earning; favor is what prayers spend
   (earned alongside piety, capped at 100). See docs/design/game-design.md 6.5.
   ========================================================================== */

/* 2026-09-20: most gods unlock boons at 1 / 3 / 5, with the third boon doubling as the rank-5 reward.
   Sylla and Saint Glimmer have three boons AND a rank-5 reward, so they carry their own table on the god
   (g.boonRanks). Everyone else still reads BOON_RANKS. */
function godBoonRanks(g){ return (g && g.boonRanks) || BOON_RANKS; }

function clericGodLocked(id){ return player.cls==='cleric' && !!player.god && player.god!==id; }


/* 2026-09-23 (Justin): a spell of the element your god forbids will not come at all: no mana, no piety, no turn.
   The outermost useAbility (balance-rulings.js) asks this before anything is spent; Sylla adds Fire in sylla.js. */
function spellForbidden(A){if(!A)return null;if(player.god==='grumbok'&&!A.tech&&!A.divine)return 'spells';return forbiddenElement(A.el)?cap(A.el):null;}
function sigilConduct(use){var S=SIGILS[use];if(player.god==='grumbok'||S&&(S.motes||[]).some(forbiddenElement))return refuseDivine();return true;}
/* Old Anvil has no kills to count: what he wants is essence, so every 5 spent anywhere - a Forge upgrade,
   an enchantment, a toll, an offering - is a point of piety. Measured against the 3,900 essence lying on
   floors 1-20 (plus what recycling pays), a smith who spends what he finds reaches rank 5 in biome 4,
   the same as every other devoted follower. (2026-09-17) */
function spendEssence(n,options){
  n=Math.max(0, Math.round(n||0));
  player.essence -= n;
  if(player.god==='anvil' && n>0){
    player.essenceSpent=(player.essenceSpent||0)+n;
    while(player.essenceSpent>=5){ player.essenceSpent-=5; gainPiety(1,undefined,options); }
  }
}

function godTick(seesFoe){
  if(player.wrath){
    player.wrath.t--;
    if(rng()<0.02){ var w=GODS[player.wrath.god]; log('The wrath of <b>'+w.name+'</b> finds you.','c-you'); sfx('wrath');
      var dmg=Math.max(1,Math.round(player.maxhp*0.08)); player.hp=Math.max(1,player.hp-dmg); floatText(player.x,player.y,String(dmg),'dark'); applyStatus(player, pick(['blind','chill','root']), 3); }
    if(player.wrath.t<=0){ log('The wrath of '+GODS[player.wrath.god].name+' passes.','c-info'); player.wrath=null; }
  }
  if(player.blessed>0){ player.blessed--; if(player.blessed===0) log('The shrine\'s blessing fades.','c-info'); }
}
function wobblesPrankStatus(key,turns){
  var result=applyStatus(player,key,turns),name=STATUS_INFO[key]&&STATUS_INFO[key].name||key;
  if(result.applied)log('Wobbles: '+name+' for '+result.status.t+' turns.','c-you');
  else if(result.reason!=='unstoppable')log('Wobbles: '+name+' resisted.','c-good');
}
function wobblesInvokeRules(big){return FoteProgression.wobblesOutcome(1-(1-(big?.7:.6))/divineStrength(),godRank());}
function wobblesTemptRules(){return FoteProgression.wobblesOutcome(.65,godRank());}
function wobblesConvertPrank(rank){
  var chance=FoteProgression.wobblesOutcome(0,rank===undefined?godRank():rank).conversion;
  if(!(chance>0)||rng()>=chance)return false;
  log('Favorite Toy: prank became a reward.','c-good');return true;
}
function wobblesGiftDrop(item){
  // Prefer empty, safe neighbours on this side of walls and locked gates.
  // Landing is deterministic and does not consume the reward's random rolls.
  var reach=bfsFrom(player.x,player.y),spot=null;
  for(var i=0;i<FoteActors.neighbors.length;i++){
    var offset=FoteActors.neighbors[i],x=player.x+offset[0],y=player.y+offset[1];
    if(inb(x,y)&&reach[idxOf(x,y)]>=0&&walkable(x,y)&&freeCell(x,y)&&!fireT[idxOf(x,y)]){spot={x:x,y:y};break;}
  }
  // A completely crowded surround keeps the gift on the player's own tile.
  spot=spot||player;item.x=spot.x;item.y=spot.y;items.push(item);return item;
}
function grantWobblesGift(options){
  options=options||{};
  var gift=FoteProgression.wobblesGift(rng(),options.pool),kind=gift.kind,label=options.label||'Wobbles';
  if(kind==='sigil'){
    var sigil=wobblesGiftDrop({kind:kind,use:randomSigilUse()});
    log(label+': '+sigilName(sigil.use)+' dropped nearby.','c-good');return sigil;
  }
  if(kind==='mote'){
    var count=options.motes||gift.count,elements=[],drops=[];
    for(var i=0;i<count;i++){var el=pick(ELEMENTS);elements.push(el);drops.push(wobblesGiftDrop({kind:kind,el:el}));}
    log(label+': '+count+' '+(count===1?elements[0]+' mote':'elemental motes')+' dropped nearby.','c-good');
    return {kind:kind,count:count,elements:elements,drops:drops};
  }
  if(kind==='essence'){
    var amount=ri(options.essenceMin||20,options.essenceMax||40)*(options.essenceScale||1);
    var drop=wobblesGiftDrop({kind:kind,n:amount});
    log(label+': '+amount+' Essence dropped nearby.','c-good');return drop;
  }
  var item=kind==='ring'?makeRing(null,false):makeAmulet(null,false),drop=wobblesGiftDrop({kind:kind,it:item});
  log(label+': '+gearName(item)+' dropped nearby.','c-good');
  return drop;
}
function restoreWobblesResources(health,mana,label){
  var rules=FoteProgression.wobblesResources(player),hp=player.hp,mp=player.mp;
  if(health)healPlayer(rules.healthAmount);
  if(mana)player.mp=Math.min(player.maxmp,player.mp+rules.manaAmount);
  var restored=[];if(player.hp>hp)restored.push('+'+Math.round(player.hp-hp)+' HP');if(player.mp>mp)restored.push('+'+Math.round(player.mp-mp)+' Mana');
  if(restored.length)log((label||'Wobbles')+': '+restored.join(', ')+'.','c-good');
  return {health:player.hp-hp,mana:player.mp-mp};
}
function wobblesPassiveReward(){
  var rules=FoteProgression.wobblesResources(player);
  if(rules.healthChance>0&&rng()<rules.healthChance)return restoreWobblesResources(true,false);
  if(rules.manaChance>0&&rng()<rules.manaChance)return restoreWobblesResources(false,true);
  return grantWobblesGift({pool:'passive',essenceMin:40,essenceMax:80,essenceScale:1+Math.max(0,bidx())});
}
function wobblesTeleportSpots(){
  var reachable=bfsFrom(player.x,player.y);
  return safeWobbleSpots().filter(function(p){return reachable[idxOf(p.x,p.y)]>=0&&(p.x!==player.x||p.y!==player.y);});
}
function wobblesSummonPlan(){
  var pool=[],preview=floorMeta.chaosPreview,region=null;
  if(preview&&typeof FoteChaosEnemies!=='undefined'){
    var id=preview.regionByCell[idxOf(player.x,player.y)];region=(preview.regions||[]).find(function(r){return r.id===id;});
    pool=FoteChaosEnemies.kindsForBiome(region&&region.biome||preview.biome).map(function(kind){return [kind,1];});
  }else if(floorMeta.plane&&typeof PLANE_ROSTER!=='undefined'&&PLANE_ROSTER[floorMeta.plane])pool=PLANE_ROSTER[floorMeta.plane].mobs.map(function(kind){return [kind,MONSTERS[kind]&&MONSTERS[kind].w||1];});
  else if(deepMobsOn())pool=deepPool(deepRegionAt(player.x,player.y));
  else pool=caveRoster();
  pool=pool.filter(function(row){var b=MONSTERS[row[0]];return b&&!b.boss&&!b.elite&&!b.rare&&row[1]>0;});
  var reachable=bfsFrom(player.x,player.y),spots=[];
  for(var y=Math.max(0,player.y-3);y<=Math.min(MH-1,player.y+3);y++)for(var x=Math.max(0,player.x-3);x<=Math.min(MW-1,player.x+3);x++){
    var i=idxOf(x,y);if(reachable[i]>=0&&freeCell(x,y)&&walkable(x,y)&&!fireT[i]&&(!preview||preview.regionByCell[i]===preview.regionByCell[idxOf(player.x,player.y)]))spots.push({x:x,y:y});
  }
  return {pool:pool,spots:spots,chaos:!!preview};
}
function wobblesPassivePrank(){
  var food=player.bag.filter(function(b){return b.kind==='food'&&b.n>0;}),sigils=player.bag.filter(function(b){return b.kind==='sigil'&&b.n>0&&b.data&&SIGILS[b.data.use];});
  var spots=wobblesTeleportSpots(),summon=wobblesSummonPlan(),prank=FoteProgression.wobblesPrank(rng(),{food:food.length>0,transmute:sigils.length>0,teleport:spots.length>0,summon:summon.pool.length>0&&summon.spots.length>0});
  if(!prank)return;
  if(prank.kind==='food'){
    var meal=pick(food);consume(player.bag.indexOf(meal));log('Wobbles eats '+meal.name+'.','c-you');
  }else if(prank.kind==='transmute'){
    var carried=pick(sigils),use=pick(Object.keys(SIGILS));consume(player.bag.indexOf(carried));
    if(!addBag('✦',sigilName(use),{kind:'sigil',data:{use:use},uid:'sigil:'+use}))wobblesGiftDrop({kind:'sigil',use:use});
    log('Wobbles transforms a carried sigil.','c-you');
  }else if(prank.kind==='teleport'){
    var to=pick(spots);player.x=to.x;player.y=to.y;player._lx=undefined;player._ly=undefined;computeFOV();log('Wobbles: teleport.','c-you');
  }else if(prank.kind==='summon'){
    var cell=pick(summon.spots),kind=weightedMonster(summon.pool),enemy=summon.chaos?FoteChaosEnemies.spawn(kind,cell.x,cell.y,{state:'hunt'}):spawn(kind,cell.x,cell.y,{skipDeep:true});
    if(enemy){enemy.state='hunt';enemy.noLoot=true;log('Wobbles summons '+enemy.name+'.','c-you');}
  }else wobblesPrankStatus(prank.kind,prank.turns);
  return prank;
}
function wobblesIntervention(big){
  var rules=wobblesInvokeRules(big),good=rng()<rules.baseReward||wobblesConvertPrank(rules.rank);
  sfx('wobbles-giggle');
  var foes=ents.filter(function(e){ return e.foe && vis[idxOf(e.x,e.y)]; });
  if(good){
    var opts=['heal','gift','rampage','sheep','gift'];
    if(foes.length>=2) opts.push('escape');
    var o=pick(opts);
    if(o==='heal'){ restoreActorHealth(player,player);sparkleFx(player.x,player.y,'heal',40);log('<b>Wobbles:</b> full healing.','c-kill'); }
    else if(o==='gift'){ grantWobblesGift(); }
    else if(o==='rampage'){ player.buffs.rampage=10; derive(player); log('Wobbles: Rampage.','c-kill'); }
    else if(o==='sheep' && foes.length){ var t=pick(foes.filter(function(f){ return !f.base.boss; })); if(t){ var x=t.x,y=t.y; ents=ents.filter(function(e){ return e!==t; }); var r=spawn('rat',x,y); r.name='Very Confused Rat'; r.state='wander'; r.noLoot=true; log('Wobbles: '+t.name+' becomes a rat.','c-kill'); sparkleFx(x,y,'magic',30); } }
    else if(o==='escape'){ var o2=[]; for(var yy=0;yy<MH;yy++) for(var xx=0;xx<MW;xx++) if(walkable(xx,yy)&&!occupied(xx,yy)&&inRoom(xx,yy)&&dist({x:xx,y:yy},player)>15) o2.push({x:xx,y:yy});
      var s=pick(o2); if(s){ player.x=s.x; player.y=s.y; player._lx=undefined; log('Wobbles: teleported to safety.','c-kill'); } }
    else { grantWobblesGift(); }
  } else {
    var bad=pick(['status','rats','teleport','butterfingers']);
    if(bad==='status'){ var prank=pick(['blind','chill','root']);wobblesPrankStatus(prank,3); }
    else if(bad==='rats'){ for(var i=0;i<2;i++){ var c=nearFree(player.x,player.y,2); if(c){ var m=spawn('rat',c.x,c.y); m.state='hunt'; m.noLoot=true; } } log('Wobbles: rats summoned!','c-you'); }
    else if(bad==='teleport'){ var o3=[]; for(var y2=0;y2<MH;y2++) for(var x2=0;x2<MW;x2++) if(walkable(x2,y2)&&!occupied(x2,y2)&&inRoom(x2,y2)) o3.push({x:x2,y:y2});
      var s3=pick(o3); if(s3){ player.x=s3.x; player.y=s3.y; player._lx=undefined; log('Wobbles: teleported!','c-you'); } }
    else { player.mp=Math.floor(player.mp/2); log('Wobbles: half your Mana lost.','c-you'); }
    player.hp=Math.max(1,player.hp);
  }
  computeFOV();
}

/* ---------------------------------------------------------------- prayers */
function prayerList(){ return player.god ? (GODS[player.god].prayers||[]) : []; }


function clearBad(){ ['burn','poison','chill','frozen','fear','blind','stun','root','corrupt'].forEach(function(k){ delete player.st[k]; }); }

/* ---------------------------------------------------------------- the shrine window */
function pietyDepthText(){return 'Piety earned here is worth x'+pietyDepthMultiplier().toFixed(2)+'. Favor is not multiplied.';}
/* only what you have earned is shown: a stranger sees the first boon, a follower sees boons and prayers up to their rank */
function shrineGifts(id, g, mine){
  var r = mine ? godRank() : 1, BR = godBoonRanks(g);
  var boons = g.boons.filter(function(b, i){ return (BR[i]||i+1)<=r; });
  var prayers = mine ? (g.prayers||[]).filter(function(p){ return PRAYERS[p] && r>=PRAYERS[p].rank; }) : [];
  var h='<p><b>'+(mine?'Your boons:':'First boon:')+'</b></p><ol class="boons">'+boons.map(function(b){ return '<li>'+b+'</li>'; }).join('')+'</ol>';
  if(prayers.length) h+='<p><b>Your abilities</b></p>'+prayers.map(function(p){ var P=PRAYERS[p]; return '<div class="shrine-ability"><b>'+P.name+'</b>'+actionDetailsHTML(prayerDetails(P,p))+'</div>'; }).join('');
  if(boons.length<g.boons.length || prayers.length<(g.prayers||[]).length) h+='<p class="c-info" style="font-size:calc(11px + var(--ui-mobile-text-add,0px))">'+(mine?'Grow in piety to learn what else '+g.name.split(',')[0]+' grants.':'Swear yourself and grow in piety to learn what else '+g.name.split(',')[0]+' grants.')+'</p>';
  return h;
}
function openShrine(){
  var id=RUN.shrineGod, g=GODS[id];
  sfx('shrine-open');
  var mine = player.god===id, refused = !mine && (typeof godRefuses==='function' ? godRefuses(id) : (g.refuses && player.race===g.refuses));
  var art = '<div class="shrine-art" data-art="'+g.sprite+'"></div>';
  var html = '<div class="shrine"><div class="shrine-head">'+art+'<div><h3 style="color:'+g.color+'">'+g.name+'</h3><div class="who">'+cap(g.title)+'</div>'+
    '<p><b>Rule.</b> '+g.rule+'</p></div></div><div class="shrine-details"><p><b>Piety comes from:</b> '+g.gain+' '+pietyDepthText()+'</p>'+
    shrineGifts(id, g, mine)+
    '<div class="shrine-ability"><b>Cleric ability: '+ABILITIES[g.invoke].name+'</b>'+actionDetailsHTML(mine?abilityDetails(ABILITIES[g.invoke],g.invoke):actionDetail(ABILITIES[g.invoke].desc))+'</div></div></div>';
  var buttons=[];
  var startPiety = 20;   /* flat in every biome: converting late never skips ranks */
  if(refused) html+='<p class="c-you"><b>'+(typeof godRefuses==='function' ? refusalText(id) : g.name+' will not accept a '+RACES[player.race].name+'.')+'</b></p>';
  else if(!mine) buttons.push({label:'Swear to '+g.name.split(',')[0], cls:'primary', fn:function(){
    confirmBox('Swear to '+g.name, (player.god?'Abandoning <b>'+GODS[player.god].name+'</b> brings their wrath for a while. ':'')+'Your piety starts at '+startPiety+'. '+g.rule, 'Swear', function(){
      if(joinGod(id,startPiety)===false)return;
      log('You swear yourself to <b>'+g.name+'</b>.','c-kill'); sfx('shrine-convert'); sparkleFx(player.x,player.y,'light',40); closeModal(); updateUI();
    });
  }});
  if(mine){
    if(!floorMeta.shrinePrayed){ buttons.push({label:'Pray at your god\'s shrine', cls:'primary', fn:function(){ floorMeta.shrinePrayed=true; player.favor=100; gainPiety(player.cls==='cleric'?25:10); log('Shrine: Favor restored.','c-kill'); sfx('shrine-convert'); closeModal(); updateUI(); }}); }
    else html+='<p class="c-info">You have already prayed here.</p>';
  }
  /* 2026-09-29 (Justin): the tithe blessing lasts 250 turns (was 40); the fade message (blessed) runs on the same clock */
  if(!mine && !floorMeta.shrineTithed) buttons.push({label:'Tithe 20 essence for a blessing', disabled:player.essence<20, fn:function(){
    spendEssence(20); floorMeta.shrineTithed=true; player.blessed=250; player.buffs.rally=250; derive(player);
    log('The shrine blesses you: +10% damage for 250 turns.','c-good'); sfx('pray'); closeModal(); updateUI(); }});
  buttons.push({label:'Leave', fn:closeModal});
  openModal('Shrine', html, buttons);
  var holder=document.querySelector('.shrine-art'); if(holder) paintArt(holder, 'structures', g.sprite, 120);
  if(typeof FoteGettingStarted!=='undefined')FoteGettingStarted.offer('faith');
}

/* the Faith sheet */
function faithHTML(){
  if(!player.god) return '<div class="faith"><p>You are not sworn to any god.</p><p class="c-info">Each biome holds one shrine to a random god. '+
    (biomePlan().shrine>=floorNo ? 'This biome\'s shrine is on floor <b>'+biomePlan().shrine+'</b>.' : 'This biome\'s shrine was on floor '+biomePlan().shrine+'.')+'</p>'+
    (player.wrath ? '<p class="c-you">The wrath of '+GODS[player.wrath.god].name+' still follows you ('+player.wrath.t+' turns).</p>' : '')+'</div>';
  var g=GODS[player.god], r=godRank(), next=PIETY_RANKS[r]||null, prev=PIETY_RANKS[r-1]||0;
  var pct = next ? Math.round(((player.piety||0)-prev)/(next-prev)*100) : 100;
  /* 2026-09-20: the statue and a line about the god, above the numbers */
  var h='<div class="faith"><div class="godhead" style="display:flex;gap:12px;align-items:flex-start;margin-bottom:8px">'+
        '<div class="faith-art" style="flex:0 0 96px;width:96px;height:96px"></div>'+
        '<div style="flex:1 1 auto"><h3 style="color:'+g.color+';margin:0">'+g.name+'</h3><div class="who">'+cap(g.title)+'</div>'+
        (typeof GOD_BLURB!=='undefined' && GOD_BLURB[player.god] ? '<p class="c-info" style="margin:6px 0 0;font-size:calc(12px + var(--ui-mobile-text-add,0px));line-height:1.5">'+GOD_BLURB[player.god]+'</p>' : '')+
        '</div></div>';
  /* Wobbles earns Piety and Favor alongside his separate Amusement meter. */
  if(g.chaos) h+='<div class="kv"><span>Amusement</span><b>'+Math.round(player.amusement||0)+' / 100</b><span>Piety rank</span><b>'+r+' / 5</b><span>Piety</span><b>'+Math.round(player.piety||0)+(next?' (next rank at '+next+')':'')+'</b><span>Favor</span><b>'+Math.round(player.favor||0)+' / 100</b></div>'+
    '<div class="fmeter"><span>Rank '+r+'</span><span class="meter"><i style="width:'+pct+'%;background:linear-gradient(90deg,'+hexA(g.color,0.55)+','+g.color+')"></i></span><span>'+(next?pct+'% to rank '+(r+1):'max rank')+'</span></div>'+
    '<div class="fmeter"><span>Amusement</span><span class="meter"><i style="width:'+Math.round(player.amusement||0)+'%;background:linear-gradient(90deg,#8A4FB0,'+g.color+')"></i></span><span>'+Math.round(player.amusement||0)+' / 100</span></div>'+
    '<div class="fmeter"><span>Favor</span><span class="meter"><i style="width:'+Math.round(player.favor||0)+'%;background:linear-gradient(90deg,#6B5A22,#E8D27A)"></i></span><span>'+Math.round(player.favor||0)+' / 100</span></div>';
  else h+='<div class="kv"><span>Piety rank</span><b>'+r+' / 5</b><span>Piety</span><b>'+Math.round(player.piety||0)+(next?' (next rank at '+next+')':'')+'</b><span>Favor</span><b>'+Math.round(player.favor||0)+' / 100</b></div>'+
    '<div class="fmeter"><span>Rank '+r+'</span><span class="meter"><i style="width:'+pct+'%;background:linear-gradient(90deg,'+hexA(g.color,0.55)+','+g.color+')"></i></span><span>'+(next?pct+'% to rank '+(r+1):'max rank')+'</span></div>'+
    '<div class="fmeter"><span>Favor</span><span class="meter"><i style="width:'+Math.round(player.favor||0)+'%;background:linear-gradient(90deg,#6B5A22,#E8D27A)"></i></span><span>'+Math.round(player.favor||0)+' / 100</span></div>';
  var BRf=godBoonRanks(g);
  h+='<p><b>Rule.</b> '+g.rule+'</p><p><b>Piety from:</b> '+g.gain+'</p><p><b>Depth.</b> '+pietyDepthText()+'</p><p><b>Boons</b></p><ol class="boons">'+g.boons.map(function(b,i){ var br=BRf[i]||i+1; return br<=r ? '<li><b>Rank '+br+'.</b> '+b+'</li>' : ''; }).join('')+'</ol>'+
     (g.boons.some(function(b,i){ return (BRf[i]||i+1)>r; }) ? '<p class="c-info" style="font-size:calc(11px + var(--ui-mobile-text-add,0px))">Grow in piety to learn what else '+g.name.split(',')[0]+' grants.</p>' : '')+'<p><b>Abilities</b></p>';
  var shown=0;
  g.prayers.forEach(function(pid){ var P=PRAYERS[pid], ok=canPray(pid); if(godRank()<P.rank) return; shown++;
    h+='<div class="abrow" data-pr="'+pid+'"><span class="pico"></span><span class="k">'+P.rank+'</span><div><span style="color:var(--ink)">'+P.name+'</span>'+actionDetailsHTML(prayerDetails(P,pid),{omit:['Requires']})+'</div>'+
       '<button class="prayer" data-p="'+pid+'" '+(ok?'':'disabled')+'>Use</button></div>'; });
  if(!shown) h+='<p class="c-info" style="font-size:calc(11px + var(--ui-mobile-text-add,0px))">No abilities yet. Your god will teach you as your piety grows.</p>';
  return h+'</div>';
}

function forbiddenElement(el){return ((player.god==='glimmer'||player.god==='reginald')&&el==='shadow')||(player.god==='murk'&&el==='light')||(player.god==='sylla'&&el==='fire');}

function equipmentForbidden(slot,it){
 if(!it||it===EMPTY_OFF||it.unarmed)return false;
 var k=itemKey(it),g=player.god;
 if(g==='grom')return !(['ring0','ring1','amulet'].includes(slot)||k==='holy');
 if(forbiddenElement(it.enchant))return true;
 if(g==='grumbok'&&k==='wand')return true;
 if(g==='vellum'&&(it.hands===2||k==='staff'||k==='bow'||(it.block>0&&k!=='holy')||['medium','heavy'].includes(it.weight)))return true;
 if(g==='sylla'&&((it.block>0&&k!=='holy')||['medium','heavy'].includes(it.weight)))return true;
 return false;
}

function refuseDivine(){log(GODS[player.god].name+' will not allow that.','c-info');sfx('ui-error');return false;}

function enforceDivineEquipment(p){
 if(!p.god||!p.bag||!p.sets)return;
 function stow(it,kind){if(!it||it===EMPTY_OFF||it.unarmed)return;p.bag.push({kind:kind,data:it,name:gearName(it),icon:it.icon,n:1});}
 p.sets.forEach(function(it,i){if(equipmentForbidden('weapon',it)){stow(it,'weapon');p.sets[i]=FISTS;}});
 [['armorItem','armor'],['off','off'],['ranged','weapon']].forEach(function(pair){var it=p[pair[0]];if(equipmentForbidden(pair[0]==='ranged'?'ranged':pair[1],it)){stow(it,pair[1]);p[pair[0]]=pair[0]==='off'?EMPTY_OFF:null;}});
}

function spendDivineSpell(n){player.favor-=n;player.castingSpell=true;return n;}

function fullDivineDuration(n){var p=holyDurationPct();return n+(p>0?Math.max(1,Math.round(n*p)):0);}

function playerHitRewards(target,singleTarget){
  if(hasGod('vellum') && buff('communion') && player._communionAction!==turn){
    player._communionAction=turn;
    var action=typeof gameActions!=='undefined'&&gameActions.current();
    /* Retain the legacy once-per-turn rule, and record which native action
     * earned it. A nested player counter can have an enemy-owned command root. */
    player._communionReceipt={turn:turn,actionId:action?action.actionId:null,kind:action?action.kind:null,
      sourceId:action&&action.source&&Number.isFinite(action.source.id)?action.source.id:null,
      rootKind:action&&action.rootKind||null,rootSourceId:action?action.rootSourceId:null};
    player.favor=Math.min(100,(player.favor||0)+godRank()*divineStrength());
  }
  if(singleTarget && target.hp>0 && hasGod('vellum') && godRank()>=1 && combatRoll(.10*godRank(),true))
    knockback(target,target.x-player.x,target.y-player.y,2);
}

/* Old save/hotbar names resolve here; only current prayers have implementations. */
function prayerId(id){return {arcanelance:'manaward',manatide:'manaward',arcanenova:'arcaneblink',unbound:'arcaneblink',corpsefeast:'bonespear',offering:'fieldsmelt',reforge:'anviltoll'}[id]||id;}
function arcaneLanceRules(){
  var A=ABILITIES.arcanelance;
  return {damage:FoteActions.divineSpellDamage(A.base[0],godRank(),divineStrength()),range:A.range};
}
function manaWardRules(){var rule=FoteCosts.manaWard(PRAYERS.manaward,godRank(),divineStrength());rule.duration=fullDivineDuration(rule.duration);return rule;}
function arcaneBlinkRules(){var P=PRAYERS.arcaneblink;return {name:P.name,kind:'teleport',range:P.range,divine:true,cost:0};}
function reginaldRules(){
  var r=godRank(),stand=FoteDamage.lastStand(r,divineStrength());stand.duration=fullDivineDuration(stand.duration);
  return {passive:FoteStats.reginald(r),lunge:FoteActions.lunge(),lastStand:stand,coward:FoteDamage.cowardsMark(),lance:FoteActions.reginaldLance(),counter:{ranged:true,weapon:player.weapon}};
}
function arcaneBlinkDestination(x,y){
  var inside=Number.isInteger(x)&&Number.isInteger(y)&&inb(x,y);
  return FoteGeometry.teleportAllowed(player,{x:x,y:y},{range:arcaneBlinkRules().range,inBounds:inside,
    visible:inside&&(revealAll||vis[idxOf(x,y)]),walkable:inside&&walkable(x,y),occupied:inside&&occupied(x,y)});
}
function migratePrayerReferences(actor){
  // Invocation and prayer names are separate namespaces: old prayer Arcane
  // Lance becomes Mana Ward, while old Communion becomes the new invocation.
  function abilityId(id){return id==='arcaneward'?'arcanelance':id==='challenge'?'lunge':id;}
  if(actor.abilities)actor.abilities=actor.abilities.map(abilityId).filter(function(id,i,all){return all.indexOf(id)===i;});
  ['hotbar','_hotPrev'].forEach(function(key){(actor[key]||[]).forEach(function(slot){if(slot&&slot.type==='ability')slot.key=abilityId(slot.key);});});
  if(actor.hotKnown&&Object.prototype.hasOwnProperty.call(actor.hotKnown,'a:arcaneward')){
    actor.hotKnown['a:arcanelance']=actor.hotKnown['a:arcanelance']==='off'||actor.hotKnown['a:arcaneward']==='off'?'off':actor.hotKnown['a:arcanelance']||actor.hotKnown['a:arcaneward'];
    delete actor.hotKnown['a:arcaneward'];
  }
  if(actor.cds&&Object.prototype.hasOwnProperty.call(actor.cds,'arcaneward')){
    actor.cds.arcanelance=Math.max(actor.cds.arcanelance||0,actor.cds.arcaneward||0);delete actor.cds.arcaneward;
  }
  // Lance has no cooldown; saved Communion or older Lance waits are retired.
  if(actor.cds&&DIVINE_COOLDOWNS.invokes.arcanelance===0)delete actor.cds.arcanelance;
  if(actor.hotKnown&&Object.prototype.hasOwnProperty.call(actor.hotKnown,'a:challenge')){
    actor.hotKnown['a:lunge']=actor.hotKnown['a:lunge']==='off'||actor.hotKnown['a:challenge']==='off'?'off':actor.hotKnown['a:lunge']||actor.hotKnown['a:challenge'];delete actor.hotKnown['a:challenge'];
  }
  if(actor.cds)delete actor.cds.challenge;
  ['hotbar','_hotPrev'].forEach(function(key){(actor[key]||[]).forEach(function(slot){if(slot&&slot.type==='prayer')slot.key=prayerId(slot.key);});});
  Object.keys(actor.hotKnown||{}).forEach(function(key){
    if(key.indexOf('p:')!==0)return;
    var current='p:'+prayerId(key.slice(2));if(current===key)return;
    actor.hotKnown[current]=actor.hotKnown[current]==='off'||actor.hotKnown[key]==='off'?'off':actor.hotKnown[current]||actor.hotKnown[key];
    delete actor.hotKnown[key];
  });
  Object.keys(actor.cds||{}).forEach(function(key){
    if(key.indexOf('pray:')!==0)return;
    var id=prayerId(key.slice(5)),current='pray:'+id;
    if(DIVINE_COOLDOWNS.prayers[id]===0){delete actor.cds[key];return;}
    if(current!==key){actor.cds[current]=Math.max(actor.cds[current]||0,actor.cds[key]||0);delete actor.cds[key];}
  });
}
function prayerHealthCost(id){var P=PRAYERS[prayerId(id)];return P&&P.health||0;}
function canPray(id){
  id=prayerId(id);
  var P=PRAYERS[id];
  if(!P || !player.god || prayerList().indexOf(id)<0 || godRank()<P.rank)return false;
  if(id==='fieldsmelt' && recoveryInCombat())return false;
  if(id==='laststand' && buff('laststand'))return false;
  if(cdLeft(prayerCdKey(id))>0)return false;
  var health=prayerHealthCost(id);if(health&&player.hp<health+1)return false;
  return !(P.favor && (player.favor||0)<P.favor || P.essence && player.essence<P.essence || P.amusement && (player.amusement||0)<P.amusement);
}
function spendPrayer(id){
  var P=PRAYERS[prayerId(id)],health=prayerHealthCost(id);
  if(health&&player.hp<health+1)return false;
  if(health){dealDirectDamage(player,health,'phys',null,{tags:['cost','sacrifice']});floatText(player.x,player.y,String(health),'phys');log(P.name+': '+health+' HP spent.','c-info');}
  if(P.favor)player.favor-=P.favor;
  if(P.essence)spendEssence(P.essence);
  if(P.amusement)player.amusement-=P.amusement;
  startPrayerCd(id);return true;
}
/* Prayer and invoke cooldowns (DIVINE_COOLDOWNS in data.js; all 0 until Justin sets them). The wait starts when
   the cost is paid and is kept in player.cds beside Shadowstep and Charge. A prayer's is kept as 'pray:<id>',
   because Raise Dead is a prayer and an ability of the same name. canPray and useAbility refuse while it runs. */
function prayerCdKey(id){return 'pray:'+prayerId(id);}
function startDivineCd(key,turns){turns=cooldownTurns(turns);if(turns>0){player.cds=player.cds||{};player.cds[key]=turn+turns;}}
/* Grumbok rank 5: one trigger per admitted ability, after its cooldown starts. */
function cooldownTurns(turns){return turns;}
function stackDiscipline(){
  if(!player||player.hp<=0||!capstone('grumbok'))return;
  if(player.st)delete player.st.discipline;
  Object.keys(player.cds||{}).forEach(function(key){if(player.cds[key]>turn)player.cds[key]=Math.max(turn,player.cds[key]-2);});
  var before=player.favor||0;player.favor=Math.min(100,before+2);
  log("Warrior's Discipline: cooldowns reduced by 2; +"+(player.favor-before)+' Favor.','c-good');
}
function trollBloodRules(){var rule=FoteDamage.trollBlood(godRank(),divineStrength());rule.duration=fullDivineDuration(rule.duration);return rule;}
function startPrayerCd(id){startDivineCd(prayerCdKey(id),DIVINE_COOLDOWNS.prayers[prayerId(id)]);stackDiscipline();}
function startInvokeCd(key){startDivineCd(key,DIVINE_COOLDOWNS.invokes[key]);stackDiscipline();}
function prayerRefused(id){var n=cdLeft(prayerCdKey(id)),health=prayerHealthCost(id),P=PRAYERS[prayerId(id)];log(n>0?P.name+': ready in '+n+' turns.':health&&player.hp<health+1?P.name+': needs '+(health+1)+' HP; costs '+health+'.':P.name+': unavailable.','c-info');sfx('ui-error');}
function usePrayer(id){
  if(gameTurns.busy())return false;
  if(playerFearAction())return false;
  var before=player.t;
  var key=prayerId(id);
  try{return gameActions.run('prayer',player,null,{prayer:key},function(event){event.result=performPrayer(key);}).result;}
  finally{
    if(player.t===before){
      player._worldBuffPrev=Object.assign({},player.buffs);
      player._worldBuffBorn=player._worldBuffBorn||{};
      Object.keys(player.buffs||{}).forEach(function(k){if(player.buffs[k]>0)player._worldBuffBorn[k]=before;});
    }
  }
}
function performPrayer(id){
  if(!canPray(id)){prayerRefused(id);return false;}
  var aim=id==='arcaneblink'?arcaneBlinkRules():{bonespear:BONE_SPEAR,lance:LANCE}[id];
  if(aim){
    if(aiming&&aiming.prayer===id){
      var target=autoAimLive(),point=target&&autoAimPoint(target);
      if(point)return castAt(point.x,point.y);
      cancelAim();return false;
    }
    aiming={A:aim,prayer:id};if(openSheet)showSheet(openSheet);
    abilityBar();draw();if(AUTO_AIM_KINDS[aim.kind])autoAimPick();
    if(!aiming.auto)log(aim.name+': '+(id==='arcaneblink'?'choose visible ground':'choose a target')+(typeof uiUsesTouchInput==='function'&&uiUsesTouchInput()?'.':'. Esc cancels.'),'c-info');
    return true;
  }
  if(id==='fieldsmelt')return prayFieldSmelt();
  if(id==='raisedead')return prayRaiseDead();
  if(id==='the-brood')return prayTheBrood();
  if(id==='venom-burst')return prayVenomBurst();
  spendPrayer(id);sfx('pray');setClip(player,'cast');
  var div=divineStrength();
  if(id==='manaward'){var ward=manaWardRules();player.manaWard=ward.shield;setResolvedBuffTimer('b:manaward',ward.duration);ringFx(player.x,player.y,'#7FA8FF',2);log('Mana Ward: '+ward.shield+' HP.','c-good');}
  else if(id==='ironhide'){player.buffs.ironhide=12;player.hideShield=Math.round((5+2*godRank())*div);derive(player);log('Iron Hide: armor and shield refreshed.','c-good');}
  else if(id==='pummel'){player.pummel=3;log('Pummel: next 3 unarmed hits.','c-good');updateUI();draw();return true;}
  else if(id==='laststand'){
    var stand=reginaldRules().lastStand;setResolvedBuffTimer('b:laststand',stand.duration);
    derive(player);updateUI();return true;
  }
  else if(id==='rampage'){player.buffs.rampage=10;derive(player);updateUI();return true;}
  else if(id==='luckystreak'){player.buffs.luckystreak=8;derive(player);sfx('wobbles-giggle');updateUI();return true;}
  else if(id==='consecrate'){
    clearBad();ents.slice().forEach(function(e){if(e.foe&&dist(e,player)<=3&&(e.base.undead||e.base.shadowy)){var d=applyDamage(e,Math.round(8*div),'light',player);floatText(e.x,e.y,String(d),'light');if(e.hp<=0)kill(e,player);}});
    sparkleFx(player.x,player.y,'light',40);updateUI();return true;
  }
  else if(id==='sanctuary'){var duration=100*fullDivineDuration(10);floorMeta.sanctuary={x:player.x,y:player.y,power:div,damage:Math.max(1,Math.round(sDMG(3+aff('light'))*div)),duration:duration,until:player.t+duration};ents.forEach(function(e){if(e.foe&&dist(e,player)<=3)applyStatus(e,'fear',4);});ringFx(player.x,player.y,'#FFE4A0',3);}
  else if(id==='trollblood'){var blood=trollBloodRules();healPlayer(player.maxhp*blood.healingFraction);clearBad();setResolvedBuffTimer('b:trollblood',blood.duration);}   /* 2026-09-29 (Justin): 20% +5% per rank (was 40%) */
  else if(id==='rally'){
    healPlayer(player.maxhp*.25*div);clearBad();player.buffs.rally=10;
    ents.forEach(function(e){if(e.ally&&e.hp>0&&vis[idxOf(e.x,e.y)]){
      gameDamage.heal(e,e.maxhp*.25*div*(1+.25*holyGroundStrength(e)),player);
      Object.keys(e.st||{}).forEach(function(k){if(STATUS_INFO[k]&&STATUS_INFO[k].bad)delete e.st[k];});e.rallyUntil=player.t+100*fullDivineDuration(10);
    }});
  }
  else if(id==='anviltoll'){
    sfx('forge-craft');setClip(player,'melee');ringFx(player.x,player.y,GODS.anvil.color,2.5);if(typeof SHAKE!=='undefined')SHAKE=8;
    var struck=0;
    ents.filter(function(e){return e.foe&&e.hp>0&&dist(e,player)<=2;}).forEach(function(e){
      var hp=e.hp;attack(player,e,div,"Anvil's Toll");if(e.hp<hp)struck++;
      if(e.hp>0&&e.hp<hp){knockback(e,e.x-player.x,e.y-player.y,2);applyStatus(e,'stun',1);}
    });
    if(!struck)log("Anvil's Toll: no hits.",'c-info');player.hidden=0;
  }
  else if(id==='rolldice2')greaterPrayer();
  if(PRAYERS[id].instant)FREE_ACTION=true;
  endTurn();return true;
}
function castArcaneBlink(x,y){
  if(!canPray('arcaneblink')||!arcaneBlinkDestination(x,y))return false;
  var actor=player,floor=floorNo;
  spendPrayer('arcaneblink');aiming=null;stopRest();stopTravel();sfx('pray');setClip(player,'cast');
  sparkleFx(player.x,player.y,'magic',20);
  if(typeof FoteEnemyPerception!=='undefined')FoteEnemyPerception.observeMove(x,y);
  player.x=x;player.y=y;player._lx=undefined;player._ly=undefined;player.castingSpell=true;
  sparkleFx(x,y,'magic',20);computeFOV();log('Blink.','c-good');stepOn();endTurn();
  afterTurn(function(){if(player===actor&&floorNo===floor&&player.hp>0){enterTile();updateUI();draw();}});
  return true;
}
function prayFieldSmelt(){
  var choices=player.bag.map(function(b,i){return {b:b,i:i,v:recycleValue(b)};}).filter(function(o){return o.v>0;});
  if(!choices.length){log('No recyclable items in your bag.','c-info');return false;}
  openModal('Field Smelt','Choose one carried item to destroy for its full recycling value.',choices.map(function(o){return {label:o.b.name+' → '+o.v+' essence',fn:function(){
    if(!canPray('fieldsmelt')||player.bag[o.i]!==o.b)return;
    spendPrayer('fieldsmelt');player.bag.splice(o.i,1);gainEssence(recycleValue(o.b));closeModal();updateUI();
  }};}));return true;
}

/* Murk grants Life Drain to the player at rank 1 and summons at rank 3.
 * Grave Strength scales with rank only; summoned forms already scale at cast.
 * HP is owned here,
 * damage in the shared damage pipeline, and speed in the action-cost adapter. */
function murkSummon(e){return !!(e&&e.ally&&(e.undeadServant||e.shade||e.swarm||e.livingFlame||e.shadowClone||e.broodling));}
function murkRank(){return hasGod('murk')?godRank():0;}
function murkSummonBonus(e){var rank=murkRank();return rank>=3&&murkSummon(e)?.05*rank:0;}
function murkSummonHp(e,existing){
  if(!murkSummon(e))return e;
  if(!Number.isFinite(e.murkBaseHp)){
    // Legacy saves baked the old +5% per rank into max HP. New summons record
    // their base before applying a boon, so later derivations never compound it.
    var old=existing?1+.05*murkRank():1;e.murkBaseHp=e.maxhp/old;
  }
  var maximum=Math.max(1,Math.round(e.murkBaseHp*(1+murkSummonBonus(e))));
  if(maximum!==e.maxhp){e.hp=Math.min(maximum,e.hp*maximum/e.maxhp);e.maxhp=maximum;}
  return e;
}
function syncMurkSummons(){
  // Initial character derivation happens before the first floor exists.
  if(ents)ents.forEach(function(e){murkSummonHp(e,true);});
  if(floorMeta&&floorMeta.pendingLich)murkSummonHp(floorMeta.pendingLich.entity,true);
}
function murkSummonDamage(source){return 1+murkSummonBonus(source);}
function murkLifeDrain(target,d,source,event){
  var r=murkRank();
  if(!r||!(d>0)||!target||!target.foe||!(source===player||r>=3&&murkSummon(source)))return;
  if(event&&(event.procDepth>0||['proc','periodic','arc','reflected','environment'].some(function(tag){return event.tags.has(tag);})))return;
  if(rng()>=Math.min(1,.10*r))return;
  var drained=applyDamage(target,Math.max(1,Math.round(2*r*divineStrength())),'dark',source,{tags:['proc','murk-drain'],reactions:false});
  if(drained>0){
    if(source===player)healPlayer(drained);
    else if(source.hp>0){
      var amount=gameEffects.has(source,'rot')?drained*.5:drained;
      gameDamage.heal(source,amount,source);
    }
  }
}

function godDamageResolved(target,d,type,source,event){
 murkLifeDrain(target,d,source,event);


 if(d>0&&source===player&&target.foe){

  if(player.god==='wobbles')combatAmusement('out');
 }
 if(d>0&&target===player&&source&&source.foe&&player.god==='wobbles')combatAmusement('in');
 if(d>0&&target.foe&&source&&source.ally&&typeof FoteEnemyPerception==='undefined'&&!(event&&event.tags.has('periodic'))){target.state='hunt';target.lastSeen={x:source.x,y:source.y};target.petAggressor=source.id;}


}
function combatAmusement(side){var k='_amuse_'+side,t=Math.floor(worldNow()/100);if(player[k]===t)return;player[k]=t;player.amusement=Math.min(100,(player.amusement||0)+1);}
function wobblesMoodOdds(amusement){
 // Per world turn: pranks are 1/50 at 10 Amusement and 1/500 at 40.
 // A small floor keeps either outcome possible throughout the meter.
 var mood=Math.max(0,Math.min(100,Number(amusement)||0)),floor=.0001;
 var falloff=Math.log((.02-floor)/(.002-floor))/30;
 return {prank:floor+(.02-floor)*Math.exp((10-mood)*falloff),reward:floor+(.02-floor)*Math.exp((mood-90)*falloff)};
}
function wobblesMoodRules(amusement,rank){return FoteProgression.wobblesMoodOutcome(wobblesMoodOdds(amusement),rank===undefined?godRank():rank);}
function resolveAmusement(){
 if(!player||player.god!=='wobbles'||player.hp<=0||(typeof RUN!=='undefined'&&RUN&&(RUN.over||RUN.victory)))return;
 var mood=Math.max(0,Math.min(100,Number(player.amusement)||0)),odds=wobblesMoodOdds(mood),rank=godRank(),roll=rng();
 var prank=roll<odds.prank,converted=prank&&wobblesConvertPrank(rank);
 if(prank&&!converted){
  player.amusement=Math.min(100,mood+50);
  sfx('wobbles-giggle');sparkleFx(player.x,player.y,'magic',24);floatText(player.x,player.y,'Prank!','magic');
  wobblesPassivePrank();
 }else if(converted||roll<odds.prank+odds.reward){
  player.amusement=Math.max(0,mood-50);
  sfx('wobbles-giggle');sparkleFx(player.x,player.y,'magic',24);floatText(player.x,player.y,'Gift!','magic');
  wobblesPassiveReward();
 }
}

function godsWorldAdvance(from,to){if(!buff('ironhide'))player.hideShield=0;if(!buff('manaward'))player.manaWard=0;if(!(player.hidden>0))player.syllaDark=0;
 ents.forEach(function(e){if(player.god==='reginald'&&e.foe&&e.hp>0&&dist(e,player)<=8){
  // The Unsneaky's announced presence is an explicit, local source of noise.
  if(typeof FoteEnemyPerception!=='undefined')FoteEnemyPerception.remember(e,player,'unsneaky',to);
  else {e.state='hunt';e.lastSeen={x:player.x,y:player.y};}
 }});
 if(player.god==='wobbles'&&!recoveryInCombat()){player._amuseDrain=(player._amuseDrain||0)+(to-from);while(player._amuseDrain>=1000){player._amuseDrain-=1000;player.amusement=Math.max(0,player.amusement-1);}}
 resolveAmusement();
}
