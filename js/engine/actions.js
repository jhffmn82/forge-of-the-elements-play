/* Action contexts and hit arithmetic. Inputs are explicit and never mutated. */
(function(root){
  'use strict';
  function criticalMultiplier(agility,gearBonus){
    return 1.6+(agility>=15?.25:0)+(agility>=21?.25:0)+(gearBonus||0);
  }
  function lunge(){return {mana:7,range:4,stun:2};}
  function reginaldLance(){return {range:3,width:3,multiplier:1};}
  /* Called after the normal accuracy check. Secondary damage cannot borrow
   * the combo's forced critical, even when it has an ordinary crit roll. */
  function criticalHit(rolled,context){
    return !!rolled||!!(context.primary&&(context.critOnBurning&&context.burning||context.critOnStunned&&context.stunned));
  }
  function resistance(type,c){
    if(type==='phys')return 1;
    var m=1;
    if(c.player){
      m-=c.armorResistance||0;m-=c.tomeResistance||0;m-=c.godResistance||0;
      if(type==='ice')m-=.05*(c.water||0);
      m-=.01*Math.max(0,(c.vitality||10)-10)+(c.bulwark?.05:0);
      if(type==='magic')m=Math.max(m,.75);
      if(c.lightVulnerable&&type==='light')m+=.25;
      if(c.courtOpposite===type)m+=.25;
    }else{
      if(type==='magic')return c.sanctuary?Math.max(.25,1-.15*c.divine):1;
      if(c.element===type)m-=.5;
      if(c.opposite===type)m+=.5;
      if(c.undead&&type==='light')m+=.5;
    }
    if(c.wet){if(type==='lightning')m+=.5;if(type==='fire')m-=.25;}
    if(type==='ice'&&c.chilled)m+=.25;
    m=Math.max(0,m);
    if(c.player&&type!=='magic'&&c.warding)m=Math.max(.1,m-c.warding);
    if(c.immune)m=0;
    if(c.player){
      if(c.poisonward&&type==='poison')m=0;
      if(c.shadeward&&type==='dark'||c.stormward&&type==='lightning'||c.fireward&&type==='fire')m*=.5;
      if(c.starward&&type!=='magic')m*=.8;
    }
    if(c.sanctuary)m=Math.min(m,Math.max(.25,m-.15*c.divine));
    return m;
  }
  /* Divine invocations can author a primary damage rule independent of the
   * ordinary spell/affinity formula; hit, crit and combat riders remain shared. */
  function divineSpellDamage(base,rank,divine){return Math.max(0,Math.round((base+5*Math.max(0,rank-1))*divine));}
  function spellDamage(amount,c){
    var n=amount;
    // Bolts and area spells deliberately retain their authored rounding order.
    if(c.bolt&&c.numbing)n=Math.round(n*1.5);
    if(c.crit)n=Math.round(n*c.criticalMultiplier);
    if(!c.bolt&&c.numbing)n=Math.round(n*1.5);
    if(!c.bolt&&c.lightUndead)n=Math.round(n*1.5);
    return n;
  }
  /* Serializable causal facts, captured while the selected action view exists.
   * Damage channels retain their meaning even inside another active action. */
  function damageCause(action,packet,inherited){
    var tags=Array.from(packet.tags||[]),owned=action&&action.source===packet.source;
    var kind=owned?action.kind:inherited&&inherited.kind||'unknown';
    if(tags.indexOf('periodic')>=0)kind='periodic';
    else if(tags.indexOf('environment')>=0)kind='environment';
    else if(tags.indexOf('reflected')>=0)kind='reflected';
    else if(tags.indexOf('arc')>=0)kind='arc';
    var weapon=owned&&action.view&&action.view.weapon,ability=packet.ability||owned&&(action.ability||action.options&&action.options.ability);
    var application=packet.options&&packet.options.applicationCause||inherited&&inherited.applicationCause||null;
    var unarmed=kind==='attack'&&tags.indexOf('ranged')<0&&!!(owned?weapon&&weapon.unarmed:inherited&&inherited.unarmed);
    var target=packet.target,hit=packet.hit,targetAwake=!!target&&target.state!=='asleep';
    if(hit&&hit.def===target&&typeof hit.targetAwake==='boolean')targetAwake=hit.targetAwake;
    return Object.freeze({version:1,actionId:!owned&&inherited&&inherited.actionId!==undefined?inherited.actionId:packet.actionId,kind:kind,
      rootKind:action&&action.rootKind||inherited&&inherited.rootKind||null,
      rootSourceId:action?action.rootSourceId:inherited&&Number.isFinite(inherited.rootSourceId)?inherited.rootSourceId:null,
      sourceId:packet.source&&Number.isFinite(packet.source.id)?packet.source.id:!owned&&inherited&&Number.isFinite(inherited.sourceId)?inherited.sourceId:null,
      targetId:target&&Number.isFinite(target.id)?target.id:null,targetAwake:targetAwake,
      weaponKey:owned?weapon&&(weapon.key||(weapon.unarmed?'fists':null))||null:inherited&&inherited.weaponKey||null,
      weaponName:owned?weapon&&weapon.name||null:inherited&&inherited.weaponName||null,
      unarmed:unarmed,abilityKey:ability&&ability.id||inherited&&inherited.abilityKey||null,
      abilityName:ability&&ability.name||inherited&&inherited.abilityName||null,tags:Object.freeze(tags),applicationCause:application});
  }
  function create(){
    var active=null,sequence=0,listeners={};
    function emit(name,event){(listeners[name]||[]).slice().forEach(function(fn){fn(event);});}
    function run(kind,source,target,options,resolve){
      options=options||{};
      var parent=active,event={id:++sequence,actionId:parent?parent.actionId:sequence,parentId:parent?parent.id:null,
        rootKind:parent?parent.rootKind:kind,rootSourceId:parent?parent.rootSourceId:source&&Number.isFinite(source.id)?source.id:null,
        kind:kind,source:source,target:target,options:options,tags:new Set(options.tags||[]),
        depth:parent?parent.depth+1:0,hit:null,damage:0,landed:false};
      if(event.depth>32)return event;
      active=event;
      try{emit('actionStarted',event);resolve(event);emit('actionResolved',event);return event;}
      finally{active=parent;}
    }
    function suspend(resolve){var prior=active;active=null;try{return resolve();}finally{active=prior;}}
    return Object.freeze({run:run,suspend:suspend,current:function(){return active;},on:function(name,fn){(listeners[name]||(listeners[name]=[])).push(fn);return function(){listeners[name]=listeners[name].filter(function(f){return f!==fn;});};}});
  }
  var api=Object.freeze({lunge:lunge,reginaldLance:reginaldLance,criticalMultiplier:criticalMultiplier,criticalHit:criticalHit,resistance:resistance,spellDamage:spellDamage,divineSpellDamage:divineSpellDamage,damageCause:damageCause,create:create});
  root.FoteActions=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis==='object'?globalThis:this);
