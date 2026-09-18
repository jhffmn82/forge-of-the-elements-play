/* =====================================================================
   swapsets.js - two full weapon sets (2026-09-17).
   Each set has its own main hand and off hand. Swapping (x) trades both, and works with an empty set too
   (swap to bare fists). The Equipment sheet's stowed row has a main and an off-hand slot: drag from the
   bag to load them, right-click to put them back in the bag.
   ===================================================================== */

function ensureOffSets(){
  if(!player.offSets) player.offSets=[null,null];
  var cur=player.off && player.off!==EMPTY_OFF ? player.off : null;
  player.offSets[player.activeSet]=cur;
  return player.offSets;
}
function stowIdx(){ return 1-player.activeSet; }
function stowedMain(){ return player.sets[stowIdx()]; }
function stowedOff(){ ensureOffSets(); return player.offSets[stowIdx()]; }

swapWeapon = function(){
  ensureOffSets();
  var cur=player.sets[player.activeSet], curOff=player.off!==EMPTY_OFF ? player.off : null;
  if(!cur && !curOff && !stowedMain() && !stowedOff()){ log('You have no weapons to swap between.','c-info'); return; }
  if(typeof cursedBlock==='function' && (cursedBlock(cur, 'leave your hand') || cursedBlock(curOff, 'leave your hand'))) return;
  player.activeSet = stowIdx();
  player.off = player.offSets[player.activeSet] || EMPTY_OFF;
  ensureOffSets();
  derive(player);
  var w=player.sets[player.activeSet];
  log(w ? 'You ready your <b>'+gearName(w)+'</b>'+(player.off!==EMPTY_OFF ? ' and <b>'+gearName(player.off)+'</b>' : '')+'.' :
          player.off!==EMPTY_OFF ? 'You ready your <b>'+gearName(player.off)+'</b>, fists free.' : 'You stow your weapons and raise your fists.', 'c-info');
  sfx('equip-weapon');
  enforceHands(); ensureOffSets(); endTurn();
};

/* load the stowed set from the bag */
function equipStowMain(bi){
  var b=player.bag[bi]; if(!b) return;
  if(b.kind!=='weapon'){ log('Only a weapon fits the stowed main hand.','c-info'); return; }
  if(typeof reqBlock==='function' && reqBlock(tierNormalize(b.data))) return;
  ensureOffSets();
  var s=stowIdx(), old=player.sets[s];
  player.bag.splice(bi,1);
  player.sets[s]=b.data;
  if(old) addBag('⚔', gearName(old), {kind:'weapon', data:old});
  if((b.data.hands||1)===2 && player.offSets[s]){ var o=player.offSets[s]; player.offSets[s]=null; addBag('⛨', gearName(o), {kind:'off', data:o}); log('Both hands go on the '+b.data.name+'; the '+o.name+' goes into your bag.','c-info'); }
  log('You stow the <b>'+gearName(b.data)+'</b> as your second weapon.','c-good'); sfx('equip-weapon');
}
function equipStowOff(bi){
  var b=player.bag[bi]; if(!b) return;
  ensureOffSets();
  var s=stowIdx(), main=player.sets[s];
  if(main && (main.hands||1)===2){ log('The stowed '+main.name+' needs both hands.','c-info'); return; }
  var d=b.data;
  if(b.kind==='weapon'){
    if(d.hands===2 || !d.light){ log('Only a light weapon, shield or focus fits an off hand.','c-info'); return; }
    if(typeof reqBlock==='function' && reqBlock(tierNormalize(d))) return;
    offHandWeapon(d);
  } else if(b.kind==='off'){
    if(typeof reqBlock==='function' && reqBlock(tierNormalize(d))) return;
  } else { log('That does not go in an off hand.','c-info'); return; }
  player.bag.splice(bi,1);
  var old=player.offSets[s]; player.offSets[s]=d;
  if(old) addBag('⛨', gearName(old), {kind:'off', data:old});
  log('You stow the <b>'+gearName(d)+'</b> with your second set.','c-good'); sfx('equip-weapon');
}
function unstow(which){
  ensureOffSets();
  if(player.bag.length>=BAG_MAX){ log('Your bag is full.','c-info'); return; }
  var s=stowIdx();
  if(which==='main' && player.sets[s]){ var w=player.sets[s]; player.sets[s]=null; addBag('⚔', gearName(w), {kind:'weapon', data:w}); log('You put the '+gearName(w)+' in your bag.','c-info'); }
  if(which==='off' && player.offSets[s]){ var o=player.offSets[s]; player.offSets[s]=null; addBag('⛨', gearName(o), {kind:'off', data:o}); log('You put the '+gearName(o)+' in your bag.','c-info'); }
}

/* ---------------------------------------------------------------- the Equipment sheet's stowed row */
/* 2026-09-17: the two-weapon-set UI is retired. js/rangedslot.js turned the second slot into a bow slot
   that fires without swapping, and this block was still pasting its own STOWED / STOWED OFF row over the
   new sheet - which is why a bow in the ranged slot showed as an empty stowed set.
   The equip, swap and stow helpers above are kept only so old saves still load. */
