(function(root,factory){
  var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FoteTurns=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function create(hooks){
    var unit=hooks.worldTurn||100,currentClock=null,pending=null,generation=0,flushing=false;
    function clock(value){currentClock=value;if(hooks.setClock)hooks.setClock(value);}
    function alive(){return !hooks.alive||hooks.alive();}
    function pulse(value){clock(value);hooks.pulse(value);}
    function advance(from,to){
      if(!(to>from))return;
      var previous=currentClock;
      try{for(var value=(Math.floor(from/unit)+1)*unit;value<=to&&alive();value+=unit)pulse(value);}
      finally{clock(previous);}
    }
    function* scheduleFlow(from,to){
      if(!(to>from))return {actions:0,pulses:0};
      if(hooks.beforeSchedule)hooks.beforeSchedule();
      var next=(Math.floor(from/unit)+1)*unit,steps=0,result={actions:0,pulses:0},previous=currentClock;
      try{
        if(hooks.beforeActors)yield hooks.beforeActors();
        while(alive()){
          if(++steps>(hooks.maxSteps||10000))throw new Error('Actor scheduler exceeded its progress bound');
          var actor=null;
          hooks.actors().forEach(function(e){if(hooks.active(e)&&e.t<to&&(!actor||e.t<actor.t))actor=e;});
          if(next<=to&&(!actor||next<=actor.t)){pulse(next);result.pulses++;next+=unit;continue;}
          if(!actor)break;
          clock(Math.max(from,actor.t));var before=actor.t;
          if(hooks.beforeActor)hooks.beforeActor(actor);
          hooks.act(actor);result.actions++;
          if(!(actor.t>before))actor.t=before+Math.max(1,hooks.actorCost(actor)||1);
          var wait=hooks.afterActor?hooks.afterActor(actor):0;
          // A paused animation is presentation time, never an active world pulse.
          clock(previous);
          yield wait;
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
    function* actionFlow(input){
      if(!alive())return null;
      var born=generation;
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
        if(alive())yield* scheduleFlow(context.from,context.to);
        phases(hooks.afterWorld,context);
        return context;
      }finally{if(born===generation)phases(hooks.finalize,context);}
    }
    /* One resumable driver owns the turn. Headless/reduced-motion work remains
     * synchronous; only finite visible animations yield to the browser. */
    function run(iterator){
      if(pending)return null;
      var task={iterator:iterator,cancelWait:null,promise:null,resolve:null,reject:null,after:[]};pending=task;
      function step(){
        if(pending!==task)return;
        task.cancelWait=null;
        try{
          for(;;){
            var result;task.running=true;try{result=iterator.next();}finally{task.running=false;}
            if(result.done){pending=null;task.after.forEach(function(fn){fn(result.value);});if(task.resolve)task.resolve(result.value);return result.value;}
            var delay=Number(result.value)||0;
            if(delay>0&&!flushing){
              if(!task.promise)task.promise=new Promise(function(resolve,reject){task.resolve=resolve;task.reject=reject;});
              var defer=hooks.defer||function(resume,ms){var id=setTimeout(resume,Math.ceil(ms));return function(){clearTimeout(id);};};
              task.cancelWait=defer(step,delay);return task.promise;
            }
          }
        }catch(error){pending=null;if(task.reject){task.reject(error);if(flushing)throw error;return task.promise;}throw error;}
      }
      task.step=step;return step();
    }
    function flush(){
      if(!pending||pending.running)return;
      var task=pending;if(task.cancelWait)task.cancelWait();
      flushing=true;try{return task.step();}finally{flushing=false;}
    }
    function cancel(){
      generation++;
      var task=pending;if(!task)return;
      pending=null;if(task.cancelWait)task.cancelWait();
      try{task.iterator.return();}finally{clock(null);if(task.resolve)task.resolve(null);}
    }
    return Object.freeze({action:function(input){return run(actionFlow(input));},schedule:function(from,to){return run(scheduleFlow(from,to));},advance:advance,
      busy:function(){return !!pending;},running:function(){return !!(pending&&pending.running);},settled:function(){return pending&&pending.promise;},flushing:function(){return flushing;},flush:flush,cancel:cancel,
      after:function(fn){if(pending){pending.after.push(fn);return pending.promise;}return fn();},
      now:function(){return currentClock===null?hooks.now():currentClock;},runPhases:phases});
  }
  return Object.freeze({create:create});
});
