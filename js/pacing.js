/* =====================================================================
   pacing.js - let animations resolve before the next move.
   - Game input (movement, waiting, hotbar, grab, stairs, map and d-pad
     clicks) is held while attacks, projectiles, slides or deaths are still
     playing. The latest held command runs the moment the screen catches up,
     so holding a key or clicking ahead still feels responsive.
   - A creature's tile stays blocked to other monsters until its death
     animation finishes.
   Loaded after fx.js and before ui.js, so its capture listeners run first.
   ===================================================================== */

var PACING = {pending:null, since:0};
var PACED_KEYS = {'.':1,' ':1,g:1,x:1,'>':1,r:1,C:1,'1':1,'2':1,'3':1,'4':1,'5':1,'6':1,'7':1,'8':1};

function animBusy(){
  if(ANIM.reduce || !player) return false;
  var now=performance.now();
  if(typeof fxClock==='number' && fxClock > now+40) return true;              /* queued swings, bolts, hits */
  if(player._mt && now-player._mt < MOVE_MS*0.85) return true;                  /* the hero still sliding */
  for(var i=0;i<ents.length;i++){ var e=ents[i]; if(e._mt && now-e._mt < MOVE_MS*0.85) return true; }   /* includes slides still waiting to start */
  for(var j=0;j<fx.length;j++){ var f=fx[j];
    if(f.k==='d' && now < f.t0+f.dur*0.6) return true;                          /* someone is still falling */
    if((f.k==='p' || f.k==='l') && now < f.t0+f.dur) return true;               /* projectile or lunge in flight */
  }
  return false;
}
function pacedKey(ev){
  if(ev.__replay) return false;
  if(typeof KEYS!=='undefined' && KEYS[ev.key]) return true;
  return !!PACED_KEYS[ev.key];
}
function uiOpen(){ return (typeof modalOpen!=='undefined' && modalOpen) || (typeof openSheet!=='undefined' && openSheet) || ($('create') && $('create').classList.contains('on')) || ($('title') && $('title').classList.contains('on')); }   /* 2026-09-21: the title too */

window.addEventListener('keydown', function(ev){
  var tgt=ev.target && ev.target.tagName;
  if(tgt==='INPUT'||tgt==='SELECT'||tgt==='TEXTAREA') return;
  if(uiOpen() || !pacedKey(ev)) return;
  if(!animBusy()) return;
  if(!PACING.pending) PACING.since=performance.now();
  PACING.pending={type:'key', key:ev.key, shift:ev.shiftKey};
  ev.preventDefault(); ev.stopImmediatePropagation();
}, true);

window.addEventListener('click', function(ev){
  if(ev.__replay || uiOpen() || !animBusy()) return;
  var t=ev.target;
  var onMap = t===cv, onPad = t.closest && (t.closest('#dpad') || t.closest('#hotbar') || t.closest('#extra'));
  if(!onMap && !onPad) return;
  if(!PACING.pending) PACING.since=performance.now();
  PACING.pending={type:'click', el: onMap ? cv : (t.closest('button')||t), x:ev.clientX, y:ev.clientY};
  ev.preventDefault(); ev.stopImmediatePropagation();
}, true);

(function pump(){
  var p=PACING.pending;
  if(p && (!animBusy() || performance.now()-PACING.since>1500)){
    PACING.pending=null;
    var e;
    if(p.type==='key'){ e=new KeyboardEvent('keydown',{key:p.key, shiftKey:p.shift, bubbles:true, cancelable:true}); e.__replay=true; window.dispatchEvent(e); }
    else if(p.el && p.el.isConnected){ e=new MouseEvent('click',{clientX:p.x, clientY:p.y, bubbles:true, cancelable:true}); e.__replay=true; p.el.dispatchEvent(e); }
  }
  requestAnimationFrame(pump);
})();

/* monsters don't step onto a body that is still falling */
var _occupiedPacing = occupied;
occupied = function(x,y){
  if(_occupiedPacing(x,y)) return true;
  if(!fx || !fx.length) return false;
  var now=performance.now();
  for(var i=0;i<fx.length;i++){ var f=fx[i]; if(f.k==='d' && f.e && f.e.x===x && f.e.y===y && now < f.t0+f.dur) return true; }
  return false;
};

/* monsters that move while your attack is still playing wait for it: their slide starts when the queued
   effects (your swing, the bolt in flight, the hit) are done, and they hold their old tile until then */
renderPos = function(e){
  var now=performance.now();
  if(e._lx===undefined){ e._lx=e.x; e._ly=e.y; e._fx=e.x; e._fy=e.y; e._mt=0; }
  if(e.x!==e._lx || e.y!==e._ly){
    var cur=slideAt(e, now);
    var jump=Math.max(Math.abs(e.x-cur.x), Math.abs(e.y-cur.y));
    e._fx=cur.x; e._fy=cur.y; e._lx=e.x; e._ly=e.y;
    var start = (e!==player && typeof fxClock==='number') ? Math.max(now, fxClock) : now;
    e._mt = (ANIM.reduce || jump>3) ? 0 : start;
  }
  return slideAt(e, now);
};
slideAt = function(e, now){
  if(!e._mt) return {x:e._lx===undefined?e.x:e._lx, y:e._ly===undefined?e.y:e._ly, hop:0};
  var p=(now-e._mt)/MOVE_MS;
  if(p<0) return {x:e._fx, y:e._fy, hop:0};
  if(p>=1){ e._mt=0; return {x:e._lx, y:e._ly, hop:0}; }
  var q = p<0.5 ? 2*p*p : 1-Math.pow(-2*p+2,2)/2;
  return {x:e._fx+(e._lx-e._fx)*q, y:e._fy+(e._ly-e._fy)*q, hop:Math.sin(p*Math.PI)};
};
