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

/* 2026-09-22 (Justin: walking stuttered). Holding a direction used to wait for each slide to end, then a frame,
   then start the next from a standstill: a stop at every tile. A movement key (move=true) is released once every
   slide on screen is 70% done; the next step then chains on at a steady pace (game.js renderPos). */
var STEP_RELEASE=0.7;
function animBusy(move){
  if(ANIM.reduce || !player) return false;
  var now=performance.now();
  if(typeof fxClock==='number' && fxClock > now+40) return true;              /* queued swings, bolts, hits */
  if(move ? slideFrac(player,now)<STEP_RELEASE : motionActive(player,now)) return true;   /* the hero still sliding */
  for(var i=0;i<ents.length;i++){ var e=ents[i]; if(move ? slideFrac(e,now)<STEP_RELEASE : motionActive(e,now)) return true; }   /* includes slides still waiting to start */
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
function uiOpen(){ return (typeof modalOpen!=='undefined' && modalOpen) || (typeof openSheet!=='undefined' && openSheet) || ($('title') && $('title').classList.contains('on')) || ($('create') && $('create').classList.contains('on')); }

window.addEventListener('keydown', function(ev){
  var tgt=ev.target && ev.target.tagName;
  if(tgt==='INPUT'||tgt==='SELECT'||tgt==='TEXTAREA') return;
  if(uiOpen() || !pacedKey(ev)) return;
  if(!animBusy(!!(typeof KEYS!=='undefined' && KEYS[ev.key]))) return;
  if(!PACING.pending) PACING.since=performance.now();
  PACING.pending={type:'key', key:ev.key, shift:ev.shiftKey};
  ev.preventDefault(); ev.stopImmediatePropagation();
}, true);

window.addEventListener('click', function(ev){
  if(ev.__replay || uiOpen() || !animBusy()) return;
  var t=ev.target;
  var onMap = t===cv, onPad = t.closest && (t.closest('#dpad') || t.closest('#hotbar'));
  if(!onMap && !onPad) return;
  if(!PACING.pending) PACING.since=performance.now();
  PACING.pending={type:'click', el: onMap ? cv : (t.closest('button')||t), x:ev.clientX, y:ev.clientY};
  ev.preventDefault(); ev.stopImmediatePropagation();
}, true);

(function pump(){
  var p=PACING.pending;
  if(p && (!animBusy(p.type==='key' && typeof KEYS!=='undefined' && !!KEYS[p.key]) || performance.now()-PACING.since>1500)){
    PACING.pending=null;
    var e;
    if(p.type==='key'){ e=new KeyboardEvent('keydown',{key:p.key, shiftKey:p.shift, bubbles:true, cancelable:true}); e.__replay=true;e.__fote=true; window.dispatchEvent(e); }
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
