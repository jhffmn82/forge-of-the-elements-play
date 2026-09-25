/* Action contexts and hit arithmetic. Inputs are explicit and never mutated. */
(function(root){
  'use strict';
  function criticalMultiplier(agility,gearBonus){
    return 1.6+(agility>=15?.25:0)+(agility>=21?.25:0)+(gearBonus||0);
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
    if(c.sanctuary)m=Math.max(.25,m-.15*c.divine);
    return m;
  }
  function spellDamage(amount,c){
    var n=amount;
    // Bolts and area spells deliberately retain their authored rounding order.
    if(c.bolt&&c.numbing)n=Math.round(n*1.5);
    if(c.crit)n=Math.round(n*c.criticalMultiplier);
    if(!c.bolt&&c.numbing)n=Math.round(n*1.5);
    if(!c.bolt&&c.lightUndead)n=Math.round(n*1.5);
    return n;
  }
  function create(){
    var active=null,sequence=0,listeners={};
    function emit(name,event){(listeners[name]||[]).slice().forEach(function(fn){fn(event);});}
    function run(kind,source,target,options,resolve){
      options=options||{};
      var parent=active,event={id:++sequence,actionId:parent?parent.actionId:sequence,parentId:parent?parent.id:null,
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
  var api=Object.freeze({criticalMultiplier:criticalMultiplier,resistance:resistance,spellDamage:spellDamage,create:create});
  root.FoteActions=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis==='object'?globalThis:this);
