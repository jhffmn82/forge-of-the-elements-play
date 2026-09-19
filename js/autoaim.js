/* autoaim.js - press to aim, press again to fire (2026-09-18).
   Pressing a single-target ability (or the Hook / Swap amulet) opens the aim as before, and now also picks the
   nearest enemy it can actually reach - in range, in sight, and for bolts with a clear path - and marks it.
   Pressing the same slot again fires at that enemy. Tapping or clicking any tile still fires there instead,
   and Esc, right-click or a d-pad press cancels. On a touch screen this means a ranged character never has
   to tap the map (and risk a step) to shoot. With nothing in reach, the second press cancels, as before. */
var AUTO_AIM_KINDS = {bolt:1, chain:1, beam:1, tomb:1};
var AUTO_AIM_AMULETS = {hook:1, swap:1};

function autoAimTarget(){
  if(!aiming) return null;
  var best=null, bd=1e9;
  ents.forEach(function(e){
    if(!e.foe || e.hp<=0 || !(revealAll || vis[idxOf(e.x,e.y)])) return;
    var d=dist(player,e);
    if(aiming.amulet){ if(d>aiming.A.range) return; }
    else {
      if(!inRange(e.x,e.y)) return;
      if(aiming.A.kind==='bolt'){
        var p=boltPath(player.x,player.y,e.x,e.y), end=p.length ? p[p.length-1] : null;
        if(!end || end.x!==e.x || end.y!==e.y) return;           /* something is in the way */
      }
    }
    /* nearest first; among equals the most hurt, so a second press finishes what the first started */
    if(d<bd || (d===bd && best && e.hp/e.maxhp < best.hp/best.maxhp)){ best=e; bd=d; }
  });
  return best;
}
function autoAimPick(){
  var e=autoAimTarget(); if(!e) return;
  aiming.auto=e;
  /* this line replaces the "click a target" one just written, so an aim costs one log line, not two */
  var L=$('log'), last=L && L.lastElementChild; if(last && /click a target|press Esc/.test(last.textContent)) L.removeChild(last);
  log('Targeting <b>'+e.name+'</b>. Press again to fire, or pick another target.','c-info');
  draw();
}
function autoAimLive(){ var e=aiming && aiming.auto; return e && e.hp>0 && e.foe && ents.indexOf(e)>=0 ? e : null; }

var _useAbilityAuto = useAbility;
useAbility = function(i){
  if(aiming && !aiming.amulet && aiming.i===i && aiming.auto){
    var e=autoAimLive(); if(e) castAt(e.x, e.y); else cancelAim();
    return;
  }
  _useAbilityAuto(i);
  if(aiming && !aiming.amulet && aiming.i===i && !aiming.auto && AUTO_AIM_KINDS[aiming.A.kind]) autoAimPick();
};

if(typeof useAmulet==='function'){
  var _useAmuletAuto = useAmulet;
  useAmulet = function(){
    if(aiming && aiming.amulet && aiming.auto){
      var e=autoAimLive(); if(e) castAt(e.x, e.y); else cancelAim();
      return;
    }
    _useAmuletAuto.apply(this, arguments);
    var k=player.amulet && player.amulet.amulet;
    if(aiming && aiming.amulet && !aiming.auto && AUTO_AIM_AMULETS[k]) autoAimPick();
  };
}

/* the mark: a gold reticle on the chosen enemy and the bolt's path to it, drawn over the map */
var _drawAuto = draw;
draw = function(){
  var r=_drawAuto.apply(this, arguments);
  var e=autoAimLive(); if(!e || !ctx) return r;
  var now=performance.now(), pulse=0.75+0.25*Math.sin(now/160);
  var ox=typeof camOX!=='undefined' ? camOX : 0, oy=typeof camOY!=='undefined' ? camOY : 0;
  function px(x){ return (x-camX)*TS-ox; } function py(y){ return (y-camY)*TS-oy; }
  ctx.save();
  if(!aiming.amulet && aiming.A.kind==='bolt'){
    var pts=boltPath(player.x,player.y,e.x,e.y); ctx.globalAlpha=0.55; ctx.fillStyle='#E8B44A';
    for(var i=0;i<pts.length-1;i++) ctx.fillRect(px(pts[i].x)+TS/2-2, py(pts[i].y)+TS/2-2, 4, 4);
  }
  var x0=px(e.x), y0=py(e.y), c=TS*0.28;
  ctx.globalAlpha=pulse; ctx.strokeStyle='#E8B44A'; ctx.lineWidth=Math.max(2, TS/16);
  ctx.strokeRect(x0+2, y0+2, TS-4, TS-4);
  ctx.beginPath();                                                   /* corner brackets */
  [[0,0,1,1],[TS,0,-1,1],[0,TS,1,-1],[TS,TS,-1,-1]].forEach(function(k){
    var bx=x0+k[0]-k[2]*2, by=y0+k[1]-k[3]*2;
    ctx.moveTo(bx-k[2]*3, by+k[3]*c); ctx.lineTo(bx-k[2]*3, by-k[3]*3); ctx.lineTo(bx+k[2]*c, by-k[3]*3);
  });
  ctx.stroke();
  ctx.restore();
  return r;
};
/* keep the reticle pulsing while the aim is open */
(function tick(){ if(autoAimLive()) draw(); setTimeout(function(){ requestAnimationFrame(tick); }, 60); })();
