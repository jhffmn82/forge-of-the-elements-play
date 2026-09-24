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
  return !!(revealAll||(inb(e.x,e.y)&&vis[idxOf(e.x,e.y)])||(e.foe&&player.dawnUntil>turn));
}
function turnAnimationActors(){
  return [player].concat(ents.filter(function(e){return e!==player;})).filter(turnAnimationVisible);
}
var TURN_ANIMATION_BEFORE=null;
function turnPrimeAnimations(){
  TURN_ANIMATION_BEFORE=null;
  if(turnAnimationImmediate())return;
  /* Slides begin when renderPos observes a changed tile. Remember the old
   * positions before AI mutates them, including potential knockback targets. */
  var actors=new Map();
  turnAnimationActors().forEach(function(e){
    renderPos(e);var clip=e._clip;
    actors.set(e,{x:e.x,y:e.y,clip:clip,name:clip&&clip.name,t0:clip&&clip.t0});
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
  var sheet=e===player?AS.cast&&AS.cast[player.look]:AS.mobs&&AS.mobs[shade?'m-shade':e.base&&e.base.sprite];
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
function turnFiniteAnimationWait(actor){
  if(turnAnimationImmediate())return 0;
  var actors=turnAnimationActors(),playerAction=actor===player,visible=turnAnimationVisible(actor),before=playerAction?null:TURN_ANIMATION_BEFORE;
  var waitForMovement=!playerAction||ents.some(function(e){return e!==player&&(e.foe||e.ally)&&e.hp>0&&e.t<player.t&&turnAnimationVisible(e);});
  var now=performance.now(),end=now,changed=false;
  actors.forEach(function(e){
    var prior=before&&before.actors.get(e),oldMotion=MOTION_STATE.get(e),clip=e._clip;
    var moved=prior?prior.x!==e.x||prior.y!==e.y:oldMotion&&oldMotion.floor===floorMeta&&(oldMotion.x!==e.x||oldMotion.y!==e.y);
    var newClip=before&&(!prior||prior.clip!==clip||prior.name!==(clip&&clip.name)||prior.t0!==(clip&&clip.t0));
    if(moved||newClip&&turnAnimationClipEnd(e,now)>now)changed=true;
    renderPos(e);
    var motion=MOTION_STATE.get(e);
    if(waitForMovement&&(playerAction||visible||moved)&&motion&&motion.mt&&Number.isFinite(motion.mt)&&motion.floor===floorMeta)end=Math.max(end,motion.mt+(motion.dur||MOVE_MS));
    if(playerAction||visible||newClip)end=Math.max(end,turnAnimationClipEnd(e,now));
  });
  fx.forEach(function(f){
    if((playerAction||visible||!before||!before.effects.has(f))&&turnAnimationEffectVisible(f)&&Number.isFinite(f.t0)&&Number.isFinite(f.dur)&&f.dur>0)end=Math.max(end,f.t0+f.dur);
  });
  /* Unseen, idle actors have no presentation work. In particular they must
   * not force a full terrain/light redraw on every scheduler decision. */
  if((playerAction?waitForMovement:visible||changed)||end>now){
    if(typeof updateTurnUI==='function')updateTurnUI();
    draw();
  }
  return Math.max(0,end-performance.now());
}
function turnActorAnimationWait(actor){return turnFiniteAnimationWait(actor);}
function turnPlayerAnimationWait(){return turnFiniteAnimationWait(player);}
