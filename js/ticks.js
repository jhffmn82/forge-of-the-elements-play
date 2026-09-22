/* =====================================================================
   ticks.js - a status lasts as long as it says it does (2026-09-18).

   aiAct() opened with tickStatus(e): an enemy expired its statuses at the START of its turn and then acted.
   endTurn() ticks the player AFTER they act. So the same duration was worth one action less against an enemy
   than against the player, and anything applied to an enemy for 1 turn did nothing at all - it was gone
   before the enemy ever moved. That silently killed Spark's stun, Air 6's lightning stun, the shield Air
   enchant, Grumbok's Bellow, Grom's stagger, Pummel, the Glint combo, Earth 6's root ground, the thunder
   amulet, the spark trap and the lightning sigil, and it halved every 2-turn root, blind and chill.

   Rather than edit a dozen early returns across four AI functions, the tick is suppressed for the duration
   of the entity's turn. Every nested tickStatus call - combat.js's aiAct and allyAct, elements.js's
   petrified branch, crypt.js's mortyAct - becomes a no-op inside that window.

   2026-09-21, Justin's ruling of 09-20 brought to the live game: statuses tick on a GLOBAL clock, one pass
   for every creature at the end of each game turn, not once per creature action. A duration of n is n game
   turns whoever carries it. Before, a bat at speed 170 took its burn 1.7 times a turn and shed a 2-turn stun
   in about 1.2, and a slow thing that did not act this turn did not tick at all. The consequence Justin
   accepted: a fast creature loses every action inside its stun, so being frozen costs a fast thing more.
   Normal-speed creatures are exactly as before. The pass runs after the world has moved, so a 1-turn stun
   still denies the one action it says it does.
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
      finally { INSIDE_TURN = was; }
    };
  }

  /* the one pass a turn: every creature that fights, after all of them have moved */
  function tickTheWorld(){
    if(typeof ents === 'undefined') return;
    ents.slice().forEach(function(e){
      if(e === player || !(e.foe || e.ally) || e.hp <= 0 || ents.indexOf(e) < 0) return;
      _tickStatusOrder(e);
    });
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
    /* outermost, so the pass runs once the whole turn - the player's tick, the monsters' moves, fire - is done */
    if(typeof endTurn === 'function'){ var _endTurnTicks = endTurn; endTurn = function(){ var r = _endTurnTicks.apply(this, arguments); if(player && player.hp > 0) tickTheWorld(); return r; }; }
  });
})();
