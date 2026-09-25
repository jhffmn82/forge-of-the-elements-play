/* The single connection between status rules and the existing game world.
 * All hooks are evaluated when an action runs, never while the game loads. */
var gameEffects=FoteEffects.create({
  getPlayer:function(){return player;},
  now:function(){return typeof worldNow==='function'?worldNow():player.t;},
  hasPerk:function(id){return hasP(id);},
  affinity:function(el){return aff(el);},
  inWater:function(e){return at(e.x,e.y)===WATER;},
  defaultBurnDamage:function(){return sDMG(2);},
  bonusDuration:function(e,key,turns){if(e.shadowClone&&e.cloneStats&&e.cloneStats.passives.ironConst)return Math.max(1,Math.round(turns/2))-turns;return e!==player&&e.foe&&syllaOn()&&godRank()>=5?1:0;},
  onBlocked:function(event){
    if(event.reason==='unstoppable')log('Unstoppable: the '+(event.key==='frozen'?'freeze':event.key==='root'?'hold':event.key)+' fails.','c-good');
  },
  onApplied:function(event,service){
    var e=event.entity,key=event.key,sourceAff=event.options&&event.options.sourceAffinity;
    function rank(el){return sourceAff?sourceAff[el]||0:aff(el);}
    function hasCombo(a,b){return sourceAff?rank(a)>=3&&rank(b)>=2:combo(a,b);}
    if(['burn','stun','fear','root','blind','poison','bleed','slow'].indexOf(key)>=0)sfx('status-'+key);
    if(e===player&&key==='fear'){stopTravel();stopRest();PACING.pending=null;}
    if(e===player||!e.foe||e.hp<=0)return;
    if(key==='root'){
      if(rank('earth')>=6&&event.previous&&!(e.stoneImm>turn)){
        service.apply(e,'stone',2,undefined,{durationModifiers:false,refresh:'replace'});e.stoneImm=turn+4;
        floatText(e.x,e.y,'stone','earth');log(e.name+' turns to stone.','c-good');sfx('earth-cast');
      }
      if(rank('earth')>=3&&!service.has(e,'poison')){
        if(sourceAff)service.apply(e,'poison',Math.min(3,Math.max(1,rank('earth')-2)),undefined,{durationModifiers:false,refresh:'replace',data:{sourceAffinity:sourceAff}});
        else applyPoison(e,true);
      }
    }
    if(event.fresh&&((key==='burn'&&hasCombo('fire','light'))||(key==='root'&&hasCombo('earth','light')))){
      /* The same application duration is used; duration modifiers are not paid twice. */
      service.apply(e,'blind',Math.max(1,event.turns),undefined,{durationModifiers:false});
    }
  },
  onFrozen:function(event){sfx('status-freeze');floatText(event.entity.x,event.entity.y,'frozen','ice');},
  onChill:function(event){
    var e=event.entity,options=event.options||{},affinity=options.sourceAffinity,source=options.sourcePoint||player;
    if(e===player||!e.foe||!(affinity?(affinity.water||0)>=3&&(affinity.air||0)>=2:combo('water','air'))||e.base.boss)return;
    var x=e.x+Math.sign(e.x-source.x),y=e.y+Math.sign(e.y-source.y);
    if((x!==e.x||y!==e.y)&&walkable(x,y)&&!occupied(x,y)){e.x=x;e.y=y;}
  },
  onBeforePulse:function(event,service){
    var e=event.entity,bornAt=event.clock-101;
    if(at(e.x,e.y)===WATER){
      if(service.remove(e,'burn','extinguished'))floatText(e.x,e.y,'hiss','ice');
      service.apply(e,'wet',3,undefined,{durationModifiers:false,refresh:'replace',bornAt:bornAt});
    }
    if(fireT&&fireT[idxOf(e.x,e.y)]>0&&!(e===player&&aff('fire')>=6)&&!(e.base&&e.base.el==='fire')){
      service.apply(e,'burn',3,sDMG(2),{bornAt:bornAt});
    }
  },
  onTick:function(event,service){
    var e=event.entity,s=event.status,key=event.key,damage=0;
    if(key==='bleed'){
      damage=dealDirectDamage(e,Math.max(1,s.d||2),'phys',e.lastHitBy||null);e._hit=performance.now();floatText(e.x,e.y,String(damage),'blood');
      if(e===player)log('Bleeding: '+damage+' damage.','c-you');
      if(rng()<.35&&typeof setG==='function'&&gAt(e.x,e.y)===G_NONE)setG(e.x,e.y,G_BLOOD);
    }else if(key==='burn'){
      var black=e!==player&&e.foe&&(s.sourceAffinity?(s.sourceAffinity.fire||0)>=3&&(s.sourceAffinity.shadow||0)>=2:combo('fire','shadow'));
      damage=dealDirectDamage(e,Math.max(1,Math.round(s.d*(black?1:resistMult(e,'fire')))),'fire',e.lastHitBy||null,{resistanceApplied:!black});e._hit=performance.now();floatText(e.x,e.y,String(damage),'fire');
      if(e===player)log('Burning: '+damage+' fire damage.','c-you');
      if(gAt(e.x,e.y)===G_GRASS||gAt(e.x,e.y)===G_SHORT)ignite(e.x,e.y,e===player?'player':null);
      if(black&&e.hp>0)addHollow(e,1);
    }else if(key==='poison'){
      var poisonScale=Number.isFinite(s.damageScale)&&s.damageScale>0?s.damageScale:1;
      damage=Math.max(1,Math.round(e.maxhp*(e.base&&e.base.boss?.05:.10)*poisonScale));
      if(e===player&&((player.buffs&&player.buffs.poisonward>0)||aff('earth')>=6))damage=0;
      damage=dealDirectDamage(e,damage,'poison',null);floatText(e.x,e.y,String(damage),'poison');
    }else if(key==='aura'&&e===player){
      ents.slice().forEach(function(o){if(o.foe&&dist(o,player)<=2){var dealt=applyDamage(o,s.d||3,'dark',player);floatText(o.x,o.y,String(dealt),'dark');healPlayer(1);if(o.hp<=0)kill(o,player);}});
    }
    if(e.hp<=0){kill(e,e===player||key==='poison'?null:e.lastHitBy||null);return false;}
    return true;
  },
  onExpired:function(event){if(event.entity===player&&event.key==='livingmountain')derive(player);}
});

function applyStatus(e,key,turns,extra){return gameEffects.apply(e,key,turns,extra);}
function addChill(e){return gameEffects.addChill(e);}
function effectHasTag(e,tag){return gameEffects.hasTag(e,tag);}

/* Fear consumes this command only. It never schedules another player action. */
var PLAYER_FEAR_ACTING=false;
function playerFearAction(){
  if(PLAYER_FEAR_ACTING||!player||player.hp<=0||RUN.victory||player.tombed||gameTurns.busy()||!gameEffects.hasTag(player,'fear'))return false;
  var fear=player.st.fear||{},source=ents.find(function(e){return e.id===fear.sourceId&&e.hp>0;});
  if(!source&&Number.isFinite(fear.sourceX)&&Number.isFinite(fear.sourceY))source={x:fear.sourceX,y:fear.sourceY};
  if(!source)source=ents.filter(function(e){return e.foe&&e.hp>0;}).sort(function(a,b){return dist(player,a)-dist(player,b);})[0];
  stopTravel();stopRest();if(aiming)cancelAim();BOWAIM=null;PACING.pending=null;
  var held=['root','stun','frozen'].some(function(tag){return gameEffects.hasTag(player,tag);});
  var step=source&&!held&&FoteActors.bestStep(player,function(x,y){return dist({x:x,y:y},source);},function(x,y,dx,dy){
    if(!inb(x,y)||!walkable(x,y)||occupied(x,y))return false;
    var tile=at(x,y);if(tile===CHASM||tile===PORTAL||tile===EXIT||tile===STAIRS||tile===UPSTAIRS)return false;
    return !(dx&&dy&&!walkable(player.x+dx,player.y)&&!walkable(player.x,player.y+dy));
  },true);
  PLAYER_FEAR_ACTING=true;
  try{
    if(step){log('Fear drives you away.','c-info');performPlayerMove(step.dx,step.dy);}
    else {log('You cower in fear, unable to retreat.','c-info');endTurn();}
  }finally{PLAYER_FEAR_ACTING=false;}
  return true;
}
