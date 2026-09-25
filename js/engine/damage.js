/* Damage events and numeric rules. No actor globals, browser or content tables. */
(function(root){
  'use strict';
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
  function create(ports){
    var active=null,sequence=0,listeners={};
    function emit(name,event){(listeners[name]||[]).slice().forEach(function(fn){fn(event);});}
    function resolve(target,amount,type,source,options){
      options=options||{};
      var parent=active,event={id:++sequence,target:target,source:source||null,type:type||'phys',rawAmount:amount,
        amount:amount,damage:0,absorbed:[],tags:new Set(options.tags||[]),
        actionId:options.actionId!==undefined?options.actionId:parent?parent.actionId:ports.actionId(),
        procDepth:parent?parent.procDepth+1:0,parentId:parent?parent.id:null,options:options,
        hit:options.hit||null,ability:options.ability||null,reason:null};
      if(!target||!Number.isFinite(amount)||amount<0||!Number.isFinite(target.hp)||target.hp<=0){event.reason='invalid';return event;}
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
    return Object.freeze({resolve:resolve,current:function(){return active;},on:function(name,fn){(listeners[name]||(listeners[name]=[])).push(fn);return function(){listeners[name]=listeners[name].filter(function(f){return f!==fn;});};},emit:emit});
  }
  var api=Object.freeze({physical:physical,elemental:elemental,absorb:absorb,heal:heal,create:create});
  root.FoteDamage=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis==='object'?globalThis:this);
