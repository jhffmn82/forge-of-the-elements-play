/* =====================================================================
   pacing.js - let animations resolve before the next move.
   - Game input during attacks, projectiles, slides or deaths is discarded.
     Never replay an old key press or click after the enemy turn: the player
     must be able to stop without an extra action taking them into danger.
   - A creature's tile stays blocked to other monsters until its death
     animation finishes.
   Loaded after fx.js and before ui.js, so its capture listeners run first.
   ===================================================================== */

/* Retained for run/save cleanup callers; commands are never stored here. */
var PACING = {pending:null, blockedClick:false};
var PACED_KEYS = {'.':1,' ':1,g:1,x:1,'>':1,'<':1,r:1,f:1,F:1,C:1,'1':1,'2':1,'3':1,'4':1,'5':1,'6':1,'7':1,'8':1};
/* Simulation work must settle even when motion is reduced or a visual timeout
   releases an animation. */
function turnSequenceBusy(){return typeof gameTurns!=='undefined' && typeof gameTurns.busy==='function' && gameTurns.busy();}
function pacedActionKey(ev){return !!((typeof KEYS!=='undefined' && KEYS[ev.key]) || PACED_KEYS[ev.key]);}
function pacedClickTarget(t){return t===cv || !!(t.closest && (t.closest('#dpad') || t.closest('#hotbar')));}
function blockPendingInput(ev){PACING.pending=null;ev.preventDefault();ev.stopImmediatePropagation();}

/* 2026-09-22 (Justin: walking stuttered). Holding a direction used to wait for each slide to end, then a frame,
   then start the next from a standstill: a stop at every tile. A movement key (move=true) is released once every
   slide on screen is 70% done; the next step then chains on at a steady pace (game.js renderPos). */
var STEP_RELEASE=0.7;
function animBusy(move){
  if(turnSequenceBusy())return true;
  if(ANIM.reduce || !player) return false;
  var now=performance.now();
  if(typeof fxClock==='number' && fxClock > now+40) return true;              /* queued swings, bolts, hits */
  if(move ? slideFrac(player,now)<STEP_RELEASE : motionActive(player,now)) return true;   /* the hero still sliding */
  for(var i=0;i<ents.length;i++){ var e=ents[i]; if(e.ally)continue; if(move ? slideFrac(e,now)<STEP_RELEASE : motionActive(e,now)) return true; }   /* pet movement never holds input */
  for(var j=0;j<fx.length;j++){ var f=fx[j];
    if(f.k==='d' && now < f.t0+f.dur*0.6) return true;                          /* someone is still falling */
    if((f.k==='p' || f.k==='l') && now < f.t0+f.dur) return true;               /* projectile or lunge in flight */
  }
  return false;
}
function uiOpen(){ return (typeof modalOpen!=='undefined' && modalOpen) || (typeof openSheet!=='undefined' && openSheet) || ($('title') && $('title').classList.contains('on')) || ($('create') && $('create').classList.contains('on')); }

window.addEventListener('keydown', function(ev){
  var tgt=ev.target && ev.target.tagName;
  if(tgt==='INPUT'||tgt==='SELECT'||tgt==='TEXTAREA') return;
  if(typeof stopRest==='function')stopRest();
  if(turnSequenceBusy()){
    if(typeof stopTravel==='function')stopTravel();
    blockPendingInput(ev);return;
  }
  if(uiOpen() || !pacedActionKey(ev)) return;
  if(!animBusy(!!(typeof KEYS!=='undefined' && KEYS[ev.key]))) return;
  if(typeof stopTravel==='function')stopTravel();
  blockPendingInput(ev);
}, true);

window.addEventListener('click', function(ev){
  if(typeof stopRest==='function')stopRest();
  /* A mouse press rejected during a turn can release after it finishes. The
     browser still emits a click even when pointerdown was prevented. */
  if(PACING.blockedClick && ev.detail>0){PACING.blockedClick=false;blockPendingInput(ev);return;}
  if(turnSequenceBusy()){
    if(typeof stopTravel==='function')stopTravel();
    blockPendingInput(ev);return;
  }
  if(uiOpen() || !animBusy()) return;
  if(!pacedClickTarget(ev.target)) return;
  if(typeof stopTravel==='function')stopTravel();
  blockPendingInput(ev);
}, true);

/* Inventory context menus, native drops, and touch gesture starts can mutate
   gear without producing a click. Pointer-up cleanup is handled by touchui. */
window.addEventListener('pointerdown',function(ev){
  PACING.blockedClick=turnSequenceBusy() || (!uiOpen() && pacedClickTarget(ev.target) && animBusy());
  if(PACING.blockedClick){
    if(typeof stopRest==='function')stopRest();
    if(typeof stopTravel==='function')stopTravel();
    blockPendingInput(ev);
  }
},{capture:true,passive:false});
window.addEventListener('pointercancel',function(){PACING.blockedClick=false;},true);
['contextmenu','drop','touchstart','change'].forEach(function(name){
  window.addEventListener(name,function(ev){if(turnSequenceBusy())blockPendingInput(ev);},{capture:true,passive:false});
});

/* monsters don't step onto a body that is still falling */
