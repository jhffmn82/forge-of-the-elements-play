/* ============================================================================
   gods.js - shrines, swearing to a god, piety and favor, conduct, prayers,
   wrath, and Wobbles' interventions.
   Piety sets your rank and only rises by earning; favor is what prayers spend
   (earned alongside piety, capped at 100). See DESIGN.md 6.5.
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
function wobblesIntervention(big){
  var good = rng() < 1-(1-((big ? 0.7 : 0.6)+wobbleBias(godRank())))/divineStrength();   /* Favourite Toy */
  sfx('wobbles-giggle');
  var foes=ents.filter(function(e){ return e.foe && vis[idxOf(e.x,e.y)]; });
  if(good){
    var opts=['heal','mote','rampage','sheep','essence'];
    if(foes.length>=2) opts.push('escape');
    var o=pick(opts);
    if(o==='heal'){ player.hp=player.maxhp; floatText(player.x,player.y,'full heal','heal'); sparkleFx(player.x,player.y,'heal',40); log('<b>Wobbles giggles.</b> You are fully healed!','c-kill'); }
    else if(o==='mote'){ var el=pick(ELEMENTS); player.motes[el]=(player.motes[el]||0)+1; log('<b>Wobbles giggles.</b> A '+el+' mote appears in your pouch!','c-kill'); }
    else if(o==='rampage'){ player.buffs.rampage=10; derive(player); log('<b>Wobbles giggles.</b> You feel ridiculously strong!','c-kill'); }
    else if(o==='sheep' && foes.length){ var t=pick(foes.filter(function(f){ return !f.base.boss; })); if(t){ var x=t.x,y=t.y; ents=ents.filter(function(e){ return e!==t; }); var r=spawn('rat',x,y); r.name='Very Confused Rat'; r.state='wander'; r.noXp=true; log('<b>Wobbles giggles.</b> '+t.name+' turns into a rat!','c-kill'); sparkleFx(x,y,'magic',30); } }
    else if(o==='escape'){ var o2=[]; for(var yy=0;yy<MH;yy++) for(var xx=0;xx<MW;xx++) if(walkable(xx,yy)&&!occupied(xx,yy)&&inRoom(xx,yy)&&dist({x:xx,y:yy},player)>15) o2.push({x:xx,y:yy});
      var s=pick(o2); if(s){ player.x=s.x; player.y=s.y; player._lx=undefined; log('<b>Wobbles giggles.</b> You are somewhere else, and safe.','c-kill'); } }
    else { var n=ri(20,40); player.essence+=n; log('<b>Wobbles giggles.</b> '+n+' essence rains from nowhere.','c-kill'); }
  } else {
    var bad=pick(['status','rats','teleport','butterfingers']);
    if(bad==='status'){ applyStatus(player, pick(['blind','chill','root']), 3); log('<b>Wobbles snickers.</b> Oops.','c-you'); }
    else if(bad==='rats'){ for(var i=0;i<2;i++){ var c=nearFree(player.x,player.y,2); if(c){ var m=spawn('rat',c.x,c.y); m.state='hunt'; m.noXp=true; } } log('<b>Wobbles snickers.</b> Rats!','c-you'); }
    else if(bad==='teleport'){ var o3=[]; for(var y2=0;y2<MH;y2++) for(var x2=0;x2<MW;x2++) if(walkable(x2,y2)&&!occupied(x2,y2)&&inRoom(x2,y2)) o3.push({x:x2,y:y2});
      var s3=pick(o3); if(s3){ player.x=s3.x; player.y=s3.y; player._lx=undefined; log('<b>Wobbles snickers.</b> Where are you?','c-you'); } }
    else { player.mp=Math.floor(player.mp/2); log('<b>Wobbles snickers.</b> Half your mana slips away.','c-you'); }
    player.hp=Math.max(1,player.hp);
  }
  computeFOV();
}

/* ---------------------------------------------------------------- prayers */
function prayerList(){ return player.god ? (GODS[player.god].prayers||[]) : []; }


function clearBad(){ ['burn','poison','chill','frozen','fear','blind','stun','root','corrupt'].forEach(function(k){ delete player.st[k]; }); }

/* ---------------------------------------------------------------- the shrine window */
/* only what you have earned is shown: a stranger sees the first boon, a follower sees boons and prayers up to their rank */
function shrineGifts(id, g, mine){
  var r = mine ? godRank() : 1, BR = godBoonRanks(g);
  var boons = g.boons.filter(function(b, i){ return (BR[i]||i+1)<=r; });
  var prayers = mine ? (g.prayers||[]).filter(function(p){ return PRAYERS[p] && r>=PRAYERS[p].rank; }) : [];
  var h='<p><b>'+(mine?'Your boons:':'First boon:')+'</b></p><ol class="boons">'+boons.map(function(b){ return '<li>'+b+'</li>'; }).join('')+'</ol>';
  if(prayers.length) h+='<p><b>Your prayers:</b> '+prayers.map(function(p){ var P=PRAYERS[p]; return '<b>'+P.name+'</b> ('+prayerCost(p)+'): '+P.desc; }).join(' &middot; ')+'</p>';
  if(boons.length<g.boons.length || prayers.length<(g.prayers||[]).length) h+='<p class="c-info" style="font-size:11px">'+(mine?'Grow in piety to learn what else '+g.name.split(',')[0]+' grants.':'Swear yourself and grow in piety to learn what else '+g.name.split(',')[0]+' grants.')+'</p>';
  return h;
}
function openShrine(){
  var id=RUN.shrineGod, g=GODS[id];
  sfx('shrine-open');
  var mine = player.god===id, refused = !mine && (typeof godRefuses==='function' ? godRefuses(id) : (g.refuses && player.race===g.refuses));
  var art = '<div class="shrine-art" data-art="'+g.sprite+'"></div>';
  var html = '<div class="shrine">'+art+'<div><h3 style="color:'+g.color+'">'+g.name+'</h3><div class="who">'+cap(g.title)+'</div>'+
    '<p><b>Rule.</b> '+g.rule+'</p><p><b>Piety comes from:</b> '+g.gain+' Piety earned deeper is worth more: x1.3 per biome below the first. Favor is not multiplied.</p>'+
    shrineGifts(id, g, mine)+
    '<p><b>Invoke</b> (Clerics only): <b>'+ABILITIES[g.invoke].name+'</b> &mdash; '+ABILITIES[g.invoke].desc.replace(/^Invoke \([^)]*\): /,'')+'</p></div></div>';
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
    if(!floorMeta.shrinePrayed){ buttons.push({label:'Pray at your god\'s shrine', cls:'primary', fn:function(){ floorMeta.shrinePrayed=true; player.favor=100; gainPiety(player.cls==='cleric'?25:10); log('You pray at the shrine of your god. Favor restored.','c-kill'); sfx('shrine-convert'); closeModal(); updateUI(); }}); }
    else html+='<p class="c-info">You have already prayed here.</p>';
  }
  if(!mine && !floorMeta.shrineTithed) buttons.push({label:'Tithe 20 essence for a blessing', disabled:player.essence<20, fn:function(){
    spendEssence(20); floorMeta.shrineTithed=true; player.blessed=120; player.buffs.rally=40; derive(player);
    log('The shrine blesses you: +10% damage for a while.','c-good'); sfx('pray'); closeModal(); updateUI(); }});
  buttons.push({label:'Leave', fn:closeModal});
  openModal('Shrine', html, buttons);
  var holder=document.querySelector('.shrine-art'); if(holder) paintArt(holder, 'structures', g.sprite, 120);
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
        (typeof GOD_BLURB!=='undefined' && GOD_BLURB[player.god] ? '<p class="c-info" style="margin:6px 0 0;font-size:12px;line-height:1.5">'+GOD_BLURB[player.god]+'</p>' : '')+
        '</div></div>';
  /* 2026-09-18: Wobbles showed only Amusement here (it drains when nothing is happening), so his rank and
     piety - which only ever go up - were invisible and he looked impossible to level. He shows both now. */
  if(g.chaos) h+='<div class="kv"><span>Amusement</span><b>'+Math.round(player.amusement||0)+' / 100</b><span>Piety rank</span><b>'+r+' / 5</b><span>Piety</span><b>'+Math.round(player.piety||0)+(next?' (next rank at '+next+')':'')+'</b></div>'+
    '<div class="fmeter"><span>Rank '+r+'</span><span class="meter"><i style="width:'+pct+'%;background:linear-gradient(90deg,'+hexA(g.color,0.55)+','+g.color+')"></i></span><span>'+(next?pct+'% to rank '+(r+1):'max rank')+'</span></div>'+
    '<div class="fmeter"><span>Amusement</span><span class="meter"><i style="width:'+Math.round(player.amusement||0)+'%;background:linear-gradient(90deg,#8A4FB0,'+g.color+')"></i></span><span>'+Math.round(player.amusement||0)+' / 100</span></div>';
  else h+='<div class="kv"><span>Piety rank</span><b>'+r+' / 5</b><span>Piety</span><b>'+Math.round(player.piety||0)+(next?' (next rank at '+next+')':'')+'</b><span>Favor</span><b>'+Math.round(player.favor||0)+' / 100</b></div>'+
    '<div class="fmeter"><span>Rank '+r+'</span><span class="meter"><i style="width:'+pct+'%;background:linear-gradient(90deg,'+hexA(g.color,0.55)+','+g.color+')"></i></span><span>'+(next?pct+'% to rank '+(r+1):'max rank')+'</span></div>'+
    '<div class="fmeter"><span>Favor</span><span class="meter"><i style="width:'+Math.round(player.favor||0)+'%;background:linear-gradient(90deg,#6B5A22,#E8D27A)"></i></span><span>'+Math.round(player.favor||0)+' / 100</span></div>';
  var BRf=godBoonRanks(g);
  var deepMul = typeof bidx==='function' ? Math.pow(1.3, Math.max(0, bidx())) : 1;   /* 2026-09-23 (Justin): the Faith tab says what piety is worth here */
  h+='<p><b>Rule.</b> '+g.rule+'</p><p><b>Piety from:</b> '+g.gain+'</p><p><b>Depth.</b> Piety earned here is worth x'+deepMul.toFixed(2)+' (x1.3 per biome below the first). Favor is not multiplied.</p><p><b>Boons</b></p><ol class="boons">'+g.boons.map(function(b,i){ var br=BRf[i]||i+1; return br<=r ? '<li><b>Rank '+br+'.</b> '+b+'</li>' : ''; }).join('')+'</ol>'+
     (g.boons.some(function(b,i){ return (BRf[i]||i+1)>r; }) ? '<p class="c-info" style="font-size:11px">Grow in piety to learn what else '+g.name.split(',')[0]+' grants.</p>' : '')+'<p><b>Prayers</b></p>';
  var shown=0;
  g.prayers.forEach(function(pid){ var P=PRAYERS[pid], ok=canPray(pid); if(godRank()<P.rank) return; shown++;
    h+='<div class="abrow" data-pr="'+pid+'"><span class="pico"></span><span class="k">'+P.rank+'</span><span><span style="color:var(--ink)">'+P.name+'</span><div class="d">'+P.desc+(godRank()>=P.rank?' <span style="opacity:.6">(drag to hotbar)</span>':'')+'</div></span>'+
       '<button class="prayer" data-p="'+pid+'" '+(ok?'':'disabled')+'>'+(P.favor?P.favor+' favor':P.essence?P.essence+' essence':P.amusement?P.amusement+' amusement':'pray')+'</button></div>'; });
  if(!shown) h+='<p class="c-info" style="font-size:11px">No prayers yet. Your god will teach you as your piety grows.</p>';
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

function refuseDivine(){log(GODS[player.god].name+' prohibits that action.','c-info');sfx('ui-error');return false;}

function enforceDivineEquipment(p){
 if(!p.god||!p.bag||!p.sets)return;
 function stow(it,kind){if(!it||it===EMPTY_OFF||it.unarmed)return;p.bag.push({kind:kind,data:it,name:gearName(it),icon:it.icon,n:1});}
 p.sets.forEach(function(it,i){if(equipmentForbidden('weapon',it)){stow(it,'weapon');p.sets[i]=FISTS;}});
 [['armorItem','armor'],['off','off'],['ranged','weapon']].forEach(function(pair){var it=p[pair[0]];if(equipmentForbidden(pair[0]==='ranged'?'ranged':pair[1],it)){stow(it,pair[1]);p[pair[0]]=pair[0]==='off'?EMPTY_OFF:null;}});
}

function freeInvocation(A){return capstone('vellum')&&A&&!A.tech&&rng()<.30;}


function spendDivineSpell(n){if(capstone('vellum')&&rng()<.30)n=0;player.favor-=n;player.castingSpell=true;return n;}

function fullDivineDuration(n){var p=holyDurationPct();return n+(p>0?Math.max(1,Math.round(n*p)):0);}

function playerHitRewards(target,singleTarget){
  if(hasGod('vellum') && buff('communion') && player._communionAction!==turn){
    player._communionAction=turn;
    player.favor=Math.min(100,(player.favor||0)+godRank()*divineStrength());
  }
  if(singleTarget && target.hp>0 && hasGod('vellum') && godRank()>=3 && combatRoll(.10*godRank(),true))
    knockback(target,target.x-player.x,target.y-player.y,2);
}

/* Old save/hotbar names resolve here; only current prayers have implementations. */
function prayerId(id){return {manatide:'arcanelance',unbound:'arcanenova',corpsefeast:'bonespear',offering:'fieldsmelt',reforge:'anviltoll'}[id]||id;}
function canPray(id){
  id=prayerId(id);
  var P=PRAYERS[id];
  if(!P || !player.god || prayerList().indexOf(id)<0 || godRank()<P.rank)return false;
  if(id==='fieldsmelt' && recoveryInCombat())return false;
  if(id==='laststand' && (player.hp>player.maxhp*.5 || buff('laststand')))return false;
  return !(P.favor && (player.favor||0)<P.favor || P.essence && player.essence<P.essence || P.amusement && (player.amusement||0)<P.amusement);
}
function spendPrayer(id){
  var P=PRAYERS[prayerId(id)];
  if(P.favor)player.favor-=P.favor;
  if(P.essence)spendEssence(P.essence);
  if(P.amusement)player.amusement-=P.amusement;
}
function usePrayer(id){
  if(gameTurns.busy())return false;
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
  if(!canPray(id)){log('You cannot offer that prayer right now.','c-info');sfx('ui-error');return false;}
  var aim={bonespear:BONE_SPEAR,lance:LANCE,arcanelance:ARCANE_LANCE,arcanenova:ARCANE_NOVA}[id];
  if(aim){aiming={A:aim,prayer:id};if(openSheet)showSheet(openSheet);log(aim.name+': choose a target within '+aim.range+' tiles.','c-info');draw();return true;}
  if(id==='fieldsmelt')return prayFieldSmelt();
  if(id==='raisedead')return prayRaiseDead();
  if(id==='the-brood')return prayTheBrood();
  if(id==='venom-burst')return prayVenomBurst();
  spendPrayer(id);sfx('pray');setClip(player,'cast');
  var div=divineStrength();
  if(id==='ironhide'){player.buffs.ironhide=12;player.hideShield=Math.round((5+2*godRank())*div);derive(player);log('Iron Hide: armor and shield refreshed.','c-good');}
  else if(id==='pummel'){player.pummel=3;log('Pummel empowers your next three successful unarmed hits.','c-good');}
  else if(id==='laststand'||id==='rampage'){player.buffs[id]=10;derive(player);updateUI();return true;}
  else if(id==='luckystreak'){player.buffs.luckystreak=8;derive(player);sfx('wobbles-giggle');updateUI();return true;}
  else if(id==='consecrate'){
    clearBad();ents.slice().forEach(function(e){if(e.foe&&dist(e,player)<=3&&(e.base.undead||e.base.shadowy)){var d=applyDamage(e,Math.round(8*div),'light',player);floatText(e.x,e.y,String(d),'light');if(e.hp<=0)kill(e,player);}});
    sparkleFx(player.x,player.y,'light',40);updateUI();return true;
  }
  else if(id==='sanctuary'){floorMeta.sanctuary={x:player.x,y:player.y,until:player.t+100*fullDivineDuration(10)};ents.forEach(function(e){if(e.foe&&dist(e,player)<=3)applyStatus(e,'fear',4);});ringFx(player.x,player.y,'#FFE4A0',3);}
  else if(id==='trollblood'){healPlayer(player.maxhp*.4*div);clearBad();}
  else if(id==='rally'){
    healPlayer(player.maxhp*.25*div);clearBad();player.buffs.rally=10;
    ents.forEach(function(e){if(e.ally&&e.hp>0&&vis[idxOf(e.x,e.y)]){
      e.hp=Math.min(e.maxhp,e.hp+e.maxhp*.25*div*(inSanctuary(e)?1+.25*div:1));
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
    log("<b>Anvil's Toll.</b> The hammer strikes "+struck+(struck===1?' foe.':' foes.'),'c-good');player.hidden=0;
  }
  else if(id==='rolldice2')greaterPrayer();
  if(PRAYERS[id].instant)FREE_ACTION=true;
  endTurn();return true;
}
function prayFieldSmelt(){
  var choices=player.bag.map(function(b,i){return {b:b,i:i,v:recycleValue(b)};}).filter(function(o){return o.v>0;});
  if(!choices.length){log('No recyclable items in your bag.','c-info');return false;}
  openModal('Field Smelt','Choose one carried item to destroy for its full recycling value.',choices.map(function(o){return {label:o.b.name+' → '+o.v+' essence',fn:function(){
    if(!canPray('fieldsmelt')||player.bag[o.i]!==o.b)return;
    spendPrayer('fieldsmelt');player.bag.splice(o.i,1);player.essence+=recycleValue(o.b);closeModal();updateUI();
  }};}));return true;
}

function godDamageResolved(target,d,type,source,event){


 if(d>0&&source===player&&target.foe){

  if(player.god==='wobbles')combatAmusement('out');
 }
 if(d>0&&target===player&&source&&source.foe&&player.god==='wobbles')combatAmusement('in');
 if(d>0&&target.foe&&source&&source.ally){target.state='hunt';target.lastSeen={x:source.x,y:source.y};target.petAggressor=source.id;}

 if(d>0&&target&&target.foe&&source&&source.ally&&hasGod('murk')&&godRank()>=3&&!(event&&event.tags.has('murk-inherited'))){
   var inherited={tags:['proc','murk-inherited']};
   var el=player.weapon&&player.weapon.enchant,values=enchantValues('weapon',el),bonus=godRank();
   if(target.hp>0)applyDamage(target,bonus,'dark',source,inherited);
   if(target.hp>0){
    if(el==='fire'){applyDamage(target,Math.round(d*values.extraDamage),'fire',source,inherited);if(target.hp>0&&pRoll(values.burnChance))applyStatus(target,'burn',values.burnDuration,burnDmg());}
    if(el==='water'&&pRoll(values.chillChance))addChill(target);
    if(el==='earth'&&pRoll(values.rootChance))applyStatus(target,'root',values.rootDuration);
    if(el==='air'&&pRoll(values.repeatChance))applyDamage(target,Math.round(d),type,source,inherited);
    if(el==='light'&&(target.base.undead||target.base.shadowy))applyDamage(target,Math.round(d*values.extraDamage),'light',source,inherited);
    if(el==='shadow'&&pRoll(values.procChance)){applyDamage(target,Math.round(d*values.extraDamage),'dark',source,inherited);if(target.hp>0)applyStatus(target,'corrupt',values.corruptDuration);}
   }
 }

}
function combatAmusement(side){var k='_amuse_'+side,t=Math.floor(worldNow()/100);if(player[k]===t)return;player[k]=t;player.amusement=Math.min(100,(player.amusement||0)+1);}
function resolveAmusement(){
 if(player.god!=='wobbles')return;
 if(player.amusement>=100){player.amusement-=50;if(player.hp<player.maxhp*.75){healPlayer(player.maxhp*.4);log('Wobbles rewards you with healing.','c-good');}else if(rng()<.5){var it=randomGear();it.x=player.x;it.y=player.y;items.push(it);log('Wobbles leaves you a gift.','c-good');}else{player.essence+=ri(20,40);log('Wobbles showers you with essence.','c-good');}}
 else if(player.amusement<=0){player.amusement=50;applyStatus(player,pick(['blind','chill']),2);log('Bored, Wobbles plays a prank.','c-you');}
}

function godsWorldAdvance(from,to){if(!buff('ironhide'))player.hideShield=0;if(!(player.hidden>0))player.syllaDark=0;
 ents.forEach(function(e){if(e.cowardMark&&e.challengeUntil<=to){e.cowardMark=false;e.challenged=false;}if(player.god==='reginald'&&e.foe&&e.hp>0&&dist(e,player)<=8){e.state='hunt';e.lastSeen={x:player.x,y:player.y};}});
 if(player.god==='wobbles'&&!recoveryInCombat()){player._amuseDrain=(player._amuseDrain||0)+(to-from);while(player._amuseDrain>=1000){player._amuseDrain-=1000;player.amusement=Math.max(0,player.amusement-1);}}
 resolveAmusement();
}
