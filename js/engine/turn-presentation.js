/* Finite presentation deadlines for the resumable actor scheduler. Ambient
 * animation keeps drawing independently and never holds a simulation turn. */
function turnAnimationImmediate(){
  return !player || ANIM.reduce || (typeof gameTurns!=='undefined' && typeof gameTurns.flushing==='function' && gameTurns.flushing());
}
function turnAnimationOnscreen(x,y,pad){
  pad=pad||0;
  return Number.isFinite(x)&&Number.isFinite(y)&&x+pad>=camX-1&&y+pad>=camY-1&&x<=camX+viewW+1&&y<=camY+viewH+1;
}
function turnAnimationVisible(e){
  if(!e||!turnAnimationOnscreen(e.x,e.y,e.base&&e.base.big||0))return false;
  if(e===player)return true;
  if(e.parent||e.kind==='mawlimb')return false;
  return actorVisible(e,true);
}
function turnAnimationActors(){
  return [player].concat(ents.filter(function(e){return e!==player;})).filter(turnAnimationVisible);
}
var TURN_ANIMATION_BEFORE=null;
function turnPrimeAnimations(){
  TURN_ANIMATION_BEFORE=null;
  if(turnAnimationImmediate())return;
  /* Slides begin when renderPos observes a changed tile, so every visible
   * figure is placed before AI moves it or knocks it back. */
  var actors=new Map();
  turnAnimationActors().forEach(function(e){
    renderPos(e);var clip=e._clip;
    actors.set(e,{clip:clip,name:clip&&clip.name,t0:clip&&clip.t0});
  });
  TURN_ANIMATION_BEFORE={actors:actors,effects:new Set(fx)};
}
function turnAnimationClipEnd(e,now){
  var clip=e._clip;
  if(!clip||!spriteOn||!['attack','melee','ranged','cast'].includes(clip.name)||!Number.isFinite(clip.t0))return now;
  /* Old saves can contain a clip timestamp from a different page clock. Such
   * a future clip was not scheduled on this page's effect queue. */
  if(clip.t0>Math.max(now,typeof fxClock==='number'?fxClock:0)+1)return now;
  if(e.livingFlame)return now;
  var shade=typeof isShadeSummon==='function'&&isShadeSummon(e);
  var sheet=e===player||e.shadowClone?AS.cast&&AS.cast[e.shadowClone?e.cloneLook:playerCastLook()]:AS.mobs&&AS.mobs[shade?'m-shade':e.base&&e.base.sprite];
  if(!sheet&&e!==player&&!shade&&typeof FoteChaosEnemyArt!=='undefined'){
    var chaosSheet=FoteChaosEnemyArt.sheet(e.base&&e.base.sprite);if(chaosSheet)sheet=chaosSheet.m;
  }
  var frames=sheet&&sheet.clips&&sheet.clips[clip.name];
  var heldStill=e.base&&e.base.stillPose&&!shade&&sheet&&sheet.static_row!==undefined;
  var end=frames&&!heldStill?clip.t0+frames.frames*(CLIP_MS[clip.name]||70):now;
  /* Still-pose elemental art has a finite procedural attack compression. */
  if(e.base&&(e.base.elementTier||e.base.stillPose)&&clip.name==='attack'&&e.state!=='asleep')end=Math.max(end,clip.t0+540);
  return end;
}
function turnAnimationEffectVisible(f){
  if(f.k==='l')return turnAnimationVisible(f.e);
  if(f.k!=='p'&&f.k!=='b')return false;
  /* Effects draw independently of actor visibility. A bolt crossing the
   * viewport still finishes even if its source or destination is outside it. */
  if(![f.ax,f.ay,f.bx,f.by].every(Number.isFinite))return false;
  return Math.max(f.ax,f.bx)>=camX-1&&Math.min(f.ax,f.bx)<=camX+viewW+1&&Math.max(f.ay,f.by)>=camY-1&&Math.min(f.ay,f.by)<=camY+viewH+1;
}
/* 2026-09-27 (Justin: "only make attacks pause the game to finish"). A step never holds a turn: each slide
 * starts as its figure moves, so a crowded turn's slides play together. Swings, casts, shots, lunges and
 * projectiles the player can see still play one after another, in turn order. */
function turnFiniteAnimationWait(actor){
  if(turnAnimationImmediate())return 0;
  var playerAction=actor===player,before=playerAction?null:TURN_ANIMATION_BEFORE;
  var sequential=turnAnimationVisible(actor)&&!actor.ally;
  var now=performance.now(),end=now;
  turnAnimationActors().forEach(function(e){
    var prior=before&&before.actors.get(e),clip=e._clip;
    var newClip=before&&(!prior||prior.clip!==clip||prior.name!==(clip&&clip.name)||prior.t0!==(clip&&clip.t0));
    renderPos(e);
    if(playerAction||sequential||e===actor||newClip)end=Math.max(end,turnAnimationClipEnd(e,now));
  });
  fx.forEach(function(f){
    if((playerAction||sequential||!before||!before.effects.has(f))&&turnAnimationEffectVisible(f)&&Number.isFinite(f.t0)&&Number.isFinite(f.dur)&&f.dur>0)end=Math.max(end,f.t0+f.dur);
  });
  /* Only a pause is drawn here. Actors that do not pause run on in the same task, where a draw is never
   * shown; the turn's last phase draws their slides. */
  if(end>now){
    if(typeof updateTurnUI==='function')updateTurnUI();
    draw();turnStartSlides();
  }
  return Math.max(0,end-performance.now());
}
/* 2026-09-28: the slides stamped while this task's AI ran start once its work is done: at a swing the player can
 * see (render.js setClip), a pause, or the turn's end. A crowded floor's AI time never eats them (game.js motionStart). */
function turnStartSlides(){
  if(ANIM.reduce)return;
  var now=performance.now();
  motionStart(player,now);ents.forEach(function(e){motionStart(e,now);});
}
function turnActorAnimationWait(actor){return turnFiniteAnimationWait(actor);}
function turnPlayerAnimationWait(){return turnFiniteAnimationWait(player);}
