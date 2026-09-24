/* Status rules are independent of rendering, combat globals, and actor scheduling. */
(function(root, factory){
  var api=factory();
  if(typeof module==='object' && module.exports)module.exports=api;
  else root.FoteEffects=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  var definitions={
    burn:{tags:['harmful','damage-over-time','burn'],element:'fire',periodic:true},
    poison:{tags:['harmful','damage-over-time','poison'],element:'earth',immuneRank:6,periodic:true},
    bleed:{tags:['harmful','damage-over-time','bleed'],periodic:true},
    slow:{tags:['harmful','movement-control','slow']},
    chill:{tags:['harmful','movement-control','slow','chill'],element:'water',aliases:['frost','chilled']},
    frozen:{tags:['harmful','movement-control','slow','hard-control','frozen'],element:'water',bossControl:true,aliases:['freeze']},
    root:{tags:['harmful','movement-control','root','hard-control'],element:'earth',bossControl:true,aliases:['rooted','web','webbed']},
    stun:{tags:['harmful','hard-control','stun'],element:'air',bossControl:true,aliases:['stunned']},
    knockback:{tags:['movement-control','hard-control','knockback'],bossControl:true},
    fear:{tags:['harmful','fear'],element:'shadow',bossControl:true},
    blind:{tags:['harmful','blind'],element:'light'},
    wet:{tags:['harmful','wet']},
    corrupt:{tags:['harmful','corrupt']},
    hollow:{tags:['harmful','hollow']},
    rot:{tags:['harmful','rot']},
    stone:{tags:['stone']},
    aura:{tags:['beneficial','aura'],periodic:true},
    wardshield:{tags:['beneficial','shield']},
    challenged:{tags:['harmful','challenge']},
    coward:{tags:['harmful','challenge']}
  };
  var aliases=Object.create(null);
  Object.keys(definitions).forEach(function(key){
    var entry=definitions[key];entry.key=key;
    (entry.aliases||[]).forEach(function(alias){aliases[alias]=key;});
    Object.freeze(entry.tags);if(entry.aliases)Object.freeze(entry.aliases);Object.freeze(entry);
  });
  Object.freeze(definitions);Object.freeze(aliases);
  function canonical(key){return aliases[key]||key;}
  function definition(key){return definitions[canonical(key)]||{key:canonical(key),tags:key&&key.indexOf('imm_')===0?['immunity']:[]};}
  function tags(key,status){
    var result=definition(key).tags;
    if(key==='web'||key==='webbed'||status&&status.effect==='web')return result.concat('web');
    return result;
  }
  function create(hooks){
    hooks=hooks||{};
    var unit=hooks.worldTurn||100,lastPulse=new WeakMap(),pulseClock=null;
    function player(e){return hooks.isPlayer?!!hooks.isPlayer(e):e===(hooks.getPlayer&&hooks.getPlayer());}
    function now(){var n=pulseClock===null?(hooks.now?hooks.now():0):pulseClock;return Number.isFinite(n)?n:0;}
    function perk(e,id){return !!(hooks.hasPerk&&hooks.hasPerk(id,e));}
    function affinity(el){return hooks.affinity?hooks.affinity(el)||0:0;}
    function boss(e){return hooks.isBoss?!!hooks.isBoss(e):!!(e.base&&e.base.boss);}
    function alive(e){return !!e&&!(e.hp<=0);}
    function has(e,key){var s=e&&e.st&&e.st[canonical(key)];return !!s&&(s.t===undefined||s.t>0);}
    function hasTag(e,tag){return Object.keys(e&&e.st||{}).some(function(key){return has(e,key)&&tags(key,e.st[key]).indexOf(tag)>=0;});}
    function blocked(e,key,options){
      if(!alive(e))return 'dead';
      if(options&&options.ignoreImmunity)return null;
      if(key==='knockback'&&boss(e))return 'boss';
      var d=definition(key),t=d.tags;
      if(player(e)){
        if(perk(e,'unstoppable')&&t.some(function(tag){return ['slow','root','stun','knockback'].indexOf(tag)>=0;}))return 'unstoppable';
        if(t.indexOf('hard-control')>=0&&e.resolveUntil>now())return 'resolve';
        if(d.element&&affinity(d.element)>=(d.immuneRank||3))return 'element';
      }else {
        if(e.stunImmune&&t.indexOf('stun')>=0)return 'sap-immunity';
        if(has(e,'imm_'+canonical(key)))return 'temporary-immunity';
      }
      if(canonical(key)==='burn'&&hooks.inWater&&hooks.inWater(e))return 'water';
      return null;
    }
    function emit(hook,event){if(hooks[hook])return hooks[hook](event,service);}
    function remove(e,key,reason){
      key=canonical(key);var status=e&&e.st&&e.st[key];if(!status)return false;
      delete e.st[key];
      var event={entity:e,key:key,status:status,reason:reason||'removed',clock:now()};
      if(key==='root'&&e.syllaWeb>0){
        var slow=e.syllaWeb;e.syllaWeb=0;
        if(reason==='expired'&&alive(e))apply(e,'slow',slow,undefined,{data:{effect:'web'}});
      }
      if(reason==='expired'&&key==='fear'&&!player(e)&&alive(e))apply(e,'imm_fear',5,undefined,{durationModifiers:false,ignoreImmunity:true});
      emit('onExpired',event);return true;
    }
    function apply(e,key,turns,extra,options){
      options=options||{};var requested=key;key=canonical(key);
      if(!Number.isFinite(turns))return {applied:false,reason:'invalid-duration',key:key};
      if(turns<=0)return {applied:false,removed:remove(e,key,'zero-duration'),reason:'zero-duration',key:key};
      var reason=blocked(e,key,options),event={entity:e,key:key,requested:requested,turns:turns,reason:reason};
      if(reason){emit('onBlocked',event);return {applied:false,reason:reason,key:key};}
      e.st=e.st||{};var previous=e.st[key],d=definition(key);
      if(options.durationModifiers!==false){
        if(hooks.bonusDuration)turns+=hooks.bonusDuration(e,key,turns)||0;
        if(player(e)&&perk(e,'ironConst'))turns=Math.max(1,Math.round(turns/2));
        if(!player(e)&&boss(e)&&d.bossControl)turns=1;
      }
      var status=Object.assign({},previous||{},options.data||{});
      status.t=options.refresh==='replace'?turns:Math.max(turns,previous&&previous.t||0);
      status.bornAt=options.bornAt===undefined?now():options.bornAt;
      if(extra!==undefined)status.d=extra;
      if(key==='burn'&&!status.d)status.d=hooks.defaultBurnDamage?hooks.defaultBurnDamage():2;
      if(requested==='web'||requested==='webbed')status.effect='web';
      e.st[key]=status;
      if(player(e)&&d.tags.indexOf('hard-control')>=0)e.resolveUntil=now()+status.t*unit+2*unit;
      event.status=status;event.previous=previous;event.fresh=!previous;event.turns=turns;event.reason=null;
      event.options=options;emit('onApplied',event);
      return {applied:true,key:key,status:status,previous:previous};
    }
    function addChill(e){
      var reason=blocked(e,'chill');
      if(reason||e.tomb>0)return {applied:false,reason:reason||'entombed',key:'chill'};
      var rank=player(e)?0:affinity('water'),need=player(e)||rank>=6?3:4;
      var previous=e.st&&e.st.chill,n=(previous&&previous.n||0)+1,result;
      if(n>=need&&!has(e,'imm_frozen')){
        remove(e,'chill','transformed');result=apply(e,'frozen',2);
        if(result.applied&&!player(e))apply(e,'imm_frozen',5,undefined,{durationModifiers:false,ignoreImmunity:true});
        if(result.applied)emit('onFrozen',{entity:e,status:result.status});
      }else result=apply(e,'chill',4,undefined,{data:{n:Math.min(n,need-1),waterRank:rank},refresh:'replace',durationModifiers:false});
      /* Chill's direct stacking path historically receives Iron Constitution, not Sylla's extension. */
      if(result.applied&&result.key==='chill'&&player(e)&&perk(e,'ironConst'))result.status.t=2;
      if(result.applied)emit('onChill',{entity:e,result:result});
      return result;
    }
    function applyWeb(e,settings){
      settings=settings||{};
      var root=apply(e,'web',settings.rootTurns===undefined?1:settings.rootTurns);
      if(root.applied)e.syllaWeb=settings.slowTurns===undefined?3:settings.slowTurns;
      var bleed=apply(e,'bleed',settings.bleedTurns===undefined?3:settings.bleedTurns,settings.bleedDamage===undefined?2:settings.bleedDamage);
      return {root:root,bleed:bleed};
    }
    function eligible(e,status,clock){return status.bornAt===undefined||(player(e)?status.bornAt<clock-unit:status.bornAt<=clock-unit);}
    function pulse(e,clock){
      if(!alive(e)||e.tomb>0||!Number.isFinite(clock))return alive(e);
      if(lastPulse.get(e)===clock)return true;
      lastPulse.set(e,clock);
      var previousClock=pulseClock;pulseClock=clock;
      try{
      var hp=e.hp,event={entity:e,clock:clock};
      if(emit('onBeforePulse',event)===false)return false;
      var keys=Object.keys(e.st||{}).sort(function(a,b){var order={bleed:0,burn:1,poison:2,aura:3};return (order[a]===undefined?4:order[a])-(order[b]===undefined?4:order[b]);});
      for(var i=0;i<keys.length;i++){
        var key=keys[i],status=e.st[key];if(!status||!eligible(e,status,clock))continue;
        if(status.t!==undefined&&status.t<=0){remove(e,key,'expired');continue;}
        if(emit('onTick',{entity:e,key:key,status:status,clock:clock})===false||!alive(e)){
          emit('onAfterPulse',{entity:e,clock:clock,hpBefore:hp,alive:false});return false;
        }
        if(e.st[key]!==status||status.t===undefined)continue;
        status.t--;if(status.t<=0)remove(e,key,'expired');
      }
      emit('onAfterPulse',{entity:e,clock:clock,hpBefore:hp,alive:alive(e)});return alive(e);
      }finally{pulseClock=previousClock;}
    }
    function repairClock(e,clock){
      Object.keys(e&&e.st||{}).forEach(function(key){var s=e.st[key];if(s&&s.bornAt>clock)s.bornAt=clock-unit;});
      if(e)lastPulse.delete(e);
    }
    function clear(e,tag){
      Object.keys(e&&e.st||{}).forEach(function(key){if(!tag||tags(key,e.st[key]).indexOf(tag)>=0)remove(e,key,'cleansed');});
    }
    var service={apply:apply,remove:remove,has:has,hasTag:hasTag,blocked:blocked,addChill:addChill,applyWeb:applyWeb,pulse:pulse,eligible:eligible,repairClock:repairClock,clear:clear,definition:definition,tags:tags,canonical:canonical};
    return Object.freeze(service);
  }
  return Object.freeze({create:create,registry:definitions,canonical:canonical,definition:definition,tags:tags});
});
