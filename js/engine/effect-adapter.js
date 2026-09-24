/* The single connection between status rules and the existing game world.
 * All hooks are evaluated when an action runs, never while the game loads. */
var gameEffects=FoteEffects.create({
  getPlayer:function(){return player;},
  now:function(){return typeof worldNow==='function'?worldNow():player.t;},
  hasPerk:function(id){return hasP(id);},
  affinity:function(el){return aff(el);},
  inWater:function(e){return at(e.x,e.y)===WATER;},
  defaultBurnDamage:function(){return sDMG(2);},
  bonusDuration:function(e){return e!==player&&e.foe&&syllaOn()&&godRank()>=5?1:0;},
  onBlocked:function(event){
    if(event.reason==='unstoppable')log('Unstoppable: the '+(event.key==='frozen'?'freeze':event.key==='root'?'hold':event.key)+' fails.','c-good');
  },
  onApplied:function(event,service){
    var e=event.entity,key=event.key;
    if(['burn','stun','fear','root','blind','poison','bleed','slow'].indexOf(key)>=0)sfx('status-'+key);
    if(e===player||!e.foe||e.hp<=0)return;
    if(key==='root'){
      if(aff('earth')>=6&&event.previous&&!(e.stoneImm>turn)){
        service.apply(e,'stone',2,undefined,{durationModifiers:false,refresh:'replace'});e.stoneImm=turn+4;
        floatText(e.x,e.y,'stone','earth');log(e.name+' turns to stone.','c-good');sfx('earth-cast');
      }
      if(aff('earth')>=3&&!service.has(e,'poison'))applyPoison(e,true);
    }
    if(event.fresh&&((key==='burn'&&combo('fire','light'))||(key==='root'&&combo('earth','light')))){
      /* The same application duration is used; duration modifiers are not paid twice. */
      service.apply(e,'blind',Math.max(1,event.turns),undefined,{durationModifiers:false});
    }
  },
  onFrozen:function(event){sfx('status-freeze');floatText(event.entity.x,event.entity.y,'frozen','ice');},
  onChill:function(event){
    var e=event.entity;if(e===player||!e.foe||!combo('water','air')||e.base.boss)return;
    var x=e.x+Math.sign(e.x-player.x),y=e.y+Math.sign(e.y-player.y);
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
      var black=e!==player&&e.foe&&combo('fire','shadow');
      damage=dealDirectDamage(e,Math.max(1,Math.round(s.d*(black?1:resistMult(e,'fire')))),'fire',e.lastHitBy||null);e._hit=performance.now();floatText(e.x,e.y,String(damage),'fire');
      if(e===player)log('Burning: '+damage+' fire damage.','c-you');
      if(gAt(e.x,e.y)===G_GRASS||gAt(e.x,e.y)===G_SHORT)ignite(e.x,e.y,e===player?'player':null);
      if(black&&e.hp>0)addHollow(e,1);
    }else if(key==='poison'){
      damage=Math.max(1,Math.round(e.maxhp*(e.base&&e.base.boss?.05:.10)));
      if(e===player&&((player.buffs&&player.buffs.poisonward>0)||aff('earth')>=6))damage=0;
      damage=dealDirectDamage(e,damage,'poison',null);floatText(e.x,e.y,String(damage),'poison');
    }else if(key==='aura'&&e===player){
      ents.slice().forEach(function(o){if(o.foe&&dist(o,player)<=2){var dealt=applyDamage(o,s.d||3,'dark',player);floatText(o.x,o.y,String(dealt),'dark');healPlayer(1);if(o.hp<=0)kill(o,player);}});
    }
    if(e.hp<=0){kill(e,e===player||key==='poison'?null:e.lastHitBy||null);return false;}
    return true;
  },
  onAfterPulse:function(event){if(event.entity===player&&player.hp<event.hpBefore)refreshHardened();}
});

function applyStatus(e,key,turns,extra){return gameEffects.apply(e,key,turns,extra);}
function addChill(e){return gameEffects.addChill(e);}
function effectHasTag(e,tag){return gameEffects.hasTag(e,tag);}
