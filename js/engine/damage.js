/* Damage/healing events and numeric rules. No actor globals, browser or content tables. */
(function(root){
  'use strict';
  var labels=Object.freeze({phys:'physical',poison:'poison',light:'light',dark:'shadow',ice:'frost',fire:'fire',magic:'magic',lightning:'lightning'});
  var aliases=Object.freeze({physical:'phys',shadow:'dark',frost:'ice',water:'ice',air:'lightning',earth:'poison'});
  function damageType(value){
    if(value===undefined||value===null||value==='')return 'phys';
    if(Object.prototype.hasOwnProperty.call(labels,value))return value;
    return Object.prototype.hasOwnProperty.call(aliases,value)?aliases[value]:null;
  }
  function damageLabel(value){return labels[damageType(value)]||labels.phys;}
  function physical(amount,options){
    var armor=Math.max(0,options.armor-(options.pierce||0));
    var flat=(options.heavy?0:Math.ceil(armor/2)+(options.earth||0))+(options.stone?3:0);
    // Flat armor cannot erase a hit before percentage defenses are considered.
    var damage=Math.max(0,amount-Math.min(flat,amount*.5))*(1-Math.min(.5,.02*armor));
    if(amount>0&&damage<1)damage=1;
    return damage*(options.frozen?2:1);
  }
  function elemental(amount,options){
    var multiplier=options.resistance;
    if(options.player&&multiplier<1)multiplier=Math.max(.25,multiplier);
    return Math.max(0,amount)*multiplier*(options.corrupt?1.25:1);
  }
  function absorb(amount,pools){
    var remaining=Math.max(0,amount),updates={},absorbed=[];
    pools.forEach(function(pool){
      var before=Math.max(0,pool.amount||0),spent=Math.min(before,remaining);
      updates[pool.key]=before-spent;remaining-=spent;
      if(spent)absorbed.push({key:pool.key,amount:spent,type:pool.type});
    });
    return {remaining:remaining,pools:updates,absorbed:absorbed};
  }
  function heal(hp,maxhp,amount){
    var restored=Math.max(0,Math.min(Math.max(0,amount),maxhp-hp));
    return {hp:hp+restored,restored:restored,overflow:Math.max(0,amount-restored)};
  }
  /* Potential healing precedes the missing-HP cap. Cards and HP application
   * share these modifiers; only heal() computes restoration and overflow. */
  function healingAmount(amount,context){
    context=context||{};
    if(context.rot)amount=context.regen?0:amount*.5;
    if(context.glimmerRank)amount*=1+.10*context.glimmerRank;
    if(context.sanctuaryPower)amount*=1+.25*context.sanctuaryPower;
    return amount;
  }
  /* Air mastery branches only original landed hits. Adapters provide the
   * captured affinity and eligible scene targets; cards read this same rule. */
  function airArc(rank){
    rank=Math.max(0,Number(rank)||0);
    return {chance:rank>=3?Math.min(1,.10*rank):0,targets:2,range:4,damageMultiplier:.5};
  }
  function chillArc(affinity){
    affinity=affinity||{};var arc=airArc(affinity.air);
    return {enabled:(affinity.water||0)>=3&&(affinity.air||0)>=2,targets:arc.targets,range:arc.range,damageMultiplier:arc.damageMultiplier};
  }
  function frozenArcGround(affinity){affinity=affinity||{};return {duration:(affinity.air||0)>=3&&(affinity.water||0)>=2?3:0};}
  function chainLightning(){return {targets:5,jumpRange:4,damageMultiplier:.75};}
  /* Silt Shield retains its stat-derived capacity; only a primary weapon
   * hit may restore this fixed amount, capped by the recipient's live pool. */
  function siltShield(){return {restore:9};}
  function frozenHoly(){return {damageMultiplier:.25};}
  function surprisePoison(){return {damageMultiplier:.25,duration:3};}
  function shadowStun(){return {duration:2};}
  function glint(){return {duration:2};}
  function trollBlood(rank,divine){return {duration:6,healingFraction:(.20+.05*rank)*divine,regenFraction:.005*rank*divine};}
  function lastStand(rank,divine){return {duration:5,damageMultiplier:1-Math.min(.50,.04*rank*divine),regenFraction:Math.min(.10,.01*rank*divine)};}
  function cowardsMark(){return {duration:3};}
  function create(ports){
    var active=null,sequence=0,healingSequence=0,listeners={};
    function emit(name,event){(listeners[name]||[]).slice().forEach(function(fn){fn(event);});}
    /* Healing shares one capped commit/event channel. Recipient modifiers are
     * resolved by the caller; full restoration is an explicit existing rule. */
    function restore(target,amount,source,options){
      options=options||{};
      var event={id:++healingSequence,target:target,source:source||null,
        actionId:options.actionId!==undefined?options.actionId:ports.actionId(),
        rawAmount:options.rawAmount!==undefined?options.rawAmount:amount,
        amount:amount,restored:0,overflow:0,natural:!!options.natural,regen:!!options.regen,
        damageType:options.damageType,options:options,reason:null};
      if(!target||!Number.isFinite(target.hp)||!Number.isFinite(target.maxhp)||
          !Number.isFinite(amount)||amount<0){event.reason='invalid';return event;}
      var result=heal(target.hp,target.maxhp,amount);
      event.hp=options.fullRestore?target.maxhp:result.hp;
      event.restored=options.fullRestore?Math.max(0,target.maxhp-target.hp):result.restored;
      event.overflow=options.fullRestore?0:result.overflow;
      if(ports.commitHealing)ports.commitHealing(event);else target.hp=event.hp;
      emit('healingApplied',event);
      return event;
    }
    function resolve(target,amount,type,source,options){
      options=options||{};
      var parent=active,event={id:++sequence,target:target,source:source||null,type:damageType(type),rawAmount:amount,
        amount:amount,damage:0,absorbed:[],tags:new Set(options.tags||[]),
        actionId:options.actionId!==undefined?options.actionId:parent?parent.actionId:ports.actionId(),
        procDepth:parent?parent.procDepth+1:0,parentId:parent?parent.id:null,options:options,
        hit:options.hit||null,ability:options.ability||null,reason:null};
      var inherited=options.cause||parent&&parent.source===event.source&&parent.cause||null;
      event.cause=ports.cause?ports.cause(event,inherited):inherited;
      if(!event.type){event.reason='invalid-type';return event;}
      if(!target||!Number.isFinite(amount)||amount<0||!Number.isFinite(target.hp)){event.reason='invalid';return event;}
      // A killing hit may still have riders to resolve before death is committed.
      // Ordinary damage, later actions and periodic ticks cannot damage corpses.
      if(target.hp<=0&&!(event.tags.has('proc')&&!['periodic','arc','reflected','environment'].some(function(tag){return event.tags.has(tag);})&&ports.pendingHit&&ports.pendingHit(target,event.source))){event.reason='invalid';return event;}
      if(event.procDepth>32){event.reason='proc-depth';return event;}
      active=event;
      try{
        if(ports.admit(event)===false)return event;
        if(!options.preMitigated){ports.modify(event);if(event.reason)return event;ports.defend(event);}
        if(event.reason)return event;
        event.damage=Math.max(0,Math.round(event.amount));
        ports.commit(event);
        emit('damageApplied',event);
        if(options.reactions!==false)ports.after(event);
        return event;
      }finally{active=parent;}
    }
    return Object.freeze({resolve:resolve,heal:restore,current:function(){return active;},on:function(name,fn){(listeners[name]||(listeners[name]=[])).push(fn);return function(){listeners[name]=listeners[name].filter(function(f){return f!==fn;});};},emit:emit});
  }
  var api=Object.freeze({trollBlood:trollBlood,lastStand:lastStand,cowardsMark:cowardsMark,types:labels,type:damageType,label:damageLabel,physical:physical,elemental:elemental,absorb:absorb,heal:heal,healingAmount:healingAmount,airArc:airArc,chillArc:chillArc,frozenArcGround:frozenArcGround,chainLightning:chainLightning,siltShield:siltShield,frozenHoly:frozenHoly,surprisePoison:surprisePoison,shadowStun:shadowStun,glint:glint,create:create});
  root.FoteDamage=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis==='object'?globalThis:this);
