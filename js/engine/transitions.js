/* Floor ownership, paused deadlines, and ordered tile-entry stages. */
(function(root,factory){var catalog=typeof module==='object'&&module.exports?require('./floor-clocks.js'):root.FoteFloorClocks;var api=factory(catalog);if(typeof module==='object'&&module.exports)module.exports=api;else root.FoteTransitions=api;})(globalThis,function(clockCatalog){
  'use strict';
  var sceneEpochs=new WeakMap();
  /* Wall-clock callbacks belong to the floor where they were scheduled. State
   * replacement covers generation/load; the epoch also covers cached-floor
   * travel away and back to the same map and metadata objects. */
  function sceneCallback(state,fn){
    var keys=['RUN','player','map','floorMeta','floorNo','MW','MH'],values=keys.map(function(key){return state.get(key);});
    var revision=state.revision,epoch=sceneEpochs.get(state)||0,active=true;
    return function(){
      if(!active)return;active=false;
      if(state.revision!==revision||(sceneEpochs.get(state)||0)!==epoch||!keys.every(function(key,i){return state.get(key)===values[i];}))return;
      fn();
    };
  }
  function deferScene(state,fn,delay,timers){
    var guarded=sceneCallback(state,fn),active=true;
    var later=timers&&timers.setTimeout||function(callback,ms){return setTimeout(callback,ms);};
    var clear=timers&&timers.clearTimeout||function(id){clearTimeout(id);};
    var timer=later(function(){
      if(!active)return;active=false;
      guarded();
    },delay);
    return function(){if(active){active=false;clear(timer);}};
  }
  var floorKeys=Object.freeze(['MW','MH','map','seen','vis','feats','items','ents','rooms','ground','fireT','fireSrc','props','propGrid','chestKind','floorMeta',
    'levers','plates','altars','iceG','rootG','holyG','spawnedExtra','nextSpawn','worldSeed']);
  function capture(state){
    var player=state.get('player'),saved={};
    floorKeys.forEach(function(key){saved[key]=state.get(key);});
    saved.ents=(saved.ents||[]).filter(function(e){return e!==player&&!e.ally;});
    saved.keys={iron:player.keys&&player.keys.iron||0,crystal:player.keys&&player.keys.crystal||0};
    saved.turn=state.get('turn');saved.clock=player.t;
    return saved;
  }
  function resumeClocks(saved,turn,clock){
    var turns=Number.isFinite(saved.turn)?Math.max(0,turn-saved.turn):0;
    // Legacy stashes did not record the scheduler clock. Their effect durations
    // still resume normally; only newly recorded birth stamps can be rebased.
    var ticks=Number.isFinite(saved.clock)?Math.max(0,clock-saved.clock):0;
    var shifted=new WeakMap();
    function shift(object,key,amount){
      if(!object||!Number.isFinite(object[key]))return;
      var keys=shifted.get(object);if(!keys){keys=new Set();shifted.set(object,keys);}
      if(keys.has(key))return;keys.add(key);object[key]+=amount;
    }
    function path(object,parts,key,amount){
      if(!object)return;if(!parts.length){shift(object,key,amount);return;}
      var first=parts[0],rest=parts.slice(1);
      if(first==='*')Object.keys(object).forEach(function(k){path(object[k],rest,key,amount);});
      else path(object[first],rest,key,amount);
    }
    var amounts={'paid-turn':turns,'world-clock':ticks};
    clockCatalog.records.forEach(function(record){
      if(record.scope==='floor'&&record.pausedFloor==='rebase')path(saved,record.path,record.field,amounts[record.unit]);
    });
    function readPath(object,parts){
      for(var i=0;i<parts.length&&object;i++)object=object[parts[i]];
      return object;
    }
    var actors=[];
    clockCatalog.actorSources.forEach(function(parts){actors=actors.concat(readPath(saved,parts)||[]);});
    actors.forEach(function(actor){
      clockCatalog.records.forEach(function(record){
        if(record.scope==='actor'&&record.pausedFloor==='rebase')path(actor,record.path,record.field,amounts[record.unit]);
      });
    });
    saved.turn=turn;saved.clock=clock;
  }
  function restore(state,saved,floor){
    var size=state.dimensions(saved),player=state.get('player');resumeClocks(saved,state.get('turn'),player.t);
    state.set('MW',size.width);state.set('MH',size.height);
    floorKeys.forEach(function(key){if(saved[key]!==undefined)state.set(key,saved[key]);});
    state.set('ents',saved.ents.concat([player]));state.set('floorNo',floor);
    player.keys={iron:saved.keys&&saved.keys.iron||0,crystal:saved.keys&&saved.keys.crystal||0};
    state.get('ents').forEach(function(e){e._lx=undefined;e._ly=undefined;e.t=player.t;});
    sceneEpochs.set(state,(sceneEpochs.get(state)||0)+1);
  }
  function stages(list){
    var names=new Set();list=list.slice();
    list.forEach(function(stage){if(!stage.name||names.has(stage.name)||typeof stage.run!=='function')throw new Error('Invalid entry stage: '+stage.name);names.add(stage.name);});
    return Object.freeze({names:Object.freeze(Array.from(names)),run:function(context){for(var i=0;i<list.length;i++)if(list[i].run(context)===true)return true;return false;}});
  }
  return Object.freeze({floorKeys:floorKeys,capture:capture,restore:restore,resumeClocks:resumeClocks,stages:stages,sceneCallback:sceneCallback,deferScene:deferScene});
});
