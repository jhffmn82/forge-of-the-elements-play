/* One world turn is 100 scheduler units. No elapsed time means no periodic tick.
   The effect service owns application, immunity, and status pulses. */
var WORLD_NOW=null;
function worldNow(){return WORLD_NOW===null?player.t:WORLD_NOW;}
/* Saves made while floor generation reset player.t can contain effect birth
   stamps from the former, higher scheduler clock.  Preserve each remaining
   duration, but bring impossible future stamps back to the loaded clock so the
   next elapsed world turn resumes the countdown. */
function repairSavedEffectClocks(){
  if(!player)return;
  var now=Number.isFinite(player.t)?player.t:0,actors=[player].concat((ents||[]).filter(function(e){return e!==player;}));
  actors.forEach(function(e){
    gameEffects.repairClock(e,now);   /* a turn back, so the next pulse resumes the countdown (a stamp inside the current interval is spared by it) */
  });
  player._worldBuffBorn=player._worldBuffBorn||{};
  Object.keys(player.buffs||{}).forEach(function(k){if(player.buffs[k]>0&&(!(player._worldBuffBorn[k]<=now)))player._worldBuffBorn[k]=now;});
  player._worldBuffPrev=Object.assign({},player.buffs||{});
  player._buffPrev=Object.assign({},player.buffs||{});
  if(player.hidden>0){if(!(player._worldHiddenBorn<=now))player._worldHiddenBorn=now;player._worldHiddenPrev=player.hidden;}
  if(player.levitate>0){if(!(player._worldLevitateBorn<=now))player._worldLevitateBorn=now;player._worldLevitatePrev=player.levitate;}
  /* Scheduler stamps written against that former clock: Resolve, Fortitude, Storm Form, Grumbok's
     boons, Rally and Sanctuary.  One further ahead than its effect can reach is a relic of the old
     clock, not a live effect, so it expires now instead of granting hundreds of turns of immunity. */
  var spans={resolveUntil:1000,fortUntil:1500,spellbreakUntil:1000,wizardHunterUntil:300,stormUntil:600};
  Object.keys(spans).forEach(function(k){if(player[k]>now+spans[k])player[k]=now;});
  if(player.lastDamageTime>now)player.lastDamageTime=now;
  actors.forEach(function(e){if(e!==player&&e.rallyUntil>now+1300)e.rallyUntil=now;});
  if(typeof floorMeta==='object'&&floorMeta&&floorMeta.sanctuary&&floorMeta.sanctuary.until>now+1300)floorMeta.sanctuary.until=now;
}
function knockback(e,dx,dy,n){
  /* DESIGN 12: Unstoppable is immune to knockback (2026-09-22: it was in the table, not in the code) */
  if(gameEffects.blocked(e,'knockback'))return false;
  var moved=false;dx=Math.sign(dx);dy=Math.sign(dy);
  var blocked=false;
  for(var i=0;i<n;i++){var x=e.x+dx,y=e.y+dy;if(!walkable(x,y)||occupied(x,y)){blocked=true;break;}e.x=x;e.y=y;moved=true;}
  if(moved){e._lx=undefined;if(e===player){player.resolveUntil=player.t+200;computeFOV();}}
  if(blocked&&typeof sfx==='function')sfx('knock-thud');   /* the push ended against a wall or a body (gap pass 2026-09-22) */
  return moved;
}
function worldStatusPulse(e,clock){
  return gameEffects.pulse(e,clock);
}
STATUS_INFO.resolve={name:'Resolve',icon:'st-stone',d:'Temporary protection against repeated hard control and forced movement.'};
