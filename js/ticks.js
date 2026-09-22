/* =====================================================================
   ticks.js - a status lasts as long as it says it does (2026-09-18).

   aiAct() opened with tickStatus(e): an enemy expired its statuses at the START of its turn and then acted.
   endTurn() ticks the player AFTER they act. So the same duration was worth one action less against an enemy
   than against the player, and anything applied to an enemy for 1 turn did nothing at all - it was gone
   before the enemy ever moved. That silently killed Spark's stun, Air 6's lightning stun, the shield Air
   enchant, Grumbok's Bellow, Grom's stagger, Pummel, the Glint combo, Earth 6's root ground, the thunder
   amulet, the spark trap and the lightning sigil, and it halved every 2-turn root, blind and chill.

   Rather than edit a dozen early returns across four AI functions, the tick is suppressed for the duration
   of the entity's turn and run once at the end of it. Every nested tickStatus call - combat.js's aiAct and
   allyAct, elements.js's petrified branch, crypt.js's mortyAct - becomes a no-op inside that window, so a
   turn still ticks exactly once, just at the other end of it.
   ===================================================================== */
(function(){
  if(typeof tickStatus !== 'function') return;

  var INSIDE_TURN = false;
  var _tickStatusOrder = tickStatus;
  tickStatus = function(e){
    if(INSIDE_TURN) return true;          /* the turn's own tick runs when the turn is over */
    return _tickStatusOrder(e);
  };

  function afterActing(fn){
    return function(e){
      if(!e || e.hp <= 0) return;
      var was = INSIDE_TURN;
      INSIDE_TURN = true;
      try { return fn.apply(this, arguments); }
      finally {
        INSIDE_TURN = was;
        if(!was && e.hp > 0 && typeof ents !== 'undefined' && ents.indexOf(e) >= 0) _tickStatusOrder(e);
      }
    };
  }

  if(typeof aiAct === 'function') aiAct = afterActing(aiAct);
  if(typeof allyAct === 'function') allyAct = afterActing(allyAct);
  /* 2026-09-19: files loaded after this one (the Caverns' and the Underdark's creatures) wrap aiAct from outside
     this window, and their special moves call tickStatus themselves - a real tick, then this one again at the
     end: a double tick that cut their statuses short. Wrapping once more when everything has loaded makes the
     window outermost; the inner copy sees it is already inside a turn and leaves the tick to this one. */
  window.addEventListener('load', function(){
    if(typeof aiAct === 'function') aiAct = afterActing(aiAct);
    if(typeof allyAct === 'function') allyAct = afterActing(allyAct);
  });
})();
