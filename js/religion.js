/* =====================================================================
   religion.js - god changes from the mechanics review (2026-09-16,
   DESIGN.md 12 step 8). Grom fist tiers and Iron Hide overhealth;
   Glimmer's Light point and Guiding Light; Murk's Unholy Aura invoke and
   Raise Dead prayer; Reginald's crit and rank 3; Anvil's offering,
   Reforge cap and mote refunds; Vellum's instant Unbound; Wobbles'
   Greater Prayer. Invokes scale +3% per Focus point (combat.js castSelf).
   ===================================================================== */

/* ---------------------------------------------------------------- boon and prayer text */


/* 2026-09-20 (Justin): the free Light point is no longer a joining gift - it is what rank 5 is FOR. Undying
   Light comes down to rank 3 to take its old place, so she still reads as three boons and a rank-5 reward.
   Her boons unlock at 1 / 2 / 3 / 5 (godBoonRanks in gods.js); rank 2 for Guiding Light is the one number
   here that is not Justin's - PLACEHOLDER, it only moves the +5% Smite chance one rank earlier. */

/* ---------------------------------------------------------------- who a god refuses */
function refusalText(id){
  if(clericGodLocked(id)) return 'Clerics are bound to their chosen god and cannot convert.';
  var g=GODS[id];
  if(g.refuses && player.race===g.refuses) return g.name+' will not accept a '+RACES[player.race].name+'.';
  if(id==='reginald' && isScoundrel()) return 'Sir Reginald will not take a sneak-thief into his service.';
  if(id==='reginald' && (player.aff.shadow||0)>0) return 'Sir Reginald wants nothing to do with shadow.';

  if(id==='glimmer' && (player.aff.shadow||0)>0) return 'Saint Glimmer will not touch shadow.';
  if(id==='glimmer' && !canHoldLight()) return 'Saint Glimmer’s light needs room: Light must be able to be one of your two elements.';
  return g.name+' refuses you.';
}
function canHoldLight(){
  var els=Object.keys(player.aff).filter(function(k){ return player.aff[k]>0; });
  if(els.indexOf('light')>=0) return true;
  if(els.indexOf('shadow')>=0) return false;
  return els.length<2;
}
function godRefuses(id){
  if(clericGodLocked(id)) return true;
  var g=GODS[id];
  if(g.refuses && player.race===g.refuses) return true;
  if(id==='reginald' && (isScoundrel() || (player.aff.shadow||0)>0)) return true;

  if(id==='glimmer' && ((player.aff.shadow||0)>0 || !canHoldLight())) return true;
  return false;
}

/* ---------------------------------------------------------------- Glimmer's Light point (rank 5 from 2026-09-20) */
function grantGlimmerLight(){
  if(player.glimmerLight) return;
  /* the point arrives late now, so there may be no room left for it: a Gloomling is refused at the shrine,
     but anyone can fill both element slots between joining and rank 5. She waits rather than breaking the cap. */
  if(typeof canHoldLight==='function' && !canHoldLight()){
    log('<b>Saint Glimmer</b> would kindle Light in you, but there is no room left for it.','c-info');
    return;
  }
  player.glimmerLight=true;
  player.aff.light=(player.aff.light||0)+1;
  if(!player.primary) player.primary='light';
  log('<b>Saint Glimmer</b> kindles a point of <b>Light</b> in you.','c-kill');
}
/* granted at rank 5 and taken back the moment the rank drops below it (or she is abandoned) */

function takeGlimmerLight(){
  if(!player.glimmerLight) return;
  player.glimmerLight=false;
  player.aff.light=Math.max(0,(player.aff.light||0)-1);
  if(!player.aff.light) delete player.aff.light;
  if(player.primary==='light' && !player.aff.light) player.primary=Object.keys(player.aff)[0]||null;
  log('<b>Saint Glimmer</b> takes back the light he gave you.','c-you');
}


function smiteBonus(){return hasGod('glimmer')&&godRank()>=3?.05*godRank():0;}   /* Guiding Light is boon 2, and boon 2 unlocks at rank 2 now */

/* ---------------------------------------------------------------- Grom: fists by rank, armor, punch piety, Iron Hide */
var GROM_FISTS = [[1,3],[2,5],[3,6],[5,9],[5,9],[7,12]];


/* ---------------------------------------------------------------- Murk: Unholy Aura invoke, Raise Dead prayer */


var WOBBLE_BONUS=0;

/* a prayed servant has no timer */


/* ---------------------------------------------------------------- Reginald rank 3: Called Out */


/* ---------------------------------------------------------------- Anvil rank 3: Second Heat refunds motes */
function secondHeat(before){
  if(!Object.keys(before).some(function(k){return before[k]>(player.motes[k]||0);})) return;
  if(!hasGod('anvil') || godRank()<3 || rng()>=(0.30+0.10*(godRank()-3))) return;
  var back=0;
  for(var k in before){ var lost=before[k]-(player.motes[k]||0); if(lost>0){ player.motes[k]=(player.motes[k]||0)+lost; back+=lost; } }
  if(back) log('<b>Second Heat.</b> Old Anvil hands your mote'+(back>1?'s':'')+' back.','c-good');
}


/* Track spell actions for concealment and casting-time effects. */


/* ---------------------------------------------------------------- Wobbles: Greater Prayer */
function greaterPrayer(){
  var good=rng()<.65+wobbleBias(godRank()),roll=rng();sfx('wobbles-giggle');
  function drop(it){var s=nearFree(player.x,player.y,2)||player;it.x=s.x;it.y=s.y;items.push(it);}
  if(good){
    if(roll<.35 && (player.hp<player.maxhp||player.mp<player.maxmp)){player.hp=player.maxhp;player.mp=player.maxmp;clearBad();log('<b>Tempt Fate:</b> restoration.','c-good');}
    else if(roll<.65){for(var i=0;i<2;i++){var e=pick(ELEMENTS);player.motes[e]=(player.motes[e]||0)+1;}log('<b>Tempt Fate:</b> two elemental motes.','c-good');}
    else if(roll<.9){drop(randomGear());log('<b>Tempt Fate:</b> equipment.','c-good');}
    else {drop(rng()<.5?{kind:'ring',it:makeRing(null,false)}:{kind:'amulet',it:makeAmulet(null,false)});log('<b>Tempt Fate:</b> jewelry.','c-good');}
  }else if(roll<.35){
    var pool=ents.filter(function(e){return e.foe&&e.hp>0&&!(e.base&&e.base.boss)&&!e.elite;});
    for(var i=0;i<3;i++){var s=nearFree(player.x,player.y,3);if(s){var model=pool.length?pick(pool):null;var m=spawn(model?model.kind:'rat',s.x,s.y);m.state='hunt';m.noXp=true;m.noReward=true;}}
    log('<b>Tempt Fate:</b> an unrewarding ambush!','c-you');
  }else if(roll<.70){player.hp=Math.max(1,Math.ceil(player.hp/2));applyStatus(player,'blind',4);log('<b>Tempt Fate:</b> blood and sight.','c-you');}
  else if(roll<.95){var spots=safeWobbleSpots();if(spots.length){var s=pick(spots);player.x=s.x;player.y=s.y;player._lx=undefined;}log('<b>Tempt Fate:</b> displacement.','c-you');}
  else {var loss=Math.floor(player.essence/2);player.essence-=loss;log('<b>Tempt Fate:</b> '+loss+' essence lost.','c-you');}
  computeFOV();updateUI();
}


/* ---------------------------------------------------------------- who each god is (2026-09-20)
   Justin: "the faith tab should really show the artwork of the statue, maybe a little blurb about the god". The
   sheet was all rules and numbers; these are the few lines that say what kind of thing you have sworn to. */
var GOD_BLURB = {
  grom:     'A bare-knuckled god of the old sort, who thinks a weapon is an apology for weak arms. His shrines are worn smooth where fists have struck them.',
  grumbok:  'He hates wizards. That is the whole of his theology, and he pursues it with the patience of a man sharpening a very large axe.',
  glimmer:  'A saint, not a god: a healer who walked into the dark once too often and never quite came back. Her light mends what it touches and burns what should not be.',
  murk:     'Mother of the quiet dead. She does not raise her voice, and she does not think dying should end anyone\'s usefulness.',
  reginald: 'An adventurer who died of an ambush and took it personally. He asks only that you let them see you coming, and hit them anyway.',
  anvil:    'The smith below, who never sleeps and never asks what you did. Bring essence, and he will make your gear worthy of a better owner.',
  vellum:   'A book that reads itself, endlessly. Vellum remembers every spell ever spoken and wants nothing more than to hear them all again.',
  wobbles:  'Nobody knows what Wobbles is. He finds that funny. Amuse him and he is generous; bore him and he gets creative.',
  sylla:    'A drider carved in white stone, waiting with her legs folded beneath her. Sylla teaches that the fight is decided before it starts: web it, let it bleed, and be somewhere else when it dies.'
};
