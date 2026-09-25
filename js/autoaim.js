/* autoaim.js - press to aim, press again to fire (2026-09-18).
   Pressing a single-target ability opens the aim as before, and now also picks the
   nearest enemy it can actually reach - in range, in sight, and for bolts with a clear path - and marks it.
   Pressing the same slot again fires at that enemy. Tapping or clicking any tile still fires there instead,
   and Esc, right-click or a d-pad press cancels. On a touch screen this means a ranged character never has
   to tap the map (and risk a step) to shoot. With nothing in reach, the second press cancels, as before. */
var AUTO_AIM_KINDS = {bolt:1, chain:1, beam:1, tomb:1};

function autoAimPoint(e){
  if(!e||!aiming)return null;
  if(aiming.A.kind==='bolt'){var line=projectileLine(player,e,{visible:true,range:spellRange(aiming.A)});return line&&inRange(line.to.x,line.to.y)?line.to:null;}
  var cells=[];for(var y=e.y;y<e.y+entitySize(e);y++)for(var x=e.x;x<e.x+entitySize(e);x++)if(inRange(x,y))cells.push({x:x,y:y});
  cells.sort(function(a,b){return dist(a,player)-dist(b,player)||a.y-b.y||a.x-b.x;});return cells[0]||null;
}

function autoAimTarget(){
  if(!aiming) return null;
  var best=null, bd=1e9;
  ents.forEach(function(e){
    if(!e.foe || e.hp<=0 || !actorVisible(e)) return;
    var d=dist(player,e);
    if(!autoAimPoint(e))return;
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
function autoAimLive(){ var e=aiming && aiming.auto; return e && e.hp>0 && e.foe && actorVisible(e) && ents.indexOf(e)>=0 ? e : null; }


/* the mark: four thin corner brackets on the chosen enemy and a faint dotted path to it (2026-09-18: the first
   version - a pulsing box plus brackets plus bold dots - was too loud) */

function drawAutoAimOverlay(){
  var e=autoAimLive(); if(!e || !ctx) return;
  var ox=typeof camOX!=='undefined' ? camOX : 0, oy=typeof camOY!=='undefined' ? camOY : 0;
  function px(x){ return (x-camX)*TS-ox; } function py(y){ return (y-camY)*TS-oy; }
  ctx.save();
  if(!aiming.amulet && aiming.A.kind==='bolt'){
    var target=autoAimPoint(e)||entityPoint(e,player),pts=boltPath(player.x,player.y,target.x,target.y);ctx.globalAlpha=0.35;ctx.fillStyle='#E8B44A';
    for(var i=0;i<pts.length-1;i++) ctx.fillRect(px(pts[i].x)+TS/2-1.5, py(pts[i].y)+TS/2-1.5, 3, 3);
  }
  var x0=px(e.x)+2,y0=py(e.y)+2,S=TS*entitySize(e)-4,c=Math.max(3,TS*.13);
  ctx.globalAlpha=0.7; ctx.strokeStyle="#E8B44A"; ctx.lineWidth=1; ctx.beginPath();
  ctx.moveTo(x0, y0+c); ctx.lineTo(x0, y0); ctx.lineTo(x0+c, y0);
  ctx.moveTo(x0+S-c, y0); ctx.lineTo(x0+S, y0); ctx.lineTo(x0+S, y0+c);
  ctx.moveTo(x0, y0+S-c); ctx.lineTo(x0, y0+S); ctx.lineTo(x0+c, y0+S);
  ctx.moveTo(x0+S-c, y0+S); ctx.lineTo(x0+S, y0+S); ctx.lineTo(x0+S, y0+S-c);
  ctx.stroke(); ctx.restore();
  return;

}
