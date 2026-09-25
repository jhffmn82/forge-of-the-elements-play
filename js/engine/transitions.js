/* Floor ownership, paused deadlines, and ordered tile-entry stages. */
(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FoteTransitions=api;})(globalThis,function(){
  'use strict';
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
    function fields(object,keys,amount){keys.forEach(function(key){shift(object,key,amount);});}
    var meta=saved.floorMeta||{};
    ['marks','clouds','dark','shockClouds','tides','upheaval'].forEach(function(key){path(meta,[key,'*'],'until',turns);});
    ['hazardPending','fwaPending','mortyReturn','pendingLich','maw'].forEach(function(key){path(meta,[key],'at',turns);});
    ['corpses','regrow'].forEach(function(key){path(meta,[key,'*'],'at',turns);});
    path(meta,['deathRemains','*'],'bornAt',ticks);path(meta,['deathRemains','*'],'expiresAt',ticks);
    path(meta,['smoke'],'until',turns);path(meta,['sanctuary'],'until',ticks);
    path(meta,['chaosCombat','hazards','*'],'bornAt',ticks);path(meta,['chaosCombat','hazards','*'],'expiresAt',ticks);
    path(meta,['chaosCombat'],'lastPulse',ticks);
    ['majorReadyAt','rushReadyAt','summonReadyAt'].forEach(function(key){path(meta,['unmakerEncounter'],key,ticks);});
    path(meta,['unmakerEncounter','warning'],'armedTurn',turns);
    path(meta,['matron'],'nextRit',turns);path(meta,['matron','rit'],'at',turns);path(meta,['matron','venom'],'at',turns);
    fields(meta,['_arcTurn'],turns);
    path(saved,['items','*'],'until',turns);path(saved,['props','*'],'until',turns);
    path(saved,['rooms','*'],'cooledUntil',turns);path(meta,['puzzles','*'],'cooledUntil',turns);
    shift(saved,'nextSpawn',turns);
    var actors=(saved.ents||[]).concat(meta.pendingLich&&meta.pendingLich.entity||[],meta.maw&&meta.maw.ent||[]);
    actors.forEach(function(e){
      fields(e,['stormChargeAt','stormReady','sparkReady','stoneImm','caughtOff','_surfT','_burnedAt','_fumeAt','_shellTurn','_blockTurn','_hitKey','_immuneMsg'],turns);
      ['zap','grasp','brand','erupt'].forEach(function(key){path(e,[key],'at',turns);});
      fields(e,['rallyUntil','challengeUntil','waterPullReadyAt'],ticks);
      fields(e,['chaosCooldown','chaosDebuffReadyAt'],ticks);
      path(e,['st','*'],'bornAt',ticks);
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
  }
  function stages(list){
    var names=new Set();list=list.slice();
    list.forEach(function(stage){if(!stage.name||names.has(stage.name)||typeof stage.run!=='function')throw new Error('Invalid entry stage: '+stage.name);names.add(stage.name);});
    return Object.freeze({names:Object.freeze(Array.from(names)),run:function(context){for(var i=0;i<list.length;i++)if(list[i].run(context)===true)return true;return false;}});
  }
  return Object.freeze({floorKeys:floorKeys,capture:capture,restore:restore,resumeClocks:resumeClocks,stages:stages});
});
