/* =====================================================================
   spellench.js - a caster's weapon enchantment works on spells too (2026-09-17).
   The weapon enchant block lives inside attack(), so it only ever fired on a swing or a shot: a Masterwork
   Wand of Shadow did nothing at all for a mage who casts. Now the same enchantment procs on spell hits, at
   the same rates and off the spell's own damage, so the enchant on your focus is worth having whichever way
   you fight.
   Air is the exception: its proc is an instant extra weapon attack, which has no spell equivalent, so an Air
   weapon still only helps in melee.
   ===================================================================== */
(function(){
  if(typeof spellOnHit!=='function') return;
  var _spellOnHitEnch = spellOnHit;
  spellOnHit = function(f, d, crit, A){
    var r = _spellOnHitEnch(f, d, crit, A);
    var w = player.weapon, ench = w && w.enchant;
    if(!ench || !f || f.hp<=0 || !d) return r;

    var pts = (player.aff && player.aff[ench]) || 0;
    var sc = enchantScale(ench);
    var extra = 0, note = '';

    if(ench==='fire'){
      extra += Math.round(d*(0.10 + 0.03*pts));
      if(rng() < 0.05*pts){ applyStatus(f, 'burn', 3, burnDmg()); note=' burning'; }
    }
    if(ench==='water' && rng() < 0.15 + 0.05*pts){ addChill(f); note=' chilled'; }
    if(ench==='earth' && rng() < 0.15*sc){ applyStatus(f, 'root', 2); note=' rooted'; }
    if(ench==='light' && (f.base.undead || f.base.shadowy)) extra += Math.round(d*0.25);
    if(ench==='shadow'){
      if(f.st.hollow) extra += 1;
      if(rng() < Math.max(0.05, 0.05*pts)){ extra += Math.round(d*0.25); applyStatus(f, 'corrupt', 3); note=' corrupted'; }
    }

    if(extra > 0){
      f.hp -= extra;
      floatText(f.x, f.y, String(extra), ench==='light' ? 'light' : ench==='fire' ? 'fire' : 'dark');
      if(f.hp<=0) kill(f, player);
    }
    if(note && f.hp>0) log('Your '+gearName(w)+' leaves it'+note+'.', 'c-good');
    return r;
  };
})();
