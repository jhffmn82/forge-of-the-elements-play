/* One world turn is 100 scheduler units. No elapsed time means no periodic tick.
   Applied after all legacy wrappers; actual status resolution remains in tickStatus. */
var WORLD_TICK=false;
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
    Object.keys(e&&e.st||{}).forEach(function(k){var s=e.st[k];if(s&&s.bornAt!==undefined&&s.bornAt>now)s.bornAt=now;});
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
var _worldApplyStatus=applyStatus;
applyStatus=function(e,k,n,extra){
  var hard=['stun','root','frozen'].includes(k);
  if(e===player&&hard&&player.resolveUntil>worldNow())return;
  var before=e&&e.st&&e.st[k],r=_worldApplyStatus(e,k,n,extra),s=e&&e.st&&e.st[k];
  if(s&&s!==before){s.bornAt=worldNow();if(e===player&&hard)player.resolveUntil=worldNow()+s.t*100+200;}
  return r;
};
function knockback(e,dx,dy,n){
  /* DESIGN 12: Unstoppable is immune to knockback (2026-09-22: it was in the table, not in the code) */
  if(!e||e.hp<=0||e===player&&(e.resolveUntil>player.t||hasP('unstoppable'))||e.base&&e.base.boss)return false;
  var moved=false;dx=Math.sign(dx);dy=Math.sign(dy);
  var blocked=false;
  for(var i=0;i<n;i++){var x=e.x+dx,y=e.y+dy;if(!walkable(x,y)||occupied(x,y)){blocked=true;break;}e.x=x;e.y=y;moved=true;}
  if(moved){e._lx=undefined;if(e===player){player.resolveUntil=player.t+200;computeFOV();}}
  if(blocked&&typeof sfx==='function')sfx('knock-thud');   /* the push ended against a wall or a body (gap pass 2026-09-22) */
  return moved;
}
function worldStatusPulse(e,clock){
  if(!e||e.hp<=0||e.tomb>0)return;
  var held={};Object.keys(e.st||{}).forEach(function(k){var s=e.st[k];if(s.bornAt!==undefined&&s.bornAt>=clock){held[k]=s;delete e.st[k];}});
  WORLD_TICK=true;
  try{tickStatus(e);}finally{WORLD_TICK=false;Object.keys(held).forEach(function(k){if(!e.st[k])e.st[k]=held[k];});}
}
function worldAdvance(from,to){
  if(!(to>from))return;
  for(var clock=(Math.floor(from/100)+1)*100;clock<=to;clock+=100){
    [player].concat(ents.filter(function(e){return e!==player;})).forEach(function(e){
      if(e.tomb>0){e.tomb--;return;}
      worldStatusPulse(e,clock);
      if(e!==player&&!(e.undeadServant)){
        var lifeKey=e.shadeLife>0?'shadeLife':'life';
        if(e[lifeKey]>0){e[lifeKey]--;if(e[lifeKey]<=0)ents=ents.filter(function(o){return o!==e;});}
      }
    });
    Object.keys(player.buffs||{}).forEach(function(k){
      if(!(player.buffs[k]>0)||(player._worldBuffBorn||{})[k]>=clock)return;
      player.buffs[k]--;
      if(k==='afterglow'&&player.hp>0)healPlayer(Math.max(1,Math.round(player.maxhp*.05)));
    });
    if(player.hidden>0&&!(player._worldHiddenBorn>=clock))player.hidden--;
    if(player.levitate>0&&!(player._worldLevitateBorn>=clock)){
      player.levitate--;if(!player.levitate&&at(player.x,player.y)===CHASM)fallIntoChasm();
    }
    if(typeof groundTick==='function')groundTick();
  }
}
/* Interleave actors with world pulses. A one-turn stun survives every action
   before the next 100-unit boundary, regardless of the actor's speed. */
function worldRunActors(from,to){
  (player._worldFreshBuffs||[]).forEach(function(k){player._worldBuffBorn[k]=to;});
  player._worldFreshBuffs=[];
  var next=(Math.floor(from/100)+1)*100,guard=0;
  try{
    while(player.hp>0&&guard++<10000){
      var actor=null;
      ents.forEach(function(e){if((e.foe||e.ally)&&e.hp>0&&e.t<to&&(!actor||e.t<actor.t))actor=e;});
      if(next<=to&&(!actor||next<=actor.t)){
        WORLD_NOW=next;worldAdvance(next-100,next);next+=100;continue;
      }
      if(!actor)break;
      WORLD_NOW=Math.max(from,actor.t);var before=actor.t;
      (actor.ally?allyAct:aiAct)(actor);
      if(actor.t<=before)actor.t=before+Math.max(1,actCost(actor));
    }
  }finally{WORLD_NOW=null;}
}
var _worldEnd=endTurn;
endTurn=function(){
  if(typeof ECHOING!=='undefined'&&ECHOING)return;
  var from=player.t,prev=player._worldBuffPrev||{};
  player._worldBuffBorn=player._worldBuffBorn||{};
  player._worldFreshBuffs=[];
  Object.keys(player.buffs||{}).forEach(function(k){if(player.buffs[k]>(prev[k]||0)){player._worldBuffBorn[k]=from;player._worldFreshBuffs.push(k);}});
  if(player.hidden>(player._worldHiddenPrev||0))player._worldHiddenBorn=from;
  if(player.levitate>(player._worldLevitatePrev||0))player._worldLevitateBorn=from;
  var r=_worldEnd.apply(this,arguments);
  player._worldBuffPrev=Object.assign({},player.buffs);player._worldHiddenPrev=player.hidden;
  player._worldLevitatePrev=player.levitate;
  if(player.hp<=0)death();else {derive(player);updateUI();draw();}
  return r;
};
STATUS_INFO.resolve={name:'Resolve',icon:'st-stone',d:'Temporary protection against repeated hard control and forced movement.'};
var _worldPrayer=usePrayer;
usePrayer=function(){
  var before=player.t,r=_worldPrayer.apply(this,arguments);
  if(player.t===before){
    player._worldBuffPrev=Object.assign({},player.buffs);
    player._worldBuffBorn=player._worldBuffBorn||{};
    Object.keys(player.buffs||{}).forEach(function(k){if(player.buffs[k]>0)player._worldBuffBorn[k]=before;});
  }
  return r;
};
