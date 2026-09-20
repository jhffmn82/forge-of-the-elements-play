/* =====================================================================
   gear.js - rings (passive), amulets (activated, recharge), unidentified
   gear and curses. Loads after create.js and wraps the functions it
   extends, so the base game keeps working if this file is left out.
   Design notes: DESIGN.md 6.6 "Rings, amulets, identification, curses".
   ===================================================================== */

/* ---------------------------------------------------------------- tables */
/* rings: power is the ring's plus, +1..+3, or -1..-3 for a cursed one; every effect is step x power */
var RINGS = {
  protection: {name:'Ring of Protection', step:1,    unit:'armor',            desc:'Armor.'},
  evasion:    {name:'Ring of Evasion',    step:5,    unit:'evasion',          desc:'Evasion.'},
  accuracy:   {name:'Ring of Accuracy',   step:5,    unit:'accuracy',         desc:'Accuracy.'},
  vitality:   {name:'Ring of Vitality',   step:0.08, unit:'% max HP',         pct:true, desc:'Maximum HP.'},
  wizardry:   {name:'Ring of Wizardry',   step:0.08, unit:'% max mana, spell damage', pct:true, desc:'Maximum mana and spell damage.'},
  striking:   {name:'Ring of Striking',   step:1,    unit:'weapon damage',    desc:'Weapon damage.'},
  mending:    {name:'Ring of Mending',    step:0.30, unit:'% HP regeneration',pct:true, desc:'HP regeneration.'},
  sustenance: {name:'Ring of Sustenance', step:0.15, unit:'% less hunger',    pct:true, desc:'You get hungry more slowly.'},
  haste:      {name:'Ring of Haste',      step:0.05, unit:'% speed',          pct:true, desc:'Speed.'},
  warding:    {name:'Ring of Warding',    step:0.10, unit:'% elemental resistance', pct:true, desc:'Resistance to fire, ice, lightning, poison, light and dark.'},
  keeneyes:   {name:'Ring of Keen Eyes',  step:0.08, unit:'% trap spotting',  pct:true, desc:'Spot traps and hidden doors more easily.'},
  luck:       {name:'Ring of Luck',       step:0.25, unit:'% loot from enemies', pct:true, desc:'Enemies drop loot more often.'}
};
var RING_LOOKS = ['jade','ruby','iron','bone','opal','copper','obsidian','silver','amber','moonstone','coral','onyx'];

/* amulets: activated from the hotbar, then recharge. plus shortens the recharge 10% per point;
   a cursed amulet recharges 50% slower and fizzles a quarter of the time */
var AMULETS = {
  mending:  {name:'Amulet of Mending',  recharge:100, desc:'Heal 30% of your max HP.'},
  warding:  {name:'Amulet of Warding',  recharge:80,  desc:'A ward absorbs damage equal to 30% of your max HP for 10 turns.'},
  fury:     {name:'Amulet of Fury',     recharge:90,  desc:'Rampage for 8 turns: +40% melee damage and +20% speed.'},
  thunder:  {name:'Amulet of Thunder',  recharge:70,  desc:'Lightning bursts out: enemies within 2 take lightning damage and are stunned for 1 turn.'},
  embers:   {name:'Amulet of Embers',   recharge:70,  desc:'Flames burst out: enemies within 2 take fire damage and start Burning.'},
  wellspring:{name:'Amulet of the Wellspring', recharge:90, desc:'Restore 40% of your max mana.'},
  shadows:  {name:'Amulet of Shadows',  recharge:100, desc:'Vanish for 6 turns; hunting enemies lose track of you.'},
  blinking: {name:'Amulet of Blinking', recharge:50,  desc:'Teleport to a spot you can see 3 to 6 tiles away.'}
};
var AMULET_LOOKS = ['sun','fang','eye','feather','skull','tear','star','knot','wheat'];

/* how much use identifies a piece of gear */
var ID_USE = {weapon:20, armor:20, off:150, ring:300, amulet:3};

/* ---------------------------------------------------------------- per-run looks */
function shuffleTrinkets(){
  var r=mulberry32((worldSeed^0x5eed77)>>>0);
  function shuffled(a){ a=a.slice(); for(var i=a.length-1;i>0;i--){ var j=Math.floor(r()*(i+1)); var t=a[i]; a[i]=a[j]; a[j]=t; } return a; }
  var rl=shuffled(RING_LOOKS), al=shuffled(AMULET_LOOKS);
  RUN.ringLook={}; RUN.amuletLook={}; RUN.ringKnown={}; RUN.amuletKnown={};
  Object.keys(RINGS).forEach(function(k,i){ RUN.ringLook[k]=rl[i%rl.length]; });
  Object.keys(AMULETS).forEach(function(k,i){ RUN.amuletLook[k]=al[i%al.length]; });
}

/* ---------------------------------------------------------------- making gear */
function ensureTrinketLooks(){ if(!RUN.ringLook || !RUN.amuletLook) shuffleTrinkets(); }
function makeRing(type, cursed){
  ensureTrinketLooks();
  type = type || pick(Object.keys(RINGS));
  /* +1 is common, +2 uncommon, +3 rare (and only from floor 3) */
  var roll=rng(), plus = cursed ? -ri(1,3) : (roll<0.6 ? 1 : roll<0.9 || floorNo<3 ? 2 : 3);
  return {kind:'ring', ring:type, name:RINGS[type].name, plus:plus, cursed:!!cursed, unid:true, icon:'item-ring-'+RUN.ringLook[type]};
}
function makeAmulet(type, cursed){
  ensureTrinketLooks();
  type = type || pick(Object.keys(AMULETS));
  var plus = cursed ? 0 : (rng()<0.3 ? ri(1,2) : 0);
  return {kind:'amulet', amulet:type, name:AMULETS[type].name, plus:plus, cursed:!!cursed, unid:true, charge:0, uses:0, icon:'item-amulet-'+RUN.amuletLook[type]};
}
function ringPower(r){ if(!r) return 0; return r.plus||0; }
function amuletRecharge(a){ var base=AMULETS[a.amulet].recharge; return Math.round(base * (a.cursed ? 1.5 : Math.max(0.5, 1-0.10*(a.plus||0)))); }

/* the floor and chest loot table: weapons 40, armor 25, off-hands 15, rings 12, amulets 8; 15% of found gear is cursed */
var _randomGearBase = randomGear;
randomGear = function(){
  var roll=rng(), cursed=rng()<0.15, it;
  if(roll<0.12) it={kind:'ring', it:makeRing(null, cursed)};
  else if(roll<0.20) it={kind:'amulet', it:makeAmulet(null, cursed)};
  else {
    it=_randomGearBase();
    it.it.unid=true;
    if(cursed){ it.it.cursed=true; it.it.plus=-ri(1,3); delete it.it.enchant; if(it.kind==='off'){ it.it.cursedOff=true; } }
  }
  return it;
};

/* ---------------------------------------------------------------- names and cards */
var _gearNameBase = gearName;
gearName = function(it){
  if(!it) return 'nothing';
  if(it.kind==='ring'){
    ensureTrinketLooks();
    if(it.unid && !RUN.ringKnown[it.ring]) return cap(RUN.ringLook[it.ring])+' ring';
    if(it.unid) return it.name+' ?';
    return it.name+' '+(ringPower(it)>=0?'+':'')+ringPower(it);
  }
  if(it.kind==='amulet'){
    ensureTrinketLooks();
    if(it.unid && !RUN.amuletKnown[it.amulet]) return cap(RUN.amuletLook[it.amulet])+' amulet';
    if(it.unid) return it.name+' ?';
    return it.name+(it.plus?' +'+it.plus:'')+(it.cursed?' (cursed)':'');
  }
  if(it.unid) return (it.tier && it.tier!=='Rusty' ? it.tier+' ' : '')+it.name+' ?';
  var n=_gearNameBase(it);
  if(it.cursed && it.plus<0) n=n.replace(' +'+it.plus, ' '+it.plus);
  if(it.cursed) n+=' (cursed)';
  return n;
};
function pctRow(label, v){ return '<div class="row"><span>'+label+'</span><b'+(v<0?' style="color:#D0605A"':'')+'>'+(v>=0?'+':'')+Math.round(v*100)+'%</b></div>'; }
function focusRows(it){
  var k=focusKey(it); if(!k) return '';
  if(k==='staff') return pctRow('Spell damage', focusBonus(it))+'<div class="row"><span>Spell range</span><b>+1</b></div>';
  if(k==='wand'){ var t=tierOf(WAND_THRIFT.base,it)+WAND_THRIFT.per*(it.plus||0); return pctRow('Spell damage', focusBonus(it))+pctRow('Spell mana cost', -(it.cursed?-Math.abs(t):t)); }
  if(it.cursed) return pctRow('Spell damage', focusBonus(it));
  return pctRow('Spell crit chance', tierOf(ORB_CRIT.base,it)+ORB_CRIT.per*(it.plus||0))+'<div class="hint">Spell crits deal x1.5.</div>';
}
function unidHint(it){
  if(!it || !it.unid) return '';
  var how = it.kind==='ring' ? 'wear it for a while' : it.kind==='amulet' ? 'use it a few times' : (it.dmg ? 'fight with it' : it.armor!==undefined ? 'take hits in it' : 'carry it into a few fights');
  return '<div class="hint" style="color:#C9A8FF">Unidentified: its bonus'+(it.kind==='ring'||it.kind==='amulet'?'':' and enchantment')+' are unknown, and it could be cursed. To learn it: '+how+', or read a Sigil of Knowing.</div>';
}
function ringLine(r){
  var R=RINGS[r.ring], pw=ringPower(r), v=R.step*pw;
  return (v>=0?'+':'')+(R.pct?Math.round(v*100):v)+(R.pct?'':' ')+R.unit;
}
function trinketCard(it){
  if(it.kind==='ring'){
    var known=!it.unid || RUN.ringKnown[it.ring];
    return '<div class="nm">'+gearName(it)+'</div>'+(known?'<div class="hint">'+RINGS[it.ring].desc+'</div>':'')+
      (!it.unid?'<div class="row"><span>Effect</span><b'+(it.cursed?' style="color:#D0605A"':'')+'>'+ringLine(it)+'</b></div>':'')+
      (it.cursed && !it.unid?'<div class="hint" style="color:#D0605A">Cursed: it will not come off until the curse is broken.</div>':'')+unidHint(it)+
      '<div class="hint">A ring works on its own while worn. Two ring slots.</div>';
  }
  var a=it, knownA=!a.unid || RUN.amuletKnown[a.amulet];
  return '<div class="nm">'+gearName(a)+'</div>'+(knownA?'<div class="hint">'+AMULETS[a.amulet].desc+'</div><div class="row"><span>Recharge</span><b>'+(a.unid?'?':amuletRecharge(a)+' turns')+'</b></div>':'')+
    (a.cursed && !a.unid?'<div class="hint" style="color:#D0605A">Cursed: recharges slowly, sometimes fizzles, and will not come off.</div>':'')+unidHint(a)+
    '<div class="hint">Put it on, then use it from the hotbar.</div>';
}
var _weaponCardBase = weaponCard;
weaponCard = function(w, worn){
  if(!w) return '';
  if(!w.unid) return _weaponCardBase(w, worn) + focusRows(w) + (w.cursed?'<div class="hint" style="color:#D0605A">Cursed: it will not leave your hand until the curse is broken.</div>':'');
  return '<div class="nm">'+gearName(w)+'</div><div class="row"><span>Base damage</span><b>'+w.dmg[0]+'&ndash;'+w.dmg[1]+'</b></div>'+
    '<div class="row"><span>Hands</span><b>'+(w.hands||1)+'</b></div>'+(w.range?'<div class="row"><span>Range</span><b>'+w.range+'</b></div>':'')+unidHint(w);
};
var _armorCardBase = armorCard;
armorCard = function(a, worn){
  if(!a) return '';
  if(!a.unid) return _armorCardBase(a, worn) + (a.cursed?'<div class="hint" style="color:#D0605A">Cursed: you cannot take it off until the curse is broken.</div>':'');
  return '<div class="nm">'+gearName(a)+'</div><div class="row"><span>Base armor</span><b>'+a.armor+'</b></div><div class="row"><span>Evasion</span><b>'+(a.eva||0)+'</b></div>'+unidHint(a);
};
var _bagCardBase = bagCard;
bagCard = function(it){
  if(it && (it.kind==='ring'||it.kind==='amulet')) return trinketCard(it.data);
  if(it && it.kind==='off' && !it.data.unid && focusKey(it.data)) return '<div class="nm">'+gearName(it.data)+'</div>'+focusRows(it.data)+(it.data.cursed?'<div class="hint" style="color:#D0605A">Cursed.</div>':'');
  if(it && it.kind==='off' && (it.data.unid || it.data.cursed)) return '<div class="nm">'+gearName(it.data)+'</div><div class="hint">'+(it.data.unid?'':it.data.note||'')+'</div>'+unidHint(it.data)+(it.data.cursed&&!it.data.unid?'<div class="hint" style="color:#D0605A">Cursed.</div>':'');
  return _bagCardBase(it);
};

/* ---------------------------------------------------------------- identification */
/* nothing but a curse gives an item a negative upgrade level, so treat one as proof of the other: a
   Masterwork staff reading -3 with no curse on it was the tell that this could drift apart (2026-09-17) */
function fixNegativePlus(it){ if(it && (it.plus||0)<0 && !it.cursed) it.cursed=true; return it; }
function identifyGear(it, quiet){
  fixNegativePlus(it);
  if(!it || !it.unid) return false;
  it.unid=false;
  if(it.kind==='ring') RUN.ringKnown[it.ring]=true;
  if(it.kind==='amulet') RUN.amuletKnown[it.amulet]=true;
  refreshBagNames();
  if(!quiet){ log('You now know your <b>'+gearName(it)+'</b>'+(it.cursed?' &mdash; <span class="c-you">it is cursed</span>':'')+'.','c-kill'); sfx('identify'); }
  return true;
}
function refreshBagNames(){ player.bag.forEach(function(b){ if(b.data && (b.kind==='weapon'||b.kind==='armor'||b.kind==='off'||b.kind==='ring'||b.kind==='amulet')) b.name=gearName(b.data); }); }
function wornGear(){
  var out=[];
  if(player.sets[player.activeSet]) out.push(player.sets[player.activeSet]);
  if(player.armorItem) out.push(player.armorItem);
  if(player.off && player.off!==EMPTY_OFF) out.push(player.off);
  (player.rings||[]).forEach(function(r){ if(r) out.push(r); });
  if(player.amulet) out.push(player.amulet);
  return out;
}
function useCount(it, kind, n){
  if(!it || !it.unid) return;
  it.useN=(it.useN||0)+(n||1);
  if(it.useN>=ID_USE[kind]) identifyGear(it);
}
/* a curse shows itself the moment you put the thing on */
function onPutOn(it){
  if(!it) return;
  if(it.cursed){ identifyGear(it, true); log('The <b>'+gearName(it)+'</b> tightens around you. <span class="c-you">It is cursed!</span>','c-you'); sfx('wrath'); }
  else if(it.kind==='ring' && it.unid && !RUN.ringKnown[it.ring]){ RUN.ringKnown[it.ring]=true; refreshBagNames(); log('You recognise it: a <b>'+RINGS[it.ring].name+'</b>. How strong it is, time will tell.','c-info'); }
}
function cursedBlock(it, what){
  if(it && it.cursed){ log('Your <b>'+gearName(it)+'</b> is cursed. It will not '+(what||'come off')+'.','c-you'); sfx('ui-error'); return true; }
  return false;
}

/* ---------------------------------------------------------------- derived stats */
var _deriveBase = derive;
derive = function(p){
  _deriveBase(p);
  if(!p.rings) p.rings=[null,null];
  var add={};
  p.rings.forEach(function(r){ if(!r) return; var v=RINGS[r.ring].step*ringPower(r); add[r.ring]=(add[r.ring]||0)+v; });
  p.ringFx=add;
  if(add.protection) p.armor=Math.max(0, p.armor+Math.round(add.protection));
  if(add.evasion) p.eva+=Math.round(add.evasion);
  if(add.accuracy) p.acc+=Math.round(add.accuracy);
  if(add.vitality) p.maxhp=Math.max(1, Math.round(p.maxhp*(1+add.vitality)));
  if(add.wizardry) p.maxmp=Math.max(1, Math.round(p.maxmp*(1+add.wizardry)));
  if(add.striking){ p.dmg=[Math.max(1,p.dmg[0]+Math.round(add.striking)), Math.max(1,p.dmg[1]+Math.round(add.striking))]; }
  if(add.haste) p.speed=Math.round(p.speed*(1+add.haste));
  /* a cursed weapon or armor's negative bonus is already in its plus; keep damage sane */
  p.dmg=[Math.max(1,p.dmg[0]), Math.max(1,p.dmg[1])];
  if(p.hp>p.maxhp) p.hp=p.maxhp;
  if(p.mp>p.maxmp) p.mp=p.maxmp;
};
function ringVal(k){ return (player.ringFx && player.ringFx[k]) || 0; }
var _spellPowerBase = spellPower;
spellPower = function(A){ return _spellPowerBase(A) * (1 + Math.max(-0.5, ringVal('wizardry')*2/3)); };
var _resistMultBase = resistMult;
resistMult = function(target, type){
  var m=_resistMultBase(target, type);
  if(target===player && type!=='phys' && type!=='magic' && ringVal('warding')) m=Math.max(0.1, m-ringVal('warding'));
  return m;
};

/* ---------------------------------------------------------------- the turn: recharge, rings, identify-by-wearing */
var _endTurnBase = endTurn;
endTurn = function(){
  if(player && player.hp>0){
    (player.rings||[]).forEach(function(r){ useCount(r, 'ring'); });
    if(player.off && player.off!==EMPTY_OFF && ents.some(function(e){ return e.foe && e.state==='hunt' && vis[idxOf(e.x,e.y)]; })) useCount(player.off, 'off');
    /* mending ring: a little extra regen; sustenance ring: give back part of the hunger this turn will cost */
    var mend=ringVal('mending'); if(mend && player.hunger>0 && !player.st.poison){ healPlayer(player.maxhp*0.0033*mend); }
    var sus=ringVal('sustenance'); if(sus){ player.hunger=Math.min(HUNGER_MAX, player.hunger + (player.movedThisTurn?moveCost():actCost(player))/100*sus); }
  }
  _endTurnBase();
  if(player && player.hp>0 && ringVal('keeneyes')>0){
    feats.forEach(function(f){ if(!f.found && vis[idxOf(f.x,f.y)] && dist(player,f)<=3 && rng()<ringVal('keeneyes')){ f.found=true; log('Your ring tingles: a <b>'+trapName(f.kind)+' trap</b>.','c-info'); } });
  }
};

/* identify weapons by fighting with them and armor by being hit in it */
var _attackBase = attack;
attack = function(att, def, mult, label){
  if(att===player && player.weapon && !player.weapon.unarmed) useCount(player.weapon, 'weapon');
  if(def===player && player.armorItem) useCount(player.armorItem, 'armor');
  return _attackBase(att, def, mult, label);
};

/* ---------------------------------------------------------------- bag and equipping */
var _bagEntryForBase = bagEntryFor;
bagEntryFor = function(it){
  if(it.kind==='ring') return ['○', gearName(it.it), {kind:'ring', data:it.it}];
  if(it.kind==='amulet') return ['☥', gearName(it.it), {kind:'amulet', data:it.it}];
  return _bagEntryForBase(it);
};
var _itemLabelBase = itemLabel;
itemLabel = function(it){ return (it.kind==='ring'||it.kind==='amulet') ? gearName(it.it) : _itemLabelBase(it); };
var _addBagBase = addBag;
addBag = function(icon, name, extra){
  extra=extra||{};
  if(extra.kind==='ring'||extra.kind==='amulet'){
    if(player.bag.length>=BAG_MAX){ log('Your bag is full.','c-info'); sfx('inventory-full'); return null; }
    var e={icon:icon, name:name, n:1, uid:'g'+(nextId++), kind:extra.kind, data:extra.data}; player.bag.push(e); return e;
  }
  return _addBagBase(icon, name, extra);
};
var _dropBagItemBase = dropBagItem;
dropBagItem = function(idx){
  var b=player.bag[idx]; if(!b) return;
  if(b.kind==='ring'||b.kind==='amulet'){
    var it={kind:b.kind, it:b.data, x:player.x, y:player.y}; items.push(it); player.bag.splice(idx,1); log('You drop '+gearName(b.data)+'.','c-info'); return;
  }
  _dropBagItemBase(idx);
};

function putOnRing(idx, slot){
  var b=player.bag[idx]; if(!b || b.kind!=='ring') return;
  if(!player.rings) player.rings=[null,null];
  if(slot===undefined) slot = !player.rings[0] ? 0 : !player.rings[1] ? 1 : 0;
  var old=player.rings[slot];
  if(old && cursedBlock(old)) return;
  player.rings[slot]=b.data; player.bag.splice(idx,1);
  if(old) addBag('○', gearName(old), {kind:'ring', data:old});
  onPutOn(b.data);
  derive(player); log('You slip on the <b>'+gearName(b.data)+'</b>.','c-good'); sfx('equip-armor'); endTurn();
}
function putOnAmulet(idx){
  var b=player.bag[idx]; if(!b || b.kind!=='amulet') return;
  var old=player.amulet;
  if(old && cursedBlock(old)) return;
  player.amulet=b.data; player.bag.splice(idx,1);
  /* put it straight on the hotbar, the way a new ability lands in a free slot */
  if(player.hotbar && !player.hotbar.some(function(h){ return h && h.type==='amulet'; })){
    for(var hz=0; hz<player.hotbar.length; hz++) if(!player.hotbar[hz]){ player.hotbar[hz]={type:'amulet'}; break; }
  }
  if(old) addBag('☥', gearName(old), {kind:'amulet', data:old});
  onPutOn(b.data);
  derive(player); log('You fasten the <b>'+gearName(b.data)+'</b>. Use it from the hotbar.','c-good'); sfx('equip-armor'); endTurn();
}
function takeOffRing(slot){
  var r=player.rings && player.rings[slot]; if(!r || cursedBlock(r)) return;
  if(player.bag.length>=BAG_MAX){ log('Your bag is full.','c-info'); return; }
  player.rings[slot]=null; addBag('○', gearName(r), {kind:'ring', data:r}); derive(player); log('You take off the '+gearName(r)+'.','c-info'); endTurn();
}
function takeOffAmulet(){
  var a=player.amulet; if(!a || cursedBlock(a)) return;
  if(player.bag.length>=BAG_MAX){ log('Your bag is full.','c-info'); return; }
  player.amulet=null; addBag('☥', gearName(a), {kind:'amulet', data:a}); derive(player); log('You take off the '+gearName(a)+'.','c-info'); endTurn();
}

var _useBagItemBase = useBagItem;
useBagItem = function(idx){
  var it=player.bag[idx]; if(!it) return;
  if(it.kind==='ring'){ putOnRing(idx); return; }
  if(it.kind==='amulet'){ putOnAmulet(idx); return; }
  /* cursed gear already in a slot will not come off */
  if(it.kind==='weapon' && cursedBlock(player.sets[player.activeSet], 'leave your hand')) return;
  if(it.kind==='armor' && cursedBlock(player.armorItem)) return;
  if(it.kind==='off' && cursedBlock(player.off, 'leave your hand')) return;
  var data=it.data, kind=it.kind;
  _useBagItemBase(idx);
  if((kind==='weapon'||kind==='armor'||kind==='off') && (player.sets[player.activeSet]===data || player.armorItem===data || player.off===data)) onPutOn(data);
  refreshBagNames();
};
var _equipFromBagBase = equipFromBag;
equipFromBag = function(idx, slot){
  var it=player.bag[idx]; if(!it) return;
  if(slot==='ring0'||slot==='ring1'){ if(it.kind!=='ring'){ log('That is not a ring.','c-info'); return; } putOnRing(idx, slot==='ring0'?0:1); return; }
  if(slot==='amulet'){ if(it.kind!=='amulet'){ log('That is not an amulet.','c-info'); return; } putOnAmulet(idx); return; }
  if(slot==='off' && it.kind==='weapon' && cursedBlock(player.off, 'leave your hand')) return;
  _equipFromBagBase(idx, slot);
};
var _swapWeaponBase = swapWeapon;
swapWeapon = function(){ if(cursedBlock(player.sets[player.activeSet], 'leave your hand')) return; _swapWeaponBase(); };
var _enforceHandsBase = enforceHands;
enforceHands = function(){
  if(player.twoHanded && player.off && player.off.cursed){
    /* a cursed off-hand item refuses to be put away: the two-hander goes back instead */
    var w=player.sets[player.activeSet]; player.sets[player.activeSet]=null; derive(player);
    addBag('⚔', gearName(w), {kind:'weapon', data:w});
    log('Your cursed <b>'+gearName(player.off)+'</b> will not let go, so the '+w.name+' goes back into your bag.','c-you'); return;
  }
  _enforceHandsBase();
};

/* ---------------------------------------------------------------- amulets in use */
function useAmulet(){
  var a=player.amulet; if(!a){ log('You are not wearing an amulet.','c-info'); return; }
  if(a.charge>0){ log('The '+gearName(a)+' is still recharging ('+a.charge+' turns).','c-info'); sfx('ui-error'); return; }
  a.charge=amuletRecharge(a);
  var first=a.unid && !RUN.amuletKnown[a.amulet];
  RUN.amuletKnown[a.amulet]=true;
  a.uses=(a.uses||0)+1; useCount(a, 'amulet');
  refreshBagNames();
  if(a.cursed && rng()<0.25){ log('The '+gearName(a)+' sputters and goes dark. Nothing happens.','c-you'); sfx('no-mana'); endTurn(); return; }
  var k=a.amulet, pw=1+0.1*(a.plus||0);
  setClip(player,'cast'); sfx('sigil-use');
  if(k==='mending'){ var h=Math.round(player.maxhp*0.30*pw*(hasGod('glimmer')?1+0.10*godRank():1)); healPlayer(h); floatText(player.x,player.y,'+'+h,'heal'); sparkleFx(player.x,player.y,'heal',30); }
  else if(k==='warding'){ player.buffs.arcaneward=10; player.ward=Math.round(player.maxhp*0.30*pw); ringFx(player.x,player.y,'#9FD8FF',2); log('A ward of '+player.ward+' settles over you.','c-good'); }
  else if(k==='fury'){ player.buffs.rampage=8; derive(player); ringFx(player.x,player.y,'#B8453A',2.5); }
  else if(k==='thunder' || k==='embers'){
    var type=k==='thunder'?'lightning':'fire';
    burst(player.x,player.y,type,50,0.1);
    ents.slice().forEach(function(e){ if(!e.foe || dist(player,e)>2) return;
      var d=applyDamage(e, Math.round((6+floorNo*2)*pw), type, player); floatText(e.x,e.y,String(d),type);
      if(k==='thunder') applyStatus(e,'stun',1); else applyStatus(e,'burn',3,sDMG(2));
      if(e.hp<=0) kill(e,player); });
    if(k==='embers') for(var dy=-1;dy<=1;dy++) for(var dx=-1;dx<=1;dx++) if(dx||dy) ignite(player.x+dx,player.y+dy,'player');
  }
  else if(k==='wellspring'){ var m=Math.round(player.maxmp*0.40*pw); player.mp=Math.min(player.maxmp,player.mp+m); floatText(player.x,player.y,'+'+m+' mp','magic'); sparkleFx(player.x,player.y,'water',24); }
  else if(k==='shadows'){ player.hidden=6; ents.forEach(function(e){ if(e.foe && e.state==='hunt'){ e.state='wander'; e.lastSeen=null; } }); sfx('vanish'); }
  else if(k==='blinking'){ var spots=[]; for(var y=0;y<MH;y++) for(var x=0;x<MW;x++) if(walkable(x,y) && vis[idxOf(x,y)] && dist(player,{x:x,y:y})<=6 && dist(player,{x:x,y:y})>=3 && !occupied(x,y)) spots.push({x:x,y:y});
    if(spots.length){ var s2=pick(spots); sparkleFx(player.x,player.y,'magic',20); player.x=s2.x; player.y=s2.y; player._lx=undefined; sparkleFx(s2.x,s2.y,'magic',20); } }
  log((first?'It is an <b>'+AMULETS[k].name+'</b>! ':'')+AMULETS[k].desc,'c-good');
  endTurn();
}

/* hotbar: the worn amulet gets a slot once, like a new ability */
var _syncHotbarBase = syncHotbar;
syncHotbar = function(){
  /* 2026-09-18: learning an ability, changing god or class and the forge all reset the hotbar (hotbar=null)
     so it rebuilds from abilities and prayers - which silently dropped the amulet and any potions on it.
     The last layout is remembered, and after a rebuild those entries go back to their old slots. */
  var rebuilt = !player.hotbar, prev = player._hotPrev || [];
  _syncHotbarBase();
  if(rebuilt){
    var fresh=player.hotbar.slice(), out=[null,null,null,null,null,null,null,null];
    function same(x,y){ return x && y && x.type===y.type && x.key===y.key && x.ref===y.ref; }
    function valid(h){
      if(!h) return false;
      if(h.type==='item') return player.bag.indexOf(h.ref)>=0;
      if(h.type==='amulet') return !!player.amulet;
      if(h.type==='ranged') return true;                       /* the bow slot is the player's own choice: it survives a rebuild (2026-09-20) */
      return fresh.some(function(f){ return same(f,h); });     /* abilities and prayers: still known */
    }
    prev.forEach(function(h, i){ if(i<8 && valid(h) && !out.some(function(o){ return same(o,h); })) out[i]=h; });
    fresh.forEach(function(f){                                   /* whatever is new goes in the first free slot */
      if(!f || out.some(function(o){ return same(o,f); })) return;
      var j=out.indexOf(null); if(j>=0) out[j]=f;
    });
    player.hotbar=out;
  }
  for(var i=0;i<8;i++){ var s=player.hotbar[i]; if(s && s.type==='amulet' && !player.amulet) player.hotbar[i]=null; }
  if(player.amulet){
    var id='m:'+(player.amulet.uidA || (player.amulet.uidA='a'+(nextId++)));
    if(!player.hotKnown[id]){
      player.hotKnown[id]=true;
      if(!player.hotbar.some(function(s){ return s && s.type==='amulet'; })){ for(var j=0;j<8;j++) if(!player.hotbar[j]){ player.hotbar[j]={type:'amulet'}; break; } }
    }
  }
  player._hotPrev = player.hotbar.slice();
};
var _pressSlotIndexBase = pressSlotIndex;
pressSlotIndex = function(i){
  var s=player.hotbar && player.hotbar[i];
  if(s && s.type==='amulet'){ useAmulet(); updateUI(); return; }
  _pressSlotIndexBase(i);
};
var _abilityBarBase = abilityBar;
abilityBar = function(){
  _abilityBarBase();
  var btns=$('hotbar').querySelectorAll('.slot[data-i]');
  for(var i=0;i<btns.length;i++){
    var idx=+btns[i].getAttribute('data-i'), s=player.hotbar[idx];
    if(!s || s.type!=='amulet' || !player.amulet) continue;
    var a=player.amulet, ready=!(a.charge>0);
    var b=document.createElement('button');
    b.className='slot hasico'; b.setAttribute('data-i', idx); b.title=AMULETS[a.amulet] ? gearName(a) : 'Amulet';
    if(!ready) b.disabled=true;
    b.innerHTML='<span class="ico"></span><span class="k">'+(idx+1)+'</span><span class="n">'+gearName(a)+'</span><span class="c">'+(ready?'ready':a.charge+' turns')+'</span>';
    btns[i].replaceWith(b);
    (function(bb, ii){ bb.onclick=function(){ sfx('ui-click'); pressSlotIndex(ii); };
      bb.oncontextmenu=function(ev){ ev.preventDefault(); player.hotbar[ii]=null; abilityBar(); };
      dragSource(bb, 'hot:'+ii);
      var ico=bb.querySelector('.ico'); if(ico && (objArt('items',a.icon))) paintArt(ico,'items',a.icon,28); })(b, idx);
  }
};

/* ---------------------------------------------------------------- the Sigil of Knowing reads gear too */
var _useSigilBase = useSigil;
useSigil = function(use){
  var r=_useSigilBase(use);
  if(r!==false && use==='identify'){
    /* 2026-09-17: one piece of your choosing, worn or carried - you need to know about a curse BEFORE you
       put the thing on, and reading the whole pack made every unknown drop a non-decision. The Water
       sigil+ is the one that reads everything. */
    if(typeof knowPicker==='function') knowPicker();
  }
  return r;
};
if(SIGILS.identify) SIGILS.identify.desc='Identify every sigil you carry, and read one piece of gear of your choice.';

/* ---------------------------------------------------------------- breaking curses */
/* enchanting an item at the Forge burns a curse out of it */
var _enchantItemBase = enchantItem;
enchantItem = function(slot, el){
  var item = slot==='weapon' ? player.weapon : player.armorItem;
  var was = item && item.cursed;
  _enchantItemBase(slot, el);
  if(was && item.enchant===el){ breakCurse(item); }
};
function breakCurse(it){
  if(!it || !it.cursed) return false;
  it.cursed=false; it.unid=false;
  if(it.plus<0) it.plus=0;
  if(it.kind==='ring') it.plus=1;   /* a cleansed ring becomes a plain +1 */
  derive(player); refreshBagNames();
  log('The curse on your <b>'+gearName(it)+'</b> breaks.','c-kill'); sfx('puzzle-solved');
  return true;
}
/* Saint Glimmer's Consecrate also cleanses worn gear */
/* 2026-09-19: Consecrate used to break the curse on everything you wore - at rank 2, for 10 favor, without costing a
   turn, over and over. Justin: cursed gear is meant to be a real problem, and the Sigil of Purity (water+light) and the
   Forge already answer it. Consecrate now only does what its card says: cleanse your statuses and burn the undead. */

/* ---------------------------------------------------------------- enemy loot */
function rollDrops(e, byPlayerSide){
  if(!byPlayerSide || e.noXp || e.shade) return;
  var D=DROPS[e.kind] || {chance:0.12, table:{essence:8, gear:1, sigil:1}};
  var chance=Math.min(0.95, D.chance*(1+(e.elite?1:0)) * Math.max(0, 1+ringVal('luck')));
  if(rng()>=chance) return;
  var total=0, k; for(k in D.table) total+=D.table[k];
  var r=rng()*total, pickK='essence'; for(k in D.table){ r-=D.table[k]; if(r<0){ pickK=k; break; } }
  var spot = !itemAt(e.x,e.y) && walkable(e.x,e.y) ? {x:e.x,y:e.y} : (nearFree(e.x,e.y,1) || {x:e.x,y:e.y});
  var it = pickK==='gear' ? randomGear() : pickK==='sigil' ? {kind:'sigil', use:randomSigilUse()} : pickK==='food' ? {kind:'food', food:randomFood()}
         : {kind:'essence', n:ri(3,8)+floorNo*2};
  it.x=spot.x; it.y=spot.y; items.push(it);
  if(pickK!=='essence') log('The '+e.name+' drops '+(pickK==='gear'?'something':'a '+pickK)+'.','c-good');
}

/* ---------------------------------------------------------------- new runs */
var _newRunBase = newRun;
newRun = function(seed, choice){
  _newRunBase(seed, choice);
  player.rings=[null,null]; player.amulet=null;
  ensureTrinketLooks();
  derive(player); updateUI();
};
