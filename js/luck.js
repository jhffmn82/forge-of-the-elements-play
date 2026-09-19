/* =====================================================================
   luck.js - Lady Luck's Blessing (2026-09-17).
   Every other god hands out a scaling combat passive at rank 1; Wobbles handed out nothing but random
   events, so a cleric of his was strictly weaker in a fight than any other cleric and paid for it in
   variance. His blessing is luck itself: a few percent on every roll the game makes for you.
   One number, +3% per piety rank, added to:
     critical hits, evasion (the chance a blow misses you), parry, block,
     and every enchantment proc - weapon, off-hand, bow, shield and spell.
   The god panel says only "+3% to your combat effects per rank", which is how Wobbles would put it.
   ===================================================================== */

function luckBonus(){
  if(typeof player==='undefined' || !player || player.god!=='wobbles') return 0;
  return 0.03 * (typeof godRank==='function' ? godRank() : 1);
}
/* every chance roll the blessing touches goes through here */
function pRoll(chance){ return rng() < (chance||0) + luckBonus(); }

/* crit, parry and block are numbers on the player, so they take the bonus in derive */
(function(){
  if(typeof derive!=='function') return;
  var _deriveLuck = derive;
  derive = function(p){
    var r = _deriveLuck(p);
    if(p===player){
      var luck = luckBonus();
      p.luck = luck;
      if(luck>0){
        p.crit = (p.crit||0) + luck;
        if(p.parry) p.parry = p.parry + luck;                  /* only where something can parry at all */
        if(p.block) p.block = Math.min(0.75, p.block + luck);  /* the ceiling shields already use */
      }
    }
    return r;
  };
})();
