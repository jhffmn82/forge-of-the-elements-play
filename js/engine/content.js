/* Ordered prop preparation with one creation point. A stage may replace a prop
 * with terrain or a recursively placed set piece; completed stages still finish
 * in reverse order. No module mutates the public creation function. */
(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FoteContent=api;})(globalThis,function(){
  'use strict';
  function props(stages,commit){
    stages=stages.slice();var names=stages.map(function(s){return s.name;});
    if(new Set(names).size!==names.length||stages.some(function(s){return !s.name||typeof s.prepare!=='function';}))throw Error('Invalid prop stages');
    function place(request,start){
      var from=start===undefined?0:names.indexOf(start);if(from<0)throw Error('Unknown prop stage '+start);
      var context=Object.assign({after:[],done:false,result:null},request);
      for(var i=from;i<stages.length&&!context.done;i++)stages[i].prepare(context);
      var result=context.done?context.result:commit(context);
      for(var j=context.after.length-1;j>=0;j--)context.after[j](result);
      return result;
    }
    return Object.freeze({place:place,stageNames:Object.freeze(names)});
  }
  return Object.freeze({props:props});
});
