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

function joinGod(id, startPiety){
  var prev=player.god;
  if(prev && prev!==id){
    log('<b>'+GODS[prev].name+'</b> feels betrayed. Their wrath follows you for a while.','c-you');
    player.wrath={god:prev, t:60}; sfx('wrath');
  }
  player.god=id; player.piety=startPiety||0; player.favor=Math.min(100, Math.round((startPiety||0)/2)); player.amusement=40;
  player.lastRank=godRank();
  derive(player); player.hotbar=null; updateUI();
}
function gainPiety(n, why){
  if(!player.god || n<=0) return;
  var g=GODS[player.god];
  // Amusement has its own event table; ordinary piety does not award it.
  n*=1+(player.race==='human'?.25:0)+(g.loves===player.race?.25:0)+(player.cls==='cleric'?.25:0);
  var before=godRank();
  player.piety=(player.piety||0)+n; player.favor=Math.min(100,(player.favor||0)+n);
  var after=godRank();
  if(after>before){
    log('<b>'+g.name+' is pleased.</b> Piety rank '+after+'.','c-kill'); sfx('piety-rank'); ringFx(player.x,player.y,g.color,3);
    var bi=godBoonRanks(g).indexOf(after), boon=bi>=0 ? g.boons[bi] : null; if(boon) log('Boon: '+boon,'c-good');
    (g.prayers||[]).forEach(function(pid){ var P=PRAYERS[pid]; if(P.rank===after) log('New prayer: <b>'+P.name+'</b> &mdash; '+P.desc+' (Faith tab or P)','c-kill'); });
    derive(player); updateUI();
  }
}
function pietyViolation(what, amount){
  if(!player.god) return;
  var g=GODS[player.god];
  if(g.chaos) return;
  player.piety=Math.max(0,(player.piety||0)-amount); player.favor=0;
  player.violations=(player.violations||0)+1;
  log('<b>'+g.name+'</b> disapproves of '+what+'. (&minus;'+amount+' piety)','c-you'); sfx('wrath');
  if(player.violations>=6 && player.piety<=0){
    log('<b>'+g.name+' turns away from you.</b>','c-you');
    player.wrath={god:player.god, t:80}; player.god=null; player.piety=0; player.favor=0; player.violations=0;
    derive(player); updateUI();
  }
}
function godConductEquip(kind, data){
  var g=player.god; if(!g) return true;
  if(g==='grom'){
    if(kind==='weapon' && data && !data.unarmed) pietyViolation('you taking up a weapon', 15);
    if(kind==='off' && data && ((data.block>0 && itemKey(data)!=='holy') || data.weapon)) pietyViolation('you carrying a shield or blade', 15);
    if(kind==='armor' && data && data!==EMPTY_OFF) pietyViolation('you wearing real armor', 15);
  }
  if(g==='glimmer' && data && data.enchant==='shadow') pietyViolation('shadow-touched gear', 15);
  if(g==='murk' && data && data.enchant==='light') pietyViolation('light-touched gear', 15);
  if(g==='vellum'){
    if(kind==='off' && data && data.block>0 && itemKey(data)!=='holy') pietyViolation('you carrying a shield', 15);
    if(kind==='armor' && data && (data.weight==='medium' || data.weight==='heavy')) pietyViolation('you wearing heavy armor', 15);
  }
  return true;
}
function spellConduct(A){
  var g=player.god; if(!g) return;
  if(g==='grumbok') pietyViolation('you casting a spell', 15);
  if(g==='glimmer' && A.el==='shadow') pietyViolation('shadow magic', 15);
  if(g==='murk' && A.el==='light') pietyViolation('light magic', 15);
  if(g==='vellum'){
    player.castTurn=turn;
    player.manaSpent=(player.manaSpent||0)+costOf(A);
    while(player.manaSpent>=25){ player.manaSpent-=25; gainPiety(1); }
    // Spell Echo repeats resolution in balance-rulings.js; it no longer refunds mana.
  }
}
function sigilConduct(use){
  var g=player.god; if(!g) return true;
  if(g==='grumbok') pietyViolation('you using a magic sigil', 10);
  if(g==='glimmer' && (use==='vanish'||use==='blink')) pietyViolation('a shadow sigil', 10);
  if(g==='murk' && (use==='heal'||use==='mapping')) pietyViolation('a light sigil', 10);
  return true;
}
/* Old Anvil has no kills to count: what he wants is essence, so every 5 spent anywhere - a Forge upgrade,
   an enchantment, a toll, an offering - is a point of piety. Measured against the 3,900 essence lying on
   floors 1-20 (plus what recycling pays), a smith who spends what he finds reaches rank 5 in biome 4,
   the same as every other devoted follower. (2026-09-17) */
function spendEssence(n){
  n=Math.max(0, Math.round(n||0));
  player.essence -= n;
  if(player.god==='anvil' && n>0){
    player.essenceSpent=(player.essenceSpent||0)+n;
    while(player.essenceSpent>=5){ player.essenceSpent-=5; gainPiety(1); }
  }
}
function godOnKill(e, by){
  var g=player.god; if(!g) return;
  var byPlayer = by===player, byAlly = by && by.ally, big = e.elite || e.base.elite || e.base.boss, r=godRank();
  var aware = e.state!=='asleep' && !(e.st.stun) && !(e.st.frozen);
  if(g==='grom'){ /* Grom earns piety on damaging unarmed hits, not kills. */ }
  else if(g==='grumbok'){ if(byPlayer||byAlly) gainPiety((e.base.spellcaster||e.base.el?5:2)+(big?15:0)); if(r>=3 && e.base.spellcaster && byPlayer){ var h=Math.round(player.maxhp*0.1); healPlayer(h); } }
  else if(g==='glimmer'){ if(byPlayer||byAlly) gainPiety((e.base.undead||e.base.shadowy?4:2)+(big?15:0)); }
  else if(g==='murk'){ if(byAlly && by.undeadServant) gainPiety(4+(big?15:0)); else if((byPlayer||byAlly) && !e.base.undead) gainPiety(2+(big?15:0));
    if((byPlayer || (byAlly && by.undeadServant)) && e.foe && !e.base.undead && r>0){ healPlayer(2*r); } }
  else if(g==='reginald'){ if(byPlayer && aware) gainPiety(2+(big?15:0)); }
  else if(g==='vellum'){ if(byPlayer) gainPiety((player.castTurn===turn?2:0)+(big?15:0)); }
  else if(g==='wobbles'){ gainPiety(big?15:2); }
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
  var good = rng() < (big ? 0.7 : 0.6) + wobbleBias(godRank()) + (typeof WOBBLE_BONUS==='number' ? WOBBLE_BONUS : 0);   /* Favourite Toy */
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
function canPray(pid){
  var P=PRAYERS[pid]; if(!P || !player.god) return false;
  if(godRank()<P.rank) return false;
  if(P.favor && (player.favor||0)<P.favor) return false;
  if(P.essence && player.essence<P.essence) return false;
  if(P.amusement && (player.amusement||0)<P.amusement) return false;
  return true;
}
function usePrayer(pid){
  if(!canPray(pid)){ log('You cannot offer that prayer right now.','c-info'); sfx('ui-error'); return; }
  var P=PRAYERS[pid], div=divineStrength();
  if(P.favor) player.favor-=P.favor;
  if(P.essence) spendEssence(P.essence);
  if(P.amusement) player.amusement-=P.amusement;
  sfx('pray'); setClip(player,'cast'); ringFx(player.x,player.y,GODS[player.god].color,2.5);
  if(pid==='ironhide'){ player.buffs.ironhide=divineDuration(12); derive(player); log('Iron Hide: +5 armor.','c-good'); }
  else if(pid==='pummel'){ player.pummel=3; log('Pummel: your next three unarmed hits deal double and stun.','c-good'); }
  else if(pid==='rampage'){ player.buffs.rampage=10; derive(player); log('Rampage! +40% melee damage and speed.','c-good'); }
  else if(pid==='trollblood'){ var h=Math.round(player.maxhp*0.4*div); healPlayer(h); clearBad(); floatText(player.x,player.y,'+'+h,'heal'); log('Trollblood: +'+h+' HP.','c-good'); }
  else if(pid==='consecrate'){ clearBad(); ents.forEach(function(e){ if(e.foe && dist(e,player)<=3 && (e.base.undead||e.base.shadowy)){ var d=applyDamage(e,Math.round(8*div),'light',player); floatText(e.x,e.y,String(d),'light'); applyStatus(e,'fear',3); if(e.hp<=0) kill(e,player); } }); sparkleFx(player.x,player.y,'light',40); log('Holy ground flares around you.','c-good'); }
  else if(pid==='sanctuary'){ ents.forEach(function(e){ if(e.foe && dist(e,player)<=5) applyStatus(e,'fear',4); }); sparkleFx(player.x,player.y,'light',50); log('Sanctuary: nothing dares approach.','c-good'); }
  else if(pid==='unholyaura'){ player.st.aura={t:8}; sparkleFx(player.x,player.y,'dark',40); log('An unholy aura seeps from you.','c-good'); }
  else if(pid==='corpsefeast'){ var h2=Math.round(player.maxhp*0.3*div); healPlayer(h2); ents.forEach(function(e){ if(e.ally) e.hp=e.maxhp; }); floatText(player.x,player.y,'+'+h2,'heal'); log('Corpse Feast: you and your dead are restored.','c-good'); }
  else if(pid==='laststand'){ player.buffs.laststand=10; log('Last Stand: you take 35% less damage.','c-good'); }
  else if(pid==='rally'){ var h3=Math.round(player.maxhp*0.25*div); healPlayer(h3); clearBad(); player.buffs.rally=10; derive(player); floatText(player.x,player.y,'+'+h3,'heal'); log('Rally!','c-good'); }
  else if(pid==='offering'){ var atShrine = at(player.x,player.y-1)===SHRINE||at(player.x,player.y+1)===SHRINE||at(player.x-1,player.y)===SHRINE||at(player.x+1,player.y)===SHRINE;
    gainPiety(Math.max(atShrine?20:10, Math.round((P.essence||0)/(atShrine?5:10)))); log('Old Anvil accepts your offering'+(atShrine?' gladly at his shrine':'')+'.','c-good'); sfx('forge-open'); }
  else if(pid==='reforge'){ player.weapon.plus=(player.weapon.plus||0)+1; derive(player); log('Reforge: your '+gearName(player.weapon)+' is permanently improved.','c-kill'); sfx('forge-enchant'); }
  else if(pid==='rolldice2'){ wobblesIntervention(true); }
  else if(pid==='manatide'){ var mt=Math.round(player.maxmp*0.5*div); player.mp=Math.min(player.maxmp, player.mp+mt); floatText(player.x,player.y,'+'+mt+' mp','magic'); sparkleFx(player.x,player.y,'water',30); log('Mana Tide: +'+mt+' mana.','c-good'); }
  if(pid==='consecrate'){ updateUI(); draw(); return; }   /* instant: cleansing yourself does not cost the turn */
  endTurn();
}
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
  var mine = player.god===id, refused = typeof godRefuses==='function' ? godRefuses(id) : (g.refuses && player.race===g.refuses);
  var art = '<div class="shrine-art" data-art="'+g.sprite+'"></div>';
  var html = '<div class="shrine">'+art+'<div><h3 style="color:'+g.color+'">'+g.name+'</h3><div class="who">'+cap(g.title)+'</div>'+
    '<p><b>Rule.</b> '+g.rule+'</p><p><b>Piety comes from:</b> '+g.gain+'</p>'+
    shrineGifts(id, g, mine)+
    '<p><b>Invoke</b> (Clerics only): <b>'+ABILITIES[g.invoke].name+'</b> &mdash; '+ABILITIES[g.invoke].desc.replace(/^Invoke \([^)]*\): /,'')+'</p></div></div>';
  var buttons=[];
  var startPiety = 20;   /* flat in every biome: converting late never skips ranks */
  if(refused) html+='<p class="c-you"><b>'+(typeof godRefuses==='function' ? refusalText(id) : g.name+' will not accept a '+RACES[player.race].name+'.')+'</b></p>';
  else if(!mine) buttons.push({label:'Swear to '+g.name.split(',')[0], cls:'primary', fn:function(){
    confirmBox('Swear to '+g.name, (player.god?'Abandoning <b>'+GODS[player.god].name+'</b> brings their wrath for a while. ':'')+'Your piety starts at '+startPiety+'. '+g.rule, 'Swear', function(){
      joinGod(id, startPiety); log('You swear yourself to <b>'+g.name+'</b>.','c-kill'); sfx('shrine-convert'); sparkleFx(player.x,player.y,'light',40); closeModal(); updateUI();
    });
  }});
  if(mine){
    if(!floorMeta.shrinePrayed){ buttons.push({label:'Pray at your god\'s shrine', cls:'primary', fn:function(){ floorMeta.shrinePrayed=true; player.favor=100; gainPiety(player.cls==='cleric'?25:10); log('You pray at the shrine of your god. Favor restored.','c-kill'); sfx('shrine-convert'); closeModal(); updateUI(); }}); }
    else html+='<p class="c-info">You have already prayed here.</p>';
  }
  if(!mine && !floorMeta.shrineTithed) buttons.push({label:'Tithe 20 essence for a blessing', disabled:player.essence<20, fn:function(){
    spendEssence(20); floorMeta.shrineTithed=true; player.blessed=120; player.buffs.rally=40; derive(player);
    log('The shrine blesses you: +10 accuracy for a while.','c-good'); sfx('pray'); closeModal(); updateUI(); }});
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
  h+='<p><b>Rule.</b> '+g.rule+'</p><p><b>Piety from:</b> '+g.gain+'</p><p><b>Boons</b></p><ol class="boons">'+g.boons.map(function(b,i){ var br=BRf[i]||i+1; return br<=r ? '<li><b>Rank '+br+'.</b> '+b+'</li>' : ''; }).join('')+'</ol>'+
     (g.boons.some(function(b,i){ return (BRf[i]||i+1)>r; }) ? '<p class="c-info" style="font-size:11px">Grow in piety to learn what else '+g.name.split(',')[0]+' grants.</p>' : '')+'<p><b>Prayers</b></p>';
  var shown=0;
  g.prayers.forEach(function(pid){ var P=PRAYERS[pid], ok=canPray(pid); if(godRank()<P.rank) return; shown++;
    h+='<div class="abrow" data-pr="'+pid+'"><span class="pico"></span><span class="k">'+P.rank+'</span><span><span style="color:var(--ink)">'+P.name+'</span><div class="d">'+P.desc+(godRank()>=P.rank?' <span style="opacity:.6">(drag to hotbar)</span>':'')+'</div></span>'+
       '<button class="prayer" data-p="'+pid+'" '+(ok?'':'disabled')+'>'+(P.favor?P.favor+' favor':P.essence?P.essence+' essence':P.amusement?P.amusement+' amusement':'pray')+'</button></div>'; });
  if(!shown) h+='<p class="c-info" style="font-size:11px">No prayers yet. Your god will teach you as your piety grows.</p>';
  return h+'</div>';
}
