(function(root,factory){
  var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FoteTurns=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function create(hooks){
    var unit=hooks.worldTurn||100,currentClock=null;
    function clock(value){currentClock=value;if(hooks.setClock)hooks.setClock(value);}
    function alive(){return !hooks.alive||hooks.alive();}
    function pulse(value){clock(value);hooks.pulse(value);}
    function advance(from,to){
      if(!(to>from))return;
      var previous=currentClock;
      try{for(var value=(Math.floor(from/unit)+1)*unit;value<=to&&alive();value+=unit)pulse(value);}
      finally{clock(previous);}
    }
    function schedule(from,to){
      if(!(to>from))return {actions:0,pulses:0};
      if(hooks.beforeSchedule)hooks.beforeSchedule();
      var next=(Math.floor(from/unit)+1)*unit,steps=0,result={actions:0,pulses:0},previous=currentClock;
      try{
        while(alive()){
          if(++steps>(hooks.maxSteps||10000))throw new Error('Actor scheduler exceeded its progress bound');
          var actor=null;
          hooks.actors().forEach(function(e){if(hooks.active(e)&&e.t<to&&(!actor||e.t<actor.t))actor=e;});
          if(next<=to&&(!actor||next<=actor.t)){pulse(next);result.pulses++;next+=unit;continue;}
          if(!actor)break;
          clock(Math.max(from,actor.t));var before=actor.t;
          hooks.act(actor);result.actions++;
          if(!(actor.t>before))actor.t=before+Math.max(1,hooks.actorCost(actor)||1);
        }
        return result;
      }finally{clock(previous);}
    }
    function phases(list,context){
      for(var i=0;i<(list||[]).length;i++){
        if(list[i].aliveOnly&&!alive())continue;
        list[i].run(context);
      }
    }
    function action(input){
      if(!alive())return null;
      var context=Object.assign({from:hooks.now(),cost:0,elapsed:false},hooks.snapshot?hooks.snapshot():{},input||{});
      try{
        phases(hooks.prepare,context);
        context.cost=hooks.cost(context);
        if(!Number.isFinite(context.cost)||context.cost<0)throw new Error('Action cost must be finite and non-negative');
        context.to=context.from+context.cost;
        if(context.cost===0)return context;
        context.elapsed=true;
        hooks.advanceAction(context);
        phases(hooks.beforeWorld,context);
        if(alive())schedule(context.from,context.to);
        phases(hooks.afterWorld,context);
        return context;
      }finally{phases(hooks.finalize,context);}
    }
    return Object.freeze({action:action,schedule:schedule,advance:advance,now:function(){return currentClock===null?hooks.now():currentClock;},runPhases:phases});
  }
  return Object.freeze({create:create});
});
