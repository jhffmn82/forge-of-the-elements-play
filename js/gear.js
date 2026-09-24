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
  wizardry:   {name:'Ring of Wizardry',   step:0.08, unit:'% max mana, two thirds of that to spell damage', pct:true, desc:'Maximum mana and spell damage.'},
  striking:   {name:'Ring of Striking',   step:1,    unit:'weapon damage',    desc:'Weapon damage.'},
  mending:    {name:'Ring of Mending',    step:0.33, unit:'% of max HP healed each turn',pct:true, desc:'Extra HP regeneration while fed and not poisoned.'},
  sustenance: {name:'Ring of Sustenance', step:0.15, unit:'% less hunger',    pct:true, desc:'You get hungry more slowly.'},
  haste:      {name:'Ring of Haste',      step:0.05, unit:'% speed',          pct:true, desc:'Speed.'},
  warding:    {name:'Ring of Warding',    step:0.10, unit:'% elemental resistance', pct:true, desc:'Resistance to fire, ice, lightning, poison, light and dark.'},
  keeneyes:   {name:'Ring of Keen Eyes',  step:0.08, unit:'% trap spotting',  pct:true, desc:'Spot traps and hidden doors more easily.'},
  luck:       {name:'Ring of Luck',       step:0.25, unit:'% loot from enemies', pct:true, desc:'Enemies drop loot more often.'}
};
var RING_LOOKS = ['jade','ruby','iron','bone','opal','copper','obsidian','silver','amber','moonstone','coral','onyx'];

/* amulets: activated from the hotbar, then recharge. plus shortens the recharge 10% per point;
   a cursed amulet recharges 50% slower and fizzles a quarter of the time */


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


/* the floor and chest loot table: weapons 40, armor 25, off-hands 15, rings 12, amulets 8; 15% of found gear is cursed */


/* ---------------------------------------------------------------- names and cards */


function pctRow(label, v){ return '<div class="row"><span>'+label+'</span><b'+(v<0?' style="color:#D0605A"':'')+'>'+(v>=0?'+':'')+Math.round(v*100)+'%</b></div>'; }
function focusRows(it){
  var k=focusKey(it); if(!k) return '';
  if(k==='staff') return pctRow('Spell damage', focusBonus(it))+'<div class="row"><span>Spell range</span><b>+1</b></div>';
  if(k==='wand'){ var t=tierOf(WAND_THRIFT.base,it)+WAND_THRIFT.per*(it.plus||0); return pctRow('Spell damage', focusBonus(it))+pctRow('Spell mana cost', -(it.cursed?-Math.abs(t):t)*gearPassiveBonus()); }
  if(it.cursed) return pctRow('Spell damage', focusBonus(it));
  return pctRow('Crit chance', (tierOf(ORB_CRIT.base,it)+ORB_CRIT.per*(it.plus||0))*gearPassiveBonus());
}
function unidHint(it){
  if(!it || !it.unid) return '';
  var how = it.kind==='ring' ? 'wear it for a while' : it.kind==='amulet' ? 'use it a few times' : (it.dmg ? 'fight with it' : it.armor!==undefined ? 'take hits in it' : 'carry it into a few fights');
  return '<div class="hint" style="color:#C9A8FF">Unidentified: its bonus'+(it.kind==='ring'||it.kind==='amulet'?'':' and enchantment')+' are unknown, and it could be cursed. To learn it: '+how+', or read a Sigil of Knowing.</div>';
}
/* Mending's stored ring bonus is a regeneration coefficient, not an HP fraction.
   Keep its existing healing rate shared by the simulation and item description. */
function mendingRate(value){return .0033*value;}
function ringLine(r){
  var R=RINGS[r.ring], pw=ringPower(r), v=R.step*pw*gearPassiveBonus();
  if(r.ring==='mending')return (v>=0?'+':'')+Number((mendingRate(v)*100).toFixed(2))+R.unit;
  return (v>=0?'+':'')+(R.pct?Math.round(v*100):Math.round(v*100)/100)+(R.pct?'':' ')+R.unit;
}


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
  /* 2026-09-20: the bow in the ranged slot is worn like anything else. It was left out, so a cursed bow never
     announced itself, never locked on, and the Sigil of Purity washed over everything except the thing that was
     cursed. Justin lost a run to a -3 bow he could not see or shed. */
  if(player.ranged && player.ranged!==EMPTY_OFF && out.indexOf(player.ranged)<0) out.push(player.ranged);
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


function ringVal(k){ return (player.ringFx && player.ringFx[k]) || 0; }


/* ---------------------------------------------------------------- the turn: recharge, rings, identify-by-wearing */

function turnIdentifyGear(context){
  if(!player||player.hp<=0)return;
  (player.rings||[]).forEach(function(r){useCount(r,'ring');});
  if(player.off&&player.off!==EMPTY_OFF&&turnInCombat())useCount(player.off,'off');

}

/* identify weapons by fighting with them and armor by being hit in it */


/* ---------------------------------------------------------------- bag and equipping */


/* ---------------------------------------------------------------- amulets in use */


/* hotbar: the worn amulet gets a slot once, like a new ability */


/* ---------------------------------------------------------------- the Sigil of Knowing reads gear too */


if(SIGILS.identify) SIGILS.identify.desc='Identify every sigil you carry, and read one piece of gear of your choice.';

/* ---------------------------------------------------------------- breaking curses */
/* enchanting an item at the Forge burns a curse out of it */


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
