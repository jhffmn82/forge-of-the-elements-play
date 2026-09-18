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
    var plus = (typeof itemPlus==='function' ? itemPlus(b) : (b.plus||0))
             + (hasGod('anvil') ? godRank() : 0) + (buff('temper') ? 2 : 0);
    p.rangedDmg = [sDMG(b.dmg[0]) + plus, sDMG(b.dmg[1]) + plus];
    p.rangedAcc = 60 + 2*p.stats.agi + (b.acc||0) + (hasGod('reginald') ? 4*godRank() : 0) + (buff('rally') ? 10 : 0);
  } else {
    /* no bow: range is whatever the main hand itself reaches (a wand, a thrown weapon) */
    p.range = p.weapon && p.weapon.range ? p.weapon.range + (p.rangeBonus||0) : 1;
    p.rangedDmg = null;
    p.rangedAcc = null;
  }
  return r;
};

/* ---------------------------------------------------------------- shooting: the bow answers for the shot
   The whole attack pipeline reads player.weapon, so the bow steps into that slot for the duration of a
   ranged attack and steps out again - the same trick the off-hand swing uses. That means a bow's tier,
   upgrades and enchantment all apply to the shot, for free. */
var _attackRanged = attack;
attack = function(att, def, mult, label){
  if(att !== player || !def || !isRangedWeapon(player.ranged) || dist(player, def) <= 1)
    return _attackRanged(att, def, mult, label);
  var mainW = player.weapon, mainDmg = player.dmg;
  player.weapon = player.ranged;
  if(player.rangedDmg) player.dmg = player.rangedDmg;
  try { return _attackRanged(att, def, mult, label); }
  finally { player.weapon = mainW; player.dmg = mainDmg; }
};

/* ---------------------------------------------------------------- equipping goes to the right slot */
var _useBagItemRanged = useBagItem;
useBagItem = function(idx){
  var b = player.bag[idx];
  if(b && b.kind==='weapon' && isRangedWeapon(b.data)){
    if(typeof reqBlock==='function' && reqBlock(tierNormalize(b.data))) return;
    var old = player.ranged;
    player.ranged = b.data;
    player.bag.splice(idx, 1);
    if(old) addBag('⚔', gearName(old), {kind:'weapon', data:old});
    derive(player);
    log('You sling the <b>'+gearName(player.ranged)+'</b> across your back. It answers anything out of reach.','c-good');
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

/* the swap button and its hotbar entry have nothing to do any more */
(function(){
  function hideSwap(){
    var b = document.getElementById('bSwap'); if(b) b.style.display='none';
    if(player && player.hotbar){
      for(var i=0;i<player.hotbar.length;i++){ var s=player.hotbar[i]; if(s && s.type==='swap') player.hotbar[i]=null; }
    }
  }
  var _newRunRanged = newRun;
  newRun = function(seed, choice){ var r=_newRunRanged(seed, choice); migrateRangedSlot(); derive(player); hideSwap(); return r; };
  if(typeof loadSlot==='function'){
    var _loadSlotRanged = loadSlot;
    loadSlot = function(){ var r=_loadSlotRanged.apply(this, arguments); if(player){ migrateRangedSlot(); derive(player); hideSwap(); } return r; };
  }
  window.addEventListener('load', function(){ setTimeout(hideSwap, 400); });
})();
