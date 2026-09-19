/* =====================================================================
   spellench.js - a caster's weapon enchantment works on spells too (2026-09-17).
   The weapon enchant block lives inside attack(), so it only ever fired on a swing or a shot: a Masterwork
   Wand of Shadow did nothing at all for a mage who casts. Now the same enchantment procs on spell hits, at
   the same rates and off the spell's own damage, so the enchant on your focus is worth having whichever way
   you fight.
   Only a spell focus does this: a staff or a wand (anything with a spell bonus). A melee weapon's enchant
   stays on its swings and a bow's on its shots.
   Air reads the same way on both sides: the gust that gives a melee weapon an instant extra swing (and a bow
   an extra shot) makes a spell land a second time.
   ===================================================================== */
(function(){
  if(typeof spellOnHit!=='function') return;
  var _spellOnHitEnch = spellOnHit;
  spellOnHit = function(f, d, crit, A){
    var r = _spellOnHitEnch(f, d, crit, A);
    var w = player.weapon, ench = w && w.enchant;
    if(!ench || !f || f.hp<=0 || !d) return r;
    /* 2026-09-17: only a spell focus carries its enchantment into a spell. A sword of Shadow buffing your
       magic was wrong: melee enchants are for melee, a bow's for its shots (the bow holds this slot only
       while it fires, see js/rangedslot.js), and a staff or wand's for what you cast. */
    var k = (typeof itemKey==='function') ? itemKey(w) : null;
    if(!(k==='staff' || k==='wand' || w.spell)) return r;

    var pts = (player.aff && player.aff[ench]) || 0;
    var sc = enchantScale(ench);
    var extra = 0, note = '';

    if(ench==='fire'){
      extra += Math.round(d*(0.10 + 0.03*pts));
      if(pRoll(0.05*pts)){ applyStatus(f, 'burn', 3, burnDmg()); note=' burning'; }
    }
    if(ench==='water' && pRoll(0.15 + 0.05*pts)){ addChill(f); note=' chilled'; }
    if(ench==='earth' && pRoll(0.15*sc)){ applyStatus(f, 'root', 2); note=' rooted'; }
    if(ench==='air' && pRoll(Math.max(0.05, 0.05*pts))){
      /* the gust that gives a melee weapon an extra swing makes a spell land twice */
      var t2 = (typeof elemToType==='function' && A && A.el) ? elemToType(A.el) : 'magic';
      var d2 = applyDamage(f, d, t2, player);
      floatText(f.x, f.y, String(d2), t2, true);
      log('<b>Gust.</b> The spell strikes twice &mdash; <b>'+d2+'</b> more.','c-good');
      if(f.hp<=0){ kill(f, player); return r; }
    }
    if(ench==='light' && (f.base.undead || f.base.shadowy)) extra += Math.round(d*0.25);
    if(ench==='shadow'){
      if(f.st.hollow) extra += 1;
      if(pRoll(Math.max(0.05, 0.05*pts))){ extra += Math.round(d*0.25); applyStatus(f, 'corrupt', 3); note=' corrupted'; }
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
