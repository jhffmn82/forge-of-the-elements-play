/* reach.js - the spear reaches 2 tiles (2026-09-18).
   data.js has given the Spear reach:2 ("attacks 2 tiles away in a line") since it was written, but nothing
   ever read it: a spear hit exactly like a sword. Now, with a reach weapon in the main hand:
   - an enemy exactly 2 tiles away in a straight line (along a row, a column or a diagonal), with open, empty
     ground between you, can be attacked from there;
   - moving toward it (key, d-pad) attacks instead of stepping in, and clicking or tapping it attacks too;
   - it is the spear's hit, not the bow's: rangedslot.js otherwise hands anything past 1 tile to the bow.
   The off-hand does not follow through - a dagger in the other hand cannot reach. */
function reachLen(){
  var w=player && player.weapon; if(!w) return 1;
  return w.reach || (w.icon==='item-spear' ? 2 : 1);
}
/* the enemy a reach attack in direction (dx,dy) would hit, or null */
function reachFoe(dx, dy){
  if(reachLen()<2 || (!dx && !dy)) return null;
  var mx=player.x+dx, my=player.y+dy, fx=player.x+2*dx, fy=player.y+2*dy;
  if(!inb(fx,fy) || opaque(mx,my) || !walkable(mx,my)) return null;              /* open ground between */
  if(ents.some(function(e){ return e!==player && e.x===mx && e.y===my; })) return null;
  return ents.filter(function(e){ return e.foe && e.hp>0 && e.x===fx && e.y===fy && (revealAll || vis[idxOf(fx,fy)]); })[0] || null;
}
/* is this enemy in reach from where you stand? returns the direction if so */
function reachDir(foe){
  var dx=foe.x-player.x, dy=foe.y-player.y;
  if(Math.max(Math.abs(dx),Math.abs(dy))!==2) return null;
  if(!((dx===0 || Math.abs(dx)===2) && (dy===0 || Math.abs(dy)===2))) return null;   /* a straight line only */
  var d=[Math.sign(dx), Math.sign(dy)];
  return reachFoe(d[0], d[1])===foe ? d : null;
}
function reachAttack(foe, d){
  var f=faceOf(d[0], d[1]); if(f) player.face=f;
  if(player.st.fear && rng()<0.5){ log('You are too afraid to attack.','c-info'); endTurn(); return; }
  player._reaching=true;
  try { attack(player, foe); } finally { player._reaching=false; }
  player.hidden=0; endTurn();
}

var _tryMoveReach = tryMove;
tryMove = function(dx, dy){
  if(player && player.hp>0 && !player.st.frozen && !player.st.stun && reachLen()>=2){
    /* a click on a reachable enemy arrives as a 2-tile move (travel.js) */
    if(Math.abs(dx)===2 || Math.abs(dy)===2){
      var tf=ents.filter(function(e){ return e.foe && e.x===player.x+dx && e.y===player.y+dy; })[0], td=tf && reachDir(tf);
      if(td){ lastDir=td; reachAttack(tf, td); return; }
      return;
    }
    var adj=ents.some(function(e){ return e.foe && e.x===player.x+dx && e.y===player.y+dy; });
    var rf=!adj && reachFoe(dx, dy);
    if(rf){ reachAttack(rf, [dx,dy]); return; }
  }
  return _tryMoveReach(dx, dy);
};

/* a click or tap on an enemy in reach attacks it, rather than walking up to it or firing the bow */
if(typeof clickIntent==='function'){
  var _clickIntentReach = clickIntent;
  clickIntent = function(x, y){
    var it=_clickIntentReach(x, y);
    if(it && it.foe && (it.kind==='move' || it.kind==='shoot') && reachLen()>=2 && reachDir(it.foe)) return {kind:'attack', foe:it.foe};
    return it;
  };
}
if(typeof shootAt==='function'){
  var _shootAtReach = shootAt;
  shootAt = function(e){
    var d=e && reachLen()>=2 && reachDir(e);
    if(d){ lastDir=d; reachAttack(e, d); return true; }
    return _shootAtReach(e);
  };
}
