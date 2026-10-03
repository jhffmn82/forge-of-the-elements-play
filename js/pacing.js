/* =====================================================================
   pacing.js - let animations resolve before the next move.
   - Ordinary game input during visible attacks is discarded. The direction
     pad retains one explicit tap; held repeats require a finger still down.
   - A creature's tile stays blocked to other monsters until its death
     animation finishes.
   Loaded after fx.js and before ui.js, so its capture listeners run first.
   ===================================================================== */

/* Retained for run/save cleanup callers; commands are never stored here. */
var PACING = {pending:null, blockedClick:false};
var PACED_KEYS = {'.':1,' ':1,g:1,x:1,'>':1,'<':1,r:1,f:1,F:1,C:1,'1':1,'2':1,'3':1,'4':1,'5':1,'6':1,'7':1,'8':1};
/* Simulation work must settle even when motion is reduced or a visual timeout
   releases an animation. A floor still waiting for its art is not played either. */
function turnSequenceBusy(){return typeof gameTurns!=='undefined' && typeof gameTurns.busy==='function' && gameTurns.busy() || typeof floorArtPending==='function' && floorArtPending();}
function pacedActionKey(ev){return !!((typeof KEYS!=='undefined' && KEYS[ev.key]) || PACED_KEYS[ev.key]);}
function pacedClickTarget(t){return t===cv || !!(t.closest && (t.closest('#dpad') || t.closest('#hotbar')));}
function directionPadButton(t){
  var b=t&&t.closest&&t.closest('button[data-d]');
  return b&&b.closest('#dpad')&&typeof DIRS!=='undefined'&&DIRS[b.getAttribute('data-d')]?b:null;
}
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
  /* 2026-09-27 (Justin: "even non visible monsters are slowing down performance"). Only what the player can see
     holds input, by the turn's own rule (turn-presentation.js): pets, and creatures out of sight or off the screen, never do. */
  for(var i=0;i<ents.length;i++){ var e=ents[i]; if(e.ally || !turnAnimationVisible(e))continue; if(move ? slideFrac(e,now)<STEP_RELEASE : motionActive(e,now)) return true; }
  for(var j=0;j<fx.length;j++){ var f=fx[j];
    if(f.k==='d' && turnAnimationOnscreen(f.e.x,f.e.y) && now < f.t0+f.dur*0.6) return true;        /* someone is still falling */
    if((f.k==='p' || f.k==='l') && turnAnimationEffectVisible(f) && now < f.t0+f.dur) return true;  /* projectile or lunge in flight */
  }
  return false;
}
function uiOpen(){ return (typeof FoteMobileOrientation!=='undefined'&&FoteMobileOrientation.isBlocked()) || (typeof FoteResponsiveHUD!=='undefined'&&FoteResponsiveHUD.hasOverlay()) || (typeof modalOpen!=='undefined' && modalOpen) || (typeof openSheet!=='undefined' && openSheet) || ($('title') && $('title').classList.contains('on')) || ($('create') && $('create').classList.contains('on')); }

/* One bounded direction intent, never a backlog of turns. A completed tap may
   wait for the current turn; a hold stops repeating as soon as it is released.
   Run/floor tokens keep a delayed tap out of a different scene. */
var PAD_INPUT={press:null,tap:null,timer:null,click:null};
function stopDirectionPad(){
  clearTimeout(PAD_INPUT.timer);PAD_INPUT.timer=null;PAD_INPUT.press=null;PAD_INPUT.tap=null;
}
function padRunValid(p){
  return p&&player===p.hero&&RUN===p.run&&floorMeta===p.floor&&player.hp>0&&
    !RUN.over&&!RUN.victory&&!uiOpen()&&typeof gameTurns!=='undefined';
}
function queueDirectionPad(){
  if(PAD_INPUT.timer!==null)return;
  PAD_INPUT.timer=setTimeout(function(){PAD_INPUT.timer=null;pumpDirectionPad();},16);
}
function pumpDirectionPad(){
  var p=PAD_INPUT.press||PAD_INPUT.tap;if(!p)return;
  if(!padRunValid(p)){stopDirectionPad();return;}
  var now=performance.now();
  if(now>=p.nextAt&&!animBusy(true)){
    if(!pressDirectionPad(p.direction)){stopDirectionPad();return;}
    var first=!p.executed;p.executed=true;
    if(!p.held){PAD_INPUT.tap=null;return;}
    p.nextAt=now+(first?500:Math.max(250,MOVE_MS*STEP_RELEASE));
  }
  queueDirectionPad();
}
function startDirectionPad(ev){
  var b=directionPadButton(ev.target);
  if((ev.pointerType!=='touch'&&ev.pointerType!=='pen'&&ev.pointerType!=='mouse')||!b||ev.isPrimary===false||
     (ev.pointerType==='mouse'&&ev.button!==0))return false;
  stopDirectionPad();
  if(!player||typeof RUN==='undefined'||!RUN||typeof gameTurns==='undefined'||uiOpen()||player.hp<=0||RUN.over||RUN.victory)return false;
  if(typeof stopRest==='function')stopRest();if(typeof stopTravel==='function')stopTravel();
  ev.preventDefault();ev.stopImmediatePropagation();
  PAD_INPUT.click={button:b,until:performance.now()+1500};
  /* A direction cancels targeting once; holding that same press must not then
     walk the character after the cancelled spell. */
  if(aiming||(typeof BOWAIM!=='undefined'&&BOWAIM)){cancelAim();return true;}
  var p={pointerId:ev.pointerId,button:b,direction:b.getAttribute('data-d'),hero:player,run:RUN,floor:floorMeta,
    held:true,executed:false,nextAt:performance.now()};PAD_INPUT.press=p;
  try{if(b.setPointerCapture)b.setPointerCapture(ev.pointerId);}catch(error){}
  pumpDirectionPad();return true;
}
function finishDirectionPad(ev,cancel){
  var p=PAD_INPUT.press;if(!p||p.pointerId!==ev.pointerId)return;
  PAD_INPUT.press=null;p.held=false;
  if(cancel){stopDirectionPad();return;}
  if(!p.executed){PAD_INPUT.tap=p;queueDirectionPad();}
  else {clearTimeout(PAD_INPUT.timer);PAD_INPUT.timer=null;}
}
function consumeDirectionPadClick(ev){
  var click=PAD_INPUT.click;if(!click)return false;
  if(performance.now()>click.until){PAD_INPUT.click=null;return false;}
  if((ev.detail>0||ev.pointerType==='touch'||ev.pointerType==='pen')&&directionPadButton(ev.target)===click.button){
    PAD_INPUT.click=null;ev.preventDefault();ev.stopImmediatePropagation();return true;
  }
  return false;
}
window.addEventListener('pointerup',function(ev){finishDirectionPad(ev,false);},true);
window.addEventListener('pointercancel',function(ev){finishDirectionPad(ev,true);},true);
window.addEventListener('lostpointercapture',function(ev){finishDirectionPad(ev,true);},true);
window.addEventListener('pointermove',function(ev){
  var p=PAD_INPUT.press;if(!p||p.pointerId!==ev.pointerId)return;
  var t=document.elementFromPoint(ev.clientX,ev.clientY);
  if(directionPadButton(t)!==p.button)finishDirectionPad(ev,true);
},{capture:true,passive:false});
window.addEventListener('blur',stopDirectionPad,true);
document.addEventListener('visibilitychange',function(){if(document.hidden)stopDirectionPad();});

window.addEventListener('keydown', function(ev){
  var tgt=ev.target && ev.target.tagName;
  if(tgt==='INPUT'||tgt==='SELECT'||tgt==='TEXTAREA'||ev.target&&ev.target.closest&&ev.target.closest('[data-game-ui]')) return;
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
  if(consumeDirectionPadClick(ev))return;
  if(typeof stopRest==='function')stopRest();
  /* A mouse press rejected during a turn can release after it finishes. The
     browser still emits a click even when pointerdown was prevented. */
  if(PACING.blockedClick && ev.detail>0){PACING.blockedClick=false;blockPendingInput(ev);return;}
  if(turnSequenceBusy()){
    if(typeof stopTravel==='function')stopTravel();
    blockPendingInput(ev);return;
  }
  if(uiOpen() || !animBusy(!!directionPadButton(ev.target))) return;
  if(!pacedClickTarget(ev.target)) return;
  if(typeof stopTravel==='function')stopTravel();
  blockPendingInput(ev);
}, true);

/* Inventory context menus, native drops, and touch gesture starts can mutate
   gear without producing a click. Pointer-up cleanup is handled by touchui. */
window.addEventListener('pointerdown',function(ev){
  if(startDirectionPad(ev))return;
  stopDirectionPad();PAD_INPUT.click=null;
  PACING.blockedClick=turnSequenceBusy() || (!uiOpen() && pacedClickTarget(ev.target) && animBusy(!!directionPadButton(ev.target)));
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
