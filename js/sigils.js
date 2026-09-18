/* =====================================================================
   sigils.js - the full sigil set (2026-09-16): 6 singles, 6 "sigil+"
   (two motes of one element), 15 pairs (every two different elements) and
   2 grand sigils (one of every mote). Crafted at the Forge or found.
   Loads before boot, so runs shuffle looks over the whole set.
   ===================================================================== */

/* 2026-09-17 rework: the Water sigil identifies; mana moved to the Deep Well (Water + Shadow). Opposite elements
   (Fire/Water, Air/Earth, Light/Shadow) make nothing. Cut: Scalding Steam, Soulfire, Mist, Sandstorm.
   New: Smoke (Fire + Shadow) and Rot (Shadow + Earth). Deep Map is Light + Earth; the Aegis takes three motes. */
var SIGIL_ORDER = {
  singles: ['firestorm','identify','levitate','stoneskin','heal','vanish'],
  plus:    ['firestorm2','identify2','levitate2','stoneskin2','heal2','vanish2'],
  pairs:   ['cinder','magma','sunburst','smoke','storm','mire','purify','mana','recall','blink','mapping','rot'],
  triple:  ['aegis'],
  grand:   ['ascension','wisdom']
};
(function(){
  var S=SIGILS, add={
    firestorm2:{name:'Fire sigil+', motes:['fire','fire'], desc:'Flames burst out to 4 tiles: 14 + floor fire damage and Burning.'},
    identify2: {name:'Water sigil+', motes:['water','water'], desc:'Identify every sigil and every piece of gear you carry or wear, learn the look of every sigil this run, and put out every fire within 5 tiles.'},
    levitate2: {name:'Air sigil+', motes:['air','air'], desc:'Float for 60 turns, and move 30% faster for 10.'},
    stoneskin2:{name:'Earth sigil+', motes:['earth','earth'], desc:'Stone skin for 30 turns and a shield of 20% of your max HP.'},
    heal2:     {name:'Light sigil+', motes:['light','light'], desc:'Heal to full and cleanse every status. (Hurts Gloomlings.)'},
    vanish2:   {name:'Shadow sigil+', motes:['shadow','shadow'], desc:'Vanish for 15 turns; enemies lose track of you.'},
    cinder:    {name:'Sigil of Cinder Stride', motes:['fire','air'], desc:'Move 50% faster for 10 turns, leaving fire where you step.'},
    magma:     {name:'Sigil of the Molten Ring', motes:['fire','earth'], desc:'The ground 2 tiles around you (not under you) burns for 5 turns.'},
    sunburst:  {name:'Sigil of Sunburst', motes:['fire','light'], desc:'Every enemy you can see takes light damage and is Blinded for 3 turns.'},
    smoke:     {name:'Sigil of Smoke', motes:['fire','shadow'], desc:'Smoke fills the room (4 tiles around you in a corridor) for 12 turns. Nobody inside, you included, sees past 1 tile, so no one can shoot or cast across it. Enemies hunting you lose track, and one that lost you can be surprised.'},
    storm:     {name:'Sigil of the Storm', motes:['water','air'], desc:'Lightning strikes up to 3 enemies you can see (more against the wet, may stun); rain soaks the rest.'},
    mire:      {name:'Sigil of the Mire', motes:['water','earth'], desc:'Enemies within 3 are Rooted for 3 turns and soaked.'},
    purify:    {name:'Sigil of Purity', motes:['water','light'], desc:'Cleanse your statuses, heal 20%, and break the curse on everything you wear.'},
    rot:       {name:'Sigil of Rot', motes:['shadow','earth'], desc:'Choose a cursed item you wear: it rots away to nothing. The only way to shed a curse without Light or the Forge.'},
    recall:    {name:'Sigil of Homeward Wind', motes:['air','light'], desc:'The wind carries you to this floor\'s stairs (or the open gate).'},
    aegis:     {name:'Sigil of the Aegis', motes:['earth','earth','light'], desc:'A shield of 50% of your max HP for 15 turns, and stone skin.'},
    ascension: {name:'Sigil of Ascension', motes:['fire','water','air','earth','light','shadow'], desc:'Upgrade one piece of gear by +1 for free (up to +3). Breaks a curse.'},
    wisdom:    {name:'Sigil of Wisdom', motes:['fire','water','air','earth','light','shadow'], desc:'Gain a level.'}
  };
  for(var k in add) S[k]=add[k];
  S.identify.name='Water sigil'; S.identify.motes=['water'];
  /* 2026-09-17: identifying the entire pack made every unknown drop pointless - the single sigil now reads
     what you are actually wearing (and your sigils); the + version is what identifies the whole bag. */
  S.identify.desc='Identify every sigil you carry, read one piece of gear of your choice (worn or carried), and put out every fire within 3 tiles.';
  S.mana.name='Sigil of the Deep Well'; S.mana.motes=['water','shadow'];
  S.mana.desc='Restore 50% of your mana, and mana returns twice as fast for 20 turns.';
  S.mapping.motes=['light','earth'];
  ['steam','soulfire','mist','sandstorm','mana2'].forEach(function(k){ delete S[k]; });
  /* rebuild in display order so the Forge lists singles, sigil+, pairs, then grand */
  var ordered={};
  ['singles','plus','pairs','triple','grand'].forEach(function(g){ SIGIL_ORDER[g].forEach(function(k){ if(S[k]) ordered[k]=S[k]; }); });
  for(var k2 in S) if(!ordered[k2]) ordered[k2]=S[k2];
  SIGILS=ordered;
})();
/* 2026-09-17: motes alone made sigils feel free, so carving one costs essence by grade:
   100 a single-element sigil, 200 anything needing two motes (including the doubles and the Aegis),
   500 the Ascension (a free upgrade) and 1000 the Wisdom (a free level). */
var SIGIL_ESSENCE = {common:100, uncommon:200, upgrade:500, levelup:1000};
function sigilEssence(key){
  if(key==='ascension') return SIGIL_ESSENCE.upgrade;
  if(key==='wisdom') return SIGIL_ESSENCE.levelup;
  var s=SIGILS[key];
  return (s && s.motes && s.motes.length>1) ? SIGIL_ESSENCE.uncommon : SIGIL_ESSENCE.common;
}
SIGIL_LOOKS = ['ashen','coiled','cracked','weeping','humming','bone','tarnished','woven','gilded',
  'frosted','scorched','mossy','starry','inked','rusted','crystal','feathered','veined','charred',
  'pearl','ivory','runed','sunlit','moonlit','thorned','salted','bloodied','hollow','glass'];

/* found sigils (2026-09-17): the base six are the common find (85%, even odds); pairs 10% (Rot is Forge-only),
   sigil+ and the Aegis 4%, grand 1%. Every drop source (floors, chests, crates, monsters, puzzle rooms) uses this. */
randomSigilUse = function(){
  var r=rng();
  if(r<0.85) return pick(SIGIL_ORDER.singles);
  if(r<0.95) return pick(SIGIL_ORDER.pairs.filter(function(k){ return k!=='rot'; }));
  if(r<0.99) return pick(SIGIL_ORDER.plus.concat(SIGIL_ORDER.triple));
  return pick(SIGIL_ORDER.grand);
};

/* gods judge sigils by their motes */
sigilConduct = function(use){
  var g=player.god; if(!g) return true;
  var motes=(SIGILS[use]||{}).motes||[];
  if(g==='grumbok') pietyViolation('you using a magic sigil', 10);
  if(g==='glimmer' && motes.indexOf('shadow')>=0) pietyViolation('a shadow sigil', 10);
  if(g==='murk' && motes.indexOf('light')>=0) pietyViolation('a light sigil', 10);
  return true;
};

/* ---------------------------------------------------------------- effects */
function visibleFoes(maxD){ return ents.filter(function(e){ return e.foe && vis[idxOf(e.x,e.y)] && (maxD===undefined || dist(player,e)<=maxD); }); }
function hurt(e, n, type){ var d=applyDamage(e, n, type, player); floatText(e.x,e.y,String(d), type==='ice'?'ice':type); if(e.hp<=0) kill(e,player); return d; }
function cleanseAll(){ ['burn','poison','chill','fear','blind','stun','root','frozen','wet'].forEach(function(k){ delete player.st[k]; }); }
function giveWard(n, turns){ player.ward=Math.max(player.ward||0, Math.round(n)); player.buffs.arcaneward=Math.max(player.buffs.arcaneward||0, turns); }

var _useSigilFull = useSigil;
useSigil = function(use){
  var NEW = ['firestorm2','identify2','levitate2','stoneskin2','heal2','vanish2','cinder','magma','sunburst','smoke','storm','mire','purify','rot','recall','aegis','ascension','wisdom'];
  if(use==='mana'){ var okm=_useSigilFull(use); if(okm!==false){ player.buffs.manaflow=Math.max(player.buffs.manaflow||0, 20); } return okm; }
  if(NEW.indexOf(use)<0) return _useSigilFull(use);
  var F=floorNo;
  /* checks that decide whether the sigil can be read at all, before anything is spent */
  if(use==='ascension' && !allUpgradeTargets().some(function(o){ return upgradeCost(o.it)!==null; })){ log('Nothing you carry can be raised any higher.','c-info'); return false; }
  if(use==='rot' && !wornGear().some(function(it){ return it.cursed; })){ log('Nothing you wear is cursed. The sigil stays quiet.','c-info'); return false; }
  if(use==='recall'){ var goal=null; for(var i=0;i<map.length;i++){ if(map[i]===STAIRS || (map[i]===EXIT && floorMeta.exitOpen)){ goal={x:i%MW, y:(i/MW)|0}; break; } } if(!goal){ log('There is nowhere to be carried to.','c-info'); return false; } }
  var ok=_useSigilFull(use);       /* conduct, sound, cast animation, identification */
  if(ok===false) return false;
  if(use==='firestorm2'){ burst(player.x,player.y,'fire',90,0.14); visibleFoes(4).forEach(function(e){ hurt(e, 14+F, 'fire'); if(e.hp>0) applyStatus(e,'burn',4,sDMG(3)); });
    for(var dy=-3;dy<=3;dy++) for(var dx=-3;dx<=3;dx++) if(dx||dy) ignite(player.x+dx,player.y+dy,'player'); log('A firestorm roars out around you.','c-fire'); }
  else if(use==='identify2'){
    Object.keys(SIGILS).forEach(function(k){ identifySigilQuiet(k); });
    var list=wornGear().concat(player.bag.filter(function(b){ return b.data && b.data.unid; }).map(function(b){ return b.data; }));
    var n=0; list.forEach(function(it){ if(identifyGear(it, true)) n++; }); refreshBagNames();
    douseAround(5); log('Clear water runs over everything you own. You know every sigil'+(n?' and '+n+' piece'+(n>1?'s':'')+' of gear':'')+'.','c-kill'); }
  else if(use==='levitate2'){ player.levitate=Math.max(player.levitate||0,60); player.buffs.haste=10; derive(player); log('You rise on the wind, light and quick.','c-good'); sparkleFx(player.x,player.y,'lightning',30); }
  else if(use==='stoneskin2'){ applyStatus(player,'stone',30); giveWard(player.maxhp*0.2, 30); log('Your skin hardens to granite.','c-good'); }
  else if(use==='heal2'){
    if(player.race==='gloomling'){ var hd=applyDamage(player,Math.round(player.maxhp*0.3),'light',null); floatText(player.x,player.y,String(hd),'light'); log('The blazing light scorches you!','c-you'); if(player.hp<=0) death(); }
    else { player.hp=player.maxhp; cleanseAll(); floatText(player.x,player.y,'full heal','heal'); sparkleFx(player.x,player.y,'heal',40); log('Light pours through you. You are whole.','c-good'); } }
  else if(use==='vanish2'){ player.hidden=15; ents.forEach(function(e){ if(e.foe && e.state==='hunt'){ e.state='wander'; e.lastSeen=null; } }); log('You fold into the shadows.','c-good'); }
  else if(use==='cinder'){ player.buffs.cinder=10; derive(player); player._cinderAt={x:player.x,y:player.y}; log('Your feet catch fire. Run.','c-fire'); }
  else if(use==='magma'){ for(var my=-2;my<=2;my++) for(var mx=-2;mx<=2;mx++){ var tx=player.x+mx, ty=player.y+my; if((mx||my) && inb(tx,ty) && walkable(tx,ty)) fireT[idxOf(tx,ty)]=Math.max(fireT[idxOf(tx,ty)],5); }
    ents.forEach(function(e){ if(e.foe && dist(e,player)<=2) applyStatus(e,'burn',3,sDMG(2)); }); log('The floor around you melts into a ring of fire.','c-fire'); }
  else if(use==='smoke'){ raiseSmoke(); }
  else if(use==='rot'){ rotPicker(); }
  else if(use==='sunburst'){ ringFx(player.x,player.y,'#FFF1CC',5); visibleFoes().forEach(function(e){ hurt(e, 6+F, 'light'); if(e.hp>0) applyStatus(e,'blind',3); }); log('A blinding sun flares from your hand.','c-good'); }
  else if(use==='storm'){ var foes=visibleFoes().sort(function(a,b){ return dist(player,a)-dist(player,b); });
    foes.slice(0,3).forEach(function(e){ var wet=isWet(e); hurt(e, Math.round((10+F)*(wet?1.5:1)), 'lightning'); if(e.hp>0 && rng()<0.5) applyStatus(e,'stun',1); burst(e.x,e.y,'lightning',16,0.06); });
    foes.forEach(function(e){ if(e.hp>0){ e.st.wet={t:5}; } }); log('Thunder cracks and rain hammers down.','c-good'); }
  else if(use==='mire'){ ents.forEach(function(e){ if(e.foe && dist(e,player)<=3){ applyStatus(e,'root',3); e.st.wet={t:6}; burst(e.x,e.y,'earth',8,0.04); } }); log('The ground turns to sucking mud.','c-good'); }
  else if(use==='purify'){ cleanseAll(); var ph=Math.round(player.maxhp*0.2); if(player.race!=='gloomling'){ player.hp=Math.min(player.maxhp,player.hp+ph); floatText(player.x,player.y,'+'+ph,'heal'); }
    var broke=0; wornGear().forEach(function(it){ if(breakCurse(it)) broke++; }); log('Clear water washes over you'+(broke?' and your gear':'')+'.','c-good'); }
  else if(use==='recall'){ var g2=null; for(var j=0;j<map.length;j++){ if(map[j]===STAIRS || (map[j]===EXIT && floorMeta.exitOpen)){ g2={x:j%MW, y:(j/MW)|0}; break; } }
    var land=(!occupied(g2.x,g2.y) && walkable(g2.x,g2.y)) ? g2 : nearFree(g2.x,g2.y,2);
    if(land){ sparkleFx(player.x,player.y,'lightning',20); player.x=land.x; player.y=land.y; player._lx=undefined; seen[idxOf(g2.x,g2.y)]=1; sparkleFx(player.x,player.y,'lightning',20); computeFOV(); log('The wind lifts you and sets you down by the way onward.','c-good'); } }
  else if(use==='aegis'){ giveWard(player.maxhp*0.5, 15); applyStatus(player,'stone',15); ringFx(player.x,player.y,'#F6E7B0',2.5); log('A shining aegis settles around you ('+player.ward+').','c-good'); }
  else if(use==='wisdom'){ var need=Math.max(1, player.xpNext-player.xp); gainXP(need); log('Understanding floods in.','c-kill'); }
  else if(use==='ascension'){ sigilUpgradePicker(); }
  updateUI();
  return true;
};

/* Sigil of Ascension: choose what to raise */
function sigilUpgradePicker(){
  var list=allUpgradeTargets().filter(function(o){ return upgradeCost(o.it)!==null; });
  var done=false;
  var html='<p class="c-info">Choose one piece of gear to raise by +1. A cursed item is cleansed instead.</p>'+list.map(function(o,i){
    return '<div class="frow"><div class="ftext"><b>'+gearName(o.it)+'</b> <span class="c-info">('+o.where+')</span></div><button data-asc="'+i+'">'+(o.it.cursed?'Cleanse':'Raise')+'</button></div>'; }).join('');
  openModal('Sigil of Ascension', html, [{label:'Keep the sigil', fn:function(){ if(!done){ done=true; addBag('✦', SIGILS.ascension.name, {kind:'sigil', data:{use:'ascension'}, uid:'sigil:ascension'}); log('You set the sigil aside.','c-info'); } closeModal(); updateUI(); }}]);
  document.querySelectorAll('[data-asc]').forEach(function(b){ b.onclick=function(){
    if(done) return; done=true;
    var it=list[+b.getAttribute('data-asc')].it, cost=upgradeCost(it);
    player.essence+=cost; upgradeItem(it);   /* same result as a Forge upgrade, paid by the sigil */
    closeModal(); updateUI();
  }; });
}

/* ---------------------------------------------------------------- lasting effects: haste, mana flow, cinder trail */
var _deriveSig = derive;
derive = function(p){ _deriveSig(p); if(p.buffs){ if(p.buffs.cinder>0) p.speed=Math.round(p.speed*1.5); else if(p.buffs.haste>0) p.speed=Math.round(p.speed*1.3); } };
var _endTurnSig = endTurn;
endTurn = function(){
  if(player && player.buffs && player.buffs.cinder>0 && player._cinderAt && (player._cinderAt.x!==player.x || player._cinderAt.y!==player.y)){
    var c=player._cinderAt; if(!(c.x===player.x&&c.y===player.y)) fireT[idxOf(c.x,c.y)]=Math.max(fireT[idxOf(c.x,c.y)],3);
  }
  if(player) player._cinderAt={x:player.x, y:player.y};
  _endTurnSig();
  if(player && player.buffs && player.buffs.manaflow>0 && player.hp>0){ player.mp=Math.min(player.maxmp, player.mp + player.maxmp*0.009); }
};


/* ---------------------------------------------------------------- 2026-09-17: Water, Smoke and Rot helpers */
function identifySigilQuiet(k){ if(!SIGILS[k] || sigilKnown[k]) return; sigilKnown[k]=true; player.bag.forEach(function(b){ if(b.kind==='sigil' && b.data.use===k) b.name=SIGILS[k].name; }); }
function douseAround(r){
  var n=0; for(var dy=-r;dy<=r;dy++) for(var dx=-r;dx<=r;dx++){ var x=player.x+dx, y=player.y+dy; if(inb(x,y) && fireT[idxOf(x,y)]){ fireT[idxOf(x,y)]=0; n++; } }
  if(n) log('Water hisses over the flames.','c-info');
  return n;
}

/* Smoke: floorMeta.smoke = {cells:[tile indexes], until:turn}. Vision inside and across it is 1 tile, both ways. */
function smokeMask(){
  var sm=floorMeta && floorMeta.smoke; if(!sm || turn>=sm.until+2) return null;
  if(!sm._mask || sm._mask.length!==MW*MH){ sm._mask=new Uint8Array(MW*MH); sm.cells.forEach(function(i){ sm._mask[i]=1; }); }
  return sm;
}
function smokeActive(){ var sm=smokeMask(); return sm && turn<sm.until ? sm : null; }
function inSmoke(x,y){ var sm=smokeActive(); return !!(sm && inb(x,y) && sm._mask[idxOf(x,y)]); }
function raiseSmoke(){
  var cells=[], rm=roomAt(player.x,player.y);
  if(rm){ for(var y=rm.y-1;y<=rm.y+rm.h;y++) for(var x=rm.x-1;x<=rm.x+rm.w;x++) if(inb(x,y) && at(x,y)!==WALL) cells.push(idxOf(x,y)); }
  else { for(var dy=-4;dy<=4;dy++) for(var dx=-4;dx<=4;dx++){ var xx=player.x+dx, yy=player.y+dy; if(inb(xx,yy) && at(xx,yy)!==WALL) cells.push(idxOf(xx,yy)); } }
  floorMeta.smoke={cells:cells, until:turn+12};
  var lost=0;
  ents.forEach(function(e){ if(e.foe && e.state==='hunt' && dist(e,player)>1){ e.state='wander'; e.lastSeen=null; e.smokeLost=true; lost++; } });
  burst(player.x,player.y,'dark',80,0.1);
  log('Choking smoke pours out and swallows the room.'+(lost?' Your pursuers lose you.':''),'c-good');
  computeFOV();
}
var _computeFOVSmoke = computeFOV;
computeFOV = function(radius){
  _computeFOVSmoke(radius);
  var sm=smokeActive(); if(!sm || !vis) return;
  var me=sm._mask[idxOf(player.x,player.y)];
  for(var i=0;i<vis.length;i++){
    if(!vis[i]) continue;
    var x=i%MW, y=(i/MW)|0; if(Math.max(Math.abs(x-player.x),Math.abs(y-player.y))<=1) continue;
    if(me || sm._mask[i]) vis[i]=0;   /* inside: nothing past 1 tile; outside: nothing inside the smoke */
  }
};
/* stealth counts smoke as a dark room; an enemy that lost you in the smoke can be surprised */
if(typeof stealthScore==='function'){ var _stealthSmoke=stealthScore; stealthScore=function(){ var s=_stealthSmoke(); if(s>0 && inSmoke(player.x,player.y)){ var rm=roomAt(player.x,player.y); if(!(rm && rm.dark)) s+=0.25; } return s; }; }
function smokeAmbush(def){ return !!(def && def.smokeLost && def.state!=='hunt' && smokeActive()); }
var _aiActSmoke = aiAct;
aiAct = function(e){ if(e.smokeLost && (e.state==='hunt' || !smokeActive())) e.smokeLost=false; return _aiActSmoke(e); };
var _endTurnSmoke = endTurn;
endTurn = function(){
  _endTurnSmoke();
  var sm=floorMeta && floorMeta.smoke; if(!sm) return;
  if(turn===sm.until){ log('The smoke thins.','c-info'); computeFOV(); }
  if(turn>=sm.until+2) floorMeta.smoke=null;
};
var _drawTelegraphsSmoke = drawTelegraphs;
drawTelegraphs = function(now){
  _drawTelegraphsSmoke(now);
  var sm=smokeMask(); if(!sm) return;
  var fade = turn<sm.until ? 1 : Math.max(0, 1-(turn-sm.until+1)/3), t=(now||0)/1000;
  ctx.save();
  for(var k=0;k<sm.cells.length;k++){
    var i=sm.cells[k]; if(!(revealAll||seen[i])) continue;
    var x=i%MW, y=(i/MW)|0, px=(x-camX)*TS, py=(y-camY)*TS;
    if(px<-TS || py<-TS || px>cv.width || py>cv.height) continue;
    var wob = ANIM.reduce ? 0 : Math.sin(t*0.8 + x*0.7 + y*1.3)*0.06;
    ctx.fillStyle='rgba(58,54,60,'+((0.46+wob)*fade).toFixed(3)+')';
    ctx.fillRect(px,py,TS,TS);
  }
  ctx.restore();
};

/* Rot: choose a cursed worn item to destroy */
function knowPicker(){
  var list=[];
  wornGear().forEach(function(it){ if(it && it.unid) list.push({it:it, where:'worn'}); });
  player.bag.forEach(function(b){ if(b.data && b.data.unid) list.push({it:b.data, where:'in your bag'}); });
  if(!list.length){ log('Nothing you carry or wear is a mystery.','c-info'); return; }
  if(list.length===1){ identifyGear(list[0].it); refreshBagNames(); updateUI(); refreshSheet && refreshSheet(); return; }
  var done=false;
  var html='<p class="c-info">Clear water runs over one piece. Choose what to read - a curse shows before you put it on.</p>'+
    list.map(function(o,i){ return '<div class="frow"><div class="ftext"><b>'+(o.it.name||'Unknown')+'</b> <span class="c-info">('+o.where+')</span></div>'+
      '<button data-know="'+i+'">Read it</button></div>'; }).join('');
  openModal('Water sigil', html, [{label:'Keep the sigil', fn:function(){
    if(!done){ done=true; addBag('✦', SIGILS.identify.name, {kind:'sigil', data:{use:'identify'}, uid:'sigil:identify'}); log('You set the sigil aside.','c-info'); }
    closeModal(); updateUI(); }}]);
  document.querySelectorAll('[data-know]').forEach(function(b){ b.onclick=function(){
    if(done) return; done=true;
    var o=list[+b.getAttribute('data-know')];
    identifyGear(o.it); refreshBagNames();
    sfx('identify'); closeModal(); updateUI(); if(typeof refreshSheet==='function') refreshSheet();
  }; });
}
function rotPicker(){
  var slots=[];
  var main=player.sets[player.activeSet]; if(main) slots.push({it:main, where:'main hand', gone:function(){ player.sets[player.activeSet]=null; }});
  if(player.off && player.off!==EMPTY_OFF) slots.push({it:player.off, where:'off hand', gone:function(){ player.off=EMPTY_OFF; }});
  if(player.armorItem) slots.push({it:player.armorItem, where:'armor', gone:function(){ var r=clone(ARMORS.robe); r.name='Rags'; r.plus=0; player.armorItem=r; }});
  if(player.amulet) slots.push({it:player.amulet, where:'amulet', gone:function(){ player.amulet=null; }});
  (player.rings||[]).forEach(function(r, n){ if(r) slots.push({it:r, where:'ring '+(n+1), gone:function(){ player.rings[n]=null; }}); });
  var done=false;
  var html='<p class="c-info">Choose a cursed item. It rots away and is gone for good.</p>'+slots.map(function(o,i){
    return '<div class="frow"><div class="ftext"><b>'+gearName(o.it)+'</b> <span class="c-info">('+o.where+')</span></div>'+
      '<button data-rot="'+i+'"'+(o.it.cursed?'':' disabled title="Only cursed items can be rotted away"')+'>'+(o.it.cursed?'Rot away':'Not cursed')+'</button></div>'; }).join('');
  openModal('Sigil of Rot', html, [{label:'Keep the sigil', fn:function(){ if(!done){ done=true; addBag('✦', SIGILS.rot.name, {kind:'sigil', data:{use:'rot'}, uid:'sigil:rot'}); log('You set the sigil aside.','c-info'); } closeModal(); updateUI(); }}]);
  document.querySelectorAll('[data-rot]').forEach(function(b){ b.onclick=function(){
    if(done) return; var o=slots[+b.getAttribute('data-rot')]; if(!o.it.cursed) return; done=true;
    var nm=gearName(o.it); o.gone(); derive(player); if(typeof refreshBagNames==='function') refreshBagNames();
    burst(player.x,player.y,'dark',40,0.08); sfx('wrath');
    log('Your <b>'+nm+'</b> blackens, softens and falls away to nothing. The curse goes with it.','c-kill');
    closeModal(); if(typeof abilityBar==='function') abilityBar(); updateUI();
  }; });
}
