/* =====================================================================
   rangedslot.js - the second weapon slot is a bow slot, and swapping is gone (2026-09-17).

   The two-weapon-set system let you stow anything and swap for a turn, which created a pile of edge cases -
   including a bow in the off hand vanishing on the swap - and asked the player to spend a turn to shoot.
   Now:
     - the second slot is RANGED. A bow (or anything with range > 1) lives there.
     - you shoot with it automatically whenever you attack something further than a tile away. No swapping,
       no turn spent changing weapons. Up close you swing your main hand as normal.
     - the off hand refuses ranged weapons, so that bug cannot happen at all.
   player.sets stays in the save for old characters; set 1 is migrated into player.ranged on load.
   ===================================================================== */

function isRangedWeapon(it){ return !!(it && it.kind!=='off' && (it.range||0) > 1); }

/* ---------------------------------------------------------------- migration: set 1 becomes the bow slot */
function migrateRangedSlot(){
  if(!player) return;
  if(player.ranged === undefined) player.ranged = null;
  if(player.sets && player.sets[1]){
    var stowed = player.sets[1];
    player.sets[1] = null;
    if(isRangedWeapon(stowed) && !player.ranged) player.ranged = stowed;
    else if(typeof addBag==='function') addBag('⚔', gearName(stowed), {kind:'weapon', data:stowed});
  }
  if(player.activeSet) player.activeSet = 0;
}

/* ---------------------------------------------------------------- what the bow does when it is drawn */
var _deriveRanged = derive;
derive = function(p){
  var r = _deriveRanged(p);
  if(p !== player) return r;
  var b = p.ranged;
  if(isRangedWeapon(b)){
    p.range = (b.range||1) + (p.rangeBonus||0);
    /* the bow's damage and accuracy are worked out below, by running the real derive with the bow in
       hand instead of copying its rules here. */
  } else {
    /* no bow: range is whatever the main hand itself reaches (a wand, a thrown weapon) */
    p.range = p.weapon && p.weapon.range ? p.weapon.range + (p.rangeBonus||0) : 1;
    p.rangedDmg = null;
    p.rangedAcc = null;
  }
  return r;
};

/* ---------------------------------------------------------------- the bow's real numbers
   2026-09-20: the bow's damage used to be worked out by hand up there - base plus upgrades - so a shot
   missed every bonus the melee path collects afterwards: the dwarf's per-tier bonus (tiers.js), Ring of
   Striking (gear.js), the Might buff (foods.js), a combo's damage (combos.js) and a god's weapon form
   (religion.js). And p.rangedAcc was written there and read nowhere at all, so a bow's accuracy - its own
   acc, Reginald's rank, Rally - did nothing.

   Rather than copy those rules a second time, run the real derive with the bow in the main hand and keep
   what it produces, then run it once more with the true weapon back so every other derived field is honest.
   Wrapped at window load so that every module which touches derive has already wrapped it and this one is
   outermost - the same reason js/ticks.js re-wraps there. */
function rangedFullDerive(){
  if(typeof derive !== 'function') return;
  var _deriveRangedFull = derive, inside = false;
  derive = function(p){
    var r = _deriveRangedFull(p);
    if(inside || p !== player) return r;
    if(!isRangedWeapon(p.ranged)){ p.rangedDmg = null; p.rangedAcc = null; p.rangedCrit = null; return r; }
    /* derive() rebuilds p.weapon from p.sets[p.activeSet] on its first line, so the bow has to be put in
       the set itself, not in the weapon slot, for the probe to mean anything. */
    var slot = p.activeSet, saved = p.sets[slot];
    inside = true;
    try {
      p.sets[slot] = p.ranged;
      _deriveRangedFull(p);
      var d = p.dmg, a = p.acc, c = p.crit;
      p.sets[slot] = saved;
      _deriveRangedFull(p);
      p.rangedDmg = d; p.rangedAcc = a; p.rangedCrit = c;
    } finally { inside = false; p.sets[slot] = saved; }
    return r;
  };
}
/* demo.html appends these files itself, so window's load event can have gone by before this line runs -
   registering a listener for it would then never fire. Install now if the page is already loaded. */
if(document.readyState === 'complete') rangedFullDerive();
else window.addEventListener('load', rangedFullDerive);

/* ---------------------------------------------------------------- shooting: the bow answers for the shot
   The whole attack pipeline reads player.weapon, so the bow steps into that slot for the duration of a
   ranged attack and steps out again - the same trick the off-hand swing uses. That means a bow's tier,
   upgrades and enchantment all apply to the shot, for free. */
var _attackRanged = attack;
attack = function(att, def, mult, label){
  if(att !== player || !def || !isRangedWeapon(player.ranged) || dist(player, def) <= 1 || player._reaching)   /* reach.js: the spear's own hit */
    return _attackRanged(att, def, mult, label);
  var mainW = player.weapon, mainDmg = player.dmg, mainAcc = player.acc, mainCrit = player.crit;
  player.weapon = player.ranged;
  if(player.rangedDmg) player.dmg = player.rangedDmg;
  if(player.rangedAcc) player.acc = player.rangedAcc;     /* 2026-09-20: the bow's accuracy finally counts */
  if(player.rangedCrit) player.crit = player.rangedCrit;
  try { return _attackRanged(att, def, mult, label); }
  finally { player.weapon = mainW; player.dmg = mainDmg; player.acc = mainAcc; player.crit = mainCrit; }
};

/* ---------------------------------------------------------------- equipping goes to the right slot */
var _useBagItemRanged = useBagItem;
useBagItem = function(idx){
  var b = player.bag[idx];
  if(b && b.kind==='weapon' && isRangedWeapon(b.data)){
    if(typeof reqBlock==='function' && reqBlock(tierNormalize(b.data))) return;
    /* 2026-09-20: the slot obeys a curse like every other. A cursed bow stays slung until the curse is broken,
       and putting one on says so - Justin carried a cursed -3 bow for a whole run without being told. */
    if(typeof cursedBlock==='function' && cursedBlock(player.ranged, 'come off your back')) return;
    var old = player.ranged;
    player.ranged = b.data;
    player.bag.splice(idx, 1);
    if(old) addBag('⚔', gearName(old), {kind:'weapon', data:old});
    derive(player);
    log('You sling the <b>'+gearName(player.ranged)+'</b> across your back. It answers anything out of reach.','c-good');
    if(typeof onPutOn==='function') onPutOn(player.ranged);
    sfx('equip-weapon'); endTurn(); return;
  }
  return _useBagItemRanged(idx);
};

var _equipFromBagRanged = equipFromBag;
equipFromBag = function(idx, slot){
  var b = player.bag[idx];
  if(slot==='ranged'){
    if(!b || b.kind!=='weapon' || !isRangedWeapon(b.data)){ log('Only a bow or another weapon with reach goes there.','c-info'); return; }
    return useBagItem(idx);
  }
  if(slot==='off' && b && b.data && isRangedWeapon(b.data)){
    log('A bow needs both hands. It goes in your ranged slot.','c-info'); sfx('ui-error'); return;
  }
  return _equipFromBagRanged(idx, slot);
};

function unequipRanged(){
  if(!player.ranged) return;
  if(typeof cursedBlock==='function' && cursedBlock(player.ranged, 'come off your back')) return;
  if(player.bag.length >= BAG_MAX){ log('Your bag is full.','c-info'); return; }
  var b = player.ranged; player.ranged = null; derive(player);
  addBag('⚔', gearName(b), {kind:'weapon', data:b});
  log('You unsling the '+gearName(b)+'.','c-info');
}

/* ---------------------------------------------------------------- swapping is retired */
swapWeapon = function(){
  log('Your '+(isRangedWeapon(player.ranged) ? gearName(player.ranged) : 'ranged weapon')+
      (isRangedWeapon(player.ranged) ? ' is always ready: attack anything further than a tile away and you shoot it.'
                                     : ' slot is empty. A bow there fires without swapping.'), 'c-info');
};

/* the hotbar's swap entry has nothing to do any more */
(function(){
  function hideSwap(){
    if(player && player.hotbar){
      for(var i=0;i<player.hotbar.length;i++){ var s=player.hotbar[i]; if(s && s.type==='swap') player.hotbar[i]=null; }
    }
  }
  var _newRunRanged = newRun;
  newRun = function(seed, choice){ var r=_newRunRanged(seed, choice); migrateRangedSlot(); derive(player); hideSwap(); return r; };
  if(typeof saveApply==='function'){
    var _saveApplyRanged = saveApply;
    saveApply = function(data){ var r=_saveApplyRanged(data); if(typeof player!=='undefined' && player){ migrateRangedSlot(); derive(player); hideSwap(); } return r; };
  }
  /* belt and braces: a floor change is a cheap place to catch anything that slipped through */
  if(typeof generate==='function'){
    var _generateRanged = generate;
    generate = function(seed){ var r=_generateRanged(seed); if(typeof player!=='undefined' && player && player.sets && player.sets[1]){ migrateRangedSlot(); derive(player); } return r; };
  }
  window.addEventListener('load', function(){ setTimeout(hideSwap, 400); });
})();

/* ---------------------------------------------------------------- clicking: the bow is for what is out of reach
   Two things went wrong once the bow moved to its own slot and stopped costing a turn to draw:

   1. clickIntent offered 'shoot' for anything inside the bow's range, an adjacent enemy included. Standing
      next to something and clicking it fired one arrow at the bow's up-close penalty (x0.7 to hit) instead of
      swinging - and skipped the off-hand strike entirely, so a dual-wielder lost half their attack. The
      cursor showed the bow glyph too. Next to you is melee; the bow answers what you cannot reach.
   2. game.js's shootAt() labels the log line with player.weapon.name, which it reads before the bow is
      swapped in - so every shot was logged under the name of whatever melee weapon was in your main hand
      ("Dagger: You hit the Goblin"). It names the weapon that actually looses the arrow now. */
if(typeof clickIntent === 'function'){
  var _clickIntentRanged = clickIntent;
  clickIntent = function(x, y){
    var it = _clickIntentRanged(x, y);
    if(it && it.kind === 'shoot' && it.foe && dist(player, it.foe) <= 1) return {kind:'attack', foe:it.foe};
    return it;
  };
}
if(typeof shootAt === 'function'){
  shootAt = function(e){
    if(!e) return false;
    if(dist(player, e) <= 1){                       /* the canvas click reaches here on its own path too */
      var dx = Math.sign(e.x - player.x), dy = Math.sign(e.y - player.y);
      lastDir = [dx, dy]; tryMove(dx, dy); return true;
    }
    if(player.range <= 1 || dist(player, e) > player.range || !vis[e.y*MW + e.x]) return false;
    /* 2026-09-22 (Justin): an arrow stops at the first creature in its path. A foe standing in the way takes the
       shot; an ally in the way, or a wall, means no shot (this override had dropped the original's path check, so
       a bow shot straight through a melee enemy to the mage behind it). */
    var path=boltPath(player.x, player.y, e.x, e.y), end=path[path.length-1];
    if(!end || end.x!==e.x || end.y!==e.y){
      var front=end && ents.filter(function(o){ return o.x===end.x && o.y===end.y && o.hp>0; })[0];
      if(!front || !front.foe){ log(front ? 'Your '+front.name+' is in the way.' : 'Something is in the way.','c-info'); return true; }
      log('The <b>'+front.name+'</b> is in the way and takes the arrow.','c-info'); e=front;
    }
    var w = isRangedWeapon(player.ranged) ? player.ranged : player.weapon;
    attack(player, e, 1, w.name);
    player.hidden = 0; endTurn(); return true;
  };
}

/* ---------------------------------------------------------------- the bow on the hotbar (2026-09-20)
   Justin: "it still isn't possible to drag an EQUIPED item to the hotbar... If you click on an inventory item in
   the hotbar, it just equips it. So there is no way to shoot a bow from a hotbar."
   The ranged slot on the Gear sheet is a drag source now (js/sheets.js, js/touchui.js) and the hotbar holds a
   'ranged' entry (js/ui.js). Pressing it draws on the nearest enemy it can actually reach and marks it the way a
   spell's auto-aim does (js/autoaim.js); pressing it again looses the arrow. Aiming costs no turn, so a wrong
   press costs nothing. Clicking an enemy on the map still shoots exactly as before. */
var BOWAIM = null;
function bowReady(){ return !!(player && isRangedWeapon(player.ranged)); }
function bowCanHit(e){
  return !!(e && e.foe && e.hp>0 && (revealAll||vis[idxOf(e.x,e.y)]) && dist(player,e)>1 && dist(player,e)<=player.range && (typeof clearShot!=='function' || clearShot(player,e)));
}
function bowLive(){ return (BOWAIM && ents.indexOf(BOWAIM)>=0 && bowCanHit(BOWAIM)) ? BOWAIM : null; }
function bowNextTarget(){
  var list=ents.filter(bowCanHit);
  if(!list.length) return null;
  /* nearest first, and among equals the most hurt - a second volley finishes what the first started */
  list.sort(function(a,b){ return (dist(player,a)-dist(player,b)) || (a.hp/a.maxhp - b.hp/b.maxhp); });
  var i=list.indexOf(BOWAIM);
  return list[(i+1) % list.length];
}
function bowSlotPress(){
  if(!bowReady()){ log('Nothing is slung across your back. Put a bow in your ranged slot first.','c-info'); return; }
  if(typeof aiming!=='undefined' && aiming && typeof cancelAim==='function') cancelAim();
  var live=bowLive();
  if(live){ BOWAIM=null; shootAt(live); return; }
  var e=bowNextTarget();
  if(!e){ BOWAIM=null; log('Nothing in sight is within the <b>'+gearName(player.ranged)+'</b>’s reach.','c-info'); return; }
  BOWAIM=e;
  log('You draw the <b>'+gearName(player.ranged)+'</b> on the <b>'+e.name+'</b>. Press again to loose.','c-info');
  if(typeof draw==='function') draw();
}
/* the mark: the same four thin corner brackets the spell aim uses, in the bow's own colour */
var _drawBowAim = draw;
draw = function(){
  var r=_drawBowAim.apply(this, arguments);
  var e=bowLive(); if(!e || typeof ctx==='undefined' || !ctx) return r;
  var ox=typeof camOX!=='undefined' ? camOX : 0, oy=typeof camOY!=='undefined' ? camOY : 0;
  var x0=(e.x-camX)*TS-ox+2, y0=(e.y-camY)*TS-oy+2, S=TS-4, c=Math.max(3, TS*0.13);
  ctx.save(); ctx.globalAlpha=0.7; ctx.strokeStyle='#9FD8FF'; ctx.lineWidth=1; ctx.beginPath();
  ctx.moveTo(x0, y0+c); ctx.lineTo(x0, y0); ctx.lineTo(x0+c, y0);
  ctx.moveTo(x0+S-c, y0); ctx.lineTo(x0+S, y0); ctx.lineTo(x0+S, y0+c);
  ctx.moveTo(x0, y0+S-c); ctx.lineTo(x0, y0+S); ctx.lineTo(x0+c, y0+S);
  ctx.moveTo(x0+S-c, y0+S); ctx.lineTo(x0+S, y0+S); ctx.lineTo(x0+S, y0+S-c);
  ctx.stroke(); ctx.restore();
  return r;
};
/* a turn passing makes the mark stale: monsters have moved. Aiming itself costs no turn. */
var _endTurnBowAim = endTurn;
endTurn = function(){ BOWAIM=null; return _endTurnBowAim.apply(this, arguments); };

/* a bow sitting in the bag keeps its hotbar slot when you equip it from there: the slot becomes the bow slot
   instead of going empty, so the press that equipped it is the last press that ever equips it. */
var _pressSlotIndexBow = pressSlotIndex;
pressSlotIndex = function(i){
  var s=player && player.hotbar && player.hotbar[i];
  if(s && s.type==='item' && s.ref && s.ref.kind==='weapon' && isRangedWeapon(s.ref.data)){
    var d=s.ref.data;
    _pressSlotIndexBow(i);
    if(player.ranged===d){ player.hotbar[i]={type:'ranged'}; abilityBar(); }
    return;
  }
  return _pressSlotIndexBow(i);
};
