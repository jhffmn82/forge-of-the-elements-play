/* =====================================================================
   enchslots.js - the Forge can enchant a bow and an off-hand weapon (2026-09-18).

   Both already carried their enchantment in a fight: rangedslot.js swaps the bow into player.weapon for a
   shot, and offHandSwing does the same with the off hand, so the weapon-enchant block in attack() reads
   whichever one is actually striking. The Forge just never offered the slots:

     - its main-hand card read player.sets[player.activeSet], a leftover from the retired weapon sets
     - there was no ranged card at all, so a bow could never be enchanted
     - the off-hand card only accepted an orb, tome, shield or holy symbol, so a dual-wielded dagger -
       the whole point of which is a second, differently enchanted proc - was refused

   enchantItem() also routed every slot that was not 'weapon' to the armor, so a stray 'ranged' would have
   put the mote into your chestpiece. Both slots are handled here instead.
   ===================================================================== */

/* ---------------------------------------------------------------- what the Forge offers */
function offHandIsWeapon(){
  var o = player && player.off;
  return !!(o && o !== EMPTY_OFF && o.weapon && !player.twoHanded);
}
if(typeof enchantTargets === 'function'){
  enchantTargets = function(){
    var out = [];
    var w = player.weapon;
    if(w && !w.unarmed) out.push({slot:'weapon', label:'Main hand', it:w, text:ENCHANT_TEXT.weapon});

    if(offHandIsWeapon()){
      /* a second weapon strikes on its own and procs its own enchant, so it takes a mote like the main hand */
      out.push({slot:'off', label:'Off hand', it:player.off, text:ENCHANT_TEXT.weapon});
    } else if(player.off && player.off !== EMPTY_OFF){
      var ok = typeof offKind === 'function' ? offKind() : null;
      out.push({slot:'off', label:'Off hand', it:player.off, text: ok ? ENCHANT_TEXT[ok] : null});
    }

    if(typeof isRangedWeapon === 'function' && isRangedWeapon(player.ranged))
      out.push({slot:'ranged', label:'Ranged', it:player.ranged, text:ENCHANT_TEXT.weapon});

    if(player.armorItem) out.push({slot:'armor', label:'Armor', it:player.armorItem, text:ENCHANT_TEXT.armor});
    return out;
  };
}

/* ---------------------------------------------------------------- setting the mote into the right item */
(function(){
  if(typeof enchantItem !== 'function') return;
  var _enchantItemSlots = enchantItem;

  function setInto(item, slot, el, what){
    if(!item || item.unarmed){ log('Nothing to enchant there.','c-info'); return; }
    if(item.unid){ log('The Forge will not work metal you do not know. <b>Identify it first.</b>','c-info'); sfx('ui-error'); return; }
    if(!(player.motes[el] > 0)){ log('You have no '+el+' mote.','c-info'); return; }
    if(item.enchant === el){
      log('Your '+gearName(item)+' already carries '+el+'. A second mote would change nothing.','c-info');
      sfx('ui-error'); return;
    }
    player.motes[el]--; if(player.motes[el] <= 0) delete player.motes[el];
    item.enchant = el;
    if(player.god === 'anvil') gainPiety(20);
    godConductEquip('weapon', item);
    derive(player);
    log('The Forge sets <b>'+el+'</b> into your '+gearName(item)+' — '+what+': '+ENCHANT_TEXT.weapon[el]+
        ' (&times;'+enchantScale(el).toFixed(1)+' from your affinity).', 'c-kill');
    sfx('forge-enchant'); sparkleFx(player.x, player.y, TRAIL_EL(el), 40);
    updateUI(); renderForge();
  }

  enchantItem = function(slot, el){
    if(forbiddenElement(el))return refuseDivine();
    /* the same guard the upgrade bench uses: an unidentified piece may hold an enchantment you cannot see,
       and a mote would overwrite it without telling you (2026-09-18) */
    var target = slot==='ranged' ? player.ranged : slot==='off' ? player.off : slot==='armor' ? player.armorItem : player.weapon;
    if(target && target.unid){
      log('The Forge will not work metal you do not know. <b>Identify it first.</b>','c-info'); sfx('ui-error'); return;
    }
    if(slot === 'ranged') return setInto(player.ranged, slot, el, 'it answers every shot');
    if(slot === 'off' && offHandIsWeapon()) return setInto(player.off, slot, el, 'it answers your off-hand strike');
    return _enchantItemSlots(slot, el);
  };
})();
