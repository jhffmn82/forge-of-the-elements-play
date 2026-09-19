/* =====================================================================
   surprise.js - "!" surprise openings, Pixel Dungeon style (2026-09-17).
   When an enemy notices you, or finds you again after losing sight of you for a couple of its turns
   (you closed a door, broke line of sight round a corner), a gold "!" shows over it. Noticing costs it
   that action, and until it acts again your attacks against it are surprise attacks.
   ===================================================================== */

var SURPRISE_LOST = 2;   /* its own actions without sight of you before finding you again counts */

var _aiActSurprise = aiAct;
aiAct = function(e){
  if(!e || !e.foe || e.base.boss){ return _aiActSurprise(e); }
  e.surprised = false;
  var see = canSeePlayer(e);
  /* a hunter that lost you and now has you in sight again: it spends the action finding you */
  if(see && e.state==='hunt' && (e._lostFor||0) >= SURPRISE_LOST && !e.st.stun && !e.st.frozen){
    e._lostFor = 0; e.surprised = true;
    log('The <b>'+e.name+'</b> spots you!','c-info');
    if(e.base.sfx) sfx(e.base.sfx+'-alert');
    e.lastSeen = {x:player.x, y:player.y};
    e.t += actCost(e);
    return;
  }
  var before = e.state;
  var r = _aiActSurprise(e);
  if(e.hp<=0 || ents.indexOf(e)<0) return r;
  var nowSee = canSeePlayer(e);
  /* a fresh notice: the "!" stays up until its next action */
  if(before!=='hunt' && e.state==='hunt' && nowSee) e.surprised = true;
  e._lostFor = nowSee ? 0 : (e.state==='hunt' ? (e._lostFor||0)+1 : 0);
  return r;
};
/* hitting it clears the opening: one surprise attack per "!" */
var _attackSurprise = attack;
attack = function(att, def, mult, label){
  var r = _attackSurprise(att, def, mult, label);
  if(att===player && def && def.surprised) def.surprised = false;
  return r;
};
