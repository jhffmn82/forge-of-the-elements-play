/* Deterministic floor orchestration. Domain stages are explicit dependencies;
 * module evaluation never wraps or reassigns the generation entry point. */
(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;else root.FoteGeneration=api;
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  function create(config){
    var layoutStages=config.layoutStages.slice(),finishStages=config.finishStages.slice();
    var names=new Set();
    layoutStages.concat(finishStages).forEach(function(stage){
      if(!stage.name||typeof stage.run!=='function'||names.has(stage.name))throw new Error('Invalid or duplicate generation stage: '+stage.name);
      names.add(stage.name);
    });
    function runStages(stages,seed){for(var i=0;i<stages.length;i++)stages[i].run(seed);}
    function generate(seed){
      config.begin();
      try{
        var clock=config.clock();
        for(var attempt=0;attempt<8;attempt++){
          if(config.attempt((seed+attempt*7919)>>>0)){
            config.commit(clock);
            break;
          }
        }
        // The old post-generation passes also ran after retry exhaustion.
        runStages(layoutStages,seed);
      }finally{config.end();}
      runStages(finishStages,seed);
    }
    return Object.freeze({generate:generate,stageNames:Object.freeze(Array.from(names))});
  }
  return Object.freeze({create:create});
});
