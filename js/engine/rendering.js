(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FoteRendering=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function checked(entries){var names=new Set();return Object.freeze(entries.map(function(entry){if(!entry.name||names.has(entry.name))throw Error('Duplicate or unnamed render pass: '+entry.name);names.add(entry.name);return Object.freeze(Object.assign({},entry));}));}
  function sequence(entries){entries=checked(entries);return function(){var args=arguments;for(var entry of entries)if(!entry.when||entry.when.apply(null,args))entry.run.apply(null,args);};}
  function dispatch(entries){entries=checked(entries);return function(){var args=arguments;for(var entry of entries){if(entry.when&&!entry.when.apply(null,args))continue;var result=entry.run.apply(null,args);if(result!==false&&result!==undefined&&result!==null)return result;}return false;};}
  /* Scopes enter in visible priority order and leave in reverse order. Each
   * scope owns its cleanup, including after an exception. No pass captures or
   * invokes the renderer it replaced. A paint result, including false, ends
   * selection; undefined means the next feature may handle the object. */
  function layered(entries){entries=checked(entries);return function(context){var cleanup=[],complete=false;
    try{for(var entry of entries){if(entry.when&&!entry.when(context))continue;if(entry.enter){var leave=entry.enter(context);if(typeof leave==='function')cleanup.push(leave);}if(entry.paint){var result=entry.paint(context);if(result!==undefined){complete=true;return result;}}}complete=true;return false;}
    finally{var error=null;for(var i=cleanup.length-1;i>=0;i--)try{cleanup[i](complete);}catch(e){if(!error)error=e;}if(error)throw error;}
  };}
  return Object.freeze({sequence:sequence,dispatch:dispatch,layered:layered});
});
